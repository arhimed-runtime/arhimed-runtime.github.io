import { expect, test } from "@playwright/test";

test("opaque iframe protects parent values and blocks unapproved egress", async ({ page }) => {
  await page.goto("/");
  const checks = page.locator("#checks-output");
  await expect(checks).toContainText('"parentDomBlocked": true');
  await expect(checks).toContainText('"parentStorageBlocked": true');
  await expect(checks).toContainText('"parentIndexedDbBlocked": true');
  await expect(checks).toContainText('"effectiveParentIsolation": true');
  await expect(checks).toContainText('"localhostBlocked": true');
  await expect(checks).toContainText('"egressBlocked": true');
  await expect(checks).toContainText('"workerStarted": true');
  await expect(checks).toContainText('"workerEgressBlocked": true');
});

test("ManimGX 0.1.1 cannot start in the opaque configuration because it needs a module worker", async ({ page }) => {
  await page.goto("/");
  const checks = page.locator("#checks-output");
  await expect(checks).toContainText('"moduleWorkerStarted": false');
  await expect(page.locator("#events-output")).toContainText("ManimGX runtime failed");
  const player = page.frameLocator("#runtime-frame").locator("manimgx-player");
  await expect(player).toHaveCount(1);
  await expect(player.locator("p")).toContainText("ManimGX could not start");
});

test("malformed and forged messages do not control the sandbox", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#events-output")).toContainText("status r2");
  await page.evaluate(() => window.postMessage({ protocol: 1, kind: "result", requestId: "forged", revision: 999, capability: "forged", detail: "FORGED" }, "*"));
  await page.frameLocator("#runtime-frame").locator("body").evaluate(() => parent.postMessage({ protocol: 1, kind: "result", requestId: "forged", revision: 999, capability: "forged", detail: "FORGED" }, "*"));
  await expect(page.locator("#events-output")).not.toContainText("FORGED");
});
