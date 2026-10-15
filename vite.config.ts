import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const lockedDirector = readFileSync(fileURLToPath(new URL("./src/locked-director.js", import.meta.url)), "utf8");
const manimgx011 = readFileSync(fileURLToPath(new URL("./node_modules/manimgx/dist/manimgx.js", import.meta.url)), "utf8");
const lockedManimgxModule = (() => {
  const start = "v.worker=()=>URL.createObjectURL(new Blob([";
  const end = 'd.manimgx="manimgx==0.1.1";';
  const before = manimgx011.indexOf(start);
  const after = manimgx011.indexOf(end, before);
  if (before < 0 || after < 0) throw new Error("ManimGX 0.1.1 loader signature changed; refusing to build the locked runtime.");
  return `${manimgx011.slice(0, before)}v.worker=()=>URL.createObjectURL(new Blob([${JSON.stringify(lockedDirector)}],{type:"text/javascript"}));${end}${manimgx011.slice(after + end.length)}`;
})();

function lockedManimgxDirector() {
  return {
    name: "locked-manimgx-0.1.1-director",
    resolveId(id: string) {
      return id === "manimgx-locked" ? "\0manimgx-locked" : null;
    },
    load(id: string) {
      return id === "\0manimgx-locked" ? lockedManimgxModule : null;
    },
  };
}

export default defineConfig({
  plugins: [lockedManimgxDirector()],
  base: "./",
  server: { headers: { "Access-Control-Allow-Origin": "*" } },
  preview: { headers: { "Access-Control-Allow-Origin": "*" } },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: "index.html",
        sandbox: "sandbox.html",
        crossOriginParent: "cross-origin-parent.html",
        crossOriginRuntime: "cross-origin-runtime.html",
      },
    },
  },
});
