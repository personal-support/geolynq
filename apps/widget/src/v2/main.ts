import { GeoLynqWidgetV2 } from "./widget2";

// Guard: se o webmaster incluir o <script> duas vezes (ou o v1 já tiver registrado o elemento), define() lançaria erro.
if (!customElements.get("geolynq-widget")) {
  customElements.define("geolynq-widget", GeoLynqWidgetV2);
}
