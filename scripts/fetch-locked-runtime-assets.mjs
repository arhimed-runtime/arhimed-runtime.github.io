import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, "runtime-assets.manifest.json"), "utf8"));

for (const artifact of manifest.artifacts) {
  const target = resolve(root, artifact.target);
  if (!target.startsWith(`${root}${sep}`)) throw new Error(`Unsafe target path: ${artifact.target}`);
  const response = await fetch(artifact.source, { redirect: "error" });
  if (!response.ok) throw new Error(`Could not fetch ${artifact.source}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== artifact.sha256) throw new Error(`Integrity mismatch for ${artifact.target}: expected ${artifact.sha256}, got ${actual}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  process.stdout.write(`verified ${artifact.target}\n`);
}
