export type SidebarView = {
  shellClassName: string;
  toggleLabel: string;
  toggleTitle: string;
};

export function sidebarView(collapsed: boolean): SidebarView {
  return {
    shellClassName: collapsed ? "app-shell is-sidebar-collapsed" : "app-shell",
    toggleLabel: collapsed ? ">" : "<",
    toggleTitle: collapsed ? "Show project sidebar" : "Hide project sidebar",
  };
}
