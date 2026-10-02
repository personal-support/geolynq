import {
  GeoLynqApi,
  browserLocation,
  geocodeCep,
  type EventPayload,
  type GeoPoint,
  type ProductPublic,
  type ResellerResult,
  type TenantPublic,
} from "./api";
import { STYLES } from "./styles";
import {
  MAX_RADIUS_KM,
  countNearby,
  formatDistance,
  mapsLink,
  parseCep,
  readableTextColor,
  resolveColor,
  safeUrl,
  sanitizeSearchTerm,
  telLink,
  whatsappLink,
} from "./util";

type View = "search" | "location" | "results";
type Status = "loading" | "ready" | "unavailable";
type Child = Node | string | null | false;
type Attrs = Record<string, string | boolean | undefined | ((e: Event) => void)>;

const TYPE_LABEL: Record<string, string> = {
  loja_fisica: "Loja física",
  farmacia: "Farmácia",
  online: "Venda online",
  distribuidor: "Distribuidor",
  outro: "Revendedor",
};

/** Cria elemento sem innerHTML: todo texto vindo do banco entra como textContent. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === "function") el.addEventListener(key.replace(/^on/, ""), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children) {
    if (child !== null && child !== false) el.append(child);
  }
  return el;
}

export class GeoLynqWidget extends HTMLElement {
  static observedAttributes = ["tenant", "color"];

  private readonly root = this.attachShadow({ mode: "open" });
  private readonly api = new GeoLynqApi(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  );

  private status: Status = "loading";
  private tenant: TenantPublic | null = null;
  private view: View = "search";
  private term = "";
  private products: ProductPublic[] | null = null;
  private product: ProductPublic | null = null;
  private point: GeoPoint | null = null;
  private resellers: ResellerResult[] | null = null;
  private busy = false;
  private error: string | null = null;
  private focusTarget: string | null = "term";
  /** Invalida respostas atrasadas quando o usuário já seguiu em frente (ou trocou de tenant). */
  private token = 0;
  private started = false;

  connectedCallback(): void {
    this.started = true;
    void this.load();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.started || oldValue === newValue) return;
    if (name === "tenant") void this.load();
    else this.render();
  }

  private async load(): Promise<void> {
    const slug = this.getAttribute("tenant")?.trim();
    const run = ++this.token;
    this.reset();
    if (!slug) {
      console.error("[geolynq] atributo 'tenant' ausente em <geolynq-widget>");
      this.status = "unavailable";
      return this.render();
    }
    this.status = "loading";
    this.render();
    try {
      const tenant = await this.api.getTenant(slug);
      if (run !== this.token) return;
      this.tenant = tenant;
      this.status = tenant ? "ready" : "unavailable";
      if (!tenant) console.error(`[geolynq] tenant '${slug}' não encontrado ou inativo`);
    } catch (err) {
      if (run !== this.token) return;
      console.error("[geolynq] falha ao carregar o tenant", err);
      this.status = "unavailable";
    }
    this.render();
  }

  private reset(): void {
    this.view = "search";
    this.term = "";
    this.products = null;
    this.product = null;
    this.point = null;
    this.resellers = null;
    this.busy = false;
    this.error = null;
    this.focusTarget = "term";
  }

  // ---- ações -------------------------------------------------------------

  private async searchProducts(): Promise<void> {
    const tenant = this.tenant;
    const term = sanitizeSearchTerm(this.term);
    if (!tenant || !term) return;
    const run = ++this.token;
    this.busy = true;
    this.error = null;
    this.render();
    try {
      const products = await this.api.searchProducts(tenant.id, term);
      if (run !== this.token) return;
      this.products = products;
      // Termo que não bate com nenhum SKU = demanda por produto fora do catálogo (Fase 10).
      if (products.length === 0) {
        this.log({ event_type: "search", query_text: term, product_id: null, results_count: 0 });
      }
    } catch {
      if (run !== this.token) return;
      this.error = "Não foi possível buscar agora. Tente novamente em instantes.";
    }
    this.busy = false;
    this.focusTarget = "term";
    this.render();
  }

  private pickProduct(product: ProductPublic): void {
    this.product = product;
    this.view = "location";
    this.error = null;
    this.focusTarget = "cep";
    this.render();
  }

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
        this.error = "Não encontramos esse CEP. Confira o número ou veja os revendedores sem informar a localização.";
        this.focusTarget = "cep";
        return this.render();
      }
      await this.lookup(point);
    } catch {
      if (run !== this.token) return;
      this.busy = false;
      this.error = "Não foi possível localizar o CEP agora. Tente novamente ou veja sem informar a localização.";
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
      await this.lookup(point);
    } catch {
      if (run !== this.token) return;
      this.busy = false;
      this.error = "Não conseguimos acessar sua localização. Informe o CEP.";
      this.focusTarget = "cep";
      this.render();
    }
  }

  private async lookup(point: GeoPoint | null): Promise<void> {
    const tenant = this.tenant;
    const product = this.product;
    if (!tenant || !product) return;
    const run = ++this.token;
    this.busy = true;
    this.error = null;
    this.render();
    try {
      const resellers = await this.api.nearestResellers(tenant.id, product.id, point);
      if (run !== this.token) return;
      this.point = point;
      this.resellers = resellers;
      this.view = "results";
      this.focusTarget = "heading";
      // product_id + results_count = 0 → produto existe, ninguém vende perto (coverage gap).
      // results_count conta só revendedores físicos dentro do raio: a loja online aparece pro
      // usuário, mas não esconde a lacuna de cobertura local.
      this.log({
        event_type: "search",
        query_text: sanitizeSearchTerm(this.term) || product.name,
        product_id: product.id,
        city: point?.city ?? null,
        state: point?.state ?? null,
        results_count: countNearby(resellers),
      });
    } catch {
      if (run !== this.token) return;
      this.error = "Não foi possível buscar os revendedores agora. Tente novamente.";
      this.focusTarget = "cep";
    }
    this.busy = false;
    this.render();
  }

  private back(to: View): void {
    this.token++;
    this.view = to;
    this.busy = false;
    this.error = null;
    if (to === "search") {
      this.product = null;
      this.point = null;
      this.resellers = null;
    }
    this.focusTarget = to === "search" ? "term" : "cep";
    this.render();
  }

  private log(event: EventPayload): void {
    if (this.tenant) this.api.logEvent(this.tenant.id, event);
  }

  private trackClick(reseller: ResellerResult): void {
    this.log({
      event_type: "reseller_click",
      query_text: sanitizeSearchTerm(this.term) || this.product?.name || null,
      product_id: this.product?.id ?? null,
      reseller_id: reseller.reseller_id,
      city: this.point?.city ?? null,
      state: this.point?.state ?? null,
    });
  }

  // ---- renderização ------------------------------------------------------

  private render(): void {
    const color = resolveColor(this.getAttribute("color"), this.tenant?.primary_color);
    const wrapper = h("div", {
      class: "gl",
      style: `--gl-color:${color};--gl-on-color:${readableTextColor(color)}`,
    });

    if (this.status === "loading") {
      wrapper.append(h("p", { class: "muted", role: "status" }, "Carregando…"));
    } else if (this.status === "unavailable") {
      wrapper.append(h("p", { class: "muted" }, "O localizador de revendedores está indisponível no momento."));
    } else {
      wrapper.append(this.renderView());
    }

    this.root.replaceChildren(h("style", {}, STYLES), wrapper);

    const target = this.focusTarget;
    this.focusTarget = null;
    if (target) {
      this.root.querySelector<HTMLElement>(`[data-focus="${target}"]`)?.focus();
    }
  }

  private renderView(): Node {
    switch (this.view) {
      case "search":
        return this.renderSearch();
      case "location":
        return this.renderLocation();
      case "results":
        return this.renderResults();
    }
  }

  private renderError(): Node | null {
    return this.error ? h("p", { class: "msg error", role: "alert" }, this.error) : null;
  }

  private renderSearch(): Node {
    const input = h("input", {
      type: "search",
      id: "gl-term",
      "data-focus": "term",
      placeholder: "Nome ou código do produto",
      autocomplete: "off",
      maxlength: "80",
      oninput: (e) => (this.term = (e.target as HTMLInputElement).value),
    });
    input.value = this.term;

    const form = h(
      "form",
      {
        onsubmit: (e) => {
          e.preventDefault();
          void this.searchProducts();
        },
      },
      h("label", { for: "gl-term" }, "Qual produto você procura?"),
      h(
        "div",
        { class: "row" },
        input,
        h("button", { type: "submit", disabled: this.busy }, this.busy ? "Buscando…" : "Buscar"),
      ),
    );

    let results: Node | null = null;
    if (this.products && this.products.length > 0) {
      results = h(
        "ul",
        { class: "list" },
        ...this.products.map((p) =>
          h(
            "li",
            {},
            h(
              "button",
              { type: "button", class: "pick", onclick: () => this.pickProduct(p) },
              p.name,
              p.category ? h("small", {}, p.category) : null,
            ),
          ),
        ),
      );
    } else if (this.products) {
      results = h(
        "p",
        { class: "msg", role: "status" },
        "Não encontramos esse produto no catálogo. Confira o nome ou tente outro termo.",
      );
    }

    return h("div", {}, h("h2", {}, "Onde encontrar"), form, this.renderError(), results);
  }

  private renderLocation(): Node {
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
      {},
      h(
        "div",
        { class: "chip" },
        h("strong", {}, this.product?.name ?? ""),
        h("button", { type: "button", class: "link", onclick: () => this.back("search") }, "Trocar produto"),
      ),
      h(
        "form",
        {
          onsubmit: (e) => {
            e.preventDefault();
            void this.locateByCep(cep.value);
          },
        },
        h("label", { for: "gl-cep" }, "Seu CEP"),
        h(
          "div",
          { class: "row" },
          cep,
          h("button", { type: "submit", disabled: this.busy }, this.busy ? "Buscando…" : "Ver revendedores"),
        ),
      ),
      h(
        "div",
        { class: "stack" },
        h(
          "button",
          { type: "button", class: "secondary", disabled: this.busy, onclick: () => void this.locateByBrowser() },
          "Usar minha localização",
        ),
        h(
          "button",
          { type: "button", class: "link", disabled: this.busy, onclick: () => void this.lookup(null) },
          "Ver revendedores sem informar a localização",
        ),
      ),
      this.renderError(),
    );
  }

  private renderResults(): Node {
    const resellers = this.resellers ?? [];
    const located = this.point !== null;
    const city = this.point?.city ?? null;
    const where = city ? ` perto de ${city}/${this.point?.state}` : "";

    let subText = "";
    if (resellers.length > 0) {
      subText =
        located && countNearby(resellers) === 0
          ? `Nenhum revendedor físico em até ${MAX_RADIUS_KM} km de ${city ?? "você"}. Veja as opções online:`
          : `${resellers.length} ${resellers.length === 1 ? "revendedor" : "revendedores"}${where}`;
    }

    // Sem localização a busca não filtra por distância: lista vazia = nenhum revendedor cadastrado.
    const emptyText = located
      ? `Nenhum revendedor encontrado em até ${MAX_RADIUS_KM} km de ${city ?? "você"}. Tente outro produto ou outra localização.`
      : "Ainda não há revendedores cadastrados para este produto. Tente outro produto ou volte mais tarde.";

    const heading = h("h2", { tabindex: "-1", "data-focus": "heading" }, this.product?.name ?? "");
    const sub = h("p", { class: "muted", "aria-live": "polite" }, subText);

    const body =
      resellers.length > 0
        ? h("div", { class: "stack" }, ...resellers.map((r) => this.renderReseller(r)))
        : h("p", { class: "msg", role: "status" }, emptyText);

    return h(
      "div",
      {},
      heading,
      sub,
      body,
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "secondary", onclick: () => this.back("location") }, "Alterar localização"),
        h("button", { type: "button", class: "secondary", onclick: () => this.back("search") }, "Nova busca"),
      ),
    );
  }

  private renderReseller(r: ResellerResult): Node {
    const isOnline = r.type === "online";
    const distance = formatDistance(r.distance_km);
    const line1 = [r.street, r.number].filter(Boolean).join(", ");
    const line2 = [r.neighborhood, `${r.city}/${r.state}`].filter(Boolean).join(" — ");

    const link = (label: string, href: string | null, secondary: boolean): Node | null =>
      href
        ? h(
            "a",
            {
              class: secondary ? "btn secondary" : "btn",
              href,
              target: "_blank",
              rel: "noopener noreferrer",
              onclick: () => this.trackClick(r),
            },
            label,
          )
        : null;

    return h(
      "article",
      { class: "card" },
      h("h3", {}, r.name),
      h(
        "div",
        { class: "meta" },
        h("span", { class: "badge" }, TYPE_LABEL[r.type] ?? TYPE_LABEL.outro),
        distance ? h("span", { class: "dist" }, `a ${distance}`) : null,
      ),
      !isOnline ? h("div", { class: "muted" }, line1 || null, line1 ? h("br") : null, line2) : null,
      h(
        "div",
        { class: "actions" },
        link("WhatsApp", whatsappLink(r.whatsapp), false),
        link("Ligar", telLink(r.phone), true),
        link("Site", safeUrl(r.website), true),
        !isOnline
          ? link("Como chegar", mapsLink(r.latitude, r.longitude, [line1, line2].filter(Boolean).join(", ")), true)
          : null,
      ),
    );
  }
}
