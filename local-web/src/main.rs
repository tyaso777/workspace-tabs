#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(target_os = "windows"))]
compile_error!("WorkspaceTabs Local Web currently supports Windows only.");

#[path = "../../explorer-shell/src-tauri/src/preview.rs"]
mod preview;
#[path = "../../explorer-shell/src-tauri/src/store.rs"]
mod store;

use axum::extract::{Path as AxumPath, Query, State};
use axum::http::{header, HeaderMap, StatusCode, Uri};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use explorer_core::{LinkId, NoteId, ProjectId, TabId, Workspace};
use explorer_view_model::workspace_to_dto;
use futures_util::stream::unfold;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use preview::preview_file;
use rand::RngCore;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::convert::Infallible;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::os::windows::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use store::SqliteWorkspaceStore;
use tokio::sync::{broadcast, watch};
use tokio::time::Duration;

include!(concat!(env!("OUT_DIR"), "/embedded_assets.rs"));

const DEFAULT_PORT: u16 = 47_831;
const DEFAULT_TAB_NAME: &str = "New Tab";

#[derive(Clone)]
struct WebState(Arc<AppState>);

struct AppState {
    workspace: Mutex<Workspace>,
    store: Mutex<SqliteWorkspaceStore>,
    storage_info: StorageInfoDto,
    token: String,
    port: u16,
    folder_watcher: Mutex<Option<FolderWatcher>>,
    events: broadcast::Sender<String>,
    lifecycle: ClientLifecycle,
    _instance_lock: File,
}

struct FolderWatcher {
    folder_path: PathBuf,
    _watcher: RecommendedWatcher,
}

#[derive(Clone)]
struct ClientLifecycle {
    inner: Arc<Mutex<ClientLifecycleInner>>,
    shutdown: watch::Sender<bool>,
}

#[derive(Default)]
struct ClientLifecycleInner {
    clients: HashMap<String, ClientStatus>,
    ever_connected: bool,
}

struct ClientStatus {
    generation: u64,
    connected: bool,
}

impl ClientLifecycle {
    fn new() -> Self {
        let (shutdown, _) = watch::channel(false);
        Self {
            inner: Arc::new(Mutex::new(ClientLifecycleInner::default())),
            shutdown,
        }
    }

    fn subscribe(&self) -> watch::Receiver<bool> {
        self.shutdown.subscribe()
    }

    fn shutdown_now(&self) {
        let _ = self.shutdown.send(true);
    }

    fn connect(&self, client_id: &str) -> u64 {
        let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
        inner.ever_connected = true;
        let client = inner
            .clients
            .entry(client_id.to_string())
            .or_insert(ClientStatus {
                generation: 0,
                connected: false,
            });
        client.generation += 1;
        client.connected = true;
        client.generation
    }

    fn request_close(&self, client_id: &str) {
        let generation = {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            inner.ever_connected = true;
            let client = inner
                .clients
                .entry(client_id.to_string())
                .or_insert(ClientStatus {
                    generation: 0,
                    connected: false,
                });
            client.generation += 1;
            client.connected = false;
            client.generation
        };
        self.schedule_expiry(client_id.to_string(), generation, Duration::from_secs(10));
    }

    fn disconnect(&self, client_id: &str, generation: u64) {
        let should_schedule = {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            let Some(client) = inner.clients.get_mut(client_id) else {
                return;
            };
            if client.generation != generation || !client.connected {
                false
            } else {
                client.connected = false;
                true
            }
        };
        if should_schedule {
            self.schedule_expiry(client_id.to_string(), generation, Duration::from_secs(60));
        }
    }

    fn start_startup_timeout(&self) {
        let lifecycle = self.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(30)).await;
            let should_shutdown = {
                let inner = lifecycle
                    .inner
                    .lock()
                    .unwrap_or_else(|error| error.into_inner());
                !inner.ever_connected
            };
            if should_shutdown {
                let _ = lifecycle.shutdown.send(true);
            }
        });
    }

    fn schedule_expiry(&self, client_id: String, generation: u64, grace: Duration) {
        let lifecycle = self.clone();
        tokio::spawn(async move {
            tokio::time::sleep(grace).await;
            lifecycle.expire(&client_id, generation);
        });
    }

    fn expire(&self, client_id: &str, generation: u64) {
        let should_shutdown = {
            let mut inner = self.inner.lock().unwrap_or_else(|error| error.into_inner());
            let should_remove = inner
                .clients
                .get(client_id)
                .is_some_and(|client| client.generation == generation && !client.connected);
            if should_remove {
                inner.clients.remove(client_id);
            }
            inner.ever_connected && inner.clients.is_empty()
        };
        if should_shutdown {
            let _ = self.shutdown.send(true);
        }
    }
}

struct ClientLease {
    lifecycle: ClientLifecycle,
    client_id: String,
    generation: u64,
}

impl Drop for ClientLease {
    fn drop(&mut self) {
        self.lifecycle.disconnect(&self.client_id, self.generation);
    }
}

