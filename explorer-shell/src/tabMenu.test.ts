import { describe, expect, it } from "vitest";
import {
  tabDeleteConfirmation,
  tabDeleteConfirmationForTabs,
  tabDeleteMenuLabel,
  tabKindLabel,
} from "./tabMenu";

describe("tab delete confirmation", () => {
  it("explains that deleting a folder tab does not delete files or folders", () => {
    expect(tabDeleteConfirmation("Docs", "folder")).toEqual({
      title: 'Delete tab "Docs"?',
      detail:
        "The tab registration and saved state will be removed from WorkspaceTabs. Files and folders will not be deleted.",
    });
  });

  it("explains that deleting a links tab removes its saved links", () => {
    expect(tabDeleteConfirmation("Research", "links")).toEqual({
      title: 'Delete tab "Research"?',
      detail:
        "Saved links and tab state will be removed from WorkspaceTabs. Files and folders will not be deleted.",
    });
  });

  it("lists all tabs in one batch confirmation", () => {
    expect(
      tabDeleteConfirmationForTabs([
        { name: "Docs", kind: "folder" },
        { name: "Research", kind: "links" },
      ]),
    ).toEqual({
      title: "Delete 2 tabs?",
      detail:
        "Tabs: Docs, Research. Saved tab state and links will be removed from WorkspaceTabs. Files and folders will not be deleted.",
    });
    expect(tabDeleteMenuLabel(2)).toBe("Delete 2 Tabs");
    expect(tabDeleteMenuLabel(1)).toBe("Delete Tab");
  });
});

describe("tab kind label", () => {
  it("provides readable labels alongside the icons", () => {
    expect(tabKindLabel("folder")).toBe("Folder tab");
    expect(tabKindLabel("links")).toBe("Links tab");
  });
});
