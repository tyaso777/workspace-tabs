import { describe, expect, it } from "vitest";
import {
  noteContextSelection,
  noteDeleteMenuLabel,
  shouldFinishNoteEditBeforeSelection,
  shouldStartNoteTitleEditFromPointerDown,
} from "./notePointer";

describe("note pointer interaction", () => {
  it("starts note title editing on the second pointer down", () => {
    expect(shouldStartNoteTitleEditFromPointerDown(true, 2)).toBe(true);
  });

  it("does not start note title editing from a single pointer down", () => {
    expect(shouldStartNoteTitleEditFromPointerDown(true, 1)).toBe(false);
  });

  it("does not start note title editing outside a note item", () => {
    expect(shouldStartNoteTitleEditFromPointerDown(false, 2)).toBe(false);
  });

  it("keeps Ctrl and Shift double-clicks available for selection", () => {
    expect(shouldStartNoteTitleEditFromPointerDown(true, 2, true)).toBe(false);
  });

  it("finishes an active editor before selecting another note", () => {
    expect(shouldFinishNoteEditBeforeSelection(true, false)).toBe(true);
  });

  it("does not finish editing from a pointer inside the editor", () => {
    expect(shouldFinishNoteEditBeforeSelection(true, true)).toBe(false);
  });

  it("preserves multiple selection when opening a selected note menu", () => {
    expect(noteContextSelection([2, 3], 3)).toEqual([2, 3]);
  });

  it("selects only an unselected note when opening its menu", () => {
    expect(noteContextSelection([2, 3], 4)).toEqual([4]);
  });

  it("shows the delete count for a multiple-note menu action", () => {
    expect(noteDeleteMenuLabel(1)).toBe("Delete Note");
    expect(noteDeleteMenuLabel(3)).toBe("Delete 3 Notes");
  });
});
