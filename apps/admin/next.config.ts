import path from "node:path";
import type { NextConfig } from "next";

// Política de conteúdo. 'unsafe-inline' em script/style é exigência do Next sem nonces; o ganho está em restringir ORIGENS:
// só o próprio painel, o bundle do widget (pré-visualização), os blocos do mapa (OpenStreetMap) e o que o widget consulta.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const widget = new URL(process.env.NEXT_PUBLIC_WIDGET_SCRIPT_URL ?? "https://widget.geolynq.personalsupport.tech/v1/embed.js").origin;
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "production" ? "" : "'unsafe-eval'"} ${widget}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  `connect-src 'self' ${supabase} ${widget} https://viacep.com.br https://nominatim.openstreetmap.org`,
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Imagem Docker enxuta (apps/admin/Dockerfile). O build roda a partir de apps/admin; a raiz do monorepo é 2 níveis acima.
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // @geolynq/shared exporta TypeScript puro (sem build próprio).
  transpilePackages: ["@geolynq/shared"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=15552000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
