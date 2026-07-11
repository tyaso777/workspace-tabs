import { describe, expect, it } from "vitest";
import capability from "../src-tauri/capabilities/default.json";
import tauriConfig from "../src-tauri/tauri.conf.json";

type Capability = {
  windows: string[];
  permissions: string[];
};

describe("Desktop capability", () => {
  it("allows the main window to close through the Tauri window API", () => {
    const desktopCapability = capability as Capability;

    expect(desktopCapability.windows).toContain("main");
    expect(desktopCapability.permissions).toContain("core:window:allow-close");
  });

  it("keeps installer bundle generation disabled for portable distribution", () => {
    expect(tauriConfig.bundle.active).toBe(false);
  });
});
