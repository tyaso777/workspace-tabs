import { describe, expect, it } from "vitest";
import {
  initialProjectPointerState,
  moveProjectsInCustomOrder,
  normalizeProjectSortMode,
  normalizeProjectCustomOrder,
  sortProjectsForDisplay,
  startProjectPointerDrag,
  updateProjectPointerDrag,
} from "./projectSort";

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

  it("uses the saved custom order and appends projects missing from it", () => {
    expect(sortProjectsForDisplay(projects, "custom", [2, 3]).map((project) => project.id))
      .toEqual([2, 3, 1]);
  });

  it("removes stale and duplicate ids from a custom order", () => {
    expect(normalizeProjectCustomOrder([3, 99, 3, 1], projects.map((project) => project.id)))
      .toEqual([3, 1, 2]);
  });

  it("moves selected projects together while preserving their relative order", () => {
    expect(moveProjectsInCustomOrder([1, 2, 3, 4, 5], [2, 4], 5)).toEqual([1, 3, 2, 4, 5]);
    expect(moveProjectsInCustomOrder([1, 2, 3, 4, 5], [2, 4], 1, true)).toEqual([1, 2, 4, 3, 5]);
  });

  it("starts moving only after the project pointer passes the drag threshold", () => {
    const started = startProjectPointerDrag(2, 100);
    expect(updateProjectPointerDrag(started, 106).moved).toBe(false);
    expect(updateProjectPointerDrag(started, 107)).toMatchObject({
      projectId: 2,
      deltaY: 7,
      moved: true,
    });
    expect(initialProjectPointerState().projectId).toBeNull();
  });

  it("normalizes unknown sort modes to custom", () => {
    expect(normalizeProjectSortMode("custom")).toBe("custom");
    expect(normalizeProjectSortMode("name")).toBe("name");
    expect(normalizeProjectSortMode("recent")).toBe("custom");
    expect(normalizeProjectSortMode(null)).toBe("custom");
  });
});
