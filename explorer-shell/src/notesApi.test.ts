import { describe, expect, it, vi } from "vitest";
import { createNotesApi } from "./notesApi";

describe("notesApi", () => {
  it("maps note operations to the Rust command contract", async () => {
    const snapshot = { version: 1 };
    const invoke = vi.fn(async () => snapshot);
    const api = createNotesApi(invoke);

    await expect(api.add(4, "New Note", "")).resolves.toBe(snapshot);
    await expect(api.update(4, 8, "Title", "Content")).resolves.toBe(snapshot);
    await expect(api.activate(4, 8)).resolves.toBe(snapshot);
    await expect(api.deleteMany(4, [8, 9])).resolves.toBe(snapshot);

    expect(invoke.mock.calls).toEqual([
      ["add_note", { projectId: 4, title: "New Note", content: "" }],
      ["update_note", { projectId: 4, noteId: 8, title: "Title", content: "Content" }],
      ["activate_note", { projectId: 4, noteId: 8 }],
      ["delete_notes", { projectId: 4, noteIds: [8, 9] }],
    ]);
  });
});
