import type { InlineEditField } from "./inlineEdit";
import { sortProjectsForDisplay, type ProjectSortMode } from "./projectSort";

export type ProjectListItem = {
  id: number;
  name: string;
  summary: string;
};

export type ProjectListRendererState = {
  projects: ProjectListItem[];
  activeProjectId: number | null;
  selectedIds: number[];
  sortMode: ProjectSortMode;
  customOrder: number[];
};

export type ProjectListRendererActions = {
  bindDrag: (item: HTMLElement, projectId: number) => void;
  bindInteractions: (item: HTMLElement, projectId: number) => void;
  renderField: (project: ProjectListItem, field: InlineEditField) => HTMLElement;
  createMenuButton: (project: ProjectListItem) => HTMLButtonElement;
};

export class ProjectListRenderer {
  constructor(
    private readonly list: HTMLElement,
    private readonly sortButtons: Record<ProjectSortMode, HTMLButtonElement>,
  ) {}

  render(state: ProjectListRendererState, actions: ProjectListRendererActions): void {
    this.#renderSortButtons(state.sortMode);
    const selected = new Set(state.selectedIds);
    const items = sortProjectsForDisplay(state.projects, state.sortMode, state.customOrder)
      .map((project) => {
        const item = document.createElement("div");
        const isSelected = selected.has(project.id);
        item.className = "project-item";
        item.classList.toggle("is-active", project.id === state.activeProjectId);
        item.classList.toggle("is-selected", isSelected);
        item.classList.toggle("is-custom-sort", state.sortMode === "custom");
        item.dataset.projectId = String(project.id);
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute("aria-pressed", String(isSelected));

        actions.bindDrag(item, project.id);
        actions.bindInteractions(item, project.id);

        const selectionIndicator = document.createElement("span");
        selectionIndicator.className = "selection-indicator";
        selectionIndicator.textContent = isSelected ? "\u2713" : "";
        selectionIndicator.setAttribute("aria-hidden", "true");

        item.append(
          actions.renderField(project, "projectName"),
          actions.renderField(project, "projectSummary"),
          selectionIndicator,
          actions.createMenuButton(project),
        );
        return item;
      });
    this.list.replaceChildren(...items);
  }

  #renderSortButtons(mode: ProjectSortMode): void {
    (Object.entries(this.sortButtons) as [ProjectSortMode, HTMLButtonElement][])
      .forEach(([buttonMode, button]) => {
        const active = mode === buttonMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
  }
}
