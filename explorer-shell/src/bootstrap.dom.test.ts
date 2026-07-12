// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { bootstrapWorkspaceApp } from "./bootstrap";

describe("bootstrapWorkspaceApp DOM", () => {
  it("initializes on DOMContentLoaded and reports a real page close", async () => {
    const initialize = vi.fn(async () => undefined);
    const pageClosing = vi.fn();
    bootstrapWorkspaceApp({ initialize, pageClosing });

    window.dispatchEvent(new Event("DOMContentLoaded"));
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    await Promise.resolve();

    expect(initialize).toHaveBeenCalledOnce();
    expect(pageClosing).toHaveBeenCalledOnce();
  });
});
