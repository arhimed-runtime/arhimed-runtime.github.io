import { CROSS_ORIGIN_PROTOCOL, REACTIVE_SCENE, SIMPLE_SCENE, type RuntimeCommand, type RuntimeEvent } from "./cross-origin-protocol";
import "./style.css";

const frame = document.querySelector<HTMLIFrameElement>("#runtime-frame")!;
const summary = document.querySelector<HTMLElement>("#summary")!;
const checks = document.querySelector<HTMLOutputElement>("#checks-output")!;
const events = document.querySelector<HTMLElement>("#events-output")!;
const suppliedRuntime = new URLSearchParams(location.search).get("runtime");

// These synthetic values make an accidental same-origin regression observable. They are
// never serialised into a MessageChannel command or included in the iframe URL.
document.documentElement.dataset.crossOriginControl = "PARENT_DOM_ONLY_9bc1";
localStorage.setItem("arhimed-cross-origin-control", "PARENT_LOCAL_STORAGE_ONLY_9bc1");
localStorage.setItem("arhimed-openrouter-key", "SYNTHETIC_OPENROUTER_KEY_NEVER_SENT_9bc1");
const database = indexedDB.open("arhimed-cross-origin-control", 1);
database.onupgradeneeded = () => database.result.createObjectStore("controls");
database.onsuccess = () => database.result.transaction("controls", "readwrite").objectStore("controls").put("PARENT_INDEXED_DB_ONLY_9bc1", "control");

if (!suppliedRuntime) {
  summary.textContent = "Provide ?runtime=https://separate-runtime-origin/.../cross-origin-runtime.html to run this parent.";
} else {
  const runtimeUrl = new URL(suppliedRuntime);
  const runtimeOrigin = runtimeUrl.origin;
  const sessionId = crypto.randomUUID();
  let port: MessagePort | undefined;
  let revision = 0;
  let phase: "probe" | "simple" | "reactive" | "stopping" | "restart" | "done" = "probe";

  function log(event: RuntimeEvent) {
    events.textContent += `${new Date().toISOString()} ${event.kind} r${event.revision}: ${event.detail}\n`;
  }

  function send(kind: RuntimeCommand["kind"], source?: string, label?: RuntimeCommand["label"]) {
    if (!port) throw new Error("Runtime port is not connected");
    const requestId = crypto.randomUUID();
    const command: RuntimeCommand = { protocol: CROSS_ORIGIN_PROTOCOL, sessionId, revision: ++revision, requestId, kind, source, label };
    port.postMessage(command);
    return command;
  }

  function beginNext(event: RuntimeEvent) {
    if (event.kind === "probe") {
      checks.textContent = JSON.stringify(event.data, null, 2);
      phase = "simple";
      summary.textContent = "Runtime isolation probes passed; rendering the simple ManimGX scene.";
      send("run", SIMPLE_SCENE, "simple");
    } else if (event.kind === "rendered" && phase === "simple") {
      phase = "reactive";
      summary.textContent = "A WebGPU frame arrived; testing ValueTracker and always_redraw.";
      send("run", REACTIVE_SCENE, "reactive");
    } else if (event.kind === "rendered" && phase === "reactive") {
      phase = "stopping";
      summary.textContent = "Reactive scene rendered; stopping its player context.";
      send("cancel");
    } else if (event.kind === "stopped" && phase === "stopping") {
      phase = "restart";
      summary.textContent = "Context stopped; running a fresh simple scene.";
      send("run", SIMPLE_SCENE, "restart");
    } else if (event.kind === "rendered" && phase === "restart") {
      phase = "done";
      summary.textContent = "Cross-origin run, reactive scene, stop, and restart completed.";
    }
  }

  frame.addEventListener("load", () => {
    const channel = new MessageChannel();
    port = channel.port1;
    port.onmessage = ({ data }) => {
      const event = data as Partial<RuntimeEvent>;
      if (event.protocol !== CROSS_ORIGIN_PROTOCOL || event.sessionId !== sessionId || typeof event.revision !== "number" || event.revision > revision || typeof event.requestId !== "string" || typeof event.kind !== "string" || typeof event.detail !== "string") return;
      log(event as RuntimeEvent);
      if (event.kind === "failed" || event.kind === "rejected") { summary.textContent = event.detail; return; }
      if (event.kind === "ready") {
        summary.textContent = "Authenticated MessageChannel connected; starting isolation probes.";
        send("probe");
        return;
      }
      beginNext(event as RuntimeEvent);
    };
    frame.contentWindow?.postMessage({ protocol: CROSS_ORIGIN_PROTOCOL, kind: "connect", sessionId }, runtimeOrigin, [channel.port2]);
  }, { once: true });
  frame.src = runtimeUrl.href;
}
