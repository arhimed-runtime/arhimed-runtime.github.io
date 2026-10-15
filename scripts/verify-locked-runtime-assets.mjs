import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, "runtime-assets.manifest.json"), "utf8"));

for (const artifact of manifest.artifacts) {
  const target = resolve(root, artifact.target);
  if (!target.startsWith(`${root}${sep}`)) throw new Error(`Unsafe target path: ${artifact.target}`);
  const bytes = await readFile(target);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== artifact.sha256) throw new Error(`Integrity mismatch for ${artifact.target}: expected ${artifact.sha256}, got ${actual}`);
  const info = await stat(target);
  process.stdout.write(`verified ${artifact.target} (${info.size} bytes)\n`);
}
