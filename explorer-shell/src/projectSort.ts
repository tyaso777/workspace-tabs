export type ProjectSortMode = "custom" | "created" | "name";

export type SortableProject = {
  id: number;
  name: string;
};

export function normalizeProjectSortMode(value: string | null | undefined): ProjectSortMode {
  return value === "created" || value === "name" ? value : "custom";
}

export function normalizeProjectCustomOrder(order: number[], projectIds: number[]) {
  const validIds = new Set(projectIds);
  const seen = new Set<number>();
  const normalized = order.filter((id) => {
    if (!validIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...normalized, ...projectIds.filter((id) => !seen.has(id))];
}

export function sortProjectsForDisplay<T extends SortableProject>(
  projects: T[],
  mode: ProjectSortMode,
  customOrder: number[] = [],
) {
  const sorted = [...projects];
  if (mode === "name") {
    sorted.sort((left, right) => {
      const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
      return byName === 0 ? left.id - right.id : byName;
    });
  } else if (mode === "created") {
    sorted.sort((left, right) => left.id - right.id);
  } else {
    const positions = new Map(
      normalizeProjectCustomOrder(customOrder, projects.map((project) => project.id))
        .map((id, index) => [id, index]),
    );
    sorted.sort((left, right) => positions.get(left.id)! - positions.get(right.id)!);
  }
  return sorted;
}

export function moveProjectsInCustomOrder(
  order: number[],
  selectedIds: number[],
  targetId: number,
  afterTarget = false,
) {
  const selected = new Set(selectedIds);
  const moving = order.filter((id) => selected.has(id));
  const remaining = order.filter((id) => !selected.has(id));
  const targetIndex = remaining.indexOf(targetId);
  const insertionIndex = targetIndex < 0 ? remaining.length : targetIndex + (afterTarget ? 1 : 0);
  return [
    ...remaining.slice(0, insertionIndex),
    ...moving,
    ...remaining.slice(insertionIndex),
  ];
}

export type ProjectPointerState = {
  projectId: number | null;
  startY: number;
  deltaY: number;
  moved: boolean;
};

export function initialProjectPointerState(): ProjectPointerState {
  return { projectId: null, startY: 0, deltaY: 0, moved: false };
}

export function startProjectPointerDrag(projectId: number, clientY: number): ProjectPointerState {
  return { projectId, startY: clientY, deltaY: 0, moved: false };
}

export function updateProjectPointerDrag(
  state: ProjectPointerState,
  clientY: number,
): ProjectPointerState {
  if (state.projectId === null) return state;
  const deltaY = clientY - state.startY;
  return { ...state, deltaY, moved: state.moved || Math.abs(deltaY) > 6 };
}
