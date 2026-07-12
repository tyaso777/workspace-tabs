use explorer_core::{
    FolderTabState, LinkId, LinksTabState, NoteId, Project, ProjectId, ProjectLink, ProjectNote,
    ProjectTab, RecentFile, TabContent, TabId, TabKind, Workspace, WorkspaceSnapshot,
};
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};

pub struct SqliteWorkspaceStore {
    conn: Connection,
}

impl SqliteWorkspaceStore {
    pub fn open(path: &Path) -> Result<Self, StoreError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        let store = Self { conn };
        store.migrate()?;
        Ok(store)
    }

    #[cfg(test)]
    fn in_memory() -> Result<Self, StoreError> {
        let store = Self {
            conn: Connection::open_in_memory()?,
        };
        store.migrate()?;
        Ok(store)
    }

    pub fn load_workspace(&self) -> Result<Workspace, StoreError> {
        let projects = self.load_projects()?;
        let tabs = self.load_tabs()?;
        let links = self.load_links()?;
        let notes = self.load_notes()?;
        let recent_files = self.load_recent_files()?;
        let active_project_id = self.load_active_project_id()?;

        Ok(Workspace::from_snapshot(WorkspaceSnapshot {
            projects: projects
                .into_iter()
                .map(|mut project| {
                    project.tab_ids = tabs
                        .iter()
                        .filter(|tab| tab.project_id == project.id)
                        .map(|tab| tab.id)
                        .collect();
                    project
                })
                .collect(),
            tabs,
            notes,
            links,
            recent_files,
            active_project_id,
        }))
    }

    pub fn save_workspace(&mut self, workspace: &Workspace) -> Result<(), StoreError> {
        let tx = self.conn.transaction()?;
        let snapshot = workspace.snapshot();

        tx.execute("DELETE FROM recent_files", [])?;
        tx.execute("DELETE FROM tab_checked_links", [])?;
        tx.execute("DELETE FROM project_links", [])?;
        tx.execute("DELETE FROM tab_checked_files", [])?;
        tx.execute("DELETE FROM folder_tabs", [])?;
        tx.execute("DELETE FROM links_tabs", [])?;
        tx.execute("DELETE FROM tabs", [])?;
        tx.execute("DELETE FROM project_notes", [])?;
        tx.execute("DELETE FROM projects", [])?;

        for project in &snapshot.projects {
            tx.execute(
                "INSERT INTO projects (id, name, summary, active_tab_id, active_note_id)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    project.id.value() as i64,
                    project.name,
                    project.summary,
                    project.active_tab_id.map(|id| id.value() as i64),
                    project.active_note_id.map(|id| id.value() as i64)
                ],
            )?;
        }

        for note in &snapshot.notes {
            tx.execute(
                "INSERT INTO project_notes (id, project_id, title, content, position)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    note.id.value() as i64,
                    note.project_id.value() as i64,
                    note.title,
                    note.content,
                    note.position as i64
                ],
            )?;
        }

        for tab in &snapshot.tabs {
            tx.execute(
                "INSERT INTO tabs (id, project_id, name, position, kind)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    tab.id.value() as i64,
                    tab.project_id.value() as i64,
                    tab.name,
                    tab.position as i64,
                    tab_kind_to_string(tab.kind())
                ],
            )?;
            match &tab.content {
                TabContent::Folder(state) => {
                    tx.execute(
                        "INSERT INTO folder_tabs (tab_id, folder_path, selected_path)
                         VALUES (?1, ?2, ?3)",
                        params![
                            tab.id.value() as i64,
                            path_to_string(&state.folder_path),
                            state
                                .selected_path
                                .as_ref()
                                .map(|path| path_to_string(path))
                        ],
                    )?;
                    for (position, path) in state.checked_paths.iter().enumerate() {
                        tx.execute(
                            "INSERT INTO tab_checked_files (tab_id, position, path)
                             VALUES (?1, ?2, ?3)",
                            params![tab.id.value() as i64, position as i64, path_to_string(path)],
                        )?;
                    }
                }
                TabContent::Links(state) => {
                    tx.execute(
                        "INSERT INTO links_tabs (tab_id, selected_link_id) VALUES (?1, ?2)",
                        params![
                            tab.id.value() as i64,
                            state.selected_link_id.map(|id| id.value() as i64)
                        ],
                    )?;
                }
            }
        }

        for link in &snapshot.links {
            tx.execute(
                "INSERT INTO project_links (id, tab_id, name, url, position)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    link.id.value() as i64,
                    link.tab_id.value() as i64,
                    link.name,
                    link.url,
                    link.position as i64
                ],
            )?;
        }

        for tab in &snapshot.tabs {
            let Some(state) = tab.links() else { continue };
            for (position, link_id) in state.checked_link_ids.iter().enumerate() {
                tx.execute(
                    "INSERT INTO tab_checked_links (tab_id, position, link_id)
                     VALUES (?1, ?2, ?3)",
                    params![
                        tab.id.value() as i64,
                        position as i64,
                        link_id.value() as i64
                    ],
                )?;
            }
        }

        for (position, file) in snapshot.recent_files.iter().enumerate() {
            tx.execute(
                "INSERT INTO recent_files (position, project_id, path)
                 VALUES (?1, ?2, ?3)",
                params![
                    position as i64,
                    file.project_id.value() as i64,
                    path_to_string(&file.path)
                ],
            )?;
        }

        tx.execute(
            "INSERT INTO app_state (key, value) VALUES ('active_project_id', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![snapshot.active_project_id.map(|id| id.value().to_string())],
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn load_window_width(&self) -> Result<Option<u32>, StoreError> {
        let value = self.load_app_state_value("window_width")?;
        Ok(value.and_then(|value| value.parse::<u32>().ok()))
    }

    pub fn load_window_height(&self) -> Result<Option<u32>, StoreError> {
        let value = self.load_app_state_value("window_height")?;
        Ok(value.and_then(|value| value.parse::<u32>().ok()))
    }

    pub fn load_project_sort_mode(&self) -> Result<String, StoreError> {
        Ok(self
            .load_app_state_value("project_sort_mode")?
            .filter(|value| value == "created" || value == "name")
            .unwrap_or_else(|| "custom".to_string()))
    }

    pub fn load_project_custom_order(&self) -> Result<Vec<u64>, StoreError> {
        Ok(self
            .load_app_state_value("project_custom_order")?
            .unwrap_or_default()
            .split(',')
            .filter_map(|value| value.parse::<u64>().ok())
            .collect())
    }

    pub fn load_sidebar_collapsed(&self) -> Result<bool, StoreError> {
        Ok(self
            .load_app_state_value("sidebar_collapsed")?
            .map(|value| value == "true")
            .unwrap_or(false))
    }

    pub fn load_notes_custom_height(&self) -> Result<Option<u32>, StoreError> {
        Ok(self
            .load_app_state_value("notes_custom_height")?
            .and_then(|value| value.parse::<u32>().ok()))
    }

    pub fn load_notes_maximized(&self) -> Result<bool, StoreError> {
        Ok(self
            .load_app_state_value("notes_maximized")?
            .map(|value| value == "true")
            .unwrap_or(false))
    }

    pub fn save_window_width(&mut self, width: u32) -> Result<(), StoreError> {
        self.conn.execute(
            "INSERT INTO app_state (key, value) VALUES ('window_width', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![width.to_string()],
        )?;
        Ok(())
    }

    pub fn save_window_height(&mut self, height: u32) -> Result<(), StoreError> {
        self.conn.execute(
            "INSERT INTO app_state (key, value) VALUES ('window_height', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![height.to_string()],
        )?;
        Ok(())
    }

    pub fn save_project_sort_mode(&mut self, mode: &str) -> Result<(), StoreError> {
        let mode = if mode == "created" || mode == "name" {
            mode
        } else {
            "custom"
        };
        self.conn.execute(
            "INSERT INTO app_state (key, value) VALUES ('project_sort_mode', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![mode],
        )?;
        Ok(())
    }

    pub fn save_project_custom_order(&mut self, project_ids: &[u64]) -> Result<(), StoreError> {
        let value = project_ids
            .iter()
            .map(u64::to_string)
            .collect::<Vec<_>>()
            .join(",");
        self.conn.execute(
            "INSERT INTO app_state (key, value) VALUES ('project_custom_order', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![value],
        )?;
        Ok(())
    }

    pub fn save_sidebar_collapsed(&mut self, collapsed: bool) -> Result<(), StoreError> {
        self.conn.execute(
            "INSERT INTO app_state (key, value) VALUES ('sidebar_collapsed', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![collapsed.to_string()],
        )?;
        Ok(())
    }

    pub fn save_notes_custom_height(&mut self, height: Option<u32>) -> Result<(), StoreError> {
        if let Some(height) = height {
            self.conn.execute(
                "INSERT INTO app_state (key, value) VALUES ('notes_custom_height', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![height.to_string()],
            )?;
        } else {
            self.conn.execute("DELETE FROM app_state WHERE key = 'notes_custom_height'", [])?;
        }
        Ok(())
    }

    pub fn save_notes_maximized(&mut self, maximized: bool) -> Result<(), StoreError> {
        self.conn.execute(
            "INSERT INTO app_state (key, value) VALUES ('notes_maximized', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![maximized.to_string()],
        )?;
        Ok(())
    }

    fn migrate(&self) -> Result<(), StoreError> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                summary TEXT NOT NULL DEFAULT '',
                active_tab_id INTEGER,
                active_note_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS project_notes (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                position INTEGER NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS tabs (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                position INTEGER NOT NULL,
                kind TEXT NOT NULL DEFAULT 'folder',
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS folder_tabs (
                tab_id INTEGER PRIMARY KEY,
                folder_path TEXT NOT NULL,
                selected_path TEXT,
                FOREIGN KEY(tab_id) REFERENCES tabs(id)
            );

            CREATE TABLE IF NOT EXISTS links_tabs (
                tab_id INTEGER PRIMARY KEY,
                selected_link_id INTEGER,
                FOREIGN KEY(tab_id) REFERENCES tabs(id)
            );

            CREATE TABLE IF NOT EXISTS recent_files (
                position INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL,
                path TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS tab_checked_files (
                tab_id INTEGER NOT NULL,
                position INTEGER NOT NULL,
                path TEXT NOT NULL,
                PRIMARY KEY (tab_id, position),
                FOREIGN KEY(tab_id) REFERENCES tabs(id)
            );

            CREATE TABLE IF NOT EXISTS project_links (
                id INTEGER PRIMARY KEY,
                tab_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                position INTEGER NOT NULL,
                FOREIGN KEY(tab_id) REFERENCES tabs(id)
            );

            CREATE TABLE IF NOT EXISTS tab_checked_links (
                tab_id INTEGER NOT NULL,
                position INTEGER NOT NULL,
                link_id INTEGER NOT NULL,
                PRIMARY KEY (tab_id, position),
                FOREIGN KEY(tab_id) REFERENCES tabs(id),
                FOREIGN KEY(link_id) REFERENCES project_links(id)
            );

            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            ",
        )?;
        self.normalize_legacy_tabs_table()?;
        self.create_tab_kind_triggers()?;
        self.conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(())
    }

    fn create_tab_kind_triggers(&self) -> Result<(), StoreError> {
        self.conn.execute_batch(
            "
            CREATE TRIGGER IF NOT EXISTS folder_tabs_require_folder_kind
            BEFORE INSERT ON folder_tabs
            WHEN COALESCE((SELECT kind FROM tabs WHERE id = NEW.tab_id), '') <> 'folder'
            BEGIN
                SELECT RAISE(ABORT, 'folder state requires a folder tab');
            END;

            CREATE TRIGGER IF NOT EXISTS links_tabs_require_links_kind
            BEFORE INSERT ON links_tabs
            WHEN COALESCE((SELECT kind FROM tabs WHERE id = NEW.tab_id), '') <> 'links'
            BEGIN
                SELECT RAISE(ABORT, 'links state requires a links tab');
            END;
            ",
        )?;
        Ok(())
    }

    fn normalize_legacy_tabs_table(&self) -> Result<(), StoreError> {
        let columns = self.table_columns("tabs")?;
        if !columns.iter().any(|name| name == "folder_path") {
            return Ok(());
        }
        if !columns.iter().any(|name| name == "kind") {
            self.conn.execute(
                "ALTER TABLE tabs ADD COLUMN kind TEXT NOT NULL DEFAULT 'folder'",
                [],
            )?;
        }
        if !columns.iter().any(|name| name == "selected_link_id") {
            self.conn
                .execute("ALTER TABLE tabs ADD COLUMN selected_link_id INTEGER", [])?;
        }
        self.conn.execute_batch(
            "
            PRAGMA foreign_keys = OFF;
            INSERT OR IGNORE INTO folder_tabs (tab_id, folder_path, selected_path)
                SELECT id, folder_path, selected_path FROM tabs WHERE kind <> 'links';
            INSERT OR IGNORE INTO links_tabs (tab_id, selected_link_id)
                SELECT id, selected_link_id FROM tabs WHERE kind = 'links';
            CREATE TABLE tabs_normalized (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                position INTEGER NOT NULL,
                kind TEXT NOT NULL DEFAULT 'folder',
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );
            INSERT INTO tabs_normalized (id, project_id, name, position, kind)
                SELECT id, project_id, name, position, kind FROM tabs;
            DROP TABLE tabs;
            ALTER TABLE tabs_normalized RENAME TO tabs;
            PRAGMA foreign_keys = ON;
            ",
        )?;
        Ok(())
    }

    fn table_columns(&self, table: &str) -> Result<Vec<String>, StoreError> {
        let mut statement = self.conn.prepare(&format!("PRAGMA table_info({table})"))?;
        let columns = statement
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(columns)
    }

    fn load_projects(&self) -> Result<Vec<Project>, StoreError> {
        let mut statement = self.conn.prepare(
            "SELECT id, name, summary, active_tab_id, active_note_id FROM projects ORDER BY id ASC",
        )?;
        let rows = statement.query_map([], |row| {
            let active_tab_id = row
                .get::<_, Option<i64>>(3)?
                .map(|id| TabId::from_value(id as u64));
            let active_note_id = row
                .get::<_, Option<i64>>(4)?
                .map(|id| NoteId::from_value(id as u64));
            Ok(Project {
                id: ProjectId::from_value(row.get::<_, i64>(0)? as u64),
                name: row.get(1)?,
                summary: row.get(2)?,
                tab_ids: Vec::new(),
                active_tab_id,
                active_note_id,
            })
        })?;
        collect_rows(rows)
    }

    fn load_notes(&self) -> Result<Vec<ProjectNote>, StoreError> {
        let mut statement = self.conn.prepare(
            "SELECT id, project_id, title, content, position
             FROM project_notes ORDER BY project_id ASC, position ASC, id ASC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(ProjectNote {
                id: NoteId::from_value(row.get::<_, i64>(0)? as u64),
                project_id: ProjectId::from_value(row.get::<_, i64>(1)? as u64),
                title: row.get(2)?,
                content: row.get(3)?,
                position: row.get::<_, i64>(4)? as usize,
            })
        })?;
        collect_rows(rows)
    }

    fn load_tabs(&self) -> Result<Vec<ProjectTab>, StoreError> {
        let checked_paths = self.load_checked_paths_by_tab()?;
        let checked_link_ids = self.load_checked_link_ids_by_tab()?;
        let folder_states = self.load_folder_states(checked_paths)?;
        let links_states = self.load_links_states(checked_link_ids)?;
        let mut statement = self.conn.prepare(
            "SELECT id, project_id, name, position, kind
             FROM tabs ORDER BY project_id ASC, position ASC, id ASC",
        )?;
        let rows = statement.query_map([], |row| {
            let id = TabId::from_value(row.get::<_, i64>(0)? as u64);
            Ok(ProjectTab {
                id,
                project_id: ProjectId::from_value(row.get::<_, i64>(1)? as u64),
                name: row.get(2)?,
                content: match tab_kind_from_string(&row.get::<_, String>(4)?) {
                    TabKind::Folder => TabContent::Folder(
                        folder_states.get(&id).cloned().unwrap_or(FolderTabState {
                            folder_path: PathBuf::new(),
                            selected_path: None,
                            checked_paths: Vec::new(),
                        }),
                    ),
                    TabKind::Links => {
                        TabContent::Links(links_states.get(&id).cloned().unwrap_or(LinksTabState {
                            selected_link_id: None,
                            checked_link_ids: Vec::new(),
                        }))
                    }
                },
                position: row.get::<_, i64>(3)? as usize,
            })
        })?;
        collect_rows(rows)
    }

    fn load_folder_states(
        &self,
        checked_paths: std::collections::HashMap<TabId, Vec<PathBuf>>,
    ) -> Result<std::collections::HashMap<TabId, FolderTabState>, StoreError> {
        let mut statement = self.conn.prepare(
            "SELECT tab_id, folder_path, selected_path FROM folder_tabs ORDER BY tab_id",
        )?;
        let rows = statement.query_map([], |row| {
            let tab_id = TabId::from_value(row.get::<_, i64>(0)? as u64);
            Ok((
                tab_id,
                FolderTabState {
                    folder_path: PathBuf::from(row.get::<_, String>(1)?),
                    selected_path: row.get::<_, Option<String>>(2)?.map(PathBuf::from),
                    checked_paths: checked_paths.get(&tab_id).cloned().unwrap_or_default(),
                },
            ))
        })?;
        Ok(collect_rows(rows)?.into_iter().collect())
    }

    fn load_links_states(
        &self,
        checked_link_ids: std::collections::HashMap<TabId, Vec<LinkId>>,
    ) -> Result<std::collections::HashMap<TabId, LinksTabState>, StoreError> {
        let mut statement = self
            .conn
            .prepare("SELECT tab_id, selected_link_id FROM links_tabs ORDER BY tab_id")?;
        let rows = statement.query_map([], |row| {
            let tab_id = TabId::from_value(row.get::<_, i64>(0)? as u64);
            Ok((
                tab_id,
                LinksTabState {
                    selected_link_id: row
                        .get::<_, Option<i64>>(1)?
                        .map(|id| LinkId::from_value(id as u64)),
                    checked_link_ids: checked_link_ids.get(&tab_id).cloned().unwrap_or_default(),
                },
            ))
        })?;
        Ok(collect_rows(rows)?.into_iter().collect())
    }

    fn load_checked_paths_by_tab(
        &self,
    ) -> Result<std::collections::HashMap<TabId, Vec<PathBuf>>, StoreError> {
        let mut statement = self.conn.prepare(
            "SELECT tab_id, path FROM tab_checked_files ORDER BY tab_id ASC, position ASC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                TabId::from_value(row.get::<_, i64>(0)? as u64),
                PathBuf::from(row.get::<_, String>(1)?),
            ))
        })?;

        let mut checked_paths = std::collections::HashMap::new();
        for row in rows {
            let (tab_id, path) = row?;
            checked_paths
                .entry(tab_id)
                .or_insert_with(Vec::new)
                .push(path);
        }
        Ok(checked_paths)
    }

    fn load_checked_link_ids_by_tab(
        &self,
    ) -> Result<std::collections::HashMap<TabId, Vec<LinkId>>, StoreError> {
        let mut statement = self.conn.prepare(
            "SELECT tab_id, link_id FROM tab_checked_links ORDER BY tab_id ASC, position ASC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                TabId::from_value(row.get::<_, i64>(0)? as u64),
                LinkId::from_value(row.get::<_, i64>(1)? as u64),
            ))
        })?;
        let mut checked = std::collections::HashMap::new();
        for row in rows {
            let (tab_id, link_id) = row?;
            checked.entry(tab_id).or_insert_with(Vec::new).push(link_id);
        }
        Ok(checked)
    }

    fn load_links(&self) -> Result<Vec<ProjectLink>, StoreError> {
        let mut statement = self.conn.prepare(
            "SELECT id, tab_id, name, url, position
             FROM project_links ORDER BY tab_id ASC, position ASC, id ASC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(ProjectLink {
                id: LinkId::from_value(row.get::<_, i64>(0)? as u64),
                tab_id: TabId::from_value(row.get::<_, i64>(1)? as u64),
                name: row.get(2)?,
                url: row.get(3)?,
                position: row.get::<_, i64>(4)? as usize,
            })
        })?;
        collect_rows(rows)
    }

    fn load_recent_files(&self) -> Result<Vec<RecentFile>, StoreError> {
        let mut statement = self
            .conn
            .prepare("SELECT project_id, path FROM recent_files ORDER BY position ASC")?;
        let rows = statement.query_map([], |row| {
            Ok(RecentFile {
                project_id: ProjectId::from_value(row.get::<_, i64>(0)? as u64),
                path: PathBuf::from(row.get::<_, String>(1)?),
            })
        })?;
        collect_rows(rows)
    }

    fn load_active_project_id(&self) -> Result<Option<ProjectId>, StoreError> {
        let value = self.load_app_state_value("active_project_id")?;
        Ok(value
            .and_then(|value| value.parse::<u64>().ok())
            .map(ProjectId::from_value))
    }

    fn load_app_state_value(&self, key: &str) -> Result<Option<String>, StoreError> {
        Ok(self
            .conn
            .query_row(
                "SELECT value FROM app_state WHERE key = ?1",
                params![key],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?
            .flatten())
    }
}

