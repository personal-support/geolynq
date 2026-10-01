import { GeoLynqWidget } from "./widget";

// Guard: se o webmaster incluir o <script> duas vezes, o segundo define() lançaria erro.
if (!customElements.get("geolynq-widget")) {
  customElements.define("geolynq-widget", GeoLynqWidget);
}
