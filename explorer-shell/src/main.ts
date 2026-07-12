import {
  checkFileRange,
  fileOpenAction,
  initialFileSelectionState,
  previewTargetPath,
  pruneCheckedPaths,
  pruneSelectedPath,
  selectSingleFileEntry,
  toggleCheckedFileEntry,
  type FileSelectionState,
} from "./fileSelection";
import { FolderListRenderer } from "./folderListRenderer";
import { ContextMenuController } from "./contextMenuController";
import {
  linkDeleteConfirmation,
  linkIdsForDelete,
  linkPreviewText,
  parseLinkLines,
  parseSingleLink,
  selectedLinkView,
  toggleCheckedLink,
  type LinkInput,
} from "./links";
import { LinksRenderer } from "./linksRenderer";
import { WorkspaceActivityRenderer } from "./workspaceActivityRenderer";
import { WorkspaceApplicationController } from "./workspaceApplicationController";
import { bootstrapWorkspaceApp } from "./bootstrap";
import { ActiveHeaderRenderer } from "./activeHeaderRenderer";
import {
  WorkspaceViewStateController,
} from "./workspaceViewStateController";
import { shouldRunAppUndo } from "./keyboard";
import {
  finishInlineEdit,
  startInlineEdit,
  startTabFolderEditForChoice,
  type InlineEditField,
} from "./inlineEdit";
import {
  shouldRefreshForFolderChange,
  type FolderChangedPayload,
} from "./folderWatch";
import {
  normalizeProjectCustomOrder,
  normalizeProjectSortMode,
  sortProjectsForDisplay,
  type ProjectSortMode,
} from "./projectSort";
import { ProjectDragController } from "./projectDragController";
import { bindProjectItemInteractions } from "./projectItemInteractions";
import { createProjectMenuButton } from "./projectMenuButton";
import { ProjectListRenderer } from "./projectListRenderer";
import { DialogManager } from "./dialogManager";
import { renderProjectListField as renderProjectListFieldElement } from "./projectListFieldRenderer";
import {
  projectDeleteConfirmationForNames,
  projectDeleteMenuLabel,
  projectMenuEditField,
} from "./projectMenu";
import {
  activeNoteForProject,
  notesForProject,
} from "./notePanel";
import { NotePanelController } from "./notePanelController";
import {
  noteContextSelection,
  noteDeleteMenuLabel,
} from "./notePointer";
import { NotePanelRenderer } from "./notePanelRenderer";
import { createNotesApi } from "./notesApi";
import { createTabsApi } from "./tabsApi";
import { createProjectsApi } from "./projectsApi";
import {
  applyMultiSelection,
  emptyMultiSelection,
} from "./multiSelection";
import { sidebarView } from "./sidebar";
import {
  chooseDirectory,
  closeWorkspaceRuntime,
  currentRuntime,
  invoke,
  listenFolderChanged,
  localWebHealthAvailable,
  notifyLocalWebPageClosing,
  runtimeCloseCopy,
  runtimeDisplayName,
  type LocalWebConnectionState,
} from "./runtime";
import { TabBarRenderer } from "./tabBarRenderer";
import { tabWheelScroll } from "./tabWheel";
import { tabCreationMenuOpenAfter, tabCreationMenuPosition } from "./tabCreationMenu";
import {
  tabDeleteConfirmationForTabs,
  tabDeleteMenuLabel,
} from "./tabMenu";
import {
  DEFAULT_TAB_NAME,
  folderDialogDefaultPath,
  tabNameAfterFolderChange,
} from "./tabNaming";

type ProjectDto = {
  id: number;
  name: string;
  summary: string;
  active_tab_id: number | null;
  active_note_id: number | null;
};

type NoteDto = {
  id: number;
  project_id: number;
  title: string;
  content: string;
  position: number;
};

type TabBaseDto = {
  id: number;
  project_id: number;
  name: string;
  position: number;
};

type FolderTabDto = TabBaseDto & {
  kind: "folder";
  folder_path: string;
  selected_path: string | null;
  checked_paths: string[];
};

type LinksTabDto = TabBaseDto & {
  kind: "links";
  selected_link_id: number | null;
  checked_link_ids: number[];
};

type TabDto = FolderTabDto | LinksTabDto;

type LinkDto = {
  id: number;
  tab_id: number;
  name: string;
  url: string;
  position: number;
};

type RecentFileDto = {
  project_id: number;
  path: string;
};

type SessionDto = {
  project: ProjectDto;
  active_tab: TabDto | null;
  selected_path: string | null;
};

type WorkspaceDto = {
  projects: ProjectDto[];
  tabs: TabDto[];
  notes: NoteDto[];
  links: LinkDto[];
  recent_files: RecentFileDto[];
  restored_session: SessionDto | null;
  can_undo: boolean;
  undo_kind: "delete_project" | "delete_tab" | "delete_note" | "delete_link" | null;
};

type FileEntryDto = {
  name: string;
  path: string;
  is_dir: boolean;
};

type PreviewDto = {
  path: string;
  content: string | null;
  truncated: boolean;
  message: string | null;
};

type StorageInfoDto = {
  mode: "appdata" | "portable";
  database_path: string;
};

const notesApi = createNotesApi<WorkspaceDto>(invoke);
const tabsApi = createTabsApi<WorkspaceDto>(invoke);
const projectsApi = createProjectsApi<WorkspaceDto>(invoke);
const viewStateController = new WorkspaceViewStateController();

let workspace: WorkspaceDto = {
  projects: [],
  tabs: [],
  notes: [],
  links: [],
  recent_files: [],
  restored_session: null,
  can_undo: false,
  undo_kind: null,
};

let files: FileEntryDto[] = [];
let errorMessage: string | null = null;
let previewText = "No preview";
let projectSortMode: ProjectSortMode = "custom";
let projectCustomOrder: number[] = [];
let suppressProjectClick = false;
let projectInteractionRevision = 0;
let sidebarCollapsed = false;
let noteInteractionQueue: Promise<void> = Promise.resolve();
let folderRefreshTimer: number | null = null;
let fileTooltipTimer: number | null = null;
let copiedLinkId: number | null = null;
let linkSelectionQueue: Promise<void> = Promise.resolve();
let runtimeCloseInProgress = false;

const applicationController = new WorkspaceApplicationController<WorkspaceDto>({
  getWorkspace: () => workspace,
  setWorkspace: (nextWorkspace) => { workspace = nextWorkspace; },
  onError: (message) => {
    errorMessage = message;
    render();
  },
}, {
  projects: projectsApi,
  tabs: tabsApi,
  notes: notesApi,
  invokeWorkspace: (command, args) => invoke<WorkspaceDto>(command, args),
});

