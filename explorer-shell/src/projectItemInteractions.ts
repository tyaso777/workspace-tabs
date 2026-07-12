export type ProjectItemInteractionState = {
  hasActiveEdit: boolean;
  editingThisItem: boolean;
  suppressClick: () => boolean;
};

export type ProjectItemInteractionActions = {
  finishCurrentEdit: () => Promise<boolean>;
  selectFromPointer: (projectId: number, event: MouseEvent) => Promise<void>;
  activate: (projectId: number) => Promise<void>;
  openContextMenu: (projectId: number, x: number, y: number) => void;
};

export function bindProjectItemInteractions(
  item: HTMLElement,
  projectId: number,
  state: ProjectItemInteractionState,
  actions: ProjectItemInteractionActions,
): void {
  item.addEventListener("mousedown", async (event) => {
    if ((event.target as HTMLElement).closest(".project-item-menu-button")) return;
    const inlineEditorTarget = Boolean((event.target as HTMLElement).closest(".inline-editor"));
    if (!state.hasActiveEdit || inlineEditorTarget) return;

    event.preventDefault();
    event.stopPropagation();
    if (await actions.finishCurrentEdit()) await actions.selectFromPointer(projectId, event);
  });

  item.addEventListener("click", (event) => {
    if (state.suppressClick()) return;
    if ((event.target as HTMLElement).closest(".project-item-menu-button")) return;
    if (state.editingThisItem) return;
    void actions.selectFromPointer(projectId, event);
  });

  item.addEventListener("keydown", (event) => {
    if (event.target !== item || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    void actions.activate(projectId);
  });

  item.addEventListener("contextmenu", async (event) => {
    if ((event.target as HTMLElement).closest(".inline-editor")) return;
    event.preventDefault();
    if (await actions.finishCurrentEdit()) {
      actions.openContextMenu(projectId, event.clientX, event.clientY);
    }
  });
}
