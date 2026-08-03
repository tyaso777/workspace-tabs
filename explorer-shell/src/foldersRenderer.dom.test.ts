// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { FoldersRenderer, type FoldersRenderActions } from "./foldersRenderer";

function setup() {
  const list = document.createElement("div");
  const actions: FoldersRenderActions = {
    toggleChecked: vi.fn(), checkRange: vi.fn(), select: vi.fn(), open: vi.fn(), copy: vi.fn(),
    startEdit: vi.fn(), cancelEdit: vi.fn(), commitEdit: vi.fn(),
    openContextMenu: vi.fn(), move: vi.fn(),
  };
  const folder = { id: 7, tab_id: 2, name: "Docs", path: "C:\\work\\docs", position: 0 };
  return { list, actions, folder, renderer: new FoldersRenderer(list) };
}

describe("FoldersRenderer DOM", () => {
  it("renders selection, check, open and copy controls", () => {
    const view = setup();
    view.renderer.render({ folders: [view.folder], selectedFolderId: 7, checkedFolderIds: [7], editing: null, copiedFolderId: null, errorMessage: null }, view.actions);
    const row = view.list.querySelector<HTMLElement>("[data-folder-id='7']")!;
    expect(row.classList.contains("is-current")).toBe(true);
    expect(row.classList.contains("is-checked")).toBe(true);
    const buttons = [...row.querySelectorAll("button")];
    buttons.find((button) => button.textContent === "Open")!.click();
    buttons.find((button) => button.textContent === "Copy")!.click();
    expect(view.actions.open).toHaveBeenCalledWith(view.folder);
    expect(view.actions.copy).toHaveBeenCalledWith(view.folder);
  });

  it("starts inline editing on double click and commits with Enter", () => {
    const view = setup();
    view.renderer.render({ folders: [view.folder], selectedFolderId: null, checkedFolderIds: [], editing: null, copiedFolderId: null, errorMessage: null }, view.actions);
    view.list.querySelector<HTMLElement>(".link-name")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(view.actions.startEdit).toHaveBeenCalledWith(view.folder, "name");

    view.renderer.render({ folders: [view.folder], selectedFolderId: null, checkedFolderIds: [], editing: { id: 7, field: "path" }, copiedFolderId: null, errorMessage: null }, view.actions);
    const input = view.list.querySelector<HTMLInputElement>("[data-folder-editor='path']")!;
    input.value = "D:\\next";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(view.actions.commitEdit).toHaveBeenCalledWith(view.folder, "path", "D:\\next");
  });

  it("opens a context menu without selecting the row", () => {
    const view = setup();
    view.renderer.render({ folders: [view.folder], selectedFolderId: null, checkedFolderIds: [], editing: null, copiedFolderId: null, errorMessage: null }, view.actions);
    view.list.querySelector<HTMLElement>(".folder-shortcut-row")!
      .dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 12, clientY: 24 }));
    expect(view.actions.openContextMenu).toHaveBeenCalledWith(view.folder, 12, 24);
    expect(view.actions.select).not.toHaveBeenCalled();
  });
});
