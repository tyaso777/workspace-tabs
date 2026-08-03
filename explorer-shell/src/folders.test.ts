import { describe, expect, it } from "vitest";
import { checkFolderRange, folderDeleteConfirmation, folderIdsForDelete, parseFolderLines, parseSingleFolder, toggleCheckedFolder } from "./folders";

describe("folder registration input", () => {
  it("parses a single folder and permits an omitted display name", () => {
    expect(parseSingleFolder(" Docs ", " C:\\work\\docs ")).toEqual({ name: "Docs", path: "C:\\work\\docs" });
    expect(parseSingleFolder("", "  ")).toBeNull();
  });

  it("checks or unchecks the inclusive anchor range based on the target", () => {
    expect(checkFolderRange([1, 2, 3, 4], [1], 2, 4)).toEqual([1, 2, 3, 4]);
    expect(checkFolderRange([1, 2, 3, 4], [1, 2, 3, 4], 2, 4)).toEqual([1]);
  });

  it("parses named and path-only lines without treating a drive letter as a name", () => {
    expect(parseFolderLines("Docs: C:\\work\\docs\nD:\\shared\nNetwork: \\\\server\\team")).toEqual({
      folders: [
        { name: "Docs", path: "C:\\work\\docs" },
        { name: "", path: "D:\\shared" },
        { name: "Network", path: "\\\\server\\team" },
      ],
      invalidLines: [],
    });
  });
});

describe("folder registration selection", () => {
  it("toggles checks and uses the checked group only when the clicked row belongs to it", () => {
    expect(toggleCheckedFolder([1, 2], 2)).toEqual([1]);
    expect(toggleCheckedFolder([1], 3)).toEqual([1, 3]);
    expect(folderIdsForDelete(2, [1, 2])).toEqual([1, 2]);
    expect(folderIdsForDelete(3, [1, 2])).toEqual([3]);
  });

  it("states that deleting a registration does not delete its real folder", () => {
    expect(folderDeleteConfirmation([{ name: "Docs", path: "C:\\docs" }]).detail)
      .toContain("actual folders and files will not be deleted");
  });
});
