export type TabCreationMenuAction = "toggle" | "dismiss" | "select";

export function tabCreationMenuOpenAfter(
  currentlyOpen: boolean,
  action: TabCreationMenuAction,
): boolean {
  return action === "toggle" ? !currentlyOpen : false;
}
