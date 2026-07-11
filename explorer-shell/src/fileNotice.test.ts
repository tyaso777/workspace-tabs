import { describe, expect, it } from "vitest";
import { fileNoticeForActiveTab } from "./fileNotice";

describe("file notice interaction", () => {
  it("does not offer folder editing when there is no active tab", () => {
    expect(fileNoticeForActiveTab(false, null)).toEqual({
      text: "Add a tab with the + button to show folder contents.",
      doubleClickAction: null,
    });
  });

  it("does not show a file-list notice when the active tab has no folder yet", () => {
    expect(fileNoticeForActiveTab(true, "")).toBeNull();
  });

  it("does not show a notice when the active tab has a folder", () => {
    expect(fileNoticeForActiveTab(true, "C:\\Work")).toBeNull();
  });
});
