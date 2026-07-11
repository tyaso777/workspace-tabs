use std::collections::VecDeque;
use std::fmt;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ProjectId(u64);

impl ProjectId {
    pub fn from_value(value: u64) -> Self {
        Self(value)
    }

    pub fn value(self) -> u64 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TabId(u64);

impl TabId {
    pub fn from_value(value: u64) -> Self {
        Self(value)
    }

    pub fn value(self) -> u64 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct NoteId(u64);

impl NoteId {
    pub fn from_value(value: u64) -> Self {
        Self(value)
    }

    pub fn value(self) -> u64 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LinkId(u64);

impl LinkId {
    pub fn from_value(value: u64) -> Self {
        Self(value)
    }

    pub fn value(self) -> u64 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TabKind {
    Folder,
    Links,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Project {
    pub id: ProjectId,
    pub name: String,
    pub summary: String,
    pub tab_ids: Vec<TabId>,
    pub active_tab_id: Option<TabId>,
    pub active_note_id: Option<NoteId>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectNote {
    pub id: NoteId,
    pub project_id: ProjectId,
    pub title: String,
    pub content: String,
    pub position: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectTab {
    pub id: TabId,
    pub project_id: ProjectId,
    pub name: String,
    pub content: TabContent,
    pub position: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TabContent {
    Folder(FolderTabState),
    Links(LinksTabState),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderTabState {
    pub folder_path: PathBuf,
    pub selected_path: Option<PathBuf>,
    pub checked_paths: Vec<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinksTabState {
    pub selected_link_id: Option<LinkId>,
    pub checked_link_ids: Vec<LinkId>,
}

impl ProjectTab {
    pub fn kind(&self) -> TabKind {
        match self.content {
            TabContent::Folder(_) => TabKind::Folder,
            TabContent::Links(_) => TabKind::Links,
        }
    }

    pub fn folder(&self) -> Option<&FolderTabState> {
        match &self.content {
            TabContent::Folder(state) => Some(state),
            TabContent::Links(_) => None,
        }
    }

    pub fn links(&self) -> Option<&LinksTabState> {
        match &self.content {
            TabContent::Folder(_) => None,
            TabContent::Links(state) => Some(state),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectLink {
    pub id: LinkId,
    pub tab_id: TabId,
    pub name: String,
    pub url: String,
    pub position: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecentFile {
    pub project_id: ProjectId,
    pub path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RestoredSession {
    pub project: Project,
    pub active_tab: Option<ProjectTab>,
    pub selected_path: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceSnapshot {
    pub projects: Vec<Project>,
    pub tabs: Vec<ProjectTab>,
    pub notes: Vec<ProjectNote>,
    pub links: Vec<ProjectLink>,
    pub recent_files: Vec<RecentFile>,
    pub active_project_id: Option<ProjectId>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UndoKind {
    DeleteProject,
    DeleteTab,
    DeleteNote,
    DeleteLink,
}

#[derive(Debug, Clone)]
struct UndoEntry {
    snapshot: WorkspaceSnapshot,
    kind: UndoKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExplorerError {
    EmptyProjectName,
    EmptyTabName,
    EmptyNoteTitle,
    InvalidLinkUrl,
    ProjectNotFound(ProjectId),
    TabNotFound(TabId),
    NoteNotFound(NoteId),
    LinkNotFound(LinkId),
    WrongTabKind {
        tab_id: TabId,
        expected: TabKind,
    },
    TabDoesNotBelongToProject {
        project_id: ProjectId,
        tab_id: TabId,
    },
    NoteDoesNotBelongToProject {
        project_id: ProjectId,
        note_id: NoteId,
    },
}

impl fmt::Display for ExplorerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ExplorerError::EmptyProjectName => write!(f, "project name must not be empty"),
            ExplorerError::EmptyTabName => write!(f, "tab name must not be empty"),
            ExplorerError::EmptyNoteTitle => write!(f, "note title must not be empty"),
            ExplorerError::InvalidLinkUrl => write!(f, "URL must start with http:// or https://"),
            ExplorerError::ProjectNotFound(id) => {
                write!(f, "project not found: {}", id.value())
            }
            ExplorerError::TabNotFound(id) => write!(f, "tab not found: {}", id.value()),
            ExplorerError::NoteNotFound(id) => write!(f, "note not found: {}", id.value()),
            ExplorerError::LinkNotFound(id) => write!(f, "link not found: {}", id.value()),
            ExplorerError::WrongTabKind { tab_id, expected } => {
                write!(f, "tab {} is not a {:?} tab", tab_id.value(), expected)
            }
            ExplorerError::TabDoesNotBelongToProject { project_id, tab_id } => write!(
                f,
                "tab {} does not belong to project {}",
                tab_id.value(),
                project_id.value()
            ),
            ExplorerError::NoteDoesNotBelongToProject {
                project_id,
                note_id,
            } => write!(
                f,
                "note {} does not belong to project {}",
                note_id.value(),
                project_id.value()
            ),
        }
    }
}

impl std::error::Error for ExplorerError {}

#[derive(Debug, Clone)]
pub struct Workspace {
    projects: Vec<Project>,
    tabs: Vec<ProjectTab>,
    notes: Vec<ProjectNote>,
    links: Vec<ProjectLink>,
    recent_files: VecDeque<RecentFile>,
    undo_entries: Vec<UndoEntry>,
    next_project_id: u64,
    next_tab_id: u64,
    next_note_id: u64,
    next_link_id: u64,
    active_project_id: Option<ProjectId>,
    recent_file_limit: usize,
}

impl Default for Workspace {
    fn default() -> Self {
        Self::new()
    }
}

impl Workspace {
    pub fn new() -> Self {
        Self {
            projects: Vec::new(),
            tabs: Vec::new(),
            notes: Vec::new(),
            links: Vec::new(),
            recent_files: VecDeque::new(),
            undo_entries: Vec::new(),
            next_project_id: 1,
            next_tab_id: 1,
            next_note_id: 1,
            next_link_id: 1,
            active_project_id: None,
            recent_file_limit: 30,
        }
    }

    pub fn from_snapshot(snapshot: WorkspaceSnapshot) -> Self {
        let next_project_id = snapshot
            .projects
            .iter()
            .map(|project| project.id.value())
            .max()
            .unwrap_or(0)
            + 1;
        let next_tab_id = snapshot
            .tabs
            .iter()
            .map(|tab| tab.id.value())
            .max()
            .unwrap_or(0)
            + 1;
        let next_note_id = snapshot
            .notes
            .iter()
            .map(|note| note.id.value())
            .max()
            .unwrap_or(0)
            + 1;
        let next_link_id = snapshot
            .links
            .iter()
            .map(|link| link.id.value())
            .max()
            .unwrap_or(0)
            + 1;
        let recent_file_limit = 30;
        let mut recent_files = VecDeque::from(snapshot.recent_files);
        recent_files.truncate(recent_file_limit);

        Self {
            projects: snapshot.projects,
            tabs: snapshot.tabs,
            notes: snapshot.notes,
            links: snapshot.links,
            recent_files,
            undo_entries: Vec::new(),
            next_project_id,
            next_tab_id,
            next_note_id,
            next_link_id,
            active_project_id: snapshot.active_project_id,
            recent_file_limit,
        }
    }

    pub fn snapshot(&self) -> WorkspaceSnapshot {
        WorkspaceSnapshot {
            projects: self.projects.clone(),
            tabs: self.tabs.clone(),
            notes: self.notes.clone(),
            links: self.links.clone(),
            recent_files: self.recent_files.iter().cloned().collect(),
            active_project_id: self.active_project_id,
        }
    }

    pub fn create_project(
        &mut self,
        name: impl Into<String>,
        summary: impl Into<String>,
    ) -> Result<ProjectId, ExplorerError> {
        let name = trim_required(name.into()).ok_or(ExplorerError::EmptyProjectName)?;
        let id = ProjectId(self.next_project_id);
        self.next_project_id += 1;

        self.projects.push(Project {
            id,
            name,
            summary: summary.into().trim().to_string(),
            tab_ids: Vec::new(),
            active_tab_id: None,
            active_note_id: None,
        });

        if self.active_project_id.is_none() {
            self.active_project_id = Some(id);
        }

        self.clear_undo_history();
        Ok(id)
    }

    pub fn update_project(
        &mut self,
        project_id: ProjectId,
        name: impl Into<String>,
        summary: impl Into<String>,
    ) -> Result<(), ExplorerError> {
        let name = trim_required(name.into()).ok_or(ExplorerError::EmptyProjectName)?;
        let project = self.project_mut(project_id)?;
        project.name = name;
        project.summary = summary.into().trim().to_string();
        self.clear_undo_history();
        Ok(())
    }

    pub fn add_note(
        &mut self,
        project_id: ProjectId,
        title: impl Into<String>,
        content: impl Into<String>,
    ) -> Result<NoteId, ExplorerError> {
        let title = trim_required(title.into()).ok_or(ExplorerError::EmptyNoteTitle)?;
        self.project(project_id)?;
        let position = self
            .notes
            .iter()
            .filter(|note| note.project_id == project_id)
            .count();
        let id = NoteId(self.next_note_id);
        self.next_note_id += 1;
        self.notes.push(ProjectNote {
            id,
            project_id,
            title,
            content: content.into().trim().to_string(),
            position,
        });
        let project = self.project_mut(project_id)?;
        if project.active_note_id.is_none() {
            project.active_note_id = Some(id);
        }
        self.clear_undo_history();
        Ok(id)
    }

    pub fn update_note(
        &mut self,
        project_id: ProjectId,
        note_id: NoteId,
        title: impl Into<String>,
        content: impl Into<String>,
    ) -> Result<(), ExplorerError> {
        let title = trim_required(title.into()).ok_or(ExplorerError::EmptyNoteTitle)?;
        self.ensure_note_belongs_to_project(project_id, note_id)?;
        let note = self.note_mut(note_id)?;
        note.title = title;
        note.content = content.into().trim().to_string();
        self.clear_undo_history();
        Ok(())
    }

    pub fn activate_note(
        &mut self,
        project_id: ProjectId,
        note_id: NoteId,
    ) -> Result<(), ExplorerError> {
        self.ensure_note_belongs_to_project(project_id, note_id)?;
        self.project_mut(project_id)?.active_note_id = Some(note_id);
        self.clear_undo_history();
        Ok(())
    }

    pub fn delete_note(
        &mut self,
        project_id: ProjectId,
        note_id: NoteId,
    ) -> Result<(), ExplorerError> {
        self.delete_notes(project_id, &[note_id])
    }

    pub fn delete_notes(
        &mut self,
        project_id: ProjectId,
        note_ids: &[NoteId],
    ) -> Result<(), ExplorerError> {
        if note_ids.is_empty() {
            return Ok(());
        }
        for note_id in note_ids {
            self.ensure_note_belongs_to_project(project_id, *note_id)?;
        }
        self.push_undo_snapshot(UndoKind::DeleteNote);
        self.notes.retain(|note| !note_ids.contains(&note.id));

        let remaining_notes = self
            .notes
            .iter_mut()
            .filter(|note| note.project_id == project_id)
            .collect::<Vec<_>>();
        for (position, note) in remaining_notes.into_iter().enumerate() {
            note.position = position;
        }
        let replacement = self
            .notes
            .iter()
            .filter(|note| note.project_id == project_id)
            .min_by_key(|note| note.position)
            .map(|note| note.id);
        let project = self.project_mut(project_id)?;
        if project
            .active_note_id
            .is_some_and(|active_note_id| note_ids.contains(&active_note_id))
        {
            project.active_note_id = replacement;
        }
        Ok(())
    }

    pub fn delete_project(&mut self, project_id: ProjectId) -> Result<(), ExplorerError> {
        self.delete_projects(&[project_id])
    }

    pub fn delete_projects(&mut self, project_ids: &[ProjectId]) -> Result<(), ExplorerError> {
        if project_ids.is_empty() {
            return Ok(());
        }
        for project_id in project_ids {
            self.project(*project_id)?;
        }
        self.push_undo_snapshot(UndoKind::DeleteProject);
        let deleted_tab_ids = self
            .tabs
            .iter()
            .filter(|tab| project_ids.contains(&tab.project_id))
            .map(|tab| tab.id)
            .collect::<Vec<_>>();
        self.projects
            .retain(|project| !project_ids.contains(&project.id));
        self.tabs
            .retain(|tab| !project_ids.contains(&tab.project_id));
        self.notes
            .retain(|note| !project_ids.contains(&note.project_id));
        self.links
            .retain(|link| !deleted_tab_ids.contains(&link.tab_id));
        self.recent_files
            .retain(|file| !project_ids.contains(&file.project_id));

        if self
            .active_project_id
            .is_some_and(|active_project_id| project_ids.contains(&active_project_id))
        {
            self.active_project_id = self.projects.first().map(|project| project.id);
        }

        Ok(())
    }

    pub fn add_tab(
        &mut self,
        project_id: ProjectId,
        name: impl Into<String>,
        folder_path: impl Into<PathBuf>,
    ) -> Result<TabId, ExplorerError> {
        let name = trim_required(name.into()).ok_or(ExplorerError::EmptyTabName)?;
        let position = {
            let project = self.project_mut(project_id)?;
            project.tab_ids.len()
        };
        let id = TabId(self.next_tab_id);
        self.next_tab_id += 1;

        self.tabs.push(ProjectTab {
            id,
            project_id,
            name,
            content: TabContent::Folder(FolderTabState {
                folder_path: folder_path.into(),
                selected_path: None,
                checked_paths: Vec::new(),
            }),
            position,
        });

        let project = self.project_mut(project_id)?;
        project.tab_ids.push(id);
        if project.active_tab_id.is_none() {
            project.active_tab_id = Some(id);
        }

        self.clear_undo_history();
        Ok(id)
    }

    pub fn add_links_tab(
        &mut self,
        project_id: ProjectId,
        name: impl Into<String>,
    ) -> Result<TabId, ExplorerError> {
        let name = trim_required(name.into()).ok_or(ExplorerError::EmptyTabName)?;
        let position = self.project(project_id)?.tab_ids.len();
        let id = TabId(self.next_tab_id);
        self.next_tab_id += 1;
        self.tabs.push(ProjectTab {
            id,
            project_id,
            name,
            content: TabContent::Links(LinksTabState {
                selected_link_id: None,
                checked_link_ids: Vec::new(),
            }),
            position,
        });
        let project = self.project_mut(project_id)?;
        project.tab_ids.push(id);
        if project.active_tab_id.is_none() {
            project.active_tab_id = Some(id);
        }
        self.clear_undo_history();
        Ok(id)
    }

    pub fn update_tab_name(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        name: impl Into<String>,
    ) -> Result<(), ExplorerError> {
        let name = trim_required(name.into()).ok_or(ExplorerError::EmptyTabName)?;
        self.ensure_tab_belongs_to_project(project_id, tab_id)?;
        self.tab_mut(tab_id)?.name = name;
        self.clear_undo_history();
        Ok(())
    }

    pub fn add_links(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        values: Vec<(String, String)>,
    ) -> Result<Vec<LinkId>, ExplorerError> {
        self.ensure_links_tab(project_id, tab_id)?;
        let normalized = values
            .into_iter()
            .map(|(name, url)| normalize_link(name, url))
            .collect::<Result<Vec<_>, _>>()?;
        let mut ids = Vec::with_capacity(normalized.len());
        let mut position = self
            .links
            .iter()
            .filter(|link| link.tab_id == tab_id)
            .count();
        for (name, url) in normalized {
            let id = LinkId(self.next_link_id);
            self.next_link_id += 1;
            self.links.push(ProjectLink {
                id,
                tab_id,
                name,
                url,
                position,
            });
            ids.push(id);
            position += 1;
        }
        self.clear_undo_history();
        Ok(ids)
    }

    pub fn update_link(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        link_id: LinkId,
        name: impl Into<String>,
        url: impl Into<String>,
    ) -> Result<(), ExplorerError> {
        self.ensure_links_tab(project_id, tab_id)?;
        let (name, url) = normalize_link(name.into(), url.into())?;
        let link = self
            .links
            .iter_mut()
            .find(|link| link.id == link_id && link.tab_id == tab_id)
            .ok_or(ExplorerError::LinkNotFound(link_id))?;
        link.name = name;
        link.url = url;
        self.clear_undo_history();
        Ok(())
    }

    pub fn select_link(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        link_id: Option<LinkId>,
    ) -> Result<(), ExplorerError> {
        self.ensure_links_tab(project_id, tab_id)?;
        if let Some(link_id) = link_id {
            self.ensure_link_belongs_to_tab(tab_id, link_id)?;
        }
        self.links_tab_mut(tab_id)?.selected_link_id = link_id;
        self.clear_undo_history();
        Ok(())
    }

    pub fn update_checked_links(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        link_ids: Vec<LinkId>,
    ) -> Result<(), ExplorerError> {
        self.ensure_links_tab(project_id, tab_id)?;
        for link_id in &link_ids {
            self.ensure_link_belongs_to_tab(tab_id, *link_id)?;
        }
        self.links_tab_mut(tab_id)?.checked_link_ids = link_ids;
        self.clear_undo_history();
        Ok(())
    }

    pub fn delete_links(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        link_ids: &[LinkId],
    ) -> Result<(), ExplorerError> {
        if link_ids.is_empty() {
            return Ok(());
        }
        self.ensure_links_tab(project_id, tab_id)?;
        for link_id in link_ids {
            self.ensure_link_belongs_to_tab(tab_id, *link_id)?;
        }
        self.push_undo_snapshot(UndoKind::DeleteLink);
        self.links.retain(|link| !link_ids.contains(&link.id));
        for (position, link) in self
            .links
            .iter_mut()
            .filter(|link| link.tab_id == tab_id)
            .enumerate()
        {
            link.position = position;
        }
        let tab = self.links_tab_mut(tab_id)?;
        if tab
            .selected_link_id
            .is_some_and(|link_id| link_ids.contains(&link_id))
        {
            tab.selected_link_id = None;
        }
        tab.checked_link_ids
            .retain(|link_id| !link_ids.contains(link_id));
        Ok(())
    }

    pub fn move_link(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        link_id: LinkId,
        target_index: usize,
    ) -> Result<(), ExplorerError> {
        self.ensure_links_tab(project_id, tab_id)?;
        self.ensure_link_belongs_to_tab(tab_id, link_id)?;
        let mut ordered_ids = self
            .links
            .iter()
            .filter(|link| link.tab_id == tab_id)
            .map(|link| link.id)
            .collect::<Vec<_>>();
        ordered_ids.sort_by_key(|id| {
            self.links
                .iter()
                .find(|link| link.id == *id)
                .map(|link| link.position)
                .unwrap_or(usize::MAX)
        });
        let source_index = ordered_ids
            .iter()
            .position(|id| *id == link_id)
            .ok_or(ExplorerError::LinkNotFound(link_id))?;
        let moved = ordered_ids.remove(source_index);
        let target_index = target_index.min(ordered_ids.len());
        ordered_ids.insert(target_index, moved);
        for (position, id) in ordered_ids.into_iter().enumerate() {
            if let Some(link) = self.links.iter_mut().find(|link| link.id == id) {
                link.position = position;
            }
        }
        self.clear_undo_history();
        Ok(())
    }

    pub fn update_tab(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        name: impl Into<String>,
        folder_path: impl Into<PathBuf>,
    ) -> Result<(), ExplorerError> {
        let name = trim_required(name.into()).ok_or(ExplorerError::EmptyTabName)?;
        self.ensure_tab_belongs_to_project(project_id, tab_id)?;
        if self.tab(tab_id)?.kind() != TabKind::Folder {
            return Err(ExplorerError::WrongTabKind {
                tab_id,
                expected: TabKind::Folder,
            });
        }
        let tab = self.tab_mut(tab_id)?;
        tab.name = name;
        let TabContent::Folder(state) = &mut tab.content else {
            unreachable!("folder tab checked before mutation")
        };
        state.folder_path = folder_path.into();
        state.selected_path = None;
        state.checked_paths.clear();
        self.clear_undo_history();
        Ok(())
    }

    pub fn update_checked_paths(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        paths: Vec<PathBuf>,
    ) -> Result<(), ExplorerError> {
        self.ensure_tab_belongs_to_project(project_id, tab_id)?;
        self.folder_tab_mut(tab_id)?.checked_paths = paths;
        self.clear_undo_history();
        Ok(())
    }

    pub fn delete_tab(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
    ) -> Result<(), ExplorerError> {
        self.delete_tabs(project_id, &[tab_id])
    }

    pub fn delete_tabs(
        &mut self,
        project_id: ProjectId,
        tab_ids: &[TabId],
    ) -> Result<(), ExplorerError> {
        let tab_ids = tab_ids.iter().copied().collect::<std::collections::HashSet<_>>();
        for tab_id in &tab_ids {
            self.ensure_tab_belongs_to_project(project_id, *tab_id)?;
        }
        if tab_ids.is_empty() {
            return Ok(());
        }
        self.push_undo_snapshot(UndoKind::DeleteTab);
        self.links.retain(|link| !tab_ids.contains(&link.tab_id));
        self.tabs.retain(|tab| !tab_ids.contains(&tab.id));

        let remaining_tabs = self
            .tabs
            .iter_mut()
            .filter(|tab| tab.project_id == project_id)
            .collect::<Vec<_>>();
        for (position, tab) in remaining_tabs.into_iter().enumerate() {
            tab.position = position;
        }

        let replacement_active_tab = self
            .tabs
            .iter()
            .filter(|tab| tab.project_id == project_id)
            .min_by_key(|tab| tab.position)
            .map(|tab| tab.id);
        let project = self.project_mut(project_id)?;
        project.tab_ids.retain(|id| !tab_ids.contains(id));
        if project.active_tab_id.is_some_and(|id| tab_ids.contains(&id)) {
            project.active_tab_id = replacement_active_tab;
        }

        Ok(())
    }

    pub fn move_tab(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        target_index: usize,
    ) -> Result<(), ExplorerError> {
        self.move_tabs(project_id, &[tab_id], target_index)
    }

    pub fn move_tabs(
        &mut self,
        project_id: ProjectId,
        tab_ids: &[TabId],
        target_index: usize,
    ) -> Result<(), ExplorerError> {
        let selected = tab_ids.iter().copied().collect::<std::collections::HashSet<_>>();
        for tab_id in &selected {
            self.ensure_tab_belongs_to_project(project_id, *tab_id)?;
        }
        if selected.is_empty() {
            return Ok(());
        }

        let mut ordered_tab_ids = self
            .tabs
            .iter()
            .filter(|tab| tab.project_id == project_id)
            .map(|tab| (tab.position, tab.id))
            .collect::<Vec<_>>();
        ordered_tab_ids.sort_by_key(|(position, _)| *position);
        let moved = ordered_tab_ids
            .iter()
            .filter(|(_, id)| selected.contains(id))
            .copied()
            .collect::<Vec<_>>();
        ordered_tab_ids.retain(|(_, id)| !selected.contains(id));
        let insertion_index = target_index.min(ordered_tab_ids.len());
        ordered_tab_ids.splice(insertion_index..insertion_index, moved);

        for (position, (_, id)) in ordered_tab_ids.iter().enumerate() {
            self.tab_mut(*id)?.position = position;
        }

        let project = self.project_mut(project_id)?;
        project.tab_ids = ordered_tab_ids.into_iter().map(|(_, id)| id).collect();

        self.clear_undo_history();
        Ok(())
    }

    pub fn activate_project(&mut self, project_id: ProjectId) -> Result<(), ExplorerError> {
        self.project(project_id)?;
        self.active_project_id = Some(project_id);
        self.clear_undo_history();
        Ok(())
    }

    pub fn activate_tab(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
    ) -> Result<(), ExplorerError> {
        self.ensure_tab_belongs_to_project(project_id, tab_id)?;
        self.project_mut(project_id)?.active_tab_id = Some(tab_id);
        self.active_project_id = Some(project_id);
        self.clear_undo_history();
        Ok(())
    }

    pub fn select_path(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
        path: impl Into<PathBuf>,
    ) -> Result<(), ExplorerError> {
        self.ensure_tab_belongs_to_project(project_id, tab_id)?;
        self.folder_tab_mut(tab_id)?.selected_path = Some(path.into());
        self.clear_undo_history();
        Ok(())
    }

    pub fn clear_selected_path(
        &mut self,
        project_id: ProjectId,
        tab_id: TabId,
    ) -> Result<(), ExplorerError> {
        self.ensure_tab_belongs_to_project(project_id, tab_id)?;
        self.folder_tab_mut(tab_id)?.selected_path = None;
        self.clear_undo_history();
        Ok(())
    }

    pub fn record_opened_file(
        &mut self,
        project_id: ProjectId,
        path: impl Into<PathBuf>,
    ) -> Result<(), ExplorerError> {
        self.project(project_id)?;
        let path = path.into();
        self.recent_files
            .retain(|file| !(file.project_id == project_id && same_path(&file.path, &path)));
        self.recent_files
            .push_front(RecentFile { project_id, path });
        self.recent_files.truncate(self.recent_file_limit);
        self.clear_undo_history();
        Ok(())
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_entries.is_empty()
    }

    pub fn undo_kind(&self) -> Option<UndoKind> {
        self.undo_entries.last().map(|entry| entry.kind)
    }

    pub fn undo_last(&mut self) -> bool {
        let Some(entry) = self.undo_entries.pop() else {
            return false;
        };
        *self = Workspace::from_snapshot(entry.snapshot);
        true
    }

    pub fn restore_last_session(&self) -> Option<RestoredSession> {
        let project_id = self.active_project_id?;
        let project = self.project(project_id).ok()?.clone();
        let active_tab = project
            .active_tab_id
            .and_then(|tab_id| self.tab(tab_id).ok().cloned());
        let selected_path = active_tab
            .as_ref()
            .and_then(ProjectTab::folder)
            .and_then(|state| state.selected_path.as_ref().cloned());

        Some(RestoredSession {
            project,
            active_tab,
            selected_path,
        })
    }

    pub fn projects(&self) -> &[Project] {
        &self.projects
    }

    pub fn tabs_for_project(
        &self,
        project_id: ProjectId,
    ) -> Result<Vec<&ProjectTab>, ExplorerError> {
        self.project(project_id)?;
        let mut tabs = self
            .tabs
            .iter()
            .filter(|tab| tab.project_id == project_id)
            .collect::<Vec<_>>();
        tabs.sort_by_key(|tab| tab.position);
        Ok(tabs)
    }

    pub fn notes_for_project(
        &self,
        project_id: ProjectId,
    ) -> Result<Vec<&ProjectNote>, ExplorerError> {
        self.project(project_id)?;
        let mut notes = self
            .notes
            .iter()
            .filter(|note| note.project_id == project_id)
            .collect::<Vec<_>>();
        notes.sort_by_key(|note| note.position);
        Ok(notes)
    }

    pub fn links_for_tab(
        &self,
        project_id: ProjectId,
        tab_id: TabId,
    ) -> Result<Vec<&ProjectLink>, ExplorerError> {
        self.ensure_links_tab(project_id, tab_id)?;
        let mut links = self
            .links
            .iter()
            .filter(|link| link.tab_id == tab_id)
            .collect::<Vec<_>>();
        links.sort_by_key(|link| link.position);
        Ok(links)
    }

    pub fn recent_files(&self) -> impl Iterator<Item = &RecentFile> {
        self.recent_files.iter()
    }

    fn project(&self, id: ProjectId) -> Result<&Project, ExplorerError> {
        self.projects
            .iter()
            .find(|project| project.id == id)
            .ok_or(ExplorerError::ProjectNotFound(id))
    }

    fn project_mut(&mut self, id: ProjectId) -> Result<&mut Project, ExplorerError> {
        self.projects
            .iter_mut()
            .find(|project| project.id == id)
            .ok_or(ExplorerError::ProjectNotFound(id))
    }

    fn tab(&self, id: TabId) -> Result<&ProjectTab, ExplorerError> {
        self.tabs
            .iter()
            .find(|tab| tab.id == id)
            .ok_or(ExplorerError::TabNotFound(id))
    }

    fn tab_mut(&mut self, id: TabId) -> Result<&mut ProjectTab, ExplorerError> {
        self.tabs
            .iter_mut()
            .find(|tab| tab.id == id)
            .ok_or(ExplorerError::TabNotFound(id))
    }

    fn note(&self, id: NoteId) -> Result<&ProjectNote, ExplorerError> {
        self.notes
            .iter()
            .find(|note| note.id == id)
            .ok_or(ExplorerError::NoteNotFound(id))
    }

    fn note_mut(&mut self, id: NoteId) -> Result<&mut ProjectNote, ExplorerError> {
        self.notes
            .iter_mut()
            .find(|note| note.id == id)
            .ok_or(ExplorerError::NoteNotFound(id))
    }

    fn ensure_tab_belongs_to_project(
        &self,
        project_id: ProjectId,
        tab_id: TabId,
    ) -> Result<(), ExplorerError> {
        self.project(project_id)?;
        let tab = self.tab(tab_id)?;
        if tab.project_id == project_id {
            Ok(())
        } else {
            Err(ExplorerError::TabDoesNotBelongToProject { project_id, tab_id })
        }
    }

    fn ensure_note_belongs_to_project(
        &self,
        project_id: ProjectId,
        note_id: NoteId,
    ) -> Result<(), ExplorerError> {
        self.project(project_id)?;
        let note = self.note(note_id)?;
        if note.project_id == project_id {
            Ok(())
        } else {
            Err(ExplorerError::NoteDoesNotBelongToProject {
                project_id,
                note_id,
            })
        }
    }

    fn ensure_links_tab(&self, project_id: ProjectId, tab_id: TabId) -> Result<(), ExplorerError> {
        self.ensure_tab_belongs_to_project(project_id, tab_id)?;
        if self.tab(tab_id)?.kind() == TabKind::Links {
            Ok(())
        } else {
            Err(ExplorerError::TabNotFound(tab_id))
        }
    }

    fn ensure_link_belongs_to_tab(
        &self,
        tab_id: TabId,
        link_id: LinkId,
    ) -> Result<(), ExplorerError> {
        self.links
            .iter()
            .find(|link| link.id == link_id && link.tab_id == tab_id)
            .map(|_| ())
            .ok_or(ExplorerError::LinkNotFound(link_id))
    }

    fn folder_tab_mut(&mut self, tab_id: TabId) -> Result<&mut FolderTabState, ExplorerError> {
        match &mut self.tab_mut(tab_id)?.content {
            TabContent::Folder(state) => Ok(state),
            TabContent::Links(_) => Err(ExplorerError::WrongTabKind {
                tab_id,
                expected: TabKind::Folder,
            }),
        }
    }

    fn links_tab_mut(&mut self, tab_id: TabId) -> Result<&mut LinksTabState, ExplorerError> {
        match &mut self.tab_mut(tab_id)?.content {
            TabContent::Links(state) => Ok(state),
            TabContent::Folder(_) => Err(ExplorerError::WrongTabKind {
                tab_id,
                expected: TabKind::Links,
            }),
        }
    }

    fn push_undo_snapshot(&mut self, kind: UndoKind) {
        self.undo_entries.push(UndoEntry {
            snapshot: self.snapshot(),
            kind,
        });
        const MAX_UNDO_SNAPSHOTS: usize = 20;
        if self.undo_entries.len() > MAX_UNDO_SNAPSHOTS {
            self.undo_entries.remove(0);
        }
    }

    fn clear_undo_history(&mut self) {
        self.undo_entries.clear();
    }
}

fn trim_required(value: String) -> Option<String> {
    let value = value.trim().to_string();
    if value.is_empty() { None } else { Some(value) }
}

fn normalize_link(name: String, url: String) -> Result<(String, String), ExplorerError> {
    let url = url.trim().to_string();
    let remainder = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .ok_or(ExplorerError::InvalidLinkUrl)?;
    let host = remainder
        .split(['/', '?', '#'])
        .next()
        .unwrap_or_default()
        .trim();
    if host.is_empty() || host.chars().any(char::is_whitespace) {
        return Err(ExplorerError::InvalidLinkUrl);
    }
    let name = trim_required(name).unwrap_or_else(|| host.to_string());
    Ok((name, url))
}

fn same_path(left: &Path, right: &Path) -> bool {
    left == right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_tab_stores_editable_links_and_selection_per_tab() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("Research", "").unwrap();
        let tab_id = workspace.add_links_tab(project_id, "References").unwrap();
        let link_ids = workspace
            .add_links(
                project_id,
                tab_id,
                vec![
                    ("Rust".to_string(), "https://www.rust-lang.org/".to_string()),
                    ("".to_string(), "https://docs.rs/".to_string()),
                ],
            )
            .unwrap();

        workspace
            .update_link(
                project_id,
                tab_id,
                link_ids[0],
                "Rust language",
                "https://www.rust-lang.org/learn",
            )
            .unwrap();
        workspace
            .select_link(project_id, tab_id, Some(link_ids[1]))
            .unwrap();
        workspace
            .update_checked_links(project_id, tab_id, vec![link_ids[0], link_ids[1]])
            .unwrap();

        let tab = workspace.tabs_for_project(project_id).unwrap()[0];
        assert_eq!(tab.kind(), TabKind::Links);
        assert_eq!(tab.links().unwrap().selected_link_id, Some(link_ids[1]));
        assert_eq!(tab.links().unwrap().checked_link_ids, link_ids);
        let links = workspace.links_for_tab(project_id, tab_id).unwrap();
        assert_eq!(links[0].name, "Rust language");
        assert_eq!(links[0].url, "https://www.rust-lang.org/learn");
        assert_eq!(links[1].name, "docs.rs");
    }

    #[test]
    fn links_accept_only_http_and_https_urls() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("Research", "").unwrap();
        let tab_id = workspace.add_links_tab(project_id, "References").unwrap();

        let result = workspace.add_links(
            project_id,
            tab_id,
            vec![("Local".to_string(), "file:///C:/secret.txt".to_string())],
        );

        assert_eq!(result, Err(ExplorerError::InvalidLinkUrl));
        assert!(
            workspace
                .links_for_tab(project_id, tab_id)
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn deleting_multiple_links_is_restored_by_one_undo() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("Research", "").unwrap();
        let tab_id = workspace.add_links_tab(project_id, "References").unwrap();
        let link_ids = workspace
            .add_links(
                project_id,
                tab_id,
                vec![
                    ("One".to_string(), "https://example.com/one".to_string()),
                    ("Two".to_string(), "https://example.com/two".to_string()),
                ],
            )
            .unwrap();

        workspace
            .delete_links(project_id, tab_id, &link_ids)
            .unwrap();
        assert_eq!(workspace.undo_kind(), Some(UndoKind::DeleteLink));
        assert!(
            workspace
                .links_for_tab(project_id, tab_id)
                .unwrap()
                .is_empty()
        );

        assert!(workspace.undo_last());
        assert_eq!(
            workspace.links_for_tab(project_id, tab_id).unwrap().len(),
            2
        );
    }

    #[test]
    fn moving_a_link_persists_its_new_position() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("Research", "").unwrap();
        let tab_id = workspace.add_links_tab(project_id, "References").unwrap();
        let ids = workspace
            .add_links(
                project_id,
                tab_id,
                vec![
                    ("One".to_string(), "https://example.com/one".to_string()),
                    ("Two".to_string(), "https://example.com/two".to_string()),
                    ("Three".to_string(), "https://example.com/three".to_string()),
                ],
            )
            .unwrap();

        workspace.move_link(project_id, tab_id, ids[2], 0).unwrap();

        assert_eq!(
            workspace
                .links_for_tab(project_id, tab_id)
                .unwrap()
                .into_iter()
                .map(|link| link.id)
                .collect::<Vec<_>>(),
            vec![ids[2], ids[0], ids[1]]
        );
    }

    #[test]
    fn tab_kind_prevents_folder_state_on_a_links_tab() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("Research", "").unwrap();
        let tab_id = workspace.add_links_tab(project_id, "References").unwrap();

        let result = workspace.select_path(project_id, tab_id, r"C:\not-valid-here");

        assert_eq!(
            result,
            Err(ExplorerError::WrongTabKind {
                tab_id,
                expected: TabKind::Folder,
            })
        );
        assert!(
            workspace.tabs_for_project(project_id).unwrap()[0]
                .folder()
                .is_none()
        );
    }

    #[test]
    fn creating_first_project_makes_it_the_restored_project() {
        let mut workspace = Workspace::new();

        let project_id = workspace
            .create_project("Client A", "契約書とデザイン素材")
            .unwrap();

        let restored = workspace.restore_last_session().unwrap();
        assert_eq!(restored.project.id, project_id);
        assert_eq!(restored.project.name, "Client A");
        assert_eq!(restored.project.summary, "契約書とデザイン素材");
        assert!(restored.active_tab.is_none());
    }

    #[test]
    fn adding_first_tab_makes_it_active_for_the_project() {
        let mut workspace = Workspace::new();
        let project_id = workspace
            .create_project("Client A", "契約書とデザイン素材")
            .unwrap();

        let tab_id = workspace
            .add_tab(project_id, "Design", r"C:\work\client-a\design")
            .unwrap();

        let restored = workspace.restore_last_session().unwrap();
        assert_eq!(restored.project.active_tab_id, Some(tab_id));
        assert_eq!(
            restored.active_tab.unwrap().folder().unwrap().folder_path,
            PathBuf::from(r"C:\work\client-a\design")
        );
    }

    #[test]
    fn tab_can_be_added_without_folder_path() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("Client A", "Alpha").unwrap();

        let tab_id = workspace.add_tab(project_id, "New Tab", "").unwrap();

        let restored = workspace.restore_last_session().unwrap();
        let tab = restored.active_tab.unwrap();
        assert_eq!(restored.project.active_tab_id, Some(tab_id));
        assert_eq!(tab.name, "New Tab");
        assert_eq!(tab.folder().unwrap().folder_path, PathBuf::from(""));
    }

    #[test]
    fn restoring_session_keeps_active_project_tab_and_selected_path() {
        let mut workspace = Workspace::new();
        let project_a = workspace
            .create_project("Client A", "契約書とデザイン素材")
            .unwrap();
        let project_b = workspace.create_project("Blog", "記事管理").unwrap();
        let docs_tab = workspace
            .add_tab(project_a, "Docs", r"C:\work\client-a\docs")
            .unwrap();
        let drafts_tab = workspace
            .add_tab(project_b, "Drafts", r"C:\work\blog\drafts")
            .unwrap();

        workspace.activate_tab(project_b, drafts_tab).unwrap();
        workspace
            .select_path(project_b, drafts_tab, r"C:\work\blog\drafts\tauri.md")
            .unwrap();
        workspace
            .select_path(project_a, docs_tab, r"C:\work\client-a\docs\memo.md")
            .unwrap();

        let restored = workspace.restore_last_session().unwrap();
        assert_eq!(restored.project.id, project_b);
        assert_eq!(restored.active_tab.unwrap().id, drafts_tab);
        assert_eq!(
            restored.selected_path,
            Some(PathBuf::from(r"C:\work\blog\drafts\tauri.md"))
        );
    }

    #[test]
    fn recent_files_are_deduplicated_and_newest_first() {
        let mut workspace = Workspace::new();
        let project_id = workspace
            .create_project("Client A", "契約書とデザイン素材")
            .unwrap();

        workspace
            .record_opened_file(project_id, r"C:\work\client-a\a.xlsx")
            .unwrap();
        workspace
            .record_opened_file(project_id, r"C:\work\client-a\b.xlsx")
            .unwrap();
        workspace
            .record_opened_file(project_id, r"C:\work\client-a\a.xlsx")
            .unwrap();

        let paths = workspace
            .recent_files()
            .map(|file| file.path.clone())
            .collect::<Vec<_>>();
        assert_eq!(
            paths,
            vec![
                PathBuf::from(r"C:\work\client-a\a.xlsx"),
                PathBuf::from(r"C:\work\client-a\b.xlsx")
            ]
        );
    }

    #[test]
    fn tab_cannot_be_activated_from_another_project() {
        let mut workspace = Workspace::new();
        let project_a = workspace.create_project("A", "Alpha").unwrap();
        let project_b = workspace.create_project("B", "Beta").unwrap();
        let tab_a = workspace
            .add_tab(project_a, "Src", r"C:\work\a\src")
            .unwrap();

        let error = workspace.activate_tab(project_b, tab_a).unwrap_err();

        assert_eq!(
            error,
            ExplorerError::TabDoesNotBelongToProject {
                project_id: project_b,
                tab_id: tab_a
            }
        );
    }

    #[test]
    fn blank_names_are_rejected() {
        let mut workspace = Workspace::new();

        assert_eq!(
            workspace.create_project("  ", r"C:\work").unwrap_err(),
            ExplorerError::EmptyProjectName
        );

        let project_id = workspace.create_project("A", "Alpha").unwrap();
        assert_eq!(
            workspace
                .add_tab(project_id, "\t", r"C:\work\a")
                .unwrap_err(),
            ExplorerError::EmptyTabName
        );
    }

    #[test]
    fn workspace_can_be_restored_from_snapshot() {
        let mut workspace = Workspace::new();
        let project_a = workspace.create_project("A", "Alpha").unwrap();
        let project_b = workspace.create_project("B", "Beta").unwrap();
        let tab_a = workspace
            .add_tab(project_a, "Notes", r"C:\work\a\notes")
            .unwrap();
        let tab_b = workspace
            .add_tab(project_b, "Src", r"C:\work\b\src")
            .unwrap();

        workspace.activate_tab(project_b, tab_b).unwrap();
        workspace
            .select_path(project_b, tab_b, r"C:\work\b\src\main.rs")
            .unwrap();
        workspace
            .record_opened_file(project_b, r"C:\work\b\src\main.rs")
            .unwrap();
        workspace
            .record_opened_file(project_a, r"C:\work\a\notes\todo.md")
            .unwrap();

        let restored = Workspace::from_snapshot(workspace.snapshot());

        let session = restored.restore_last_session().unwrap();
        assert_eq!(session.project.id, project_b);
        assert_eq!(session.active_tab.unwrap().id, tab_b);
        assert_eq!(
            session.selected_path,
            Some(PathBuf::from(r"C:\work\b\src\main.rs"))
        );
        assert_eq!(restored.tabs_for_project(project_a).unwrap()[0].id, tab_a);
        assert_eq!(
            restored
                .recent_files()
                .map(|file| file.path.clone())
                .collect::<Vec<_>>(),
            vec![
                PathBuf::from(r"C:\work\a\notes\todo.md"),
                PathBuf::from(r"C:\work\b\src\main.rs")
            ]
        );
    }

    #[test]
    fn restored_workspace_continues_id_sequences() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        workspace
            .add_tab(project_id, "Src", r"C:\work\a\src")
            .unwrap();

        let mut restored = Workspace::from_snapshot(workspace.snapshot());

        let next_project_id = restored.create_project("B", "Beta").unwrap();
        let next_tab_id = restored
            .add_tab(next_project_id, "Docs", r"C:\work\b\docs")
            .unwrap();

        assert_eq!(next_project_id.value(), 2);
        assert_eq!(next_tab_id.value(), 2);
    }

    #[test]
    fn project_can_be_updated_with_summary() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();

        workspace
            .update_project(project_id, "Client A", "契約書と素材")
            .unwrap();

        let project = workspace.restore_last_session().unwrap().project;
        assert_eq!(project.name, "Client A");
        assert_eq!(project.summary, "契約書と素材");
    }

    #[test]
    fn tab_can_be_updated_and_clears_selected_path() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let tab_id = workspace.add_tab(project_id, "Old", r"C:\old").unwrap();
        workspace
            .select_path(project_id, tab_id, r"C:\old\a.txt")
            .unwrap();
        workspace
            .update_checked_paths(
                project_id,
                tab_id,
                vec![
                    PathBuf::from(r"C:\old\a.txt"),
                    PathBuf::from(r"C:\old\b.txt"),
                ],
            )
            .unwrap();

        workspace
            .update_tab(project_id, tab_id, "Docs", r"C:\docs")
            .unwrap();

        let tab = workspace
            .restore_last_session()
            .unwrap()
            .active_tab
            .unwrap();
        assert_eq!(tab.name, "Docs");
        assert_eq!(tab.folder().unwrap().folder_path, PathBuf::from(r"C:\docs"));
        assert!(tab.folder().unwrap().selected_path.is_none());
        assert!(tab.folder().unwrap().checked_paths.is_empty());
    }

    #[test]
    fn checked_paths_are_saved_per_tab() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let tab_id = workspace.add_tab(project_id, "Docs", r"C:\docs").unwrap();

        workspace
            .update_checked_paths(
                project_id,
                tab_id,
                vec![
                    PathBuf::from(r"C:\docs\a.txt"),
                    PathBuf::from(r"C:\docs\b.txt"),
                ],
            )
            .unwrap();

        let tab = workspace
            .tabs_for_project(project_id)
            .unwrap()
            .into_iter()
            .find(|tab| tab.id == tab_id)
            .unwrap();
        assert_eq!(
            tab.folder().unwrap().checked_paths,
            vec![
                PathBuf::from(r"C:\docs\a.txt"),
                PathBuf::from(r"C:\docs\b.txt")
            ]
        );
    }

    #[test]
    fn selected_path_can_be_cleared_when_file_is_missing() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let tab_id = workspace.add_tab(project_id, "Docs", r"C:\docs").unwrap();
        workspace
            .select_path(project_id, tab_id, r"C:\docs\missing.txt")
            .unwrap();

        workspace.clear_selected_path(project_id, tab_id).unwrap();

        let session = workspace.restore_last_session().unwrap();
        assert!(session.selected_path.is_none());
        assert!(
            session
                .active_tab
                .unwrap()
                .folder()
                .unwrap()
                .selected_path
                .is_none()
        );
    }

    #[test]
    fn deleting_tab_removes_only_tab_registration() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let first = workspace.add_tab(project_id, "First", r"C:\first").unwrap();
        let second = workspace
            .add_tab(project_id, "Second", r"C:\second")
            .unwrap();
        workspace.activate_tab(project_id, second).unwrap();

        workspace.delete_tab(project_id, second).unwrap();

        let session = workspace.restore_last_session().unwrap();
        assert_eq!(session.project.active_tab_id, Some(first));
        assert_eq!(workspace.tabs_for_project(project_id).unwrap().len(), 1);
    }

    #[test]
    fn moving_tab_reorders_tabs_and_reassigns_positions() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let first = workspace.add_tab(project_id, "First", r"C:\first").unwrap();
        let second = workspace
            .add_tab(project_id, "Second", r"C:\second")
            .unwrap();
        let third = workspace.add_tab(project_id, "Third", r"C:\third").unwrap();

        workspace.move_tab(project_id, third, 0).unwrap();

        let tabs = workspace.tabs_for_project(project_id).unwrap();
        assert_eq!(
            tabs.iter().map(|tab| tab.id).collect::<Vec<_>>(),
            vec![third, first, second]
        );
        assert_eq!(
            tabs.iter().map(|tab| tab.position).collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
    }

    #[test]
    fn moving_selected_tabs_groups_them_in_original_order_at_the_drop_target() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let ids = (0..6)
            .map(|index| workspace.add_tab(project_id, format!("Tab {index}"), "").unwrap())
            .collect::<Vec<_>>();

        workspace.move_tabs(project_id, &[ids[1], ids[3]], 5).unwrap();

        let ordered = workspace
            .tabs_for_project(project_id)
            .unwrap()
            .iter()
            .map(|tab| tab.id)
            .collect::<Vec<_>>();
        assert_eq!(ordered, vec![ids[0], ids[2], ids[4], ids[5], ids[1], ids[3]]);
    }

    #[test]
    fn deleting_multiple_tabs_is_restored_by_one_undo() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let first = workspace.add_tab(project_id, "First", "").unwrap();
        let second = workspace.add_links_tab(project_id, "Links").unwrap();
        let third = workspace.add_tab(project_id, "Third", "").unwrap();

        workspace.delete_tabs(project_id, &[first, third]).unwrap();
        assert_eq!(workspace.tabs_for_project(project_id).unwrap().len(), 1);
        assert!(workspace.undo_last());
        assert_eq!(
            workspace
                .tabs_for_project(project_id)
                .unwrap()
                .iter()
                .map(|tab| tab.id)
                .collect::<Vec<_>>(),
            vec![first, second, third]
        );
        assert!(!workspace.undo_last());
    }

