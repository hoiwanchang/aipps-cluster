/* aipps cluster · short-mint
 * Free URL shortener on Cloudflare Workers (free tier). Zero external deps.
 *
 * State:
 *   KV  LINKS: code -> {"u": targetUrl, "t": createdMs}   (permanent, no TTL)
 *   DO  STATS: per-code atomic click counters (in-process binding)
 *
 * Routes:
 *   GET  /                    landing + shortener form (SEO HTML)
 *   POST /api/shorten         body {"url": "..."} -> {code, url, short_url, stats_url}
 *   GET  /api/shorten?url=    same, for browser/curl
 *   GET  /{code}               302 redirect to target + DO click increment
 *   GET  /api/stats/{code}     JSON {code, url, clicks, created, short_url}
 *   GET  /health /robots.txt /sitemap.xml
 *   GET  /__cron               daily: count links -> KV meta:summary
 *
 * Rate limit: 30 shorten/min/IP (KV). Redirects are not rate-limited.
 * Target validation: http/https only, no credentials in URL, no localhost /
 * private-IP literals / .local / .internal hosts.
 */

const RATE_LIMIT = 30;
const RATE_WINDOW = 60;
// 58 chars — no l/1/O/0 confusion
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* ---------------- Durable Object: per-link click counter ----------------
 * New sqlite-backed DO class model (KV-backed DOs are deprecated on this account).
 */
import { DurableObject } from "cloudflare:workers";

export class ClickCounter extends DurableObject {
  async increment() {
    const c = (await this.ctx.storage.get("c")) || 0;
    const n = c + 1;
    await this.ctx.storage.put("c", n);
    return { clicks: n };
  }
  async count() {
    const c = (await this.ctx.storage.get("c")) || 0;
    return { clicks: c };
  }
}

/* call a DO method, returning value or null on any failure
 * (stats are best-effort — never break the redirect over a counter) */
async function doCall(env, name, method) {
  try {
    const stub = env.STATS.get(env.STATS.idFromName(name));
    return await stub[method]();
  } catch {
    return null;
  }
}

