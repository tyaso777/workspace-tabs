import { describe, expect, it } from "vitest";
import { applyMultiSelection, emptyMultiSelection } from "./multiSelection";

const orderedIds = [10, 20, 30, 40, 50];

describe("applyMultiSelection", () => {
  it("selects only the clicked item on a normal click", () => {
    expect(
      applyMultiSelection(emptyMultiSelection(), orderedIds, 30, {
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toEqual({ selectedIds: [30], anchorId: 30 });
  });

  it("toggles one item with Ctrl while preserving other selections", () => {
    const selected = applyMultiSelection(
      { selectedIds: [10, 30], anchorId: 30 },
      orderedIds,
      40,
      { ctrlKey: true, shiftKey: false },
    );
    expect(selected).toEqual({ selectedIds: [10, 30, 40], anchorId: 40 });

    expect(
      applyMultiSelection(selected, orderedIds, 30, {
        ctrlKey: true,
        shiftKey: false,
      }),
    ).toEqual({ selectedIds: [10, 40], anchorId: 30 });
  });

  it("selects a contiguous displayed range with Shift", () => {
    expect(
      applyMultiSelection(
        { selectedIds: [20], anchorId: 20 },
        orderedIds,
        50,
        { ctrlKey: false, shiftKey: true },
      ),
    ).toEqual({ selectedIds: [20, 30, 40, 50], anchorId: 20 });
  });

  it("selects a backwards range in displayed order", () => {
    expect(
      applyMultiSelection(
        { selectedIds: [40], anchorId: 40 },
        orderedIds,
        20,
        { ctrlKey: false, shiftKey: true },
      ),
    ).toEqual({ selectedIds: [20, 30, 40], anchorId: 40 });
  });

  it("adds a range to existing selections with Ctrl+Shift", () => {
    expect(
      applyMultiSelection(
        { selectedIds: [10, 30], anchorId: 30 },
        orderedIds,
        50,
        { ctrlKey: true, shiftKey: true },
      ),
    ).toEqual({ selectedIds: [10, 30, 40, 50], anchorId: 30 });
  });
});