struct EventStreamState {
    receiver: broadcast::Receiver<String>,
    shutdown: watch::Receiver<bool>,
    _lease: ClientLease,
}

async fn receive_event(
    receiver: &mut broadcast::Receiver<String>,
    shutdown: &mut watch::Receiver<bool>,
) -> Option<String> {
    loop {
        if *shutdown.borrow() {
            return None;
        }
        tokio::select! {
            result = receiver.recv() => match result {
                Ok(payload) => return Some(payload),
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => return None,
            },
            changed = shutdown.changed() => {
                if changed.is_err() || *shutdown.borrow() {
                    return None;
                }
            }
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct FileEntryDto {
    name: String,
    path: String,
    is_dir: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum StorageModeDto {
    AppData,
    Portable,
}

#[derive(Debug, Clone, Serialize)]
struct StorageInfoDto {
    mode: StorageModeDto,
    database_path: String,
}

struct StorageLocation {
    mode: StorageModeDto,
    database_path: PathBuf,
}

fn allowed_host(host: &str, port: u16) -> bool {
    host.eq_ignore_ascii_case(&format!("127.0.0.1:{port}"))
        || host.eq_ignore_ascii_case(&format!("localhost:{port}"))
}

fn allowed_origin(origin: Option<&str>, port: u16) -> bool {
    matches!(
        origin,
        Some(value)
            if value.eq_ignore_ascii_case(&format!("http://127.0.0.1:{port}"))
                || value.eq_ignore_ascii_case(&format!("http://localhost:{port}"))
    )
}

fn valid_api_token(expected: &str, supplied: Option<&str>) -> bool {
    supplied.is_some_and(|value| value.as_bytes() == expected.as_bytes())
}

fn host_from(headers: &HeaderMap) -> &str {
    headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
}

fn origin_from(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
}

fn token_from(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("x-workspace-tabs-token")
        .and_then(|value| value.to_str().ok())
}

fn authorized_api(headers: &HeaderMap, state: &AppState) -> bool {
    allowed_host(host_from(headers), state.port)
        && allowed_origin(origin_from(headers), state.port)
        && valid_api_token(&state.token, token_from(headers))
}

async fn invoke_api(
    State(state): State<WebState>,
    AxumPath(command): AxumPath<String>,
    headers: HeaderMap,
    Json(args): Json<Value>,
) -> Response {
    if !authorized_api(&headers, &state.0) {
        return api_error(StatusCode::FORBIDDEN, "Local Web request rejected.");
    }

    let app = state.0.clone();
    match tokio::task::spawn_blocking(move || invoke_command(&app, &command, args)).await {
        Ok(Ok(value)) => Json(value).into_response(),
        Ok(Err(message)) => api_error(StatusCode::BAD_REQUEST, &message),
        Err(error) => api_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()),
    }
}

async fn event_stream(
    State(state): State<WebState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> Response {
    let supplied_token = query.get("token").map(String::as_str);
    let client_id = query
        .get("clientId")
        .map(String::as_str)
        .unwrap_or_default();
    if !allowed_host(host_from(&headers), state.0.port)
        || !valid_api_token(&state.0.token, supplied_token)
        || client_id.is_empty()
        || client_id.len() > 128
    {
        return api_error(StatusCode::FORBIDDEN, "Local Web event stream rejected.");
    }

    let generation = state.0.lifecycle.connect(client_id);
    let stream_state = EventStreamState {
        receiver: state.0.events.subscribe(),
        shutdown: state.0.lifecycle.subscribe(),
        _lease: ClientLease {
            lifecycle: state.0.lifecycle.clone(),
            client_id: client_id.to_string(),
            generation,
        },
    };
    let stream = unfold(stream_state, |mut stream_state| async move {
        let payload = receive_event(&mut stream_state.receiver, &mut stream_state.shutdown).await?;
        Some((
            Ok::<Event, Infallible>(Event::default().data(payload)),
            stream_state,
        ))
    });
    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

async fn client_close(
    State(state): State<WebState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> Response {
    let supplied_token = query.get("token").map(String::as_str);
    let client_id = query
        .get("clientId")
        .map(String::as_str)
        .unwrap_or_default();
    if !allowed_host(host_from(&headers), state.0.port)
        || !allowed_origin(origin_from(&headers), state.0.port)
        || !valid_api_token(&state.0.token, supplied_token)
        || client_id.is_empty()
        || client_id.len() > 128
    {
        return api_error(StatusCode::FORBIDDEN, "Local Web close request rejected.");
    }
    state.0.lifecycle.request_close(client_id);
    StatusCode::NO_CONTENT.into_response()
}

async fn health(headers: HeaderMap, State(state): State<WebState>) -> Response {
    if !allowed_host(host_from(&headers), state.0.port) {
        return StatusCode::FORBIDDEN.into_response();
    }
    StatusCode::NO_CONTENT.into_response()
}

async fn shutdown_local_web(State(state): State<WebState>, headers: HeaderMap) -> Response {
    if !authorized_api(&headers, &state.0) {
        return api_error(
            StatusCode::FORBIDDEN,
            "Local Web shutdown request rejected.",
        );
    }
    state.0.lifecycle.shutdown_now();
    StatusCode::NO_CONTENT.into_response()
}

async fn static_file(State(state): State<WebState>, headers: HeaderMap, uri: Uri) -> Response {
    if !allowed_host(host_from(&headers), state.0.port) {
        return StatusCode::FORBIDDEN.into_response();
    }

    let route = if uri.path() == "/" {
        "/index.html"
    } else {
        uri.path()
    };
    let Some((mime, bytes)) = embedded_asset(route) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let body = if route == "/index.html" {
        let html = String::from_utf8_lossy(bytes);
        inject_local_web_config(&html, &state.0.token).into_bytes()
    } else {
        bytes.to_vec()
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CACHE_CONTROL, "no-store")
        .body(axum::body::Body::from(body))
        .unwrap()
}

fn inject_local_web_config(html: &str, token: &str) -> String {
    html.replace(
        "</head>",
        &format!(
            "<meta name=\"workspace-tabs-runtime\" content=\"local-web\" /><meta name=\"workspace-tabs-token\" content=\"{}\" /></head>",
            token
        ),
    )
}

fn api_error(status: StatusCode, message: &str) -> Response {
    (status, Json(json!({ "error": message }))).into_response()
}

fn invoke_command(state: &AppState, command: &str, args: Value) -> Result<Value, String> {
    match command {
        "workspace_snapshot" => {
            let workspace = lock(&state.workspace)?;
            to_value(workspace_to_dto(&workspace))
        }
        "storage_info" => to_value(state.storage_info.clone()),
        "load_window_width" => to_value(lock(&state.store)?.load_window_width().map_err(err)?),
        "load_window_height" => to_value(lock(&state.store)?.load_window_height().map_err(err)?),
        "save_window_width" => {
            lock(&state.store)?
                .save_window_width(u32_arg(&args, "width")?.clamp(640, 3840))
                .map_err(err)?;
            Ok(Value::Null)
        }
        "save_window_height" => {
            lock(&state.store)?
                .save_window_height(u32_arg(&args, "height")?.clamp(560, 2160))
                .map_err(err)?;
            Ok(Value::Null)
        }
        "load_project_sort_mode" => {
            to_value(lock(&state.store)?.load_project_sort_mode().map_err(err)?)
        }
        "save_project_sort_mode" => {
            lock(&state.store)?
                .save_project_sort_mode(&string_arg(&args, "mode")?)
                .map_err(err)?;
            Ok(Value::Null)
        }
        "load_project_custom_order" => to_value(
            lock(&state.store)?
                .load_project_custom_order()
                .map_err(err)?,
        ),
        "save_project_custom_order" => {
            lock(&state.store)?
                .save_project_custom_order(&u64_vec_arg(&args, "projectIds")?)
                .map_err(err)?;
            Ok(Value::Null)
        }
        "load_sidebar_collapsed" => {
            to_value(lock(&state.store)?.load_sidebar_collapsed().map_err(err)?)
        }
        "save_sidebar_collapsed" => {
            lock(&state.store)?
                .save_sidebar_collapsed(bool_arg(&args, "collapsed")?)
                .map_err(err)?;
            Ok(Value::Null)
        }
        "load_notes_custom_height" => to_value(lock(&state.store)?.load_notes_custom_height().map_err(err)?),
        "save_notes_custom_height" => {
            lock(&state.store)?
                .save_notes_custom_height(optional_u32_arg(&args, "height")?)
                .map_err(err)?;
            Ok(Value::Null)
        }
        "load_notes_maximized" => to_value(lock(&state.store)?.load_notes_maximized().map_err(err)?),
        "save_notes_maximized" => {
            lock(&state.store)?.save_notes_maximized(bool_arg(&args, "maximized")?).map_err(err)?;
            Ok(Value::Null)
        }
        "create_project" => mutate_workspace(state, |workspace| {
            let project_id = workspace
                .create_project(string_arg(&args, "name")?, string_arg(&args, "summary")?)
                .map_err(err)?;
            workspace
                .add_tab(project_id, DEFAULT_TAB_NAME, PathBuf::new())
                .map_err(err)?;
            Ok(())
        }),
        "update_project" => mutate_workspace(state, |workspace| {
            workspace
                .update_project(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    string_arg(&args, "name")?,
                    string_arg(&args, "summary")?,
                )
                .map_err(err)
        }),
        "add_note" => mutate_workspace(state, |workspace| {
            let project_id = ProjectId::from_value(u64_arg(&args, "projectId")?);
            let note_id = workspace
                .add_note(
                    project_id,
                    string_arg(&args, "title")?,
                    string_arg(&args, "content")?,
                )
                .map_err(err)?;
            workspace.activate_note(project_id, note_id).map_err(err)
        }),
        "update_note" => mutate_workspace(state, |workspace| {
            workspace
                .update_note(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    NoteId::from_value(u64_arg(&args, "noteId")?),
                    string_arg(&args, "title")?,
                    string_arg(&args, "content")?,
                )
                .map_err(err)
        }),
        "activate_note" => mutate_workspace(state, |workspace| {
            workspace
                .activate_note(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    NoteId::from_value(u64_arg(&args, "noteId")?),
                )
                .map_err(err)
        }),
        "delete_note" => mutate_workspace(state, |workspace| {
            workspace
                .delete_note(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    NoteId::from_value(u64_arg(&args, "noteId")?),
                )
                .map_err(err)
        }),
        "delete_notes" => mutate_workspace(state, |workspace| {
            let note_ids = u64_vec_arg(&args, "noteIds")?
                .into_iter()
                .map(NoteId::from_value)
                .collect::<Vec<_>>();
            workspace
                .delete_notes(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    &note_ids,
                )
                .map_err(err)
        }),
        "delete_project" => mutate_workspace(state, |workspace| {
            workspace
                .delete_project(ProjectId::from_value(u64_arg(&args, "projectId")?))
                .map_err(err)
        }),
        "delete_projects" => mutate_workspace(state, |workspace| {
            let project_ids = u64_vec_arg(&args, "projectIds")?
                .into_iter()
                .map(ProjectId::from_value)
                .collect::<Vec<_>>();
            workspace.delete_projects(&project_ids).map_err(err)
        }),
        "add_tab" => mutate_workspace(state, |workspace| {
            workspace
                .add_tab(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    string_arg(&args, "name")?,
                    PathBuf::from(string_arg(&args, "folderPath")?),
                )
                .map(|_| ())
                .map_err(err)
        }),
        "add_links_tab" => mutate_workspace(state, |workspace| {
            workspace
                .add_links_tab(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    string_arg(&args, "name")?,
                )
                .map(|_| ())
                .map_err(err)
        }),
        "update_tab_name" => mutate_workspace(state, |workspace| {
            workspace
                .update_tab_name(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    string_arg(&args, "name")?,
                )
                .map_err(err)
        }),
        "add_links" => mutate_workspace(state, |workspace| {
            workspace
                .add_links(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    link_inputs_arg(&args)?,
                )
                .map(|_| ())
                .map_err(err)
        }),
        "update_link" => mutate_workspace(state, |workspace| {
            workspace
                .update_link(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    LinkId::from_value(u64_arg(&args, "linkId")?),
                    string_arg(&args, "name")?,
                    string_arg(&args, "url")?,
                )
                .map_err(err)
        }),
        "select_link" => mutate_workspace(state, |workspace| {
            workspace
                .select_link(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    optional_u64_arg(&args, "linkId")?.map(LinkId::from_value),
                )
                .map_err(err)
        }),
        "update_checked_links" => mutate_workspace(state, |workspace| {
            workspace
                .update_checked_links(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    u64_vec_arg(&args, "linkIds")?
                        .into_iter()
                        .map(LinkId::from_value)
                        .collect(),
                )
                .map_err(err)
        }),
        "delete_links" => mutate_workspace(state, |workspace| {
            let link_ids = u64_vec_arg(&args, "linkIds")?
                .into_iter()
                .map(LinkId::from_value)
                .collect::<Vec<_>>();
            workspace
                .delete_links(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    &link_ids,
                )
                .map_err(err)
        }),
        "move_link" => mutate_workspace(state, |workspace| {
            workspace
                .move_link(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    LinkId::from_value(u64_arg(&args, "linkId")?),
                    usize_arg(&args, "targetIndex")?,
                )
                .map_err(err)
        }),
        "update_tab" => mutate_workspace(state, |workspace| {
            workspace
                .update_tab(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    string_arg(&args, "name")?,
                    PathBuf::from(string_arg(&args, "folderPath")?),
                )
                .map_err(err)
        }),
        "delete_tab" => mutate_workspace(state, |workspace| {
            workspace
                .delete_tab(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                )
                .map_err(err)
        }),
        "delete_tabs" => mutate_workspace(state, |workspace| {
            let tab_ids = u64_vec_arg(&args, "tabIds")?
                .into_iter()
                .map(TabId::from_value)
                .collect::<Vec<_>>();
            workspace
                .delete_tabs(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    &tab_ids,
                )
                .map_err(err)
        }),
        "undo_last" => mutate_workspace(state, |workspace| {
            workspace
                .undo_last()
                .then_some(())
                .ok_or_else(|| "nothing to undo".to_string())
        }),
        "move_tab" => mutate_workspace(state, |workspace| {
            workspace
                .move_tab(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    usize_arg(&args, "targetIndex")?,
                )
                .map_err(err)
        }),
        "move_tabs" => mutate_workspace(state, |workspace| {
            let tab_ids = u64_vec_arg(&args, "tabIds")?
                .into_iter()
                .map(TabId::from_value)
                .collect::<Vec<_>>();
            workspace
                .move_tabs(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    &tab_ids,
                    usize_arg(&args, "targetIndex")?,
                )
                .map_err(err)
        }),
        "activate_tab" => mutate_workspace(state, |workspace| {
            workspace
                .activate_tab(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                )
                .map_err(err)
        }),
        "select_path" => mutate_workspace(state, |workspace| {
            workspace
                .select_path(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    PathBuf::from(string_arg(&args, "path")?),
                )
                .map_err(err)
        }),
        "clear_selected_path" => mutate_workspace(state, |workspace| {
            workspace
                .clear_selected_path(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                )
                .map_err(err)
        }),
        "update_checked_paths" => mutate_workspace(state, |workspace| {
            workspace
                .update_checked_paths(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    TabId::from_value(u64_arg(&args, "tabId")?),
                    string_vec_arg(&args, "paths")?
                        .into_iter()
                        .map(PathBuf::from)
                        .collect(),
                )
                .map_err(err)
        }),
        "record_opened_file" => mutate_workspace(state, |workspace| {
            workspace
                .record_opened_file(
                    ProjectId::from_value(u64_arg(&args, "projectId")?),
                    PathBuf::from(string_arg(&args, "path")?),
                )
                .map_err(err)
        }),
        "list_folder" => to_value(list_folder(&string_arg(&args, "folderPath")?)?),
        "open_file" => {
            let project_id = ProjectId::from_value(u64_arg(&args, "projectId")?);
            let path = PathBuf::from(string_arg(&args, "path")?);
            open_path(&path)?;
            mutate_workspace(state, |workspace| {
                workspace.record_opened_file(project_id, path).map_err(err)
            })
        }
        "open_folder" => {
            let path = PathBuf::from(string_arg(&args, "folderPath")?);
            if !path.is_dir() {
                return Err(format!("not a folder: '{}'", path.display()));
            }
            open_path(&path)?;
            Ok(Value::Null)
        }
        "open_url" => {
            let url = string_arg(&args, "url")?;
            validate_http_url(&url)?;
            open::that(url).map_err(err)?;
            Ok(Value::Null)
        }
        "open_storage_folder" => {
            let database_path = PathBuf::from(&state.storage_info.database_path);
            let folder = storage_folder_path(&database_path)?;
            open_path(&folder)?;
            Ok(Value::Null)
        }
        "preview_file" => to_value(preview_file(&PathBuf::from(string_arg(&args, "path")?))),
        "choose_folder" => {
            let mut dialog = rfd::FileDialog::new();
            if let Some(default_path) = optional_string_arg(&args, "defaultPath") {
                if !default_path.is_empty() {
                    dialog = dialog.set_directory(default_path);
                }
            }
            to_value(dialog.pick_folder().map(|path| path_to_string(&path)))
        }
        "watch_folder" => {
            watch_folder(state, PathBuf::from(string_arg(&args, "folderPath")?))?;
            Ok(Value::Null)
        }
        _ => Err(format!("unknown command: {command}")),
    }
}

fn mutate_workspace<F>(state: &AppState, mutation: F) -> Result<Value, String>
where
    F: FnOnce(&mut Workspace) -> Result<(), String>,
{
    let mut workspace = lock(&state.workspace)?;
    mutation(&mut workspace)?;
    lock(&state.store)?
        .save_workspace(&workspace)
        .map_err(err)?;
    to_value(workspace_to_dto(&workspace))
}

fn watch_folder(state: &AppState, next_folder: PathBuf) -> Result<(), String> {
    let mut watcher_slot = lock(&state.folder_watcher)?;
    if !next_folder.is_dir() {
        *watcher_slot = None;
        return Ok(());
    }
    if watcher_slot
        .as_ref()
        .is_some_and(|watcher| watcher.folder_path == next_folder)
    {
        return Ok(());
    }

    let event_folder = next_folder.clone();
    let events = state.events.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result: notify::Result<notify::Event>| {
            if result.is_ok() {
                let _ = events
                    .send(json!({ "folder_path": path_to_string(&event_folder) }).to_string());
            }
        },
        Config::default(),
    )
    .map_err(err)?;
    watcher
        .watch(&next_folder, RecursiveMode::NonRecursive)
        .map_err(err)?;
    *watcher_slot = Some(FolderWatcher {
        folder_path: next_folder,
        _watcher: watcher,
    });
    Ok(())
}

fn list_folder(folder_path: &str) -> Result<Vec<FileEntryDto>, String> {
    let mut entries = fs::read_dir(folder_path)
        .map_err(|error| format!("failed to read folder '{}': {}", folder_path, error))?
        .map(|entry| {
            let entry = entry.map_err(err)?;
            let file_type = entry.file_type().map_err(err)?;
            Ok(FileEntryDto {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path_to_string(&entry.path()),
                is_dir: file_type.is_dir(),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(entries)
}

fn open_path(path: &Path) -> Result<(), String> {
    open::that(path).map_err(|error| format!("failed to open '{}': {}", path.display(), error))
}

fn resolve_storage_location(exe_path: &Path) -> Result<StorageLocation, String> {
    let exe_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    let portable_dir = exe_dir.join("data");
    if portable_dir.is_dir() {
        return Ok(StorageLocation {
            mode: StorageModeDto::Portable,
            database_path: portable_dir.join("workspace.sqlite3"),
        });
    }
    let app_data = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "APPDATA is not available".to_string())?;
    Ok(StorageLocation {
        mode: StorageModeDto::AppData,
        database_path: app_data
            .join("local.workspace.tabs")
            .join("workspace.sqlite3"),
    })
}

fn acquire_instance_lock(database_path: &Path, owner: &str) -> Result<File, String> {
    let folder = storage_folder_path(database_path)?;
    fs::create_dir_all(&folder).map_err(err)?;
    let lock_path = folder.join("workspace-tabs.instance.lock");
    let lock = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .share_mode(0x0000_0001)
        .open(&lock_path);
    match lock {
        Ok(mut file) => {
            file.set_len(0).map_err(err)?;
            file.seek(SeekFrom::Start(0)).map_err(err)?;
            file.write_all(owner.as_bytes()).map_err(err)?;
            file.flush().map_err(err)?;
            Ok(file)
        }
        Err(_) => {
            let running = read_instance_owner(&lock_path).unwrap_or_else(|| "Unknown".to_string());
            Err(instance_conflict_message(&running, owner))
        }
    }
}

fn read_instance_owner(lock_path: &Path) -> Option<String> {
    let mut file = OpenOptions::new()
        .read(true)
        .share_mode(0x0000_0001 | 0x0000_0002)
        .open(lock_path)
        .ok()?;
    let mut owner = String::new();
    file.read_to_string(&mut owner).ok()?;
    (!owner.trim().is_empty()).then(|| owner.trim().to_string())
}

fn instance_conflict_message(running: &str, requested: &str) -> String {
    if running == "Desktop" || running == "Local Web" {
        format!("WorkspaceTabs {running} is already running.\n\n{requested} will close.")
    } else {
        format!("Another WorkspaceTabs instance is already running.\n\n{requested} will close.")
    }
}

fn storage_folder_path(database_path: &Path) -> Result<PathBuf, String> {
    database_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| format!("storage folder not found for '{}'", database_path.display()))
}

fn random_token() -> String {
    let mut bytes = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn selected_port() -> Result<u16, String> {
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--port" {
            let value = args
                .next()
                .ok_or_else(|| "--port requires a value".to_string())?;
            return value.parse::<u16>().map_err(err);
        }
    }
    Ok(DEFAULT_PORT)
}

fn should_open_browser() -> bool {
    !std::env::args().any(|arg| arg == "--no-browser")
}

fn lock<T>(mutex: &Mutex<T>) -> Result<std::sync::MutexGuard<'_, T>, String> {
    mutex.lock().map_err(err)
}

fn err(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn to_value(value: impl Serialize) -> Result<Value, String> {
    serde_json::to_value(value).map_err(err)
}

fn value_arg<'a>(args: &'a Value, key: &str) -> Result<&'a Value, String> {
    args.get(key)
        .ok_or_else(|| format!("missing argument: {key}"))
}

fn string_arg(args: &Value, key: &str) -> Result<String, String> {
    value_arg(args, key)?
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| format!("argument must be a string: {key}"))
}

fn optional_string_arg(args: &Value, key: &str) -> Option<String> {
    args.get(key).and_then(Value::as_str).map(str::to_string)
}

fn u64_arg(args: &Value, key: &str) -> Result<u64, String> {
    value_arg(args, key)?
        .as_u64()
        .ok_or_else(|| format!("argument must be an unsigned integer: {key}"))
}

fn optional_u64_arg(args: &Value, key: &str) -> Result<Option<u64>, String> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(value) => value
            .as_u64()
            .map(Some)
            .ok_or_else(|| format!("argument must be an unsigned integer or null: {key}")),
    }
}

fn u32_arg(args: &Value, key: &str) -> Result<u32, String> {
    u64_arg(args, key)?
        .try_into()
        .map_err(|_| format!("argument is too large: {key}"))
}

fn optional_u32_arg(args: &Value, key: &str) -> Result<Option<u32>, String> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(value) => value.as_u64().map(|value| Some(value as u32))
            .ok_or_else(|| format!("invalid {key}")),
    }
}

