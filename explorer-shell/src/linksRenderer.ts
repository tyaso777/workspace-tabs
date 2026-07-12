import { linkClickAction, linkEditField } from "./links";

export type LinkRowView = {
  id: number;
  tab_id: number;
  name: string;
  url: string;
  position: number;
};
export type LinkEditingState = { id: number; field: "name" | "url" } | null;
export type LinksRenderState = {
  links: LinkRowView[];
  selectedLinkId: number | null;
  checkedLinkIds: number[];
  editing: LinkEditingState;
  copiedLinkId: number | null;
  errorMessage: string | null;
};
export type LinksRenderActions = {
  toggleChecked: (link: LinkRowView) => void;
  select: (link: LinkRowView) => void;
  open: (link: LinkRowView) => void;
  copy: (link: LinkRowView) => void;
  startEdit: (link: LinkRowView, field: "name" | "url") => void;
  cancelEdit: () => void;
  commitEdit: (link: LinkRowView, field: "name" | "url", value: string) => void;
  openContextMenu: (link: LinkRowView, x: number, y: number) => void;
  move: (linkId: number, targetIndex: number) => void;
};

export class LinksRenderer {
  #draggedLinkId: number | null = null;

  constructor(private readonly list: HTMLElement) {}

  render(state: LinksRenderState, actions: LinksRenderActions): void {
    const notices: HTMLElement[] = [];
    if (state.errorMessage) {
      const notice = document.createElement("p");
      notice.className = "notice is-error";
      notice.textContent = state.errorMessage;
      notices.push(notice);
    }
    if (state.links.length === 0) {
      const notice = document.createElement("p");
      notice.className = "notice";
      notice.textContent = "No links";
      notices.push(notice);
    }
    this.list.replaceChildren(
      ...notices,
      ...state.links.map((link, index) => this.#renderRow(link, index, state, actions)),
    );
  }

  #renderRow(
    link: LinkRowView,
    index: number,
    state: LinksRenderState,
    actions: LinksRenderActions,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "link-row";
    row.dataset.linkId = String(link.id);
    row.tabIndex = 0;
    row.role = "button";
    row.draggable = true;
    row.classList.toggle("is-current", state.selectedLinkId === link.id);
    row.classList.toggle("is-checked", state.checkedLinkIds.includes(link.id));

    const check = document.createElement("button");
    check.type = "button";
    check.className = `file-check ${state.checkedLinkIds.includes(link.id) ? "is-checked" : ""}`;
    check.setAttribute("aria-label", "Check link");
    check.addEventListener("click", (event) => {
      event.stopPropagation();
      if (linkClickAction(event.ctrlKey || event.metaKey, true).toggleChecked) {
        actions.toggleChecked(link);
      }
    });

    const fields = document.createElement("div");
    fields.className = "link-fields";
    fields.append(
      this.#renderField(link, "name", state.editing, actions),
      this.#renderField(link, "url", state.editing, actions),
    );
    const rowActions = document.createElement("div");
    rowActions.className = "link-actions";
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.open(link);
    });
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = state.copiedLinkId === link.id ? "Copied" : "Copy";
    copyButton.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.copy(link);
    });
    rowActions.append(openButton, copyButton);
    row.append(check, fields, rowActions);

    row.addEventListener("click", (event) => {
      const action = linkClickAction(event.ctrlKey || event.metaKey, false);
      if (action.toggleChecked) actions.toggleChecked(link);
      else if (action.select) actions.select(link);
    });
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      actions.openContextMenu(link, event.clientX, event.clientY);
    });
    row.addEventListener("dragstart", (event) => {
      if ((event.target as HTMLElement).closest("button, input")) {
        event.preventDefault();
        return;
      }
      this.#draggedLinkId = link.id;
      row.classList.add("is-dragging");
      event.dataTransfer?.setData("text/plain", String(link.id));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", (event) => {
      if (this.#draggedLinkId === null || this.#draggedLinkId === link.id) return;
      event.preventDefault();
      row.classList.add("is-drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("is-drop-target");
      const sourceId = this.#draggedLinkId;
      this.#draggedLinkId = null;
      if (sourceId !== null && sourceId !== link.id) actions.move(sourceId, index);
    });
    row.addEventListener("dragend", () => {
      this.#draggedLinkId = null;
      row.classList.remove("is-dragging");
      this.list.querySelectorAll(".is-drop-target")
        .forEach((node) => node.classList.remove("is-drop-target"));
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      actions.select(link);
    });
    return row;
  }

  #renderField(
    link: LinkRowView,
    field: "name" | "url",
    editing: LinkEditingState,
    actions: LinksRenderActions,
  ): HTMLElement {
    if (editing?.id === link.id && editing.field === field) {
      const input = document.createElement("input");
      input.className = "link-inline-editor";
      input.dataset.linkEditor = field;
      input.value = link[field];
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          actions.commitEdit(link, field, input.value);
        } else if (event.key === "Escape") {
          actions.cancelEdit();
        }
      });
      input.addEventListener("blur", () => actions.commitEdit(link, field, input.value));
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
      if (editField) actions.startEdit(link, editField);
    });
    return value;
  }
}
