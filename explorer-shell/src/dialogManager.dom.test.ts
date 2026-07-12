// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { DialogManager } from "./dialogManager";

function dialog() {
  const element = document.createElement("dialog");
  Object.defineProperty(element, "open", { value: false, writable: true });
  element.showModal = vi.fn(() => { element.open = true; });
  element.close = vi.fn(() => {
    element.open = false;
    element.dispatchEvent(new Event("close"));
  });
  return element;
}

describe("DialogManager", () => {
  it("opens a dialog and keeps a defensive copy of its targets", () => {
    const confirm = dialog();
    const manager = new DialogManager({ confirm });
    const targets = [1, 2];

    manager.open("confirm", targets);
    targets.push(3);

    expect(confirm.showModal).toHaveBeenCalledOnce();
    expect(manager.targets("confirm")).toEqual([1, 2]);
  });

  it("consumes targets exactly once", () => {
    const manager = new DialogManager({ confirm: dialog() });
    manager.open("confirm", [4, 5]);

    expect(manager.consumeTargets("confirm")).toEqual([4, 5]);
    expect(manager.consumeTargets("confirm")).toEqual([]);
  });

  it("clears targets when the user closes or cancels the dialog", () => {
    const confirm = dialog();
    const manager = new DialogManager({ confirm });
    manager.open("confirm", [9]);

    confirm.close();

    expect(manager.targets("confirm")).toEqual([]);
  });
});