fn usize_arg(args: &Value, key: &str) -> Result<usize, String> {
    u64_arg(args, key)?
        .try_into()
        .map_err(|_| format!("argument is too large: {key}"))
}

fn bool_arg(args: &Value, key: &str) -> Result<bool, String> {
    value_arg(args, key)?
        .as_bool()
        .ok_or_else(|| format!("argument must be a boolean: {key}"))
}

fn u64_vec_arg(args: &Value, key: &str) -> Result<Vec<u64>, String> {
    serde_json::from_value(value_arg(args, key)?.clone()).map_err(err)
}

fn string_vec_arg(args: &Value, key: &str) -> Result<Vec<String>, String> {
    serde_json::from_value(value_arg(args, key)?.clone()).map_err(err)
}

fn link_inputs_arg(args: &Value) -> Result<Vec<(String, String)>, String> {
    value_arg(args, "links")?
        .as_array()
        .ok_or_else(|| "argument must be an array: links".to_string())?
        .iter()
        .map(|link| Ok((string_arg(link, "name")?, string_arg(link, "url")?)))
        .collect()
}

fn validate_http_url(url: &str) -> Result<(), String> {
    let remainder = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .ok_or_else(|| "URL must start with http:// or https://".to_string())?;
    if remainder.is_empty() || remainder.chars().any(char::is_whitespace) {
        return Err("URL must contain a valid host.".to_string());
    }
    Ok(())
}

