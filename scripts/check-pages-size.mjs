import { readdir, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const root = resolve(process.cwd(), "dist");
const oneGiB = 1024 ** 3;
const githubBlobLimit = 100 * 1024 ** 2;
let bytes = 0;
let files = 0;
let largest = { path: "", bytes: 0 };

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = resolve(directory, entry.name);
    if (!target.startsWith(`${root}${sep}`)) throw new Error(`Unsafe build path: ${target}`);
    if (entry.isDirectory()) await visit(target);
    else if (entry.isFile()) {
      const info = await stat(target);
      bytes += info.size;
      files += 1;
      if (info.size > largest.bytes) largest = { path: target.slice(root.length + 1), bytes: info.size };
      if (info.size > githubBlobLimit) throw new Error(`Published file exceeds GitHub's 100 MiB repository file limit: ${target}`);
    }
  }
}

await visit(root);
if (bytes > oneGiB) throw new Error(`Published Pages package exceeds 1 GiB: ${bytes} bytes`);
process.stdout.write(`Pages package: ${files} files, ${bytes} bytes; largest ${largest.path} (${largest.bytes} bytes).\n`);
