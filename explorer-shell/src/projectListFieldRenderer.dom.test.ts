// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { emptyInlineEditState } from "./inlineEdit";
import {
  renderProjectListField,
  type ProjectListFieldActions,
} from "./projectListFieldRenderer";

const project = { id: 5, name: "Alpha", summary: "Summary" };

function actions(overrides: Partial<ProjectListFieldActions> = {}): ProjectListFieldActions {
  return {
    startEdit: vi.fn(),
    updateDraft: vi.fn(),
    commitEdit: vi.fn(async () => undefined),
    isEditing: vi.fn(() => false),
    ...overrides,
  };
}

describe("project list field DOM", () => {
  it("starts name and description editing from a double click", () => {
    const handler = actions();
    const state = {
      inlineEdit: emptyInlineEditState(),
      editingProjectId: null,
      editSurface: "project-list" as const,
    };
    const name = renderProjectListField(project, "projectName", state, handler);
    const summary = renderProjectListField(project, "projectSummary", state, handler);

    name.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    summary.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(handler.startEdit).toHaveBeenNthCalledWith(1, "projectName", 5);
    expect(handler.startEdit).toHaveBeenNthCalledWith(2, "projectSummary", 5);
  });

  it("renders an editor and commits Enter", async () => {
    const handler = actions({ isEditing: vi.fn(() => true) });
    const input = renderProjectListField(project, "projectName", {
      inlineEdit: { field: "projectName", draft: "Draft" },
      editingProjectId: 5,
      editSurface: "project-list",
    }, handler) as HTMLInputElement;
    input.value = "Saved";

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();

    expect(handler.commitEdit).toHaveBeenCalledWith("Saved");
  });

  it("commits on blur only while the same field is editing", async () => {
    const handler = actions({ isEditing: vi.fn(() => true) });
    const input = renderProjectListField(project, "projectSummary", {
      inlineEdit: { field: "projectSummary", draft: "Draft" },
      editingProjectId: 5,
      editSurface: "project-list",
    }, handler) as HTMLInputElement;
    input.value = "Changed";

    input.dispatchEvent(new FocusEvent("blur"));
    await Promise.resolve();

    expect(handler.commitEdit).toHaveBeenCalledWith("Changed");
  });
});
