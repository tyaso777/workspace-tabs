import { describe, expect, it } from "vitest";
import { noteEditorState, noteListItemState } from "./notePanelRenderer";

describe("noteListItemState", () => {
  it("keeps active and multi-selected state independent", () => {
    expect(noteListItemState(2, 2, [1, 2])).toEqual({ active: true, selected: true });
    expect(noteListItemState(1, 2, [1, 2])).toEqual({ active: false, selected: true });
    expect(noteListItemState(3, 2, [1, 2])).toEqual({ active: false, selected: false });
  });
});

describe("noteEditorState", () => {
  it("only edits the requested field on the active editing note", () => {
    expect(noteEditorState(2, 2, "noteTitle")).toEqual({
      titleEditing: true,
      contentEditing: false,
    });
    expect(noteEditorState(2, 3, "noteTitle")).toEqual({
      titleEditing: false,
      contentEditing: false,
    });
    expect(noteEditorState(2, 2, "noteContent")).toEqual({
      titleEditing: false,
      contentEditing: true,
    });
  });
});
