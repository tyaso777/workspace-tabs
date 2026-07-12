import {
  File as FileIcon,
  Folder as FolderIcon,
  createElement as createLucideElement,
} from "lucide";
import { fileNoticeForActiveTab } from "./fileNotice";
import {
  fileEntryVisual,
  fileRowTooltip,
  shouldShowSelectionCheckbox,
  type FileSelectionState,
} from "./fileSelection";

export type FolderListEntry = {
  name: string;
  path: string;
  is_dir: boolean;
};

export type FolderListRenderState = {
  entries: FolderListEntry[];
  selection: FileSelectionState;
  errorMessage: string | null;
  hasActiveTab: boolean;
  folderPath?: string;
};

export type FolderListRenderActions = {
  scheduleTooltip: (anchor: HTMLElement, text: string) => void;
  hideTooltip: () => void;
  toggleChecked: (entry: FolderListEntry) => void;
  checkRange: (entry: FolderListEntry) => void;
  open: (entry: FolderListEntry) => void;
  select: (entry: FolderListEntry) => void;
};

export class FolderListRenderer {
  constructor(private readonly list: HTMLElement) {}

  render(state: FolderListRenderState, actions: FolderListRenderActions): void {
    const notices: HTMLElement[] = [];
    if (state.errorMessage) {
      const notice = document.createElement("p");
      notice.className = "notice is-error";
      notice.textContent = state.errorMessage;
      notices.push(notice);
    }
    const fileNotice = fileNoticeForActiveTab(state.hasActiveTab, state.folderPath);
    if (fileNotice) {
      const notice = document.createElement("p");
      notice.className = "notice";
      notice.textContent = fileNotice.text;
      notices.push(notice);
    }

    this.list.replaceChildren(
      ...notices,
      ...state.entries.map((entry) => this.#renderEntry(entry, state.selection, actions)),
    );
  }

  #renderEntry(
    entry: FolderListEntry,
    selection: FileSelectionState,
    actions: FolderListRenderActions,
  ): HTMLElement {
    const row = document.createElement("div");
    row.tabIndex = 0;
    row.role = "button";
    row.className = entry.is_dir ? "file-row is-dir" : "file-row";
    const isChecked = selection.selectedPaths.includes(entry.path);
    const isCurrent = selection.selectedPath === entry.path;
    const showCheckbox = shouldShowSelectionCheckbox({ path: entry.path, isDir: entry.is_dir });
    row.classList.toggle("is-current", isCurrent);
    row.classList.toggle("is-checked", isChecked);
    row.classList.toggle("has-file-check", showCheckbox);

    const tooltipText = fileRowTooltip({ path: entry.path, isDir: entry.is_dir });
    const visual = fileEntryVisual({ path: entry.path, isDir: entry.is_dir });
    const check = document.createElement("button");
    check.type = "button";
    check.className = `file-check ${isChecked ? "is-checked" : ""}`;
    check.setAttribute("aria-label", `Check ${entry.is_dir ? "folder" : "file"}`);
    const kind = document.createElement("span");
    kind.className = `file-kind is-${visual.icon}`;
    kind.append(
      createLucideElement(entry.is_dir ? FolderIcon : FileIcon, {
        width: 16,
        height: 16,
        class: "file-kind-icon",
        "aria-hidden": "true",
      }),
      document.createTextNode(visual.label),
    );
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "file-open-button";
    openButton.textContent = "Open";
    row.replaceChildren(...(showCheckbox ? [check] : []), kind, name, openButton);

    row.addEventListener("mouseenter", () => actions.scheduleTooltip(row, tooltipText));
    row.addEventListener("mouseleave", actions.hideTooltip);
    row.addEventListener("focus", () => actions.scheduleTooltip(row, tooltipText));
    row.addEventListener("blur", actions.hideTooltip);
    check.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) actions.checkRange(entry);
      else actions.toggleChecked(entry);
    });
    openButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions.open(entry);
    });
    row.addEventListener("click", (event) => {
      if (event.shiftKey) actions.checkRange(entry);
      else if (event.ctrlKey || event.metaKey) actions.toggleChecked(entry);
      else actions.select(entry);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      actions.select(entry);
    });
    return row;
  }
}
