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
    selectedPaths,
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
