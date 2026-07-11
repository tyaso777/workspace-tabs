import { describe, expect, it } from "vitest";
import {
  checkFileRange,
  fileOpenAction,
  fileRowTooltip,
  initialFileSelectionState,
  previewTargetPath,
  pruneCheckedPaths,
  pruneSelectedPath,
  selectSingleFileEntry,
  shouldShowSelectionCheckbox,
  toggleCheckedFileEntry,
} from "./fileSelection";

describe("file selection", () => {
  it("selects one file without changing checked files", () => {
    const state = selectSingleFileEntry(
      { ...initialFileSelectionState(), selectedPaths: ["C:\\work\\checked.txt"] },
      { path: "C:\\work\\memo.txt", isDir: false },
    );

    expect(state.selectedPath).toBe("C:\\work\\memo.txt");
    expect(state.selectedPaths).toEqual(["C:\\work\\checked.txt"]);
    expect(previewTargetPath(state)).toBe("C:\\work\\memo.txt");
  });

  it("selects a folder without checking it", () => {
    const state = selectSingleFileEntry(initialFileSelectionState(), {
      path: "C:\\work\\docs",
      isDir: true,
    });

    expect(state.selectedPath).toBe("C:\\work\\docs");
    expect(state.selectedPaths).toEqual([]);
  });

  it("toggles files from checkbox clicks", () => {
    const first = toggleCheckedFileEntry(
      { ...initialFileSelectionState(), selectedPath: "C:\\work\\preview.txt" },
      {
        path: "C:\\work\\a.txt",
        isDir: false,
      },
    );
    const second = toggleCheckedFileEntry(first, { path: "C:\\work\\b.txt", isDir: false });
    const third = toggleCheckedFileEntry(second, { path: "C:\\work\\a.txt", isDir: false });

    expect(second.selectedPaths).toEqual(["C:\\work\\a.txt", "C:\\work\\b.txt"]);
    expect(second.selectedPath).toBe("C:\\work\\b.txt");
    expect(third.selectedPaths).toEqual(["C:\\work\\b.txt"]);
  });

  it("checks a continuous file range while ignoring folders", () => {
    const entries = [
      { path: "C:\\work\\a.txt", isDir: false },
      { path: "C:\\work\\docs", isDir: true },
      { path: "C:\\work\\b.txt", isDir: false },
      { path: "C:\\work\\c.txt", isDir: false },
    ];
    const anchored = toggleCheckedFileEntry(initialFileSelectionState(), entries[0]);
    const ranged = checkFileRange(anchored, entries, entries[3]);

    expect(ranged.selectedPaths).toEqual([
      "C:\\work\\a.txt",
      "C:\\work\\b.txt",
      "C:\\work\\c.txt",
    ]);
    expect(ranged.selectedPath).toBe("C:\\work\\c.txt");
    expect(ranged.checkedAnchorPath).toBe("C:\\work\\a.txt");
  });

  it("does not toggle folders into checked files", () => {
    const state = toggleCheckedFileEntry(initialFileSelectionState(), {
      path: "C:\\work\\docs",
      isDir: true,
    });

    expect(state.selectedPaths).toEqual([]);
    expect(state.selectedPath).toBeNull();
  });

  it("shows checkboxes only for files", () => {
    expect(shouldShowSelectionCheckbox({ path: "C:\\work\\a.txt", isDir: false })).toBe(true);
    expect(shouldShowSelectionCheckbox({ path: "C:\\work\\docs", isDir: true })).toBe(false);
  });

  it("uses the explicit Open button for files and folders", () => {
    expect(fileOpenAction({ path: "C:\\work\\docs", isDir: true })).toBe(
      "openFolderExternally",
    );
    expect(fileOpenAction({ path: "C:\\work\\a.txt", isDir: false })).toBe("openFile");
  });

  it("describes the explicit row action for hover tooltips", () => {
    expect(fileRowTooltip({ path: "C:\\work\\a.txt", isDir: false })).toBe(
      "Select this file or use Open",
    );
    expect(fileRowTooltip({ path: "C:\\work\\docs", isDir: true })).toBe(
      "Select this folder or use Open",
    );
  });

  it("keeps preview on the row-selected file even when multiple files are checked", () => {
    const state = {
      selectedPath: "C:\\work\\preview.txt",
      selectedPaths: ["C:\\work\\a.txt", "C:\\work\\b.txt"],
      checkedAnchorPath: "C:\\work\\a.txt",
    };

    expect(previewTargetPath(state)).toBe("C:\\work\\preview.txt");
  });

  it("removes checked paths that no longer exist in the loaded folder entries", () => {
    expect(
      pruneCheckedPaths(["C:\\work\\a.txt", "C:\\work\\missing.txt"], [
        { path: "C:\\work\\docs", isDir: true },
        { path: "C:\\work\\a.txt", isDir: false },
      ]),
    ).toEqual(["C:\\work\\a.txt"]);
  });

  it("clears selected path when it no longer exists in the loaded folder entries", () => {
    expect(
      pruneSelectedPath("C:\\work\\missing.txt", [
        { path: "C:\\work\\a.txt", isDir: false },
      ]),
    ).toBeNull();
  });

  it("keeps selected path when it still exists as a file or folder entry", () => {
    expect(
      pruneSelectedPath("C:\\work\\docs", [{ path: "C:\\work\\docs", isDir: true }]),
    ).toBe("C:\\work\\docs");
  });
});
