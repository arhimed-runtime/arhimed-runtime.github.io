import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const origin = (process.env.ARHIMED_RUNTIME_ORIGIN ?? "https://arhimed-runtime.github.io").replace(/\/$/, "");
const manifest = JSON.parse(await readFile("runtime-assets.manifest.json", "utf8"));

for (const artifact of manifest.artifacts) {
  if (!artifact.target.startsWith("public/")) throw new Error(`Asset is not a published static path: ${artifact.target}`);
  const path = artifact.target.slice("public".length);
  const response = await fetch(`${origin}${path}?integrity=${artifact.sha256}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Published asset unavailable: ${origin}${path} (${response.status})`);
  const actual = createHash("sha256").update(new Uint8Array(await response.arrayBuffer())).digest("hex");
  if (actual !== artifact.sha256) throw new Error(`Published integrity mismatch for ${path}: expected ${artifact.sha256}, got ${actual}`);
  process.stdout.write(`verified ${origin}${path}\n`);
}
