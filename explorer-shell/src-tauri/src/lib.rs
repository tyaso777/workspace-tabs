mod preview;
mod store;

use explorer_core::{LinkId, NoteId, ProjectId, TabId, Workspace};
use explorer_view_model::{workspace_to_dto, WorkspaceDto};
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use preview::{preview_file as read_preview_file, PreviewDto};
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
#[cfg(target_os = "windows")]
use std::os::windows::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use store::SqliteWorkspaceStore;
use tauri::{Emitter, LogicalSize, Manager, State, WindowEvent};

const DEFAULT_TAB_NAME: &str = "New Tab";

struct AppState {
    workspace: Mutex<Workspace>,
    store: Mutex<SqliteWorkspaceStore>,
    storage_info: StorageInfoDto,
    folder_watcher: Mutex<Option<FolderWatcher>>,
    _instance_lock: File,
}

struct FolderWatcher {
    folder_path: PathBuf,
    _watcher: RecommendedWatcher,
}

#[derive(Debug, Deserialize)]
struct LinkInput {
    name: String,
    url: String,
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Clone, Serialize)]
struct FolderChangedDto {
    folder_path: String,
}

#[tauri::command]
fn workspace_snapshot(state: State<'_, AppState>) -> Result<WorkspaceDto, String> {
    let workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn storage_info(state: State<'_, AppState>) -> StorageInfoDto {
    state.storage_info.clone()
}

#[tauri::command]
fn load_window_width(state: State<'_, AppState>) -> Result<Option<u32>, String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .load_window_width()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_window_height(state: State<'_, AppState>) -> Result<Option<u32>, String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .load_window_height()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_window_width(state: State<'_, AppState>, width: u32) -> Result<(), String> {
    let width = width.clamp(640, 3840);
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .save_window_width(width)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_window_height(state: State<'_, AppState>, height: u32) -> Result<(), String> {
    let height = height.clamp(560, 2160);
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .save_window_height(height)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_project_sort_mode(state: State<'_, AppState>) -> Result<String, String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .load_project_sort_mode()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_project_sort_mode(state: State<'_, AppState>, mode: String) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .save_project_sort_mode(&mode)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_project_custom_order(state: State<'_, AppState>) -> Result<Vec<u64>, String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .load_project_custom_order()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_project_custom_order(
    state: State<'_, AppState>,
    project_ids: Vec<u64>,
) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .save_project_custom_order(&project_ids)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_sidebar_collapsed(state: State<'_, AppState>) -> Result<bool, String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .load_sidebar_collapsed()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_sidebar_collapsed(state: State<'_, AppState>, collapsed: bool) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .save_sidebar_collapsed(collapsed)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_notes_expanded(state: State<'_, AppState>) -> Result<bool, String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .load_notes_expanded()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_notes_expanded(state: State<'_, AppState>, expanded: bool) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .save_notes_expanded(expanded)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn watch_folder(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    folder_path: String,
) -> Result<(), String> {
    let next_folder = PathBuf::from(folder_path);
    let mut watcher_slot = state
        .folder_watcher
        .lock()
        .map_err(|error| error.to_string())?;

    if !next_folder.is_dir() {
        *watcher_slot = None;
        return Ok(());
    }

    if watcher_slot
        .as_ref()
        .is_some_and(|watcher| same_path(&watcher.folder_path, &next_folder))
    {
        return Ok(());
    }

    let event_folder = next_folder.clone();
    let mut watcher = RecommendedWatcher::new(
        move |event: Result<notify::Event, notify::Error>| {
            if event.is_ok() {
                let _ = app.emit(
                    "folder-changed",
                    FolderChangedDto {
                        folder_path: path_to_string(&event_folder),
                    },
                );
            }
        },
        Config::default(),
    )
    .map_err(|error| error.to_string())?;
    watcher
        .watch(&next_folder, RecursiveMode::NonRecursive)
        .map_err(|error| error.to_string())?;

    *watcher_slot = Some(FolderWatcher {
        folder_path: next_folder,
        _watcher: watcher,
    });
    Ok(())
}

#[tauri::command]
fn create_project(
    state: State<'_, AppState>,
    name: String,
    summary: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    create_project_with_default_tab(&mut workspace, name, summary)?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

fn create_project_with_default_tab(
    workspace: &mut Workspace,
    name: String,
    summary: String,
) -> Result<ProjectId, String> {
    let project_id = workspace
        .create_project(name, summary)
        .map_err(|error| error.to_string())?;
    workspace
        .add_tab(project_id, DEFAULT_TAB_NAME, PathBuf::new())
        .map_err(|error| error.to_string())?;
    Ok(project_id)
}

#[tauri::command]
fn update_project(
    state: State<'_, AppState>,
    project_id: u64,
    name: String,
    summary: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .update_project(ProjectId::from_value(project_id), name, summary)
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn add_note(
    state: State<'_, AppState>,
    project_id: u64,
    title: String,
    content: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    let note_id = workspace
        .add_note(ProjectId::from_value(project_id), title, content)
        .map_err(|error| error.to_string())?;
    workspace
        .activate_note(ProjectId::from_value(project_id), note_id)
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn update_note(
    state: State<'_, AppState>,
    project_id: u64,
    note_id: u64,
    title: String,
    content: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .update_note(
            ProjectId::from_value(project_id),
            NoteId::from_value(note_id),
            title,
            content,
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn activate_note(
    state: State<'_, AppState>,
    project_id: u64,
    note_id: u64,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .activate_note(
            ProjectId::from_value(project_id),
            NoteId::from_value(note_id),
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn delete_note(
    state: State<'_, AppState>,
    project_id: u64,
    note_id: u64,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .delete_note(
            ProjectId::from_value(project_id),
            NoteId::from_value(note_id),
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn delete_notes(
    state: State<'_, AppState>,
    project_id: u64,
    note_ids: Vec<u64>,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    let note_ids = note_ids
        .into_iter()
        .map(NoteId::from_value)
        .collect::<Vec<_>>();
    workspace
        .delete_notes(ProjectId::from_value(project_id), &note_ids)
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn delete_project(state: State<'_, AppState>, project_id: u64) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .delete_project(ProjectId::from_value(project_id))
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn delete_projects(
    state: State<'_, AppState>,
    project_ids: Vec<u64>,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    let project_ids = project_ids
        .into_iter()
        .map(ProjectId::from_value)
        .collect::<Vec<_>>();
    workspace
        .delete_projects(&project_ids)
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn add_tab(
    state: State<'_, AppState>,
    project_id: u64,
    name: String,
    folder_path: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    let project_id = ProjectId::from_value(project_id);
    workspace
        .add_tab(project_id, name, PathBuf::from(folder_path))
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn add_links_tab(
    state: State<'_, AppState>,
    project_id: u64,
    name: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .add_links_tab(ProjectId::from_value(project_id), name)
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn update_tab_name(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    name: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .update_tab_name(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            name,
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn add_links(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    links: Vec<LinkInput>,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .add_links(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            links
                .into_iter()
                .map(|link| (link.name, link.url))
                .collect(),
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn update_link(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    link_id: u64,
    name: String,
    url: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .update_link(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            LinkId::from_value(link_id),
            name,
            url,
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn select_link(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    link_id: Option<u64>,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .select_link(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            link_id.map(LinkId::from_value),
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn update_checked_links(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    link_ids: Vec<u64>,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .update_checked_links(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            link_ids.into_iter().map(LinkId::from_value).collect(),
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn delete_links(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    link_ids: Vec<u64>,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    let link_ids = link_ids
        .into_iter()
        .map(LinkId::from_value)
        .collect::<Vec<_>>();
    workspace
        .delete_links(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            &link_ids,
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn move_link(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    link_id: u64,
    target_index: usize,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .move_link(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            LinkId::from_value(link_id),
            target_index,
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn update_tab(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    name: String,
    folder_path: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .update_tab(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            name,
            PathBuf::from(folder_path),
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn delete_tab(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .delete_tab(ProjectId::from_value(project_id), TabId::from_value(tab_id))
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn delete_tabs(
    state: State<'_, AppState>,
    project_id: u64,
    tab_ids: Vec<u64>,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    let tab_ids = tab_ids
        .into_iter()
        .map(TabId::from_value)
        .collect::<Vec<_>>();
    workspace
        .delete_tabs(ProjectId::from_value(project_id), &tab_ids)
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn undo_last(state: State<'_, AppState>) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    if !workspace.undo_last() {
        return Err("nothing to undo".to_string());
    }
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn move_tab(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    target_index: usize,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .move_tab(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            target_index,
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn move_tabs(
    state: State<'_, AppState>,
    project_id: u64,
    tab_ids: Vec<u64>,
    target_index: usize,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    let tab_ids = tab_ids
        .into_iter()
        .map(TabId::from_value)
        .collect::<Vec<_>>();
    workspace
        .move_tabs(ProjectId::from_value(project_id), &tab_ids, target_index)
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn activate_tab(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .activate_tab(ProjectId::from_value(project_id), TabId::from_value(tab_id))
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn select_path(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    path: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .select_path(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            PathBuf::from(path),
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn clear_selected_path(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .clear_selected_path(ProjectId::from_value(project_id), TabId::from_value(tab_id))
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn update_checked_paths(
    state: State<'_, AppState>,
    project_id: u64,
    tab_id: u64,
    paths: Vec<String>,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .update_checked_paths(
            ProjectId::from_value(project_id),
            TabId::from_value(tab_id),
            paths.into_iter().map(PathBuf::from).collect(),
        )
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn record_opened_file(
    state: State<'_, AppState>,
    project_id: u64,
    path: String,
) -> Result<WorkspaceDto, String> {
    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .record_opened_file(ProjectId::from_value(project_id), PathBuf::from(path))
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn list_folder(folder_path: String) -> Result<Vec<FileEntryDto>, String> {
    let mut entries = fs::read_dir(&folder_path)
        .map_err(|error| format!("failed to read folder '{}': {}", folder_path, error))?
        .map(|entry| {
            let entry = entry.map_err(|error| error.to_string())?;
            let file_type = entry.file_type().map_err(|error| error.to_string())?;
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

#[tauri::command]
fn open_file(
    state: State<'_, AppState>,
    project_id: u64,
    path: String,
) -> Result<WorkspaceDto, String> {
    let path_buf = PathBuf::from(&path);
    open_path(&path_buf)?;

    let mut workspace = state.workspace.lock().map_err(|error| error.to_string())?;
    workspace
        .record_opened_file(ProjectId::from_value(project_id), path_buf)
        .map_err(|error| error.to_string())?;
    save_workspace(&state, &workspace)?;
    Ok(workspace_to_dto(&workspace))
}

#[tauri::command]
fn open_folder(folder_path: String) -> Result<(), String> {
    let path = PathBuf::from(folder_path);
    if !path.is_dir() {
        return Err(format!("not a folder: '{}'", path.display()));
    }
    open_path(&path)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    validate_http_url(&url)?;
    Command::new("rundll32")
        .arg("url.dll,FileProtocolHandler")
        .arg(url)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_storage_folder(state: State<'_, AppState>) -> Result<(), String> {
    let folder = storage_folder_path(&PathBuf::from(&state.storage_info.database_path))?;
    open_path(&folder)
}

#[tauri::command]
fn preview_file(path: String) -> PreviewDto {
    read_preview_file(&PathBuf::from(path))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let exe_path = std::env::current_exe()?;
            let storage_location = resolve_storage_location(&exe_path, &app_data_dir);
            let db_path = storage_location.database_path;
            let instance_lock = match acquire_instance_lock(&db_path, "Desktop") {
                Ok(lock) => lock,
                Err(message) => {
                    show_startup_message(&message);
                    return Err(std::io::Error::other(message).into());
                }
            };
            let store = SqliteWorkspaceStore::open(&db_path)?;
            let saved_window_width = store.load_window_width()?;
            let saved_window_height = store.load_window_height()?;
            let workspace = store.load_workspace()?;
            app.manage(AppState {
                workspace: Mutex::new(workspace),
                store: Mutex::new(store),
                storage_info: StorageInfoDto {
                    mode: storage_location.mode,
                    database_path: path_to_string(&db_path),
                },
                folder_watcher: Mutex::new(None),
                _instance_lock: instance_lock,
            });
            if let Some(window) = app.get_webview_window("main") {
                if saved_window_width.is_some() || saved_window_height.is_some() {
                    apply_window_size(&window, saved_window_width, saved_window_height);
                }
                let window_for_event = window.clone();
                window.on_window_event(move |event| {
                    if matches!(
                        event,
                        WindowEvent::Resized(_) | WindowEvent::CloseRequested { .. }
                    ) {
                        save_window_size_from_window(&window_for_event);
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            workspace_snapshot,
            storage_info,
            create_project,
            update_project,
            delete_project,
            delete_projects,
            add_note,
            update_note,
            activate_note,
            delete_note,
            delete_notes,
            add_tab,
            add_links_tab,
            update_tab_name,
            add_links,
            update_link,
            select_link,
            update_checked_links,
            delete_links,
            move_link,
            update_tab,
            delete_tab,
            delete_tabs,
            undo_last,
            move_tab,
            move_tabs,
            activate_tab,
            select_path,
            clear_selected_path,
            update_checked_paths,
            record_opened_file,
            list_folder,
            open_file,
            open_folder,
            open_url,
            preview_file,
            load_window_width,
            load_window_height,
            save_window_width,
            save_window_height,
            load_project_sort_mode,
            save_project_sort_mode,
            load_project_custom_order,
            save_project_custom_order,
            load_sidebar_collapsed,
            save_sidebar_collapsed,
            load_notes_expanded,
            save_notes_expanded,
            open_storage_folder,
            watch_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

struct StorageLocation {
    mode: StorageModeDto,
    database_path: PathBuf,
}

fn resolve_storage_location(exe_path: &Path, app_data_dir: &Path) -> StorageLocation {
    let exe_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    let portable_dir = exe_dir.join("data");
    if portable_dir.is_dir() {
        StorageLocation {
            mode: StorageModeDto::Portable,
            database_path: portable_dir.join("workspace.sqlite3"),
        }
    } else {
        StorageLocation {
            mode: StorageModeDto::AppData,
            database_path: app_data_dir.join("workspace.sqlite3"),
        }
    }
}

fn storage_folder_path(database_path: &Path) -> Result<PathBuf, String> {
    database_path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| format!("storage folder not found for '{}'", database_path.display()))
}

fn acquire_instance_lock(database_path: &Path, owner: &str) -> Result<File, String> {
    let folder = storage_folder_path(database_path)?;
    fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
    let lock_path = folder.join("workspace-tabs.instance.lock");
    let mut options = OpenOptions::new();
    options.read(true).write(true).create(true);
    #[cfg(target_os = "windows")]
    options.share_mode(0x0000_0001);
    match options.open(&lock_path) {
        Ok(mut file) => {
            file.set_len(0).map_err(|error| error.to_string())?;
            file.seek(SeekFrom::Start(0))
                .map_err(|error| error.to_string())?;
            file.write_all(owner.as_bytes())
                .map_err(|error| error.to_string())?;
            file.flush().map_err(|error| error.to_string())?;
            Ok(file)
        }
        Err(_) => {
            let running = read_instance_owner(&lock_path).unwrap_or_else(|| "Unknown".to_string());
            Err(instance_conflict_message(&running, owner))
        }
    }
}

fn read_instance_owner(lock_path: &Path) -> Option<String> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(target_os = "windows")]
    options.share_mode(0x0000_0001 | 0x0000_0002);
    let mut file = options.open(lock_path).ok()?;
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

fn show_startup_message(message: &str) {
    rfd::MessageDialog::new()
        .set_title("WorkspaceTabs")
        .set_description(message)
        .set_level(rfd::MessageLevel::Warning)
        .set_buttons(rfd::MessageButtons::Ok)
        .show();
}

fn path_to_string(path: &std::path::Path) -> String {
    path.display().to_string()
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

fn same_path(left: &Path, right: &Path) -> bool {
    left == right
}

fn save_workspace(state: &State<'_, AppState>, workspace: &Workspace) -> Result<(), String> {
    state
        .store
        .lock()
        .map_err(|error| error.to_string())?
        .save_workspace(workspace)
        .map_err(|error| error.to_string())
}

fn apply_window_size(window: &tauri::WebviewWindow, width: Option<u32>, height: Option<u32>) {
    let Ok(size) = window.inner_size() else {
        return;
    };
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let current_width = (size.width as f64) / scale_factor;
    let current_height = (size.height as f64) / scale_factor;
    let width = width
        .map(|value| value.clamp(640, 3840) as f64)
        .unwrap_or(current_width);
    let height = height
        .map(|value| value.clamp(560, 2160) as f64)
        .unwrap_or(current_height);
    let _ = window.set_size(LogicalSize::new(width, height));
}

fn save_window_size_from_window(window: &tauri::WebviewWindow) {
    let Ok(size) = window.inner_size() else {
        return;
    };
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let width = ((size.width as f64) / scale_factor).round() as u32;
    let width = width.clamp(640, 3840);
    let height = ((size.height as f64) / scale_factor).round() as u32;
    let height = height.clamp(560, 2160);
    let state = window.state::<AppState>();
    let store_lock = state.store.lock();
    if let Ok(mut store) = store_lock {
        let _ = store.save_window_width(width);
        let _ = store.save_window_height(height);
    }
}

fn open_path(path: &std::path::Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let status = Command::new("rundll32.exe")
        .arg("url.dll,FileProtocolHandler")
        .arg(path)
        .status()
        .map_err(|error| format!("failed to open '{}': {}", path.display(), error))?;

    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .arg(path)
        .status()
        .map_err(|error| format!("failed to open '{}': {}", path.display(), error))?;

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open")
        .arg(path)
        .status()
        .map_err(|error| format!("failed to open '{}': {}", path.display(), error))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("open command failed for '{}'", path.display()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_portable_database_when_data_folder_exists_next_to_exe() {
        let base_dir = std::env::temp_dir().join(format!(
            "workspace-tabs-portable-test-{}",
            std::process::id()
        ));
        let exe_dir = base_dir.join("app");
        let data_dir = exe_dir.join("data");
        std::fs::create_dir_all(&data_dir).unwrap();

        let location = resolve_storage_location(
            &exe_dir.join("workspace-tabs.exe"),
            &base_dir.join("appdata"),
        );

        assert_eq!(location.mode, StorageModeDto::Portable);
        assert_eq!(location.database_path, data_dir.join("workspace.sqlite3"));

        std::fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn uses_app_data_database_when_portable_data_folder_is_absent() {
        let base_dir = std::env::temp_dir().join(format!(
            "workspace-tabs-appdata-test-{}",
            std::process::id()
        ));
        let exe_dir = base_dir.join("app");
        let app_data_dir = base_dir.join("appdata");
        std::fs::create_dir_all(&exe_dir).unwrap();

        let location = resolve_storage_location(&exe_dir.join("workspace-tabs.exe"), &app_data_dir);

        assert_eq!(location.mode, StorageModeDto::AppData);
        assert_eq!(
            location.database_path,
            app_data_dir.join("workspace.sqlite3")
        );

        std::fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn storage_folder_path_uses_database_parent_folder() {
        let database_path = PathBuf::from(r"C:\PortableWorkspace\data\workspace.sqlite3");

        assert_eq!(
            storage_folder_path(&database_path).unwrap(),
            PathBuf::from(r"C:\PortableWorkspace\data")
        );
    }

    #[test]
    fn rejects_a_second_instance_for_the_same_data_folder() {
        let base_dir = std::env::temp_dir().join(format!(
            "workspace-tabs-instance-lock-test-{}",
            std::process::id()
        ));
        let database_path = base_dir.join("workspace.sqlite3");
        let first = acquire_instance_lock(&database_path, "Desktop").unwrap();

        let second = acquire_instance_lock(&database_path, "Local Web");

        assert_eq!(
            second.unwrap_err(),
            "WorkspaceTabs Desktop is already running.\n\nLocal Web will close."
        );
        drop(first);
        std::fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn create_project_command_adds_a_default_active_tab() {
        let mut workspace = Workspace::new();

        let project_id =
            create_project_with_default_tab(&mut workspace, "Client A".into(), "Docs".into())
                .unwrap();

        let snapshot = workspace.snapshot();
        let project = snapshot
            .projects
            .iter()
            .find(|project| project.id == project_id)
            .unwrap();
        assert_eq!(project.tab_ids.len(), 1);
        let tab = workspace.tabs_for_project(project_id).unwrap().remove(0);
        assert_eq!(tab.name, DEFAULT_TAB_NAME);
        assert_eq!(tab.folder().unwrap().folder_path, PathBuf::new());
        assert_eq!(project.active_tab_id, Some(tab.id));
    }
}
