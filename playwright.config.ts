import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4183", trace: "retain-on-failure" },
  projects: [
    { name: "chrome", use: { channel: "chrome" } },
    { name: "edge", use: { channel: "msedge" } },
  ],
  webServer: {
    command: "npm run dev -- --port 4183",
    url: "http://127.0.0.1:4183",
    reuseExistingServer: false,
  },
});
