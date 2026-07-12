import { emptyInlineEditState, type InlineEditState } from "./inlineEdit";
import { emptyMultiSelection, type MultiSelectionState } from "./multiSelection";
import { initialFileSelectionState, type FileSelectionState } from "./fileSelection";

export type WorkspaceEditingState = {
  inlineEdit: InlineEditState;
  editingProjectId: number | null;
  editingNoteId: number | null;
  projectEditSurface: "active-header" | "project-list";
  tabNameEditSurface: "tab-bar" | "active-header";
  editingLink: { id: number; field: "name" | "url" } | null;
};

export type WorkspaceViewState = WorkspaceEditingState & {
  activeProjectId: number | null;
  activeTabId: number | null;
  projectSelection: MultiSelectionState;
  noteSelection: MultiSelectionState;
  tabSelection: MultiSelectionState;
  fileSelection: FileSelectionState;
};

export class WorkspaceViewStateController {
  state: WorkspaceViewState = {
    activeProjectId: null,
    activeTabId: null,
    projectSelection: emptyMultiSelection(),
    noteSelection: emptyMultiSelection(),
    tabSelection: emptyMultiSelection(),
    fileSelection: initialFileSelectionState(),
    ...this.emptyEditingState(),
  };

  emptyEditingState(): WorkspaceEditingState {
    return {
      inlineEdit: emptyInlineEditState(),
      editingProjectId: null,
      editingNoteId: null,
      projectEditSurface: "active-header",
      tabNameEditSurface: "tab-bar",
      editingLink: null,
    };
  }

  activateProject(projectId: number, activeTabId: number | null): void {
    const projectChanged = this.state.activeProjectId !== projectId;
    this.state = {
      ...this.state,
      ...this.emptyEditingState(),
      activeProjectId: projectId,
      activeTabId,
      noteSelection: projectChanged ? emptyMultiSelection() : this.state.noteSelection,
      tabSelection: projectChanged
        ? this.selectionForActive(activeTabId)
        : this.state.tabSelection,
      fileSelection: initialFileSelectionState(),
    };
  }

  activateTab(tabId: number): void {
    this.state = {
      ...this.state,
      ...this.emptyEditingState(),
      activeTabId: tabId,
      fileSelection: initialFileSelectionState(),
    };
  }

  restoreAfterUndo(activeProjectId: number | null, activeTabId: number | null): void {
    this.state = {
      ...this.state,
      ...this.emptyEditingState(),
      activeProjectId,
      activeTabId,
      projectSelection: emptyMultiSelection(),
      noteSelection: emptyMultiSelection(),
      tabSelection: this.selectionForActive(activeTabId),
      fileSelection: initialFileSelectionState(),
    };
  }

  selectionForActive(activeId: number | null): MultiSelectionState {
    return activeId === null
      ? emptyMultiSelection()
      : { selectedIds: [activeId], anchorId: activeId };
  }

  resetEditing(): void {
    this.state = { ...this.state, ...this.emptyEditingState() };
  }
}
