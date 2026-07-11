import { describe, expect, it } from "vitest";
import { sidebarView } from "./sidebar";

describe("sidebarView", () => {
  it("keeps the full app shell when the sidebar is open", () => {
    expect(sidebarView(false)).toEqual({
      shellClassName: "app-shell",
      toggleLabel: "<",
      toggleTitle: "Hide project sidebar",
    });
  });

  it("uses a collapsed shell and restore label when the sidebar is closed", () => {
    expect(sidebarView(true)).toEqual({
      shellClassName: "app-shell is-sidebar-collapsed",
      toggleLabel: ">",
      toggleTitle: "Show project sidebar",
    });
  });
});
