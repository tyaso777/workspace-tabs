export type FileNotice =
  {
    text: string;
    doubleClickAction: null;
  };

export function fileNoticeForActiveTab(
  hasActiveTab: boolean,
  _folderPath: string | null | undefined,
): FileNotice | null {
  if (!hasActiveTab) {
    return {
      text: "Add a tab with the + button to show folder contents.",
      doubleClickAction: null,
    };
  }

  return null;
}
