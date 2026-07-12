// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { ActiveHeaderRenderer, type ActiveHeaderActions } from "./activeHeaderRenderer";

function setup() {
  const elements = {
    projectName: document.createElement("h2"), projectSummary: document.createElement("p"),
    tabName: document.createElement("span"), tabKindLabel: document.createElement("span"),
    tabPath: document.createElement("div"), openFolderButton: document.createElement("button"),
    addLinkButton: document.createElement("button"), addLinksButton: document.createElement("button"),
  };
  const actions: ActiveHeaderActions = {
    startProjectEdit: vi.fn(), startTabNameEdit: vi.fn(), updateDraft: vi.fn(),
    commitProjectEdit: vi.fn(), commitTabEdit: vi.fn(), chooseFolder: vi.fn(),
  };
  return { elements, actions, renderer: new ActiveHeaderRenderer(elements) };
}

describe("ActiveHeaderRenderer DOM", () => {
  it("renders a folder tab and starts project editing", () => {
    const view = setup();
    view.renderer.render({
      project: { id: 1, name: "Alpha", summary: "Summary" },
      tab: { id: 2, name: "Files", kind: "folder", folder_path: "C:\\work" }, linksCount: 0,
      inlineEdit: { field: null, draft: "" }, projectEditSurface: "active-header", tabNameEditSurface: "tab-bar",
    }, view.actions);
    expect(view.elements.projectName.textContent).toBe("Alpha");
    expect(view.elements.tabKindLabel.textContent).toBe("Folder:");
    expect(view.elements.tabPath.textContent).toBe("C:\\work");
    view.elements.projectName.dispatchEvent(new MouseEvent("dblclick"));
    expect(view.actions.startProjectEdit).toHaveBeenCalledWith("projectName");
  });

  it("renders links controls and count", () => {
    const view = setup();
    view.renderer.render({
      project: null, tab: { id: 3, name: "Links", kind: "links" }, linksCount: 2,
      inlineEdit: { field: null, draft: "" }, projectEditSurface: "active-header", tabNameEditSurface: "tab-bar",
    }, view.actions);
    expect(view.elements.tabPath.textContent).toBe("2 links");
    expect(view.elements.openFolderButton.hidden).toBe(true);
    expect(view.elements.addLinkButton.hidden).toBe(false);
  });

  it("renders and commits inline editors", () => {
    const view = setup();
    view.renderer.render({
      project: { id: 1, name: "Alpha", summary: "" }, tab: null, linksCount: 0,
      inlineEdit: { field: "projectName", draft: "Draft" },
      projectEditSurface: "active-header", tabNameEditSurface: "tab-bar",
    }, view.actions);
    const editor = view.elements.projectName.querySelector<HTMLInputElement>("input")!;
    editor.value = "Changed";
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(view.actions.commitProjectEdit).toHaveBeenCalledWith("Changed");
  });
});
