import { MAX_SOURCE_BYTES, PROTOCOL_VERSION, SIMPLE_SCENE, type ParentCommand, type SandboxEvent } from "./protocol";
import "./style.css";

const frame = document.querySelector<HTMLIFrameElement>("#runtime-frame")!;
const summary = document.querySelector<HTMLElement>("#summary")!;
const checks = document.querySelector<HTMLOutputElement>("#checks-output")!;
const events = document.querySelector<HTMLElement>("#events-output")!;
const capability = crypto.randomUUID();
const session = { highestRevision: 0, received: 0, sceneRequested: false };

// Deliberately synthetic values. A sandbox that can read any one has escaped its boundary.
document.documentElement.dataset.labControl = "PARENT_DOM_ONLY_6fa4";
localStorage.setItem("arhimed-runtime-lab-control", "PARENT_LOCAL_STORAGE_ONLY_6fa4");
const database = indexedDB.open("arhimed-runtime-lab-control", 1);
database.onupgradeneeded = () => database.result.createObjectStore("controls");
database.onsuccess = () => {
  const transaction = database.result.transaction("controls", "readwrite");
  transaction.objectStore("controls").put("PARENT_INDEXED_DB_ONLY_6fa4", "control");
};

function send(kind: ParentCommand["kind"], source?: string) {
  const requestId = crypto.randomUUID();
  const revision = ++session.highestRevision;
  const command: ParentCommand = { protocol: PROTOCOL_VERSION, kind, requestId, revision, capability, source };
  frame.contentWindow?.postMessage(command, "*");
  return command;
}

function writeEvent(event: SandboxEvent) {
  events.textContent += `${new Date().toISOString()} ${event.kind} r${event.revision}: ${event.detail}\n`;
}

window.addEventListener("message", (message) => {
  // An opaque sandbox has origin "null". The window identity and unguessable capability
  // are therefore mandatory; origin alone would be an unsafe authority check.
  if (message.source !== frame.contentWindow) {
    events.textContent += "Dropped message from a window other than the sandbox iframe.\n";
    return;
  }
  const event = message.data as Partial<SandboxEvent>;
  const bootstrap = event.kind === "ready" && event.requestId === "bootstrap" && event.revision === 0 && event.capability === "";
  if (event.protocol !== PROTOCOL_VERSION || (!bootstrap && event.capability !== capability) || typeof event.revision !== "number" || typeof event.requestId !== "string" || typeof event.kind !== "string" || typeof event.detail !== "string") return;
  if (event.revision > session.highestRevision) return;
  session.received += 1;
  writeEvent(event as SandboxEvent);
  if (bootstrap) {
    summary.textContent = "Sandbox bootstrap received; starting capability-bound probes.";
    send("probe");
    return;
  }
  if (event.kind === "probe") {
    checks.textContent = JSON.stringify(event.data, null, 2);
    if (!session.sceneRequested) {
      session.sceneRequested = true;
      summary.textContent = "Opaque-origin sandbox answered its probes; starting a real fixed ManimGX scene.";
      send("run", SIMPLE_SCENE);
    }
  }
  if (event.kind === "result" || event.kind === "rejected") {
    summary.textContent = event.detail;
  }
});

frame.addEventListener("load", () => {
  summary.textContent = `Sandbox loaded. Source limit: ${MAX_SOURCE_BYTES.toLocaleString()} bytes.`;
});
frame.src = "./sandbox.html";
