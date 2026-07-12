export type RecentFileView = { path: string };
export type WorkspaceActivityState = {
  previewText: string;
  recentFiles: RecentFileView[];
};

export class WorkspaceActivityRenderer {
  constructor(private readonly elements: {
    preview: HTMLElement;
    recent: HTMLElement;
  }) {}

  render(state: WorkspaceActivityState, openRecent: (path: string) => void): void {
    this.elements.preview.textContent = state.previewText;
    this.#renderRecent(state.recentFiles, openRecent);
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

}
