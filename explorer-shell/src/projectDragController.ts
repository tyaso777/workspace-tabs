import type { MultiSelectionState } from "./multiSelection";
import {
  initialProjectPointerState,
  moveProjectsInCustomOrder,
  normalizeProjectCustomOrder,
  startProjectPointerDrag,
  updateProjectPointerDrag,
  type ProjectPointerState,
  type ProjectSortMode,
} from "./projectSort";

export type ProjectDragState = {
  sortMode: ProjectSortMode;
  inlineEditing: boolean;
  selection: MultiSelectionState;
  projectIds: number[];
  customOrder: number[];
};

export type ProjectDragActions = {
  getState: () => ProjectDragState;
  setCustomOrder: (order: number[]) => void;
  setClickSuppressed: (suppressed: boolean) => void;
  render: () => void;
  persist: () => Promise<void>;
};

export class ProjectDragController {
  #pointerState: ProjectPointerState = initialProjectPointerState();
  #draggedIds: number[] = [];

  constructor(
    private readonly list: HTMLElement,
    private readonly actions: ProjectDragActions,
  ) {}

  bind(item: HTMLElement, projectId: number): void {
    item.addEventListener("pointerdown", (event) => {
      const state = this.actions.getState();
      const target = event.target as HTMLElement;
      if (
        state.sortMode !== "custom" || event.button !== 0 || event.ctrlKey || event.metaKey ||
        event.shiftKey || state.inlineEditing ||
        Boolean(target.closest(".inline-editor, .project-item-menu-button"))
      ) return;
      this.#draggedIds = state.selection.selectedIds.includes(projectId)
        ? [...state.selection.selectedIds]
        : [projectId];
      this.#pointerState = startProjectPointerDrag(projectId, event.clientY);
    });
    item.addEventListener("pointermove", (event) => {
      if (this.#pointerState.projectId !== projectId) return;
      this.#pointerState = updateProjectPointerDrag(this.#pointerState, event.clientY);
      if (!this.#pointerState.moved) return;
      if (!item.hasPointerCapture(event.pointerId)) item.setPointerCapture(event.pointerId);
      item.classList.add("is-dragging");
      item.style.transform = `translateY(${this.#pointerState.deltaY}px) scale(1.02)`;
      this.#showDropIndicator(event.clientY);
    });
    item.addEventListener("pointerup", async (event) => {
      if (this.#pointerState.projectId !== projectId) return;
      if (item.hasPointerCapture(event.pointerId)) item.releasePointerCapture(event.pointerId);
      const moved = this.#pointerState.moved;
      const target = this.#dropTargetAt(event.clientY);
      this.#reset(item);
      this.actions.setClickSuppressed(moved);
      if (moved) window.setTimeout(() => this.actions.setClickSuppressed(false), 0);
      if (!moved || !target) return;
      const state = this.actions.getState();
      this.actions.setCustomOrder(moveProjectsInCustomOrder(
        normalizeProjectCustomOrder(state.customOrder, state.projectIds),
        this.#draggedIds,
        target.projectId,
        target.after,
      ));
      this.#draggedIds = [];
      this.actions.render();
      await this.actions.persist();
    });
    item.addEventListener("pointercancel", () => {
      this.#draggedIds = [];
      this.#reset(item);
    });
  }

  #dropTargetAt(clientY: number) {
    const candidates = [...this.list.querySelectorAll<HTMLElement>(".project-item")]
      .filter((item) => !this.#draggedIds.includes(Number(item.dataset.projectId)));
    if (candidates.length === 0) return null;
    for (const item of candidates) {
      const rect = item.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return { projectId: Number(item.dataset.projectId), after: false, item };
      }
      if (clientY <= rect.bottom) {
        return { projectId: Number(item.dataset.projectId), after: true, item };
      }
    }
    const item = candidates[candidates.length - 1];
    return { projectId: Number(item.dataset.projectId), after: true, item };
  }

  #showDropIndicator(clientY: number): void {
    this.#clearIndicators();
    const target = this.#dropTargetAt(clientY);
    target?.item.classList.add(target.after ? "is-drop-after" : "is-drop-before");
  }

  #clearIndicators(): void {
    this.list.querySelectorAll(".is-drop-before, .is-drop-after")
      .forEach((item) => item.classList.remove("is-drop-before", "is-drop-after"));
  }

  #reset(item: HTMLElement): void {
    this.#pointerState = initialProjectPointerState();
    item.classList.remove("is-dragging");
    item.style.transform = "";
    this.#clearIndicators();
  }
}
