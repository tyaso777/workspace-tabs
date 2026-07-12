import {
  DEFAULT_NOTE_PANEL_HEIGHT,
  clampNotePanelHeight,
  expandedNotePanelHeight,
  toggleNotePanelMaximized,
  type NotePanelState,
} from "./notePanel";

export type NotePanelGeometry = {
  viewportHeight: number;
  panelTop: number;
  panelHeight: number;
};

export type NotePanelControllerDependencies = {
  load: () => Promise<NotePanelState>;
  save: (state: NotePanelState) => Promise<void>;
  geometry: () => NotePanelGeometry;
  setHeight: (height: number) => void;
  setResizing: (resizing: boolean) => void;
};

type ResizeState = {
  pointerId: number;
  startY: number;
  startHeight: number;
};

export class NotePanelController {
  #state: NotePanelState = { customHeight: null, maximized: false };
  #resize: ResizeState | null = null;

  constructor(private readonly dependencies: NotePanelControllerDependencies) {}

  get state(): NotePanelState {
    return this.#state;
  }

  replaceState(state: NotePanelState): void {
    this.#state = { ...state };
    this.applyHeight();
  }

  async load(): Promise<void> {
    this.#state = await this.dependencies.load();
    this.applyHeight();
  }

  async toggleExpanded(): Promise<void> {
    this.#state = toggleNotePanelMaximized(this.#state);
    this.applyHeight();
    await this.dependencies.save(this.#state);
  }

  applyHeight(): void {
    const geometry = this.dependencies.geometry();
    const maximum = Math.max(150, geometry.viewportHeight - geometry.panelTop - 16);
    const requested = this.#state.maximized
      ? expandedNotePanelHeight(geometry.viewportHeight, geometry.panelTop)
      : this.#state.customHeight ?? DEFAULT_NOTE_PANEL_HEIGHT;
    this.dependencies.setHeight(clampNotePanelHeight(requested, maximum));
  }

  startResize(pointerId: number, clientY: number): boolean {
    const geometry = this.dependencies.geometry();
    this.#resize = { pointerId, startY: clientY, startHeight: geometry.panelHeight };
    this.#state = { customHeight: geometry.panelHeight, maximized: false };
    this.dependencies.setResizing(true);
    return true;
  }

  moveResize(pointerId: number, clientY: number): boolean {
    if (!this.#resize || this.#resize.pointerId !== pointerId) return false;
    const geometry = this.dependencies.geometry();
    const maximum = Math.max(150, geometry.viewportHeight - geometry.panelTop - 16);
    const height = clampNotePanelHeight(
      this.#resize.startHeight + clientY - this.#resize.startY,
      maximum,
    );
    this.#state = { customHeight: Math.round(height), maximized: false };
    this.dependencies.setHeight(height);
    return true;
  }

  async finishResize(pointerId: number): Promise<boolean> {
    if (!this.#resize || this.#resize.pointerId !== pointerId) return false;
    this.#resize = null;
    this.dependencies.setResizing(false);
    await this.dependencies.save(this.#state);
    return true;
  }

  async reset(): Promise<void> {
    this.#resize = null;
    this.#state = { customHeight: null, maximized: false };
    this.dependencies.setResizing(false);
    this.applyHeight();
    await this.dependencies.save(this.#state);
  }
}
