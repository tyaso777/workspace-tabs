import type { FileSelectionState } from "./fileSelection";

export type ActivityLink = { id: number; name: string; url: string };
export type RecentFileView = { path: string };
export type WorkspaceActivityState = {
  tabKind: "folder" | "links" | null;
  checkedLinks: ActivityLink[];
  selectedLink: ActivityLink | null;
  fileSelection: FileSelectionState;
  previewText: string;
  recentFiles: RecentFileView[];
};

export class WorkspaceActivityRenderer {
  constructor(private readonly elements: {
    checked: HTMLElement;
    selected: HTMLElement;
    preview: HTMLElement;
    recent: HTMLElement;
    openCheckedButton: HTMLButtonElement;
    openSelectedButton: HTMLButtonElement;
  }) {}

  render(state: WorkspaceActivityState, openRecent: (path: string) => void): void {
    const linksMode = state.tabKind === "links";
    this.elements.openCheckedButton.textContent = linksMode ? "Open Links" : "Open Checked";
    this.elements.openCheckedButton.disabled = linksMode
      ? state.checkedLinks.length === 0
      : state.fileSelection.selectedPaths.length === 0;
    this.elements.openSelectedButton.disabled = linksMode
      ? state.selectedLink === null
      : state.fileSelection.selectedPath === null;
    this.#renderChecked(state);
    this.elements.selected.textContent = linksMode
      ? state.selectedLink?.url ?? "None"
      : state.fileSelection.selectedPath ?? "None";
    this.elements.preview.textContent = state.previewText;
    this.#renderRecent(state.recentFiles, openRecent);
  }

  #renderChecked(state: WorkspaceActivityState): void {
    if (state.tabKind === "links") {
      if (state.checkedLinks.length === 0) {
        this.elements.checked.textContent = "None";
        return;
      }
      this.elements.checked.replaceChildren(
        this.#summary(`${state.checkedLinks.length} link${state.checkedLinks.length === 1 ? "" : "s"} checked`),
        this.#list(state.checkedLinks.map((link) => link.name)),
      );
      return;
    }
    const paths = state.fileSelection.selectedPaths;
    if (paths.length === 0) {
      this.elements.checked.textContent = "None";
    } else if (paths.length === 1) {
      this.elements.checked.textContent = paths[0];
    } else {
      this.elements.checked.replaceChildren(
        this.#summary(`${paths.length} items checked`),
        this.#list(paths),
      );
    }
  }

  #renderRecent(files: RecentFileView[], openRecent: (path: string) => void): void {
    if (files.length === 0) {
      const notice = document.createElement("p");
      notice.className = "notice";
      notice.textContent = "None yet.";
      this.elements.recent.replaceChildren(notice);
      return;
    }
    this.elements.recent.replaceChildren(...files.map((file) => {
      const item = document.createElement("div");
      item.className = "recent-item";
      const path = document.createElement("span");
      path.textContent = file.path;
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = "Open";
      openButton.addEventListener("click", () => openRecent(file.path));
      item.append(path, openButton);
      return item;
    }));
  }

  #summary(text: string): HTMLElement {
    const summary = document.createElement("strong");
    summary.textContent = text;
    return summary;
  }

  #list(values: string[]): HTMLElement {
    const list = document.createElement("ul");
    list.className = "path-list";
    values.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      list.append(item);
    });
    return list;
  }
}
