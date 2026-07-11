export type ProjectSortMode = "created" | "name";

export type SortableProject = {
  id: number;
  name: string;
};

export function normalizeProjectSortMode(value: string | null | undefined): ProjectSortMode {
  return value === "name" ? "name" : "created";
}

export function sortProjectsForDisplay<T extends SortableProject>(
  projects: T[],
  mode: ProjectSortMode,
) {
  const sorted = [...projects];
  if (mode === "name") {
    sorted.sort((left, right) => {
      const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
      return byName === 0 ? left.id - right.id : byName;
    });
  } else {
    sorted.sort((left, right) => left.id - right.id);
  }
  return sorted;
}
