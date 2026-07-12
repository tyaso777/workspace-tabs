// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  bindProjectItemInteractions,
  type ProjectItemInteractionActions,
} from "./projectItemInteractions";

function actions(): ProjectItemInteractionActions {
  return {
    finishCurrentEdit: vi.fn(async () => true),
    selectFromPointer: vi.fn(async () => undefined),
    activate: vi.fn(async () => undefined),
    openContextMenu: vi.fn(),
  };
}

describe("project item interactions DOM", () => {
  it("selects a project from a normal click", () => {
    const item = document.createElement("div");
    const handler = actions();
    bindProjectItemInteractions(item, 7, {
      hasActiveEdit: false,
      editingThisItem: false,
      suppressClick: () => false,
    }, handler);

    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(handler.selectFromPointer).toHaveBeenCalledWith(7, expect.any(MouseEvent));
  });

  it("preserves Ctrl and Shift modifiers for multi-selection", () => {
    const item = document.createElement("div");
    const handler = actions();
    bindProjectItemInteractions(item, 7, {
      hasActiveEdit: false,
      editingThisItem: false,
      suppressClick: () => false,
    }, handler);

    item.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true, shiftKey: true }));

    expect(handler.selectFromPointer).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ ctrlKey: true, shiftKey: true }),
    );
  });

  it("finishes editing and selects another project from one mousedown", async () => {
    const item = document.createElement("div");
    const handler = actions();
    bindProjectItemInteractions(item, 7, {
      hasActiveEdit: true,
      editingThisItem: false,
      suppressClick: () => false,
    }, handler);

    item.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    await Promise.resolve();

    expect(handler.finishCurrentEdit).toHaveBeenCalledOnce();
    expect(handler.selectFromPointer).toHaveBeenCalledWith(7, expect.any(MouseEvent));
  });

  it("activates from Enter and Space", () => {
    const item = document.createElement("div");
    item.tabIndex = 0;
    const handler = actions();
    bindProjectItemInteractions(item, 7, {
      hasActiveEdit: false,
      editingThisItem: false,
      suppressClick: () => false,
    }, handler);

    item.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    item.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

    expect(handler.activate).toHaveBeenNthCalledWith(1, 7);
    expect(handler.activate).toHaveBeenNthCalledWith(2, 7);
  });

  it("finishes editing before opening the context menu", async () => {
    const item = document.createElement("div");
    const handler = actions();
    bindProjectItemInteractions(item, 7, {
      hasActiveEdit: true,
      editingThisItem: true,
      suppressClick: () => false,
    }, handler);

    item.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 30, clientY: 40 }));
    await Promise.resolve();

    expect(handler.finishCurrentEdit).toHaveBeenCalledOnce();
    expect(handler.openContextMenu).toHaveBeenCalledWith(7, 30, 40);
  });
});
