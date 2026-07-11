export function shouldStartNoteTitleEditFromPointerDown(
  isNoteItemTarget: boolean,
  clickCount: number,
  hasSelectionModifier = false,
): boolean {
  return isNoteItemTarget && clickCount >= 2 && !hasSelectionModifier;
}

export function shouldFinishNoteEditBeforeSelection(
  hasInlineEdit: boolean,
  isInlineEditorTarget: boolean,
): boolean {
  return hasInlineEdit && !isInlineEditorTarget;
}

export function noteContextSelection(selectedIds: number[], noteId: number): number[] {
  return selectedIds.includes(noteId) ? [...selectedIds] : [noteId];
}

export function noteDeleteMenuLabel(count: number): string {
  return count > 1 ? `Delete ${count} Notes` : "Delete Note";
}
