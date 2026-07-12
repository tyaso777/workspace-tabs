export function createProjectMenuButton(
  projectId: number,
  projectName: string,
  finishCurrentEdit: () => Promise<boolean>,
  openMenu: (projectId: number, x: number, y: number, fromButton: boolean) => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "project-item-menu-button";
  button.textContent = "\u22ef";
  button.title = "Project actions";
  button.setAttribute("aria-label", `Actions for ${projectName}`);
  button.setAttribute("aria-haspopup", "menu");
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const rect = button.getBoundingClientRect();
    if (await finishCurrentEdit()) {
      openMenu(projectId, rect.right, rect.bottom + 4, true);
    }
  });
  return button;
}
