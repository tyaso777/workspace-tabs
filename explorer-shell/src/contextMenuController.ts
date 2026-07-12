import { projectMenuPosition } from "./projectMenu";

type MenuRegistration = { menu: HTMLElement; focusTarget: HTMLElement };

export class ContextMenuController<Key extends string> {
  readonly #registrations: Record<Key, MenuRegistration>;
  readonly #targets = new Map<Key, number>();

  constructor(registrations: Record<Key, MenuRegistration>) {
    this.#registrations = registrations;
  }

  open(
    key: Key,
    targetId: number,
    pointerX: number,
    pointerY: number,
    options: { alignRight?: boolean } = {},
  ): void {
    this.closeAll();
    const registration = this.#registrations[key];
    this.#targets.set(key, targetId);
    registration.menu.hidden = false;
    const requestedLeft = options.alignRight
      ? pointerX - registration.menu.offsetWidth
      : pointerX;
    const position = projectMenuPosition({
      pointerX: requestedLeft,
      pointerY,
      menuWidth: registration.menu.offsetWidth,
      menuHeight: registration.menu.offsetHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    registration.menu.style.left = `${position.left}px`;
    registration.menu.style.top = `${position.top}px`;
    registration.focusTarget.focus();
  }

  close(key: Key): void {
    this.#targets.delete(key);
    this.#registrations[key].menu.hidden = true;
  }

  closeAll(): void {
    (Object.keys(this.#registrations) as Key[]).forEach((key) => this.close(key));
  }

  target(key: Key): number | null {
    return this.#targets.get(key) ?? null;
  }

  contains(target: Node): boolean {
    return (Object.values(this.#registrations) as MenuRegistration[])
      .some(({ menu }) => menu.contains(target));
  }
}
