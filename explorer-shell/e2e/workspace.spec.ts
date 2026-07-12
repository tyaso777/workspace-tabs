import { expect, test } from "@playwright/test";

test("creates, edits, switches, and reorders workspace tabs", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#storage-mode")).toContainText("Portable");

  await page.locator("#project-name").fill("First Project");
  await page.locator("#project-summary").fill("First summary");
  await page.getByRole("button", { name: "Add Project" }).click();
  await expect(page.locator("#active-project-name")).toHaveText("First Project");

  await page.locator("#project-name").fill("Second Project");
  await page.locator("#project-summary").fill("Second summary");
  await page.getByRole("button", { name: "Add Project" }).click();
  await expect(page.locator(".project-item")).toHaveCount(2);

  const activeProject = page.locator(".project-item.is-active");
  await expect(activeProject).toContainText("Second Project");
  await activeProject.locator("strong").dblclick();
  const projectNameEditor = activeProject.locator('input[data-inline-field="projectName"]');
  await expect(projectNameEditor).toBeVisible();
  await projectNameEditor.fill("Renamed Project");
  await projectNameEditor.press("Enter");
  await expect(activeProject.locator("strong")).toHaveText("Renamed Project");

  await activeProject.locator("span.project-list-editable").dblclick();
  const summaryEditor = activeProject.locator('input[data-inline-field="projectSummary"]');
  await summaryEditor.fill("Edited summary");
  await page.locator(".project-item").filter({ hasText: "First Project" }).click();
  await expect(page.locator("#active-project-name")).toHaveText("First Project");
  await expect(page.locator(".project-item").filter({ hasText: "Renamed Project" })).toContainText(
    "Edited summary",
  );

  const inactiveProject = page.locator(".project-item").filter({ hasText: "Renamed Project" });
  await inactiveProject.locator("strong").dblclick();
  const inactiveProjectEditor = page.locator('input[data-inline-field="projectName"]');
  await expect(inactiveProjectEditor).toBeVisible();
  await inactiveProjectEditor.fill("Edited While Inactive");
  await inactiveProjectEditor.press("Enter");
  await expect(page.locator("#active-project-name")).toHaveText("Edited While Inactive");

  await page.locator(".project-item").filter({ hasText: "First Project" }).click();

  await page.locator("#add-note-button").click();
  await page.locator('input[data-inline-field="noteTitle"]').fill("Note A");
  await page.locator('input[data-inline-field="noteTitle"]').press("Enter");
  await page.locator("#add-note-button").click();
  await page.locator('input[data-inline-field="noteTitle"]').fill("Note B");
  await page.locator('input[data-inline-field="noteTitle"]').press("Enter");
  await expect(page.locator(".note-list-item")).toHaveCount(2);

  await page.locator(".note-list-item").filter({ hasText: "Note A" }).click({ modifiers: ["Control"] });
  await expect(page.locator(".note-list-item.is-selected")).toHaveCount(2);
  await page.locator(".note-list-item").filter({ hasText: "Note B" }).click({ button: "right" });
  await expect(page.locator("#delete-note-menu-button")).toHaveText("Delete 2 Notes");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Delete 2 notes?");
    await dialog.accept();
  });
  await page.locator("#delete-note-menu-button").click();
  await expect(page.locator(".note-list-item")).toHaveCount(0);
  await page.locator("#undo-button").click();
  await expect(page.locator(".note-list-item")).toHaveCount(2);

  await page.locator("#add-tab-button").click();
  await expect(page.locator("#add-tab-menu")).toBeVisible();
  await page.locator("#add-folder-tab-button").click();
  await expect(page.locator(".tab-item")).toHaveCount(2);

  const tabEditor = page.locator('input[data-inline-field="tabName"]');
  await expect(tabEditor).toBeVisible();
  await tabEditor.fill("Reports");
  await tabEditor.press("Enter");
  const reportsTab = page.locator(".tab-item").filter({ hasText: "Reports" });
  await expect(reportsTab).toHaveClass(/is-active/);

  await reportsTab.locator(".tab-button").dblclick();
  await expect(page.locator('input[data-inline-field="tabName"]')).toBeVisible();
  await page.locator('input[data-inline-field="tabName"]').fill("Reports 2026");
  await page.locator('input[data-inline-field="tabName"]').press("Enter");

  await page.locator("#add-tab-button").click();
  await page.locator("#add-links-tab-button").click();
  await page.locator('input[data-inline-field="tabName"]').fill("Bookmarks");
  await page.locator('input[data-inline-field="tabName"]').press("Enter");
  await page.locator("#add-links-button").click();
  await page.locator("#add-links-input").fill(
    "https://example.com\nhttps://example.org",
  );
  await page.locator("#confirm-add-links-button").click();
  await expect(page.locator(".link-row")).toHaveCount(2);

  await page.locator(".link-row .file-check").nth(0).click();
  await page.locator(".link-row .file-check").nth(1).click();
  await expect(page.locator(".link-row.is-checked")).toHaveCount(2);
  await page.locator(".link-row").first().click({ button: "right" });
  await expect(page.locator("#delete-link-menu-button")).toHaveText("Delete 2 Links");
  await page.locator("#delete-link-menu-button").click();
  await expect(page.locator("#delete-link-dialog-title")).toHaveText("Delete 2 links?");
  await page.locator("#confirm-delete-link-button").click();
  await expect(page.locator(".link-row")).toHaveCount(0);
  await page.locator("#undo-button").click();
  await expect(page.locator(".link-row")).toHaveCount(2);

  const bookmarksTab = page.locator(".tab-item").filter({ hasText: "Bookmarks" });
  await bookmarksTab.click({ button: "right" });
  await page.locator("#delete-tab-menu-button").click();
  await page.locator("#confirm-delete-tab-button").click();
  await expect(page.locator(".tab-item")).toHaveCount(2);

  const defaultTab = page.locator(".tab-item").filter({ hasText: "New Tab" }).first();
  await defaultTab.locator(".tab-button").click();
  await expect(defaultTab).toHaveClass(/is-active/);

  await page.locator(".tab-item").filter({ hasText: "Reports 2026" }).dragTo(defaultTab);
  await expect(page.locator(".tab-name-label").first()).toHaveText("Reports 2026");

  const reports2026Tab = page.locator(".tab-item").filter({ hasText: "Reports 2026" });
  await defaultTab.locator(".tab-button").click({ modifiers: ["Control"] });
  await expect(page.locator(".tab-item.is-selected")).toHaveCount(2);
  await reports2026Tab.click({ button: "right" });
  await expect(page.locator("#delete-tab-menu-button")).toHaveText("Delete 2 Tabs");
  await page.locator("#delete-tab-menu-button").click();
  await expect(page.locator("#delete-tab-dialog-title")).toHaveText("Delete 2 tabs?");
  await page.locator("#confirm-delete-tab-button").click();
  await expect(page.locator(".tab-item")).toHaveCount(0);
  await page.locator("#undo-button").click();
  await expect(page.locator(".tab-item")).toHaveCount(2);

  const editedProject = page.locator(".project-item").filter({ hasText: "Edited While Inactive" });
  await page.locator(".project-item").filter({ hasText: "First Project" }).click();
  await editedProject.click({ modifiers: ["Control"] });
  await expect(page.locator(".project-item.is-selected")).toHaveCount(2);

  await editedProject.click({ button: "right" });
  await expect(page.locator("#project-context-menu")).toBeVisible();
  await expect(page.locator("#delete-project-menu-button")).toHaveText("Delete 2 Projects");
  await page.locator("#delete-project-menu-button").click();

  await expect(page.locator("#delete-project-dialog")).toBeVisible();
  await expect(page.locator("#delete-project-dialog-title")).toHaveText("Delete 2 projects?");
  await expect(page.locator("#delete-project-dialog-detail")).toContainText("First Project");
  await expect(page.locator("#delete-project-dialog-detail")).toContainText(
    "Edited While Inactive",
  );
  await page.locator("#confirm-delete-project-button").click();
  await expect(page.locator(".project-item")).toHaveCount(0);

  await expect(page.locator("#undo-button")).toBeEnabled();
  await page.locator("#undo-button").click();
  await expect(page.locator(".project-item")).toHaveCount(2);
  await expect(page.locator(".project-item")).toContainText([
    "First Project",
    "Edited While Inactive",
  ]);
});
