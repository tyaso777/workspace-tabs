import {
  File as FileIcon,
  Folder as FolderIcon,
  Link as LinkIcon,
  createElement as createLucideElement,
} from "lucide";

export type RecentItemView = {
  projectId: number;
  projectName: string;
  tabId: number;
  tabName: string;
  kind: "file" | "folder" | "link";
  target: string;
  label: string;
  linkId: number | null;
  folderId?: number | null;
};
export type RecentItemActions = {
  activateProject: (item: RecentItemView) => void;
  activateTab: (item: RecentItemView) => void;
  open: (item: RecentItemView) => void;
};
export type WorkspaceActivityState = {
  previewText: string;
  recentItems: RecentItemView[];
};

export class WorkspaceActivityRenderer {
  constructor(private readonly elements: {
    preview: HTMLElement;
    recent: HTMLElement;
  }) {}

  render(state: WorkspaceActivityState, actions: RecentItemActions): void {
    this.elements.preview.textContent = state.previewText;
    this.#renderRecent(state.recentItems, actions);
  }

  #renderRecent(items: RecentItemView[], actions: RecentItemActions): void {
    if (items.length === 0) {
      const notice = document.createElement("p");
      notice.className = "notice";
      notice.textContent = "None yet.";
      this.elements.recent.replaceChildren(notice);
      return;
    }
    this.elements.recent.replaceChildren(...items.map((file) => {
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
      path.textContent = file.target;
      const fileName = document.createElement("span");
      fileName.className = "recent-file-name";
      fileName.append(
        createLucideElement(file.kind === "folder" ? FolderIcon : file.kind === "link" ? LinkIcon : FileIcon, {
          width: 15, height: 15, "aria-hidden": "true",
        }),
        document.createTextNode(file.label),
      );
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = "Open";
      openButton.dataset.tooltip = file.kind === "folder" ? "Open this folder" : file.kind === "link" ? "Open this link" : "Open this file";
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
