import { describe, expect, it } from "vitest";
import { tabCreationMenuOpenAfter, tabCreationMenuPosition } from "./tabCreationMenu";

describe("tab creation menu", () => {
  it("opens and closes from the add-tab button", () => {
    expect(tabCreationMenuOpenAfter(false, "toggle")).toBe(true);
    expect(tabCreationMenuOpenAfter(true, "toggle")).toBe(false);
  });

  it("closes without creating a tab when dismissed", () => {
    expect(tabCreationMenuOpenAfter(true, "dismiss")).toBe(false);
  });

  it("closes after a tab type is selected", () => {
    expect(tabCreationMenuOpenAfter(true, "select")).toBe(false);
  });
});

describe("tab creation menu position", () => {
  const main = { left: 300, top: 0, right: 1200, bottom: 800 };

  it("keeps the menu inside the main area when there are few tabs", () => {
    expect(tabCreationMenuPosition(
      { left: 310, top: 200, right: 348, bottom: 260 },
      main,
      250,
      150,
    )).toEqual({ left: 308, top: 266, placement: "below" });
  });

  it("keeps the menu inside the right edge when tabs fill the strip", () => {
    expect(tabCreationMenuPosition(
      { left: 1180, top: 200, right: 1218, bottom: 260 },
      main,
      250,
      150,
    ).left).toBe(942);
  });

  it("opens above the button when there is no room below", () => {
    expect(tabCreationMenuPosition(
      { left: 700, top: 690, right: 738, bottom: 750 },
      main,
      250,
      150,
    )).toMatchObject({ top: 534, placement: "above" });
  });
});
