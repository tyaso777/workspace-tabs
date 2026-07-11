import { describe, expect, it } from "vitest";
import { shouldRefreshForFolderChange } from "./folderWatch";

describe("folder watch refresh", () => {
  it("refreshes when the event folder matches the active tab folder", () => {
    expect(
      shouldRefreshForFolderChange("C:\\work", { folder_path: "C:\\work" }),
    ).toBe(true);
  });

  it("ignores changes for inactive folders", () => {
    expect(
      shouldRefreshForFolderChange("C:\\work", { folder_path: "C:\\other" }),
    ).toBe(false);
  });

  it("does not refresh when no folder is active", () => {
    expect(shouldRefreshForFolderChange("", { folder_path: "C:\\work" })).toBe(false);
    expect(shouldRefreshForFolderChange(null, { folder_path: "C:\\work" })).toBe(false);
  });
});
