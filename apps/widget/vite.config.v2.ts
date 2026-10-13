/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import { defineConfig } from "vite";

// Aviso de autoria no topo do arquivo publicado. Entra depois da minificação (o minificador apaga comentários)
// e só em ASCII: o bundle roda em sites com codificação antiga. Não altera o código do widget.
const AVISO_AUTORIA =
  '/*! GeoLynq - Copyright (c) 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados. Desenvolvido por Jucimar Lopes, da Personal Support. E proibida a copia, replica, redistribuicao ou comercializacao, total ou parcial, sem autorizacao previa e por escrito do desenvolvedor. Unauthorized copying, replication, redistribution or commercial use is prohibited. */';

// Widget v2 (Etapa 1: grade de produtos, "Onde encontrar" com 3 opções, lista de revendedores, tema por cliente).
// Contrato público: <script src=".../v2/embed.js" defer></script>. O /v1/ segue igual para quem já embutiu.
// emptyOutDir=false: este build roda DEPOIS do v1 e não pode apagar o dist/v1/.
export default defineConfig({
  plugins: [
    {
      name: "aviso-autoria",
      generateBundle(_opcoes, pacote) {
        for (const arq of Object.values(pacote)) {
          if (arq.type === "chunk") arq.code = AVISO_AUTORIA + "\n" + arq.code;
        }
      },
    },
  ],
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
