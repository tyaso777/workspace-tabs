export function bindAddDialogSubmission(options: {
  form: HTMLFormElement;
  confirmButton: HTMLButtonElement;
  submit: () => Promise<void>;
  enterControls?: Array<HTMLInputElement | HTMLTextAreaElement>;
  multiline?: boolean;
}): void {
  let submitting = false;
  const run = async () => {
    if (submitting) return;
    submitting = true;
    try {
      await options.submit();
    } finally {
      submitting = false;
    }
  };

  options.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void run();
  });
  options.confirmButton.addEventListener("click", () => { void run(); });
  for (const control of options.enterControls ?? []) {
    control.addEventListener("keydown", (event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key !== "Enter") return;
      if (options.multiline && !(keyEvent.ctrlKey || keyEvent.metaKey)) return;
      if (!options.multiline && keyEvent.shiftKey) return;
      keyEvent.preventDefault();
      void run();
    });
  }
}