const appShell = element<HTMLElement>("#app-shell");
const workspacePane = element<HTMLElement>(".workspace-pane");
const localWebDisconnected = element<HTMLElement>("#local-web-disconnected");
const localWebDisconnectedTitle = element<HTMLElement>("#local-web-disconnected-title");
const localWebDisconnectedDetail = element<HTMLElement>("#local-web-disconnected-detail");
const retryLocalWebButton = element<HTMLButtonElement>("#retry-local-web-button");
const runtimeCloseButton = element<HTMLButtonElement>("#runtime-close-button");
const runtimeCloseLabel = element<HTMLElement>("#runtime-close-label");
const projectForm = element<HTMLFormElement>("#project-form");
const projectNameInput = element<HTMLInputElement>("#project-name");
const projectSummaryInput = element<HTMLInputElement>("#project-summary");
const projectList = element<HTMLElement>("#project-list");
const sidebarToggleButton = element<HTMLButtonElement>("#sidebar-toggle-button");
const sortCustomButton = element<HTMLButtonElement>("#sort-custom-button");
const sortCreatedButton = element<HTMLButtonElement>("#sort-created-button");
const sortNameButton = element<HTMLButtonElement>("#sort-name-button");
const storageMode = element<HTMLElement>("#storage-mode");
const storagePath = element<HTMLElement>("#storage-path");
const openStorageFolderButton = element<HTMLButtonElement>("#open-storage-folder-button");
const activeProjectName = element<HTMLElement>("#active-project-name");
const activeProjectSummary = element<HTMLElement>("#active-project-summary");
const notesPanel = element<HTMLElement>("#notes-panel");
const notesCount = element<HTMLElement>("#notes-count");
const noteList = element<HTMLElement>("#note-list");
const noteDetail = element<HTMLElement>("#note-detail");
const activeNoteTitle = element<HTMLElement>("#active-note-title");
const activeNoteContent = element<HTMLElement>("#active-note-content");
const addNoteButton = element<HTMLButtonElement>("#add-note-button");
const deleteNoteButton = element<HTMLButtonElement>("#delete-note-button");
const toggleNotesSizeButton = element<HTMLButtonElement>("#toggle-notes-size-button");
const notesResizeHandle = element<HTMLElement>("#notes-resize-handle");
const undoButton = element<HTMLButtonElement>("#undo-button");
const undoHint = element<HTMLElement>("#undo-hint");
const deleteProjectButton = element<HTMLButtonElement>("#delete-project-button");
const tabList = element<HTMLElement>("#tab-list");
const addTabButton = element<HTMLButtonElement>("#add-tab-button");
const addTabMenu = element<HTMLElement>("#add-tab-menu");
const addFolderTabButton = element<HTMLButtonElement>("#add-folder-tab-button");
const addLinksTabButton = element<HTMLButtonElement>("#add-links-tab-button");
const openFolderButton = element<HTMLButtonElement>("#open-folder-button");
const addLinkButton = element<HTMLButtonElement>("#add-link-button");
const addLinksButton = element<HTMLButtonElement>("#add-links-button");
const openFilesButton = element<HTMLButtonElement>("#open-files-button");
const openSelectedButton = element<HTMLButtonElement>("#open-selected-button");
const activeTabName = element<HTMLElement>("#active-tab-name");
const activeTabKindLabel = element<HTMLElement>("#active-tab-kind-label");
const activeTabPath = element<HTMLElement>("#active-tab-path");
const fileList = element<HTMLElement>("#file-list");
const tabContextMenu = element<HTMLElement>("#tab-context-menu");
const renameTabMenuButton = element<HTMLButtonElement>("#rename-tab-menu-button");
const deleteTabMenuButton = element<HTMLButtonElement>("#delete-tab-menu-button");
const linkContextMenu = element<HTMLElement>("#link-context-menu");
const editLinkNameMenuButton = element<HTMLButtonElement>("#edit-link-name-menu-button");
const editLinkUrlMenuButton = element<HTMLButtonElement>("#edit-link-url-menu-button");
const openLinkMenuButton = element<HTMLButtonElement>("#open-link-menu-button");
const copyLinkMenuButton = element<HTMLButtonElement>("#copy-link-menu-button");
const deleteLinkMenuButton = element<HTMLButtonElement>("#delete-link-menu-button");
const addLinkDialog = element<HTMLDialogElement>("#add-link-dialog");
const addLinkName = element<HTMLInputElement>("#add-link-name");
const addLinkUrl = element<HTMLTextAreaElement>("#add-link-url");
const addLinkError = element<HTMLElement>("#add-link-error");
const confirmAddLinkButton = element<HTMLButtonElement>("#confirm-add-link-button");
const addLinksDialog = element<HTMLDialogElement>("#add-links-dialog");
const addLinksInput = element<HTMLTextAreaElement>("#add-links-input");
const addLinksError = element<HTMLElement>("#add-links-error");
const confirmAddLinksButton = element<HTMLButtonElement>("#confirm-add-links-button");
const deleteLinkDialog = element<HTMLDialogElement>("#delete-link-dialog");
const deleteLinkDialogTitle = element<HTMLElement>("#delete-link-dialog-title");
const deleteLinkDialogDetail = element<HTMLElement>("#delete-link-dialog-detail");
const confirmDeleteLinkButton = element<HTMLButtonElement>("#confirm-delete-link-button");
const fileTooltip = element<HTMLElement>("#file-tooltip");
const checkedPaths = element<HTMLElement>("#checked-paths");
const selectedPath = element<HTMLElement>("#selected-path");
const previewContent = element<HTMLElement>("#preview-content");
const recentList = element<HTMLElement>("#recent-list");
const projectContextMenu = element<HTMLElement>("#project-context-menu");
const renameProjectMenuButton = element<HTMLButtonElement>("#rename-project-menu-button");
const editProjectDescriptionMenuButton = element<HTMLButtonElement>(
  "#edit-project-description-menu-button",
);
const deleteProjectMenuButton = element<HTMLButtonElement>("#delete-project-menu-button");
const noteContextMenu = element<HTMLElement>("#note-context-menu");
const editNoteTitleMenuButton = element<HTMLButtonElement>("#edit-note-title-menu-button");
const editNoteContentMenuButton = element<HTMLButtonElement>("#edit-note-content-menu-button");
const deleteNoteMenuButton = element<HTMLButtonElement>("#delete-note-menu-button");
const deleteProjectDialog = element<HTMLDialogElement>("#delete-project-dialog");
const deleteProjectDialogTitle = element<HTMLElement>("#delete-project-dialog-title");
const deleteProjectDialogDetail = element<HTMLElement>("#delete-project-dialog-detail");
const confirmDeleteProjectButton = element<HTMLButtonElement>(
  "#confirm-delete-project-button",
);
const deleteTabDialog = element<HTMLDialogElement>("#delete-tab-dialog");
const deleteTabDialogTitle = element<HTMLElement>("#delete-tab-dialog-title");
const deleteTabDialogDetail = element<HTMLElement>("#delete-tab-dialog-detail");
const confirmDeleteTabButton = element<HTMLButtonElement>("#confirm-delete-tab-button");
const closeRuntimeDialog = element<HTMLDialogElement>("#close-runtime-dialog");
const closeRuntimeDialogTitle = element<HTMLElement>("#close-runtime-dialog-title");
const closeRuntimeDialogDetail = element<HTMLElement>("#close-runtime-dialog-detail");
const confirmCloseRuntimeButton = element<HTMLButtonElement>("#confirm-close-runtime-button");
const dialogs = new DialogManager({
  addLink: addLinkDialog,
  addLinks: addLinksDialog,
  deleteLink: deleteLinkDialog,
  deleteProject: deleteProjectDialog,
  deleteTab: deleteTabDialog,
  closeRuntime: closeRuntimeDialog,
});

const contextMenus = new ContextMenuController({
  project: { menu: projectContextMenu, focusTarget: renameProjectMenuButton },
  tab: { menu: tabContextMenu, focusTarget: renameTabMenuButton },
  note: { menu: noteContextMenu, focusTarget: editNoteTitleMenuButton },
  link: { menu: linkContextMenu, focusTarget: editLinkNameMenuButton },
});

const notePanelController = new NotePanelController({
  load: async () => ({
    customHeight: await invoke<number | null>("load_notes_custom_height"),
    maximized: await invoke<boolean>("load_notes_maximized"),
  }),
  save: async (state) => {
    await runCommand(async () => {
      await invoke("save_notes_custom_height", { height: state.customHeight });
      await invoke("save_notes_maximized", { maximized: state.maximized });
    });
  },
  geometry: () => ({
    viewportHeight: window.innerHeight,
    panelTop: notesPanel.getBoundingClientRect().top,
    panelHeight: notesPanel.getBoundingClientRect().height,
  }),
  setHeight: (height) => {
    notesPanel.style.height = `${height}px`;
  },
  setResizing: (resizing) => {
    notesPanel.classList.toggle("is-resizing", resizing);
  },
});

const notePanelRenderer = new NotePanelRenderer({
  panel: notesPanel,
  count: notesCount,
  list: noteList,
  detail: noteDetail,
  title: activeNoteTitle,
  content: activeNoteContent,
  addButton: addNoteButton,
  deleteButton: deleteNoteButton,
  toggleSizeButton: toggleNotesSizeButton,
});
const tabBarRenderer = new TabBarRenderer(tabList);
const folderListRenderer = new FolderListRenderer(fileList);
const linksRenderer = new LinksRenderer(fileList);
const activityRenderer = new WorkspaceActivityRenderer({
  checked: checkedPaths,
  selected: selectedPath,
  preview: previewContent,
  recent: recentList,
  openCheckedButton: openFilesButton,
  openSelectedButton,
});
const activeHeaderRenderer = new ActiveHeaderRenderer({
  projectName: activeProjectName,
  projectSummary: activeProjectSummary,
  tabName: activeTabName,
  tabKindLabel: activeTabKindLabel,
  tabPath: activeTabPath,
  openFolderButton,
  addLinkButton,
  addLinksButton,
});
const projectListRenderer = new ProjectListRenderer(projectList, {
  custom: sortCustomButton,
  created: sortCreatedButton,
  name: sortNameButton,
});
const projectDragController = new ProjectDragController(projectList, {
  getState: () => ({
    sortMode: projectSortMode,
    inlineEditing: viewStateController.state.inlineEdit.field !== null,
    selection: viewStateController.state.projectSelection,
    projectIds: workspace.projects.map((project) => project.id),
    customOrder: projectCustomOrder,
  }),
  setCustomOrder: (order) => { projectCustomOrder = order; },
  setClickSuppressed: (suppressed) => { suppressProjectClick = suppressed; },
  render,
  persist: () => runCommand(persistProjectCustomOrder),
});

