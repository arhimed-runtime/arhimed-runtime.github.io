import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { headers: { "Access-Control-Allow-Origin": "*" } },
  preview: { headers: { "Access-Control-Allow-Origin": "*" } },
  build: {
    target: "es2022",
    rollupOptions: { input: { main: "index.html", sandbox: "sandbox.html" } },
  },
});
