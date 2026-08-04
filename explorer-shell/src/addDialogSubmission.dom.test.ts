// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { bindAddDialogSubmission } from "./addDialogSubmission";

function setup(multiline = false) {
  const form = document.createElement("form");
  const input = multiline ? document.createElement("textarea") : document.createElement("input");
  const cancel = document.createElement("button");
  cancel.type = "button";
  const confirm = document.createElement("button");
  confirm.type = "button";
  form.append(input, cancel, confirm);
  const submit = vi.fn(async () => undefined);
  bindAddDialogSubmission({ form, confirmButton: confirm, submit, enterControls: [input], multiline });
  return { form, input, cancel, confirm, submit };
}

describe("add dialog submission", () => {
  it("uses the add action for a form submission instead of the first Cancel button", async () => {
    const view = setup();
    view.form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(view.submit).toHaveBeenCalledOnce();
  });

  it("submits a single-item textarea with Enter and preserves Shift+Enter", async () => {
    const view = setup();
    view.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(view.submit).toHaveBeenCalledOnce();

    view.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(view.submit).toHaveBeenCalledOnce();
  });

  it("keeps Enter as a newline in bulk input and submits with Ctrl+Enter", async () => {
    const view = setup(true);
    view.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(view.submit).not.toHaveBeenCalled();

    view.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(view.submit).toHaveBeenCalledOnce();
  });

  it("prevents concurrent duplicate submissions", async () => {
    const form = document.createElement("form");
    const confirm = document.createElement("button");
    let resolveSubmit!: () => void;
    const submit = vi.fn(() => new Promise<void>((resolve) => { resolveSubmit = resolve; }));
    bindAddDialogSubmission({ form, confirmButton: confirm, submit });
    confirm.click();
    confirm.click();
    expect(submit).toHaveBeenCalledOnce();
    resolveSubmit();
    await Promise.resolve();
  });
});
