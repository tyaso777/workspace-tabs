// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { WorkspaceActivityRenderer } from "./workspaceActivityRenderer";

function setup() {
  const checked = document.createElement("div");
  const selected = document.createElement("div");
  const preview = document.createElement("pre");
  const recent = document.createElement("div");
  const openCheckedButton = document.createElement("button");
  const openSelectedButton = document.createElement("button");
  return {
    checked, selected, preview, recent, openCheckedButton, openSelectedButton,
    renderer: new WorkspaceActivityRenderer({
      checked, selected, preview, recent, openCheckedButton, openSelectedButton,
    }),
  };
}

describe("WorkspaceActivityRenderer DOM", () => {
  it("renders folder checked and selected paths", () => {
    const view = setup();
    view.renderer.render({
      tabKind: "folder", checkedLinks: [], selectedLink: null,
      fileSelection: { selectedPath: "C:\\a.txt", selectedPaths: ["C:\\a.txt", "C:\\b.txt"] },
      previewText: "Preview", recentFiles: [],
    }, vi.fn());
    expect(view.checked.textContent).toContain("2 items checked");
    expect(view.selected.textContent).toBe("C:\\a.txt");
    expect(view.preview.textContent).toBe("Preview");
    expect(view.openCheckedButton.textContent).toBe("Open Checked");
    expect(view.openCheckedButton.disabled).toBe(false);
  });

  it("renders links and button states", () => {
    const view = setup();
    const link = { id: 1, name: "Docs", url: "https://example.com" };
    view.renderer.render({
      tabKind: "links", checkedLinks: [link], selectedLink: link,
      fileSelection: { selectedPath: null, selectedPaths: [] },
      previewText: "Docs", recentFiles: [],
    }, vi.fn());
    expect(view.checked.textContent).toContain("1 link checked");
    expect(view.selected.textContent).toBe("https://example.com");
    expect(view.openCheckedButton.textContent).toBe("Open Links");
    expect(view.openSelectedButton.disabled).toBe(false);
  });

  it("renders recent files and routes Open", () => {
    const view = setup();
    const open = vi.fn();
    view.renderer.render({
      tabKind: null, checkedLinks: [], selectedLink: null,
      fileSelection: { selectedPath: null, selectedPaths: [] },
      previewText: "No preview", recentFiles: [{ path: "C:\\recent.txt" }],
    }, open);
    view.recent.querySelector("button")!.click();
    expect(open).toHaveBeenCalledWith("C:\\recent.txt");
  });
});
