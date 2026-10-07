import type { WidgetEventAction } from "@geolynq/shared";
import { browserLocation, geocodeCep, reverseGeocode, type EventPayload, type GeoPoint, type ResellerResult } from "../api";
import {
  MAX_RADIUS_KM,
  countNearby,
  formatDistance,
  locationFields,
  mapsLink,
  parseCep,
  safeUrl,
  summarizeResults,
  telLink,
  whatsappLink,
} from "../util";
import { GeoLynqApiV2, type Places, type ProductCard, type TenantV2 } from "./api2";
import { filterProducts, initials, termForTelemetry } from "./catalog";
import { h } from "./dom";
import { STYLES_V2 } from "./styles2";
import { resolveTheme, themeVars, type WidgetTheme } from "./theme";

type View = "home" | "product" | "results" | "list";
type Status = "loading" | "ready" | "unavailable";

const PAGE = 24; // cartões por "página" da grade
const CATALOG_LIMIT = 500; // até aqui o catálogo inteiro é carregado de uma vez e filtrado no navegador
const SERVER_PAGE = 100; // catálogos maiores: busca e paginação no servidor
const LIST_PAGE = 10; // revendedores por página (decisão: lista pública, 10 por vez)

const TYPE_LABEL: Record<string, string> = {
  loja_fisica: "Loja física",
  farmacia: "Farmácia",
  online: "Venda online",
  distribuidor: "Distribuidor",
  outro: "Revendedor",
};
const TYPE_FILTERS: Array<[string, string]> = [
  ["", "Todos os tipos"],
  ["loja_fisica", "Loja física"],
  ["farmacia", "Farmácia"],
  ["distribuidor", "Distribuidor"],
  ["online", "Venda online"],
];

export class GeoLynqWidgetV2 extends HTMLElement {
  static observedAttributes = ["tenant", "color", "product", "scroll-offset"];

  private readonly root = this.attachShadow({ mode: "open" });
  private readonly api = new GeoLynqApiV2(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

  private status: Status = "loading";
  private tenant: TenantV2 | null = null;
  private theme: WidgetTheme = resolveTheme({}, null, null);
  private view: View = "home";
  private started = false;
  /** Invalida respostas atrasadas quando o visitante já seguiu em frente (ou o tenant mudou). */
  private token = 0;
  private focusTarget: string | null = null;
  private error: string | null = null;
  private busy = false;

  // catálogo / grade
  private catalog: ProductCard[] = [];
  private catalogTotal = 0;
  private complete = true;
  private remote: ProductCard[] = [];
  private remoteTotal = 0;
  private searching = false;
  private term = "";
  private visible = PAGE;
  private searchSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private logTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly loggedTerms = new Set<string>();
  private gridHost: HTMLElement | null = null;

  // fluxo do produto
  private product: ProductCard | null = null;
  private point: GeoPoint | null = null;
  private resellers: ResellerResult[] | null = null;

  // lista de revendedores
  private places: Places | null = null;
  private filters = { sku: "", uf: "", city: "", type: "" };
  private listPoint: GeoPoint | null = null;
  private list: ResellerResult[] = [];
  private listTotal = 0;
  private listSearched = false;
  private listBusy = false;
  private listSeq = 0;
  private listHost: HTMLElement | null = null;
  private citySelect: HTMLSelectElement | null = null;

  connectedCallback(): void {
    this.started = true;
    void this.load();
  }

  disconnectedCallback(): void {
    clearTimeout(this.searchTimer);
    clearTimeout(this.logTimer);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.started || oldValue === newValue) return;
    if (name === "tenant" || name === "product") void this.load();
    else if (name === "color") {
      this.applyTheme();
      this.render();
    }
  }

  // ---- carga ---------------------------------------------------------------

