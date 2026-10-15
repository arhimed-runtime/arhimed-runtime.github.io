import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "no-webgpu-pages.spec.ts",
  timeout: 90_000,
  workers: 1,
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "chrome-no-gpu", use: { channel: "chrome", launchOptions: { args: ["--disable-gpu"] } } },
    { name: "edge-no-gpu", use: { channel: "msedge", launchOptions: { args: ["--disable-gpu"] } } },
  ],
});