#[derive(Debug)]
pub enum StoreError {
    Sqlite(rusqlite::Error),
    Io(std::io::Error),
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreError::Sqlite(error) => write!(f, "sqlite error: {}", error),
            StoreError::Io(error) => write!(f, "io error: {}", error),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<rusqlite::Error> for StoreError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Sqlite(value)
    }
}

impl From<std::io::Error> for StoreError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

fn collect_rows<T>(
    rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>,
) -> Result<Vec<T>, StoreError> {
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(StoreError::from)
}

fn path_to_string(path: &Path) -> String {
    path.display().to_string()
}

fn tab_kind_to_string(kind: TabKind) -> &'static str {
    match kind {
        TabKind::Folder => "folder",
        TabKind::Links => "links",
    }
}

fn tab_kind_from_string(value: &str) -> TabKind {
    if value == "links" {
        TabKind::Links
    } else {
        TabKind::Folder
    }
}

trait OptionalRow<T> {
    fn optional(self) -> rusqlite::Result<Option<T>>;
}

impl<T> OptionalRow<T> for rusqlite::Result<T> {
    fn optional(self) -> rusqlite::Result<Option<T>> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_tab_round_trips_with_selected_and_checked_links() {
        let mut store = SqliteWorkspaceStore::in_memory().unwrap();
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("Research", "").unwrap();
        let tab_id = workspace.add_links_tab(project_id, "References").unwrap();
        let link_ids = workspace
            .add_links(
                project_id,
                tab_id,
                vec![
                    ("Rust".to_string(), "https://www.rust-lang.org/".to_string()),
                    ("Docs".to_string(), "https://docs.rs/".to_string()),
                ],
            )
            .unwrap();
        workspace
            .select_link(project_id, tab_id, Some(link_ids[1]))
            .unwrap();
        workspace
            .update_checked_links(project_id, tab_id, link_ids.clone())
            .unwrap();

        store.save_workspace(&workspace).unwrap();
        let loaded = store.load_workspace().unwrap();

        let tab = loaded.tabs_for_project(project_id).unwrap()[0];
        assert_eq!(tab.kind(), TabKind::Links);
        assert_eq!(tab.links().unwrap().selected_link_id, Some(link_ids[1]));
        assert_eq!(tab.links().unwrap().checked_link_ids, link_ids);
        assert_eq!(loaded.links_for_tab(project_id, tab_id).unwrap().len(), 2);
    }

