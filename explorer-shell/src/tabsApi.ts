export type InvokeTabsCommand<TWorkspace> = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<TWorkspace>;

export function createTabsApi<TWorkspace>(invoke: InvokeTabsCommand<TWorkspace>) {
  return {
    addFolder(projectId: number, name: string, folderPath: string): Promise<TWorkspace> {
      return invoke("add_tab", { projectId, name, folderPath });
    },
    addLinks(projectId: number, name: string): Promise<TWorkspace> {
      return invoke("add_links_tab", { projectId, name });
    },
    activate(projectId: number, tabId: number): Promise<TWorkspace> {
      return invoke("activate_tab", { projectId, tabId });
    },
    rename(projectId: number, tabId: number, name: string): Promise<TWorkspace> {
      return invoke("update_tab_name", { projectId, tabId, name });
    },
    updateFolder(
      projectId: number,
      tabId: number,
      name: string,
      folderPath: string,
    ): Promise<TWorkspace> {
      return invoke("update_tab", { projectId, tabId, name, folderPath });
    },
    deleteMany(projectId: number, tabIds: number[]): Promise<TWorkspace> {
      return invoke("delete_tabs", { projectId, tabIds });
    },
    moveMany(projectId: number, tabIds: number[], targetIndex: number): Promise<TWorkspace> {
      return invoke("move_tabs", { projectId, tabIds, targetIndex });
    },
  };
}