  private async load(): Promise<void> {
    const slug = this.getAttribute("tenant")?.trim();
    const run = ++this.token;
    this.resetAll();
    if (!slug) {
      console.error("[geolynq] atributo 'tenant' ausente em <geolynq-widget>");
      this.status = "unavailable";
      return this.render();
    }
    this.status = "loading";
    this.render();
    try {
      const tenant = await this.api.getTenantV2(slug);
      if (run !== this.token) return;
      this.tenant = tenant;
      if (!tenant) {
        console.error(`[geolynq] tenant '${slug}' não encontrado ou inativo`);
        this.status = "unavailable";
      } else {
        this.applyTheme();
        const first = await this.api.findProducts(tenant.id, "", CATALOG_LIMIT, 0);
        if (run !== this.token) return;
        this.catalog = first.items;
        this.catalogTotal = first.total;
        this.complete = first.total <= first.items.length;
        this.remote = first.items;
        this.remoteTotal = first.total;
        this.status = "ready";
        await this.preselect(run);
      }
    } catch (err) {
      if (run !== this.token) return;
      console.error("[geolynq] falha ao carregar o widget", err);
      this.status = "unavailable";
    }
    this.render();
  }

  /** Página de produto do site: `<geolynq-widget product="SKU">` abre direto no "Onde encontrar" do produto. */
  private async preselect(run: number): Promise<void> {
    const sku = this.getAttribute("product")?.trim();
    if (!sku || !this.tenant) return;
    try {
      let p: ProductCard | null = this.catalog.find((x) => x.sku === sku) ?? null;
      if (!p) {
        const found = await this.api.getProductBySku(this.tenant.id, sku);
        if (run !== this.token) return;
        p = found ? { ...found, image_url: null } : null;
      }
      if (p) {
        this.product = p;
        this.view = "product";
      } else console.error(`[geolynq] produto '${sku}' não encontrado no catálogo do tenant`);
    } catch (err) {
      if (run !== this.token) return;
      console.error("[geolynq] falha ao carregar o produto", err);
    }
  }

  private resetAll(): void {
    clearTimeout(this.searchTimer);
    clearTimeout(this.logTimer);
    this.view = "home";
    this.error = null;
    this.busy = false;
    this.focusTarget = null;
    this.catalog = [];
    this.catalogTotal = 0;
    this.complete = true;
    this.remote = [];
    this.remoteTotal = 0;
    this.searching = false;
    this.term = "";
    this.visible = PAGE;
    this.loggedTerms.clear();
    this.product = null;
    this.point = null;
    this.resellers = null;
    this.places = null;
    this.filters = { sku: "", uf: "", city: "", type: "" };
    this.listPoint = null;
    this.list = [];
    this.listTotal = 0;
    this.listSearched = false;
    this.listBusy = false;
  }

  private applyTheme(): void {
    this.theme = resolveTheme(this.tenant?.theme, this.getAttribute("color"), this.tenant?.primary_color);
    const url = this.theme.fontUrl;
    // Fonte do Google: precisa estar no <head> do documento (o Shadow DOM não registra @font-face).
    if (url && !document.head.querySelector("link[data-geolynq-font]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.setAttribute("data-geolynq-font", "");
      document.head.append(link);
    }
  }

  // ---- grade de produtos ------------------------------------------------------

  private items(): ProductCard[] {
    return this.complete ? filterProducts(this.catalog, this.term) : this.remote;
  }

  private onSearchInput(value: string): void {
    this.term = value;
    this.visible = PAGE;
    if (this.complete) this.updateGrid();
    else {
      this.searching = true;
      this.updateGrid();
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => void this.remoteSearch(), 300);
    }
    // Telemetria só depois de uma pausa na digitação (nada de gravar tecla por tecla).
    clearTimeout(this.logTimer);
    this.logTimer = setTimeout(() => this.logNoMatch(), 1200);
  }

