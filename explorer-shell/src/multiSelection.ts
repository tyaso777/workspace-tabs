export type MultiSelectionState = {
  selectedIds: number[];
  anchorId: number | null;
};

type SelectionModifiers = {
  ctrlKey: boolean;
  shiftKey: boolean;
};

export function emptyMultiSelection(): MultiSelectionState {
  return { selectedIds: [], anchorId: null };
}

export function applyMultiSelection(
  state: MultiSelectionState,
  orderedIds: number[],
  clickedId: number,
  modifiers: SelectionModifiers,
): MultiSelectionState {
  if (!orderedIds.includes(clickedId)) return state;

  if (modifiers.shiftKey && state.anchorId !== null && orderedIds.includes(state.anchorId)) {
    const anchorIndex = orderedIds.indexOf(state.anchorId);
    const clickedIndex = orderedIds.indexOf(clickedId);
    const start = Math.min(anchorIndex, clickedIndex);
    const end = Math.max(anchorIndex, clickedIndex);
    const range = orderedIds.slice(start, end + 1);
    const selected = modifiers.ctrlKey ? new Set([...state.selectedIds, ...range]) : new Set(range);
    return {
      selectedIds: orderedIds.filter((id) => selected.has(id)),
      anchorId: state.anchorId,
    };
  }

  if (modifiers.ctrlKey) {
    const selected = new Set(state.selectedIds.filter((id) => orderedIds.includes(id)));
    if (selected.has(clickedId)) {
      selected.delete(clickedId);
    } else {
      selected.add(clickedId);
    }
    return {
      selectedIds: orderedIds.filter((id) => selected.has(id)),
      anchorId: clickedId,
    };
  }

  return { selectedIds: [clickedId], anchorId: clickedId };
}
