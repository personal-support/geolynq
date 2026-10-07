export type Child = Node | string | null | false;
export type Attrs = Record<string, string | boolean | undefined | ((e: Event) => void)>;

/** Cria elemento sem innerHTML: todo texto vindo do banco entra como textContent. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
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
