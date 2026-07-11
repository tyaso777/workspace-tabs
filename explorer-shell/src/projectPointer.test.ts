import { describe, expect, it } from "vitest";
import {
  shouldFinishProjectEditBeforeActivation,
  shouldStartProjectFieldEditFromPointerDown,
} from "./projectPointer";

describe("project pointer interaction", () => {
  it("starts project field editing on the second pointer down", () => {
    expect(shouldStartProjectFieldEditFromPointerDown(true, 2)).toBe(true);
  });

  it("does not start project field editing on a single pointer down", () => {
    expect(shouldStartProjectFieldEditFromPointerDown(true, 1)).toBe(false);
  });

  it("ignores non-project-field targets", () => {
    expect(shouldStartProjectFieldEditFromPointerDown(false, 2)).toBe(false);
  });

  it("finishes an existing project edit before activating another project", () => {
    expect(shouldFinishProjectEditBeforeActivation(true, false)).toBe(true);
  });

  it("keeps editing when the current inline editor is clicked", () => {
    expect(shouldFinishProjectEditBeforeActivation(true, true)).toBe(false);
  });

  it("does not intercept project activation when no inline edit exists", () => {
    expect(shouldFinishProjectEditBeforeActivation(false, false)).toBe(false);
  });
});