fn path_to_string(path: &Path) -> String {
    path.display().to_string()
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        record_startup_error(&error);
        std::process::exit(1);
    }
}

fn record_startup_error(error: &str) {
    eprintln!("WorkspaceTabs Local Web failed: {error}");
    rfd::MessageDialog::new()
        .set_title("WorkspaceTabs")
        .set_description(error)
        .set_level(rfd::MessageLevel::Warning)
        .set_buttons(rfd::MessageButtons::Ok)
        .show();
    let Ok(exe_path) = std::env::current_exe() else {
        return;
    };
    let Some(exe_dir) = exe_path.parent() else {
        return;
    };
    if let Ok(mut log) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(exe_dir.join("workspace-tabs-local-web.log"))
    {
        let _ = writeln!(log, "WorkspaceTabs Local Web failed: {error}");
    }
}

async fn wait_for_lifecycle_shutdown(mut receiver: watch::Receiver<bool>) {
    loop {
        if *receiver.borrow() {
            return;
        }
        if receiver.changed().await.is_err() {
            return;
        }
    }
}

async fn run() -> Result<(), String> {
    let port = selected_port()?;
    let exe_path = std::env::current_exe().map_err(err)?;
    let storage = resolve_storage_location(&exe_path)?;
    let instance_lock = acquire_instance_lock(&storage.database_path, "Local Web")?;
    let store = SqliteWorkspaceStore::open(&storage.database_path).map_err(err)?;
    let workspace = store.load_workspace().map_err(err)?;
    let (events, _) = broadcast::channel(64);
    let lifecycle = ClientLifecycle::new();
    let shutdown = lifecycle.subscribe();
    lifecycle.start_startup_timeout();
    let state = WebState(Arc::new(AppState {
        workspace: Mutex::new(workspace),
        store: Mutex::new(store),
        storage_info: StorageInfoDto {
            mode: storage.mode,
            database_path: path_to_string(&storage.database_path),
        },
        token: random_token(),
        port,
        folder_watcher: Mutex::new(None),
        events,
        lifecycle: lifecycle.clone(),
        _instance_lock: instance_lock,
    }));

    let app = Router::new()
        .route("/api/invoke/:command", post(invoke_api))
        .route("/api/events", get(event_stream))
        .route("/api/client-close", post(client_close))
        .route("/api/health", get(health))
        .route("/api/shutdown", post(shutdown_local_web))
        .fallback(get(static_file))
        .with_state(state);
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .map_err(|error| format!("cannot listen on http://{address}: {error}"))?;
    let url = format!("http://127.0.0.1:{port}");
    println!("WorkspaceTabs Local Web: {url}");
    if should_open_browser() {
        open::that(&url).map_err(err)?;
    }
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {}
                _ = wait_for_lifecycle_shutdown(shutdown) => {}
            }
        })
        .await
        .map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn accepts_only_local_hosts_on_the_selected_port() {
        assert!(allowed_host("127.0.0.1:47831", DEFAULT_PORT));
        assert!(allowed_host("localhost:47831", DEFAULT_PORT));
        assert!(!allowed_host("192.168.1.20:47831", DEFAULT_PORT));
        assert!(!allowed_host("127.0.0.1:8000", DEFAULT_PORT));
    }

    #[test]
    fn accepts_only_same_origin_api_requests() {
        assert!(allowed_origin(Some("http://127.0.0.1:47831"), DEFAULT_PORT));
        assert!(allowed_origin(Some("http://localhost:47831"), DEFAULT_PORT));
        assert!(!allowed_origin(Some("https://example.com"), DEFAULT_PORT));
        assert!(!allowed_origin(None, DEFAULT_PORT));
    }

    #[test]
    fn api_token_must_match() {
        assert!(valid_api_token("secret", Some("secret")));
        assert!(!valid_api_token("secret", Some("wrong")));
        assert!(!valid_api_token("secret", None));
    }

    #[test]
    fn local_web_html_has_an_explicit_runtime_marker_and_token() {
        let html = inject_local_web_config("<html><head></head></html>", "secret");

        assert!(html.contains("<meta name=\"workspace-tabs-runtime\" content=\"local-web\" />"));
        assert!(html.contains("<meta name=\"workspace-tabs-token\" content=\"secret\" />"));
    }

    #[tokio::test(start_paused = true)]
    async fn explicit_page_close_shuts_down_after_ten_seconds() {
        let lifecycle = ClientLifecycle::new();
        let shutdown = lifecycle.subscribe();
        lifecycle.connect("tab-a");

        lifecycle.request_close("tab-a");
        tokio::task::yield_now().await;
        tokio::time::advance(std::time::Duration::from_secs(9)).await;
        assert!(!*shutdown.borrow());
        tokio::time::advance(std::time::Duration::from_secs(1)).await;
        tokio::task::yield_now().await;
        assert!(*shutdown.borrow());
    }

    #[tokio::test(start_paused = true)]
    async fn unexpected_disconnect_uses_sixty_second_grace() {
        let lifecycle = ClientLifecycle::new();
        let shutdown = lifecycle.subscribe();
        let generation = lifecycle.connect("tab-a");

        lifecycle.disconnect("tab-a", generation);
        tokio::task::yield_now().await;
        tokio::time::advance(std::time::Duration::from_secs(59)).await;
        assert!(!*shutdown.borrow());
        tokio::time::advance(std::time::Duration::from_secs(1)).await;
        tokio::task::yield_now().await;
        assert!(*shutdown.borrow());
    }

    #[tokio::test(start_paused = true)]
    async fn reconnect_cancels_a_pending_disconnect_shutdown() {
        let lifecycle = ClientLifecycle::new();
        let shutdown = lifecycle.subscribe();
        let generation = lifecycle.connect("tab-a");
        lifecycle.disconnect("tab-a", generation);
        tokio::task::yield_now().await;
        tokio::time::advance(std::time::Duration::from_secs(30)).await;

        lifecycle.connect("tab-a");
        tokio::time::advance(std::time::Duration::from_secs(31)).await;
        tokio::task::yield_now().await;

        assert!(!*shutdown.borrow());
    }

    #[tokio::test(start_paused = true)]
    async fn closing_one_of_multiple_tabs_keeps_the_server_running() {
        let lifecycle = ClientLifecycle::new();
        let shutdown = lifecycle.subscribe();
        lifecycle.connect("tab-a");
        lifecycle.connect("tab-b");

        lifecycle.request_close("tab-a");
        tokio::task::yield_now().await;
        tokio::time::advance(std::time::Duration::from_secs(10)).await;
        tokio::task::yield_now().await;
        assert!(!*shutdown.borrow());

        lifecycle.request_close("tab-b");
        tokio::task::yield_now().await;
        tokio::time::advance(std::time::Duration::from_secs(10)).await;
        tokio::task::yield_now().await;
        assert!(*shutdown.borrow());
    }

    #[test]
    fn explicit_shutdown_signals_immediately() {
        let lifecycle = ClientLifecycle::new();
        let shutdown = lifecycle.subscribe();

        lifecycle.shutdown_now();

        assert!(*shutdown.borrow());
    }

    #[tokio::test]
    async fn explicit_shutdown_closes_an_open_event_stream() {
        let lifecycle = ClientLifecycle::new();
        let mut shutdown = lifecycle.subscribe();
        let (events, _) = broadcast::channel(1);
        let mut receiver = events.subscribe();

        lifecycle.shutdown_now();

        assert_eq!(receive_event(&mut receiver, &mut shutdown).await, None);
    }

    #[test]
    fn instance_lock_reports_the_running_variant() {
        let folder = std::env::temp_dir().join(format!(
            "workspace-tabs-lock-owner-test-{}",
            std::process::id()
        ));
        let database_path = folder.join("workspace.sqlite3");
        let first = acquire_instance_lock(&database_path, "Local Web").unwrap();

        let second = acquire_instance_lock(&database_path, "Desktop");

        assert_eq!(
            second.unwrap_err(),
            "WorkspaceTabs Local Web is already running.\n\nDesktop will close."
        );
        drop(first);
        fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn create_project_command_persists_a_default_tab() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let folder = std::env::temp_dir().join(format!(
            "workspace-tabs-local-web-test-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir_all(&folder).unwrap();
        let database_path = folder.join("workspace.sqlite3");
        let instance_lock = acquire_instance_lock(&database_path, "Local Web").unwrap();
        let store = SqliteWorkspaceStore::open(&database_path).unwrap();
        let workspace = store.load_workspace().unwrap();
        let (events, _) = broadcast::channel(4);
        let state = AppState {
            workspace: Mutex::new(workspace),
            store: Mutex::new(store),
            storage_info: StorageInfoDto {
                mode: StorageModeDto::Portable,
                database_path: path_to_string(&database_path),
            },
            token: "test".to_string(),
            port: DEFAULT_PORT,
            folder_watcher: Mutex::new(None),
            events,
            lifecycle: ClientLifecycle::new(),
            _instance_lock: instance_lock,
        };

        let result = invoke_command(
            &state,
            "create_project",
            json!({ "name": "Local Web", "summary": "Browser mode" }),
        )
        .unwrap();
        let projects = result["projects"].as_array().unwrap();
        let tabs = result["tabs"].as_array().unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0]["name"], "Local Web");
        assert_eq!(tabs.len(), 1);
        assert_eq!(tabs[0]["name"], DEFAULT_TAB_NAME);

        drop(state);
        fs::remove_dir_all(folder).unwrap();
    }
}