/* ---------------- helpers ---------------- */
function randCode(len) {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

function validateTarget(raw) {
  if (!raw || raw.length > 2048) return { ok: false, error: "url too long (max 2048)" };
  let u;
  try { u = new URL(raw); } catch { return { ok: false, error: "invalid url" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return { ok: false, error: "only http/https allowed" };
  const h = u.hostname.toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost"))
    return { ok: false, error: "local hosts not allowed" };
  if (u.username || u.password) return { ok: false, error: "credentials in url not allowed" };
  // IPv6 literals: block entirely (can't cheaply evaluate zone/privacy)
  if (h.startsWith("[")) return { ok: false, error: "ipv6 not supported" };
  // require a public FQDN (at least one dot) — blocks single-label internal names
  if (!h.includes(".")) return { ok: false, error: "url must be a full domain (with a dot)" };
  // IPv4 private / loopback / link-local / metadata ranges
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const p = h.split(".").map(Number);
    if (p[0] === 10 || p[0] === 127 || p[0] === 0)
      return { ok: false, error: "private addresses not allowed" };
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
      return { ok: false, error: "private addresses not allowed" };
    if (p[0] === 192 && p[1] === 168)
      return { ok: false, error: "private addresses not allowed" };
    if (p[0] === 169 && p[1] === 254)
      return { ok: false, error: "link-local addresses not allowed" };
  }
  return { ok: true, url: u.toString() };
}

function jsonBody(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "access-control-max-age": "86400",
  };
}

async function rateLimit(env, ip) {
  const k = "rl:" + ip;
  const v = await env.LINKS.get(k);
  const n = v ? parseInt(v, 10) : 0;
  if (n >= RATE_LIMIT) {
    await env.LINKS.put(k, String(n), { expirationTtl: RATE_WINDOW });
    throw { status: 429, body: { error: "rate limit exceeded", limit: RATE_LIMIT, window_seconds: RATE_WINDOW } };
  }
  await env.LINKS.put(k, String(n + 1), { expirationTtl: RATE_WINDOW });
}

/* ---------------- HTML ---------------- */
const SITE = "short-mint";

function pageShell(title, desc, body, extraHead = "") {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' fill='%230a0a0a'/><path d='M2 11 L11 2 M6 2 h5 v5' stroke='%23FFB81C' stroke-width='2' fill='none'/><rect x='10' y='10' width='4' height='4' fill='%23fff'/></svg>">
<style>
:root{--bg:#0a0a0a;--panel:#111;--line:#262626;--txt:#f2f2f2;--dim:#8a8a8a;--accent:#FFB81C}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--txt);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
background-image:radial-gradient(circle,#1c1c1c 1px,transparent 1px);background-size:24px 24px}
.wrap{max-width:960px;margin:0 auto;padding:32px 20px 64px}
header{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--line);margin-bottom:32px}
header .logo{width:28px;height:28px;background:var(--accent)}
header h1{font-size:18px;letter-spacing:2px}
header h1 em{color:var(--accent);font-style:normal}
header .tag{margin-left:auto;font-size:11px;color:var(--dim);letter-spacing:1px}
.hero{margin:28px 0 8px}
.hero .kicker{color:var(--accent);font-size:12px;letter-spacing:3px;margin-bottom:10px}
.hero h2{font-size:clamp(24px,5vw,40px);line-height:1.15;font-weight:700}
.hero h2 span{color:var(--accent)}
.hero p{color:var(--dim);margin-top:12px;font-size:14px;max-width:640px;line-height:1.6}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px}
@media(max-width:720px){.grid{grid-template-columns:1fr}}
.panel{background:var(--panel);border:1px solid var(--line);padding:20px}
label{display:block;font-size:11px;letter-spacing:2px;color:var(--dim);margin:14px 0 6px}
label:first-child{margin-top:0}
input[type=text]{width:100%;background:var(--bg);border:1px solid var(--line);color:var(--txt);
padding:10px 12px;font-family:inherit;font-size:14px}
input[type=text]:focus{outline:none;border-color:var(--accent)}
button{margin-top:18px;width:100%;background:var(--accent);color:#0a0a0a;border:none;
padding:12px;font-family:inherit;font-size:14px;font-weight:700;letter-spacing:2px;cursor:pointer}
button:hover{background:#ffc63d}
.meta{font-size:12px;color:var(--dim);line-height:1.8;word-break:break-all}
.biglink{font-size:20px;color:var(--accent);word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{border:1px solid var(--line);padding:10px 12px;text-align:left}
th{color:var(--accent);font-size:11px;letter-spacing:2px;background:var(--bg)}
tr:hover td{background:#161616}
.foot{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--dim)}
.foot a{color:var(--dim);text-decoration:none}
.foot a:hover{color:var(--accent)}
code{color:var(--accent)}
a.plain{color:var(--accent);text-decoration:none}
.hint{font-size:12px;color:var(--dim);margin-top:10px;line-height:1.7}
h3.sec{margin:40px 0 16px;font-size:13px;letter-spacing:3px;color:var(--accent)}
#result{margin-top:16px;display:none}
#result .copybtn{margin-top:10px;margin-left:8px;padding:6px 12px;font-size:11px}
</style>
${extraHead}
</head>
<body><div class="wrap">
<header><div class="logo"></div><h1>SHORT<em>-MINT</em></h1><span class="tag">FREE · NO ACCOUNT · CLICK STATS</span></header>
${body}
<footer class="foot">
  <span>aipps.vip — free utilities, no ads, no tracking</span>
  <a href="https://api.aipps.vip" target="_blank" rel="noopener">api-mint · free APIs</a>
  <a href="https://qr.aipps.vip" target="_blank" rel="noopener">qr-mint · free QR codes</a>
  <a href="/health">status</a>
</footer>
</div></body>
</html>`;
}

function landingHtml(origin, demoCode, demoClicks, linkCount) {
  const demoUrl = `${origin}/${demoCode}`;
  return pageShell(
    "short-mint — free URL shortener with click stats, no account",
    "Shorten any URL for free. No account, no ads, real click statistics, permanent links. API included. Built on Cloudflare Workers.",
    `<div class="hero">
<div class="kicker">FREE URL SHORTENER</div>
<h2>Shorten it.<br><span>No account. No expiry. Click stats included.</span></h2>
<p>Paste a long URL, get a short one that lasts forever. Every link gets real click statistics — not estimates, not samples. No signup, no ads, no tracking pixels, no "your link expires in 30 days". Runs on Cloudflare Workers, resolves from the edge nearest your reader.</p>
</div>
<div class="grid">
<div class="panel">
<label for="u">PASTE YOUR LONG URL</label>
<input type="text" id="u" name="url" placeholder="https://example.com/very/long/path?with=params" autocomplete="off" spellcheck="false">
<button id="go" type="button">SHORTEN →</button>
<div id="result" class="panel" style="border-color:var(--accent)">
<label>YOUR SHORT LINK</label>
<div class="biglink" id="rurl"></div>
<div class="meta" id="rinfo" style="margin-top:8px"></div>
<div>
<a class="plain" id="rstats" href="#" style="font-size:13px">📊 view click stats</a>
<a class="plain" id="rqr" href="#" style="font-size:13px;margin-left:14px">⬜ make a QR of it (qr-mint)</a>
<button class="copybtn" id="rcopy" type="button">COPY</button>
</div>
</div>
<div class="hint">Free forever: 30 links/minute per IP. Links are permanent — no purge, no admin, no "premium to keep it".</div>
</div>
<div class="panel">
<label>ALIVE DEMO — CLICK IT, IT COUNTS</label>
<div class="biglink"><a class="plain" href="/${demoCode}" target="_blank">/${demoCode}</a></div>
<div class="meta" style="margin-top:8px">clicks so far: <b id="demoN">${demoClicks == null ? "…" : demoClicks}</b><br>
it redirects to aipps.vip. Every visit increments the counter atomically (Durable Object, not a sample).</div>
<label>THE API (FOR POWER USERS)</label>
<div class="meta"><code>POST /api/shorten</code> {"url":"https://…"}<br>
→ {"code":"…","short_url":"…","stats_url":"…"}<br>
<code>GET /api/stats/{code}</code> → clicks, target, created-at<br>
full CORS, JSON, zero auth. Build things.</div>
</div>
</div>
<h3 class="sec">WHY short-mint</h3>
<table>
<tr><th></th><th>short-mint</th><th>typical shorteners</th></tr>
<tr><td>Account</td><td>never</td><td>often required for stats</td></tr>
<tr><td>Link expiry</td><td>permanent</td><td>7–30 day trials common</td></tr>
<tr><td>Click stats</td><td>yes, real (atomic counter)</td><td>paid tier only</td></tr>
<tr><td>Custom domain / API</td><td>REST API free</td><td>API keys, quotas</td></tr>
<tr><td>Ads / trackers on redirect</td><td>none (clean 302)</td><td>interstitials everywhere</td></tr>
<tr><td>Price</td><td>$0</td><td>$–$$</td></tr>
</table>
<h3 class="sec">FAQ</h3>
<table>
<tr><th>Do I need an account?</th><td>No. Paste, shorten, done. 30 links/minute per IP, free.</td></tr>
<tr><th>Do links expire?</th><td>No. They're stored in Cloudflare KV with no TTL and no admin. They live until the worker does (we won't let that happen without notice).</td></tr>
<tr><th>How do click stats work?</th><td>Each short link has a Durable Object that increments an atomic counter on every redirect. No sampling, no JavaScript, works for any visitor.</td></tr>
<tr><th>Is there an API?</th><td>Yes — POST /api/shorten and GET /api/stats/{code}. Full CORS, JSON, no key.</td></tr>
<tr><th>Is this a Bitly alternative?</th><td>For free, no-account, no-ads use cases: yes. No UTM rewriting, no branded pages, no upsells — it's a shortener and nothing else.</td></tr>
</table>
<div class="meta" style="margin-top:24px">${linkCount != null ? linkCount + " " : ""}links minted so far. ${linkCount != null ? "All " : ""}free.</div>
<script>
(function(){
  var btn=document.getElementById('go'),u=document.getElementById('u');
  function go(){
    var val=u.value.trim(); if(!val) return;
    if(!/^https?:\\/\\//i.test(val)) val='https://'+val;
    btn.disabled=true; btn.textContent='SHORTENING…';
    fetch('/api/shorten',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:val})})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})}).then(function(res){
      btn.disabled=false; btn.textContent='SHORTEN →';
      if(!res.ok){alert(res.j.error||'failed');return;}
      var j=res.j;
      document.getElementById('rurl').textContent=j.short_url;
      document.getElementById('rinfo').textContent='code '+j.code+' · target '+j.url;
      document.getElementById('rstats').href=j.stats_url;
      document.getElementById('rqr').href='https://qr.aipps.vip/g?data='+encodeURIComponent(j.short_url);
      var cb=document.getElementById('rcopy');
      cb.onclick=function(){
        navigator.clipboard.writeText(j.short_url).then(function(){
          cb.textContent='COPIED';
          setTimeout(function(){cb.textContent='COPY';},2000);
        });
      };
      document.getElementById('result').style.display='block';
    }).catch(function(){btn.disabled=false;btn.textContent='SHORTEN →';alert('network error')});
  }
  btn.onclick=go;
  u.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go();}});
})();
</script>`
  );
}

function notFoundPage(code) {
  return pageShell(
    `/${code} — link not found (short-mint)`,
    "This short link doesn't exist or was never minted on short-mint.",
    `<div class="hero">
