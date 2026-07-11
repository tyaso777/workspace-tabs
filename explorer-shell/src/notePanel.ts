export type NoteView = {
  id: number;
  project_id: number;
  title: string;
  content: string;
  position: number;
};

export function notesForProject<T extends NoteView>(notes: T[], projectId: number): T[] {
  return notes
    .filter((note) => note.project_id === projectId)
    .sort((left, right) => left.position - right.position || left.id - right.id);
}

export function activeNoteForProject<T extends NoteView>(
  notes: T[],
  projectId: number,
  activeNoteId: number | null,
): T | null {
  const projectNotes = notesForProject(notes, projectId);
  return projectNotes.find((note) => note.id === activeNoteId) ?? projectNotes[0] ?? null;
}

export function notePanelView(expanded: boolean) {
  return expanded
    ? {
        className: "notes-panel is-expanded",
        toggleLabel: "⤡",
        toggleTitle: "Compact Notes",
      }
    : {
        className: "notes-panel is-compact",
        toggleLabel: "⤢",
        toggleTitle: "Expand Notes",
      };
}
