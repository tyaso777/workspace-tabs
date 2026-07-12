// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyInlineEditState } from "./inlineEdit";
import {
  TabBarRenderer,
  type TabBarRenderActions,
  type TabBarRenderState,
} from "./tabBarRenderer";

const tabs = [
  { id: 1, name: "Files", kind: "folder" as const },
  { id: 2, name: "Docs", kind: "links" as const },
];

function state(overrides: Partial<TabBarRenderState> = {}): TabBarRenderState {
  return {
    tabs,
    activeTabId: 1,
    selection: { selectedIds: [1], anchorId: 1 },
    inlineEdit: emptyInlineEditState(),
    editSurface: "tab-bar",
    ...overrides,
  };
}

function actions(overrides: Partial<TabBarRenderActions> = {}): TabBarRenderActions {
  let selection = { selectedIds: [1], anchorId: 1 as number | null };
  return {
    getActiveTabId: vi.fn(() => 1),
    getSelection: vi.fn(() => selection),
    setSelection: vi.fn((next) => { selection = next; }),
    startNameEdit: vi.fn(),
    updateDraft: vi.fn(),
    commitEdit: vi.fn(async () => undefined),
    isNameEditing: vi.fn(() => false),
    finishCurrentEdit: vi.fn(async () => true),
    activate: vi.fn(async () => undefined),
    move: vi.fn(async () => undefined),
    openContextMenu: vi.fn(),
    render: vi.fn(),
    ...overrides,
  };
}

describe("TabBarRenderer DOM", () => {
  beforeEach(() => document.body.replaceChildren());

  it("renders active, selected, folder, and links tabs", () => {
    const list = document.createElement("nav");
    const handler = actions();
    new TabBarRenderer(list).render(state(), handler);

    expect(list.querySelectorAll(".tab-item")).toHaveLength(2);
    expect(list.querySelector(".tab-item.is-active")?.textContent).toContain("Files");
    expect(list.querySelector("[data-tab-kind='folder'] .tab-kind-icon")).not.toBeNull();
    expect(list.querySelector("[data-tab-kind='links'] .tab-kind-icon")).not.toBeNull();
  });

  it("starts tab name editing from a double mousedown", () => {
    const list = document.createElement("nav");
    const handler = actions();
    new TabBarRenderer(list).render(state(), handler);
    const button = list.querySelector<HTMLElement>(".tab-button")!;

    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, detail: 2 }));

    expect(handler.startNameEdit).toHaveBeenCalledWith(1);
  });

  it("renders and commits the inline tab editor", async () => {
    const list = document.createElement("nav");
    const handler = actions({ isNameEditing: vi.fn(() => true) });
    new TabBarRenderer(list).render(state({
      inlineEdit: { field: "tabName", draft: "Draft" },
    }), handler);
    const input = list.querySelector<HTMLInputElement>("input[data-inline-field='tabName']")!;
    input.value = "Saved";

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();

    expect(handler.commitEdit).toHaveBeenCalledWith("Saved");
  });

  it("uses Ctrl pointerdown to extend selection and activate the clicked tab", async () => {
    const list = document.createElement("nav");
    const handler = actions();
    new TabBarRenderer(list).render(state(), handler);
    const second = list.querySelectorAll<HTMLElement>(".tab-item")[1];

    second.dispatchEvent(new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      ctrlKey: true,
    }));
    await Promise.resolve();

    expect(handler.setSelection).toHaveBeenCalledWith({ selectedIds: [1, 2], anchorId: 2 });
    expect(handler.activate).toHaveBeenCalledWith(2);
  });

  it("finishes editing and activates another tab from one pointer action", async () => {
    const list = document.createElement("nav");
    const handler = actions();
    new TabBarRenderer(list).render(state({
      inlineEdit: { field: "tabName", draft: "Draft" },
    }), handler);
    const second = list.querySelectorAll<HTMLElement>(".tab-item")[1];

    second.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    await Promise.resolve();

    expect(handler.finishCurrentEdit).toHaveBeenCalledOnce();
    expect(handler.activate).toHaveBeenCalledWith(2);
  });
});
