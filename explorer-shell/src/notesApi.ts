export type InvokeCommand<TWorkspace> = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<TWorkspace>;

export function createNotesApi<TWorkspace>(invoke: InvokeCommand<TWorkspace>) {
  return {
    add(projectId: number, title: string, content: string): Promise<TWorkspace> {
      return invoke("add_note", { projectId, title, content });
    },

    update(
      projectId: number,
      noteId: number,
      title: string,
      content: string,
    ): Promise<TWorkspace> {
      return invoke("update_note", { projectId, noteId, title, content });
    },

    activate(projectId: number, noteId: number): Promise<TWorkspace> {
      return invoke("activate_note", { projectId, noteId });
    },

    deleteMany(projectId: number, noteIds: number[]): Promise<TWorkspace> {
      return invoke("delete_notes", { projectId, noteIds });
    },
  };
}
