import { existsSync } from "node:fs";
import { test, expect } from "@playwright/test";

const assetsAvailable = existsSync("runtime-assets/pyodide/pyodide.mjs");
const enabled = process.env.ARHIMED_RUN_CROSS_ORIGIN === "1";

test.skip(!assetsAvailable || !enabled, "Run through npm run test:cross-origin after downloading the manifest-verified runtime assets.");

test("locked ManimGX runtime renders through a cross-origin MessageChannel", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("http://127.0.0.1:4184/cross-origin-parent.html?runtime=http%3A%2F%2F127.0.0.1%3A4185%2Fcross-origin-runtime.html");

  await expect(page.locator("#checks-output")).toContainText('"moduleWorkerStarted": true', { timeout: 30_000 });
  await expect(page.locator("#checks-output")).toContainText('"parentOpenRouterKeyBlocked": true');
  await expect(page.locator("#checks-output")).toContainText('"egressBlocked": true');
  await expect(page.locator("#checks-output")).toContainText('"workerEgressBlocked": true');
  await expect(page.locator("#summary")).toHaveText("Cross-origin run, reactive scene, stop, and restart completed.", { timeout: 75_000 });
});

test("runtime reports a controlled no-WebGPU failure without weakening isolation", async ({ page }) => {
  test.setTimeout(60_000);
  const runtime = "http%3A%2F%2F127.0.0.1%3A4185%2Fcross-origin-runtime.html%3FsimulateNoWebGpu%3D1";
  await page.goto(`http://127.0.0.1:4184/cross-origin-parent.html?runtime=${runtime}`);
  await expect(page.locator("#checks-output")).toContainText('"webgpuPresent": false', { timeout: 30_000 });
  await expect(page.locator("#summary")).toContainText("ManimGX failed", { timeout: 45_000 });
});

test("a missing runtime gives an explicit load failure", async ({ page }) => {
  await page.goto("http://127.0.0.1:4184/cross-origin-parent.html?runtime=http%3A%2F%2F127.0.0.1%3A4185%2Fmissing-runtime.html");
  await expect(page.locator("#summary")).toHaveText("Runtime failed to load or did not accept the authenticated MessageChannel within 10 seconds.", { timeout: 15_000 });
});
