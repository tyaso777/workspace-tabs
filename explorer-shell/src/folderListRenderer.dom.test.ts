// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  FolderListRenderer,
  type FolderListRenderActions,
  type FolderListRenderState,
} from "./folderListRenderer";

const entries = [
  { name: "docs", path: "C:\\work\\docs", is_dir: true },
  { name: "readme.txt", path: "C:\\work\\readme.txt", is_dir: false },
];

function state(overrides: Partial<FolderListRenderState> = {}): FolderListRenderState {
  return {
    entries,
    selection: { selectedPath: entries[1].path, selectedPaths: [entries[0].path] },
    errorMessage: null,
    hasActiveTab: true,
    folderPath: "C:\\work",
    ...overrides,
  };
}

function actions(): FolderListRenderActions {
  return {
    scheduleTooltip: vi.fn(),
    hideTooltip: vi.fn(),
    toggleChecked: vi.fn(),
    checkRange: vi.fn(),
    open: vi.fn(),
    select: vi.fn(),
  };
}

describe("FolderListRenderer DOM", () => {
  it("renders directory and file rows with selection state", () => {
    const list = document.createElement("div");
    new FolderListRenderer(list).render(state(), actions());

    expect(list.querySelectorAll(".file-row")).toHaveLength(2);
    expect(list.querySelector(".file-row.is-dir.is-checked")?.textContent).toContain("DIRdocs");
    expect(list.querySelector(".file-row.is-current")?.textContent).toContain("FILEreadme.txt");
    expect(list.querySelectorAll(".file-check")).toHaveLength(2);
  });

  it("renders errors and the empty-workspace notice", () => {
    const list = document.createElement("div");
    new FolderListRenderer(list).render(state({
      entries: [],
      errorMessage: "Folder unavailable",
      hasActiveTab: false,
    }), actions());

    expect(list.querySelector(".notice.is-error")?.textContent).toBe("Folder unavailable");
    expect(list.textContent).toContain("Add a tab with the + button");
  });

  it("routes select, check, range check, and open commands", () => {
    const list = document.createElement("div");
    const handler = actions();
    new FolderListRenderer(list).render(state(), handler);
    const file = list.querySelectorAll<HTMLElement>(".file-row")[1];

    file.click();
    file.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    file.querySelector<HTMLElement>(".file-check")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    file.querySelector<HTMLElement>(".file-open-button")!.click();

    expect(handler.select).toHaveBeenCalledWith(entries[1]);
    expect(handler.toggleChecked).toHaveBeenCalledWith(entries[1]);
    expect(handler.checkRange).toHaveBeenCalledWith(entries[1]);
    expect(handler.open).toHaveBeenCalledWith(entries[1]);
  });

  it("routes tooltip and keyboard interactions", () => {
    const list = document.createElement("div");
    const handler = actions();
    new FolderListRenderer(list).render(state(), handler);
    const directory = list.querySelector<HTMLElement>(".file-row")!;

    directory.dispatchEvent(new MouseEvent("mouseenter"));
    directory.dispatchEvent(new FocusEvent("blur"));
    directory.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(handler.scheduleTooltip).toHaveBeenCalledWith(
      directory,
      "Select this folder or use Open",
    );
    expect(handler.hideTooltip).toHaveBeenCalledOnce();
    expect(handler.select).toHaveBeenCalledWith(entries[0]);
  });
});
