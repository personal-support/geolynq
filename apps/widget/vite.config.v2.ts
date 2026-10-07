import { defineConfig } from "vite";

// Widget v2 (Etapa 1: grade de produtos, "Onde encontrar" com 3 opções, lista de revendedores, tema por cliente).
// Contrato público: <script src=".../v2/embed.js" defer></script>. O /v1/ segue igual para quem já embutiu.
// emptyOutDir=false: este build roda DEPOIS do v1 e não pode apagar o dist/v1/.
export default defineConfig({
  build: {
    target: "es2020",
    emptyOutDir: false,
    lib: {
      entry: "src/v2/main.ts",
      formats: ["iife"],
      name: "GeoLynqWidgetV2",
    },
    rollupOptions: {
      output: { entryFileNames: "v2/embed.js" },
    },
    minify: true,
    sourcemap: false,
  },
  esbuild: { charset: "ascii" },
  test: { environment: "jsdom" },
});
