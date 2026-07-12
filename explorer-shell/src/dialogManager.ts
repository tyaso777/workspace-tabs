export class DialogManager<Key extends string> {
  readonly #targets = new Map<Key, number[]>();

  constructor(private readonly dialogs: Record<Key, HTMLDialogElement>) {
    (Object.entries(dialogs) as [Key, HTMLDialogElement][]).forEach(([key, dialog]) => {
      dialog.addEventListener("close", () => this.#targets.delete(key));
    });
  }

  open(key: Key, targets: number[] = []): void {
    this.#targets.set(key, [...targets]);
    const dialog = this.dialogs[key];
    if (!dialog.open) dialog.showModal();
  }

  close(key: Key): void {
    this.#targets.delete(key);
    const dialog = this.dialogs[key];
    if (dialog.open) dialog.close();
  }

  targets(key: Key): number[] {
    return [...(this.#targets.get(key) ?? [])];
  }

  consumeTargets(key: Key): number[] {
    const targets = this.targets(key);
    this.#targets.delete(key);
    return targets;
  }
}
