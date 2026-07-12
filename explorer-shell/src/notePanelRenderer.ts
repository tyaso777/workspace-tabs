import {
  Maximize2 as MaximizeIcon,
  Minimize2 as RestoreIcon,
  createElement as createLucideElement,
} from "lucide";
import { notePanelView, type NotePanelState, type NoteView } from "./notePanel";
import {
  shouldFinishNoteEditBeforeSelection,
  shouldStartNoteTitleEditFromPointerDown,
} from "./notePointer";
import type { InlineEditState } from "./inlineEdit";

type NoteEditField = "noteTitle" | "noteContent";

export type NotePanelElements = {
  panel: HTMLElement;
  count: HTMLElement;
  list: HTMLElement;
  detail: HTMLElement;
  title: HTMLElement;
  content: HTMLElement;
  addButton: HTMLButtonElement;
  deleteButton: HTMLButtonElement;
  toggleSizeButton: HTMLButtonElement;
};

export type NotePanelRenderState = {
  hasProject: boolean;
  notes: NoteView[];
  activeNote: NoteView | null;
  selectedIds: number[];
  panelState: NotePanelState;
  inlineEdit: InlineEditState;
  editingNoteId: number | null;
};

export type NotePanelRenderActions = {
  applyHeight: () => void;
  enqueue: (interaction: () => Promise<void> | void) => void;
  finishCurrentEdit: () => Promise<boolean>;
  selectFromPointer: (
    noteId: number,
    event: Pick<MouseEvent, "ctrlKey" | "metaKey" | "shiftKey">,
  ) => Promise<void>;
  startTitleEditFromList: (noteId: number) => Promise<void>;
  prepareContextMenu: (noteId: number, pointerX: number, pointerY: number) => Promise<void>;
  startEdit: (field: NoteEditField) => void;
  updateDraft: (value: string) => void;
  commitEdit: (value: string, cancel?: boolean) => Promise<void>;
  isEditing: (noteId: number, field: NoteEditField) => boolean;
};

export function noteListItemState(noteId: number, activeNoteId: number | null, selectedIds: number[]) {
  return {
    active: noteId === activeNoteId,
    selected: selectedIds.includes(noteId),
  };
}

export function noteEditorState(
  noteId: number,
  editingNoteId: number | null,
  field: InlineEditState["field"],
) {
  return {
    titleEditing: editingNoteId === noteId && field === "noteTitle",
    contentEditing: editingNoteId === noteId && field === "noteContent",
  };
}

export class NotePanelRenderer {
  #suppressClickId: number | null = null;
  #suppressContextMenuId: number | null = null;

  constructor(private readonly elements: NotePanelElements) {}

