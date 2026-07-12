export type FileSelectionState = {
  selectedPath: string | null;
  selectedPaths: string[];
};

export type FileSelectionEntry = {
  path: string;
  isDir: boolean;
};

export function initialFileSelectionState(): FileSelectionState {
  return {
    selectedPath: null,
    selectedPaths: [],
  };
}

export function selectSingleFileEntry(
  state: FileSelectionState,
  entry: FileSelectionEntry,
): FileSelectionState {
  return {
    ...state,
    selectedPath: entry.path,
  };
}

export function toggleCheckedFileEntry(
  state: FileSelectionState,
  entry: FileSelectionEntry,
): FileSelectionState {
  const selected = new Set(state.selectedPaths);
  if (selected.has(entry.path)) {
    selected.delete(entry.path);
  } else {
    selected.add(entry.path);
  }

  const selectedPaths = Array.from(selected);
  return {
    ...state,
    selectedPaths,
  };
}

export function checkFileRange(
  state: FileSelectionState,
  entries: FileSelectionEntry[],
  target: FileSelectionEntry,
): FileSelectionState {
  const anchorPath = state.selectedPath ?? target.path;
  const anchorIndex = entries.findIndex((entry) => entry.path === anchorPath);
  const targetIndex = entries.findIndex((entry) => entry.path === target.path);
  if (anchorIndex < 0 || targetIndex < 0) {
    return toggleCheckedFileEntry(state, target);
  }
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  const checked = new Set(state.selectedPaths);
  const shouldCheck = !checked.has(target.path);
  entries.slice(start, end + 1).forEach((entry) => {
    if (shouldCheck) checked.add(entry.path);
    else checked.delete(entry.path);
  });
  return {
    ...state,
    selectedPaths: [...checked],
  };
}

export function shouldShowSelectionCheckbox(entry: FileSelectionEntry) {
  return Boolean(entry.path);
}

export function fileOpenAction(entry: FileSelectionEntry) {
  return entry.isDir ? "openFolderExternally" : "openFile";
}

export function fileRowTooltip(entry: FileSelectionEntry) {
  return entry.isDir
    ? "Select this folder or use Open"
    : "Select this file or use Open";
}

export function fileEntryVisual(entry: FileSelectionEntry) {
  return entry.isDir
    ? { icon: "folder" as const, label: "DIR" }
    : { icon: "file" as const, label: "FILE" };
}

export function previewTargetPath(state: FileSelectionState) {
  return state.selectedPath;
}

export function pruneCheckedPaths(
  checkedPaths: string[],
  entries: FileSelectionEntry[],
): string[] {
  const existingPaths = new Set(entries.map((entry) => entry.path));
  return checkedPaths.filter((path) => existingPaths.has(path));
}

export function pruneSelectedPath(
  selectedPath: string | null,
  entries: FileSelectionEntry[],
): string | null {
  if (selectedPath === null) {
    return null;
  }

  const exists = entries.some((entry) => entry.path === selectedPath);
  return exists ? selectedPath : null;
}
