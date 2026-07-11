import { describe, expect, it } from "vitest";
import { normalizeProjectSortMode, sortProjectsForDisplay } from "./projectSort";

const projects = [
  { id: 3, name: "Zeta" },
  { id: 1, name: "Beta" },
  { id: 2, name: "alpha" },
];

describe("project sort", () => {
  it("sorts projects by creation order", () => {
    expect(sortProjectsForDisplay(projects, "created").map((project) => project.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it("sorts projects by name", () => {
    expect(sortProjectsForDisplay(projects, "name").map((project) => project.name)).toEqual([
      "alpha",
      "Beta",
      "Zeta",
    ]);
  });

  it("normalizes unknown sort modes to created", () => {
    expect(normalizeProjectSortMode("name")).toBe("name");
    expect(normalizeProjectSortMode("recent")).toBe("created");
    expect(normalizeProjectSortMode(null)).toBe("created");
  });
});
