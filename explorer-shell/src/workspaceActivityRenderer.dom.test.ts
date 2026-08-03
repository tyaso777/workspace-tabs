// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { WorkspaceActivityRenderer } from "./workspaceActivityRenderer";

function setup() {
  const preview = document.createElement("pre");
  const recent = document.createElement("div");
  return {
    preview, recent,
    renderer: new WorkspaceActivityRenderer({ preview, recent }),
  };
}

describe("WorkspaceActivityRenderer DOM", () => {
  it("renders preview without duplicating checked or selected state", () => {
    const view = setup();
    view.renderer.render({
      previewText: "Preview", recentItems: [],
    }, { activateProject: vi.fn(), activateTab: vi.fn(), open: vi.fn() });
    expect(view.preview.textContent).toBe("Preview");
  });

  it("labels every recent action, explains it, and routes clicks", () => {
    const view = setup();
    const actions = { activateProject: vi.fn(), activateTab: vi.fn(), open: vi.fn() };
    const file = {
      projectId: 1, projectName: "Project A", tabId: 2, tabName: "Docs",
      kind: "file" as const, target: "C:\\recent.txt", label: "recent.txt", linkId: null,
    };
    view.renderer.render({
      previewText: "No preview", recentItems: [file],
    }, actions);
    const buttons = view.recent.querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual(["Project A", "Docs", "Open"]);
    expect([...view.recent.querySelectorAll(".recent-label")].map((label) => label.textContent))
      .toEqual(["Project", "Tab", "Item"]);
    expect(view.recent.querySelector(".recent-file-name")?.textContent).toBe("recent.txt");
    expect([...buttons].map((button) => button.dataset.tooltip)).toEqual([
      "Move to this project",
      "Move to this tab and select the file",
      "Open this file",
    ]);
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();
    expect(actions.activateProject).toHaveBeenCalledWith(file);
    expect(actions.activateTab).toHaveBeenCalledWith(file);
    expect(actions.open).toHaveBeenCalledWith(file);
  });

  it("identifies a recent folder and explains its Open action", () => {
    const view = setup();
    view.renderer.render({
      previewText: "No preview",
      recentItems: [{
        projectId: 1, projectName: "A", tabId: 2, tabName: "Docs",
        kind: "folder", target: "C:\\work\\assets", label: "assets", linkId: null,
      }],
    }, { activateProject: vi.fn(), activateTab: vi.fn(), open: vi.fn() });
    expect(view.recent.querySelector(".recent-file-name svg")).not.toBeNull();
    expect(view.recent.querySelectorAll("button")[2].dataset.tooltip).toBe("Open this folder");
  });

  it("identifies a recent link and explains its Open action", () => {
    const view = setup();
    view.renderer.render({
      previewText: "No preview",
      recentItems: [{
        projectId: 1, projectName: "A", tabId: 2, tabName: "Links",
        kind: "link", target: "https://example.com", label: "Example", linkId: 3,
      }],
    }, { activateProject: vi.fn(), activateTab: vi.fn(), open: vi.fn() });
    expect(view.recent.querySelector(".recent-file-name")?.textContent).toBe("Example");
    expect(view.recent.querySelectorAll("button")[2].dataset.tooltip).toBe("Open this link");
  });
});
