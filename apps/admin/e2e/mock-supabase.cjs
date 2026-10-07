/**
 * Mini-Supabase para o E2E do painel. NÃO é um mock "de mentira": as respostas dos relatórios vêm das funções SQL
 * reais (panel_overview/panel_catalog), executadas num Postgres local com o esquema e as migrations do projeto,
 * sob o papel `authenticated` com o `sub` do usuário logado — ou seja, com o RLS valendo.
 * Só a camada de autenticação (GoTrue) é simulada: login por senha, /user, refresh e logout.
 *
 * Banco: DATABASE_URL (padrão: postgres://e2e:e2e@127.0.0.1:5432/geolynq_test). Ver supabase/tests/README.md.
 */
const http = require("http");
const crypto = require("crypto");
const { Client } = require("pg");

const SECRET = "mock-jwt-secret";
const USUARIOS = {
  "a@example.invalid": { id: "00000000-0000-4000-8000-0000000000aa", senha: "senha-teste-123" }, // fabrica-teste (trial)
  "b@example.invalid": { id: "00000000-0000-4000-8000-0000000000bb", senha: "senha-teste-123" }, // demo (active)
  "c@example.invalid": { id: "00000000-0000-4000-8000-0000000000cc", senha: "senha-teste-123" }, // sem cliente
};

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
function jwt(sub, email, ttl = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub, email, role: "authenticated", aud: "authenticated", iat: now, exp: now + ttl, session_id: "s-" + sub });
  const s = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return { token: `${h}.${p}.${s}`, exp: now + ttl };
}
function verify(token) {
  const [h, p, s] = String(token || "").split(".");
  if (!s) return null;
  const ok = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url") === s;
  if (!ok) return null;
  const c = JSON.parse(Buffer.from(p, "base64url").toString());
  return c.exp > Math.floor(Date.now() / 1000) ? c : null;
}
const userJson = (sub, email) => ({
  id: sub, aud: "authenticated", role: "authenticated", email, email_confirmed_at: "2026-10-01T00:00:00Z",
  phone: "", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [],
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
});
function sessionJson(sub, email) {
  const { token, exp } = jwt(sub, email);
  return { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r-" + sub, user: userJson(sub, email) };
}

async function comoUsuario(sub, fn) {
  const db = new Client({ connectionString: process.env.DATABASE_URL || "postgres://e2e:e2e@127.0.0.1:5432/geolynq_test" });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
    const r = await fn(db);
    await db.query("commit");
    return r;
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
}

function start(port = 54321) {
  const chamadas = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    const body = raw ? JSON.parse(raw) : {};
    const send = (status, json, extra = {}) => {
      res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", ...extra });
      res.end(json === undefined ? "" : JSON.stringify(json));
    };
    const auth = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
    const claims = verify(auth);
    chamadas.push(`${req.method} ${url.pathname}${url.search ? "?" + url.search.slice(1, 60) : ""}`);

    try {
      // ---- Auth (GoTrue simulado)
      if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
        const u = USUARIOS[String(body.email || "").toLowerCase()];
        if (!u || u.senha !== body.password) return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        return send(200, sessionJson(u.id, body.email.toLowerCase()));
      }
      if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
        const sub = String(body.refresh_token || "").replace(/^r-/, "");
        const email = Object.keys(USUARIOS).find((e) => USUARIOS[e].id === sub);
        return email ? send(200, sessionJson(sub, email)) : send(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      }
      if (url.pathname === "/auth/v1/user") {
        return claims ? send(200, userJson(claims.sub, claims.email)) : send(401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
      }
      if (url.pathname === "/auth/v1/logout") return send(204);

      // ---- REST (PostgREST simulado; consultas reais sob RLS)
      if (url.pathname.startsWith("/rest/v1/")) {
        if (!claims) return send(401, { code: "PGRST301", message: "JWT inválido" });
        const rota = url.pathname.slice("/rest/v1/".length);

        if (rota === "rpc/panel_overview") {
          const r = await comoUsuario(claims.sub, (db) => db.query("select public.panel_overview($1::uuid, $2::int) as j", [body.p_tenant_id, body.p_days]));
          return send(200, r.rows[0].j);
        }
        if (rota === "rpc/panel_catalog") {
          const r = await comoUsuario(claims.sub, (db) => db.query("select public.panel_catalog($1::uuid) as j", [body.p_tenant_id]));
          return send(200, r.rows[0].j);
        }
        if (rota === "rpc/panel_gaps") {
          const r = await comoUsuario(claims.sub, (db) => db.query("select public.panel_gaps($1::uuid, $2::int) as j", [body.p_tenant_id, body.p_days]));
          return send(200, r.rows[0].j);
        }
        if (rota === "rpc/panel_recent") {
          const r = await comoUsuario(claims.sub, (db) => db.query("select public.panel_recent($1::uuid, $2::int) as j", [body.p_tenant_id, body.p_limit]));
          return send(200, r.rows[0].j);
        }
        if (rota === "rpc/panel_funnel") {
          const r = await comoUsuario(claims.sub, (db) => db.query("select public.panel_funnel($1::uuid, $2::int) as j", [body.p_tenant_id, body.p_days]));
          return send(200, r.rows[0].j);
        }
        if (rota === "rpc/panel_resellers") {
          const r = await comoUsuario(claims.sub, (db) => db.query("select public.panel_resellers($1::uuid, $2::int) as j", [body.p_tenant_id, body.p_days]));
          return send(200, r.rows[0].j);
        }
        if (rota === "tenant_users") {
          const r = await comoUsuario(claims.sub, (db) =>
            db.query(`select tu.role, (select to_jsonb(x) from (select t.id, t.name, t.slug, t.status, t.primary_color from public.tenants t where t.id = tu.tenant_id) x) as tenants
                        from public.tenant_users tu order by tu.created_at asc`),
          );
          return send(200, r.rows);
        }
        if (rota === "widget_events") {
          // contagem exata (HEAD + Prefer: count=exact), sob RLS: tenant_id=eq.X e, opcionalmente, session_id=like.seed-%
          const tenant = (url.searchParams.get("tenant_id") || "").replace(/^eq\./, "");
          const like = (url.searchParams.get("session_id") || "").replace(/^like\./, "");
          const r = await comoUsuario(claims.sub, (db) =>
            db.query(`select count(*)::int n from public.widget_events where tenant_id = $1::uuid ${like ? "and session_id like $2" : ""}`, like ? [tenant, like] : [tenant]),
          );
          const n = r.rows[0].n;
          res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*", "content-range": n === 0 ? "*/0" : `0-${n - 1}/${n}` });
          return res.end(req.method === "HEAD" ? undefined : "[]");
        }
        if (rota === "import_batches") {
          const tenant = (url.searchParams.get("tenant_id") || "").replace(/^eq\./, "");
          const r = await comoUsuario(claims.sub, (db) =>
            db.query(`select id, source, status, rows_processed, rows_failed, error_log, created_at, completed_at from public.import_batches where tenant_id = $1::uuid order by created_at desc limit 20`, [tenant]),
          );
          return send(200, r.rows);
        }
        return send(404, { code: "PGRST205", message: `rota não simulada: ${rota}` });
      }
      return send(404, { message: "não encontrado" });
    } catch (e) {
      return send(500, { code: "MOCK", message: String(e.message || e) });
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, chamadas, USUARIOS })));
}

module.exports = { start, USUARIOS };
if (require.main === module) start(Number(process.env.PORT) || 54321).then(() => console.log("mock-supabase em http://127.0.0.1:54321"));
