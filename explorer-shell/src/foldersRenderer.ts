export type FolderRowView = { id: number; tab_id: number; name: string; path: string; position: number };
export type FolderEditingState = { id: number; field: "name" | "path" } | null;
export type FoldersRenderState = {
  folders: FolderRowView[];
  selectedFolderId: number | null;
  checkedFolderIds: number[];
  editing: FolderEditingState;
  copiedFolderId: number | null;
  errorMessage: string | null;
};
export type FoldersRenderActions = {
  toggleChecked: (folder: FolderRowView) => void;
  checkRange: (folder: FolderRowView) => void;
  select: (folder: FolderRowView) => void;
  open: (folder: FolderRowView) => void;
  copy: (folder: FolderRowView) => void;
  startEdit: (folder: FolderRowView, field: "name" | "path") => void;
  cancelEdit: () => void;
  commitEdit: (folder: FolderRowView, field: "name" | "path", value: string) => void;
  openContextMenu: (folder: FolderRowView, x: number, y: number) => void;
  move: (folderId: number, targetIndex: number) => void;
};

export class FoldersRenderer {
  #draggedFolderId: number | null = null;
  constructor(private readonly list: HTMLElement) {}

  render(state: FoldersRenderState, actions: FoldersRenderActions): void {
    const notices: HTMLElement[] = [];
    if (state.errorMessage) notices.push(this.#notice(state.errorMessage, "notice is-error"));
    if (state.folders.length === 0) notices.push(this.#notice("No folders", "notice"));
    this.list.replaceChildren(...notices, ...state.folders.map((folder, index) => this.#row(folder, index, state, actions)));
  }

  #notice(text: string, className: string): HTMLElement {
    const notice = document.createElement("p");
    notice.className = className;
    notice.textContent = text;
    return notice;
  }

  #row(folder: FolderRowView, index: number, state: FoldersRenderState, actions: FoldersRenderActions): HTMLElement {
    const row = document.createElement("div");
    row.className = "link-row folder-shortcut-row";
    row.dataset.folderId = String(folder.id);
    row.tabIndex = 0;
    row.role = "button";
    row.draggable = true;
    row.classList.toggle("is-current", state.selectedFolderId === folder.id);
    row.classList.toggle("is-checked", state.checkedFolderIds.includes(folder.id));

    const check = document.createElement("button");
    check.type = "button";
    check.className = `file-check ${state.checkedFolderIds.includes(folder.id) ? "is-checked" : ""}`;
    check.setAttribute("aria-label", "Check folder");
    check.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.shiftKey) actions.checkRange(folder);
      else actions.toggleChecked(folder);
    });

    const fields = document.createElement("div");
    fields.className = "link-fields";
    fields.append(this.#field(folder, "name", state.editing, actions), this.#field(folder, "path", state.editing, actions));

    const rowActions = document.createElement("div");
    rowActions.className = "link-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Open";
    open.addEventListener("click", (event) => { event.stopPropagation(); actions.open(folder); });
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = state.copiedFolderId === folder.id ? "Copied" : "Copy";
    copy.addEventListener("click", (event) => { event.stopPropagation(); actions.copy(folder); });
    rowActions.append(open, copy);
    row.append(check, fields, rowActions);

    row.addEventListener("click", (event) => {
      if (event.shiftKey) actions.checkRange(folder);
      else if (event.ctrlKey || event.metaKey) actions.toggleChecked(folder);
      else actions.select(folder);
    });
    row.addEventListener("contextmenu", (event) => { event.preventDefault(); actions.openContextMenu(folder, event.clientX, event.clientY); });
    row.addEventListener("dragstart", (event) => {
      if ((event.target as HTMLElement).closest("button, input")) { event.preventDefault(); return; }
      this.#draggedFolderId = folder.id;
      row.classList.add("is-dragging");
      event.dataTransfer?.setData("text/plain", String(folder.id));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", (event) => {
      if (this.#draggedFolderId === null || this.#draggedFolderId === folder.id) return;
      event.preventDefault(); row.classList.add("is-drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
    row.addEventListener("drop", (event) => {
      event.preventDefault(); row.classList.remove("is-drop-target");
      const sourceId = this.#draggedFolderId; this.#draggedFolderId = null;
      if (sourceId !== null && sourceId !== folder.id) actions.move(sourceId, index);
    });
    row.addEventListener("dragend", () => {
      this.#draggedFolderId = null; row.classList.remove("is-dragging");
      this.list.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    });
    return row;
  }

  #field(folder: FolderRowView, field: "name" | "path", editing: FolderEditingState, actions: FoldersRenderActions): HTMLElement {
    if (editing?.id === folder.id && editing.field === field) {
      const input = document.createElement("input");
      input.className = "link-inline-editor";
      input.dataset.folderEditor = field;
      input.value = folder[field];
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); actions.commitEdit(folder, field, input.value); }
        else if (event.key === "Escape") actions.cancelEdit();
      });
      input.addEventListener("blur", () => actions.commitEdit(folder, field, input.value));
      return input;
    }
    const value = document.createElement(field === "name" ? "strong" : "span");
    value.className = field === "name" ? "link-name" : "link-url";
    value.textContent = folder[field];
    value.title = field === "name" ? "Double-click to edit name" : "Double-click to edit folder path";
    value.addEventListener("dblclick", (event) => { event.preventDefault(); event.stopPropagation(); actions.startEdit(folder, field); });
    return value;
  }
}
