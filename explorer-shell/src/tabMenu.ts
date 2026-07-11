export function tabDeleteConfirmation(tabName: string, kind: "folder" | "links") {
  return tabDeleteConfirmationForTabs([{ name: tabName, kind }]);
}

export function tabDeleteConfirmationForTabs(
  tabs: { name: string; kind: "folder" | "links" }[],
) {
  if (tabs.length > 1) {
    return {
      title: `Delete ${tabs.length} tabs?`,
      detail: `Tabs: ${tabs.map((tab) => tab.name).join(", ")}. Saved tab state and links will be removed from WorkspaceTabs. Files and folders will not be deleted.`,
    };
  }
  const tab = tabs[0];
  return {
    title: `Delete tab "${tab.name}"?`,
    detail:
      tab.kind === "links"
        ? "Saved links and tab state will be removed from WorkspaceTabs. Files and folders will not be deleted."
        : "The tab registration and saved state will be removed from WorkspaceTabs. Files and folders will not be deleted.",
  };
}

export function tabDeleteMenuLabel(count: number): string {
  return count > 1 ? `Delete ${count} Tabs` : "Delete Tab";
}

export function tabKindLabel(kind: "folder" | "links"): string {
  return kind === "folder" ? "Folder tab" : "Links tab";
}
