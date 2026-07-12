import {
  checkFileRange,
  fileEntryVisual,
  fileOpenAction,
  fileRowTooltip,
  initialFileSelectionState,
  previewTargetPath,
  pruneCheckedPaths,
  pruneSelectedPath,
  selectSingleFileEntry,
  shouldShowSelectionCheckbox,
  toggleCheckedFileEntry,
  type FileSelectionState,
} from "./fileSelection";
import {
  linkClickAction,
  linkDeleteConfirmation,
  linkEditField,
  linkIdsForDelete,
  linkPreviewText,
  parseLinkLines,
  parseSingleLink,
  selectedLinkView,
  toggleCheckedLink,
  type LinkInput,
} from "./links";
import { shouldRunAppUndo } from "./keyboard";
import {
  emptyTabFolderPrompt,
  emptyInlineEditState,
  finishInlineEdit,
  shouldShowInlineEditPlaceholder,
  startInlineEdit,
  startTabFolderEditForChoice,
  type InlineEditField,
  type InlineEditState,
} from "./inlineEdit";
import { fileNoticeForActiveTab } from "./fileNotice";
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
import { renderProjectListField as renderProjectListFieldElement } from "./projectListFieldRenderer";
import {
  Folder as FolderIcon,
  File as FileIcon,
  createElement as createLucideElement,
} from "lucide";
import {
  projectDeleteConfirmationForNames,
  projectDeleteMenuLabel,
  projectMenuEditField,
  projectMenuPosition,
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
  type MultiSelectionState,
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

let activeProjectId: number | null = null;
let activeTabId: number | null = null;
let files: FileEntryDto[] = [];
let errorMessage: string | null = null;
let previewText = "No preview";
let inlineEditState: InlineEditState = emptyInlineEditState();
let editingProjectId: number | null = null;
let editingNoteId: number | null = null;
let projectEditSurface: "active-header" | "project-list" = "active-header";
let tabNameEditSurface: "tab-bar" | "active-header" = "tab-bar";
let fileSelectionState: FileSelectionState = initialFileSelectionState();
let projectSortMode: ProjectSortMode = "custom";
let projectCustomOrder: number[] = [];
let suppressProjectClick = false;
let sidebarCollapsed = false;
let projectSelection: MultiSelectionState = emptyMultiSelection();
let noteSelection: MultiSelectionState = emptyMultiSelection();
let tabSelection: MultiSelectionState = emptyMultiSelection();
let noteInteractionQueue: Promise<void> = Promise.resolve();
let folderRefreshTimer: number | null = null;
let fileTooltipTimer: number | null = null;
let projectMenuProjectId: number | null = null;
let noteMenuNoteId: number | null = null;
let linkMenuLinkId: number | null = null;
let tabMenuTabId: number | null = null;
let editingLink: { id: number; field: "name" | "url" } | null = null;
let copiedLinkId: number | null = null;
let draggedLinkId: number | null = null;
let linkSelectionQueue: Promise<void> = Promise.resolve();
let pendingDeleteProjectIds: number[] = [];
let pendingDeleteTabIds: number[] = [];
let pendingDeleteLinkIds: number[] = [];
let runtimeCloseInProgress = false;

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
const projectDragController = new ProjectDragController(projectList, {
  getState: () => ({
    sortMode: projectSortMode,
    inlineEditing: inlineEditState.field !== null,
    selection: projectSelection,
    projectIds: workspace.projects.map((project) => project.id),
    customOrder: projectCustomOrder,
  }),
  setCustomOrder: (order) => { projectCustomOrder = order; },
  setClickSuppressed: (suppressed) => { suppressProjectClick = suppressed; },
  render,
  persist: () => runCommand(persistProjectCustomOrder),
});

window.addEventListener("DOMContentLoaded", async () => {
  document.body.append(addTabMenu);
  configureRuntimeCloseButton();
  runtimeCloseButton.addEventListener("click", requestRuntimeClose);
  confirmCloseRuntimeButton.addEventListener("click", confirmRuntimeClose);
  retryLocalWebButton.addEventListener("click", retryLocalWebConnection);
  if (currentRuntime() === "local-web") {
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) notifyLocalWebPageClosing();
    });
  }
  projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createProject();
  });

  activeProjectName.addEventListener("dblclick", () => startProjectInlineEdit("projectName"));
  activeProjectSummary.addEventListener("dblclick", () => startProjectInlineEdit("projectSummary"));
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
  deleteProjectDialog.addEventListener("close", () => {
    pendingDeleteProjectIds = [];
  });
  deleteTabDialog.addEventListener("close", () => {
    pendingDeleteTabIds = [];
  });
  deleteLinkDialog.addEventListener("close", () => {
    pendingDeleteLinkIds = [];
  });
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement;
    if (
      projectContextMenu.contains(target) ||
      noteContextMenu.contains(target) ||
      linkContextMenu.contains(target) ||
      tabContextMenu.contains(target) ||
      addTabMenu.contains(target) ||
      target === addTabButton ||
      target.closest(".project-item-menu-button")
    ) return;
    closeProjectContextMenu();
    closeNoteContextMenu();
    closeLinkContextMenu();
    closeTabContextMenu();
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
    closeProjectContextMenu();
    closeNoteContextMenu();
    closeLinkContextMenu();
    closeTabContextMenu();
    closeAddTabMenu();
  });
  window.addEventListener("blur", () => {
    closeProjectContextMenu();
    closeNoteContextMenu();
    closeLinkContextMenu();
    closeTabContextMenu();
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
  if (!closeRuntimeDialog.open) closeRuntimeDialog.showModal();
}

async function confirmRuntimeClose() {
  closeRuntimeDialog.close();
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
    workspace = await invoke<WorkspaceDto>("workspace_snapshot");
    projectCustomOrder = projectCustomOrder.length === 0
      ? sortProjectsForDisplay(workspace.projects, projectSortMode).map((project) => project.id)
      : normalizeProjectCustomOrder(
          projectCustomOrder,
          workspace.projects.map((project) => project.id),
        );
    const restored = workspace.restored_session;
    activeProjectId = restored?.project.id ?? workspace.projects[0]?.id ?? null;
    activeTabId = restored?.active_tab?.id ?? activeProject()?.active_tab_id ?? null;
    projectSelection = emptyMultiSelection();
    noteSelection = emptyMultiSelection();
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
    await projectsApi.saveSortMode(mode);
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
    workspace = await projectsApi.create(name, summary);
    const project = workspace.projects[workspace.projects.length - 1];
    projectCustomOrder = normalizeProjectCustomOrder(
      projectCustomOrder,
      workspace.projects.map((candidate) => candidate.id),
    );
    activeProjectId = project.id;
    activeTabId = project.active_tab_id;
    projectSelection = { selectedIds: [project.id], anchorId: project.id };
    noteSelection = emptyMultiSelection();
    resetTabSelectionToActive();
    files = [];
    fileSelectionState = initialFileSelectionState();
    previewText = "No preview";
    projectNameInput.value = "";
    projectSummaryInput.value = "";
    render();
    await persistProjectCustomOrder();
  });
}