  private async remoteSearch(): Promise<void> {
    if (!this.tenant) return;
    const seq = ++this.searchSeq;
    try {
      const page = await this.api.findProducts(this.tenant.id, this.term, SERVER_PAGE, 0);
      if (seq !== this.searchSeq) return;
      this.remote = page.items;
      this.remoteTotal = page.total;
    } catch {
      if (seq !== this.searchSeq) return;
      this.remote = [];
      this.remoteTotal = 0;
    }
    this.searching = false;
    this.updateGrid();
  }

  private async remoteMore(): Promise<void> {
    if (!this.tenant) return;
    const seq = ++this.searchSeq;
    try {
      const page = await this.api.findProducts(this.tenant.id, this.term, SERVER_PAGE, this.remote.length);
      if (seq !== this.searchSeq) return;
      this.remote = [...this.remote, ...page.items];
    } catch {
      /* mantém o que já está na tela */
    }
    this.updateGrid();
  }

  /** Texto digitado que não casou com nenhum produto = demanda fora do catálogo (vira "Procuraram e você não tem" no painel). */
  private logNoMatch(): void {
    const term = termForTelemetry(this.term);
    if (!term || !this.tenant || this.loggedTerms.has(term)) return;
    const matches = this.complete ? filterProducts(this.catalog, this.term).length : this.remoteTotal;
    if (matches > 0 || this.searching) return;
    this.loggedTerms.add(term);
    this.log({ event_type: "search", query_text: term, product_id: null, results_count: 0, ...locationFields(null) });
  }

  private placeholder(p: ProductCard): HTMLElement {
    return h("div", { class: "ph-fb", "aria-hidden": "true" }, initials(p.name));
  }

  private photo(p: ProductCard): HTMLElement {
    const frame = h("div", { class: "ph" });
    if (p.image_url) {
      const img = h("img", { src: p.image_url, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
      img.addEventListener("error", () => img.replaceWith(this.placeholder(p)), { once: true });
      frame.append(img);
    } else frame.append(this.placeholder(p));
    return frame;
  }

  private productCard(p: ProductCard): HTMLElement {
    return h(
      "li",
      {},
      h(
        "article",
        { class: "prod" },
        this.photo(p),
        h(
          "div",
          { class: "prod-body" },
          p.category ? h("p", { class: "prod-cat" }, p.category) : null,
          h("h3", { class: "prod-name" }, p.name),
          h("div", { class: "spacer" }),
          h(
            "button",
            { type: "button", class: "btn", onclick: () => this.selectProduct(p), "aria-label": `Onde encontrar ${p.name}` },
            "Onde encontrar",
          ),
        ),
      ),
    );
  }

  private fillGrid(host: HTMLElement): void {
    const list = this.items();
    const total = this.complete ? list.length : this.remoteTotal;
    const shown = list.slice(0, this.visible);
    const termText = this.term.trim() ? ` para “${this.term.trim()}”` : "";
    const count = h(
      "p",
      { class: "count", "aria-live": "polite" },
      this.searching ? "Buscando…" : `${total} ${total === 1 ? "produto" : "produtos"}${termText}`,
    );

    if (!this.searching && list.length === 0) {
      host.replaceChildren(
        count,
        h(
          "div",
          { class: "msg", role: "status" },
          this.catalog.length === 0 && !this.term.trim()
            ? "Ainda não há produtos cadastrados."
            : "Nenhum produto encontrado. Confira o nome ou tente outro termo.",
          " ",
          this.term.trim() ? h("button", { type: "button", class: "back", onclick: () => this.clearSearch() }, "Limpar busca") : null,
        ),
      );
      return;
    }

    const hasMore = shown.length < list.length || (!this.complete && list.length < total);
    const rest: Node[] = [count, h("ul", { class: "grid" }, ...shown.map((p) => this.productCard(p)))];
    if (hasMore)
      rest.push(
        h(
            "div",
            { class: "more" },
            h(
              "button",
              {
                type: "button",
                class: "btn secondary",
                onclick: () => {
                  this.visible += PAGE;
                  if (!this.complete && this.visible > this.remote.length && this.remote.length < this.remoteTotal) void this.remoteMore();
                  else this.updateGrid();
                },
              },
              "Mostrar mais",
            ),
          ),
      );
    host.replaceChildren(...rest);
  }

  private updateGrid(): void {
    if (this.gridHost) this.fillGrid(this.gridHost);
  }

  private clearSearch(): void {
    this.term = "";
    this.visible = PAGE;
    this.searching = false;
    this.remote = this.catalog;
    this.remoteTotal = this.catalogTotal;
    this.focusTarget = "term";
    this.render();
  }

  // ---- navegação -----------------------------------------------------------------

  private go(view: View, focus: string | null = "heading"): void {
    this.token++;
    this.view = view;
    this.error = null;
    this.busy = false;
    this.focusTarget = focus;
    this.render(true);
  }

  private selectProduct(p: ProductCard): void {
    this.product = p;
    this.point = null;
    this.resellers = null;
    this.go("product");
  }

  /** Rola até o topo do widget (descontando um cabeçalho fixo do site, via atributo `scroll-offset`) quando a tela troca. */
  private reveal(): void {
    const offset = Number(this.getAttribute("scroll-offset")) || 0;
    const top = this.getBoundingClientRect().top;
    if (top >= offset) return;
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top: top - offset, behavior: reduce ? "auto" : "smooth" });
  }

