import { describe, expect, it } from "vitest";
import {
  activeNoteForProject,
  clampNotePanelHeight,
  expandedNotePanelHeight,
  notePanelView,
  notesForProject,
  toggleNotePanelMaximized,
} from "./notePanel";

const notes = [
  { id: 3, project_id: 2, title: "Third", content: "C", position: 1 },
  { id: 1, project_id: 1, title: "First", content: "A", position: 0 },
  { id: 2, project_id: 2, title: "Second", content: "B", position: 0 },
];

describe("notesForProject", () => {
  it("returns only the project's notes in position order", () => {
    expect(notesForProject(notes, 2).map((note) => note.id)).toEqual([2, 3]);
  });
});

describe("activeNoteForProject", () => {
  it("returns the saved active note", () => {
    expect(activeNoteForProject(notes, 2, 3)?.id).toBe(3);
  });

  it("falls back to the first note", () => {
    expect(activeNoteForProject(notes, 2, null)?.id).toBe(2);
  });
});

describe("notePanelView", () => {
  it("uses default mode when no custom height was saved", () => {
    expect(notePanelView({ customHeight: null, maximized: false })).toEqual({
      className: "notes-panel is-default",
      toggleTitle: "Expand Notes",
    });
  });

  it("offers to restore the previous height while maximized", () => {
    expect(notePanelView({ customHeight: 280, maximized: true })).toEqual({
      className: "notes-panel is-maximized",
      toggleTitle: "Restore Notes Height",
    });
  });
});

describe("toggleNotePanelMaximized", () => {
  it("preserves the custom height across maximize and restore", () => {
    const custom = { customHeight: 280, maximized: false };
    expect(toggleNotePanelMaximized(custom)).toEqual({ customHeight: 280, maximized: true });
    expect(toggleNotePanelMaximized(toggleNotePanelMaximized(custom))).toEqual(custom);
  });
});

describe("clampNotePanelHeight", () => {
  it("keeps a dragged height inside the usable range", () => {
    expect(clampNotePanelHeight(80, 420)).toBe(150);
    expect(clampNotePanelHeight(300, 420)).toBe(300);
    expect(clampNotePanelHeight(700, 420)).toBe(420);
  });
});

describe("expandedNotePanelHeight", () => {
  it("leaves part of the workspace visible below Notes", () => {
    expect(expandedNotePanelHeight(900, 180)).toBe(560);
  });

  it("keeps the panel usable in a short window", () => {
    expect(expandedNotePanelHeight(360, 180)).toBe(150);
  });
});
