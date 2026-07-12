// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { LinksRenderer, type LinksRenderActions, type LinksRenderState } from "./linksRenderer";

const links = [
  { id: 1, tab_id: 7, name: "One", url: "https://example.com/one", position: 0 },
  { id: 2, tab_id: 7, name: "Two", url: "https://example.com/two", position: 1 },
];
function state(overrides: Partial<LinksRenderState> = {}): LinksRenderState {
  return {
    links,
    selectedLinkId: 2,
    checkedLinkIds: [1],
    editing: null,
    copiedLinkId: 1,
    errorMessage: null,
    ...overrides,
  };
}
function actions(): LinksRenderActions {
  return {
    toggleChecked: vi.fn(), select: vi.fn(), open: vi.fn(), copy: vi.fn(),
    startEdit: vi.fn(), cancelEdit: vi.fn(), commitEdit: vi.fn(),
    openContextMenu: vi.fn(), move: vi.fn(),
  };
}

describe("LinksRenderer DOM", () => {
  it("renders selected, checked, copied, and empty states", () => {
    const list = document.createElement("div");
    const renderer = new LinksRenderer(list);
    renderer.render(state(), actions());
    expect(list.querySelectorAll(".link-row")).toHaveLength(2);
    expect(list.querySelector(".link-row.is-checked")?.textContent).toContain("Copied");
    expect(list.querySelector(".link-row.is-current")?.textContent).toContain("Two");
    renderer.render(state({ links: [] }), actions());
    expect(list.textContent).toContain("No links");
  });

  it("routes selection, checking, open, copy, and context menu", () => {
    const list = document.createElement("div");
    const handler = actions();
    new LinksRenderer(list).render(state(), handler);
    const row = list.querySelector<HTMLElement>(".link-row")!;
    row.click();
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    row.querySelectorAll<HTMLButtonElement>("button")[1].click();
    row.querySelectorAll<HTMLButtonElement>("button")[2].click();
    row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 12, clientY: 18 }));
    expect(handler.select).toHaveBeenCalledWith(links[0]);
    expect(handler.toggleChecked).toHaveBeenCalledWith(links[0]);
    expect(handler.open).toHaveBeenCalledWith(links[0]);
    expect(handler.copy).toHaveBeenCalledWith(links[0]);
    expect(handler.openContextMenu).toHaveBeenCalledWith(links[0], 12, 18);
  });

  it("starts and commits inline editing", () => {
    const list = document.createElement("div");
    const handler = actions();
    const renderer = new LinksRenderer(list);
    renderer.render(state(), handler);
    list.querySelector<HTMLElement>(".link-name")!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(handler.startEdit).toHaveBeenCalledWith(links[0], "name");

    renderer.render(state({ editing: { id: 1, field: "name" } }), handler);
    const editor = list.querySelector<HTMLInputElement>(".link-inline-editor")!;
    editor.value = "Changed";
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(handler.commitEdit).toHaveBeenCalledWith(links[0], "name", "Changed");
  });

  it("moves a dragged link to the drop index", () => {
    const list = document.createElement("div");
    const handler = actions();
    new LinksRenderer(list).render(state(), handler);
    const rows = list.querySelectorAll<HTMLElement>(".link-row");
    rows[0].dispatchEvent(new Event("dragstart", { bubbles: true }));
    rows[1].dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    rows[1].dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
    expect(handler.move).toHaveBeenCalledWith(1, 1);
  });
});
