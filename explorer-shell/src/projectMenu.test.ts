import { describe, expect, it } from "vitest";
import {
  projectDeleteConfirmation,
  projectDeleteConfirmationForNames,
  projectDeleteMenuLabel,
  projectMenuEditField,
  projectMenuPosition,
} from "./projectMenu";

describe("projectMenuPosition", () => {
  it("uses the pointer position when the menu fits", () => {
    expect(
      projectMenuPosition({
        pointerX: 120,
        pointerY: 80,
        menuWidth: 180,
        menuHeight: 90,
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toEqual({ left: 120, top: 80 });
  });

  it("keeps the menu inside the viewport", () => {
    expect(
      projectMenuPosition({
        pointerX: 780,
        pointerY: 580,
        menuWidth: 180,
        menuHeight: 90,
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toEqual({ left: 612, top: 502 });
  });

  it("lists every project in a batch confirmation", () => {
    expect(projectDeleteConfirmationForNames(["Alpha", "Beta"])).toEqual({
      title: "Delete 2 projects?",
      detail:
        "Projects: Alpha, Beta. Tabs and saved workspace state will be removed. Files and folders will not be deleted.",
    });
  });
});

describe("projectDeleteConfirmation", () => {
  it("names the project and explains that files and folders remain", () => {
    expect(projectDeleteConfirmation("Client A")).toEqual({
      title: 'Delete project "Client A"?',
      detail:
        "Tabs and saved workspace state will be removed. Files and folders will not be deleted.",
    });
  });
});

describe("projectDeleteMenuLabel", () => {
  it("uses a singular label for one project", () => {
    expect(projectDeleteMenuLabel(1)).toBe("Delete Project");
  });

  it("shows the selected project count for a batch delete", () => {
    expect(projectDeleteMenuLabel(2)).toBe("Delete 2 Projects");
    expect(projectDeleteMenuLabel(5)).toBe("Delete 5 Projects");
  });
});

describe("project menu edit actions", () => {
  it("maps each menu item to the intended inline field", () => {
    expect(projectMenuEditField("rename")).toBe("projectName");
    expect(projectMenuEditField("description")).toBe("projectSummary");
  });
});
