import { describe, expect, it } from "vitest";
import {
  linkEditField,
  linkPreviewText,
  parseLinkLines,
  parseSingleLink,
  toggleCheckedLink,
} from "./links";

describe("links tab", () => {
  it("parses URL-only lines for batch addition", () => {
    expect(
      parseLinkLines("https://example.com\nhttps://example.org/docs"),
    ).toEqual({
      links: [
        { name: "", url: "https://example.com" },
        { name: "", url: "https://example.org/docs" },
      ],
      invalidLines: [],
    });
  });

  it("accepts an optional display name for one link", () => {
    expect(parseSingleLink("  Rust docs  ", " https://doc.rust-lang.org/ ")).toEqual({
      name: "Rust docs",
      url: "https://doc.rust-lang.org/",
    });
    expect(parseSingleLink("", "https://example.com")).toEqual({
      name: "",
      url: "https://example.com",
    });
  });

  it("rejects invalid single URLs and names in batch input", () => {
    expect(parseSingleLink("Example", "not a URL")).toBeNull();
    expect(parseLinkLines("Example https://example.com")).toEqual({
      links: [],
      invalidLines: ["Example https://example.com"],
    });
  });

  it("reports lines without an HTTP URL", () => {
    expect(parseLinkLines("not a URL\nfile:///C:/memo.txt")).toEqual({
      links: [],
      invalidLines: ["not a URL", "file:///C:/memo.txt"],
    });
  });

  it("maps double-clicked fields to inline editing without opening", () => {
    expect(linkEditField("name")).toBe("name");
    expect(linkEditField("url")).toBe("url");
    expect(linkEditField("row")).toBeNull();
  });

  it("toggles checked links independently from the selected link", () => {
    expect(toggleCheckedLink([1, 2], 2)).toEqual([1]);
    expect(toggleCheckedLink([1], 3)).toEqual([1, 3]);
  });

  it("refreshes preview text from the latest edited link values", () => {
    expect(linkPreviewText({ name: "Updated", url: "https://example.com/new" })).toBe(
      "Updated\nhttps://example.com/new",
    );
  });
});
