import { describe, expect, it } from "vitest";
import { tabCreationMenuOpenAfter } from "./tabCreationMenu";

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
