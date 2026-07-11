import { describe, expect, it } from "vitest";
import {
  emptyTabFolderPrompt,
  emptyInlineEditState,
  finishInlineEdit,
  shouldShowInlineEditPlaceholder,
  startInlineEdit,
  startTabFolderEditForChoice,
} from "./inlineEdit";

describe("inline edit interaction", () => {
  it("starts editing the visible project name with the current text", () => {
    const state = startInlineEdit("projectName", "Client A");

    expect(state).toEqual({ field: "projectName", draft: "Client A" });
  });

  it("commits trimmed text for the edited field", () => {
    const state = startInlineEdit("projectName", "Client A");

    const result = finishInlineEdit(state, "  Client B  ", { required: true });

    expect(result).toEqual({
      type: "commit",
      field: "projectName",
      value: "Client B",
    });
  });

  it("rejects an empty required project name", () => {
    const state = startInlineEdit("projectName", "Client A");

    const result = finishInlineEdit(state, "   ", { required: true });

    expect(result).toEqual({ type: "invalid", reason: "required" });
  });

  it("cancels editing on Escape", () => {
    const state = startInlineEdit("projectSummary", "Contracts");

    const result = finishInlineEdit(state, "Changed", { cancel: true });

    expect(result).toEqual({ type: "cancel" });
  });

  it("hides the empty-field placeholder while the field is being edited", () => {
    expect(shouldShowInlineEditPlaceholder("", false)).toBe(true);
    expect(shouldShowInlineEditPlaceholder("", true)).toBe(false);
  });

  it("supports editing note content in place", () => {
    const state = startInlineEdit("noteContent", "Line 1\nLine 2");

    const result = finishInlineEdit(state, "  Updated notes  ");

    expect(result).toEqual({
      type: "commit",
      field: "noteContent",
      value: "Updated notes",
    });
  });

  it("supports editing the tab name after creating a new tab", () => {
    const state = startInlineEdit("tabName", "New Tab");

    const result = finishInlineEdit(state, "  Research  ", { required: true });

    expect(result).toEqual({
      type: "commit",
      field: "tabName",
      value: "Research",
    });
  });

  it("allows an empty tab folder while editing in place", () => {
    const state = startInlineEdit("tabFolder", "");

    const result = finishInlineEdit(state, "   ");

    expect(result).toEqual({
      type: "commit",
      field: "tabFolder",
      value: "",
    });
  });

  it("chooses a folder as a tab folder even when another inline edit is active", () => {
    const state = startTabFolderEditForChoice("");

    const result = finishInlineEdit(state, "  C:\\work\\chosen  ");

    expect(result).toEqual({
      type: "commit",
      field: "tabFolder",
      value: "C:\\work\\chosen",
    });
  });

  it("describes an unset tab folder with state and action text", () => {
    expect(emptyTabFolderPrompt()).toEqual({
      state: "No folder selected",
      action: "Double-click to set",
    });
  });

  it("does nothing when no inline edit is active", () => {
    const result = finishInlineEdit(emptyInlineEditState(), "Changed");

    expect(result).toEqual({ type: "cancel" });
  });
});
