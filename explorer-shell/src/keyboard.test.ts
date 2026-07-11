import { describe, expect, it } from "vitest";
import { shouldRunAppUndo } from "./keyboard";

describe("application keyboard shortcuts", () => {
  it("runs app Undo for Ctrl+Z outside an editor", () => {
    expect(shouldRunAppUndo("z", true, false, false, "DIV", false)).toBe(true);
  });

  it("leaves Ctrl+Z to text editors", () => {
    expect(shouldRunAppUndo("z", true, false, false, "INPUT", false)).toBe(false);
    expect(shouldRunAppUndo("z", true, false, false, "TEXTAREA", false)).toBe(false);
    expect(shouldRunAppUndo("z", true, false, false, "DIV", true)).toBe(false);
    expect(shouldRunAppUndo("z", true, false, true, "DIV", false)).toBe(false);
  });
});