  // ---- localização e revendedores do produto -------------------------------------------

  private async locateByCep(rawCep: string): Promise<void> {
    if (!parseCep(rawCep)) {
      this.error = "Informe um CEP válido com 8 dígitos.";
      this.focusTarget = "cep";
      return this.render();
    }
    const run = ++this.token;
    this.busy = true;
    this.error = null;
    this.render();
    try {
      const point = await geocodeCep(rawCep);
      if (run !== this.token) return;
      if (!point) {
        this.busy = false;
        this.error = "Não encontramos esse CEP. Confira o número ou veja a lista de revendedores.";
        this.focusTarget = "cep";
        return this.render();
      }
      await this.lookup(point);
    } catch {
      if (run !== this.token) return;
      this.busy = false;
      this.error = "Não foi possível localizar o CEP agora. Tente de novo ou veja a lista de revendedores.";
      this.render();
    }
  }

  private async locateByBrowser(): Promise<void> {
    const run = ++this.token;
    this.busy = true;
    this.error = null;
    this.render();
    try {
      const point = await browserLocation();
      if (run !== this.token) return;
      await this.lookup(point, reverseGeocode(point.lat, point.lng));
    } catch {
      if (run !== this.token) return;
      this.busy = false;
      this.error = "Não conseguimos acessar a sua localização. Digite o CEP ou veja a lista de revendedores.";
      this.focusTarget = "cep";
      this.render();
    }
  }

  private async lookup(
    point: GeoPoint,
    place?: Promise<Pick<GeoPoint, "city" | "state" | "neighborhood"> | null>,
  ): Promise<void> {
    const tenant = this.tenant;
    const product = this.product;
    if (!tenant || !product) return;
    const run = ++this.token;
    this.busy = true;
    this.error = null;
    this.render();
    try {
      const [resellers, found] = await Promise.all([this.api.nearestResellers(tenant.id, product.id, point), place ?? Promise.resolve(null)]);
      if (run !== this.token) return;
      const located: GeoPoint = found ? { ...point, ...found } : point;
      this.point = located;
      this.resellers = resellers;
      this.view = "results";
      this.focusTarget = "heading";
      // results_count conta só revendedores FÍSICOS no raio: a loja online aparece para o visitante, mas não esconde a lacuna.
      const summary = summarizeResults(resellers);
      this.log({
        event_type: "search",
        query_text: termForTelemetry(this.term) ?? product.name,
        product_id: product.id,
        results_count: summary.physical_count,
        ...locationFields(located),
        nearest_km: summary.nearest_km,
        physical_count: summary.physical_count,
        online_count: summary.online_count,
      });
      this.busy = false;
      this.render(true);
      return;
    } catch {
      if (run !== this.token) return;
      this.error = "Não foi possível buscar os revendedores agora. Tente novamente.";
      this.focusTarget = "cep";
    }
    this.busy = false;
    this.render();
  }