    #[test]
    fn migration_keeps_existing_folder_tabs_and_normalizes_tab_state() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY, name TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
                active_tab_id INTEGER, active_note_id INTEGER
            );
            CREATE TABLE tabs (
                id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, name TEXT NOT NULL,
                folder_path TEXT NOT NULL, selected_path TEXT, position INTEGER NOT NULL
            );
            INSERT INTO projects VALUES (1, 'Existing', '', 1, NULL);
            INSERT INTO tabs VALUES (1, 1, 'Docs', 'C:\\docs', NULL, 0);
            ",
        )
        .unwrap();
        let store = SqliteWorkspaceStore { conn };

        store.migrate().unwrap();
        let loaded = store.load_workspace().unwrap();

        let tab = loaded.tabs_for_project(ProjectId::from_value(1)).unwrap()[0];
        assert_eq!(tab.name, "Docs");
        assert_eq!(tab.kind(), TabKind::Folder);
        assert_eq!(tab.folder().unwrap().folder_path, PathBuf::from(r"C:\docs"));
        let tab_columns = store.table_columns("tabs").unwrap();
        assert!(!tab_columns.contains(&"folder_path".to_string()));
        assert!(!tab_columns.contains(&"selected_link_id".to_string()));
    }

    #[test]
    fn empty_database_loads_empty_workspace() {
        let store = SqliteWorkspaceStore::in_memory().unwrap();

        let workspace = store.load_workspace().unwrap();

        assert!(workspace.projects().is_empty());
        assert!(workspace.restore_last_session().is_none());
    }

    #[test]
    fn saved_workspace_can_be_loaded_with_session_state() {
        let mut store = SqliteWorkspaceStore::in_memory().unwrap();
        let mut workspace = Workspace::new();
        let project_a = workspace.create_project("Client A", "contracts").unwrap();
        let project_b = workspace.create_project("Blog", "articles").unwrap();
        workspace
            .update_project(project_b, "Blog", "articles")
            .unwrap();
        let note_id = workspace
            .add_note(project_b, "Next article", "write the Tauri article")
            .unwrap();
        let docs_tab = workspace
            .add_tab(project_a, "Docs", r"C:\work\a\docs")
            .unwrap();
        let src_tab = workspace
            .add_tab(project_b, "Src", r"C:\work\b\src")
            .unwrap();

        workspace.activate_tab(project_b, src_tab).unwrap();
        workspace
            .select_path(project_b, src_tab, r"C:\work\b\src\main.rs")
            .unwrap();
        workspace
            .select_path(project_a, docs_tab, r"C:\work\a\docs\memo.md")
            .unwrap();
        workspace
            .update_checked_paths(
                project_a,
                docs_tab,
                vec![
                    PathBuf::from(r"C:\work\a\docs\a.md"),
                    PathBuf::from(r"C:\work\a\docs\b.md"),
                ],
            )
            .unwrap();
        workspace
            .record_opened_file(project_b, r"C:\work\b\src\main.rs")
            .unwrap();
        workspace
            .record_opened_file(project_a, r"C:\work\a\docs\memo.md")
            .unwrap();

        store.save_workspace(&workspace).unwrap();
        let loaded = store.load_workspace().unwrap();

        let session = loaded.restore_last_session().unwrap();
        assert_eq!(session.project.id, project_b);
        assert_eq!(session.project.summary, "articles");
        assert_eq!(session.project.active_note_id, Some(note_id));
        let notes = loaded.notes_for_project(project_b).unwrap();
        assert_eq!(notes[0].title, "Next article");
        assert_eq!(notes[0].content, "write the Tauri article");
        assert_eq!(session.active_tab.unwrap().id, src_tab);
        assert_eq!(
            session.selected_path,
            Some(PathBuf::from(r"C:\work\b\src\main.rs"))
        );
        let docs_tab = loaded
            .tabs_for_project(project_a)
            .unwrap()
            .into_iter()
            .find(|tab| tab.id == docs_tab)
            .unwrap();
        assert_eq!(
            docs_tab.folder().unwrap().checked_paths,
            vec![
                PathBuf::from(r"C:\work\a\docs\a.md"),
                PathBuf::from(r"C:\work\a\docs\b.md")
            ]
        );
        assert_eq!(
            loaded
                .recent_files()
                .map(|file| file.path.clone())
                .collect::<Vec<_>>(),
            vec![
                PathBuf::from(r"C:\work\a\docs\memo.md"),
                PathBuf::from(r"C:\work\b\src\main.rs")
            ]
        );
    }

    #[test]
    fn saving_again_replaces_previous_workspace() {
        let mut store = SqliteWorkspaceStore::in_memory().unwrap();
        let mut workspace = Workspace::new();
        workspace.create_project("Old", "old registration").unwrap();
        store.save_workspace(&workspace).unwrap();

        let mut replacement = Workspace::new();
        replacement
            .create_project("New", "new registration")
            .unwrap();
        store.save_workspace(&replacement).unwrap();

        let loaded = store.load_workspace().unwrap();
        assert_eq!(loaded.projects().len(), 1);
        assert_eq!(loaded.projects()[0].name, "New");
    }

    #[test]
    fn new_project_with_default_tab_round_trips_through_current_schema() {
        let mut store = SqliteWorkspaceStore::in_memory().unwrap();
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("New Project", "").unwrap();
        let tab_id = workspace
            .add_tab(project_id, "New Tab", PathBuf::new())
            .unwrap();

        store.save_workspace(&workspace).unwrap();
        let loaded = store.load_workspace().unwrap();

        let session = loaded.restore_last_session().unwrap();
        assert_eq!(session.project.id, project_id);
        assert_eq!(session.project.active_tab_id, Some(tab_id));
        assert_eq!(session.active_tab.unwrap().name, "New Tab");
    }

    #[test]
    fn current_schema_foreign_keys_reference_current_tables() {
        let store = SqliteWorkspaceStore::in_memory().unwrap();

        let tab_parent: String = store
            .conn
            .query_row("PRAGMA foreign_key_list(tabs)", [], |row| row.get(2))
            .unwrap();
        let recent_parent: String = store
            .conn
            .query_row("PRAGMA foreign_key_list(recent_files)", [], |row| {
                row.get(2)
            })
            .unwrap();
        let checked_parent: String = store
            .conn
            .query_row("PRAGMA foreign_key_list(tab_checked_files)", [], |row| {
                row.get(2)
            })
            .unwrap();
        let note_parent: String = store
            .conn
            .query_row("PRAGMA foreign_key_list(project_notes)", [], |row| {
                row.get(2)
            })
            .unwrap();
        let folder_parent: String = store
            .conn
            .query_row("PRAGMA foreign_key_list(folder_tabs)", [], |row| row.get(2))
            .unwrap();
        let links_parent: String = store
            .conn
            .query_row("PRAGMA foreign_key_list(links_tabs)", [], |row| row.get(2))
            .unwrap();

        assert_eq!(tab_parent, "projects");
        assert_eq!(recent_parent, "projects");
        assert_eq!(checked_parent, "tabs");
        assert_eq!(note_parent, "projects");
        assert_eq!(folder_parent, "tabs");
        assert_eq!(links_parent, "tabs");
        assert_eq!(
            store.table_columns("tabs").unwrap(),
            vec!["id", "project_id", "name", "position", "kind"]
        );
    }

    #[test]
    fn database_rejects_state_for_the_wrong_tab_kind() {
        let store = SqliteWorkspaceStore::in_memory().unwrap();
        let foreign_keys: i64 = store
            .conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        assert_eq!(foreign_keys, 1);
        store
            .conn
            .execute(
                "INSERT INTO projects (id, name, summary) VALUES (1, 'Project', '')",
                [],
            )
            .unwrap();
        store
            .conn
            .execute(
                "INSERT INTO tabs (id, project_id, name, position, kind)
                 VALUES (1, 1, 'Links', 0, 'links')",
                [],
            )
            .unwrap();

        let result = store.conn.execute(
            "INSERT INTO folder_tabs (tab_id, folder_path) VALUES (1, 'C:\\wrong')",
            [],
        );

        assert!(result.is_err());
    }

    #[test]
    fn window_size_is_saved_and_preserved_when_workspace_changes() {
        let mut store = SqliteWorkspaceStore::in_memory().unwrap();
        let mut workspace = Workspace::new();
        workspace.create_project("Client A", "contracts").unwrap();

        store.save_window_width(1234).unwrap();
        store.save_window_height(777).unwrap();
        store.save_project_sort_mode("name").unwrap();
        store.save_sidebar_collapsed(true).unwrap();
        store.save_notes_custom_height(Some(284)).unwrap();
        store.save_notes_maximized(true).unwrap();
        store.save_workspace(&workspace).unwrap();

        assert_eq!(store.load_window_width().unwrap(), Some(1234));
        assert_eq!(store.load_window_height().unwrap(), Some(777));
        assert_eq!(store.load_project_sort_mode().unwrap(), "name");
        assert!(store.load_sidebar_collapsed().unwrap());
        assert_eq!(store.load_notes_custom_height().unwrap(), Some(284));
        assert!(store.load_notes_maximized().unwrap());
    }

    #[test]
    fn project_sort_mode_defaults_to_custom_and_rejects_unknown_values() {
        let mut store = SqliteWorkspaceStore::in_memory().unwrap();

        assert_eq!(store.load_project_sort_mode().unwrap(), "custom");

        store.save_project_sort_mode("recent").unwrap();

        assert_eq!(store.load_project_sort_mode().unwrap(), "custom");
    }

    #[test]
    fn project_custom_order_round_trips() {
        let mut store = SqliteWorkspaceStore::in_memory().unwrap();

        store.save_project_custom_order(&[4, 2, 9]).unwrap();

        assert_eq!(store.load_project_custom_order().unwrap(), vec![4, 2, 9]);
    }

    #[test]
    fn sidebar_collapsed_defaults_to_false_and_can_be_saved() {
        let mut store = SqliteWorkspaceStore::in_memory().unwrap();

        assert!(!store.load_sidebar_collapsed().unwrap());

        store.save_sidebar_collapsed(true).unwrap();
        assert!(store.load_sidebar_collapsed().unwrap());

        store.save_sidebar_collapsed(false).unwrap();
        assert!(!store.load_sidebar_collapsed().unwrap());
    }

    #[test]
    fn notes_panel_state_defaults_and_round_trips() {
        let mut store = SqliteWorkspaceStore::in_memory().unwrap();

        assert_eq!(store.load_notes_custom_height().unwrap(), None);
        assert!(!store.load_notes_maximized().unwrap());
        store.save_notes_custom_height(Some(315)).unwrap();
        store.save_notes_maximized(true).unwrap();
        assert_eq!(store.load_notes_custom_height().unwrap(), Some(315));
        assert!(store.load_notes_maximized().unwrap());
        store.save_notes_custom_height(None).unwrap();
        store.save_notes_maximized(false).unwrap();
        assert_eq!(store.load_notes_custom_height().unwrap(), None);
        assert!(!store.load_notes_maximized().unwrap());
    }

    #[test]
    fn disk_database_restores_workspace_and_all_ui_preferences_after_reopen() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "workspace-tabs-reopen-{}-{unique}",
            std::process::id()
        ));
        let database_path = directory.join("workspace.sqlite3");

        let (project_id, tab_id) = {
            let mut store = SqliteWorkspaceStore::open(&database_path).unwrap();
            let mut workspace = Workspace::new();
            let project_id = workspace.create_project("Persistent", "restart test").unwrap();
            let tab_id = workspace.add_tab(project_id, "Docs", r"C:\work\docs").unwrap();
            workspace.activate_tab(project_id, tab_id).unwrap();
            workspace
                .select_path(project_id, tab_id, r"C:\work\docs\selected.txt")
                .unwrap();
            workspace
                .update_checked_paths(
                    project_id,
                    tab_id,
                    vec![PathBuf::from(r"C:\work\docs\checked.txt")],
                )
                .unwrap();

            store.save_workspace(&workspace).unwrap();
            store.save_window_width(1280).unwrap();
            store.save_window_height(760).unwrap();
            store.save_project_sort_mode("custom").unwrap();
            store.save_project_custom_order(&[project_id.value()]).unwrap();
            store.save_sidebar_collapsed(true).unwrap();
            store.save_notes_custom_height(Some(325)).unwrap();
            store.save_notes_maximized(false).unwrap();
            (project_id, tab_id)
        };

        {
            let reopened = SqliteWorkspaceStore::open(&database_path).unwrap();
            let workspace = reopened.load_workspace().unwrap();
            let session = workspace.restore_last_session().unwrap();
            assert_eq!(session.project.id, project_id);
            assert_eq!(session.active_tab.unwrap().id, tab_id);
            assert_eq!(
                session.selected_path,
                Some(PathBuf::from(r"C:\work\docs\selected.txt"))
            );
            let tab = workspace.tabs_for_project(project_id).unwrap()[0];
            assert_eq!(
                tab.folder().unwrap().checked_paths,
                vec![PathBuf::from(r"C:\work\docs\checked.txt")]
            );
            assert_eq!(reopened.load_window_width().unwrap(), Some(1280));
            assert_eq!(reopened.load_window_height().unwrap(), Some(760));
            assert_eq!(reopened.load_project_sort_mode().unwrap(), "custom");
            assert_eq!(
                reopened.load_project_custom_order().unwrap(),
                vec![project_id.value()]
            );
            assert!(reopened.load_sidebar_collapsed().unwrap());
            assert_eq!(reopened.load_notes_custom_height().unwrap(), Some(325));
            assert!(!reopened.load_notes_maximized().unwrap());
        }

        std::fs::remove_dir_all(directory).unwrap();
    }

    #[derive(Clone, Copy)]
    enum DeleteScenario {
        Project,
        Tab,
        Note,
        Link,
    }

    fn assert_delete_undo_is_persisted_after_reopen(scenario: DeleteScenario, label: &str) {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "workspace-tabs-delete-undo-{label}-{}-{unique}",
            std::process::id()
        ));
        let database_path = directory.join("workspace.sqlite3");

        let mut store = SqliteWorkspaceStore::open(&database_path).unwrap();
        let mut workspace = Workspace::new();
        let primary_project = workspace.create_project("Primary", "main project").unwrap();
        let secondary_project = workspace
            .create_project("Secondary", "deleted project")
            .unwrap();
        let folder_tab = workspace
            .add_tab(primary_project, "Files", r"C:\work\files")
            .unwrap();
        let links_tab = workspace
            .add_links_tab(primary_project, "References")
            .unwrap();
        let note_id = workspace
            .add_note(primary_project, "Plan", "Keep this content")
            .unwrap();
        let link_id = workspace
            .add_links(
                primary_project,
                links_tab,
                vec![("Rust".to_string(), "https://www.rust-lang.org/".to_string())],
            )
            .unwrap()[0];
        workspace
            .add_tab(secondary_project, "Archive", r"C:\work\archive")
            .unwrap();
        let expected = workspace.snapshot();

        let expected_undo_kind = match scenario {
            DeleteScenario::Project => {
                workspace.delete_project(secondary_project).unwrap();
                explorer_core::UndoKind::DeleteProject
            }
            DeleteScenario::Tab => {
                workspace.delete_tab(primary_project, folder_tab).unwrap();
                explorer_core::UndoKind::DeleteTab
            }
            DeleteScenario::Note => {
                workspace.delete_note(primary_project, note_id).unwrap();
                explorer_core::UndoKind::DeleteNote
            }
            DeleteScenario::Link => {
                workspace
                    .delete_links(primary_project, links_tab, &[link_id])
                    .unwrap();
                explorer_core::UndoKind::DeleteLink
            }
        };
        assert_eq!(workspace.undo_kind(), Some(expected_undo_kind));
        store.save_workspace(&workspace).unwrap();

        let deleted_state = SqliteWorkspaceStore::open(&database_path)
            .unwrap()
            .load_workspace()
            .unwrap();
        assert_ne!(deleted_state.snapshot(), expected);
        assert!(!deleted_state.can_undo());

        assert!(workspace.undo_last());
        assert_eq!(workspace.snapshot(), expected);
        store.save_workspace(&workspace).unwrap();
        drop(store);

        let restored = SqliteWorkspaceStore::open(&database_path)
            .unwrap()
            .load_workspace()
            .unwrap();
        assert_eq!(restored.snapshot(), expected);
        assert!(!restored.can_undo());

        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn project_delete_and_undo_are_persisted_after_database_reopen() {
        assert_delete_undo_is_persisted_after_reopen(DeleteScenario::Project, "project");
    }

    #[test]
    fn tab_delete_and_undo_are_persisted_after_database_reopen() {
        assert_delete_undo_is_persisted_after_reopen(DeleteScenario::Tab, "tab");
    }

    #[test]
    fn note_delete_and_undo_are_persisted_after_database_reopen() {
        assert_delete_undo_is_persisted_after_reopen(DeleteScenario::Note, "note");
    }

    #[test]
    fn link_delete_and_undo_are_persisted_after_database_reopen() {
        assert_delete_undo_is_persisted_after_reopen(DeleteScenario::Link, "link");
    }
}
