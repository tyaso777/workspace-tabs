import {
  File as FileIcon,
  Folder as FolderIcon,
  createElement as createLucideElement,
} from "lucide";

export type RecentFileView = {
  projectId: number;
  projectName: string;
  tabId: number;
  tabName: string;
  path: string;
  isDir: boolean;
};
export type RecentFileActions = {
  activateProject: (file: RecentFileView) => void;
  activateTab: (file: RecentFileView) => void;
  open: (file: RecentFileView) => void;
};
export type WorkspaceActivityState = {
  previewText: string;
  recentFiles: RecentFileView[];
};

export class WorkspaceActivityRenderer {
  constructor(private readonly elements: {
    preview: HTMLElement;
    recent: HTMLElement;
  }) {}

  render(state: WorkspaceActivityState, actions: RecentFileActions): void {
    this.elements.preview.textContent = state.previewText;
    this.#renderRecent(state.recentFiles, actions);
  }

  #renderRecent(files: RecentFileView[], actions: RecentFileActions): void {
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
      const projectButton = document.createElement("button");
      projectButton.type = "button";
      projectButton.className = "recent-location";
      projectButton.textContent = file.projectName;
      projectButton.dataset.tooltip = "Move to this project";
      projectButton.addEventListener("click", () => actions.activateProject(file));
      const tabButton = document.createElement("button");
      tabButton.type = "button";
      tabButton.className = "recent-location";
      tabButton.textContent = file.tabName;
      tabButton.dataset.tooltip = "Move to this tab and select the file";
      tabButton.addEventListener("click", () => actions.activateTab(file));
      const path = document.createElement("span");
      path.className = "recent-path";
      path.textContent = file.path;
      const fileName = document.createElement("span");
      fileName.className = "recent-file-name";
      const pathParts = file.path.split(/[\\/]/).filter(Boolean);
      fileName.append(
        createLucideElement(file.isDir ? FolderIcon : FileIcon, {
          width: 15, height: 15, "aria-hidden": "true",
        }),
        document.createTextNode(pathParts[pathParts.length - 1] ?? file.path),
      );
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = "Open";
      openButton.dataset.tooltip = file.isDir ? "Open this folder" : "Open this file";
      openButton.addEventListener("click", () => actions.open(file));
      item.append(
        this.#label("Project"), projectButton,
        this.#label("Tab"), tabButton,
        this.#label("Item"), fileName, openButton,
        path,
      );
      return item;
    }));
  }

  #label(text: string): HTMLElement {
    const label = document.createElement("span");
    label.className = "recent-label";
    label.textContent = text;
    return label;
  }

}
