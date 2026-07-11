import { describe, expect, it } from "vitest";
import {
  finishTabPointerDrag,
  initialTabPointerState,
  shouldActivateReleasedTab,
  shouldFinishInlineEditBeforeTabPointerInteraction,
  shouldStartTabNameEditFromMouseDown,
  startTabPointerDrag,
  updateTabPointerDrag,
} from "./tabPointer";

describe("tab pointer interaction", () => {
  it("activates a tab when pointer is released without dragging", () => {
    const started = startTabPointerDrag(3, 100, 20);

    const result = finishTabPointerDrag(started, 3, null);

    expect(result.action).toEqual({ type: "activate", tabId: 3 });
    expect(result.state).toEqual(initialTabPointerState());
  });

  it("does not treat movement at the threshold as a drag", () => {
    const started = startTabPointerDrag(3, 100, 20);
    const moved = updateTabPointerDrag(started, 106, 20);

    const result = finishTabPointerDrag(moved, 3, 1);

    expect(result.action).toEqual({ type: "activate", tabId: 3 });
  });

  it("tracks the pointer delta while dragging", () => {
    const started = startTabPointerDrag(3, 100, 20);

    const moved = updateTabPointerDrag(started, 126, 18);

    expect(moved.deltaX).toBe(26);
    expect(moved.deltaY).toBe(-2);
    expect(moved.moved).toBe(true);
  });

  it("moves a tab when pointer moves past the threshold and has a target", () => {
    const started = startTabPointerDrag(3, 100, 20);
    const moved = updateTabPointerDrag(started, 120, 20);

    const result = finishTabPointerDrag(moved, 3, 1);

    expect(result.action).toEqual({ type: "move", tabId: 3, targetIndex: 1 });
  });

  it("does nothing when a dragged tab is released without a drop target", () => {
    const started = startTabPointerDrag(3, 100, 20);
    const moved = updateTabPointerDrag(started, 120, 20);

    const result = finishTabPointerDrag(moved, 3, null);

    expect(result.action).toEqual({ type: "none" });
  });

  it("ignores pointer up for a different tab", () => {
    const started = startTabPointerDrag(3, 100, 20);

    const result = finishTabPointerDrag(started, 4, null);

    expect(result.action).toEqual({ type: "none" });
  });

  it("starts tab name editing on the second pointer down on a tab name", () => {
    expect(shouldStartTabNameEditFromMouseDown(true, 2)).toBe(true);
  });

  it("does not start tab name editing from a single pointer down", () => {
    expect(shouldStartTabNameEditFromMouseDown(true, 1)).toBe(false);
  });

  it("does not start tab name editing from non-name tab controls", () => {
    expect(shouldStartTabNameEditFromMouseDown(false, 2)).toBe(false);
  });

  it("does not restart tab name editing after the editor has opened", () => {
    expect(shouldStartTabNameEditFromMouseDown(true, 2, true)).toBe(false);
  });

  it("does not reactivate the tab that is already active", () => {
    expect(shouldActivateReleasedTab({ type: "activate", tabId: 3 }, 3)).toBe(false);
  });

  it("activates a different released tab", () => {
    expect(shouldActivateReleasedTab({ type: "activate", tabId: 4 }, 3)).toBe(true);
  });

  it("does not activate for non-activate actions", () => {
    expect(shouldActivateReleasedTab({ type: "none" }, 3)).toBe(false);
  });

  it("finishes inline editing before starting a tab pointer interaction", () => {
    expect(shouldFinishInlineEditBeforeTabPointerInteraction(true, false)).toBe(true);
  });

  it("keeps inline editing active when the pointer target is the editor itself", () => {
    expect(shouldFinishInlineEditBeforeTabPointerInteraction(true, true)).toBe(false);
  });

  it("does not finish inline editing when no edit is active", () => {
    expect(shouldFinishInlineEditBeforeTabPointerInteraction(false, false)).toBe(false);
  });
});
