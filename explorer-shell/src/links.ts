export type LinkInput = { name: string; url: string };

export function parseSingleLink(nameValue: string, urlValue: string): LinkInput | null {
  const name = nameValue.trim();
  const url = urlValue.trim();
  return /^https?:\/\/\S+$/i.test(url) ? { name, url } : null;
}

export function parseLinkLines(value: string): {
  links: LinkInput[];
  invalidLines: string[];
} {
  const links: LinkInput[] = [];
  const invalidLines: string[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!/^https?:\/\/\S+$/i.test(line)) {
      invalidLines.push(line);
      continue;
    }
    links.push({ name: "", url: line });
  }
  return { links, invalidLines };
}

export function linkEditField(value: string | undefined): "name" | "url" | null {
  return value === "name" || value === "url" ? value : null;
}

export function toggleCheckedLink(ids: number[], linkId: number): number[] {
  return ids.includes(linkId) ? ids.filter((id) => id !== linkId) : [...ids, linkId];
}

export function linkClickAction(ctrlKey: boolean, checkboxTarget: boolean) {
  return {
    select: true,
    toggleChecked: ctrlKey || checkboxTarget,
  };
}

export function linkIdsForDelete(clickedLinkId: number, checkedLinkIds: number[]) {
  return checkedLinkIds.includes(clickedLinkId) ? [...checkedLinkIds] : [clickedLinkId];
}

export function linkDeleteConfirmation(links: Array<{ name: string; url: string }>) {
  const labels = links.map((link) => link.name || link.url);
  return {
    title: links.length === 1 ? "Delete link?" : `Delete ${links.length} links?`,
    detail: labels.join("\n"),
    buttonLabel: links.length === 1 ? "Delete Link" : `Delete ${links.length} Links`,
  };
}

export function linkPreviewText(link: { name: string; url: string }): string {
  return `${link.name}\n${link.url}`;
}

export function selectedLinkView(link: { id: number; name: string; url: string }) {
  return {
    selectedLinkId: link.id,
    selectedUrl: link.url,
    preview: linkPreviewText(link),
  };
}
