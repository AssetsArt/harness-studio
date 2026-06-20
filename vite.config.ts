import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { artaWatch } from "./vite/arta-watch";

// Harness Studio dev server.
// The `artaWatch` plugin is the core of the whole concept: it watches the
// shared canvas file (.arta/state.json) that the AI writes into, and pushes
// every change to the running viewer over Vite's WebSocket — no MCP, no manual
// reload. The AI just uses its normal Write tool; the screen updates instantly.
export default defineConfig({
  plugins: [react(), tailwindcss(), artaWatch()],
  server: {
    port: 7317,
    strictPort: false,
  },
});
