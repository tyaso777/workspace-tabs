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

  activateProject(
    state: WorkspaceViewState,
    projectId: number,
    activeTabId: number | null,
  ): WorkspaceViewState {
    const projectChanged = state.activeProjectId !== projectId;
    return {
      ...state,
      ...this.emptyEditingState(),
      activeProjectId: projectId,
      activeTabId,
      noteSelection: projectChanged ? emptyMultiSelection() : state.noteSelection,
      tabSelection: projectChanged
        ? this.selectionForActive(activeTabId)
        : state.tabSelection,
      fileSelection: initialFileSelectionState(),
    };
  }

  activateTab(state: WorkspaceViewState, tabId: number): WorkspaceViewState {
    return {
      ...state,
      ...this.emptyEditingState(),
      activeTabId: tabId,
      fileSelection: initialFileSelectionState(),
    };
  }

  restoreAfterUndo(
    state: WorkspaceViewState,
    activeProjectId: number | null,
    activeTabId: number | null,
  ): WorkspaceViewState {
    return {
      ...state,
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
}
