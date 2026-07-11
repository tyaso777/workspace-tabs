import { describe, expect, it } from "vitest";
import { folderDialogDefaultPath, tabNameAfterFolderChange } from "./tabNaming";

describe("tab naming", () => {
  it("uses the selected Windows folder name for a default New Tab", () => {
    expect(tabNameAfterFolderChange("New Tab", "C:\\Users\\Atsushi\\Documents")).toBe(
      "Documents",
    );
  });

  it("uses the selected slash-separated folder name for a default New Tab", () => {
    expect(tabNameAfterFolderChange("New Tab", "C:/work/client-a")).toBe("client-a");
  });

  it("ignores trailing path separators", () => {
    expect(tabNameAfterFolderChange("New Tab", "C:\\work\\client-a\\")).toBe("client-a");
  });

  it("keeps a user-edited tab name", () => {
    expect(tabNameAfterFolderChange("Research", "C:\\work\\client-a")).toBe("Research");
  });

  it("keeps New Tab when no folder name can be derived", () => {
    expect(tabNameAfterFolderChange("New Tab", "")).toBe("New Tab");
  });

  it("uses the current tab folder as the dialog default path", () => {
    expect(folderDialogDefaultPath("C:\\work\\client-a")).toBe("C:\\work\\client-a");
  });

  it("omits the dialog default path when the tab has no folder", () => {
    expect(folderDialogDefaultPath("")).toBeUndefined();
    expect(folderDialogDefaultPath(null)).toBeUndefined();
  });
});
