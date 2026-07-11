import { describe, expect, it } from "vitest";
import { tabWheelScroll } from "./tabWheel";

describe("tab wheel scrolling", () => {
  it("does not handle wheel events when tabs do not overflow", () => {
    expect(
      tabWheelScroll({
        deltaX: 0,
        deltaY: 80,
        scrollLeft: 0,
        scrollWidth: 400,
        clientWidth: 400,
      }),
    ).toEqual({ shouldHandle: false, nextScrollLeft: 0 });
  });

  it("converts vertical wheel delta to horizontal tab scrolling", () => {
    expect(
      tabWheelScroll({
        deltaX: 0,
        deltaY: 80,
        scrollLeft: 20,
        scrollWidth: 800,
        clientWidth: 400,
      }),
    ).toEqual({ shouldHandle: true, nextScrollLeft: 100 });
  });

  it("uses horizontal trackpad delta when present", () => {
    expect(
      tabWheelScroll({
        deltaX: 40,
        deltaY: 80,
        scrollLeft: 20,
        scrollWidth: 800,
        clientWidth: 400,
      }),
    ).toEqual({ shouldHandle: true, nextScrollLeft: 60 });
  });

  it("clamps the next scroll position", () => {
    expect(
      tabWheelScroll({
        deltaX: 0,
        deltaY: 500,
        scrollLeft: 350,
        scrollWidth: 800,
        clientWidth: 400,
      }),
    ).toEqual({ shouldHandle: true, nextScrollLeft: 400 });
  });
});
