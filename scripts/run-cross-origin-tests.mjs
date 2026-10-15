import { spawn } from "node:child_process";
import { resolve } from "node:path";

const child = spawn(process.execPath, [resolve("node_modules/@playwright/test/cli.js"), "test", "tests/cross-origin-local.spec.ts"], {
  cwd: process.cwd(),
  env: { ...process.env, ARHIMED_RUN_CROSS_ORIGIN: "1" },
  stdio: "inherit",
});
child.on("exit", (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));