  private log(event: EventPayload): void {
    if (this.tenant) this.api.logEvent(this.tenant.id, event);
  }

  private trackClick(r: ResellerResult, action: WidgetEventAction, productId: string | null, point: GeoPoint | null): void {
    this.log({
      event_type: "reseller_click",
      query_text: this.product && productId === this.product.id ? this.product.name : null,
      product_id: productId,
      reseller_id: r.reseller_id,
      ...locationFields(point),
      action,
      distance_km: r.distance_km === null ? null : Math.round(r.distance_km * 100) / 100,
    });
  }

  // ---- lista de revendedores ----------------------------------------------------------

  private openList(prefill: ProductCard | null): void {
    this.filters = { sku: prefill?.sku ?? "", uf: "", city: "", type: "" };
    this.listPoint = null;
    this.list = [];
    this.listTotal = 0;
    this.listSearched = false;
    this.listBusy = false;
    this.go("list", "list-first");
    if (!this.places && this.tenant) {
      void this.api
        .listPlaces(this.tenant.id)
        .then((p) => {
          this.places = p;
          if (this.view === "list") this.render();
        })
        .catch(() => undefined);
    }
    if (prefill) void this.runList(0);
  }

  private hasListFilter(): boolean {
    return Boolean(this.filters.sku || this.filters.uf || this.filters.city || this.listPoint);
  }

  private async runList(offset: number): Promise<void> {
    const tenant = this.tenant;
    if (!tenant) return;
    if (!this.hasListFilter()) {
      this.list = [];
      this.listTotal = 0;
      this.listSearched = false;
      this.error = null;
      return this.fillList();
    }
    const seq = ++this.listSeq;
    this.listBusy = true;
    this.error = null;
    this.fillList();
    try {
      const product = this.filters.sku ? this.catalog.find((p) => p.sku === this.filters.sku) : null;
      const page = await this.api.listResellers(tenant.id, {
        productId: product?.id ?? null,
        uf: this.filters.uf,
        city: this.filters.city,
        type: this.filters.type,
        point: this.listPoint,
        limit: LIST_PAGE,
        offset,
      });
      if (seq !== this.listSeq) return;
      this.list = offset === 0 ? page.items : [...this.list, ...page.items];
      this.listTotal = page.total;
      this.listSearched = true;
    } catch {
      if (seq !== this.listSeq) return;
      this.error = "Não foi possível buscar os revendedores agora. Tente novamente.";
    }
    this.listBusy = false;
    this.fillList();
  }

  private async sortByDistance(): Promise<void> {
    this.error = null;
    this.listBusy = true;
    this.fillList();
    try {
      this.listPoint = await browserLocation();
    } catch {
      this.listBusy = false;
      this.error = "Não conseguimos acessar a sua localização. Use os filtros de estado e cidade.";
      return this.fillList();
    }
    await this.runList(0);
  }

  private cityOptions(): Array<[string, string]> {
    const all = this.places?.cidades ?? [];
    const list = this.filters.uf ? all.filter((c) => c.uf === this.filters.uf) : [];
    return [["", this.filters.uf ? "Todas as cidades" : "Escolha o estado primeiro"], ...list.map((c): [string, string] => [c.cidade, c.cidade])];
  }

  private fillCities(): void {
    if (!this.citySelect) return;
    const opts = this.cityOptions();
    this.citySelect.replaceChildren(...opts.map(([v, t]) => h("option", { value: v }, t)));
    this.citySelect.value = this.filters.city;
    this.citySelect.disabled = !this.filters.uf;
  }

