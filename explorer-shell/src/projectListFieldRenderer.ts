import type { InlineEditField, InlineEditState } from "./inlineEdit";
import { shouldStartProjectFieldEditFromPointerDown } from "./projectPointer";

export type ProjectListField = {
  id: number;
  name: string;
  summary: string;
};

export type ProjectListFieldState = {
  inlineEdit: InlineEditState;
  editingProjectId: number | null;
  editSurface: "active-header" | "project-list";
};

export type ProjectListFieldActions = {
  startEdit: (field: InlineEditField, projectId: number) => void;
  updateDraft: (value: string) => void;
  commitEdit: (value: string, cancel?: boolean) => Promise<void>;
  isEditing: (projectId: number, field: InlineEditField) => boolean;
};

export function isProjectListFieldEditing(
  projectId: number,
  field: InlineEditField,
  state: ProjectListFieldState,
): boolean {
  return state.inlineEdit.field === field &&
    state.editingProjectId === projectId &&
    state.editSurface === "project-list";
}

export function renderProjectListField(
  project: ProjectListField,
  field: InlineEditField,
  state: ProjectListFieldState,
  actions: ProjectListFieldActions,
): HTMLElement {
  const isName = field === "projectName";
  const value = isName ? project.name : project.summary || "No description";

  if (isProjectListFieldEditing(project.id, field, state)) {
    const input = document.createElement("input");
    input.className = "inline-editor project-list-inline-editor";
    input.dataset.inlineField = field;
    input.value = state.inlineEdit.draft;
    input.addEventListener("mousedown", (event) => event.stopPropagation());
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("input", () => actions.updateDraft(input.value));
    input.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        await actions.commitEdit(input.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        await actions.commitEdit(input.value, true);
      }
    });
    input.addEventListener("blur", async () => {
      if (actions.isEditing(project.id, field)) await actions.commitEdit(input.value);
    });
    return input;
  }

  const element = document.createElement(isName ? "strong" : "span");
  element.className = "project-list-editable";
  element.textContent = value;
  element.title = isName ? "Double-click to edit project name" : "Double-click to edit description";
  element.addEventListener("mousedown", (event) => {
    if (!shouldStartProjectFieldEditFromPointerDown(true, event.detail)) return;
    event.preventDefault();
    event.stopPropagation();
    actions.startEdit(field, project.id);
  });
  element.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.startEdit(field, project.id);
  });
  return element;
}