bootstrapWorkspaceApp({
  initialize: async () => {
  document.body.append(addTabMenu);
  configureRuntimeCloseButton();
  runtimeCloseButton.addEventListener("click", requestRuntimeClose);
  confirmCloseRuntimeButton.addEventListener("click", confirmRuntimeClose);
  retryLocalWebButton.addEventListener("click", retryLocalWebConnection);
  projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createProject();
  });

  addNoteButton.addEventListener("click", addNote);
  deleteNoteButton.addEventListener("click", deleteActiveNote);
  toggleNotesSizeButton.addEventListener("click", toggleNotesSize);
  notesResizeHandle.addEventListener("pointerdown", startNotesResize);
  notesResizeHandle.addEventListener("pointermove", moveNotesResize);
  notesResizeHandle.addEventListener("pointerup", finishNotesResize);
  notesResizeHandle.addEventListener("pointercancel", finishNotesResize);
  notesResizeHandle.addEventListener("dblclick", resetNotesHeight);
  window.addEventListener("resize", applyNotePanelHeight);
  window.addEventListener("resize", positionAddTabMenu);
  undoButton.addEventListener("click", undoLast);
  deleteProjectButton.addEventListener("click", requestActiveProjectDelete);
  sidebarToggleButton.addEventListener("click", toggleSidebar);
  renameProjectMenuButton.addEventListener("click", () => editProjectFromMenu("rename"));
  editProjectDescriptionMenuButton.addEventListener("click", () =>
    editProjectFromMenu("description"),
  );
  deleteProjectMenuButton.addEventListener("click", requestProjectDeleteFromMenu);
  renameTabMenuButton.addEventListener("click", renameTabFromMenu);
  deleteTabMenuButton.addEventListener("click", requestTabDeleteFromMenu);
  editNoteTitleMenuButton.addEventListener("click", () => editNoteFromMenu("noteTitle"));
  editNoteContentMenuButton.addEventListener("click", () => editNoteFromMenu("noteContent"));
  deleteNoteMenuButton.addEventListener("click", deleteNotesFromMenu);
  editLinkNameMenuButton.addEventListener("click", () => editLinkFromMenu("name"));
  editLinkUrlMenuButton.addEventListener("click", () => editLinkFromMenu("url"));
  openLinkMenuButton.addEventListener("click", openLinkFromMenu);
  copyLinkMenuButton.addEventListener("click", copyLinkFromMenu);
  deleteLinkMenuButton.addEventListener("click", deleteLinkFromMenu);
  confirmDeleteLinkButton.addEventListener("click", confirmLinkDelete);
  confirmDeleteProjectButton.addEventListener("click", confirmProjectDelete);
  confirmDeleteTabButton.addEventListener("click", confirmTabDelete);
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement;
    if (
      contextMenus.contains(target) ||
      addTabMenu.contains(target) ||
      target === addTabButton ||
      target.closest(".project-item-menu-button")
    ) return;
    contextMenus.closeAll();
    closeAddTabMenu();
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (shouldRunAppUndo(
      event.key,
      event.ctrlKey,
      event.metaKey,
      event.shiftKey,
      target.tagName,
      target.isContentEditable,
    )) {
      event.preventDefault();
      void undoLast();
      return;
    }
    if (event.key !== "Escape") return;
    contextMenus.closeAll();
    closeAddTabMenu();
  });
  window.addEventListener("blur", () => {
    contextMenus.closeAll();
    closeAddTabMenu();
  });

  addTabButton.addEventListener("click", toggleAddTabMenu);
  addFolderTabButton.addEventListener("click", () => addTab("folder"));
  addLinksTabButton.addEventListener("click", () => addTab("links"));
  tabList.addEventListener("wheel", handleTabWheel, { passive: false });
  activeTabPath.addEventListener("dblclick", () => {
    if (activeTab()?.kind === "folder") startTabInlineEdit("tabFolder");
  });
  openFolderButton.addEventListener("click", openActiveFolder);
  addLinkButton.addEventListener("click", showAddLinkDialog);
  addLinksButton.addEventListener("click", showAddLinksDialog);
  confirmAddLinkButton.addEventListener("click", confirmAddLink);
  confirmAddLinksButton.addEventListener("click", confirmAddLinks);
  openFilesButton.addEventListener("click", openCheckedFiles);
  openSelectedButton.addEventListener("click", openSelectedPath);
  openStorageFolderButton.addEventListener("click", openStorageFolder);
  sortCustomButton.addEventListener("click", () => setProjectSortMode("custom"));
  sortCreatedButton.addEventListener("click", () => setProjectSortMode("created"));
  sortNameButton.addEventListener("click", () => setProjectSortMode("name"));
  await listenFolderChanged<FolderChangedPayload>(
    (payload) => {
      scheduleFolderRefresh(payload);
    },
    setLocalWebConnectionState,
  );

  await loadStorageInfo();
  await loadSidebarCollapsed();
  await loadNotePanelState();
  await loadProjectSortMode();
  await loadProjectCustomOrder();
  await loadWorkspace();
  },
  pageClosing: currentRuntime() === "local-web" ? notifyLocalWebPageClosing : undefined,
});

function setLocalWebConnectionState(state: LocalWebConnectionState) {
  if (currentRuntime() !== "local-web") return;
  if (runtimeCloseInProgress && state === "disconnected") {
    showLocalWebClosedState();
    return;
  }
  const disconnected = state === "disconnected";
  appShell.classList.toggle("is-local-web-disconnected", disconnected);
  localWebDisconnected.hidden = !disconnected;
  localWebDisconnected.setAttribute("aria-hidden", String(!disconnected));
  if (!disconnected) {
    localWebDisconnectedTitle.textContent = "Local Web disconnected";
    localWebDisconnectedDetail.textContent =
      "Restart WorkspaceTabs Local Web, then retry the connection.";
    retryLocalWebButton.hidden = false;
    retryLocalWebButton.disabled = false;
  }
}

function configureRuntimeCloseButton() {
  const copy = runtimeCloseCopy(currentRuntime());
  runtimeCloseLabel.textContent = copy.buttonLabel;
  runtimeCloseButton.title =
    currentRuntime() === "desktop"
      ? "Close the WorkspaceTabs Desktop window"
      : "Stop Local Web and disconnect all WorkspaceTabs browser tabs";
}

async function requestRuntimeClose() {
  if (!(await finishCurrentInlineEdit())) return;
  const copy = runtimeCloseCopy(currentRuntime());
  closeRuntimeDialogTitle.textContent = copy.title;
  closeRuntimeDialogDetail.textContent = copy.detail;
  confirmCloseRuntimeButton.textContent = copy.buttonLabel;
  dialogs.open("closeRuntime");
}

async function confirmRuntimeClose() {
  dialogs.close("closeRuntime");
  const isLocalWeb = currentRuntime() === "local-web";
  runtimeCloseInProgress = isLocalWeb;
  runtimeCloseButton.disabled = true;
  await runCommand(async () => {
    await closeWorkspaceRuntime();
    if (isLocalWeb) {
      showLocalWebClosedState();
      window.close();
    }
  });
  if (isLocalWeb && errorMessage !== null) {
    runtimeCloseInProgress = false;
    runtimeCloseButton.disabled = false;
  }
}

function showLocalWebClosedState() {
  appShell.classList.add("is-local-web-disconnected");
  localWebDisconnected.hidden = false;
  localWebDisconnected.setAttribute("aria-hidden", "false");
  localWebDisconnectedTitle.textContent = "WorkspaceTabs Local Web has closed.";
  localWebDisconnectedDetail.textContent = "You can close this browser tab.";
  retryLocalWebButton.hidden = true;
}

async function retryLocalWebConnection() {
  retryLocalWebButton.disabled = true;
  localWebDisconnectedDetail.textContent = "Checking the Local Web connection...";
  if (await localWebHealthAvailable()) {
    window.location.reload();
    return;
  }
  localWebDisconnectedDetail.textContent =
    "Local Web is still unavailable. Restart WorkspaceTabs Local Web, then retry.";
  retryLocalWebButton.disabled = false;
}

function handleTabWheel(event: WheelEvent) {
  if (tabBarRenderer.isDragging) return;
  const result = tabWheelScroll({
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    scrollLeft: tabList.scrollLeft,
    scrollWidth: tabList.scrollWidth,
    clientWidth: tabList.clientWidth,
  });
  if (!result.shouldHandle) return;

  event.preventDefault();
  tabList.scrollLeft = result.nextScrollLeft;
}

async function loadStorageInfo() {
  try {
    const info = await invoke<StorageInfoDto>("storage_info");
    const mode = info.mode === "portable" ? "Portable" : "AppData";
    storageMode.textContent = `Runtime: ${runtimeDisplayName(currentRuntime())} | Storage: ${mode}`;
    storagePath.textContent = info.database_path;
    storagePath.title = info.database_path;
  } catch (error) {
    storageMode.textContent = "Storage: Unknown";
    storagePath.textContent = String(error);
  }
}

async function loadProjectSortMode() {
  try {
    const mode = await invoke<string>("load_project_sort_mode");
    projectSortMode = normalizeProjectSortMode(mode);
  } catch {
    projectSortMode = "custom";
  }
}

async function loadProjectCustomOrder() {
  try {
    projectCustomOrder = await invoke<number[]>("load_project_custom_order");
  } catch {
    projectCustomOrder = [];
  }
}

async function loadSidebarCollapsed() {
  try {
    sidebarCollapsed = await invoke<boolean>("load_sidebar_collapsed");
  } catch {
    sidebarCollapsed = false;
  }
}

async function loadNotePanelState() {
  try {
    await notePanelController.load();
  } catch {
    notePanelController.replaceState({ customHeight: null, maximized: false });
  }
}

async function loadWorkspace() {
  await runCommand(async () => {
    await applicationController.invoke("workspace_snapshot");
    projectCustomOrder = projectCustomOrder.length === 0
      ? sortProjectsForDisplay(workspace.projects, projectSortMode).map((project) => project.id)
      : normalizeProjectCustomOrder(
          projectCustomOrder,
          workspace.projects.map((project) => project.id),
        );
    const restored = workspace.restored_session;
    viewStateController.state.activeProjectId = restored?.project.id ?? workspace.projects[0]?.id ?? null;
    viewStateController.state.activeTabId = restored?.active_tab?.id ?? activeProject()?.active_tab_id ?? null;
    viewStateController.state.projectSelection = emptyMultiSelection();
    viewStateController.state.noteSelection = emptyMultiSelection();
    resetTabSelectionToActive();
    syncFileSelectionFromActiveTab();
    await loadFilesForActiveTab();
  });
}

async function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  render();
  await runCommand(async () => {
    await invoke("save_sidebar_collapsed", { collapsed: sidebarCollapsed });
  });
}

async function toggleNotesSize() {
  await notePanelController.toggleExpanded();
  render();
}

function applyNotePanelHeight() {
  notePanelController.applyHeight();
}

function startNotesResize(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  notePanelController.startResize(event.pointerId, event.clientY);
  notesResizeHandle.setPointerCapture(event.pointerId);
}

function moveNotesResize(event: PointerEvent) {
  notePanelController.moveResize(event.pointerId, event.clientY);
}

async function finishNotesResize(event: PointerEvent) {
  if (!(await notePanelController.finishResize(event.pointerId))) return;
  if (notesResizeHandle.hasPointerCapture(event.pointerId)) {
    notesResizeHandle.releasePointerCapture(event.pointerId);
  }
  renderNotes();
}

async function resetNotesHeight() {
  await notePanelController.reset();
  renderNotes();
}

async function openStorageFolder() {
  await runCommand(async () => {
    await invoke("open_storage_folder");
  });
}

async function setProjectSortMode(mode: ProjectSortMode) {
  projectSortMode = mode;
  render();
  await runCommand(async () => {
    await applicationController.saveProjectSortMode(mode);
  });
}

