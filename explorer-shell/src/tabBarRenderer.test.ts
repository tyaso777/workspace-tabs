import { describe, expect, it } from "vitest";
import { tabItemState } from "./tabBarRenderer";

describe("tabItemState", () => {
  it("keeps active, selected, and editing states independent", () => {
    expect(tabItemState(2, 2, [1, 2], "tabName", "tab-bar")).toEqual({
      active: true,
      selected: true,
      editing: true,
    });
    expect(tabItemState(1, 2, [1, 2], "tabName", "tab-bar")).toEqual({
      active: false,
      selected: true,
      editing: false,
    });
    expect(tabItemState(2, 2, [2], "tabName", "active-header").editing).toBe(false);
  });
});
