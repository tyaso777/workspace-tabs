import { describe, expect, it } from "vitest";
import { normalizeWindowHeight, normalizeWindowWidth } from "./windowWidth";

describe("window width persistence", () => {
  it("keeps a normal window width", () => {
    expect(normalizeWindowWidth(1280)).toBe(1280);
  });

  it("rounds and clamps the saved window width", () => {
    expect(normalizeWindowWidth(959.4)).toBe(960);
    expect(normalizeWindowWidth(5000)).toBe(3840);
  });

  it("falls back to the minimum width for invalid values", () => {
    expect(normalizeWindowWidth(Number.NaN)).toBe(960);
  });

  it("keeps a normal window height", () => {
    expect(normalizeWindowHeight(720)).toBe(720);
  });

  it("rounds and clamps the saved window height", () => {
    expect(normalizeWindowHeight(559.4)).toBe(560);
    expect(normalizeWindowHeight(3000)).toBe(2160);
  });

  it("falls back to the minimum height for invalid values", () => {
    expect(normalizeWindowHeight(Number.NaN)).toBe(560);
  });
});
