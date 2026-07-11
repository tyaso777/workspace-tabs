type ProjectMenuPositionInput = {
  pointerX: number;
  pointerY: number;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

const VIEWPORT_MARGIN = 8;

export function projectMenuEditField(action: "rename" | "description") {
  return action === "rename" ? "projectName" : "projectSummary";
}

export function projectMenuPosition(input: ProjectMenuPositionInput) {
  const maximumLeft = Math.max(VIEWPORT_MARGIN, input.viewportWidth - input.menuWidth - VIEWPORT_MARGIN);
  const maximumTop = Math.max(VIEWPORT_MARGIN, input.viewportHeight - input.menuHeight - VIEWPORT_MARGIN);

  return {
    left: Math.min(Math.max(input.pointerX, VIEWPORT_MARGIN), maximumLeft),
    top: Math.min(Math.max(input.pointerY, VIEWPORT_MARGIN), maximumTop),
  };
}

export function projectDeleteConfirmation(projectName: string) {
  return projectDeleteConfirmationForNames([projectName]);
}

export function projectDeleteMenuLabel(count: number): string {
  return count > 1 ? `Delete ${count} Projects` : "Delete Project";
}

export function projectDeleteConfirmationForNames(projectNames: string[]) {
  if (projectNames.length === 1) {
    return {
      title: `Delete project "${projectNames[0]}"?`,
      detail:
        "Tabs and saved workspace state will be removed. Files and folders will not be deleted.",
    };
  }
  return {
    title: `Delete ${projectNames.length} projects?`,
    detail:
      `Projects: ${projectNames.join(", ")}. Tabs and saved workspace state will be removed. Files and folders will not be deleted.`,
  };
}
