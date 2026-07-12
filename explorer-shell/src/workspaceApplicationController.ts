import type { ProjectSortMode } from "./projectSort";

type ProjectCommands<TWorkspace> = {
  create: (name: string, summary: string) => Promise<TWorkspace>;
  update: (projectId: number, name: string, summary: string) => Promise<TWorkspace>;
  deleteMany: (projectIds: number[]) => Promise<TWorkspace>;
  saveSortMode: (mode: ProjectSortMode) => Promise<void>;
  saveCustomOrder: (projectIds: number[]) => Promise<void>;
};

type TabCommands<TWorkspace> = {
  addFolder: (projectId: number, name: string, folderPath: string) => Promise<TWorkspace>;
  addLinks: (projectId: number, name: string) => Promise<TWorkspace>;
  activate: (projectId: number, tabId: number) => Promise<TWorkspace>;
  rename: (projectId: number, tabId: number, name: string) => Promise<TWorkspace>;
  updateFolder: (projectId: number, tabId: number, name: string, folderPath: string) => Promise<TWorkspace>;
  deleteMany: (projectId: number, tabIds: number[]) => Promise<TWorkspace>;
  moveMany: (projectId: number, tabIds: number[], targetIndex: number) => Promise<TWorkspace>;
};

type NoteCommands<TWorkspace> = {
  add: (projectId: number, title: string, content: string) => Promise<TWorkspace>;
  update: (projectId: number, noteId: number, title: string, content: string) => Promise<TWorkspace>;
  activate: (projectId: number, noteId: number) => Promise<TWorkspace>;
  deleteMany: (projectId: number, noteIds: number[]) => Promise<TWorkspace>;
};

export type WorkspaceApplicationServices<TWorkspace> = {
  projects: ProjectCommands<TWorkspace>;
  tabs: TabCommands<TWorkspace>;
  notes: NoteCommands<TWorkspace>;
  invokeWorkspace: (command: string, args?: Record<string, unknown>) => Promise<TWorkspace>;
};

export class WorkspaceApplicationController<TWorkspace> {
  constructor(private readonly actions: {
    getWorkspace: () => TWorkspace;
    setWorkspace: (workspace: TWorkspace) => void;
    onError: (message: string) => void;
  }, private readonly services?: WorkspaceApplicationServices<TWorkspace>) {}

  async execute(command: () => Promise<void>): Promise<boolean> {
    try {
      await command();
      return true;
    } catch (error) {
      this.actions.onError(String(error));
      return false;
    }
  }

  async mutate(operation: (workspace: TWorkspace) => Promise<TWorkspace>): Promise<boolean> {
    return this.execute(async () => {
      this.actions.setWorkspace(await operation(this.actions.getWorkspace()));
    });
  }

  createProject(name: string, summary: string): Promise<TWorkspace> {
    return this.#replace(this.#services().projects.create(name, summary));
  }

  updateProject(projectId: number, name: string, summary: string): Promise<TWorkspace> {
    return this.#replace(this.#services().projects.update(projectId, name, summary));
  }

  deleteProjects(projectIds: number[]): Promise<TWorkspace> {
    return this.#replace(this.#services().projects.deleteMany(projectIds));
  }

  saveProjectSortMode(mode: ProjectSortMode): Promise<void> {
    return this.#services().projects.saveSortMode(mode);
  }

  saveProjectCustomOrder(projectIds: number[]): Promise<void> {
    return this.#services().projects.saveCustomOrder(projectIds);
  }

  addFolderTab(projectId: number, name: string, folderPath: string): Promise<TWorkspace> {
    return this.#replace(this.#services().tabs.addFolder(projectId, name, folderPath));
  }

  addLinksTab(projectId: number, name: string): Promise<TWorkspace> {
    return this.#replace(this.#services().tabs.addLinks(projectId, name));
  }

  activateTab(projectId: number, tabId: number): Promise<TWorkspace> {
    return this.#replace(this.#services().tabs.activate(projectId, tabId));
  }

  renameTab(projectId: number, tabId: number, name: string): Promise<TWorkspace> {
    return this.#replace(this.#services().tabs.rename(projectId, tabId, name));
  }

  updateFolderTab(projectId: number, tabId: number, name: string, folderPath: string): Promise<TWorkspace> {
    return this.#replace(this.#services().tabs.updateFolder(projectId, tabId, name, folderPath));
  }

  deleteTabs(projectId: number, tabIds: number[]): Promise<TWorkspace> {
    return this.#replace(this.#services().tabs.deleteMany(projectId, tabIds));
  }

  moveTabs(projectId: number, tabIds: number[], targetIndex: number): Promise<TWorkspace> {
    return this.#replace(this.#services().tabs.moveMany(projectId, tabIds, targetIndex));
  }

  addNote(projectId: number, title: string, content: string): Promise<TWorkspace> {
    return this.#replace(this.#services().notes.add(projectId, title, content));
  }

  updateNote(projectId: number, noteId: number, title: string, content: string): Promise<TWorkspace> {
    return this.#replace(this.#services().notes.update(projectId, noteId, title, content));
  }

  activateNote(projectId: number, noteId: number): Promise<TWorkspace> {
    return this.#replace(this.#services().notes.activate(projectId, noteId));
  }

  deleteNotes(projectId: number, noteIds: number[]): Promise<TWorkspace> {
    return this.#replace(this.#services().notes.deleteMany(projectId, noteIds));
  }

  invoke(command: string, args?: Record<string, unknown>): Promise<TWorkspace> {
    return this.#replace(this.#services().invokeWorkspace(command, args));
  }

  async #replace(operation: Promise<TWorkspace>): Promise<TWorkspace> {
    const workspace = await operation;
    this.actions.setWorkspace(workspace);
    return workspace;
  }

  #services(): WorkspaceApplicationServices<TWorkspace> {
    if (!this.services) throw new Error("Workspace application services are not configured");
    return this.services;
  }
}
