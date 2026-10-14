export {};

const bootstrapStatus = document.querySelector<HTMLOutputElement>("#status")!;
import("./sandbox.js").catch((error: unknown) => {
  bootstrapStatus.textContent = `Sandbox bootstrap failed: ${error instanceof Error ? error.message : String(error)}`;
  parent.postMessage({ protocol: 1, kind: "rejected", requestId: "bootstrap", revision: 0, capability: "", detail: bootstrapStatus.textContent }, "*");
});
