import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Fetch at development time only. Browser scenes never contact package registries.
const manifest = JSON.parse(await readFile('runtime-assets.manifest.json', 'utf8'));
const lock = JSON.parse(await readFile('public/runtime-assets/pyodide/pyodide-lock.json', 'utf8'));
const visited = new Set();
const licenses = {
  sympy: 'BSD-3-Clause', mpmath: 'BSD-3-Clause', scipy: 'BSD-3-Clause',
  matplotlib: 'LicenseRef-Matplotlib', biopython: 'LicenseRef-Biopython',
  contourpy: 'BSD-3-Clause', cycler: 'BSD-3-Clause', fonttools: 'MIT',
  kiwisolver: 'BSD-3-Clause', packaging: 'BSD-2-Clause OR Apache-2.0',
  pyparsing: 'MIT', 'python-dateutil': 'Apache-2.0 OR BSD-3-Clause', pytz: 'MIT', six: 'MIT',
};
async function save(artifact) {
  let bytes;
  try { bytes = await readFile(artifact.target); }
  catch { const response = await fetch(artifact.source); if (!response.ok) throw new Error(`${response.status}: ${artifact.source}`); bytes = Buffer.from(await response.arrayBuffer()); }
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== artifact.sha256) throw new Error(`Integrity mismatch: ${artifact.target}`);
  await writeFile(artifact.target, bytes);
  if (!manifest.artifacts.some(item => item.target === artifact.target)) manifest.artifacts.push(artifact);
  console.log(`${artifact.target}: ${bytes.length} bytes`);
}
async function addPackage(name) {
  if (visited.has(name)) return;
  visited.add(name);
  const pkg = lock.packages[name];
  if (!pkg) throw new Error(`Not in pinned Pyodide: ${name}`);
  for (const dependency of pkg.depends) await addPackage(dependency);
  const target = `public/runtime-assets/pyodide/${pkg.file_name}`;
  if (manifest.artifacts.some(item => item.target === target)) return;
  if (!licenses[name]) throw new Error(`Missing license review: ${name}`);
  await save({ target, source: `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/${pkg.file_name}`, sha256: pkg.sha256, license: licenses[name], runtime: `Pyodide package ${pkg.name} ${pkg.version}` });
}
for (const name of ['sympy', 'scipy', 'matplotlib', 'biopython', 'pyparsing']) await addPackage(name);
for (const [name, version, license] of [['schemdraw', '0.23', 'MIT'], ['periodictable', '2.1.0', 'LicenseRef-Periodictable']]) {
  const response = await fetch(`https://pypi.org/pypi/${name}/${version}/json`);
  if (!response.ok) throw new Error(`Cannot retrieve ${name} ${version}`);
  const metadata = await response.json();
  const wheel = metadata.urls.find(file => file.filename.endsWith('-py3-none-any.whl'));
  if (!wheel) throw new Error(`No browser-compatible wheel for ${name}`);
  await save({ target: `public/runtime-assets/wheels/${wheel.filename}`, source: wheel.url, sha256: wheel.digests.sha256, license, runtime: `Scientific package ${name} ${version}` });
}
const helper = 'public/runtime-assets/python/arhimed_science.py';
manifest.artifacts = manifest.artifacts.filter(artifact => artifact.target !== helper);
manifest.artifacts.push({ target: helper, source: `https://raw.githubusercontent.com/arhimed-runtime/arhimed-runtime.github.io/main/${helper}`, sha256: createHash('sha256').update(await readFile(helper)).digest('hex'), license: 'MIT', runtime: 'Arhimed scientific drawing adapters v1' });
await writeFile('runtime-assets.manifest.json', JSON.stringify(manifest, null, 2) + '\n');
