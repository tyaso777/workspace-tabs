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

  const defaultTab = page.locator(".tab-item").filter({ hasText: "New Tab" }).first();
  await defaultTab.locator(".tab-button").click();
  await expect(defaultTab).toHaveClass(/is-active/);

  await page.locator(".tab-item").filter({ hasText: "Reports 2026" }).dragTo(defaultTab);
  await expect(page.locator(".tab-name-label").first()).toHaveText("Reports 2026");
});
