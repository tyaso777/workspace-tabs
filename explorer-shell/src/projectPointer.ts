export function shouldStartProjectFieldEditFromPointerDown(
  isProjectFieldTarget: boolean,
  clickCount: number,
): boolean {
  return isProjectFieldTarget && clickCount >= 2;
}

export function shouldFinishProjectEditBeforeActivation(
  hasInlineEdit: boolean,
  isInlineEditorTarget: boolean,
): boolean {
  return hasInlineEdit && !isInlineEditorTarget;
}
