import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": `${import.meta.dirname}/src` } },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "cytoscape-core",
              test: /node_modules[\\/]cytoscape[\\/]/,
              priority: 20,
            },
            {
              name: "graph-layout",
              test: /node_modules[\\/](cytoscape-fcose|cose-base|layout-base)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts" },
});