  render(state: NotePanelRenderState, actions: NotePanelRenderActions): void {
    const view = notePanelView(state.panelState);
    const resizing = this.elements.panel.classList.contains("is-resizing");
    this.elements.panel.className = `${view.className}${resizing ? " is-resizing" : ""}`;
    this.elements.count.textContent = `(${state.notes.length})`;
    this.elements.toggleSizeButton.replaceChildren(
      createLucideElement(state.panelState.maximized ? RestoreIcon : MaximizeIcon, {
        width: 17,
        height: 17,
        "aria-hidden": "true",
      }),
    );
    this.elements.toggleSizeButton.title = view.toggleTitle;
    this.elements.toggleSizeButton.setAttribute("aria-label", view.toggleTitle);
    this.elements.addButton.disabled = !state.hasProject;
    this.elements.deleteButton.disabled = !state.activeNote;
    actions.applyHeight();

    this.elements.list.replaceChildren(
      ...state.notes.map((note) => this.#renderListItem(note, state, actions)),
    );

    this.elements.detail.classList.toggle("is-empty", !state.activeNote);
    if (!state.activeNote) {
      this.elements.title.textContent = "No notes";
      this.elements.title.title = "";
      this.elements.content.textContent = "No content";
      this.elements.content.title = "";
      return;
    }
    this.#renderTitle(state.activeNote, state, actions);
    this.#renderContent(state.activeNote, state, actions);
  }

  #renderListItem(
    note: NoteView,
    state: NotePanelRenderState,
    actions: NotePanelRenderActions,
  ): HTMLButtonElement {
    const itemState = noteListItemState(note.id, state.activeNote?.id ?? null, state.selectedIds);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-list-item";
    button.classList.toggle("is-active", itemState.active);
    button.classList.toggle("is-selected", itemState.selected);
    button.setAttribute("aria-pressed", String(itemState.selected));
    button.title = note.title;
    const title = document.createElement("span");
    title.className = "note-list-title";
    title.textContent = note.title;
    const selectionIndicator = document.createElement("span");
    selectionIndicator.className = "selection-indicator";
    selectionIndicator.textContent = itemState.selected ? "\u2713" : "";
    selectionIndicator.setAttribute("aria-hidden", "true");
    button.append(title, selectionIndicator);

    button.addEventListener("mousedown", (event) => {
      if (event.button === 2 && state.inlineEdit.field !== null) {
        event.preventDefault();
        event.stopPropagation();
        this.#suppressContextMenuId = note.id;
        actions.enqueue(() => actions.prepareContextMenu(note.id, event.clientX, event.clientY));
        return;
      }
      if (event.button !== 0) return;
      const hasSelectionModifier = event.ctrlKey || event.metaKey || event.shiftKey;
      const shouldStartEdit = shouldStartNoteTitleEditFromPointerDown(
        true,
        event.detail,
        hasSelectionModifier,
      );
      if (shouldFinishNoteEditBeforeSelection(state.inlineEdit.field !== null, false)) {
        const selectionEvent = {
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        };
        event.preventDefault();
        event.stopPropagation();
        this.#suppressClickId = note.id;
        actions.enqueue(async () => {
          if (!(await actions.finishCurrentEdit())) return;
          await actions.selectFromPointer(note.id, selectionEvent);
          if (shouldStartEdit) await actions.startTitleEditFromList(note.id);
        });
        return;
      }
      if (!shouldStartEdit) return;
      event.preventDefault();
      event.stopPropagation();
      this.#suppressClickId = note.id;
      actions.enqueue(() => actions.startTitleEditFromList(note.id));
    });
    button.addEventListener("click", (event) => {
      if (this.#suppressClickId === note.id) {
        this.#suppressClickId = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      this.#suppressClickId = null;
      actions.enqueue(() => actions.selectFromPointer(note.id, event));
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.#suppressContextMenuId === note.id) {
        this.#suppressContextMenuId = null;
        return;
      }
      actions.enqueue(() => actions.prepareContextMenu(note.id, event.clientX, event.clientY));
    });
    return button;
  }

  #renderTitle(note: NoteView, state: NotePanelRenderState, actions: NotePanelRenderActions): void {
    if (!noteEditorState(note.id, state.editingNoteId, state.inlineEdit.field).titleEditing) {
      this.elements.title.textContent = note.title;
      this.elements.title.title = "Double-click to edit note title";
      this.elements.title.ondblclick = () => actions.startEdit("noteTitle");
      return;
    }
    this.elements.title.title = "";
    this.elements.title.ondblclick = null;
    const input = document.createElement("input");
    input.className = "inline-editor note-title-editor";
    input.dataset.inlineField = "noteTitle";
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
      if (actions.isEditing(note.id, "noteTitle")) await actions.commitEdit(input.value);
    });
    this.elements.title.replaceChildren(input);
  }

  #renderContent(note: NoteView, state: NotePanelRenderState, actions: NotePanelRenderActions): void {
    if (!noteEditorState(note.id, state.editingNoteId, state.inlineEdit.field).contentEditing) {
      this.elements.content.textContent = note.content || "No content";
      this.elements.content.classList.toggle("is-empty", note.content.length === 0);
      this.elements.content.title = "Double-click to edit note content";
      this.elements.content.ondblclick = () => actions.startEdit("noteContent");
      return;
    }
    this.elements.content.title = "";
    this.elements.content.ondblclick = null;
    const textarea = document.createElement("textarea");
    textarea.className = "inline-editor note-content-editor";
    textarea.dataset.inlineField = "noteContent";
    textarea.value = state.inlineEdit.draft;
    textarea.addEventListener("input", () => actions.updateDraft(textarea.value));
    textarea.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        await actions.commitEdit(textarea.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        await actions.commitEdit(textarea.value, true);
      }
    });
    textarea.addEventListener("blur", async () => {
      if (actions.isEditing(note.id, "noteContent")) await actions.commitEdit(textarea.value);
    });
    this.elements.content.replaceChildren(textarea);
  }
}
