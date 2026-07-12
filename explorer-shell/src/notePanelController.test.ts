import { describe, expect, it, vi } from "vitest";
import { NotePanelController } from "./notePanelController";

function harness(
  initialHeight = 190,
  loadedState = { customHeight: null as number | null, maximized: false },
) {
  let renderedHeight = initialHeight;
  let resizing = false;
  const save = vi.fn(async () => undefined);
  const controller = new NotePanelController({
    load: async () => loadedState,
    save,
    geometry: () => ({ viewportHeight: 900, panelTop: 180, panelHeight: renderedHeight }),
    setHeight: (height) => { renderedHeight = height; },
    setResizing: (value) => { resizing = value; },
  });
  return { controller, save, height: () => renderedHeight, resizing: () => resizing };
}

describe("NotePanelController", () => {
  it("loads and applies the saved custom height", async () => {
    const test = harness(190, { customHeight: 275, maximized: false });
    await test.controller.load();
    expect(test.controller.state).toEqual({ customHeight: 275, maximized: false });
    expect(test.height()).toBe(275);
  });

  it("maximizes and restores without losing the custom height", async () => {
    const test = harness(280);
    test.controller.replaceState({ customHeight: 280, maximized: false });
    await test.controller.toggleExpanded();
    expect(test.height()).toBe(560);
    await test.controller.toggleExpanded();
    expect(test.height()).toBe(280);
    expect(test.save).toHaveBeenCalledTimes(2);
  });

  it("turns a drag into a persisted custom height", async () => {
    const test = harness(190);
    expect(test.controller.startResize(7, 300)).toBe(true);
    expect(test.resizing()).toBe(true);
    test.controller.moveResize(7, 390);
    expect(test.height()).toBe(280);
    await test.controller.finishResize(7);
    expect(test.resizing()).toBe(false);
    expect(test.controller.state).toEqual({ customHeight: 280, maximized: false });
    expect(test.save).toHaveBeenLastCalledWith({ customHeight: 280, maximized: false });
  });

  it("ignores events from a different pointer", async () => {
    const test = harness();
    test.controller.startResize(3, 100);
    test.controller.moveResize(4, 300);
    expect(test.height()).toBe(190);
    expect(await test.controller.finishResize(4)).toBe(false);
  });

  it("resets custom and expanded state to the default", async () => {
    const test = harness(400);
    test.controller.replaceState({ customHeight: 400, maximized: true });
    await test.controller.reset();
    expect(test.controller.state).toEqual({ customHeight: null, maximized: false });
    expect(test.height()).toBe(190);
  });
});
