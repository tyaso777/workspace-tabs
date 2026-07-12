// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyInlineEditState } from "./inlineEdit";
import {
  NotePanelRenderer,
  type NotePanelRenderActions,
  type NotePanelRenderState,
} from "./notePanelRenderer";

function elements() {
  document.body.innerHTML = `
    <section id="panel"><span id="count"></span><button id="toggle"></button>
      <button id="add"></button><button id="delete"></button><nav id="list"></nav>
      <section id="detail"><h4 id="title"></h4><div id="content"></div></section>
    </section>`;
  return {
    panel: document.querySelector<HTMLElement>("#panel")!,
    count: document.querySelector<HTMLElement>("#count")!,
    list: document.querySelector<HTMLElement>("#list")!,
    detail: document.querySelector<HTMLElement>("#detail")!,
    title: document.querySelector<HTMLElement>("#title")!,
    content: document.querySelector<HTMLElement>("#content")!,
    addButton: document.querySelector<HTMLButtonElement>("#add")!,
    deleteButton: document.querySelector<HTMLButtonElement>("#delete")!,
    toggleSizeButton: document.querySelector<HTMLButtonElement>("#toggle")!,
  };
}

const notes = [
  { id: 1, project_id: 4, title: "First", content: "Alpha", position: 0 },
  { id: 2, project_id: 4, title: "Second", content: "Beta", position: 1 },
];

function state(overrides: Partial<NotePanelRenderState> = {}): NotePanelRenderState {
  return {
    hasProject: true,
    notes,
    activeNote: notes[0],
    selectedIds: [1],
    panelState: { customHeight: null, maximized: false },
    inlineEdit: emptyInlineEditState(),
    editingNoteId: null,
    ...overrides,
  };
}

function actions(overrides: Partial<NotePanelRenderActions> = {}): NotePanelRenderActions {
  return {
    applyHeight: vi.fn(),
    enqueue: (interaction) => { void interaction(); },
    finishCurrentEdit: vi.fn(async () => true),
    selectFromPointer: vi.fn(async () => undefined),
    startTitleEditFromList: vi.fn(async () => undefined),
    prepareContextMenu: vi.fn(async () => undefined),
    startEdit: vi.fn(),
    updateDraft: vi.fn(),
    commitEdit: vi.fn(async () => undefined),
    isEditing: vi.fn(() => false),
    ...overrides,
  };
}

describe("NotePanelRenderer DOM", () => {
  beforeEach(() => document.body.replaceChildren());

  it("renders active and selected notes plus their detail", () => {
    const dom = elements();
    new NotePanelRenderer(dom).render(state(), actions());

    expect(dom.list.querySelectorAll(".note-list-item")).toHaveLength(2);
    expect(dom.list.querySelector(".note-list-item.is-active")?.textContent).toContain("First");
    expect(dom.list.querySelector(".note-list-item.is-selected")).not.toBeNull();
    expect(dom.title.textContent).toBe("First");
    expect(dom.content.textContent).toBe("Alpha");
  });

  it("starts title and content editing from a double click", () => {
    const dom = elements();
    const handler = actions();
    new NotePanelRenderer(dom).render(state(), handler);

    dom.title.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    dom.content.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(handler.startEdit).toHaveBeenNthCalledWith(1, "noteTitle");
    expect(handler.startEdit).toHaveBeenNthCalledWith(2, "noteContent");
  });

  it("finishes editing and selects another note from one pointer action", async () => {
    const dom = elements();
    const handler = actions();
    const editing = state({
      inlineEdit: { field: "noteContent", draft: "Changed" },
      editingNoteId: 1,
    });
    new NotePanelRenderer(dom).render(editing, handler);
    const second = dom.list.querySelectorAll<HTMLElement>(".note-list-item")[1];

    second.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, detail: 1 }));
    await Promise.resolve();

    expect(handler.finishCurrentEdit).toHaveBeenCalledOnce();
    expect(handler.selectFromPointer).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ ctrlKey: false, shiftKey: false }),
    );
  });

  it("renders and commits the title editor", async () => {
    const dom = elements();
    const handler = actions({ isEditing: vi.fn(() => true) });
    new NotePanelRenderer(dom).render(state({
      inlineEdit: { field: "noteTitle", draft: "Draft" },
      editingNoteId: 1,
    }), handler);
    const input = dom.title.querySelector<HTMLInputElement>("input")!;
    input.value = "Saved";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();

    expect(handler.commitEdit).toHaveBeenCalledWith("Saved");
  });
});