  private fillList(): void {
    const host = this.listHost;
    if (!host) return;
    const nodes: Array<Node | null> = [];
    if (this.error) nodes.push(h("p", { class: "msg error", role: "alert" }, this.error));

    if (!this.hasListFilter()) {
      nodes.push(h("p", { class: "msg", role: "status" }, "Escolha um estado, uma cidade ou um produto para ver os revendedores."));
    } else if (this.listBusy && this.list.length === 0) {
      nodes.push(h("p", { class: "msg", role: "status" }, "Buscando…"));
    } else if (this.listSearched && this.list.length === 0) {
      nodes.push(h("p", { class: "msg", role: "status" }, "Nenhum revendedor encontrado com esses filtros. Tente outro estado, cidade ou produto."));
    } else if (this.list.length > 0) {
      const productId = this.filters.sku ? (this.catalog.find((p) => p.sku === this.filters.sku)?.id ?? null) : null;
      nodes.push(
        h("p", { class: "count", "aria-live": "polite" }, `${this.listTotal} ${this.listTotal === 1 ? "revendedor" : "revendedores"}${this.listPoint ? " (mais próximos primeiro)" : ""}`),
        h("div", { class: "stack" }, ...this.list.map((r) => this.renderReseller(r, productId, this.listPoint))),
      );
      if (this.list.length < this.listTotal) {
        nodes.push(
          h(
            "div",
            { class: "more" },
            h("button", { type: "button", class: "btn secondary", disabled: this.listBusy, onclick: () => void this.runList(this.list.length) }, this.listBusy ? "Buscando…" : "Mostrar mais"),
          ),
        );
      }
    }
    host.replaceChildren(...nodes.filter((n): n is Node => n !== null));
  }

  // ---- renderização ---------------------------------------------------------------

  private render(reveal = false): void {
    const wrapper = h("div", {
      class: `gl${this.theme.buttonStyle === "outline" ? " themed-outline" : ""}`,
      style: themeVars(this.theme),
      role: "region",
      "aria-label": "Onde encontrar",
    });
    this.gridHost = null;
    this.listHost = null;
    this.citySelect = null;

    if (this.status === "loading") {
      wrapper.append(
        h("p", { class: "sr", role: "status" }, "Carregando…"),
        h("div", { class: "grid", "aria-hidden": "true" }, ...Array.from({ length: 8 }, () => h("div", { class: "sk" }))),
      );
    } else if (this.status === "unavailable") {
      wrapper.append(h("p", { class: "msg" }, "O localizador de revendedores está indisponível no momento."));
    } else {
      wrapper.append(this.renderView());
    }

    this.root.replaceChildren(h("style", {}, STYLES_V2), wrapper);

    const target = this.focusTarget;
    this.focusTarget = null;
    if (target) this.root.querySelector<HTMLElement>(`[data-focus="${target}"]`)?.focus({ preventScroll: true });
    if (reveal) this.reveal();
  }

  private renderView(): Node {
    switch (this.view) {
      case "home":
        return this.renderHome();
      case "product":
        return this.renderProduct();
      case "results":
        return this.renderResults();
      case "list":
        return this.renderList();
    }
  }

  private renderHome(): Node {
    const input = h("input", {
      type: "search",
      id: "gl-term",
      "data-focus": "term",
      placeholder: "Buscar produto pelo nome",
      autocomplete: "off",
      maxlength: "80",
      "aria-label": "Buscar produto",
      oninput: (e) => this.onSearchInput((e.target as HTMLInputElement).value),
    });
    input.value = this.term;
    const bar = h(
      "form",
      { class: "bar", role: "search", onsubmit: (e) => e.preventDefault() },
      input,
      h("button", { type: "button", class: "btn outline", onclick: () => this.openList(null) }, "Lista de revendedores"),
    );
    const host = h("div", { class: "grid-host" });
    this.gridHost = host;
    this.fillGrid(host);
    return h("div", {}, bar, host);
  }