async function createProject() {
  const name = projectNameInput.value.trim();
  const summary = projectSummaryInput.value.trim();
  if (!name) {
    errorMessage = "Project name is required.";
    render();
    return;
  }

  await runCommand(async () => {
    await applicationController.createProject(name, summary);
    const project = workspace.projects[workspace.projects.length - 1];
    projectCustomOrder = normalizeProjectCustomOrder(
      projectCustomOrder,
      workspace.projects.map((candidate) => candidate.id),
    );
    viewStateController.state.activeProjectId = project.id;
    viewStateController.state.activeTabId = project.active_tab_id;
    viewStateController.state.projectSelection = { selectedIds: [project.id], anchorId: project.id };
    viewStateController.state.noteSelection = emptyMultiSelection();
    resetTabSelectionToActive();
    files = [];
    viewStateController.state.fileSelection = initialFileSelectionState();
    previewText = "No preview";
    projectNameInput.value = "";
    projectSummaryInput.value = "";
    render();
    await persistProjectCustomOrder();
  });
}

function startProjectInlineEdit(
  field: InlineEditField,
  projectId = viewStateController.state.activeProjectId,
  surface: "active-header" | "project-list" = "active-header",
) {
  projectInteractionRevision += 1;
  const project =
    projectId === null ? null : workspace.projects.find((candidate) => candidate.id === projectId);
  if (!project) return;
  viewStateController.state.activeProjectId = project.id;
  viewStateController.state.activeTabId = project.active_tab_id ?? tabsForProject(project.id)[0]?.id ?? null;
  resetTabSelectionToActive();
  viewStateController.state.editingProjectId = project.id;
  viewStateController.state.projectEditSurface = surface;
  if (surface === "project-list") {
    suppressProjectClick = true;
    window.setTimeout(() => { suppressProjectClick = false; }, 250);
  }
  viewStateController.state.inlineEdit = startInlineEdit(field, projectInlineValue(project, field));
  syncFileSelectionFromActiveTab();
  render();
  if (surface === "project-list") {
    focusProjectListEditor(project.id, field);
  } else {
    focusInlineEditor(field);
  }
}

async function persistProjectCustomOrder() {
  await applicationController.saveProjectCustomOrder(projectCustomOrder);
}

async function commitProjectInlineEdit(value: string, cancel = false) {
  const project =
    viewStateController.state.editingProjectId === null
      ? activeProject()
      : workspace.projects.find((candidate) => candidate.id === viewStateController.state.editingProjectId);
  if (!project) return;
  const result = finishInlineEdit(viewStateController.state.inlineEdit, value, {
    cancel,
    required: viewStateController.state.inlineEdit.field === "projectName",
  });

  if (result.type === "cancel") {
    resetInlineEdit();
    render();
    return;
  }

  if (result.type === "invalid") {
    errorMessage = "Project name is required.";
    render();
    focusInlineEditor(viewStateController.state.inlineEdit.field);
    return;
  }

  await runCommand(async () => {
    await applicationController.updateProject(
      project.id,
      result.field === "projectName" ? result.value : project.name,
      result.field === "projectSummary" ? result.value : project.summary,
    );
    resetInlineEdit();
    render();
  });
}

