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

  it("routes domain commands through services and stores their workspace", async () => {
    let workspace = { version: 1 };
    const projects = {
      create: vi.fn(async () => ({ version: 2 })),
      update: vi.fn(), deleteMany: vi.fn(), saveSortMode: vi.fn(), saveCustomOrder: vi.fn(),
    };
    const tabs = {
      addFolder: vi.fn(), addLinks: vi.fn(), activate: vi.fn(), rename: vi.fn(),
      updateFolder: vi.fn(), deleteMany: vi.fn(), moveMany: vi.fn(),
    };
    const notes = { add: vi.fn(), update: vi.fn(), activate: vi.fn(), deleteMany: vi.fn() };
    const controller = new WorkspaceApplicationController({
      getWorkspace: () => workspace,
      setWorkspace: (next) => { workspace = next; },
      onError: vi.fn(),
    }, { projects, tabs, notes, invokeWorkspace: vi.fn() });

    await controller.createProject("Alpha", "Summary");

    expect(projects.create).toHaveBeenCalledWith("Alpha", "Summary");
    expect(workspace).toEqual({ version: 2 });
  });

  it("stores workspaces returned by generic domain commands", async () => {
    let workspace = { version: 1 };
    const invokeWorkspace = vi.fn(async () => ({ version: 3 }));
    const controller = new WorkspaceApplicationController({
      getWorkspace: () => workspace,
      setWorkspace: (next) => { workspace = next; },
      onError: vi.fn(),
    }, {
      projects: {} as never,
      tabs: {} as never,
      notes: {} as never,
      invokeWorkspace,
    });

    await controller.invoke("undo_last", { value: 1 });

    expect(invokeWorkspace).toHaveBeenCalledWith("undo_last", { value: 1 });
    expect(workspace).toEqual({ version: 3 });
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