  private renderProduct(): Node {
    const product = this.product;
    if (!product) return this.renderHome();
    const cep = h("input", {
      type: "text",
      id: "gl-cep",
      "data-focus": "cep",
      inputmode: "numeric",
      autocomplete: "postal-code",
      placeholder: "00000-000",
      maxlength: "9",
    });
    return h(
      "div",
      { class: "panel" },
      h("div", { class: "top" }, h("button", { type: "button", class: "back", onclick: () => this.go("home", "term") }, "← Todos os produtos")),
      h(
        "div",
        { class: "chosen" },
        this.photo(product),
        h("div", {}, product.category ? h("p", { class: "prod-cat" }, product.category) : null, h("h2", { tabindex: "-1", "data-focus": "heading" }, product.name)),
      ),
      h(
        "div",
        { class: "opts" },
        h("button", { type: "button", class: "btn outline block", disabled: this.busy, onclick: () => void this.locateByBrowser() }, this.busy ? "Buscando…" : "Usar minha localização"),
        h("p", { class: "or" }, "ou"),
        h(
          "form",
          {
            onsubmit: (e) => {
              e.preventDefault();
              void this.locateByCep(cep.value);
            },
          },
          h("label", { for: "gl-cep" }, "Digitar meu CEP"),
          h("div", { class: "row" }, cep, h("button", { type: "submit", class: "btn", disabled: this.busy }, "Ver revendedores")),
        ),
        h("p", { class: "or" }, "ou"),
        h("button", { type: "button", class: "btn secondary block", disabled: this.busy, onclick: () => this.openList(product) }, "Ver lista de revendedores"),
      ),
      this.error ? h("p", { class: "msg error", role: "alert" }, this.error) : null,
    );
  }

