// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { ContextMenuController } from "./contextMenuController";

function menu(width: number, height: number) {
  const element = document.createElement("div");
  element.hidden = true;
  Object.defineProperties(element, {
    offsetWidth: { value: width },
    offsetHeight: { value: height },
  });
  const focusTarget = document.createElement("button");
  focusTarget.focus = vi.fn();
  element.append(focusTarget);
  return { menu: element, focusTarget };
}

describe("ContextMenuController DOM", () => {
  it("opens one menu, stores its target, and closes the previous menu", () => {
    const project = menu(100, 80);
    const tab = menu(90, 70);
    const controller = new ContextMenuController({ project, tab });

    controller.open("project", 4, 20, 30);
    expect(project.menu.hidden).toBe(false);
    expect(controller.target("project")).toBe(4);
    expect(project.focusTarget.focus).toHaveBeenCalledOnce();

    controller.open("tab", 9, 40, 50);
    expect(project.menu.hidden).toBe(true);
    expect(controller.target("project")).toBeNull();
    expect(tab.menu.hidden).toBe(false);
  });

  it("keeps menus inside the viewport and supports right alignment", () => {
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 300 },
      innerHeight: { configurable: true, value: 200 },
    });
    const project = menu(100, 80);
    const controller = new ContextMenuController({ project });

    controller.open("project", 1, 290, 190, { alignRight: true });

    expect(project.menu.style.left).toBe("190px");
    expect(project.menu.style.top).toBe("112px");
  });

  it("reports menu containment and closes all targets", () => {
    const project = menu(100, 80);
    const tab = menu(90, 70);
    const controller = new ContextMenuController({ project, tab });
    controller.open("project", 2, 10, 10);

    expect(controller.contains(project.focusTarget)).toBe(true);
    expect(controller.contains(document.createElement("div"))).toBe(false);
    controller.closeAll();
    expect(project.menu.hidden).toBe(true);
    expect(tab.menu.hidden).toBe(true);
    expect(controller.target("project")).toBeNull();
  });
});
