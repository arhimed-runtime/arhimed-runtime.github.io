import { expect, test } from "@playwright/test";

const parent = "https://resarytrew.github.io/arhimed-runtime-lab/cross-origin-parent.html?parent=8acafec5f4954c9a72a7f5ea05c7f6e6542d1085";
const runtime = encodeURIComponent("https://arhimed-runtime.github.io/cross-origin-runtime.html?deployment=2f634dcb5eb90f2ffc502bdc5e88fb055eef2c53");

test("browser GPU disablement returns a controlled ManimGX error and preserves parent isolation", async ({ page }) => {
  await page.goto(`${parent}&runtime=${runtime}`);
  const checks = page.locator("#checks-output");
  await expect(checks).toContainText('"parentDomBlocked": true', { timeout: 45_000 });
  await expect(checks).toContainText('"parentOpenRouterKeyBlocked": true');
  await expect(page.locator("#summary")).toContainText("ManimGX failed", { timeout: 60_000 });
  await expect(page.locator("#summary")).toContainText(/no GPU adapter|WebGPU|adapter/i);
});
