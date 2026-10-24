/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
import { GeoLynqWidget } from "./widget";

// Guard: se o webmaster incluir o <script> duas vezes, o segundo define() lançaria erro.
if (!customElements.get("geolynq-widget")) {
  customElements.define("geolynq-widget", GeoLynqWidget);
}
