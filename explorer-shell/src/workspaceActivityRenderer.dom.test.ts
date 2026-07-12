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
      previewText: "Preview", recentFiles: [],
    }, vi.fn());
    expect(view.preview.textContent).toBe("Preview");
  });

  it("renders recent files and routes Open", () => {
    const view = setup();
    const open = vi.fn();
    view.renderer.render({
      previewText: "No preview", recentFiles: [{ path: "C:\\recent.txt" }],
    }, open);
    view.recent.querySelector("button")!.click();
    expect(open).toHaveBeenCalledWith("C:\\recent.txt");
  });
});
