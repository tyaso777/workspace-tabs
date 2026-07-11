export function shouldRunAppUndo(
  key: string,
  ctrlKey: boolean,
  metaKey: boolean,
  shiftKey: boolean,
  targetTagName: string,
  isContentEditable: boolean,
) {
  const editingTarget =
    targetTagName === "INPUT" || targetTagName === "TEXTAREA" || isContentEditable;
  return key.toLowerCase() === "z" && (ctrlKey || metaKey) && !shiftKey && !editingTarget;
}