    #[test]
    fn deleting_project_removes_project_registrations_and_keeps_other_projects() {
        let mut workspace = Workspace::new();
        let project_a = workspace.create_project("A", "Alpha").unwrap();
        let project_b = workspace.create_project("B", "Beta").unwrap();
        workspace.add_tab(project_a, "Docs", r"C:\a\docs").unwrap();
        workspace.add_tab(project_b, "Src", r"C:\b\src").unwrap();
        workspace
            .record_opened_file(project_a, r"C:\a\docs\a.txt")
            .unwrap();
        workspace
            .record_opened_file(project_b, r"C:\b\src\b.txt")
            .unwrap();
        workspace.activate_project(project_a).unwrap();

        workspace.delete_project(project_a).unwrap();

        let session = workspace.restore_last_session().unwrap();
        assert_eq!(session.project.id, project_b);
        assert_eq!(workspace.projects().len(), 1);
        assert_eq!(workspace.tabs_for_project(project_b).unwrap().len(), 1);
        assert_eq!(
            workspace
                .recent_files()
                .map(|file| file.path.clone())
                .collect::<Vec<_>>(),
            vec![PathBuf::from(r"C:\b\src\b.txt")]
        );
    }

    #[test]
    fn deleting_tab_can_be_undone_with_selection_and_checked_files() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let first = workspace.add_tab(project_id, "First", r"C:\first").unwrap();
        let second = workspace
            .add_tab(project_id, "Second", r"C:\second")
            .unwrap();
        workspace.activate_tab(project_id, second).unwrap();
        workspace
            .select_path(project_id, second, r"C:\second\selected.txt")
            .unwrap();
        workspace
            .update_checked_paths(project_id, second, vec![PathBuf::from(r"C:\second\a.txt")])
            .unwrap();

