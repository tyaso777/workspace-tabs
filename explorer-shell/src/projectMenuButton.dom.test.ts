// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createProjectMenuButton } from "./projectMenuButton";

describe("project menu button DOM", () => {
  it("finishes editing before opening the menu at the button", async () => {
    const order: string[] = [];
    const finish = vi.fn(async () => { order.push("finish"); return true; });
    const open = vi.fn(() => order.push("open"));
    const button = createProjectMenuButton(8, "Alpha", finish, open);
    button.getBoundingClientRect = () => ({
      x: 10, y: 20, left: 10, top: 20, right: 40, bottom: 50, width: 30, height: 30,
      toJSON: () => ({}),
    });

    button.click();
    await Promise.resolve();

    expect(order).toEqual(["finish", "open"]);
    expect(open).toHaveBeenCalledWith(8, 40, 54, true);
    expect(button.getAttribute("aria-label")).toBe("Actions for Alpha");
  });

  it("does not open when the current edit cannot finish", async () => {
    const open = vi.fn();
    const button = createProjectMenuButton(8, "Alpha", async () => false, open);

    button.click();
    await Promise.resolve();

    expect(open).not.toHaveBeenCalled();
  });
});