  private renderResults(): Node {
    const product = this.product;
    const resellers = this.resellers ?? [];
    const city = this.point?.city ?? null;
    const where = city ? ` perto de ${city}/${this.point?.state}` : "";
    let subText = "";
    if (resellers.length > 0) {
      subText =
        countNearby(resellers) === 0
          ? `Nenhum revendedor físico em até ${MAX_RADIUS_KM} km de ${city ?? "você"}. Veja as opções online:`
          : `${resellers.length} ${resellers.length === 1 ? "revendedor" : "revendedores"}${where}`;
    }
    const emptyText = `Nenhum revendedor encontrado em até ${MAX_RADIUS_KM} km de ${city ?? "você"}. Tente outro produto ou outra localização.`;

    return h(
      "div",
      { class: "panel" },
      h("div", { class: "top" }, h("button", { type: "button", class: "back", onclick: () => this.go("home", "term") }, "← Todos os produtos")),
      h("h2", { tabindex: "-1", "data-focus": "heading" }, product?.name ?? ""),
      h("p", { class: "muted", "aria-live": "polite" }, subText),
      resellers.length > 0
        ? h("div", { class: "stack" }, ...resellers.map((r) => this.renderReseller(r, product?.id ?? null, this.point)))
        : h("p", { class: "msg", role: "status" }, emptyText),
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "btn secondary", onclick: () => this.go("product", "cep") }, "Alterar localização"),
        product ? h("button", { type: "button", class: "btn secondary", onclick: () => this.openList(product) }, "Ver lista de revendedores") : null,
      ),
    );
  }

  private renderList(): Node {
    const productSelect = h(
      "select",
      { id: "gl-f-prod", "data-focus": "list-first", onchange: (e) => this.onFilter("sku", (e.target as HTMLSelectElement).value) },
      h("option", { value: "" }, "Todos os produtos"),
      ...this.catalog.map((p) => h("option", { value: p.sku }, p.name)),
    );
    productSelect.value = this.filters.sku;

    const ufSelect = h(
      "select",
      { id: "gl-f-uf", onchange: (e) => this.onFilter("uf", (e.target as HTMLSelectElement).value) },
      h("option", { value: "" }, "Todos os estados"),
      ...(this.places?.ufs ?? []).map((u) => h("option", { value: u }, u)),
    );
    ufSelect.value = this.filters.uf;

    const citySelect = h("select", { id: "gl-f-city", onchange: (e) => this.onFilter("city", (e.target as HTMLSelectElement).value) });
    this.citySelect = citySelect;
    this.fillCities();

    const typeSelect = h(
      "select",
      { id: "gl-f-type", onchange: (e) => this.onFilter("type", (e.target as HTMLSelectElement).value) },
      ...TYPE_FILTERS.map(([v, t]) => h("option", { value: v }, t)),
    );
    typeSelect.value = this.filters.type;

    const field = (id: string, label: string, el: HTMLElement) => h("div", {}, h("label", { for: id }, label), el);
    const host = h("div", { class: "list-host" });
    this.listHost = host;
    this.fillList();

    return h(
      "div",
      { class: "panel" },
      h("div", { class: "top" }, h("button", { type: "button", class: "back", onclick: () => this.go("home", "term") }, "← Todos os produtos")),
      h("h2", { tabindex: "-1" }, "Lista de revendedores"),
      h("p", { class: "muted", style: "margin:4px 0 14px" }, "Filtre por produto, estado ou cidade."),
      h(
        "div",
        { class: "filters" },
        field("gl-f-prod", "Produto", productSelect),
        field("gl-f-uf", "Estado", ufSelect),
        field("gl-f-city", "Cidade", citySelect),
        field("gl-f-type", "Tipo", typeSelect),
      ),
      h("button", { type: "button", class: "btn outline", disabled: this.listBusy, onclick: () => void this.sortByDistance() }, this.listPoint ? "Localização usada" : "Ordenar pelos mais próximos de mim"),
      host,
    );
  }

  private onFilter(key: "sku" | "uf" | "city" | "type", value: string): void {
    this.filters = { ...this.filters, [key]: value };
    if (key === "uf") {
      this.filters.city = "";
      this.fillCities();
    }
    void this.runList(0);
  }

  private renderReseller(r: ResellerResult, productId: string | null, point: GeoPoint | null): Node {
    const isOnline = r.type === "online";
    const distance = formatDistance(r.distance_km);
    const line1 = [r.street, r.number].filter(Boolean).join(", ");
    const line2 = [r.neighborhood, `${r.city}/${r.state}`].filter(Boolean).join(" — ");

    const link = (label: string, href: string | null, secondary: boolean, action: WidgetEventAction): Node | null =>
      href
        ? h(
            "a",
            {
              class: secondary ? "btn secondary" : "btn",
              href,
              target: "_blank",
              rel: "noopener noreferrer",
              onclick: () => this.trackClick(r, action, productId, point),
            },
            label,
          )
        : null;

    return h(
      "article",
      { class: "card" },
      h("h3", {}, r.name),
      h("div", { class: "meta" }, h("span", { class: "badge" }, TYPE_LABEL[r.type] ?? TYPE_LABEL.outro), distance ? h("span", { class: "dist" }, `a ${distance}`) : null),
      !isOnline ? h("div", { class: "muted" }, line1 || null, line1 ? h("br") : null, line2) : null,
      h(
        "div",
        { class: "actions" },
        link("WhatsApp", whatsappLink(r.whatsapp), false, "whatsapp"),
        link("Ligar", telLink(r.phone), true, "call"),
        link("Site", safeUrl(r.website), true, "site"),
        !isOnline ? link("Como chegar", mapsLink(r.latitude, r.longitude, [line1, line2].filter(Boolean).join(", ")), true, "directions") : null,
      ),
    );
  }
}

