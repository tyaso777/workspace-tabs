import { describe, expect, it, vi } from "vitest";
import { createProjectsApi } from "./projectsApi";

describe("projectsApi", () => {
  it("maps project operations and preferences to Rust commands", async () => {
    const snapshot = { version: 1 };
    const invoke = vi.fn(async () => snapshot);
    const api = createProjectsApi(invoke);

    await api.create("Alpha", "Summary");
    await api.update(3, "Beta", "Updated");
    await api.deleteMany([3, 4]);
    await api.saveSortMode("name");
    await api.saveCustomOrder([4, 3]);

    expect(invoke.mock.calls).toEqual([
      ["create_project", { name: "Alpha", summary: "Summary" }],
      ["update_project", { projectId: 3, name: "Beta", summary: "Updated" }],
      ["delete_projects", { projectIds: [3, 4] }],
      ["save_project_sort_mode", { mode: "name" }],
      ["save_project_custom_order", { projectIds: [4, 3] }],
    ]);
  });
});