        workspace.delete_tab(project_id, second).unwrap();
        assert!(workspace.can_undo());
        assert_eq!(workspace.undo_kind(), Some(UndoKind::DeleteTab));

        assert!(workspace.undo_last());

        let session = workspace.restore_last_session().unwrap();
        assert_eq!(session.project.active_tab_id, Some(second));
        assert_eq!(
            session.active_tab.unwrap().folder().unwrap().selected_path,
            Some(PathBuf::from(r"C:\second\selected.txt"))
        );
        let tabs = workspace.tabs_for_project(project_id).unwrap();
        assert_eq!(
            tabs.iter().map(|tab| tab.id).collect::<Vec<_>>(),
            vec![first, second]
        );
        assert_eq!(
            tabs[1].folder().unwrap().checked_paths,
            vec![PathBuf::from(r"C:\second\a.txt")]
        );
        assert!(!workspace.can_undo());
    }

    #[test]
    fn deleting_project_can_be_undone_with_tabs_recent_files_and_active_project() {
        let mut workspace = Workspace::new();
        let project_a = workspace.create_project("A", "Alpha").unwrap();
        let project_b = workspace.create_project("B", "Beta").unwrap();
        let tab_a = workspace.add_tab(project_a, "Docs", r"C:\a\docs").unwrap();
        workspace.add_tab(project_b, "Src", r"C:\b\src").unwrap();
        workspace.activate_tab(project_a, tab_a).unwrap();
        workspace
            .record_opened_file(project_a, r"C:\a\docs\a.txt")
            .unwrap();

        workspace.delete_project(project_a).unwrap();
        assert!(workspace.can_undo());
        assert_eq!(workspace.undo_kind(), Some(UndoKind::DeleteProject));

        assert!(workspace.undo_last());

        let session = workspace.restore_last_session().unwrap();
        assert_eq!(session.project.id, project_a);
        assert_eq!(workspace.projects().len(), 2);
        assert_eq!(workspace.tabs_for_project(project_a).unwrap().len(), 1);
        assert_eq!(
            workspace
                .recent_files()
                .map(|file| file.path.clone())
                .collect::<Vec<_>>(),
            vec![PathBuf::from(r"C:\a\docs\a.txt")]
        );
    }

