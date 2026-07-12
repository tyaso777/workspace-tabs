export type TabCreationMenuAction = "toggle" | "dismiss" | "select";

export function tabCreationMenuOpenAfter(
  currentlyOpen: boolean,
  action: TabCreationMenuAction,
): boolean {
  return action === "toggle" ? !currentlyOpen : false;
}

export type MenuRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type TabCreationMenuPosition = {
  left: number;
  top: number;
  placement: "above" | "below";
};

export function tabCreationMenuPosition(
  button: MenuRect,
  main: MenuRect,
  menuWidth: number,
  menuHeight: number,
  gap = 6,
): TabCreationMenuPosition {
  const inset = 8;
  const minimumLeft = main.left + inset;
  const maximumLeft = Math.max(minimumLeft, main.right - inset - menuWidth);
  const left = Math.min(Math.max(button.right - menuWidth, minimumLeft), maximumLeft);
  const fitsBelow = button.bottom + gap + menuHeight <= main.bottom - inset;
  return {
    left,
    top: fitsBelow ? button.bottom + gap : Math.max(main.top + inset, button.top - gap - menuHeight),
    placement: fitsBelow ? "below" : "above",
  };
}
