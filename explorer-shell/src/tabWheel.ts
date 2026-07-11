export type TabWheelInput = {
  deltaX: number;
  deltaY: number;
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
};

export type TabWheelResult = {
  shouldHandle: boolean;
  nextScrollLeft: number;
};

export function tabWheelScroll(input: TabWheelInput): TabWheelResult {
  const maxScrollLeft = Math.max(0, input.scrollWidth - input.clientWidth);
  if (maxScrollLeft === 0) {
    return { shouldHandle: false, nextScrollLeft: input.scrollLeft };
  }

  const delta = input.deltaX !== 0 ? input.deltaX : input.deltaY;
  if (delta === 0) {
    return { shouldHandle: false, nextScrollLeft: input.scrollLeft };
  }

  return {
    shouldHandle: true,
    nextScrollLeft: clamp(input.scrollLeft + delta, 0, maxScrollLeft),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
