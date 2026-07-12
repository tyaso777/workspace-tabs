import { describe, expect, it, vi } from "vitest";
import { createTabsApi } from "./tabsApi";

describe("tabsApi", () => {
  it("maps tab operations to the Rust command contract", async () => {
    const snapshot = { version: 1 };
    const invoke = vi.fn(async () => snapshot);
    const api = createTabsApi(invoke);

    await api.addFolder(2, "Folder", "C:\\work");
    await api.addLinks(2, "Links");
    await api.activate(2, 7);
    await api.rename(2, 7, "Renamed");
    await api.updateFolder(2, 7, "Work", "C:\\next");
    await api.deleteMany(2, [7, 8]);
    await api.moveMany(2, [7, 8], 3);

    expect(invoke.mock.calls).toEqual([
      ["add_tab", { projectId: 2, name: "Folder", folderPath: "C:\\work" }],
      ["add_links_tab", { projectId: 2, name: "Links" }],
      ["activate_tab", { projectId: 2, tabId: 7 }],
      ["update_tab_name", { projectId: 2, tabId: 7, name: "Renamed" }],
      ["update_tab", { projectId: 2, tabId: 7, name: "Work", folderPath: "C:\\next" }],
      ["delete_tabs", { projectId: 2, tabIds: [7, 8] }],
      ["move_tabs", { projectId: 2, tabIds: [7, 8], targetIndex: 3 }],
    ]);
  });
});