function startProjectInlineEdit(
  field: InlineEditField,
  projectId = activeProjectId,
  surface: "active-header" | "project-list" = "active-header",
) {
  const project =
    projectId === null ? null : workspace.projects.find((candidate) => candidate.id === projectId);
  if (!project) return;
  activeProjectId = project.id;
  activeTabId = project.active_tab_id ?? tabsForProject(project.id)[0]?.id ?? null;
  resetTabSelectionToActive();
  editingProjectId = project.id;
  projectEditSurface = surface;
  inlineEditState = startInlineEdit(field, projectInlineValue(project, field));
  syncFileSelectionFromActiveTab();
  render();
  if (surface === "project-list") {
    focusProjectListEditor(project.id, field);
  } else {
    focusInlineEditor(field);
  }
}

async function persistProjectCustomOrder() {
  await projectsApi.saveCustomOrder(projectCustomOrder);
}

async function commitProjectInlineEdit(value: string, cancel = false) {
  const project =
    editingProjectId === null
      ? activeProject()
      : workspace.projects.find((candidate) => candidate.id === editingProjectId);
  if (!project) return;
  const result = finishInlineEdit(inlineEditState, value, {
    cancel,
    required: inlineEditState.field === "projectName",
  });

  if (result.type === "cancel") {
    resetInlineEdit();
    render();
    return;
  }

  if (result.type === "invalid") {
    errorMessage = "Project name is required.";
    render();
    focusInlineEditor(inlineEditState.field);
    return;
  }

  await runCommand(async () => {
    workspace = await projectsApi.update(
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
  window.setTimeout(() => {
    const input = projectList.querySelector<HTMLInputElement>(
      `[data-project-id="${projectId}"] [data-inline-field="${field}"]`,
    );
    input?.focus();
    input?.select();
  }, 0);
}

function resetInlineEdit() {
  inlineEditState = emptyInlineEditState();
  editingProjectId = null;
  editingNoteId = null;
  projectEditSurface = "active-header";
  tabNameEditSurface = "tab-bar";
}

function requestActiveProjectDelete() {
  const project = activeProject();
  if (!project) return;
  requestProjectDelete(projectIdsForDelete(project.id));
}

function requestProjectDeleteFromMenu() {
  if (projectMenuProjectId === null) return;
  const projectId = projectMenuProjectId;
  closeProjectContextMenu();
  requestProjectDelete(projectIdsForDelete(projectId));
}

function projectIdsForDelete(fallbackProjectId: number) {
  return projectSelection.selectedIds.includes(fallbackProjectId)
    ? [...projectSelection.selectedIds]
    : [fallbackProjectId];
}

function requestProjectDelete(projectIds: number[]) {
  const projects = projectIds
    .map((projectId) => workspace.projects.find((candidate) => candidate.id === projectId))
    .filter((project): project is ProjectDto => Boolean(project));
  if (projects.length === 0) return;

  pendingDeleteProjectIds = projects.map((project) => project.id);
  const confirmation = projectDeleteConfirmationForNames(projects.map((project) => project.name));
  deleteProjectDialogTitle.textContent = confirmation.title;
  deleteProjectDialogDetail.textContent = confirmation.detail;
  if (!deleteProjectDialog.open) {
    deleteProjectDialog.showModal();
  }
}

async function confirmProjectDelete() {
  if (pendingDeleteProjectIds.length === 0) return;
  const projectIds = [...pendingDeleteProjectIds];
  pendingDeleteProjectIds = [];
  deleteProjectDialog.close();

  await runCommand(async () => {
    workspace = await projectsApi.deleteMany(projectIds);
    activeProjectId = workspace.restored_session?.project.id ?? workspace.projects[0]?.id ?? null;
    activeTabId = workspace.restored_session?.active_tab?.id ?? activeProject()?.active_tab_id ?? null;
    projectSelection = emptyMultiSelection();
    noteSelection = emptyMultiSelection();
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
    workspace = await notesApi.add(project.id, "New Note", "");
    const note = activeNote();
    if (!note) return;
    noteSelection = { selectedIds: [note.id], anchorId: note.id };
    editingNoteId = note.id;
    inlineEditState = startInlineEdit("noteTitle", note.title);
    render();
    focusInlineEditor("noteTitle");
  });
}

function startNoteInlineEdit(field: "noteTitle" | "noteContent") {
  const note = activeNote();
  if (!note) return;
  editingNoteId = note.id;
  inlineEditState = startInlineEdit(field, field === "noteTitle" ? note.title : note.content);
  render();
  focusInlineEditor(field);
}

async function commitNoteInlineEdit(value: string, cancel = false) {
  const project = activeProject();
  const note = workspace.notes.find((candidate) => candidate.id === editingNoteId);
  if (!project || !note) return;
  const result = finishInlineEdit(inlineEditState, value, {
    cancel,
    required: inlineEditState.field === "noteTitle",
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
    workspace = await notesApi.update(
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
    workspace = await notesApi.activate(project.id, noteId);
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
  noteSelection = applyMultiSelection(noteSelection, orderedIds, noteId, {
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
  const selectedIds = noteContextSelection(noteSelection.selectedIds, noteId);
  noteSelection = { selectedIds, anchorId: noteId };
  await activateNote(noteId);
  if (activeNote()?.id !== noteId) return;
  render();
  openNoteContextMenu(noteId, pointerX, pointerY);
}

async function deleteActiveNote() {
  const note = activeNote();
  if (!note) return;
  const noteIds = noteSelection.selectedIds.length > 0 ? [...noteSelection.selectedIds] : [note.id];
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
    workspace = await notesApi.deleteMany(
      project.id,
      notes.map((candidate) => candidate.id),
    );
    noteSelection = emptyMultiSelection();
    resetInlineEdit();
    render();
  });
}

async function undoLast() {
  if (!workspace.can_undo) return;

  await runCommand(async () => {
    workspace = await invoke<WorkspaceDto>("undo_last");
    activeProjectId = workspace.restored_session?.project.id ?? workspace.projects[0]?.id ?? null;
    activeTabId = workspace.restored_session?.active_tab?.id ?? activeProject()?.active_tab_id ?? null;
    projectSelection = emptyMultiSelection();
    noteSelection = emptyMultiSelection();
    resetTabSelectionToActive();
    resetInlineEdit();
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
    workspace =
      kind === "folder"
        ? await tabsApi.addFolder(project.id, name, "")
        : await tabsApi.addLinks(project.id, name);
    const projectTabs = tabsForProject(project.id);
    activeTabId = projectTabs[projectTabs.length - 1]?.id ?? null;
    tabSelection = activeTabId === null
      ? emptyMultiSelection()
      : { selectedIds: [activeTabId], anchorId: activeTabId };
    if (activeTabId !== null) {
      workspace = await tabsApi.activate(project.id, activeTabId);
    }
    previewText = "No preview";
    inlineEditState = startInlineEdit("tabName", name);
    tabNameEditSurface = "tab-bar";
    await loadFilesForActiveTab();
    focusInlineEditor("tabName");
  });
}

async function activateProject(projectId: number) {
  const projectChanged = activeProjectId !== projectId;
  activeProjectId = projectId;
  activeTabId = activeProject()?.active_tab_id ?? tabsForProject(projectId)[0]?.id ?? null;
  resetInlineEdit();
  editingLink = null;
  if (projectChanged) {
    noteSelection = emptyMultiSelection();
    tabSelection = activeTabId === null
      ? emptyMultiSelection()
      : { selectedIds: [activeTabId], anchorId: activeTabId };
  }
  syncFileSelectionFromActiveTab();
  previewText = "No preview";
  await loadFilesForActiveTab();
}

async function selectProjectFromPointer(projectId: number, event: MouseEvent) {
  const orderedIds = sortProjectsForDisplay(workspace.projects, projectSortMode).map(
    (project) => project.id,
  );
  projectSelection = applyMultiSelection(projectSelection, orderedIds, projectId, {
    ctrlKey: event.ctrlKey || event.metaKey,
    shiftKey: event.shiftKey,
  });
  await activateProject(projectId);
  render();
}

async function activateTab(tabId: number) {
  const project = activeProject();
  if (!project) return;

  await runCommand(async () => {
    workspace = await tabsApi.activate(project.id, tabId);
    activeTabId = tabId;
    resetInlineEdit();
    syncFileSelectionFromActiveTab();
    previewText = "No preview";
    await loadFilesForActiveTab();
  });
}

function startTabInlineEdit(
  field: InlineEditField,
  tabId = activeTabId,
  surface: "tab-bar" | "active-header" = "tab-bar",
) {
  const tab = tabId === null ? null : workspace.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return;
  activeTabId = tab.id;
  tabNameEditSurface = surface;
  inlineEditState = startInlineEdit(field, tabInlineValue(tab, field));
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
  const result = finishInlineEdit(inlineEditState, value, {
    cancel,
    required: inlineEditState.field === "tabName",
  });

  if (result.type === "cancel") {
    resetInlineEdit();
    tabNameEditSurface = "tab-bar";
    render();
    return;
  }

  if (result.type === "invalid") {
    errorMessage = "Tab name is required.";
    render();
    focusInlineEditor(inlineEditState.field);
    return;
  }

  await runCommand(async () => {
    editingLink = null;
    workspace =
      result.field === "tabName"
        ? await tabsApi.rename(project.id, tab.id, result.value)
        : await tabsApi.updateFolder(
            project.id,
            tab.id,
            tabNameAfterFolderChange(tab.name, result.value),
            result.value,
          );
    resetInlineEdit();
    tabNameEditSurface = "tab-bar";
    previewText = "No preview";
    syncFileSelectionFromActiveTab();
    await loadFilesForActiveTab();
  });
}

async function finishCurrentInlineEdit() {
  if (inlineEditState.field === null) return true;
  const value = currentInlineEditorValue();
  if (
    inlineEditState.field === "projectName" ||
    inlineEditState.field === "projectSummary"
  ) {
    await commitProjectInlineEdit(value);
  } else if (
    inlineEditState.field === "noteTitle" ||
    inlineEditState.field === "noteContent"
  ) {
    await commitNoteInlineEdit(value);
  } else {
    await commitTabInlineEdit(value);
  }
  return inlineEditState.field === null;
}

function currentInlineEditorValue() {
  const editor = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "[data-inline-field]",
  );
  return editor?.value ?? inlineEditState.draft;
}

async function deleteTabs(tabIds: number[]) {
  const project = activeProject();
  if (!project || tabIds.length === 0) return;

  await runCommand(async () => {
    workspace = await tabsApi.deleteMany(project.id, tabIds);
    if (activeTabId !== null && tabIds.includes(activeTabId)) {
      activeTabId = activeProject()?.active_tab_id ?? tabsForProject(project.id)[0]?.id ?? null;
    }
    tabSelection = activeTabId === null
      ? emptyMultiSelection()
      : { selectedIds: [activeTabId], anchorId: activeTabId };
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
    workspace = await tabsApi.moveMany(project.id, tabIds, targetIndex);
    activeTabId = draggedTabId;
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
    fileSelectionState = selectSingleFileEntry(fileSelectionState, {
      path: entry.path,
      isDir: entry.is_dir,
    });
    workspace = await invoke<WorkspaceDto>("select_path", {
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
  fileSelectionState = nextState;
  await runCommand(async () => {
    workspace = await invoke<WorkspaceDto>("update_checked_paths", {
      projectId: project.id,
      tabId: tab.id,
      paths: fileSelectionState.selectedPaths,
    });
    render();
  });
}

async function toggleCheckedEntry(entry: FileEntryDto) {
  const nextState = toggleCheckedFileEntry(fileSelectionState, {
    path: entry.path,
    isDir: entry.is_dir,
  });
  await persistCheckedEntries(nextState);
}

async function checkEntryRange(entry: FileEntryDto) {
  const nextState = checkFileRange(
    fileSelectionState,
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
    workspace = await invoke<WorkspaceDto>("open_file", {
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
  closeProjectContextMenu();
  closeNoteContextMenu();
  closeLinkContextMenu();
  tabMenuTabId = tabId;
  deleteTabMenuButton.textContent = tabDeleteMenuLabel(tabIdsForDelete(tabId).length);
  tabContextMenu.hidden = false;
  const position = projectMenuPosition({
    pointerX,
    pointerY,
    menuWidth: tabContextMenu.offsetWidth,
    menuHeight: tabContextMenu.offsetHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  tabContextMenu.style.left = `${position.left}px`;
  tabContextMenu.style.top = `${position.top}px`;
  renameTabMenuButton.focus();
}

function closeTabContextMenu() {
  tabMenuTabId = null;
  tabContextMenu.hidden = true;
}

async function renameTabFromMenu() {
  if (tabMenuTabId === null) return;
  const tabId = tabMenuTabId;
  closeTabContextMenu();
  if (!(await finishCurrentInlineEdit())) return;
  startTabInlineEdit("tabName", tabId);
}

async function requestTabDeleteFromMenu() {
  if (tabMenuTabId === null) return;
  const tabId = tabMenuTabId;
  closeTabContextMenu();
  if (!(await finishCurrentInlineEdit())) return;
  const tabIds = tabIdsForDelete(tabId);
  const tabs = tabsForProject(activeProject()?.id ?? -1).filter((tab) =>
    tabIds.includes(tab.id),
  );
  if (tabs.length === 0) return;
  pendingDeleteTabIds = tabs.map((tab) => tab.id);
  const confirmation = tabDeleteConfirmationForTabs(tabs);
  deleteTabDialogTitle.textContent = confirmation.title;
  deleteTabDialogDetail.textContent = confirmation.detail;
  if (!deleteTabDialog.open) deleteTabDialog.showModal();
}

async function confirmTabDelete() {
  if (pendingDeleteTabIds.length === 0) return;
  const tabIds = [...pendingDeleteTabIds];
  pendingDeleteTabIds = [];
  deleteTabDialog.close();
  await deleteTabs(tabIds);
}

function tabIdsForDelete(fallbackTabId: number) {
  return tabSelection.selectedIds.includes(fallbackTabId)
    ? [...tabSelection.selectedIds]
    : [fallbackTabId];
}

function showAddLinksDialog() {
  if (activeTab()?.kind !== "links") return;
  addLinksInput.value = "";
  addLinksError.hidden = true;
  addLinksError.textContent = "";
  addLinksDialog.showModal();
  addLinksInput.focus();
}

function showAddLinkDialog() {
  if (activeTab()?.kind !== "links") return;
  addLinkName.value = "";
  addLinkUrl.value = "";
  addLinkError.hidden = true;
  addLinkError.textContent = "";
  addLinkDialog.showModal();
  addLinkName.focus();
}

async function confirmAddLink() {
  const link = parseSingleLink(addLinkName.value, addLinkUrl.value);
  if (!link) {
    addLinkError.textContent = "Enter a valid HTTP or HTTPS URL.";
    addLinkError.hidden = false;
    return;
  }
  await addLinksToActiveTab([link], addLinkDialog);
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
  await addLinksToActiveTab(parsed.links, addLinksDialog);
}

async function addLinksToActiveTab(links: LinkInput[], dialog: HTMLDialogElement) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links") return;
  await runCommand(async () => {
    workspace = await invoke<WorkspaceDto>("add_links", {
      projectId: project.id,
      tabId: tab.id,
      links,
    });
    dialog.close();
    render();
  });
}

function selectLink(link: LinkDto) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links") return Promise.resolve();
  showSelectedLinkImmediately(tab, link);

  linkSelectionQueue = linkSelectionQueue.then(() => runCommand(async () => {
    workspace = await invoke<WorkspaceDto>("select_link", {
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
    workspace = await invoke<WorkspaceDto>("update_checked_links", {
      projectId: project.id,
      tabId: tab.id,
      linkIds,
    });
    workspace = await invoke<WorkspaceDto>("select_link", {
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
  editingLink = { id: link.id, field };
  render();
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLInputElement>(`[data-link-editor="${field}"]`)?.focus();
  });
}

async function commitLinkEdit(link: LinkDto, field: "name" | "url", value: string) {
  if (editingLink?.id !== link.id || editingLink.field !== field) return;
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links") return;
  editingLink = null;
  await runCommand(async () => {
    workspace = await invoke<WorkspaceDto>("update_link", {
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
  closeProjectContextMenu();
  closeNoteContextMenu();
  linkMenuLinkId = link.id;
  const tab = activeTab();
  const deleteCount = tab?.kind === "links"
    ? linkIdsForDelete(link.id, tab.checked_link_ids).length
    : 1;
  deleteLinkMenuButton.textContent = deleteCount === 1 ? "Delete Link" : `Delete ${deleteCount} Links`;
  linkContextMenu.hidden = false;
  const position = projectMenuPosition({
    pointerX,
    pointerY,
    menuWidth: linkContextMenu.offsetWidth,
    menuHeight: linkContextMenu.offsetHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  linkContextMenu.style.left = `${position.left}px`;
  linkContextMenu.style.top = `${position.top}px`;
  editLinkNameMenuButton.focus();
}

function closeLinkContextMenu() {
  linkMenuLinkId = null;
  linkContextMenu.hidden = true;
}

function linkFromMenu() {
  return workspace.links.find((link) => link.id === linkMenuLinkId) ?? null;
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
  pendingDeleteLinkIds = links.map((link) => link.id);
  const confirmation = linkDeleteConfirmation(links);
  deleteLinkDialogTitle.textContent = confirmation.title;
  deleteLinkDialogDetail.textContent = confirmation.detail;
  confirmDeleteLinkButton.textContent = confirmation.buttonLabel;
  if (!deleteLinkDialog.open) deleteLinkDialog.showModal();
}

async function confirmLinkDelete() {
  if (pendingDeleteLinkIds.length === 0) return;
  const linkIds = [...pendingDeleteLinkIds];
  pendingDeleteLinkIds = [];
  deleteLinkDialog.close();
  await deleteLinks(linkIds);
}

async function deleteLinks(linkIds: number[]) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links" || linkIds.length === 0) return;
  await runCommand(async () => {
    workspace = await invoke<WorkspaceDto>("delete_links", {
      projectId: project.id,
      tabId: tab.id,
      linkIds,
    });
    previewText = "No preview";
    editingLink = null;
    render();
  });
}

async function moveLink(linkId: number, targetIndex: number) {
  const project = activeProject();
  const tab = activeTab();
  if (!project || tab?.kind !== "links") return;
  await runCommand(async () => {
    workspace = await invoke<WorkspaceDto>("move_link", {
      projectId: project.id,
      tabId: tab.id,
      linkId,
      targetIndex,
    });
    render();
  });
}

async function editProjectFromMenu(action: "rename" | "description") {
  if (projectMenuProjectId === null) return;
  const projectId = projectMenuProjectId;
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
  closeNoteContextMenu();
  projectMenuProjectId = projectId;
  deleteProjectMenuButton.textContent = projectDeleteMenuLabel(
    projectIdsForDelete(projectId).length,
  );
  projectContextMenu.hidden = false;
  const requestedLeft = alignRight ? pointerX - projectContextMenu.offsetWidth : pointerX;
  projectContextMenu.style.left = `${requestedLeft}px`;
  projectContextMenu.style.top = `${pointerY}px`;

  const position = projectMenuPosition({
    pointerX: requestedLeft,
    pointerY,
    menuWidth: projectContextMenu.offsetWidth,
    menuHeight: projectContextMenu.offsetHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  projectContextMenu.style.left = `${position.left}px`;
  projectContextMenu.style.top = `${position.top}px`;
  renameProjectMenuButton.focus();
}

function closeProjectContextMenu() {
  projectMenuProjectId = null;
  projectContextMenu.hidden = true;
}

async function editNoteFromMenu(field: "noteTitle" | "noteContent") {
  if (noteMenuNoteId === null) return;
  const noteId = noteMenuNoteId;
  closeNoteContextMenu();
  await activateNote(noteId);
  if (activeNote()?.id !== noteId) return;
  startNoteInlineEdit(field);
}

async function deleteNotesFromMenu() {
  if (noteMenuNoteId === null) return;
  const noteIds = noteContextSelection(noteSelection.selectedIds, noteMenuNoteId);
  closeNoteContextMenu();
  await deleteNotes(noteIds);
}

function openNoteContextMenu(noteId: number, pointerX: number, pointerY: number) {
  closeProjectContextMenu();
  noteMenuNoteId = noteId;
  const noteIds = noteContextSelection(noteSelection.selectedIds, noteId);
  deleteNoteMenuButton.textContent = noteDeleteMenuLabel(noteIds.length);
  noteContextMenu.hidden = false;
  noteContextMenu.style.left = `${pointerX}px`;
  noteContextMenu.style.top = `${pointerY}px`;

  const position = projectMenuPosition({
    pointerX,
    pointerY,
    menuWidth: noteContextMenu.offsetWidth,
    menuHeight: noteContextMenu.offsetHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  noteContextMenu.style.left = `${position.left}px`;
  noteContextMenu.style.top = `${position.top}px`;
  editNoteTitleMenuButton.focus();
}

function closeNoteContextMenu() {
  noteMenuNoteId = null;
  noteContextMenu.hidden = true;
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
  const paths = fileSelectionState.selectedPaths;
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
        workspace = await invoke<WorkspaceDto>("open_file", {
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
  const path = fileSelectionState.selectedPath;
  if (!project || path === null) return;
  const selectedEntry = files.find((entry) => entry.path === path);

  await runCommand(async () => {
    if (selectedEntry?.is_dir) {
      await invoke("open_folder", { folderPath: path });
      return;
    }
    workspace = await invoke<WorkspaceDto>("open_file", {
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
    workspace = await invoke<WorkspaceDto>("open_file", {
      projectId: project.id,
      path,
    });
    render();
  });
}

async function previewCurrentSelection(shouldRender = true) {
  const path = previewTargetPath(fileSelectionState);
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
  fileSelectionState = {
    ...fileSelectionState,
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
    inlineEditState = startTabFolderEditForChoice(tab.folder_path);
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
    fileSelectionState.selectedPaths,
    selectionEntries,
  );
  const prunedSelectedPath = pruneSelectedPath(
    fileSelectionState.selectedPath,
    selectionEntries,
  );

  fileSelectionState = {
    ...fileSelectionState,
    selectedPath: prunedSelectedPath,
    selectedPaths: prunedCheckedPaths,
  };

  if (prunedSelectedPath !== tab.selected_path) {
    previewText = "No preview";
    workspace = await invoke<WorkspaceDto>("clear_selected_path", {
      projectId: project.id,
      tabId: tab.id,
    });
  }

  if (prunedCheckedPaths.length !== tab.checked_paths.length) {
    workspace = await invoke<WorkspaceDto>("update_checked_paths", {
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
  renderInlineProjectField(activeProjectName, "projectName", project?.name ?? "None");
  renderInlineProjectField(activeProjectSummary, "projectSummary", project?.summary || "");
  undoButton.disabled = !workspace.can_undo;
  undoButton.title = undoTooltip(workspace.undo_kind);
  undoHint.textContent = undoHintText(workspace.undo_kind);
  deleteProjectButton.disabled = !project;
  addTabButton.disabled = !project;
  const isLinksTab = tab?.kind === "links";
  const activeLinks = linksForActiveTab();
  activeTabKindLabel.textContent = isLinksTab ? "Links:" : "Folder:";
  openFolderButton.hidden = isLinksTab;
  addLinkButton.hidden = !isLinksTab;
  addLinksButton.hidden = !isLinksTab;
  openFolderButton.disabled = tab?.kind !== "folder" || !tab.folder_path;
  openFilesButton.textContent = isLinksTab ? "Open Links" : "Open Checked";
  openFilesButton.disabled = isLinksTab
    ? (tab?.checked_link_ids.length ?? 0) === 0
    : fileSelectionState.selectedPaths.length === 0;
  openSelectedButton.disabled = isLinksTab
    ? tab?.selected_link_id === null
    : fileSelectionState.selectedPath === null;
  renderActiveTabName(tab);
  if (isLinksTab) {
    activeTabPath.textContent = `${activeLinks.length} link${activeLinks.length === 1 ? "" : "s"}`;
    activeTabPath.classList.remove("inline-editable-empty");
    activeTabPath.title = "";
  } else {
    renderInlineTabFolder(activeTabPath, tab?.kind === "folder" ? tab.folder_path : "");
  }
  renderCheckedPaths();
  renderSelectedPath();
  previewContent.textContent = previewText;

  renderProjects();
  renderNotes();
  renderTabs();
  renderFiles();
  renderRecent();
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

function renderCheckedPaths() {
  const tab = activeTab();
  if (tab?.kind === "links") {
    const links = linksForActiveTab().filter((link) => tab.checked_link_ids.includes(link.id));
    if (links.length === 0) {
      checkedPaths.textContent = "None";
      return;
    }
    const summary = document.createElement("strong");
    summary.textContent = `${links.length} link${links.length === 1 ? "" : "s"} checked`;
    const list = document.createElement("ul");
    list.className = "path-list";
    for (const link of links) {
      const item = document.createElement("li");
      item.textContent = link.name;
      list.append(item);
    }
    checkedPaths.replaceChildren(summary, list);
    return;
  }
  if (fileSelectionState.selectedPaths.length === 0) {
    checkedPaths.textContent = "None";
    return;
  }

  if (fileSelectionState.selectedPaths.length === 1) {
    checkedPaths.textContent = fileSelectionState.selectedPaths[0];
    return;
  }

  const summary = document.createElement("strong");
  summary.textContent = `${fileSelectionState.selectedPaths.length} items checked`;
  const list = document.createElement("ul");
  list.className = "path-list";
  for (const path of fileSelectionState.selectedPaths) {
    const item = document.createElement("li");
    item.textContent = path;
    list.append(item);
  }
  checkedPaths.replaceChildren(summary, list);
}

function renderSelectedPath() {
  const tab = activeTab();
  if (tab?.kind === "links") {
    selectedPath.textContent =
      linksForActiveTab().find((link) => link.id === tab.selected_link_id)?.url ?? "None";
    return;
  }
  selectedPath.textContent = fileSelectionState.selectedPath ?? "None";
}

function renderInlineProjectField(
  container: HTMLElement,
  field: InlineEditField,
  value: string,
) {
  if (inlineEditState.field !== field || projectEditSurface !== "active-header") {
    container.textContent = value;
    container.classList.toggle(
      "inline-editable-empty",
      shouldShowInlineEditPlaceholder(value, false),
    );
    container.title = "Double-click to edit";
    return;
  }

  container.title = "";
  container.classList.toggle(
    "inline-editable-empty",
    shouldShowInlineEditPlaceholder(value, true),
  );
  const input = document.createElement("input");
  input.className = "inline-editor";
  input.dataset.inlineField = field;
  input.value = inlineEditState.draft;
  input.addEventListener("input", () => {
    inlineEditState = {
      ...inlineEditState,
      draft: input.value,
    };
  });
  input.addEventListener("keydown", async (event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === "Enter") {
      event.preventDefault();
      await commitProjectInlineEdit(input.value);
    } else if (keyboardEvent.key === "Escape") {
      event.preventDefault();
      await commitProjectInlineEdit(input.value, true);
    }
  });
  input.addEventListener("blur", async () => {
    if (inlineEditState.field === field) {
      await commitProjectInlineEdit(input.value);
    }
  });

  container.replaceChildren(input);
}

function renderActiveTabName(tab: TabDto | null) {
  if (!tab) {
    activeTabName.textContent = "None";
    activeTabName.title = "";
    activeTabName.classList.remove("editable-active-tab-name");
    return;
  }

  activeTabName.classList.add("editable-active-tab-name");
  if (
    inlineEditState.field !== "tabName" ||
    activeTabId !== tab.id ||
    tabNameEditSurface !== "active-header"
  ) {
    activeTabName.textContent = tab.name;
    activeTabName.title = "Double-click to edit the tab name";
    activeTabName.ondblclick = () => startTabInlineEdit("tabName", tab.id, "active-header");
    return;
  }

  activeTabName.title = "";
  activeTabName.ondblclick = null;
  const input = document.createElement("input");
  input.className = "inline-editor active-tab-inline-editor";
  input.dataset.inlineField = "tabName";
  input.value = inlineEditState.draft;
  input.addEventListener("input", () => {
    inlineEditState = {
      ...inlineEditState,
      draft: input.value,
    };
  });
  input.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await commitTabInlineEdit(input.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      await commitTabInlineEdit(input.value, true);
    }
  });
  input.addEventListener("blur", async () => {
    if (inlineEditState.field === "tabName") {
      await commitTabInlineEdit(input.value);
    }
  });
  activeTabName.replaceChildren(input);
}

function renderInlineTabFolder(container: HTMLElement, value: string) {
  if (inlineEditState.field !== "tabFolder") {
    if (value.length === 0) {
      const prompt = emptyTabFolderPrompt();
      const state = document.createElement("span");
      state.className = "empty-folder-state";
      state.textContent = prompt.state;
      const separator = document.createElement("span");
      separator.className = "empty-folder-separator";
      separator.textContent = " · ";
      const action = document.createElement("span");
      action.className = "empty-folder-action";
      action.textContent = prompt.action;
      container.replaceChildren(state, separator, action);
    } else {
      container.textContent = value;
    }
    container.classList.toggle("inline-editable-empty", value.length === 0);
    container.title = "Double-click to edit the folder path";
    return;
  }

  container.title = "";
  const editor = document.createElement("span");
  editor.className = "folder-inline-editor";

  const input = document.createElement("input");
  input.className = "inline-editor";
  input.dataset.inlineField = "tabFolder";
  input.value = inlineEditState.draft;
  input.addEventListener("input", () => {
    inlineEditState = {
      ...inlineEditState,
      draft: input.value,
    };
  });
  input.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await commitTabInlineEdit(input.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      await commitTabInlineEdit(input.value, true);
    }
  });
  input.addEventListener("blur", async () => {
    if (inlineEditState.field === "tabFolder") {
      await commitTabInlineEdit(input.value);
    }
  });

  const chooseButton = document.createElement("button");
  chooseButton.type = "button";
  chooseButton.textContent = "Choose";
  chooseButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  chooseButton.addEventListener("click", chooseActiveTabFolder);

  editor.append(input, chooseButton);
  container.replaceChildren(editor);
}

function renderProjects() {
  sortCustomButton.classList.toggle("is-active", projectSortMode === "custom");
  sortCreatedButton.classList.toggle("is-active", projectSortMode === "created");
  sortNameButton.classList.toggle("is-active", projectSortMode === "name");
  sortCustomButton.setAttribute("aria-pressed", String(projectSortMode === "custom"));
  sortCreatedButton.setAttribute("aria-pressed", String(projectSortMode === "created"));
  sortNameButton.setAttribute("aria-pressed", String(projectSortMode === "name"));

  projectList.replaceChildren(
    ...sortProjectsForDisplay(workspace.projects, projectSortMode, projectCustomOrder).map((project) => {
      const item = document.createElement("div");
      item.className = "project-item";
      item.classList.toggle("is-active", project.id === activeProjectId);
      item.classList.toggle("is-selected", projectSelection.selectedIds.includes(project.id));
      item.dataset.projectId = String(project.id);
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.setAttribute("aria-pressed", String(projectSelection.selectedIds.includes(project.id)));
      item.classList.toggle("is-custom-sort", projectSortMode === "custom");
      projectDragController.bind(item, project.id);
      bindProjectItemInteractions(
        item,
        project.id,
        {
          hasActiveEdit: inlineEditState.field !== null,
          editingThisItem:
            projectEditSurface === "project-list" && editingProjectId === project.id,
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
      );

      const menuButton = createProjectMenuButton(
        project.id,
        project.name,
        finishCurrentInlineEdit,
        openProjectContextMenu,
      );

      const selectionIndicator = document.createElement("span");
      selectionIndicator.className = "selection-indicator";
      selectionIndicator.textContent = projectSelection.selectedIds.includes(project.id) ? "✓" : "";
      selectionIndicator.setAttribute("aria-hidden", "true");

      item.append(
        renderProjectListField(project, "projectName"),
        renderProjectListField(project, "projectSummary"),
        selectionIndicator,
        menuButton,
      );
      return item;
    }),
  );
}

function renderProjectListField(project: ProjectDto, field: InlineEditField) {
  return renderProjectListFieldElement(
    project,
    field,
    {
      inlineEdit: inlineEditState,
      editingProjectId,
      editSurface: projectEditSurface,
    },
    {
      startEdit: (nextField, projectId) =>
        startProjectInlineEdit(nextField, projectId, "project-list"),
      updateDraft: (value) => { inlineEditState = { ...inlineEditState, draft: value }; },
      commitEdit: commitProjectInlineEdit,
      isEditing: (projectId, nextField) =>
        inlineEditState.field === nextField &&
        editingProjectId === projectId &&
        projectEditSurface === "project-list",
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
      selectedIds: noteSelection.selectedIds,
      panelState: notePanelController.state,
      inlineEdit: inlineEditState,
      editingNoteId,
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
        inlineEditState = { ...inlineEditState, draft: value };
      },
      commitEdit: commitNoteInlineEdit,
      isEditing: (noteId, field) =>
        inlineEditState.field === field && editingNoteId === noteId,
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
      activeTabId,
      selection: tabSelection,
      inlineEdit: inlineEditState,
      editSurface: tabNameEditSurface,
    },
    {
      getActiveTabId: () => activeTabId,
      getSelection: () => tabSelection,
      setSelection: (selection) => { tabSelection = selection; },
      startNameEdit: (tabId) => startTabInlineEdit("tabName", tabId),
      updateDraft: (value) => { inlineEditState = { ...inlineEditState, draft: value }; },
      commitEdit: commitTabInlineEdit,
      isNameEditing: (tabId) =>
        inlineEditState.field === "tabName" &&
        activeTabId === tabId &&
        tabNameEditSurface === "tab-bar",
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
  const notices: HTMLElement[] = [];
  if (errorMessage) {
    const notice = document.createElement("p");
    notice.className = "notice is-error";
    notice.textContent = errorMessage;
    notices.push(notice);
  }

  const tab = activeTab();
  const fileNotice = fileNoticeForActiveTab(
    Boolean(tab),
    tab?.kind === "folder" ? tab.folder_path : undefined,
  );
  if (fileNotice) {
    const notice = document.createElement("p");
    notice.className = "notice";
    notice.textContent = fileNotice.text;
    notices.push(notice);
  }

  fileList.replaceChildren(
    ...notices,
    ...files.map((entry) => {
      const button = document.createElement("div");
      button.tabIndex = 0;
      button.role = "button";
      button.className = entry.is_dir ? "file-row is-dir" : "file-row";
      const isChecked = fileSelectionState.selectedPaths.includes(entry.path);
      const isCurrent = fileSelectionState.selectedPath === entry.path;
      const showCheckbox = shouldShowSelectionCheckbox({
        path: entry.path,
        isDir: entry.is_dir,
      });
      button.classList.toggle("is-current", isCurrent);
      button.classList.toggle("is-checked", isChecked);
      button.classList.toggle("has-file-check", showCheckbox);
      const tooltipText = fileRowTooltip({ path: entry.path, isDir: entry.is_dir });
      const visual = fileEntryVisual({ path: entry.path, isDir: entry.is_dir });
      const check = document.createElement("button");
      check.type = "button";
      check.className = `file-check ${isChecked ? "is-checked" : ""}`;
      check.setAttribute("aria-label", `Check ${entry.is_dir ? "folder" : "file"}`);
      const kind = document.createElement("span");
      kind.className = `file-kind is-${visual.icon}`;
      kind.append(
        createLucideElement(entry.is_dir ? FolderIcon : FileIcon, {
          width: 16,
          height: 16,
          class: "file-kind-icon",
          "aria-hidden": "true",
        }),
        document.createTextNode(visual.label),
      );
      const name = document.createElement("strong");
      name.textContent = entry.name;
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "file-open-button";
      openButton.textContent = "Open";
      button.replaceChildren(...(showCheckbox ? [check] : []), kind, name, openButton);
      button.addEventListener("mouseenter", () => scheduleFileTooltip(button, tooltipText));
      button.addEventListener("mouseleave", hideFileTooltip);
      button.addEventListener("focus", () => scheduleFileTooltip(button, tooltipText));
      button.addEventListener("blur", hideFileTooltip);
      button.querySelector(".file-check")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if ((event as MouseEvent).shiftKey) {
          void checkEntryRange(entry);
        } else {
          void toggleCheckedEntry(entry);
        }
      });
      button.querySelector(".file-open-button")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openEntry(entry);
      });
      button.addEventListener("click", (event) => {
        if (event.shiftKey) {
          void checkEntryRange(entry);
        } else if (event.ctrlKey || event.metaKey) {
          void toggleCheckedEntry(entry);
        } else {
          void selectEntry(entry);
        }
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectEntry(entry);
        }
      });
      return button;
    }),
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

function renderRecent() {
  if (workspace.recent_files.length === 0) {
    recentList.innerHTML = `<p class="notice">None yet.</p>`;
    return;
  }

  recentList.replaceChildren(
    ...workspace.recent_files.map((file) => {
      const item = document.createElement("div");
      item.className = "recent-item";
      const path = document.createElement("span");
      path.textContent = file.path;
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = "Open";
      openButton.addEventListener("click", () => openRecentFile(file.path));
      item.append(path, openButton);
      return item;
    }),
  );
}

function resetTabSelectionToActive() {
  tabSelection = activeTabId === null
    ? emptyMultiSelection()
    : { selectedIds: [activeTabId], anchorId: activeTabId };
}

function renderLinks() {
  const tab = activeTab();
  if (!tab || tab.kind !== "links") return;
  const links = linksForActiveTab();
  const notices: HTMLElement[] = [];
  if (errorMessage) {
    const notice = document.createElement("p");
    notice.className = "notice is-error";
    notice.textContent = errorMessage;
    notices.push(notice);
  }
  if (links.length === 0) {
    const notice = document.createElement("p");
    notice.className = "notice";
    notice.textContent = "No links";
    notices.push(notice);
  }
  fileList.replaceChildren(
    ...notices,
    ...links.map((link, index) => {
      const row = document.createElement("div");
      row.className = "link-row";
      row.dataset.linkId = String(link.id);
      row.tabIndex = 0;
      row.role = "button";
      row.draggable = true;
      row.classList.toggle("is-current", tab.selected_link_id === link.id);
      row.classList.toggle("is-checked", tab.checked_link_ids.includes(link.id));

      const check = document.createElement("button");
      check.type = "button";
      check.className = `file-check ${tab.checked_link_ids.includes(link.id) ? "is-checked" : ""}`;
      check.setAttribute("aria-label", "Check link");
      check.addEventListener("click", (event) => {
        event.stopPropagation();
        const action = linkClickAction(event.ctrlKey || event.metaKey, true);
        if (action.toggleChecked) void toggleCheckedLinkEntry(link);
      });

      const fields = document.createElement("div");
      fields.className = "link-fields";
      fields.append(renderLinkField(link, "name"), renderLinkField(link, "url"));

      const actions = document.createElement("div");
      actions.className = "link-actions";
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = "Open";
      openButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openLink(link);
      });
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = copiedLinkId === link.id ? "Copied" : "Copy";
      copyButton.addEventListener("click", (event) => {
        event.stopPropagation();
        copyLinkUrl(link);
      });
      actions.append(openButton, copyButton);
      row.append(check, fields, actions);
      row.addEventListener("click", (event) => {
        const action = linkClickAction(event.ctrlKey || event.metaKey, false);
        if (action.toggleChecked) {
          void toggleCheckedLinkEntry(link);
        } else if (action.select) {
          scheduleLinkSelection(link);
        }
      });
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openLinkContextMenu(link, event.clientX, event.clientY);
      });
      row.addEventListener("dragstart", (event) => {
        if ((event.target as HTMLElement).closest("button, input")) {
          event.preventDefault();
          return;
        }
        draggedLinkId = link.id;
        row.classList.add("is-dragging");
        event.dataTransfer?.setData("text/plain", String(link.id));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
      row.addEventListener("dragover", (event) => {
        if (draggedLinkId === null || draggedLinkId === link.id) return;
        event.preventDefault();
        row.classList.add("is-drop-target");
      });
      row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
      row.addEventListener("drop", async (event) => {
        event.preventDefault();
        row.classList.remove("is-drop-target");
        const sourceId = draggedLinkId;
        draggedLinkId = null;
        if (sourceId !== null && sourceId !== link.id) await moveLink(sourceId, index);
      });
      row.addEventListener("dragend", () => {
        draggedLinkId = null;
        row.classList.remove("is-dragging");
        fileList.querySelectorAll(".is-drop-target").forEach((node) => {
          node.classList.remove("is-drop-target");
        });
      });
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectLink(link);
        }
      });
      return row;
    }),
  );
}

function renderLinkField(link: LinkDto, field: "name" | "url") {
  if (editingLink?.id === link.id && editingLink.field === field) {
    const input = document.createElement("input");
    input.className = "link-inline-editor";
    input.dataset.linkEditor = field;
    input.value = link[field];
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        await commitLinkEdit(link, field, input.value);
      } else if (event.key === "Escape") {
        editingLink = null;
        render();
      }
    });
    input.addEventListener("blur", () => commitLinkEdit(link, field, input.value));
    return input;
  }
  const value = document.createElement(field === "name" ? "strong" : "span");
  value.className = `link-${field}`;
  value.dataset.linkField = field;
  value.textContent = link[field];
  value.title = field === "name" ? "Double-click to edit name" : "Double-click to edit URL";
  value.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const editField = linkEditField((event.currentTarget as HTMLElement).dataset.linkField);
    if (editField) startLinkEdit(link, editField);
  });
  return value;
}

async function runCommand(command: () => Promise<void>) {
  try {
    errorMessage = null;
    await command();
  } catch (error) {
    errorMessage = String(error);
    render();
  }
}

function activeProject() {
  return workspace.projects.find((project) => project.id === activeProjectId) ?? null;
}

function activeTab() {
  return workspace.tabs.find((tab) => tab.id === activeTabId) ?? null;
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
  if (activeTabId === null) return [];
  return workspace.links
    .filter((link) => link.tab_id === activeTabId)
    .sort((left, right) => left.position - right.position);
}

function element<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) {
    throw new Error(`Missing element: ${selector}`);
  }
  return node;
}
