import { describe, expect, it, vi } from "vitest";
import { WorkspaceApplicationController } from "./workspaceApplicationController";

describe("WorkspaceApplicationController", () => {
  it("stores the workspace returned by a mutation", async () => {
    let workspace = { version: 1 };
    const controller = new WorkspaceApplicationController({
      getWorkspace: () => workspace,
      setWorkspace: (next) => { workspace = next; },
      onError: vi.fn(),
    });

    expect(await controller.mutate(async (current) => ({ version: current.version + 1 }))).toBe(true);
    expect(workspace.version).toBe(2);
  });

  it("reports command failures without replacing the workspace", async () => {
    let workspace = { version: 1 };
    const onError = vi.fn();
    const controller = new WorkspaceApplicationController({
      getWorkspace: () => workspace,
      setWorkspace: (next) => { workspace = next; },
      onError,
    });

    expect(await controller.mutate(async () => { throw new Error("failed"); })).toBe(false);
    expect(workspace.version).toBe(1);
    expect(onError).toHaveBeenCalledWith("Error: failed");
  });
});
