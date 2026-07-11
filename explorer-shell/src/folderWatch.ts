export type FolderChangedPayload = {
  folder_path: string;
};

export function shouldRefreshForFolderChange(
  activeFolderPath: string | null | undefined,
  payload: FolderChangedPayload,
) {
  return Boolean(activeFolderPath) && activeFolderPath === payload.folder_path;
}
