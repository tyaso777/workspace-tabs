export function tabDeleteConfirmation(tabName: string, kind: "folder" | "links" | "folders") {
  return tabDeleteConfirmationForTabs([{ name: tabName, kind }]);
}

export function tabDeleteConfirmationForTabs(
  tabs: { name: string; kind: "folder" | "links" | "folders" }[],
) {
  if (tabs.length > 1) {
    return {
      title: `Delete ${tabs.length} tabs?`,
      detail: `Tabs: ${tabs.map((tab) => tab.name).join(", ")}. Saved tab state, links, and folder registrations will be removed from WorkspaceTabs. Files and folders will not be deleted.`,
    };
  }
  const tab = tabs[0];
  return {
    title: `Delete tab "${tab.name}"?`,
    detail:
      tab.kind === "links"
        ? "Saved links and tab state will be removed from WorkspaceTabs. Files and folders will not be deleted."
        : tab.kind === "folders"
          ? "Saved folder registrations and tab state will be removed from WorkspaceTabs. Files and folders will not be deleted."
        : "The tab registration and saved state will be removed from WorkspaceTabs. Files and folders will not be deleted.",
  };
}

export function tabDeleteMenuLabel(count: number): string {
  return count > 1 ? `Delete ${count} Tabs` : "Delete Tab";
}

export function tabKindLabel(kind: "folder" | "links" | "folders"): string {
  return kind === "folder" ? "Folder tab" : kind === "links" ? "Links tab" : "Folders tab";
}
