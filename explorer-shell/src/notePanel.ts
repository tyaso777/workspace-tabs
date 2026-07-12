export type NoteView = {
  id: number;
  project_id: number;
  title: string;
  content: string;
  position: number;
};

export type NotePanelState = {
  customHeight: number | null;
  maximized: boolean;
};

export const DEFAULT_NOTE_PANEL_HEIGHT = 190;
export const MIN_NOTE_PANEL_HEIGHT = 150;
export const EXPANDED_CONTENT_RESERVE = 160;

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

export function notePanelView(state: NotePanelState) {
  return state.maximized
    ? { className: "notes-panel is-maximized", toggleTitle: "Restore Notes Height" }
    : {
        className: state.customHeight === null ? "notes-panel is-default" : "notes-panel is-custom",
        toggleTitle: "Expand Notes",
      };
}

export function toggleNotePanelMaximized(state: NotePanelState): NotePanelState {
  return { ...state, maximized: !state.maximized };
}

export function clampNotePanelHeight(height: number, maximumHeight: number): number {
  return Math.min(
    Math.max(height, MIN_NOTE_PANEL_HEIGHT),
    Math.max(MIN_NOTE_PANEL_HEIGHT, maximumHeight),
  );
}

export function expandedNotePanelHeight(viewportHeight: number, panelTop: number): number {
  return Math.max(MIN_NOTE_PANEL_HEIGHT, viewportHeight - panelTop - EXPANDED_CONTENT_RESERVE);
}
