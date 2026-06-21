import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { artaWatch } from "./vite/arta-watch";

// The running plugin version, read at dev-server start from the manifest CI bumps. The
// viewer runs vite from the installed plugin, so this is always the installed version —
// surfaced in the UI (Topbar) via the __ARTA_VERSION__ define below.
const ARTA_VERSION = (() => {
  try {
    const p = fileURLToPath(new URL("./.claude-plugin/plugin.json", import.meta.url));
    return JSON.parse(readFileSync(p, "utf8")).version || "dev";
  } catch {
    return "dev";
  }
})();

// Arta dev server.
// The `artaWatch` plugin is the core of the whole concept: it watches the
// shared canvas file (.arta/state.json) that the AI writes into, and pushes
// every change to the running viewer over Vite's WebSocket — no MCP, no manual
// reload. The AI just uses its normal Write tool; the screen updates instantly.
export default defineConfig({
  define: { __ARTA_VERSION__: JSON.stringify(ARTA_VERSION) },
  plugins: [react(), tailwindcss(), artaWatch()],
  server: {
    port: 7317,
    strictPort: false,
  },
});
