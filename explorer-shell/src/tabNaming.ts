export const DEFAULT_TAB_NAME = "New Tab";

export function tabNameAfterFolderChange(currentName: string, folderPath: string) {
  if (currentName !== DEFAULT_TAB_NAME) {
    return currentName;
  }

  const folderName = lastPathSegment(folderPath);
  return folderName || currentName;
}

export function folderDialogDefaultPath(currentFolderPath: string | null | undefined) {
  return currentFolderPath && currentFolderPath.length > 0 ? currentFolderPath : undefined;
}

function lastPathSegment(path: string) {
  const segments = path.split(/[\\/]+/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1];
}
