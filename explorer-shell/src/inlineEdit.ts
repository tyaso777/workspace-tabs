export type InlineEditField =
  | "projectName"
  | "projectSummary"
  | "noteTitle"
  | "noteContent"
  | "tabName"
  | "tabFolder";

export type InlineEditState = {
  field: InlineEditField | null;
  draft: string;
};

export type InlineEditFinishResult =
  | { type: "cancel" }
  | { type: "invalid"; reason: "required" }
  | { type: "commit"; field: InlineEditField; value: string };

export function emptyInlineEditState(): InlineEditState {
  return {
    field: null,
    draft: "",
  };
}

export function startInlineEdit(field: InlineEditField, currentValue: string): InlineEditState {
  return {
    field,
    draft: currentValue,
  };
}

export function startTabFolderEditForChoice(currentFolderPath: string): InlineEditState {
  return startInlineEdit("tabFolder", currentFolderPath);
}

export function emptyTabFolderPrompt() {
  return {
    state: "No folder selected",
    action: "Double-click to set",
  };
}

export function finishInlineEdit(
  state: InlineEditState,
  nextValue: string,
  options: { cancel?: boolean; required?: boolean } = {},
): InlineEditFinishResult {
  if (options.cancel || state.field === null) {
    return { type: "cancel" };
  }

  const value = nextValue.trim();
  if (options.required && value.length === 0) {
    return { type: "invalid", reason: "required" };
  }

  return {
    type: "commit",
    field: state.field,
    value,
  };
}
