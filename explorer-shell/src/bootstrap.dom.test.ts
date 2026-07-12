// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { bootstrapWorkspaceApp, initializeWorkspaceApp } from "./bootstrap";

describe("bootstrapWorkspaceApp DOM", () => {
  it("initializes on DOMContentLoaded and reports a real page close", async () => {
    const registerEvents = vi.fn();
    const pageClosing = vi.fn();
    bootstrapWorkspaceApp({ registerEvents, load: [], pageClosing });

    window.dispatchEvent(new Event("DOMContentLoaded"));
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    await Promise.resolve();

    expect(registerEvents).toHaveBeenCalledOnce();
    expect(pageClosing).toHaveBeenCalledOnce();
  });

  it("mounts, registers, connects, and loads in a stable order", async () => {
    const order: string[] = [];

    await initializeWorkspaceApp({
      mount: () => order.push("mount"),
      registerEvents: () => order.push("register"),
      connectEvents: async () => { order.push("connect"); },
      load: [
        async () => { order.push("storage"); },
        async () => { order.push("workspace"); },
      ],
    });

    expect(order).toEqual(["mount", "register", "connect", "storage", "workspace"]);
  });
});
