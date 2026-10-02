import { defineConfig } from "vite";

// Bundle único e autocontido: <script src=".../v1/embed.js" defer></script>
// O caminho v1/ é parte do contrato público (Blueprint Fase 4.2) — mudanças
// incompatíveis viram v2/, sem quebrar sites que já embutiram v1.
export default defineConfig({
  build: {
    target: "es2020",
    lib: {
      entry: "src/main.ts",
      formats: ["iife"],
      name: "GeoLynqWidget",
    },
    rollupOptions: {
      output: { entryFileNames: "v1/embed.js" },
    },
    minify: true,
    sourcemap: false,
  },
  // O bundle roda em sites de terceiros, alguns ainda em ISO-8859-1 e/ou com servidor
  // sem `charset=utf-8` no header: escapar tudo que não é ASCII evita "estÃ¡" na tela.
  esbuild: { charset: "ascii" },
  test: { environment: "jsdom" },
});
