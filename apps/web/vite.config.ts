import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

// The commit the site was built from, shown in the footer so anyone can match the page to the code.
const commit = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

export default defineConfig({
  plugins: [react()],
  define: { global: "globalThis", "process.env": "{}", __COMMIT__: JSON.stringify(commit) },
  server: { port: 5175 },
  build: { chunkSizeWarningLimit: 1500 },
});