    #[test]
    fn non_delete_mutation_clears_pending_undo_to_avoid_reverting_new_work() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let tab_id = workspace.add_tab(project_id, "Docs", r"C:\docs").unwrap();

        workspace.delete_tab(project_id, tab_id).unwrap();
        assert!(workspace.can_undo());

        workspace.create_project("B", "Beta").unwrap();

        assert!(!workspace.can_undo());
        assert!(!workspace.undo_last());
    }

    #[test]
    fn first_note_becomes_active_and_multiple_notes_keep_their_order() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();

        let first = workspace.add_note(project_id, "Meeting", "Agenda").unwrap();
        let second = workspace
            .add_note(project_id, "Commands", "cargo test")
            .unwrap();

        let project = workspace
            .projects()
            .iter()
            .find(|project| project.id == project_id)
            .unwrap();
        assert_eq!(project.active_note_id, Some(first));
        assert_eq!(
            workspace
                .notes_for_project(project_id)
                .unwrap()
                .iter()
                .map(|note| note.id)
                .collect::<Vec<_>>(),
            vec![first, second]
        );
    }

    #[test]
    fn note_can_be_selected_and_updated() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let first = workspace.add_note(project_id, "Meeting", "Agenda").unwrap();
        let second = workspace
            .add_note(project_id, "Commands", "cargo test")
            .unwrap();

