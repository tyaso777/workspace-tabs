import type { ProjectSortMode } from "./projectSort";

export type InvokeProjectCommand<TWorkspace> = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<TWorkspace>;

export function createProjectsApi<TWorkspace>(invoke: InvokeProjectCommand<TWorkspace>) {
  return {
    create(name: string, summary: string): Promise<TWorkspace> {
      return invoke("create_project", { name, summary });
    },
    update(projectId: number, name: string, summary: string): Promise<TWorkspace> {
      return invoke("update_project", { projectId, name, summary });
    },
    deleteMany(projectIds: number[]): Promise<TWorkspace> {
      return invoke("delete_projects", { projectIds });
    },
    async saveSortMode(mode: ProjectSortMode): Promise<void> {
      await invoke("save_project_sort_mode", { mode });
    },
    async saveCustomOrder(projectIds: number[]): Promise<void> {
      await invoke("save_project_custom_order", { projectIds });
    },
  };
}
