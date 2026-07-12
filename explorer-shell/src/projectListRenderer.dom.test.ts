// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { ProjectListRenderer, type ProjectListRendererActions } from "./projectListRenderer";

function setup() {
  const list = document.createElement("div");
  const custom = document.createElement("button");
  const created = document.createElement("button");
  const name = document.createElement("button");
  const renderer = new ProjectListRenderer(list, { custom, created, name });
  const actions: ProjectListRendererActions = {
    bindDrag: vi.fn(),
    bindInteractions: vi.fn(),
    renderField: vi.fn((project, field) => {
      const element = document.createElement("span");
      element.textContent = field === "projectName" ? project.name : project.summary;
      return element;
    }),
    createMenuButton: vi.fn(() => document.createElement("button")),
  };
  return { list, custom, created, name, renderer, actions };
}

describe("ProjectListRenderer", () => {
  it("renders projects in the selected order and marks active and selected rows", () => {
    const view = setup();
    view.renderer.render({
      projects: [
        { id: 2, name: "Beta", summary: "B" },
        { id: 1, name: "Alpha", summary: "A" },
      ],
      activeProjectId: 2,
      selectedIds: [1],
      sortMode: "name",
      customOrder: [],
    }, view.actions);

    const rows = [...view.list.querySelectorAll<HTMLElement>(".project-item")];
    expect(rows.map((row) => row.dataset.projectId)).toEqual(["1", "2"]);
    expect(rows[0].classList.contains("is-selected")).toBe(true);
    expect(rows[0].querySelector(".selection-indicator")?.textContent).toBe("\u2713");
    expect(rows[1].classList.contains("is-active")).toBe(true);
  });

  it("updates sort controls and enables custom drag styling only in custom mode", () => {
    const view = setup();
    view.renderer.render({
      projects: [{ id: 1, name: "Alpha", summary: "A" }],
      activeProjectId: 1,
      selectedIds: [],
      sortMode: "custom",
      customOrder: [1],
    }, view.actions);

    expect(view.custom.classList.contains("is-active")).toBe(true);
    expect(view.custom.getAttribute("aria-pressed")).toBe("true");
    expect(view.created.getAttribute("aria-pressed")).toBe("false");
    expect(view.list.firstElementChild?.classList.contains("is-custom-sort")).toBe(true);
  });

  it("binds each row to drag and interaction controllers", () => {
    const view = setup();
    view.renderer.render({
      projects: [{ id: 7, name: "Seven", summary: "" }],
      activeProjectId: null,
      selectedIds: [],
      sortMode: "created",
      customOrder: [],
    }, view.actions);

    const row = view.list.querySelector<HTMLElement>(".project-item")!;
    expect(view.actions.bindDrag).toHaveBeenCalledWith(row, 7);
    expect(view.actions.bindInteractions).toHaveBeenCalledWith(row, 7);
    expect(view.actions.createMenuButton).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });
});