        workspace.activate_note(project_id, second).unwrap();
        workspace
            .update_note(project_id, second, "Build commands", "cargo test --all")
            .unwrap();

        let project = workspace
            .projects()
            .iter()
            .find(|project| project.id == project_id)
            .unwrap();
        assert_eq!(project.active_note_id, Some(second));
        let notes = workspace.notes_for_project(project_id).unwrap();
        assert_eq!(notes[0].id, first);
        assert_eq!(notes[1].title, "Build commands");
        assert_eq!(notes[1].content, "cargo test --all");
    }

    #[test]
    fn deleting_active_note_selects_a_replacement_and_can_be_undone() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let first = workspace.add_note(project_id, "Meeting", "Agenda").unwrap();
        let second = workspace
            .add_note(project_id, "Commands", "cargo test")
            .unwrap();
        workspace.activate_note(project_id, second).unwrap();

        workspace.delete_note(project_id, second).unwrap();

        let project = workspace
            .projects()
            .iter()
            .find(|project| project.id == project_id)
            .unwrap();
        assert_eq!(project.active_note_id, Some(first));
        assert_eq!(workspace.undo_kind(), Some(UndoKind::DeleteNote));
        assert!(workspace.undo_last());
        assert_eq!(workspace.notes_for_project(project_id).unwrap().len(), 2);
        let project = workspace
            .projects()
            .iter()
            .find(|project| project.id == project_id)
            .unwrap();
        assert_eq!(project.active_note_id, Some(second));
    }

    #[test]
    fn deleting_multiple_notes_is_one_undoable_operation() {
        let mut workspace = Workspace::new();
        let project_id = workspace.create_project("A", "Alpha").unwrap();
        let first = workspace.add_note(project_id, "First", "A").unwrap();
        let second = workspace.add_note(project_id, "Second", "B").unwrap();
        let third = workspace.add_note(project_id, "Third", "C").unwrap();
        workspace.activate_note(project_id, third).unwrap();

        workspace.delete_notes(project_id, &[first, third]).unwrap();

        let notes = workspace.notes_for_project(project_id).unwrap();
        assert_eq!(
            notes.iter().map(|note| note.id).collect::<Vec<_>>(),
            vec![second]
        );
        assert_eq!(workspace.projects()[0].active_note_id, Some(second));
        assert_eq!(workspace.undo_kind(), Some(UndoKind::DeleteNote));

        assert!(workspace.undo_last());
        assert_eq!(workspace.notes_for_project(project_id).unwrap().len(), 3);
        assert_eq!(workspace.projects()[0].active_note_id, Some(third));
        assert!(!workspace.can_undo());
    }

    #[test]
    fn deleting_multiple_projects_is_one_undoable_operation() {
        let mut workspace = Workspace::new();
        let first = workspace.create_project("A", "Alpha").unwrap();
        let second = workspace.create_project("B", "Beta").unwrap();
        let third = workspace.create_project("C", "Gamma").unwrap();
        workspace.add_tab(first, "A tab", r"C:\a").unwrap();
        workspace.add_note(third, "C note", "content").unwrap();

        workspace.delete_projects(&[first, third]).unwrap();

        assert_eq!(
            workspace
                .projects()
                .iter()
                .map(|project| project.id)
                .collect::<Vec<_>>(),
            vec![second]
        );
        assert_eq!(workspace.undo_kind(), Some(UndoKind::DeleteProject));

        assert!(workspace.undo_last());
        assert_eq!(workspace.projects().len(), 3);
        assert_eq!(workspace.tabs_for_project(first).unwrap().len(), 1);
        assert_eq!(workspace.notes_for_project(third).unwrap().len(), 1);
        assert!(!workspace.can_undo());
    }
}
