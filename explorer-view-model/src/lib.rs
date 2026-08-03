use explorer_core::{
    Project, ProjectFolder, ProjectLink, ProjectNote, ProjectTab, RestoredSession, TabContent,
    UndoKind, Workspace,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ProjectDto {
    pub id: u64,
    pub name: String,
    pub summary: String,
    pub active_tab_id: Option<u64>,
    pub active_note_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NoteDto {
    pub id: u64,
    pub project_id: u64,
    pub title: String,
    pub content: String,
    pub position: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct TabDto {
    pub id: u64,
    pub project_id: u64,
    pub name: String,
    pub position: usize,
    #[serde(flatten)]
    pub content: TabContentDto,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum TabContentDto {
    Folder {
        folder_path: String,
        selected_path: Option<String>,
        checked_paths: Vec<String>,
    },
    Links {
        selected_link_id: Option<u64>,
        checked_link_ids: Vec<u64>,
    },
    Folders {
        selected_folder_id: Option<u64>,
        checked_folder_ids: Vec<u64>,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct LinkDto {
    pub id: u64,
    pub tab_id: u64,
    pub name: String,
    pub url: String,
    pub position: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct FolderDto {
    pub id: u64,
    pub tab_id: u64,
    pub name: String,
    pub path: String,
    pub position: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecentItemDto {
    pub project_id: u64,
    pub tab_id: u64,
    pub kind: String,
    pub target: String,
    pub label: String,
    pub link_id: Option<u64>,
    pub folder_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionDto {
    pub project: ProjectDto,
    pub active_tab: Option<TabDto>,
    pub selected_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceDto {
    pub projects: Vec<ProjectDto>,
    pub tabs: Vec<TabDto>,
    pub notes: Vec<NoteDto>,
    pub links: Vec<LinkDto>,
    pub folders: Vec<FolderDto>,
    pub recent_items: Vec<RecentItemDto>,
    pub restored_session: Option<SessionDto>,
    pub can_undo: bool,
    pub undo_kind: Option<String>,
}

pub fn workspace_to_dto(workspace: &Workspace) -> WorkspaceDto {
    let projects = workspace.projects().iter().map(project_to_dto).collect();
    let tabs = workspace
        .projects()
        .iter()
        .flat_map(|project| workspace.tabs_for_project(project.id).unwrap_or_default())
        .map(tab_to_dto)
        .collect();
    let notes = workspace
        .projects()
        .iter()
        .flat_map(|project| workspace.notes_for_project(project.id).unwrap_or_default())
        .map(note_to_dto)
        .collect();
    let links = workspace
        .projects()
        .iter()
        .flat_map(|project| workspace.tabs_for_project(project.id).unwrap_or_default())
        .flat_map(|tab| {
            workspace
                .links_for_tab(tab.project_id, tab.id)
                .unwrap_or_default()
                .into_iter()
                .map(link_to_dto)
        })
        .collect();
    let folders = workspace
        .projects()
        .iter()
        .flat_map(|project| workspace.tabs_for_project(project.id).unwrap_or_default())
        .flat_map(|tab| {
            workspace
                .folders_for_tab(tab.project_id, tab.id)
                .unwrap_or_default()
                .into_iter()
                .map(folder_to_dto)
        })
        .collect();
    let recent_items = workspace
        .recent_items()
        .map(|item| RecentItemDto {
            project_id: item.project_id.value(),
            tab_id: item.tab_id.value(),
            kind: match item.kind {
                explorer_core::RecentItemKind::File => "file",
                explorer_core::RecentItemKind::Folder => "folder",
                explorer_core::RecentItemKind::Link => "link",
            }
            .to_string(),
            target: item.target.clone(),
            label: item.label.clone(),
            link_id: item.link_id.map(|id| id.value()),
            folder_id: item.folder_id.map(|id| id.value()),
        })
        .collect();
    WorkspaceDto {
        projects,
        tabs,
        notes,
        links,
        folders,
        recent_items,
        restored_session: workspace.restore_last_session().map(session_to_dto),
        can_undo: workspace.can_undo(),
        undo_kind: workspace.undo_kind().map(undo_kind_to_string),
    }
}

fn undo_kind_to_string(kind: UndoKind) -> String {
    match kind {
        UndoKind::DeleteProject => "delete_project".to_string(),
        UndoKind::DeleteTab => "delete_tab".to_string(),
        UndoKind::DeleteNote => "delete_note".to_string(),
        UndoKind::DeleteLink => "delete_link".to_string(),
        UndoKind::DeleteFolder => "delete_folder".to_string(),
    }
}

fn session_to_dto(session: RestoredSession) -> SessionDto {
    SessionDto {
        project: project_to_dto(&session.project),
        active_tab: session.active_tab.as_ref().map(tab_to_dto),
        selected_path: session
            .selected_path
            .as_ref()
            .map(|path| path_to_string(path)),
    }
}

fn project_to_dto(project: &Project) -> ProjectDto {
    ProjectDto {
        id: project.id.value(),
        name: project.name.clone(),
        summary: project.summary.clone(),
        active_tab_id: project.active_tab_id.map(|id| id.value()),
        active_note_id: project.active_note_id.map(|id| id.value()),
    }
}

fn note_to_dto(note: &ProjectNote) -> NoteDto {
    NoteDto {
        id: note.id.value(),
        project_id: note.project_id.value(),
        title: note.title.clone(),
        content: note.content.clone(),
        position: note.position,
    }
}

fn tab_to_dto(tab: &ProjectTab) -> TabDto {
    TabDto {
        id: tab.id.value(),
        project_id: tab.project_id.value(),
        name: tab.name.clone(),
        position: tab.position,
        content: match &tab.content {
            TabContent::Folder(state) => TabContentDto::Folder {
                folder_path: path_to_string(&state.folder_path),
                selected_path: state
                    .selected_path
                    .as_ref()
                    .map(|path| path_to_string(path)),
                checked_paths: state
                    .checked_paths
                    .iter()
                    .map(|path| path_to_string(path))
                    .collect(),
            },
            TabContent::Links(state) => TabContentDto::Links {
                selected_link_id: state.selected_link_id.map(|id| id.value()),
                checked_link_ids: state.checked_link_ids.iter().map(|id| id.value()).collect(),
            },
            TabContent::Folders(state) => TabContentDto::Folders {
                selected_folder_id: state.selected_folder_id.map(|id| id.value()),
                checked_folder_ids: state
                    .checked_folder_ids
                    .iter()
                    .map(|id| id.value())
                    .collect(),
            },
        },
    }
}

fn folder_to_dto(folder: &ProjectFolder) -> FolderDto {
    FolderDto {
        id: folder.id.value(),
        tab_id: folder.tab_id.value(),
        name: folder.name.clone(),
        path: path_to_string(&folder.path),
        position: folder.position,
    }
}

fn link_to_dto(link: &ProjectLink) -> LinkDto {
    LinkDto {
        id: link.id.value(),
        tab_id: link.tab_id.value(),
        name: link.name.clone(),
        url: link.url.clone(),
        position: link.position,
    }
}

fn path_to_string(path: &std::path::Path) -> String {
    path.display().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tab_json_contains_only_fields_for_its_kind() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("Project", "").unwrap();
        let folder_id = workspace.add_tab(project_id, "Folder", r"C:\docs").unwrap();
        let links_id = workspace.add_links_tab(project_id, "Links").unwrap();
        let folders_id = workspace.add_folders_tab(project_id, "Folders").unwrap();
        let value = serde_json::to_value(workspace_to_dto(&workspace)).unwrap();
        let tabs = value["tabs"].as_array().unwrap();
        let folder = tabs
            .iter()
            .find(|tab| tab["id"] == folder_id.value())
            .unwrap();
        let links = tabs
            .iter()
            .find(|tab| tab["id"] == links_id.value())
            .unwrap();
        let folders = tabs
            .iter()
            .find(|tab| tab["id"] == folders_id.value())
            .unwrap();
        assert_eq!(folder["kind"], "folder");
        assert!(folder.get("folder_path").is_some());
        assert!(folder.get("selected_link_id").is_none());
        assert_eq!(links["kind"], "links");
        assert!(links.get("selected_link_id").is_some());
        assert!(links.get("folder_path").is_none());
        assert_eq!(folders["kind"], "folders");
        assert!(folders.get("selected_folder_id").is_some());
        assert!(folders.get("folder_path").is_none());
    }
}