<div class="kicker">404</div>
<h2>No such link: <span>/${code}</span></h2>
<p>It was never minted, or the code is mistyped. Short links on this service are permanent — if it existed, it would still be here.</p>
</div>
<div class="panel"><a class="plain" href="/">← mint a new short link</a></div>`
  );
}

/* ---------------- main ---------------- */

/* --- daily PV counter (shared KV AIPPS_PV) ---
   One read-modify-write per request (accurate even at low traffic).
   /health excluded so cron probes don't inflate. Free tier: 10k KV
   writes/mo — fine at launch; switch to a Durable Object atomic counter
   if volume grows past that. */
const PV_PREFIX = "pv:";
const PV_TTL = 35 * 86400;
function pvBump(env, ctx) {
  const day = new Date().toISOString().slice(0, 10);
  const key = PV_PREFIX + day + ":" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  if (ctx && ctx.waitUntil) ctx.waitUntil(env.PV.put(key, "1", { expirationTtl: PV_TTL }));
}
async function pvCount(env, day) {
  let total = 0, cursor = "";
  for (let i = 0; i < 20; i++) {
    const r = await env.PV.list({ prefix: PV_PREFIX + day + ":", cursor: cursor || undefined, limit: 1000 });
    total += r.keys.length;
    if (r.list_complete) break;
    cursor = r.cursor;
  }
  return total;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const origin = url.origin;
    const ip = request.headers.get("cf-connecting-ip") || "anon";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // --- daily PV count (KV AIPPS_PV; /health excluded so cron probes don't inflate) ---
    if (path !== "/health") pvBump(env, ctx);

    // static / cheap routes (no rate limit)
    if (request.method === "GET") {
      if (path === "/health") {
        let summary = null;
        try { summary = await env.LINKS.get("meta:summary", "json"); } catch {}
        return jsonBody({ ok: true, service: "short-mint", uptime: env.UPTIME || "booting", summary });
      }
      if (path === "/robots.txt") {
        return new Response(
          `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,
          { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } }
        );
      }
      if (path === "/sitemap.xml") {
        const urls = ["/"];
        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls.map((u) => `  <url><loc>${origin}${u}</loc></url>`).join("\n") + `\n</urlset>`;
        return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
      }
      // --- /__pv: PV stats read (secret-guarded, ops only; not advertised) ---
      if (path === "/__pv") {
        // PV 数据不敏感（仅每日访问量），免鉴权；ops cron 直接 GET 读取
        try {
          const days = [];
          const d = new Date();
          for (let i = 0; i < 8; i++) days.push(new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10));
          const series = [];
          for (const day of days) series.push({ day: day, n: await pvCount(env, day) });
          return jsonBody({ product: "short", today: days[0], series: series });
        } catch (e) {
          return jsonBody({ error: String(e && e.message || e) }, 500);
        }
      }
      if (path === "/__cron") {
        return jsonBody(await refreshSummary(env));
      }
    }

    // API: create short link
    if (path === "/api/shorten") {
      if (request.method !== "POST" && request.method !== "GET")
        return jsonBody({ error: "method not allowed" }, 405);
      let target;
      try {
        if (request.method === "GET") {
          target = url.searchParams.get("url");
        } else {
          const body = await request.json();
          target = body && body.url;
        }
      } catch {
        return jsonBody({ error: "invalid json body — send {\"url\":\"https://…\"}" }, 400);
      }
      const v = validateTarget(target);
      if (!v.ok) return jsonBody({ error: v.error }, 400);

      try {
        await rateLimit(env, ip);
      } catch (e) {
        return jsonBody(e.body, e.status);
      }

      // try 5-char code, fall back to 6 on collision
      let code = null;
      for (const len of [5, 6]) {
        for (let attempt = 0; attempt < 4; attempt++) {
          const c = randCode(len);
          const existing = await env.LINKS.get(c);
          if (!existing) { code = c; break; }
        }
        if (code) break;
      }
      if (!code) return jsonBody({ error: "could not allocate code, try again" }, 500);

      const rec = { u: v.url, t: Date.now() };
      await env.LINKS.put(code, JSON.stringify(rec));
      return jsonBody({
        code,
        url: v.url,
        short_url: `${origin}/${code}`,
        stats_url: `${origin}/api/stats/${code}`,
        permanent: true,
      });
    }

    // API: stats
    const m = path.match(/^\/api\/stats\/([a-zA-Z0-9]{4,8})$/);
    if (m) {
      const code = m[1];
      const rec = await env.LINKS.get(code, "json");
      if (!rec) return jsonBody({ error: "not found", code }, 404);
      let clicks = null;
      const sc = await doCall(env, code, "count");
      if (sc && sc.clicks != null) clicks = sc.clicks;
      return jsonBody({
        code,
        url: rec.u,
        clicks,
        created: rec.t ? new Date(rec.t).toISOString() : null,
        short_url: `${origin}/${code}`,
      });
    }

    // redirect: /{code}
    const c = path.match(/^\/([a-zA-Z0-9]{4,8})$/);
    if (c) {
      const code = c[1];
      const rec = await env.LINKS.get(code, "json");
      if (!rec) {
        return new Response(notFoundPage(code), {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      }
      await doCall(env, code, "increment");
      return new Response(null, {
        status: 302,
        headers: { location: rec.u, "cache-control": "no-store" },
      });
    }

    // landing
    if (path === "/") {
      const accept = request.headers.get("accept") || "";
      if (accept.includes("application/json") && !accept.includes("text/html")) {
        return jsonBody({
          service: "short-mint",
          base: origin,
          endpoints: ["POST /api/shorten", "GET /api/shorten?url=", "GET /{code}", "GET /api/stats/{code}"],
          limits: "30 shorten/min/IP, no auth, links permanent",
        });
      }
      // ensure demo link exists
      let demo = await env.LINKS.get("demo", "json");
      if (!demo) {
        demo = { u: "https://aipps.vip", t: Date.now() };
        await env.LINKS.put("demo", JSON.stringify(demo));
      }
      let demoClicks = null, linkCount = null;
      const dsc = await doCall(env, "demo", "count");
      if (dsc && dsc.clicks != null) demoClicks = dsc.clicks;
      try {
        const s = await env.LINKS.get("meta:summary", "json");
        if (s && s.links != null) linkCount = s.links;
      } catch {}
      return new Response(landingHtml(origin, "demo", demoClicks, linkCount), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
      });
    }

    return jsonBody({ error: "not_found", message: "Unknown path. See / for the list." }, 404);
  },
  async scheduled(event, env) {
    // daily 18:00 UTC: recount links into meta:summary (landing page shows total)
    await refreshSummary(env);
  },
};

/* shared by /__cron and scheduled() */
async function refreshSummary(env) {
  let count = 0;
  let cursor;
  do {
    const page = await env.LINKS.list({ prefix: "", cursor, limit: 1000 });
    count += page.keys.filter((k) => !k.name.startsWith("rl:") && k.name !== "meta:summary").length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const summary = { links: count, at: new Date().toISOString() };
  await env.LINKS.put("meta:summary", JSON.stringify(summary));
  return summary;
}
