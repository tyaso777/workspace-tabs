export type FileSelectionState = {
  selectedPath: string | null;
  selectedPaths: string[];
  checkedAnchorPath: string | null;
};

export type FileSelectionEntry = {
  path: string;
  isDir: boolean;
};

export function initialFileSelectionState(): FileSelectionState {
  return {
    selectedPath: null,
    selectedPaths: [],
    checkedAnchorPath: null,
  };
}

export function selectSingleFileEntry(
  state: FileSelectionState,
  entry: FileSelectionEntry,
): FileSelectionState {
  return {
    ...state,
    selectedPath: entry.path,
    checkedAnchorPath: entry.isDir ? null : entry.path,
  };
}

export function toggleCheckedFileEntry(
  state: FileSelectionState,
  entry: FileSelectionEntry,
): FileSelectionState {
  if (entry.isDir) {
    return state;
  }

  const selected = new Set(state.selectedPaths);
  if (selected.has(entry.path)) {
    selected.delete(entry.path);
  } else {
    selected.add(entry.path);
  }

  const selectedPaths = Array.from(selected);
  return {
    ...state,
    selectedPath: entry.path,
    selectedPaths,
    checkedAnchorPath: entry.path,
  };
}

export function checkFileRange(
  state: FileSelectionState,
  entries: FileSelectionEntry[],
  target: FileSelectionEntry,
): FileSelectionState {
  if (target.isDir) return selectSingleFileEntry(state, target);
  const files = entries.filter((entry) => !entry.isDir);
  const anchorPath = state.checkedAnchorPath ?? target.path;
  const anchorIndex = files.findIndex((entry) => entry.path === anchorPath);
  const targetIndex = files.findIndex((entry) => entry.path === target.path);
  if (anchorIndex < 0 || targetIndex < 0) {
    return { ...state, selectedPath: target.path, checkedAnchorPath: target.path };
  }
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  const checked = new Set(state.selectedPaths);
  files.slice(start, end + 1).forEach((entry) => checked.add(entry.path));
  return {
    ...state,
    selectedPath: target.path,
    selectedPaths: [...checked],
    checkedAnchorPath: anchorPath,
  };
}

export function shouldShowSelectionCheckbox(entry: FileSelectionEntry) {
  return !entry.isDir;
}

export function fileOpenAction(entry: FileSelectionEntry) {
  return entry.isDir ? "openFolderExternally" : "openFile";
}

export function fileRowTooltip(entry: FileSelectionEntry) {
  return entry.isDir
    ? "Select this folder or use Open"
    : "Select this file or use Open";
}

export function previewTargetPath(state: FileSelectionState) {
  return state.selectedPath;
}

export function pruneCheckedPaths(
  checkedPaths: string[],
  entries: FileSelectionEntry[],
): string[] {
  const existingFiles = new Set(
    entries.filter((entry) => !entry.isDir).map((entry) => entry.path),
  );
  return checkedPaths.filter((path) => existingFiles.has(path));
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
