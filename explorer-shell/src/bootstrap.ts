export function bootstrapWorkspaceApp(options: {
  initialize: () => Promise<void>;
  pageClosing?: () => void;
}): void {
  window.addEventListener("DOMContentLoaded", () => {
    void options.initialize();
  });
  if (options.pageClosing) {
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) options.pageClosing?.();
    });
  }
}
