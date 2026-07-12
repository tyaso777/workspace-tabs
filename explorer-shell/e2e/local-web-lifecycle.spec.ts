import { expect, test } from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const port = 47_892;
const url = `http://127.0.0.1:${port}`;
const runtime = resolve(".e2e-restart-runtime");
const runtimeExe = resolve(runtime, "workspace-tabs-local-web.exe");
const sourceExe = resolve("..", "local-web", "target", "debug", "workspace-tabs-local-web.exe");

function startLocalWeb(): ChildProcess {
  return spawn(runtimeExe, ["--port", String(port), "--no-browser"], {
    cwd: runtime,
    windowsHide: true,
    stdio: "ignore",
  });
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {
      // The process may still be binding the port.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error("Local Web did not become healthy in time.");
}

async function stopProcess(process: ChildProcess | null): Promise<void> {
  if (!process || process.exitCode !== null) return;
  process.kill();
  await waitForProcessExit(process, "Local Web did not stop in time.");
}

async function waitForProcessExit(process: ChildProcess, failureMessage: string): Promise<void> {
  if (process.exitCode !== null) return;
  await new Promise<void>((resolveExit, reject) => {
    const timeout = setTimeout(() => reject(new Error(failureMessage)), 5_000);
    process.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });
}

test("disconnects, restores persisted state after restart, and closes explicitly", async ({ page }) => {
  test.setTimeout(45_000);
  rmSync(runtime, { recursive: true, force: true });
  mkdirSync(resolve(runtime, "data"), { recursive: true });
  copyFileSync(sourceExe, runtimeExe);

  let process: ChildProcess | null = startLocalWeb();
  try {
    await waitForHealth();
    await page.goto(url);

    await page.locator("#project-name").fill("Persistent E2E");
    await page.locator("#project-summary").fill("Survives restart");
    await page.getByRole("button", { name: "Add Project" }).click();
    await page.locator("#active-tab-name").dblclick();
    await page.locator('input[data-inline-field="tabName"]').fill("Persistent Files");
    await page.locator('input[data-inline-field="tabName"]').press("Enter");

    await page.locator("#add-note-button").click();
    await page.locator('input[data-inline-field="noteTitle"]').fill("Persistent Note");
    await page.locator('input[data-inline-field="noteTitle"]').press("Enter");

    await page.locator("#add-tab-button").click();
    await page.locator("#add-links-tab-button").click();
    await page.locator('input[data-inline-field="tabName"]').fill("Persistent Links");
    await page.locator('input[data-inline-field="tabName"]').press("Enter");
    await page.locator("#add-link-button").click();
    await page.locator("#add-link-name").fill("Example");
    await page.locator("#add-link-url").fill("https://example.com");
    await page.locator("#confirm-add-link-button").click();
    await expect(page.locator(".link-row")).toHaveCount(1);

    await stopProcess(process);
    process = null;
    await expect(page.locator("#local-web-disconnected")).toBeVisible();
    await expect(page.locator("#app-shell")).toHaveClass(/is-local-web-disconnected/);

    process = startLocalWeb();
    await waitForHealth();
    await page.reload();
    await expect(page.locator("#active-project-name")).toHaveText("Persistent E2E");
    await expect(page.locator(".tab-name-label")).toContainText([
      "Persistent Files",
      "Persistent Links",
    ]);
    await expect(page.locator(".note-list-item")).toContainText(["Persistent Note"]);
    await expect(page.locator(".link-row")).toContainText(["Example"]);

    await page.locator("#runtime-close-button").click();
    await expect(page.locator("#close-runtime-dialog")).toBeVisible();
    await page.locator("#confirm-close-runtime-button").click();
    await expect(page.locator("#local-web-disconnected-title")).toHaveText(
      "WorkspaceTabs Local Web has closed.",
    );
    await waitForProcessExit(process, "Close Local Web did not stop the process.");
    process = null;
  } finally {
    await stopProcess(process);
    rmSync(runtime, { recursive: true, force: true });
  }
});
