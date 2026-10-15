import "manimgx-locked";
import { settings } from "manimgx-locked";
import { CROSS_ORIGIN_MAX_SOURCE_BYTES, CROSS_ORIGIN_PROTOCOL, type RuntimeCommand, type RuntimeEvent } from "./cross-origin-protocol";
import "./sandbox.css";

const status = document.querySelector<HTMLOutputElement>("#status")!;
const root = document.querySelector<HTMLElement>("#player-root")!;
const allowedParents = new Set(["http://127.0.0.1:4184", "https://resarytrew.github.io"]);
const simulatedNoWebGpu = new URLSearchParams(location.search).get("simulateNoWebGpu") === "1";
let port: MessagePort | undefined;
let sessionId = "";
let revision = 0;
let active: HTMLElement | undefined;

// The patched v0.1.1 director receives this as its immutable asset base. It derives all
// package URLs from here, and never sends a package name to a resolver.
settings.pyodide = new URL("./runtime-assets/pyodide/", window.location.href).href;
settings.manimgx = "manimgx==0.1.1";
if (simulatedNoWebGpu) Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });

function reply(command: Pick<RuntimeCommand, "requestId" | "revision">, kind: RuntimeEvent["kind"], detail: string, data?: RuntimeEvent["data"]) {
  port?.postMessage({ protocol: CROSS_ORIGIN_PROTOCOL, sessionId, revision: command.revision, requestId: command.requestId, kind, detail, data } satisfies RuntimeEvent);
}

function allowedSource(source: string) {
  return /^import manimgx as m\s*$/m.test(source)
    && !/^\s*(from|import)\s+(?!manimgx\b)/m.test(source)
    && !/\b(__import__|importlib|micropip|fetch|XMLHttpRequest)\b/.test(source);
}

async function probe() {
  const report: Record<string, boolean | number | string | null> = { webgpuPresent: typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined" };
  try { report.parentDomBlocked = parent.document.documentElement.dataset.crossOriginControl !== "PARENT_DOM_ONLY_9bc1"; } catch { report.parentDomBlocked = true; }
  try { report.parentStorageBlocked = parent.localStorage.getItem("arhimed-cross-origin-control") !== "PARENT_LOCAL_STORAGE_ONLY_9bc1"; } catch { report.parentStorageBlocked = true; }
  try { report.parentOpenRouterKeyBlocked = parent.localStorage.getItem("arhimed-openrouter-key") !== "SYNTHETIC_OPENROUTER_KEY_NEVER_SENT_9bc1"; } catch { report.parentOpenRouterKeyBlocked = true; }
  try { report.parentIndexedDbBlocked = parent.indexedDB !== undefined; } catch { report.parentIndexedDbBlocked = true; }
  try {
    const worker = new Worker(URL.createObjectURL(new Blob(["postMessage('module worker ok')"], { type: "text/javascript" })), { type: "module" });
    report.moduleWorkerStarted = await new Promise<boolean>((resolve) => { worker.onmessage = () => { worker.terminate(); resolve(true); }; worker.onerror = () => resolve(false); });
  } catch { report.moduleWorkerStarted = false; }
  try {
    const worker = new Worker(URL.createObjectURL(new Blob(["fetch('https://example.invalid/').then(() => postMessage(false)).catch(() => postMessage(true))"], { type: "text/javascript" })), { type: "module" });
    report.workerEgressBlocked = await new Promise<boolean>((resolve) => {
      worker.onmessage = ({ data }) => { worker.terminate(); resolve(data === true); };
      worker.onerror = () => { worker.terminate(); resolve(true); };
    });
  } catch { report.workerEgressBlocked = true; }
  try { await fetch("http://127.0.0.1:9/"); report.localhostBlocked = false; } catch { report.localhostBlocked = true; }
  try { await fetch("https://example.invalid/"); report.egressBlocked = false; } catch { report.egressBlocked = true; }
  return report;
}

function watch(command: RuntimeCommand) {
  const started = performance.now();
  const timer = window.setInterval(() => {
    const message = active?.shadowRoot?.querySelector("p")?.textContent ?? "";
    if (/could not start|can't draw/i.test(message)) {
      window.clearInterval(timer);
      reply(command, "failed", `ManimGX failed after ${Math.round(performance.now() - started)} ms: ${message}`);
      return;
    }
    const canvas = active?.shadowRoot?.querySelector("canvas") as HTMLCanvasElement | null;
    const player = active as (HTMLElement & { duration?: number }) | undefined;
    if (canvas && !message && canvas.width > 0 && canvas.height > 0 && Number.isFinite(player?.duration)) {
      window.clearInterval(timer);
      reply(command, "rendered", `WebGPU player reported a rendered scene in ${Math.round(performance.now() - started)} ms.`, { canvasWidth: canvas.width, canvasHeight: canvas.height, duration: player?.duration ?? null });
    }
  }, 50);
}

function handle(command: RuntimeCommand) {
  if (command.protocol !== CROSS_ORIGIN_PROTOCOL || command.sessionId !== sessionId || command.revision <= revision) return;
  revision = command.revision;
  if (command.kind === "probe") { void probe().then((data) => reply(command, "probe", "Cross-origin isolation probes completed.", data)); return; }
  if (command.kind === "cancel") {
    active?.remove();
    active = undefined;
    status.textContent = "Player context removed by authenticated parent command.";
    reply(command, "stopped", status.textContent);
    return;
  }
  if (typeof command.source !== "string" || new TextEncoder().encode(command.source).byteLength > CROSS_ORIGIN_MAX_SOURCE_BYTES || !allowedSource(command.source)) {
    reply(command, "rejected", "Source rejected by the fixed-runtime policy.");
    return;
  }
  active?.remove();
  active = document.createElement("manimgx-player");
  active.setAttribute("autoplay", "");
  (active as HTMLElement & { source: string }).source = command.source;
  root.append(active);
  status.textContent = `ManimGX ${command.label ?? "scene"} boot requested.`;
  reply(command, "status", status.textContent);
  watch(command);
}

window.addEventListener("message", (message) => {
  const connect = message.data as { protocol?: string; kind?: string; sessionId?: string };
  if (connect.protocol !== CROSS_ORIGIN_PROTOCOL || connect.kind !== "connect" || typeof connect.sessionId !== "string" || !allowedParents.has(message.origin) || message.source !== parent || message.ports.length !== 1 || port) return;
  sessionId = connect.sessionId;
  port = message.ports[0];
  port.onmessage = ({ data }) => handle(data as RuntimeCommand);
  port.start();
  port.postMessage({ protocol: CROSS_ORIGIN_PROTOCOL, sessionId, revision: 0, requestId: "connect", kind: "ready", detail: "Authenticated MessageChannel connected." } satisfies RuntimeEvent);
});
