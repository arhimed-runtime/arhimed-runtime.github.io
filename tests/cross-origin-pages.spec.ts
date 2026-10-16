import { expect, test } from "@playwright/test";

const parentOrigin = "https://resarytrew.github.io";
const parentPage = `${parentOrigin}/arhimed-runtime-lab/cross-origin-parent.html`;
const runtimePage = "https://arhimed-runtime.github.io/cross-origin-runtime.html?deployment=2f634dcb5eb90f2ffc502bdc5e88fb055eef2c53";
const runtimeParameter = encodeURIComponent(runtimePage);
const acceptanceParent = `${parentPage}?parent=8acafec5f4954c9a72a7f5ea05c7f6e6542d1085&runtime=${runtimeParameter}`;
const benchmarkParent = `${acceptanceParent}&benchmark=20`;

test("dedicated HTTPS runtime renders a cold scene through its authenticated channel", async ({ page }) => {
  await page.goto(acceptanceParent);
  await page.evaluate((target) => {
    const frame = document.querySelector<HTMLIFrameElement>("#runtime-frame");
    // No port, wrong session and an unrelated command must not affect the authorised channel.
    frame?.contentWindow?.postMessage({ protocol: "arhimed-runtime-v1", kind: "connect", sessionId: "forged" }, target);
  }, "https://arhimed-runtime.github.io");

  const checks = page.locator("#checks-output");
  await expect(checks).toContainText('"moduleWorkerStarted": true', { timeout: 45_000 });
  await expect(checks).toContainText('"parentDomBlocked": true');
  await expect(checks).toContainText('"parentStorageBlocked": true');
  await expect(checks).toContainText('"parentIndexedDbBlocked": true');
  await expect(checks).toContainText('"parentOpenRouterKeyBlocked": true');
  await expect(checks).toContainText('"localhostBlocked": true');
  await expect(checks).toContainText('"egressBlocked": true');
  await expect(checks).toContainText('"workerEgressBlocked": true');
  await expect(page.locator("#summary")).toHaveText("Cross-origin run, reactive scene, stop, and restart completed.", { timeout: 75_000 });

  const events = await page.locator("#events-output").innerText();
  expect(events).toContain("rendered r2");
  expect(events).toContain("rendered r3");
  expect(events).toContain("stopped r4");
  expect(events).toContain("rendered r5");
  const timings = [...events.matchAll(/rendered r\d+: WebGPU player reported a rendered scene in (\d+) ms/g)].map((match) => Number(match[1]));
  process.stdout.write(`${test.info().project.name} HTTPS ManimGX timings: cold=${timings[0]}ms reactive=${timings[1]}ms restart=${timings[2]}ms\n`);
});

test("dedicated HTTPS runtime renders MathTex, Axes, groups, Python math and an updater to the end", async ({ page }) => {
  await page.goto(`${acceptanceParent}&scene=documented`);
  await expect(page.locator("#summary")).toHaveText("Cross-origin run, reactive scene, stop, and restart completed.", { timeout: 75_000 });
  const runtime = page.frameLocator("#runtime-frame");
  const player = runtime.locator("manimgx-player");
  await expect.poll(async () => player.evaluate((element) => {
    const view = element as HTMLElement & { currentTime: number; duration: number };
    return Number.isFinite(view.duration) && view.currentTime >= view.duration;
  }), { timeout: 15_000 }).toBe(true);
  await expect(page.locator("#events-output")).toContainText("rendered r2");
});

test("dedicated HTTPS runtime reports no-WebGPU without receiving parent data", async ({ page }) => {
  const controlledRuntime = encodeURIComponent(`${runtimePage}&simulateNoWebGpu=1`);
  await page.goto(`${parentPage}?parent=8acafec5f4954c9a72a7f5ea05c7f6e6542d1085&runtime=${controlledRuntime}`);
  await expect(page.locator("#checks-output")).toContainText('"webgpuPresent": false', { timeout: 45_000 });
  await expect(page.locator("#checks-output")).toContainText('"parentOpenRouterKeyBlocked": true');
  await expect(page.locator("#summary")).toContainText("ManimGX failed", { timeout: 60_000 });
});

test("dedicated HTTPS runtime keeps warmed simple-frame p95 under one second", async ({ page }) => {
  await page.goto(benchmarkParent);
  await expect(page.locator("#summary")).toHaveText("Cross-origin run completed with 20 warmed ManimGX frames.", { timeout: 75_000 });
  const events = await page.locator("#events-output").innerText();
  const allFrames = [...events.matchAll(/rendered r\d+: WebGPU player reported a rendered scene in (\d+) ms/g)].map((match) => Number(match[1]));
  const warmed = allFrames.slice(-20).sort((left, right) => left - right);
  expect(warmed).toHaveLength(20);
  const p95 = warmed[Math.ceil(warmed.length * 0.95) - 1];
  process.stdout.write(`${test.info().project.name} HTTPS warmed simple-frame p95=${p95}ms; samples=${warmed.join(",")}\n`);
  expect(p95).toBeLessThanOrEqual(1000);
});

test("dedicated HTTPS runtime rejects oversized commands and ignores a stale revision", async ({ page }) => {
  await page.goto(`${acceptanceParent}&protocolTest=oversize`);
  await expect(page.locator("#summary")).toHaveText("Source exceeds the 256 KiB fixed-runtime limit.", { timeout: 30_000 });

  await page.goto(`${acceptanceParent}&protocolTest=stale`);
  await expect(page.locator("#summary")).toHaveText("Cross-origin run, reactive scene, stop, and restart completed.", { timeout: 75_000 });
});

test("dedicated HTTPS parent times out an unavailable runtime", async ({ page }) => {
  await page.goto(`${parentPage}?parent=8acafec5f4954c9a72a7f5ea05c7f6e6542d1085&runtime=${encodeURIComponent("https://arhimed-runtime.github.io/not-a-runtime.html")}`);
  await expect(page.locator("#summary")).toHaveText("Runtime failed to load or did not accept the authenticated MessageChannel within 10 seconds.", { timeout: 20_000 });
});
