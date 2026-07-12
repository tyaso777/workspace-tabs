import { describe, expect, it } from "vitest";
import { WorkspaceViewStateController, type WorkspaceViewState } from "./workspaceViewStateController";

function populatedState(): WorkspaceViewState {
  return {
    activeProjectId: 1,
    activeTabId: 10,
    projectSelection: { selectedIds: [1, 2], anchorId: 1 },
    noteSelection: { selectedIds: [4, 5], anchorId: 4 },
    tabSelection: { selectedIds: [10, 11], anchorId: 10 },
    fileSelection: { selectedPath: "selected", selectedPaths: ["checked"] },
    inlineEdit: { field: "projectName", draft: "Draft" },
    editingProjectId: 1,
    editingNoteId: 4,
    projectEditSurface: "project-list",
    tabNameEditSurface: "active-header",
    editingLink: { id: 8, field: "name" },
  };
}

describe("WorkspaceViewStateController", () => {
  it("resets project-scoped selection and editing when the project changes", () => {
    const controller = new WorkspaceViewStateController();
    controller.state = populatedState();
    controller.activateProject(2, 20);
    const next = controller.state;
    expect(next.activeProjectId).toBe(2);
    expect(next.activeTabId).toBe(20);
    expect(next.noteSelection).toEqual({ selectedIds: [], anchorId: null });
    expect(next.tabSelection).toEqual({ selectedIds: [20], anchorId: 20 });
    expect(next.inlineEdit.field).toBeNull();
    expect(next.fileSelection.selectedPaths).toEqual([]);
    expect(next.projectSelection.selectedIds).toEqual([1, 2]);
  });

  it("preserves note and tab multi-selection when reactivating the same project", () => {
    const state = populatedState();
    const controller = new WorkspaceViewStateController();
    controller.state = state;
    controller.activateProject(1, 10);
    const next = controller.state;
    expect(next.noteSelection).toEqual(state.noteSelection);
    expect(next.tabSelection).toEqual(state.tabSelection);
  });

  it("activates one tab and clears editing and file selection", () => {
    const controller = new WorkspaceViewStateController();
    controller.state = populatedState();
    controller.activateTab(11);
    const next = controller.state;
    expect(next.activeTabId).toBe(11);
    expect(next.tabSelection).toEqual({ selectedIds: [10, 11], anchorId: 10 });
    expect(next.fileSelection).toEqual({ selectedPath: null, selectedPaths: [] });
    expect(next.editingLink).toBeNull();
  });

  it("clears transient selections after undo while restoring active ids", () => {
    const controller = new WorkspaceViewStateController();
    controller.state = populatedState();
    controller.restoreAfterUndo(3, 30);
    const next = controller.state;
    expect(next.activeProjectId).toBe(3);
    expect(next.activeTabId).toBe(30);
    expect(next.projectSelection.selectedIds).toEqual([]);
    expect(next.noteSelection.selectedIds).toEqual([]);
    expect(next.tabSelection.selectedIds).toEqual([30]);
    expect(next.inlineEdit.field).toBeNull();
  });
});
