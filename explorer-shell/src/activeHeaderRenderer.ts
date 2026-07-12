import {
  emptyTabFolderPrompt,
  shouldShowInlineEditPlaceholder,
  type InlineEditField,
  type InlineEditState,
} from "./inlineEdit";

export type HeaderProject = { id: number; name: string; summary: string };
export type HeaderTab =
  | { id: number; name: string; kind: "folder"; folder_path: string }
  | { id: number; name: string; kind: "links" };

export type ActiveHeaderState = {
  project: HeaderProject | null;
  tab: HeaderTab | null;
  linksCount: number;
  inlineEdit: InlineEditState;
  projectEditSurface: "active-header" | "project-list";
  tabNameEditSurface: "tab-bar" | "active-header";
};

export type ActiveHeaderActions = {
  startProjectEdit: (field: "projectName" | "projectSummary") => void;
  startTabNameEdit: (tabId: number) => void;
  updateDraft: (value: string) => void;
  commitProjectEdit: (value: string, cancel?: boolean) => void;
  commitTabEdit: (value: string, cancel?: boolean) => void;
  chooseFolder: () => void;
};

export class ActiveHeaderRenderer {
  constructor(private readonly elements: {
    projectName: HTMLElement;
    projectSummary: HTMLElement;
    tabName: HTMLElement;
    tabKindLabel: HTMLElement;
    tabPath: HTMLElement;
    openFolderButton: HTMLButtonElement;
    addLinkButton: HTMLButtonElement;
    addLinksButton: HTMLButtonElement;
  }) {}

  render(state: ActiveHeaderState, actions: ActiveHeaderActions): void {
    this.#renderProjectField(
      this.elements.projectName,
      "projectName",
      state.project?.name ?? "None",
      state,
      actions,
    );
    this.#renderProjectField(
      this.elements.projectSummary,
      "projectSummary",
      state.project?.summary ?? "",
      state,
      actions,
    );
    const linksMode = state.tab?.kind === "links";
    this.elements.tabKindLabel.textContent = linksMode ? "Links:" : "Folder:";
    this.elements.openFolderButton.hidden = linksMode;
    this.elements.addLinkButton.hidden = !linksMode;
    this.elements.addLinksButton.hidden = !linksMode;
    this.elements.openFolderButton.disabled = state.tab?.kind !== "folder" || !state.tab.folder_path;
    this.#renderTabName(state, actions);
    if (linksMode) {
      this.elements.tabPath.textContent = `${state.linksCount} link${state.linksCount === 1 ? "" : "s"}`;
      this.elements.tabPath.classList.remove("inline-editable-empty");
      this.elements.tabPath.title = "";
    } else {
      this.#renderFolderPath(state.tab?.kind === "folder" ? state.tab.folder_path : "", state, actions);
    }
  }

  #renderProjectField(
    container: HTMLElement,
    field: "projectName" | "projectSummary",
    value: string,
    state: ActiveHeaderState,
    actions: ActiveHeaderActions,
  ): void {
    if (state.inlineEdit.field !== field || state.projectEditSurface !== "active-header") {
      container.textContent = value;
      container.classList.toggle("inline-editable-empty", shouldShowInlineEditPlaceholder(value, false));
      container.title = "Double-click to edit";
      container.ondblclick = () => actions.startProjectEdit(field);
      return;
    }
    container.title = "";
    container.ondblclick = null;
    container.classList.toggle("inline-editable-empty", shouldShowInlineEditPlaceholder(value, true));
    container.replaceChildren(this.#editor(field, state.inlineEdit.draft, actions.commitProjectEdit, actions));
  }

  #renderTabName(state: ActiveHeaderState, actions: ActiveHeaderActions): void {
    const tab = state.tab;
    if (!tab) {
      this.elements.tabName.textContent = "None";
      this.elements.tabName.title = "";
      this.elements.tabName.classList.remove("editable-active-tab-name");
      this.elements.tabName.ondblclick = null;
      return;
    }
    this.elements.tabName.classList.add("editable-active-tab-name");
    if (state.inlineEdit.field !== "tabName" || state.tabNameEditSurface !== "active-header") {
      this.elements.tabName.textContent = tab.name;
      this.elements.tabName.title = "Double-click to edit the tab name";
      this.elements.tabName.ondblclick = () => actions.startTabNameEdit(tab.id);
      return;
    }
    this.elements.tabName.title = "";
    this.elements.tabName.ondblclick = null;
    const input = this.#editor("tabName", state.inlineEdit.draft, actions.commitTabEdit, actions);
    input.classList.add("active-tab-inline-editor");
    this.elements.tabName.replaceChildren(input);
  }

  #renderFolderPath(value: string, state: ActiveHeaderState, actions: ActiveHeaderActions): void {
    const container = this.elements.tabPath;
    if (state.inlineEdit.field !== "tabFolder") {
      if (!value) {
        const prompt = emptyTabFolderPrompt();
        const label = document.createElement("span");
        label.className = "empty-folder-state";
        label.textContent = prompt.state;
        const separator = document.createElement("span");
        separator.className = "empty-folder-separator";
        separator.textContent = " \u00b7 ";
        const action = document.createElement("span");
        action.className = "empty-folder-action";
        action.textContent = prompt.action;
        container.replaceChildren(label, separator, action);
      } else {
        container.textContent = value;
      }
      container.classList.toggle("inline-editable-empty", !value);
      container.title = "Double-click to edit the folder path";
      return;
    }
    container.title = "";
    const wrapper = document.createElement("span");
    wrapper.className = "folder-inline-editor";
    const input = this.#editor("tabFolder", state.inlineEdit.draft, actions.commitTabEdit, actions);
    const choose = document.createElement("button");
    choose.type = "button";
    choose.textContent = "Choose";
    choose.addEventListener("mousedown", (event) => event.preventDefault());
    choose.addEventListener("click", actions.chooseFolder);
    wrapper.append(input, choose);
    container.replaceChildren(wrapper);
  }

  #editor(
    field: InlineEditField,
    value: string,
    commit: (value: string, cancel?: boolean) => void,
    actions: ActiveHeaderActions,
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.className = "inline-editor";
    input.dataset.inlineField = field;
    input.value = value;
    input.addEventListener("input", () => actions.updateDraft(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit(input.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        commit(input.value, true);
      }
    });
    input.addEventListener("blur", () => commit(input.value));
    return input;
  }
}
