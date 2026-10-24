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

// Bundle único e autocontido: <script src=".../v1/embed.js" defer></script>
// O caminho v1/ é parte do contrato público (Blueprint Fase 4.2) — mudanças
// incompatíveis viram v2/, sem quebrar sites que já embutiram v1.
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
