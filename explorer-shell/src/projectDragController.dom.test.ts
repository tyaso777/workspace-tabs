// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { ProjectDragController } from "./projectDragController";

function projectItem(id: number, top: number) {
  const item = document.createElement("div");
  item.className = "project-item";
  item.dataset.projectId = String(id);
  item.getBoundingClientRect = () => ({
    x: 0, y: top, left: 0, right: 100, top, bottom: top + 20, width: 100, height: 20,
    toJSON: () => ({}),
  });
  Object.assign(item, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  });
  return item;
}

describe("ProjectDragController DOM", () => {
  it("moves selected projects and persists after a drop", async () => {
    const list = document.createElement("div");
    const first = projectItem(1, 0);
    const second = projectItem(2, 20);
    const third = projectItem(3, 40);
    list.append(first, second, third);
    let customOrder = [1, 2, 3];
    const persist = vi.fn(async () => undefined);
    const render = vi.fn();
    const controller = new ProjectDragController(list, {
      getState: () => ({
        sortMode: "custom",
        inlineEditing: false,
        selection: { selectedIds: [1], anchorId: 1 },
        projectIds: [1, 2, 3],
        customOrder,
      }),
      setCustomOrder: (order) => { customOrder = order; },
      setClickSuppressed: vi.fn(),
      render,
      persist,
    });
    controller.bind(first, 1);

    first.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientY: 0 }));
    first.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientY: 30 }));
    expect(second.classList.contains("is-drop-after")).toBe(true);
    first.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientY: 30 }));
    await Promise.resolve();

    expect(customOrder).toEqual([2, 1, 3]);
    expect(render).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();
    expect(first.classList.contains("is-dragging")).toBe(false);
  });

  it("does not start dragging outside Custom sort", () => {
    const list = document.createElement("div");
    const item = projectItem(1, 0);
    list.append(item);
    const controller = new ProjectDragController(list, {
      getState: () => ({
        sortMode: "name",
        inlineEditing: false,
        selection: { selectedIds: [1], anchorId: 1 },
        projectIds: [1],
        customOrder: [1],
      }),
      setCustomOrder: vi.fn(),
      setClickSuppressed: vi.fn(),
      render: vi.fn(),
      persist: vi.fn(async () => undefined),
    });
    controller.bind(item, 1);

    item.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));

    expect(item.setPointerCapture).not.toHaveBeenCalled();
  });

  it("clears drag appearance and drop indicators on pointercancel", () => {
    const list = document.createElement("div");
    const first = projectItem(1, 0);
    const second = projectItem(2, 20);
    list.append(first, second);
    const controller = new ProjectDragController(list, {
      getState: () => ({
        sortMode: "custom",
        inlineEditing: false,
        selection: { selectedIds: [1], anchorId: 1 },
        projectIds: [1, 2],
        customOrder: [1, 2],
      }),
      setCustomOrder: vi.fn(),
      setClickSuppressed: vi.fn(),
      render: vi.fn(),
      persist: vi.fn(async () => undefined),
    });
    controller.bind(first, 1);

    first.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientY: 0 }));
    first.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientY: 30 }));
    first.dispatchEvent(new MouseEvent("pointercancel", { bubbles: true }));

    expect(first.classList.contains("is-dragging")).toBe(false);
    expect(second.classList.contains("is-drop-after")).toBe(false);
    expect(first.style.transform).toBe("");
  });
});
