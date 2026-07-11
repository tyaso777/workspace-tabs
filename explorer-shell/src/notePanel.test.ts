import { describe, expect, it } from "vitest";
import { activeNoteForProject, notePanelView, notesForProject } from "./notePanel";

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
  it("uses compact mode by default", () => {
    expect(notePanelView(false)).toEqual({
      className: "notes-panel is-compact",
      toggleLabel: "⤢",
      toggleTitle: "Expand Notes",
    });
  });

  it("uses a compact action while expanded", () => {
    expect(notePanelView(true)).toEqual({
      className: "notes-panel is-expanded",
      toggleLabel: "⤡",
      toggleTitle: "Compact Notes",
    });
  });
});
