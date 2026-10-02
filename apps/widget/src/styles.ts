/** CSS do Shadow DOM — isolado do site hospedeiro; só `--gl-color` e `--gl-on-color` vêm de fora. */
export const STYLES = /* css */ `
:host {
  display: block;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.45;
  color: #111827;
  box-sizing: border-box;
}
*, *::before, *::after { box-sizing: inherit; }
.gl { max-width: 640px; margin: 0 auto; padding: 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
h2 { font-size: 1.15rem; margin: 0 0 12px; }
label { display: block; font-weight: 600; margin-bottom: 6px; }
.row { display: flex; gap: 8px; }
input[type="text"], input[type="search"], input[type="tel"] {
  flex: 1; min-width: 0; min-height: 44px; padding: 8px 12px; font: inherit;
  border: 1px solid #9ca3af; border-radius: 8px; background: #fff; color: inherit;
}
button, .btn {
  min-height: 44px; padding: 8px 16px; font: inherit; font-weight: 600; cursor: pointer;
  border-radius: 8px; border: 1px solid var(--gl-color); text-decoration: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--gl-color); color: var(--gl-on-color);
}
button.secondary, .btn.secondary { background: #fff; color: #111827; border-color: #9ca3af; }
button.link {
  background: none; border: 0; padding: 4px 0; min-height: 0; color: #374151;
  text-decoration: underline; font-weight: 500;
}
button:disabled { opacity: .6; cursor: progress; }
:is(button, a, input):focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
.list { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
.pick {
  width: 100%; justify-content: flex-start; text-align: left; flex-direction: column; align-items: flex-start;
  background: #f9fafb; color: #111827; border-color: #d1d5db;
}
.pick small { font-weight: 400; color: #4b5563; }
.muted { color: #4b5563; font-size: .95rem; }
.msg { margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; background: #f3f4f6; }
.msg.error { background: #fef2f2; color: #991b1b; }
.chip { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; padding: 8px 12px; background: #f3f4f6; border-radius: 8px; }
.stack { display: grid; gap: 10px; margin-top: 12px; }
.card { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; }
.card h3 { margin: 0; font-size: 1.05rem; }
.card .meta { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; margin: 2px 0 6px; }
.badge { font-size: .8rem; padding: 1px 8px; border-radius: 999px; background: #e5e7eb; color: #374151; }
.dist { font-weight: 700; color: var(--gl-color); filter: brightness(.8); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.actions .btn { min-height: 40px; padding: 6px 12px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;
