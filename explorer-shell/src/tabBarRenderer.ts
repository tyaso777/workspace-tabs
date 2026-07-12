import {
  Check as CheckIcon,
  Folder as FolderIcon,
  Link as LinkIcon,
  createElement as createLucideElement,
} from "lucide";
import { applyMultiSelection, type MultiSelectionState } from "./multiSelection";
import type { InlineEditState } from "./inlineEdit";
import {
  finishTabPointerDrag,
  initialTabPointerState,
  shouldActivateReleasedTab,
  shouldFinishInlineEditBeforeTabPointerInteraction,
  shouldStartTabNameEditFromMouseDown,
  startTabPointerDrag,
  updateTabPointerDrag,
  type TabPointerState,
} from "./tabPointer";
import { tabKindLabel } from "./tabMenu";

export type TabBarItem = {
  id: number;
  name: string;
  kind: "folder" | "links";
};

type EditSurface = "tab-bar" | "active-header";

export type TabBarRenderState = {
  tabs: TabBarItem[];
  activeTabId: number | null;
  selection: MultiSelectionState;
  inlineEdit: InlineEditState;
  editSurface: EditSurface;
};

export type TabBarRenderActions = {
  getActiveTabId: () => number | null;
  getSelection: () => MultiSelectionState;
  setSelection: (selection: MultiSelectionState) => void;
  startNameEdit: (tabId: number) => void;
  updateDraft: (value: string) => void;
  commitEdit: (value: string, cancel?: boolean) => Promise<void>;
  isNameEditing: (tabId: number) => boolean;
  finishCurrentEdit: () => Promise<boolean>;
  activate: (tabId: number) => Promise<void>;
  move: (tabIds: number[], targetIndex: number, draggedTabId: number) => Promise<void>;
  openContextMenu: (tabId: number, x: number, y: number) => void;
  render: () => void;
};

export function tabItemState(
  tabId: number,
  activeTabId: number | null,
  selectedIds: number[],
  inlineField: InlineEditState["field"],
  editSurface: EditSurface,
) {
  return {
    active: tabId === activeTabId,
    selected: selectedIds.includes(tabId),
    editing: tabId === activeTabId && inlineField === "tabName" && editSurface === "tab-bar",
  };
}

export class TabBarRenderer {
  #pointerState: TabPointerState = initialTabPointerState();

  constructor(private readonly list: HTMLElement) {}

  get isDragging(): boolean {
    return this.#pointerState.draggedTabId !== null;
  }

