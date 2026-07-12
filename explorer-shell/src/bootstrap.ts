export function bootstrapWorkspaceApp(options: {
  mount?: () => void;
  registerEvents: () => void;
  connectEvents?: () => Promise<void>;
  load: Array<() => Promise<void>>;
  pageClosing?: () => void;
}): void {
  window.addEventListener("DOMContentLoaded", () => {
    void initializeWorkspaceApp(options);
  });
  if (options.pageClosing) {
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) options.pageClosing?.();
    });
  }
}

export async function initializeWorkspaceApp(options: {
  mount?: () => void;
  registerEvents: () => void;
  connectEvents?: () => Promise<void>;
  load: Array<() => Promise<void>>;
}): Promise<void> {
  options.mount?.();
  options.registerEvents();
  await options.connectEvents?.();
  for (const load of options.load) await load();
}
