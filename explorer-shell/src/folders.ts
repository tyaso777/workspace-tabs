export type FolderInput = { name: string; path: string };

export function parseSingleFolder(nameValue: string, pathValue: string): FolderInput | null {
  const name = nameValue.trim();
  const path = pathValue.trim();
  return path ? { name, path } : null;
}

export function parseFolderLines(value: string): { folders: FolderInput[]; invalidLines: string[] } {
  const folders: FolderInput[] = [];
  const invalidLines: string[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const named = line.match(/^(.+?):\s+((?:[a-zA-Z]:[\\/]|\\\\).+)$/);
    const name = named?.[1].trim() ?? "";
    const path = named?.[2].trim() ?? line;
    if (!path) invalidLines.push(line);
    else folders.push({ name, path });
  }
  return { folders, invalidLines };
}

export function toggleCheckedFolder(ids: number[], folderId: number): number[] {
  return ids.includes(folderId) ? ids.filter((id) => id !== folderId) : [...ids, folderId];
}

export function checkFolderRange(
  orderedIds: number[], checkedIds: number[], anchorId: number, targetId: number,
): number[] {
  const anchorIndex = orderedIds.indexOf(anchorId);
  const targetIndex = orderedIds.indexOf(targetId);
  if (anchorIndex < 0 || targetIndex < 0) return checkedIds;
  const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  const rangeIds = orderedIds.slice(start, end + 1);
  return checkedIds.includes(targetId)
    ? checkedIds.filter((id) => !rangeIds.includes(id))
    : [...new Set([...checkedIds, ...rangeIds])];
}

export function folderIdsForDelete(clickedFolderId: number, checkedFolderIds: number[]) {
  return checkedFolderIds.includes(clickedFolderId) ? [...checkedFolderIds] : [clickedFolderId];
}

export function folderDeleteConfirmation(folders: Array<{ name: string; path: string }>) {
  const labels = folders.map((folder) => folder.name || folder.path);
  return {
    title: folders.length === 1 ? "Delete folder registration?" : `Delete ${folders.length} folder registrations?`,
    detail: `${labels.join("\n")}\n\nThe actual folders and files will not be deleted.`,
    buttonLabel: folders.length === 1 ? "Delete Folder" : `Delete ${folders.length} Folders`,
  };
}