  render(state: TabBarRenderState, actions: TabBarRenderActions): void {
    this.list.replaceChildren(
      ...state.tabs.map((tab, index) => this.#renderTab(tab, index, state, actions)),
    );
  }

  #renderTab(
    tab: TabBarItem,
    index: number,
    state: TabBarRenderState,
    actions: TabBarRenderActions,
  ): HTMLElement {
    const itemState = tabItemState(
      tab.id,
      state.activeTabId,
      state.selection.selectedIds,
      state.inlineEdit.field,
      state.editSurface,
    );
    const item = document.createElement("div");
    item.className = itemState.active ? "tab-item is-active" : "tab-item";
    item.classList.toggle("is-selected", itemState.selected);
    item.dataset.tabId = String(tab.id);
    item.dataset.index = String(index);
    item.dataset.tabKind = tab.kind;
    item.addEventListener("mousedown", (event) => {
      const hasSelectionModifier = event.ctrlKey || event.metaKey || event.shiftKey;
      if (
        !hasSelectionModifier &&
        shouldStartTabNameEditFromMouseDown(
          Boolean((event.target as HTMLElement).closest(".tab-button")),
          event.detail,
          itemState.editing,
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        this.#pointerState = initialTabPointerState();
        actions.startNameEdit(tab.id);
      }
    });
    item.addEventListener("pointerdown", async (event) => {
      if (event.button !== 0) return;
      const hasSelectionModifier = event.ctrlKey || event.metaKey || event.shiftKey;
      const isInlineEditorTarget = Boolean((event.target as HTMLElement).closest(".inline-editor"));
      if (isInlineEditorTarget) return;
      if (shouldFinishInlineEditBeforeTabPointerInteraction(state.inlineEdit.field !== null, false)) {
        event.preventDefault();
        event.stopPropagation();
        const finished = await actions.finishCurrentEdit();
        if (finished && tab.id !== actions.getActiveTabId()) await actions.activate(tab.id);
        return;
      }
      if (hasSelectionModifier) {
        event.preventDefault();
        actions.setSelection(applyMultiSelection(
          actions.getSelection(),
          state.tabs.map((candidate) => candidate.id),
          tab.id,
          { ctrlKey: event.ctrlKey || event.metaKey, shiftKey: event.shiftKey },
        ));
        await actions.activate(tab.id);
        return;
      }
      if (!actions.getSelection().selectedIds.includes(tab.id)) {
        actions.setSelection({ selectedIds: [tab.id], anchorId: tab.id });
        this.#syncSelectionClasses(actions.getSelection().selectedIds);
      }
      this.#pointerState = startTabPointerDrag(tab.id, event.clientX, event.clientY);
      item.setPointerCapture(event.pointerId);
    });
    item.addEventListener("pointermove", (event) => {
      if (this.#pointerState.draggedTabId !== tab.id) return;
      this.#pointerState = updateTabPointerDrag(this.#pointerState, event.clientX, event.clientY);
      if (!this.#pointerState.moved) return;
      item.classList.add("is-dragging");
      this.#markSelectedDragging(true);
      item.style.transform = `translate3d(${this.#pointerState.deltaX}px, -4px, 0) scale(1.03)`;
      this.#highlightAt(event.clientX, actions.getSelection().selectedIds);
    });
    item.addEventListener("pointerup", async (event) => {
      if (this.#pointerState.draggedTabId !== tab.id) return;
      item.releasePointerCapture(event.pointerId);
      this.#clearDragAppearance(item);
      const selectedIds = actions.getSelection().selectedIds;
      const targetIndex = this.#targetIndexAt(event.clientX, selectedIds);
      const result = finishTabPointerDrag(this.#pointerState, tab.id, targetIndex);
      this.#pointerState = result.state;
      if (result.action.type === "move") {
        await actions.move(selectedIds, result.action.targetIndex, result.action.tabId);
      } else if (result.action.type === "activate") {
        actions.setSelection({ selectedIds: [result.action.tabId], anchorId: result.action.tabId });
        if (shouldActivateReleasedTab(result.action, actions.getActiveTabId())) {
          await actions.activate(result.action.tabId);
        } else {
          actions.render();
        }
      }
    });
    item.addEventListener("pointercancel", () => {
      this.#pointerState = initialTabPointerState();
      this.#clearDragAppearance(item);
    });
    item.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      actions.openContextMenu(tab.id, event.clientX, event.clientY);
    });
    item.append(this.#renderName(tab, itemState.editing, state, actions));
    return item;
  }

  #renderName(
    tab: TabBarItem,
    editing: boolean,
    state: TabBarRenderState,
    actions: TabBarRenderActions,
  ): HTMLElement {
    if (!editing) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tab-button";
      button.title = `${tabKindLabel(tab.kind)}: ${tab.name}`;
      const icon = createLucideElement(tab.kind === "folder" ? FolderIcon : LinkIcon, {
        width: 16,
        height: 16,
        class: "tab-kind-icon",
        "aria-hidden": "true",
      });
      const label = document.createElement("span");
      label.className = "tab-name-label";
      label.textContent = tab.name;
      button.append(icon, label);
      if (state.selection.selectedIds.length > 1 && state.selection.selectedIds.includes(tab.id)) {
        button.append(createLucideElement(CheckIcon, {
          width: 14,
          height: 14,
          class: "tab-selection-icon",
          "aria-label": "Selected",
        }));
      }
      return button;
    }
    const input = document.createElement("input");
    input.className = "inline-editor tab-inline-editor";
    input.dataset.inlineField = "tabName";
    input.value = state.inlineEdit.draft;
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
      if (actions.isNameEditing(tab.id)) await actions.commitEdit(input.value);
    });
    return input;
  }

  #tabAt(clientX: number, sourceIds: number[]): HTMLElement | null {
    return Array.from(this.list.querySelectorAll<HTMLElement>(".tab-item")).find((node) => {
      if (sourceIds.includes(Number(node.dataset.tabId))) return false;
      const rect = node.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right;
    }) ?? null;
  }

  #targetIndexAt(clientX: number, sourceIds: number[]): number | null {
    const target = this.#tabAt(clientX, sourceIds);
    return target?.dataset.index ? Number(target.dataset.index) : null;
  }

  #highlightAt(clientX: number, sourceIds: number[]): void {
    this.#clearDropHighlights();
    this.#tabAt(clientX, sourceIds)?.classList.add("is-drop-target");
  }

  #clearDropHighlights(): void {
    this.list.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
  }

  #syncSelectionClasses(selectedIds: number[]): void {
    this.list.querySelectorAll<HTMLElement>(".tab-item").forEach((item) => {
      item.classList.toggle("is-selected", selectedIds.includes(Number(item.dataset.tabId)));
    });
  }

  #markSelectedDragging(dragging: boolean): void {
    this.list.querySelectorAll<HTMLElement>(".tab-item.is-selected").forEach((item) => {
      item.classList.toggle("is-group-dragging", dragging);
    });
  }

  #clearDragAppearance(item: HTMLElement): void {
    item.classList.remove("is-dragging");
    this.#markSelectedDragging(false);
    item.style.transform = "";
    this.#clearDropHighlights();
  }
}
