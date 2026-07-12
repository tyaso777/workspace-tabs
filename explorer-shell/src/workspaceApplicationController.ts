export class WorkspaceApplicationController<TWorkspace> {
  constructor(private readonly actions: {
    getWorkspace: () => TWorkspace;
    setWorkspace: (workspace: TWorkspace) => void;
    onError: (message: string) => void;
  }) {}

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
}
