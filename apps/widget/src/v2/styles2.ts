/**
 * CSS do widget v2 (Shadow DOM). A estrutura é SEMPRE a mesma; o que muda por cliente são só as variáveis --gl-* (ver theme.ts).
 * Fonte e cor do texto herdam do site quando o tema não define (`var(--gl-font, inherit)`).
 */
export const STYLES_V2 = /* css */ `
:host { display: block; box-sizing: border-box; }
*, *::before, *::after { box-sizing: inherit; }
.gl {
  font-family: var(--gl-font, inherit); font-size: inherit; line-height: 1.45;
  color: var(--gl-text, inherit); background: var(--gl-bg, transparent);
  width: 100%; max-width: 1200px; margin: 0 auto;
}
h2, h3, p { margin: 0; }
button, input, select { font: inherit; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
:is(button, a, input, select):focus-visible { outline: 3px solid var(--gl-accent); outline-offset: 2px; }

/* barra de busca */
.bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
.bar input { flex: 1 1 240px; min-width: 0; }
input[type="search"], input[type="text"], select {
  min-height: 46px; padding: 8px 18px; border: 1px solid var(--gl-input-border); border-radius: var(--gl-input-radius);
  background: var(--gl-card); color: var(--gl-card-text); width: 100%;
}
input::placeholder { color: var(--gl-muted); opacity: 1; }
label { display: block; font-weight: 600; margin-bottom: 6px; }

/* botões */
.btn, button.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 46px; padding: 8px 18px;
  border-radius: var(--gl-btn-radius); border: 2px solid var(--gl-primary); cursor: pointer; text-decoration: none;
  font-weight: 600; text-align: center; text-transform: var(--gl-btn-case); transition: opacity .15s;
  white-space: normal; line-height: 1.2; max-width: 100%; overflow-wrap: anywhere;
  background: var(--gl-primary); color: var(--gl-on-primary);
}
.btn.outline { background: var(--gl-card); color: var(--gl-accent); border-color: var(--gl-accent); }
.btn.secondary { background: var(--gl-card); color: var(--gl-card-text); border-color: var(--gl-border); }
.themed-outline .btn:not(.secondary):not(.outline) { background: var(--gl-card); color: var(--gl-accent); border-color: var(--gl-accent); }
.btn:hover:not(:disabled) { opacity: .88; }
.btn.block { width: 100%; }
.btn:disabled { opacity: .6; cursor: progress; }

/* contagem */
.count { margin: 0 0 12px; opacity: .8; font-size: .95em; }
.list-host { margin-top: 14px; }

/* grade de produtos */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 16px; list-style: none; margin: 0; padding: 0; }
@media (max-width: 420px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
.prod { display: flex; flex-direction: column; background: var(--gl-card); color: var(--gl-card-text); border: 1px solid var(--gl-border); border-radius: var(--gl-radius); overflow: hidden; height: 100%; transition: box-shadow .15s; }
.prod:hover { box-shadow: var(--gl-hover-shadow); }
.ph { position: relative; aspect-ratio: var(--gl-ratio); background: color-mix(in srgb, var(--gl-primary) 8%, var(--gl-card)); display: grid; place-items: center; overflow: hidden; }
.ph img { width: 100%; height: 100%; object-fit: contain; display: block; }
.ph-fb { font-weight: 700; font-size: 1.6em; letter-spacing: .04em; color: var(--gl-accent); }
.prod-body { display: flex; flex-direction: column; gap: 4px; padding: 12px; flex: 1; }
.prod-cat { font-size: .78em; text-transform: uppercase; letter-spacing: .06em; color: var(--gl-muted); }
.prod-name { font-weight: 600; line-height: 1.3; }
.prod-body .btn { margin-top: auto; min-height: 42px; padding: 6px 12px; }
@media (max-width: 480px) { .prod-body .btn { font-size: .9em; } .row { flex-wrap: wrap; } .row .btn { width: 100%; } }
.prod-body .spacer { flex: 1; }
.more { display: flex; justify-content: center; margin-top: 18px; }

/* esqueleto de carregamento */
.sk { border-radius: var(--gl-radius); min-height: 250px; background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%); background-size: 200% 100%; animation: sh 1.4s infinite; }
@keyframes sh { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .sk { animation: none; } }

/* telas internas */
.panel { background: var(--gl-card); color: var(--gl-card-text); border: 1px solid var(--gl-border); border-radius: var(--gl-radius); padding: 18px; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.back { background: none; border: 0; padding: 6px 0; min-height: 0; cursor: pointer; color: inherit; font-weight: 600; text-decoration: underline; }
.chosen { display: flex; gap: 14px; align-items: center; margin-bottom: 16px; }
.chosen .ph { width: 84px; flex: none; border-radius: calc(var(--gl-radius) * .7); }
.chosen h2 { font-size: 1.2em; }
.opts { display: grid; gap: 14px; }
.opt-title { font-weight: 600; margin-bottom: 6px; }
.row { display: flex; gap: 8px; }
.row input { flex: 1; min-width: 0; }
.or { text-align: center; color: var(--gl-muted); font-size: .9em; }
.msg { margin-top: 12px; padding: 10px 12px; border-radius: calc(var(--gl-radius) * .7); background: #f3f4f6; color: #111827; }
.msg.error { background: #fef2f2; color: #991b1b; }
.muted { color: var(--gl-muted); }

/* filtros da lista */
.filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 12px; }
.filters label { margin-bottom: 4px; font-size: .9em; }

/* revendedores */
.stack { display: grid; gap: 10px; margin-top: 12px; }
.card { border: 1px solid var(--gl-border); border-radius: var(--gl-radius); padding: 14px; background: var(--gl-card); color: var(--gl-card-text); }
.card h3 { font-size: 1.05em; }
.card .meta { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; margin: 2px 0 6px; }
.badge { font-size: .8em; padding: 1px 8px; border-radius: 999px; background: #e5e7eb; color: #374151; }
.dist { font-weight: 700; color: var(--gl-accent); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.actions .btn { min-height: 40px; padding: 6px 12px; }

/* selo discreto */
.credit { margin-top: 18px; text-align: right; font-size: .75em; color: var(--gl-muted); }
.credit a { color: inherit; text-decoration: none; }
.credit a:hover { text-decoration: underline; }
@media (prefers-reduced-motion: reduce) { .btn, .prod { transition: none; } }
`;
