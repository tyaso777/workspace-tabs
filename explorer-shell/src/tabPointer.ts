export type TabPointerState = {
  draggedTabId: number | null;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  moved: boolean;
};

export type TabPointerAction =
  | { type: "none" }
  | { type: "activate"; tabId: number }
  | { type: "move"; tabId: number; targetIndex: number };

export const TAB_DRAG_THRESHOLD_PX = 6;

export function shouldStartTabNameEditFromMouseDown(
  isTabNameTarget: boolean,
  clickCount: number,
  isAlreadyEditing = false,
): boolean {
  return !isAlreadyEditing && isTabNameTarget && clickCount >= 2;
}

export function shouldActivateReleasedTab(
  action: TabPointerAction,
  activeTabId: number | null,
): boolean {
  return action.type === "activate" && action.tabId !== activeTabId;
}

export function shouldFinishInlineEditBeforeTabPointerInteraction(
  hasInlineEdit: boolean,
  isInlineEditorTarget: boolean,
): boolean {
  return hasInlineEdit && !isInlineEditorTarget;
}

export function initialTabPointerState(): TabPointerState {
  return {
    draggedTabId: null,
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    moved: false,
  };
}

export function startTabPointerDrag(
  tabId: number,
  clientX: number,
  clientY: number,
): TabPointerState {
  return {
    draggedTabId: tabId,
    startX: clientX,
    startY: clientY,
    deltaX: 0,
    deltaY: 0,
    moved: false,
  };
}

export function updateTabPointerDrag(
  state: TabPointerState,
  clientX: number,
  clientY: number,
): TabPointerState {
  if (state.draggedTabId === null) {
    return state;
  }

  const moved =
    Math.abs(clientX - state.startX) > TAB_DRAG_THRESHOLD_PX ||
    Math.abs(clientY - state.startY) > TAB_DRAG_THRESHOLD_PX;

  return {
    ...state,
    deltaX: clientX - state.startX,
    deltaY: clientY - state.startY,
    moved: state.moved || moved,
  };
}

export function finishTabPointerDrag(
  state: TabPointerState,
  currentTabId: number,
  targetIndex: number | null,
): { action: TabPointerAction; state: TabPointerState } {
  const reset = initialTabPointerState();

  if (state.draggedTabId !== currentTabId) {
    return { action: { type: "none" }, state: reset };
  }

  if (state.moved && targetIndex !== null) {
    return {
      action: {
        type: "move",
        tabId: state.draggedTabId,
        targetIndex,
      },
      state: reset,
    };
  }

  if (!state.moved) {
    return {
      action: {
        type: "activate",
        tabId: currentTabId,
      },
      state: reset,
    };
  }

  return { action: { type: "none" }, state: reset };
}
