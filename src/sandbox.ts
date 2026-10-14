import "manimgx";
import { settings } from "manimgx";
import { MAX_SOURCE_BYTES, PROTOCOL_VERSION, type ParentCommand, type SandboxEvent } from "./protocol";
import "./sandbox.css";

const status = document.querySelector<HTMLOutputElement>("#status")!;
const root = document.querySelector<HTMLElement>("#player-root")!;
let capability = "";
let lastRevision = 0;
let active: HTMLElement | undefined;

// Fixed upstream artifacts. The SHA-256 values and source commit are kept in docs/dependencies.md.
settings.pyodide = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
settings.manimgx = "https://files.pythonhosted.org/packages/4f/82/d9ccd9a547fdc7b74ce47d7f8a70898d7c2541fb8de3cc62c0fd85a977ba01/manimgx-0.1.1-cp313-abi3-pyemscripten_2026_0_wasm32.whl";

function reply(command: ParentCommand, kind: SandboxEvent["kind"], detail: string, data?: SandboxEvent["data"]) {
  const event: SandboxEvent = { protocol: PROTOCOL_VERSION, kind, requestId: command.requestId, revision: command.revision, capability: command.capability, detail, data };
  parent.postMessage(event, "*");
}

function allowedSource(source: string) {
  // Upstream ManimGX 0.1.1 tries to resolve missing imports through micropip. Until its
  // loader is replaced, an educational scene may import only the pinned runtime package.
  return /^import manimgx as m\s*$/m.test(source) && !/^\s*(from|import)\s+(?!manimgx\b)/m.test(source);
}

async function probe() {
  const report: Record<string, boolean | string | number | null> = {};
  try { report.parentDomBlocked = parent.document.documentElement.dataset.labControl !== "PARENT_DOM_ONLY_6fa4"; } catch { report.parentDomBlocked = true; }
  try { report.parentStorageBlocked = parent.localStorage.getItem("arhimed-runtime-lab-control") !== "PARENT_LOCAL_STORAGE_ONLY_6fa4"; } catch { report.parentStorageBlocked = true; }
  try { report.parentIndexedDbBlocked = parent.indexedDB !== undefined; } catch { report.parentIndexedDbBlocked = true; }
  // `location.origin` intentionally retains the URL's serialization. The meaningful test
  // for an opaque sandbox origin is that the parent cannot be reached as a same-origin DOM.
  report.effectiveParentIsolation = Boolean(report.parentDomBlocked && report.parentStorageBlocked);
  report.webgpuPresent = "gpu" in navigator;
  try { await fetch("http://127.0.0.1:9/"); report.localhostBlocked = false; } catch { report.localhostBlocked = true; }
  try { await fetch("https://example.invalid/"); report.egressBlocked = false; } catch { report.egressBlocked = true; }
  try {
    const worker = new Worker(URL.createObjectURL(new Blob(["postMessage(typeof fetch)"], { type: "text/javascript" })));
    report.workerStarted = await new Promise<boolean>((resolve) => { worker.onmessage = () => { worker.terminate(); resolve(true); }; worker.onerror = () => resolve(false); });
  } catch { report.workerStarted = false; }
  try {
    const egressWorker = new Worker(URL.createObjectURL(new Blob(["fetch('http://127.0.0.1:9/').then(() => postMessage(false)).catch(() => postMessage(true))"], { type: "text/javascript" })));
    report.workerEgressBlocked = await new Promise<boolean>((resolve) => { egressWorker.onmessage = ({ data }) => { egressWorker.terminate(); resolve(data === true); }; egressWorker.onerror = () => resolve(true); });
  } catch { report.workerEgressBlocked = true; }
  try {
    const moduleWorker = new Worker(URL.createObjectURL(new Blob(["postMessage('module worker ok')"], { type: "text/javascript" })), { type: "module" });
    report.moduleWorkerStarted = await new Promise<boolean>((resolve) => { moduleWorker.onmessage = () => { moduleWorker.terminate(); resolve(true); }; moduleWorker.onerror = () => resolve(false); });
  } catch { report.moduleWorkerStarted = false; }
  return report;
}

window.addEventListener("message", async (message) => {
  if (message.source !== parent) return;
  const command = message.data as Partial<ParentCommand>;
  if (command.protocol !== PROTOCOL_VERSION || typeof command.capability !== "string" || typeof command.requestId !== "string" || typeof command.revision !== "number" || (command.kind !== "run" && command.kind !== "cancel" && command.kind !== "probe")) return;
  if (!capability) capability = command.capability;
  if (command.capability !== capability || command.revision <= lastRevision) return;
  lastRevision = command.revision;
  const valid = command as ParentCommand;
  if (valid.kind === "probe") { reply(valid, "probe", "Opaque iframe probes completed.", await probe()); return; }
  if (valid.kind === "cancel") { active?.remove(); active = undefined; status.textContent = "Cancelled by parent: player context was removed."; reply(valid, "result", status.textContent); return; }
  const source = valid.source;
  if (typeof source !== "string" || new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES || !allowedSource(source)) { reply(valid, "rejected", "Source rejected: only the pinned manimgx import is allowed in this experiment."); return; }
  active?.remove();
  active = document.createElement("manimgx-player");
  active.setAttribute("autoplay", "");
  (active as HTMLElement & { source: string }).source = source;
  root.append(active);
  status.textContent = "Real ManimGX 0.1.1 boot requested.";
  reply(valid, "status", status.textContent);
  const started = performance.now();
  const watch = window.setInterval(() => {
    const playerStatus = active?.shadowRoot?.querySelector("p")?.textContent ?? "";
    if (/could not start|can't draw/i.test(playerStatus)) {
      window.clearInterval(watch);
      reply(valid, "result", `ManimGX runtime failed after ${Math.round(performance.now() - started)} ms: ${playerStatus}`);
    }
  }, 100);
});

window.addEventListener("securitypolicyviolation", (event) => {
  status.textContent = `CSP blocked ${event.violatedDirective}: ${event.blockedURI}`;
});

parent.postMessage({ protocol: PROTOCOL_VERSION, kind: "ready", requestId: "bootstrap", revision: 0, capability: "", detail: "Sandbox bootstrap needs its parent capability." } satisfies SandboxEvent, "*");