function focusInlineEditor(field: InlineEditField | null) {
  if (!field) return;
  window.setTimeout(() => {
    const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[data-inline-field="${field}"]`,
    );
    input?.focus();
    input?.select();
  }, 0);
}

function focusActiveTabNameEditor() {
  window.setTimeout(() => {
    const input = activeTabName.querySelector<HTMLInputElement>(
      `[data-inline-field="tabName"]`,
    );
    input?.focus();
    input?.select();
  }, 0);
}

function focusProjectListEditor(projectId: number, field: InlineEditField) {
  const input = projectList.querySelector<HTMLInputElement>(
    `[data-project-id="${projectId}"] [data-inline-field="${field}"]`,
  );
  input?.focus();
  input?.select();
}

function resetInlineEdit() {
  viewStateController.resetEditing();
}

function requestActiveProjectDelete() {
  const project = activeProject();
  if (!project) return;
  requestProjectDelete(projectIdsForDelete(project.id));
}

function requestProjectDeleteFromMenu() {
  const projectId = contextMenus.target("project");
  if (projectId === null) return;
  closeProjectContextMenu();
  requestProjectDelete(projectIdsForDelete(projectId));
}

function projectIdsForDelete(fallbackProjectId: number) {
  return viewStateController.state.projectSelection.selectedIds.includes(fallbackProjectId)
    ? [...viewStateController.state.projectSelection.selectedIds]
    : [fallbackProjectId];
}

function requestProjectDelete(projectIds: number[]) {
  const projects = projectIds
    .map((projectId) => workspace.projects.find((candidate) => candidate.id === projectId))
    .filter((project): project is ProjectDto => Boolean(project));
  if (projects.length === 0) return;

  const confirmation = projectDeleteConfirmationForNames(projects.map((project) => project.name));
  deleteProjectDialogTitle.textContent = confirmation.title;
  deleteProjectDialogDetail.textContent = confirmation.detail;
  dialogs.open("deleteProject", projects.map((project) => project.id));
}

async function confirmProjectDelete() {
  const projectIds = dialogs.consumeTargets("deleteProject");
  if (projectIds.length === 0) return;
  dialogs.close("deleteProject");

  await runCommand(async () => {
    await applicationController.deleteProjects(projectIds);
    viewStateController.state.activeProjectId = workspace.restored_session?.project.id ?? workspace.projects[0]?.id ?? null;
    viewStateController.state.activeTabId = workspace.restored_session?.active_tab?.id ?? activeProject()?.active_tab_id ?? null;
    viewStateController.state.projectSelection = emptyMultiSelection();
    viewStateController.state.noteSelection = emptyMultiSelection();
    resetTabSelectionToActive();
    resetInlineEdit();
    previewText = "No preview";
    await loadFilesForActiveTab();
  });
}

async function addNote() {
  const project = activeProject();
  if (!project) return;

  await runCommand(async () => {
    await applicationController.addNote(project.id, "New Note", "");
    const note = activeNote();
    if (!note) return;
    viewStateController.state.noteSelection = { selectedIds: [note.id], anchorId: note.id };
    viewStateController.state.editingNoteId = note.id;
    viewStateController.state.inlineEdit = startInlineEdit("noteTitle", note.title);
    render();
    focusInlineEditor("noteTitle");
  });
}

function startNoteInlineEdit(field: "noteTitle" | "noteContent") {
  const note = activeNote();
  if (!note) return;
  viewStateController.state.editingNoteId = note.id;
  viewStateController.state.inlineEdit = startInlineEdit(field, field === "noteTitle" ? note.title : note.content);
  render();
  focusInlineEditor(field);
}

async function commitNoteInlineEdit(value: string, cancel = false) {
  const project = activeProject();
  const note = workspace.notes.find((candidate) => candidate.id === viewStateController.state.editingNoteId);
  if (!project || !note) return;
  const result = finishInlineEdit(viewStateController.state.inlineEdit, value, {
    cancel,
    required: viewStateController.state.inlineEdit.field === "noteTitle",
  });

  if (result.type === "cancel") {
    resetInlineEdit();
    render();
    return;
  }
  if (result.type === "invalid") {
    errorMessage = "Note title is required.";
    render();
    focusInlineEditor("noteTitle");
    return;
  }

  await runCommand(async () => {
    await applicationController.updateNote(
      project.id,
      note.id,
      result.field === "noteTitle" ? result.value : note.title,
      result.field === "noteContent" ? result.value : note.content,
    );
    resetInlineEdit();
    render();
  });
}

async function activateNote(noteId: number) {
  const project = activeProject();
  if (!project || project.active_note_id === noteId) return;
  if (!(await finishCurrentInlineEdit())) return;

  await runCommand(async () => {
    await applicationController.activateNote(project.id, noteId);
    render();
  });
}

async function selectNoteFromPointer(
  noteId: number,
  event: Pick<MouseEvent, "ctrlKey" | "metaKey" | "shiftKey">,
) {
  const project = activeProject();
  if (!project) return;
  const orderedIds = notesForProject(workspace.notes, project.id).map((note) => note.id);
  viewStateController.state.noteSelection = applyMultiSelection(viewStateController.state.noteSelection, orderedIds, noteId, {
    ctrlKey: event.ctrlKey || event.metaKey,
    shiftKey: event.shiftKey,
  });
  await activateNote(noteId);
  render();
}

function enqueueNoteInteraction(interaction: () => Promise<void> | void) {
  noteInteractionQueue = noteInteractionQueue
    .then(interaction)
    .catch((error) => {
      errorMessage = String(error);
      render();
    });
}

async function startNoteTitleEditFromList(noteId: number) {
  await activateNote(noteId);
  if (activeNote()?.id !== noteId) return;
  startNoteInlineEdit("noteTitle");
}

async function prepareNoteContextMenu(noteId: number, pointerX: number, pointerY: number) {
  if (!(await finishCurrentInlineEdit())) return;
  const selectedIds = noteContextSelection(viewStateController.state.noteSelection.selectedIds, noteId);
  viewStateController.state.noteSelection = { selectedIds, anchorId: noteId };
  await activateNote(noteId);
  if (activeNote()?.id !== noteId) return;
  render();
  openNoteContextMenu(noteId, pointerX, pointerY);
}

async function deleteActiveNote() {
  const note = activeNote();
  if (!note) return;
  const noteIds = viewStateController.state.noteSelection.selectedIds.length > 0 ? [...viewStateController.state.noteSelection.selectedIds] : [note.id];
  await deleteNotes(noteIds);
}

async function deleteNotes(noteIds: number[]) {
  const project = activeProject();
  if (!project) return;
  const notes = noteIds
    .map((noteId) => workspace.notes.find((candidate) => candidate.id === noteId))
    .filter(
      (candidate): candidate is NoteDto =>
        Boolean(candidate) && candidate?.project_id === project.id,
    );
  if (notes.length === 0) return;
  const confirmation =
    notes.length === 1
      ? `Delete the note "${notes[0].title}"?`
      : `Delete ${notes.length} notes?\n\n${notes.map((candidate) => candidate.title).join("\n")}`;
  if (!window.confirm(confirmation)) return;

  await runCommand(async () => {
    await applicationController.deleteNotes(
      project.id,
      notes.map((candidate) => candidate.id),
    );
    viewStateController.state.noteSelection = emptyMultiSelection();
    resetInlineEdit();
    render();
  });
}

async function undoLast() {
  if (!workspace.can_undo) return;

  await runCommand(async () => {
    await applicationController.invoke("undo_last");
    const restoredProjectId = workspace.restored_session?.project.id ?? workspace.projects[0]?.id ?? null;
    const restoredTabId = workspace.restored_session?.active_tab?.id ??
      workspace.projects.find((project) => project.id === restoredProjectId)?.active_tab_id ?? null;
    viewStateController.restoreAfterUndo(restoredProjectId, restoredTabId);
    syncFileSelectionFromActiveTab();
    previewText = "No preview";
    await loadFilesForActiveTab();
  });
}

function toggleAddTabMenu() {
  if (addTabButton.disabled) return;
  const open = tabCreationMenuOpenAfter(!addTabMenu.hidden, "toggle");
  addTabMenu.hidden = !open;
  addTabButton.setAttribute("aria-expanded", String(open));
  if (!addTabMenu.hidden) {
    positionAddTabMenu();
    addFolderTabButton.focus();
  }
}

function positionAddTabMenu() {
  if (addTabMenu.hidden) return;
  const button = addTabButton.getBoundingClientRect();
  const main = workspacePane.getBoundingClientRect();
  const menu = addTabMenu.getBoundingClientRect();
  const position = tabCreationMenuPosition(button, main, menu.width, menu.height);
  addTabMenu.style.left = `${position.left}px`;
  addTabMenu.style.top = `${position.top}px`;
  addTabMenu.dataset.placement = position.placement;
}

function closeAddTabMenu() {
  const open = tabCreationMenuOpenAfter(!addTabMenu.hidden, "dismiss");
  addTabMenu.hidden = !open;
  addTabButton.setAttribute("aria-expanded", String(open));
}

async function addTab(kind: "folder" | "links") {
  const project = activeProject();
  if (!project) {
    errorMessage = "Select a project first.";
    render();
    return;
  }
  closeAddTabMenu();

  await runCommand(async () => {
    const name = kind === "folder" ? DEFAULT_TAB_NAME : "New Links";
    if (kind === "folder") {
      await applicationController.addFolderTab(project.id, name, "");
    } else {
      await applicationController.addLinksTab(project.id, name);
    }
    const projectTabs = tabsForProject(project.id);
    viewStateController.state.activeTabId = projectTabs[projectTabs.length - 1]?.id ?? null;
    viewStateController.state.tabSelection = viewStateController.state.activeTabId === null
      ? emptyMultiSelection()
      : { selectedIds: [viewStateController.state.activeTabId], anchorId: viewStateController.state.activeTabId };
    if (viewStateController.state.activeTabId !== null) {
      await applicationController.activateTab(project.id, viewStateController.state.activeTabId);
    }
    previewText = "No preview";
    viewStateController.state.inlineEdit = startInlineEdit("tabName", name);
    viewStateController.state.tabNameEditSurface = "tab-bar";
    await loadFilesForActiveTab();
    focusInlineEditor("tabName");
  });
}

async function activateProject(projectId: number, shouldRender = true) {
  const nextTabId = workspace.projects.find((project) => project.id === projectId)?.active_tab_id ??
    tabsForProject(projectId)[0]?.id ?? null;
  viewStateController.activateProject(projectId, nextTabId);
  syncFileSelectionFromActiveTab();
  previewText = "No preview";
  await loadFilesForActiveTab(false);
  if (shouldRender) render();
}

async function selectProjectFromPointer(projectId: number, event: MouseEvent) {
  const orderedIds = sortProjectsForDisplay(workspace.projects, projectSortMode).map(
    (project) => project.id,
  );
  const nextSelection = applyMultiSelection(viewStateController.state.projectSelection, orderedIds, projectId, {
    ctrlKey: event.ctrlKey || event.metaKey,
    shiftKey: event.shiftKey,
  });
  const selectionUnchanged =
    nextSelection.anchorId === viewStateController.state.projectSelection.anchorId &&
    nextSelection.selectedIds.length === viewStateController.state.projectSelection.selectedIds.length &&
    nextSelection.selectedIds.every((id, index) => id === viewStateController.state.projectSelection.selectedIds[index]);
  if (viewStateController.state.activeProjectId === projectId && selectionUnchanged) return;

  const revision = ++projectInteractionRevision;
  viewStateController.state.projectSelection = nextSelection;
  await activateProject(projectId, false);
  if (revision !== projectInteractionRevision) return;
  render();
}

async function activateTab(tabId: number) {
  const project = activeProject();
  if (!project) return;

  await runCommand(async () => {
    await applicationController.activateTab(project.id, tabId);
    viewStateController.activateTab(tabId);
    syncFileSelectionFromActiveTab();
    previewText = "No preview";
    await loadFilesForActiveTab();
  });
}

function startTabInlineEdit(
  field: InlineEditField,
  tabId = viewStateController.state.activeTabId,
  surface: "tab-bar" | "active-header" = "tab-bar",
) {
  const tab = tabId === null ? null : workspace.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return;
  viewStateController.state.activeTabId = tab.id;
  viewStateController.state.tabNameEditSurface = surface;
  viewStateController.state.inlineEdit = startInlineEdit(field, tabInlineValue(tab, field));
  render();
  if (field === "tabName" && surface === "active-header") {
    focusActiveTabNameEditor();
  } else {
    focusInlineEditor(field);
  }
}

async function commitTabInlineEdit(value: string, cancel = false) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || !tab) return;
  const result = finishInlineEdit(viewStateController.state.inlineEdit, value, {
    cancel,
    required: viewStateController.state.inlineEdit.field === "tabName",
  });

  if (result.type === "cancel") {
    resetInlineEdit();
    viewStateController.state.tabNameEditSurface = "tab-bar";
    render();
    return;
  }

  if (result.type === "invalid") {
    errorMessage = "Tab name is required.";
    render();
    focusInlineEditor(viewStateController.state.inlineEdit.field);
    return;
  }

  await runCommand(async () => {
    viewStateController.state.editingLink = null;
    if (result.field === "tabName") {
      await applicationController.renameTab(project.id, tab.id, result.value);
    } else {
      await applicationController.updateFolderTab(
        project.id,
        tab.id,
        tabNameAfterFolderChange(tab.name, result.value),
        result.value,
      );
    }
    resetInlineEdit();
    viewStateController.state.tabNameEditSurface = "tab-bar";
    previewText = "No preview";
    syncFileSelectionFromActiveTab();
    await loadFilesForActiveTab();
  });
}

async function finishCurrentInlineEdit() {
  if (viewStateController.state.inlineEdit.field === null) return true;
  const value = currentInlineEditorValue();
  if (
    viewStateController.state.inlineEdit.field === "projectName" ||
    viewStateController.state.inlineEdit.field === "projectSummary"
  ) {
    await commitProjectInlineEdit(value);
  } else if (
    viewStateController.state.inlineEdit.field === "noteTitle" ||
    viewStateController.state.inlineEdit.field === "noteContent"
  ) {
    await commitNoteInlineEdit(value);
  } else {
    await commitTabInlineEdit(value);
  }
  return viewStateController.state.inlineEdit.field === null;
}

function currentInlineEditorValue() {
  const editor = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "[data-inline-field]",
  );
  return editor?.value ?? viewStateController.state.inlineEdit.draft;
}

async function deleteTabs(tabIds: number[]) {
  const project = activeProject();
  if (!project || tabIds.length === 0) return;

  await runCommand(async () => {
    await applicationController.deleteTabs(project.id, tabIds);
    if (viewStateController.state.activeTabId !== null && tabIds.includes(viewStateController.state.activeTabId)) {
      viewStateController.state.activeTabId = activeProject()?.active_tab_id ?? tabsForProject(project.id)[0]?.id ?? null;
    }
    viewStateController.state.tabSelection = viewStateController.state.activeTabId === null
      ? emptyMultiSelection()
      : { selectedIds: [viewStateController.state.activeTabId], anchorId: viewStateController.state.activeTabId };
    resetInlineEdit();
    syncFileSelectionFromActiveTab();
    previewText = "No preview";
    await loadFilesForActiveTab();
  });
}

async function moveTabs(tabIds: number[], targetIndex: number, draggedTabId: number) {
  const project = activeProject();
  if (!project) return;

  await runCommand(async () => {
    await applicationController.moveTabs(project.id, tabIds, targetIndex);
    viewStateController.state.activeTabId = draggedTabId;
    resetInlineEdit();
    syncFileSelectionFromActiveTab();
    await loadFilesForActiveTab();
  });
}

async function selectEntry(entry: FileEntryDto) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "folder") return;

  await runCommand(async () => {
    viewStateController.state.fileSelection = selectSingleFileEntry(viewStateController.state.fileSelection, {
      path: entry.path,
      isDir: entry.is_dir,
    });
    await applicationController.invoke("select_path", {
      projectId: project.id,
      tabId: tab.id,
      path: entry.path,
    });
    if (entry.is_dir) {
      previewText = "Folder selected.";
    } else {
      await previewCurrentSelection(false);
    }
    await loadFilesForActiveTab(false);
    render();
  });
}

async function persistCheckedEntries(nextState: FileSelectionState) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "folder") return;
  viewStateController.state.fileSelection = nextState;
  await runCommand(async () => {
    await applicationController.invoke("update_checked_paths", {
      projectId: project.id,
      tabId: tab.id,
      paths: viewStateController.state.fileSelection.selectedPaths,
    });
    render();
  });
}

async function toggleCheckedEntry(entry: FileEntryDto) {
  const nextState = toggleCheckedFileEntry(viewStateController.state.fileSelection, {
    path: entry.path,
    isDir: entry.is_dir,
  });
  await persistCheckedEntries(nextState);
}

async function checkEntryRange(entry: FileEntryDto) {
  const nextState = checkFileRange(
    viewStateController.state.fileSelection,
    files.map((candidate) => ({ path: candidate.path, isDir: candidate.is_dir })),
    { path: entry.path, isDir: entry.is_dir },
  );
  await persistCheckedEntries(nextState);
}

async function openEntry(entry: FileEntryDto) {
  const project = activeProject();
  if (!project) return;
  if (fileOpenAction({ path: entry.path, isDir: entry.is_dir }) === "openFolderExternally") {
    await runCommand(async () => {
      await invoke("open_folder", { folderPath: entry.path });
    });
    return;
  }
  await runCommand(async () => {
    await applicationController.invoke("open_file", {
      projectId: project.id,
      path: entry.path,
    });
    render();
  });
}

async function openActiveFolder() {
  const tab = activeTab();
  if (tab?.kind !== "folder" || !tab.folder_path) return;
  await runCommand(async () => {
    await invoke("open_folder", { folderPath: tab.folder_path });
  });
}

function openTabContextMenu(tabId: number, pointerX: number, pointerY: number) {
  deleteTabMenuButton.textContent = tabDeleteMenuLabel(tabIdsForDelete(tabId).length);
  contextMenus.open("tab", tabId, pointerX, pointerY);
}

function closeTabContextMenu() {
  contextMenus.close("tab");
}

async function renameTabFromMenu() {
  const tabId = contextMenus.target("tab");
  if (tabId === null) return;
  closeTabContextMenu();
  if (!(await finishCurrentInlineEdit())) return;
  startTabInlineEdit("tabName", tabId);
}

async function requestTabDeleteFromMenu() {
  const tabId = contextMenus.target("tab");
  if (tabId === null) return;
  closeTabContextMenu();
  if (!(await finishCurrentInlineEdit())) return;
  const tabIds = tabIdsForDelete(tabId);
  const tabs = tabsForProject(activeProject()?.id ?? -1).filter((tab) =>
    tabIds.includes(tab.id),
  );
  if (tabs.length === 0) return;
  const confirmation = tabDeleteConfirmationForTabs(tabs);
  deleteTabDialogTitle.textContent = confirmation.title;
  deleteTabDialogDetail.textContent = confirmation.detail;
  dialogs.open("deleteTab", tabs.map((tab) => tab.id));
}

async function confirmTabDelete() {
  const tabIds = dialogs.consumeTargets("deleteTab");
  if (tabIds.length === 0) return;
  dialogs.close("deleteTab");
  await deleteTabs(tabIds);
}

function tabIdsForDelete(fallbackTabId: number) {
  return viewStateController.state.tabSelection.selectedIds.includes(fallbackTabId)
    ? [...viewStateController.state.tabSelection.selectedIds]
    : [fallbackTabId];
}

function showAddLinksDialog() {
  if (activeTab()?.kind !== "links") return;
  addLinksInput.value = "";
  addLinksError.hidden = true;
  addLinksError.textContent = "";
  dialogs.open("addLinks");
  addLinksInput.focus();
}

function showAddLinkDialog() {
  if (activeTab()?.kind !== "links") return;
  addLinkName.value = "";
  addLinkUrl.value = "";
  addLinkError.hidden = true;
  addLinkError.textContent = "";
  dialogs.open("addLink");
  addLinkName.focus();
}

async function confirmAddLink() {
  const link = parseSingleLink(addLinkName.value, addLinkUrl.value);
  if (!link) {
    addLinkError.textContent = "Enter a valid HTTP or HTTPS URL.";
    addLinkError.hidden = false;
    return;
  }
  await addLinksToActiveTab([link], "addLink");
}

async function confirmAddLinks() {
  const parsed = parseLinkLines(addLinksInput.value);
  if (parsed.invalidLines.length > 0 || parsed.links.length === 0) {
    addLinksError.textContent =
      parsed.invalidLines.length > 0
        ? `Invalid: ${parsed.invalidLines.join(", ")}`
        : "Enter at least one URL.";
    addLinksError.hidden = false;
    return;
  }
  await addLinksToActiveTab(parsed.links, "addLinks");
}

async function addLinksToActiveTab(links: LinkInput[], dialog: "addLink" | "addLinks") {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links") return;
  await runCommand(async () => {
    await applicationController.invoke("add_links", {
      projectId: project.id,
      tabId: tab.id,
      links,
    });
    dialogs.close(dialog);
    render();
  });
}

function selectLink(link: LinkDto) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links") return Promise.resolve();
  showSelectedLinkImmediately(tab, link);

  linkSelectionQueue = linkSelectionQueue.then(() => runCommand(async () => {
    await applicationController.invoke("select_link", {
      projectId: project.id,
      tabId: tab.id,
      linkId: link.id,
    });
  }));
  return linkSelectionQueue;
}

function showSelectedLinkImmediately(tab: LinksTabDto, link: LinkDto) {
  const view = selectedLinkView(link);
  tab.selected_link_id = view.selectedLinkId;
  previewText = view.preview;
  fileList.querySelectorAll<HTMLElement>(".link-row").forEach((row) => {
    row.classList.toggle("is-current", Number(row.dataset.linkId) === link.id);
  });
  selectedPath.textContent = view.selectedUrl;
  previewContent.textContent = view.preview;
  openSelectedButton.disabled = false;
}

function scheduleLinkSelection(link: LinkDto) {
  void selectLink(link);
}

async function toggleCheckedLinkEntry(link: LinkDto) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links") return;
  const linkIds = toggleCheckedLink(tab.checked_link_ids, link.id);
  showSelectedLinkImmediately(tab, link);
  await runCommand(async () => {
    await applicationController.invoke("update_checked_links", {
      projectId: project.id,
      tabId: tab.id,
      linkIds,
    });
    await applicationController.invoke("select_link", {
      projectId: project.id,
      tabId: tab.id,
      linkId: link.id,
    });
    previewText = linkPreviewText(link);
    render();
  });
}

async function openLink(link: LinkDto) {
  await runCommand(async () => {
    await invoke("open_url", { url: link.url });
  });
}

async function copyLinkUrl(link: LinkDto) {
  try {
    await navigator.clipboard.writeText(link.url);
  } catch {
    const input = document.createElement("textarea");
    input.value = link.url;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  copiedLinkId = link.id;
  render();
  window.setTimeout(() => {
    if (copiedLinkId === link.id) {
      copiedLinkId = null;
      render();
    }
  }, 1200);
}

function startLinkEdit(link: LinkDto, field: "name" | "url") {
  viewStateController.state.editingLink = { id: link.id, field };
  render();
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLInputElement>(`[data-link-editor="${field}"]`)?.focus();
  });
}

async function commitLinkEdit(link: LinkDto, field: "name" | "url", value: string) {
  if (viewStateController.state.editingLink?.id !== link.id || viewStateController.state.editingLink.field !== field) return;
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links") return;
  viewStateController.state.editingLink = null;
  await runCommand(async () => {
    await applicationController.invoke("update_link", {
      projectId: project.id,
      tabId: tab.id,
      linkId: link.id,
      name: field === "name" ? value : link.name,
      url: field === "url" ? value : link.url,
    });
    const currentTab = activeTab();
    if (currentTab?.kind === "links" && currentTab.selected_link_id === link.id) {
      const updated = workspace.links.find((candidate) => candidate.id === link.id);
      if (updated) previewText = linkPreviewText(updated);
    }
    render();
  });
}

function openLinkContextMenu(link: LinkDto, pointerX: number, pointerY: number) {
  const tab = activeTab();
  const deleteCount = tab?.kind === "links"
    ? linkIdsForDelete(link.id, tab.checked_link_ids).length
    : 1;
  deleteLinkMenuButton.textContent = deleteCount === 1 ? "Delete Link" : `Delete ${deleteCount} Links`;
  contextMenus.open("link", link.id, pointerX, pointerY);
}

function closeLinkContextMenu() {
  contextMenus.close("link");
}

function linkFromMenu() {
  const linkId = contextMenus.target("link");
  return workspace.links.find((link) => link.id === linkId) ?? null;
}

function editLinkFromMenu(field: "name" | "url") {
  const link = linkFromMenu();
  closeLinkContextMenu();
  if (link) startLinkEdit(link, field);
}

async function openLinkFromMenu() {
  const link = linkFromMenu();
  closeLinkContextMenu();
  if (link) await openLink(link);
}

async function copyLinkFromMenu() {
  const link = linkFromMenu();
  closeLinkContextMenu();
  if (link) await copyLinkUrl(link);
}

async function deleteLinkFromMenu() {
  const link = linkFromMenu();
  closeLinkContextMenu();
  const tab = activeTab();
  if (link && tab?.kind === "links") {
    requestLinkDelete(linkIdsForDelete(link.id, tab.checked_link_ids));
  }
}

function requestLinkDelete(linkIds: number[]) {
  const links = linksForActiveTab().filter((link) => linkIds.includes(link.id));
  if (links.length === 0) return;
  const confirmation = linkDeleteConfirmation(links);
  deleteLinkDialogTitle.textContent = confirmation.title;
  deleteLinkDialogDetail.textContent = confirmation.detail;
  confirmDeleteLinkButton.textContent = confirmation.buttonLabel;
  dialogs.open("deleteLink", links.map((link) => link.id));
}

async function confirmLinkDelete() {
  const linkIds = dialogs.consumeTargets("deleteLink");
  if (linkIds.length === 0) return;
  dialogs.close("deleteLink");
  await deleteLinks(linkIds);
}

async function deleteLinks(linkIds: number[]) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links" || linkIds.length === 0) return;
  await runCommand(async () => {
    await applicationController.invoke("delete_links", {
      projectId: project.id,
      tabId: tab.id,
      linkIds,
    });
    previewText = "No preview";
    viewStateController.state.editingLink = null;
    render();
  });
}

async function moveLink(linkId: number, targetIndex: number) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links") return;
  await runCommand(async () => {
    await applicationController.invoke("move_link", {
      projectId: project.id,
      tabId: tab.id,
      linkId,
      targetIndex,
    });
    render();
  });
}

async function editProjectFromMenu(action: "rename" | "description") {
  const projectId = contextMenus.target("project");
  if (projectId === null) return;
  closeProjectContextMenu();
  if (!(await finishCurrentInlineEdit())) return;
  startProjectInlineEdit(projectMenuEditField(action), projectId, "project-list");
}

function openProjectContextMenu(
  projectId: number,
  pointerX: number,
  pointerY: number,
  alignRight = false,
) {
  deleteProjectMenuButton.textContent = projectDeleteMenuLabel(
    projectIdsForDelete(projectId).length,
  );
  contextMenus.open("project", projectId, pointerX, pointerY, { alignRight });
}

function closeProjectContextMenu() {
  contextMenus.close("project");
}

async function editNoteFromMenu(field: "noteTitle" | "noteContent") {
  const noteId = contextMenus.target("note");
  if (noteId === null) return;
  closeNoteContextMenu();
  await activateNote(noteId);
  if (activeNote()?.id !== noteId) return;
  startNoteInlineEdit(field);
}

async function deleteNotesFromMenu() {
  const noteId = contextMenus.target("note");
  if (noteId === null) return;
  const noteIds = noteContextSelection(viewStateController.state.noteSelection.selectedIds, noteId);
  closeNoteContextMenu();
  await deleteNotes(noteIds);
}

function openNoteContextMenu(noteId: number, pointerX: number, pointerY: number) {
  const noteIds = noteContextSelection(viewStateController.state.noteSelection.selectedIds, noteId);
  deleteNoteMenuButton.textContent = noteDeleteMenuLabel(noteIds.length);
  contextMenus.open("note", noteId, pointerX, pointerY);
}

function closeNoteContextMenu() {
  contextMenus.close("note");
}

async function openCheckedFiles() {
  const project = activeProject();
  const tab = activeTab();
  if (!project || !tab) return;
  if (tab.kind === "links") {
    for (const link of linksForActiveTab().filter((candidate) =>
      tab.checked_link_ids.includes(candidate.id),
    )) {
      await openLink(link);
    }
    return;
  }
  const paths = viewStateController.state.fileSelection.selectedPaths;
  if (paths.length === 0) {
    previewText = "Check one or more files first.";
    render();
    return;
  }

  await runCommand(async () => {
    for (const path of paths) {
      const entry = files.find((candidate) => candidate.path === path);
      if (entry?.is_dir) {
        await invoke("open_folder", { folderPath: path });
      } else {
        await applicationController.invoke("open_file", {
          projectId: project.id,
          path,
        });
      }
    }
    render();
  });
}

async function openSelectedPath() {
  const project = activeProject();
  const tab = activeTab();
  if (tab?.kind === "links") {
    const link = linksForActiveTab().find((candidate) => candidate.id === tab.selected_link_id);
    if (link) await openLink(link);
    return;
  }
  const path = viewStateController.state.fileSelection.selectedPath;
  if (!project || path === null) return;
  const selectedEntry = files.find((entry) => entry.path === path);

  await runCommand(async () => {
    if (selectedEntry?.is_dir) {
      await invoke("open_folder", { folderPath: path });
      return;
    }
    await applicationController.invoke("open_file", {
      projectId: project.id,
      path,
    });
    render();
  });
}

async function openRecentFile(path: string) {
  const project = activeProject();
  if (!project) return;

  await runCommand(async () => {
    await applicationController.invoke("open_file", {
      projectId: project.id,
      path,
    });
    render();
  });
}

async function previewCurrentSelection(shouldRender = true) {
  const path = previewTargetPath(viewStateController.state.fileSelection);
  if (!path) {
    previewText = "No preview";
    if (shouldRender) render();
    return;
  }

  const preview = await invoke<PreviewDto>("preview_file", { path });
  if (preview.content !== null) {
    previewText = preview.truncated
      ? `${preview.content}\n\n[Preview truncated]`
      : preview.content;
  } else {
    previewText = preview.message ?? "Preview unavailable.";
  }
  if (shouldRender) render();
}

function syncFileSelectionFromActiveTab() {
  const tab = activeTab();
  const selectedPath = tab?.kind === "folder" ? tab.selected_path : null;
  viewStateController.state.fileSelection = {
    ...viewStateController.state.fileSelection,
    selectedPath,
    selectedPaths: tab?.kind === "folder" ? tab.checked_paths : [],
  };
}

async function chooseFolderPath(defaultPath?: string) {
  return chooseDirectory(defaultPath);
}

async function chooseActiveTabFolder() {
  const tab = activeTab();
  if (tab?.kind !== "folder") return;
  const selected = await chooseFolderPath(folderDialogDefaultPath(tab.folder_path));
  if (selected !== null) {
    viewStateController.state.inlineEdit = startTabFolderEditForChoice(tab.folder_path);
    await commitTabInlineEdit(selected);
  }
}

async function loadFilesForActiveTab(shouldRender = true) {
  const tab = activeTab();
  if (!tab || tab.kind === "links" || !tab.folder_path) {
    await updateWatchedFolder("");
    files = [];
    if (shouldRender) render();
    return;
  }

  await updateWatchedFolder(tab.folder_path);
  try {
    files = await invoke<FileEntryDto[]>("list_folder", {
      folderPath: tab.folder_path,
    });
    await pruneMissingSelectionsForActiveTab(files);
    errorMessage = null;
  } catch (error) {
    files = [];
    errorMessage = String(error);
  }

  if (shouldRender) render();
}

async function updateWatchedFolder(folderPath: string) {
  try {
    await invoke("watch_folder", { folderPath });
  } catch {
    // Watching is best-effort. Manual refresh points still keep the UI usable.
  }
}

function scheduleFolderRefresh(payload: FolderChangedPayload) {
  const tab = activeTab();
  if (!shouldRefreshForFolderChange(tab?.kind === "folder" ? tab.folder_path : undefined, payload)) return;
  if (folderRefreshTimer !== null) {
    window.clearTimeout(folderRefreshTimer);
  }
  folderRefreshTimer = window.setTimeout(async () => {
    folderRefreshTimer = null;
    await loadFilesForActiveTab();
  }, 120);
}

async function pruneMissingSelectionsForActiveTab(entries: FileEntryDto[]) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "folder") return;

  const selectionEntries = entries.map((entry) => ({
    path: entry.path,
    isDir: entry.is_dir,
  }));
  const prunedCheckedPaths = pruneCheckedPaths(
    viewStateController.state.fileSelection.selectedPaths,
    selectionEntries,
  );
  const prunedSelectedPath = pruneSelectedPath(
    viewStateController.state.fileSelection.selectedPath,
    selectionEntries,
  );

  viewStateController.state.fileSelection = {
    ...viewStateController.state.fileSelection,
    selectedPath: prunedSelectedPath,
    selectedPaths: prunedCheckedPaths,
  };

  if (prunedSelectedPath !== tab.selected_path) {
    previewText = "No preview";
    await applicationController.invoke("clear_selected_path", {
      projectId: project.id,
      tabId: tab.id,
    });
  }

  if (prunedCheckedPaths.length !== tab.checked_paths.length) {
    await applicationController.invoke("update_checked_paths", {
      projectId: project.id,
      tabId: tab.id,
      paths: prunedCheckedPaths,
    });
  }
}

function render() {
  const project = activeProject();
  const tab = activeTab();
  const sidebar = sidebarView(sidebarCollapsed);

  appShell.className = sidebar.shellClassName;
  sidebarToggleButton.textContent = sidebar.toggleLabel;
  sidebarToggleButton.title = sidebar.toggleTitle;
  sidebarToggleButton.setAttribute("aria-label", sidebar.toggleTitle);
  undoButton.disabled = !workspace.can_undo;
  undoButton.title = undoTooltip(workspace.undo_kind);
  undoHint.textContent = undoHintText(workspace.undo_kind);
  deleteProjectButton.disabled = !project;
  addTabButton.disabled = !project;
  const isLinksTab = tab?.kind === "links";
  const activeLinks = linksForActiveTab();
  activeHeaderRenderer.render({
    project,
    tab,
    linksCount: activeLinks.length,
    inlineEdit: viewStateController.state.inlineEdit,
    projectEditSurface: viewStateController.state.projectEditSurface,
    tabNameEditSurface: viewStateController.state.tabNameEditSurface,
  }, {
    startProjectEdit: (field) => startProjectInlineEdit(field),
    startTabNameEdit: (tabId) => startTabInlineEdit("tabName", tabId, "active-header"),
    updateDraft: (value) => {
      viewStateController.state.inlineEdit = { ...viewStateController.state.inlineEdit, draft: value };
    },
    commitProjectEdit: (value, cancel) => { void commitProjectInlineEdit(value, cancel); },
    commitTabEdit: (value, cancel) => { void commitTabInlineEdit(value, cancel); },
    chooseFolder: () => { void chooseActiveTabFolder(); },
  });
  activityRenderer.render({
    tabKind: tab?.kind ?? null,
    checkedLinks: isLinksTab
      ? activeLinks.filter((link) => tab.checked_link_ids.includes(link.id))
      : [],
    selectedLink: isLinksTab
      ? activeLinks.find((link) => link.id === tab.selected_link_id) ?? null
      : null,
    fileSelection: viewStateController.state.fileSelection,
    previewText,
    recentFiles: workspace.recent_files,
  }, (path) => { void openRecentFile(path); });

  renderProjects();
  renderNotes();
  renderTabs();
  renderFiles();
}

function undoTooltip(kind: WorkspaceDto["undo_kind"]) {
  if (kind === "delete_project") return "Restore the deleted project registration";
  if (kind === "delete_tab") return "Restore the deleted tab registration";
  if (kind === "delete_note") return "Restore the deleted note";
  if (kind === "delete_link") return "Restore the deleted link";
  return "Nothing to undo";
}

function undoHintText(kind: WorkspaceDto["undo_kind"]) {
  if (kind === "delete_project") return "Deleted project can be restored";
  if (kind === "delete_tab") return "Deleted tab can be restored";
  if (kind === "delete_note") return "Deleted note can be restored";
  if (kind === "delete_link") return "Deleted link can be restored";
  return "";
}


function renderProjects() {
  projectListRenderer.render({
    projects: workspace.projects,
    activeProjectId: viewStateController.state.activeProjectId,
    selectedIds: viewStateController.state.projectSelection.selectedIds,
    sortMode: projectSortMode,
    customOrder: projectCustomOrder,
  }, {
    bindDrag: (item, projectId) => projectDragController.bind(item, projectId),
    bindInteractions: (item, projectId) => bindProjectItemInteractions(
      item,
      projectId,
      {
        hasActiveEdit: viewStateController.state.inlineEdit.field !== null,
        editingThisItem:
          viewStateController.state.projectEditSurface === "project-list" &&
          viewStateController.state.editingProjectId === projectId,
        suppressClick: () => {
          if (!suppressProjectClick) return false;
          suppressProjectClick = false;
          return true;
        },
      },
      {
        finishCurrentEdit: finishCurrentInlineEdit,
        selectFromPointer: selectProjectFromPointer,
        activate: activateProject,
        openContextMenu: openProjectContextMenu,
      },
    ),
    renderField: (project, field) => renderProjectListField(project as ProjectDto, field),
    createMenuButton: (project) => createProjectMenuButton(
      project.id,
      project.name,
      finishCurrentInlineEdit,
      openProjectContextMenu,
    ),
  });
}

function renderProjectListField(project: ProjectDto, field: InlineEditField) {
  return renderProjectListFieldElement(
    project,
    field,
    {
      inlineEdit: viewStateController.state.inlineEdit,
      editingProjectId: viewStateController.state.editingProjectId,
      editSurface: viewStateController.state.projectEditSurface,
    },
    {
      startEdit: (nextField, projectId) =>
        startProjectInlineEdit(nextField, projectId, "project-list"),
      updateDraft: (value) => { viewStateController.state.inlineEdit = { ...viewStateController.state.inlineEdit, draft: value }; },
      commitEdit: commitProjectInlineEdit,
      isEditing: (projectId, nextField) =>
        viewStateController.state.inlineEdit.field === nextField &&
        viewStateController.state.editingProjectId === projectId &&
        viewStateController.state.projectEditSurface === "project-list",
    },
  );
}

function projectInlineValue(project: ProjectDto, field: InlineEditField) {
  if (field === "projectName") return project.name;
  return project.summary;
}

function renderNotes() {
  const project = activeProject();
  const projectNotes = project ? notesForProject(workspace.notes, project.id) : [];
  const note = activeNote();
  notePanelRenderer.render(
    {
      hasProject: Boolean(project),
      notes: projectNotes,
      activeNote: note,
      selectedIds: viewStateController.state.noteSelection.selectedIds,
      panelState: notePanelController.state,
      inlineEdit: viewStateController.state.inlineEdit,
      editingNoteId: viewStateController.state.editingNoteId,
    },
    {
      applyHeight: applyNotePanelHeight,
      enqueue: enqueueNoteInteraction,
      finishCurrentEdit: finishCurrentInlineEdit,
      selectFromPointer: selectNoteFromPointer,
      startTitleEditFromList: startNoteTitleEditFromList,
      prepareContextMenu: prepareNoteContextMenu,
      startEdit: startNoteInlineEdit,
      updateDraft: (value) => {
        viewStateController.state.inlineEdit = { ...viewStateController.state.inlineEdit, draft: value };
      },
      commitEdit: commitNoteInlineEdit,
      isEditing: (noteId, field) =>
        viewStateController.state.inlineEdit.field === field && viewStateController.state.editingNoteId === noteId,
    },
  );
}

function tabInlineValue(tab: TabDto, field: InlineEditField) {
  if (field === "tabName") return tab.name;
  if (field === "tabFolder") return tab.kind === "folder" ? tab.folder_path : "";
  return "";
}

function renderTabs() {
  const project = activeProject();
  const tabs = project ? tabsForProject(project.id) : [];
  tabBarRenderer.render(
    {
      tabs,
      activeTabId: viewStateController.state.activeTabId,
      selection: viewStateController.state.tabSelection,
      inlineEdit: viewStateController.state.inlineEdit,
      editSurface: viewStateController.state.tabNameEditSurface,
    },
    {
      getActiveTabId: () => viewStateController.state.activeTabId,
      getSelection: () => viewStateController.state.tabSelection,
      setSelection: (selection) => { viewStateController.state.tabSelection = selection; },
      startNameEdit: (tabId) => startTabInlineEdit("tabName", tabId),
      updateDraft: (value) => { viewStateController.state.inlineEdit = { ...viewStateController.state.inlineEdit, draft: value }; },
      commitEdit: commitTabInlineEdit,
      isNameEditing: (tabId) =>
        viewStateController.state.inlineEdit.field === "tabName" &&
        viewStateController.state.activeTabId === tabId &&
        viewStateController.state.tabNameEditSurface === "tab-bar",
      finishCurrentEdit: finishCurrentInlineEdit,
      activate: activateTab,
      move: moveTabs,
      openContextMenu: openTabContextMenu,
      render,
    },
  );
}

function renderFiles() {
  if (activeTab()?.kind === "links") {
    renderLinks();
    return;
  }
  const tab = activeTab();
  folderListRenderer.render(
    {
      entries: files,
      selection: viewStateController.state.fileSelection,
      errorMessage,
      hasActiveTab: Boolean(tab),
      folderPath: tab?.kind === "folder" ? tab.folder_path : undefined,
    },
    {
      scheduleTooltip: scheduleFileTooltip,
      hideTooltip: hideFileTooltip,
      toggleChecked: (entry) => { void toggleCheckedEntry(entry); },
      checkRange: (entry) => { void checkEntryRange(entry); },
      open: (entry) => { void openEntry(entry); },
      select: (entry) => { void selectEntry(entry); },
    },
  );
}

function scheduleFileTooltip(anchor: HTMLElement, text: string) {
  hideFileTooltip();
  fileTooltipTimer = window.setTimeout(() => {
    showFileTooltip(anchor, text);
  }, 150);
}

function showFileTooltip(anchor: HTMLElement, text: string) {
  fileTooltip.textContent = text;
  fileTooltip.classList.add("is-visible");

  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = fileTooltip.getBoundingClientRect();
  const gap = 8;
  const margin = 8;
  const maxLeft = window.innerWidth - tooltipRect.width - margin;
  const left = Math.max(margin, Math.min(anchorRect.right - tooltipRect.width, maxLeft));
  const top = Math.max(margin, anchorRect.top - tooltipRect.height - gap);

  fileTooltip.style.left = `${left}px`;
  fileTooltip.style.top = `${top}px`;
}

function hideFileTooltip() {
  if (fileTooltipTimer !== null) {
    window.clearTimeout(fileTooltipTimer);
    fileTooltipTimer = null;
  }
  fileTooltip.classList.remove("is-visible");
}

function resetTabSelectionToActive() {
  viewStateController.state.tabSelection = viewStateController.state.activeTabId === null
    ? emptyMultiSelection()
    : { selectedIds: [viewStateController.state.activeTabId], anchorId: viewStateController.state.activeTabId };
}

function renderLinks() {
  const tab = activeTab();
  if (!tab || tab.kind !== "links") return;
  const links = linksForActiveTab();
  linksRenderer.render(
    {
      links,
      selectedLinkId: tab.selected_link_id,
      checkedLinkIds: tab.checked_link_ids,
      editing: viewStateController.state.editingLink,
      copiedLinkId,
      errorMessage,
    },
    {
      toggleChecked: (link) => { void toggleCheckedLinkEntry(link); },
      select: scheduleLinkSelection,
      open: (link) => { void openLink(link); },
      copy: (link) => { void copyLinkUrl(link); },
      startEdit: startLinkEdit,
      cancelEdit: () => {
        viewStateController.state.editingLink = null;
        render();
      },
      commitEdit: (link, field, value) => { void commitLinkEdit(link, field, value); },
      openContextMenu: openLinkContextMenu,
      move: (linkId, targetIndex) => { void moveLink(linkId, targetIndex); },
    },
  );
}

async function runCommand(command: () => Promise<void>) {
  errorMessage = null;
  await applicationController.execute(command);
}

function activeProject() {
  return workspace.projects.find((project) => project.id === viewStateController.state.activeProjectId) ?? null;
}

function activeTab() {
  return workspace.tabs.find((tab) => tab.id === viewStateController.state.activeTabId) ?? null;
}

function activeNote() {
  const project = activeProject();
  if (!project) return null;
  return activeNoteForProject(workspace.notes, project.id, project.active_note_id);
}

function tabsForProject(projectId: number) {
  return workspace.tabs
    .filter((tab) => tab.project_id === projectId)
    .sort((left, right) => left.position - right.position);
}

function linksForActiveTab() {
  if (viewStateController.state.activeTabId === null) return [];
  return workspace.links
    .filter((link) => link.tab_id === viewStateController.state.activeTabId)
    .sort((left, right) => left.position - right.position);
}

function element<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) {
    throw new Error(`Missing element: ${selector}`);
  }
  return node;
}
