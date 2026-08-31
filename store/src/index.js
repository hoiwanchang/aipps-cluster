/* aipps cluster · store (main domain aipps.vip)
 * Storefront for the aipps free-tool cluster + the paid boilerplate product.
 * Built to satisfy Creem account-review requirements:
 *   - product clearly visible + pricing visible
 *   - Privacy Policy (/privacy) + Terms of Service (/terms)
 *   - branded support email shown (support@aipps.vip)
 *   - reachable product URL
 *
 * Env:
 *   CREEM_API_KEY   — live or test key (creem_ / creem_test_); checkout disabled until set
 *   CREEM_TEST_MODE — "1" to use test-api.creem.io (default 1 until Kane flips it)
 */

const SUPPORT_EMAIL = "support@aipps.vip";
const UPTIME = "2026-08";

const TOOLS = [
  {
    name: "api-mint",
    url: "https://api.aipps.vip",
    tag: "Free utility APIs",
    desc: "Timezone, forex, crypto prices and page metadata — JSON APIs with full CORS, no key, no limits. Built for developers who hate adding dependencies.",
    keywords: "free api, timezone api, currency api, crypto price api",
  },
  {
    name: "qr-mint",
    url: "https://qr.aipps.vip",
    tag: "Free QR code generator",
    desc: "Generate PNG/SVG QR codes in the browser. Every QR gets a permanent shareable page. No login, no watermark, no expiry.",
    keywords: "free qr code generator, no login, no watermark",
  },
  {
    name: "short-mint",
    url: "https://short.aipps.vip",
    tag: "Free URL shortener",
    desc: "Shorten any URL with real click statistics, a free REST API, and links that never expire. No account required.",
    keywords: "free url shortener, no account, click stats",
  },
];

const PRODUCT = {
  id: "aipps-cluster-boilerplate",
  name: "aipps-cluster — CF Workers SEO Tool Boilerplate",
  price: "$29",
  priceCents: 2900,
  currency: "USD",
  desc: "The exact production codebase behind the aipps free-tool cluster: Cloudflare Workers (free tier, $0 infra) landing pages, programmatic SEO sitemaps, KV rate limiting, Durable Object counters, wrangler deploy scripts and the daily-ops automation. Deploy your own free tool in a weekend.",
  includes: [
    "3 production Workers (API, QR, URL shortener) — full source, no obfuscation",
    "Landing page system: zero-dep HTML, SEO meta, sitemap.xml, robots.txt",
    "Programmatic SEO page pattern (qr-mint /q/ pages) with templates",
    "KV rate limiting + Durable Object click counters (sqlite DO model, 2026-ready)",
    "SSRF-safe URL validation (private/loopback/link-local/metadata blocked)",
    "wrangler.toml + one-command deploy.sh + cron-based daily ops playbook",
    "CLUSTER-ROADMAP: keyword selection, cross-linking, directory-submission strategy",
    "License: single developer, personal projects. Not for resale.",
  ],
};

/* ---------------- helpers ---------------- */
function htmlPage(title, desc, body, extraHead = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="https://aipps.vip${body ? "" : ""}">
${extraHead}
<style>
:root{
  --bg:#0a0a0b; --panel:#121214; --line:#26262a; --ink:#f2f0ea; --dim:#8b8b92;
  --gold:#ffb81c; --gold-dim:#8a6a1c;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  background:var(--bg);color:var(--ink);
  font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  background-image:radial-gradient(circle, #1c1c1f 1px, transparent 1px);
  background-size:24px 24px;
}
.wrap{max-width:980px;margin:0 auto;padding:0 20px}
a{color:var(--gold);text-decoration:none}
a:hover{text-decoration:underline}
.mono{font-family:var(--mono)}
header{border-bottom:1px solid var(--line);background:rgba(10,10,11,.92);backdrop-filter:blur(4px);position:sticky;top:0;z-index:9}
.bar{display:flex;align-items:center;gap:18px;height:56px}
.brand{font-family:var(--mono);font-weight:700;letter-spacing:.04em;color:var(--ink);font-size:15px}
.brand b{color:var(--gold)}
nav{display:flex;gap:16px;margin-left:auto;font-size:13.5px}
nav a{color:var(--dim)}
nav a:hover{color:var(--gold);text-decoration:none}
.hero{padding:72px 0 48px}
.kicker{font-family:var(--mono);color:var(--gold);font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:18px}
h1{font-size:44px;line-height:1.12;letter-spacing:-.01em;font-weight:800;max-width:760px}
h1 em{font-style:normal;color:var(--gold)}
.sub{margin-top:18px;font-size:17px;color:var(--dim);max-width:640px}
.btnrow{margin-top:30px;display:flex;gap:12px;flex-wrap:wrap}
.btn{display:inline-block;padding:11px 20px;border:1px solid var(--gold);background:var(--gold);color:#0a0a0b;font-weight:700;font-size:14.5px}
.btn:hover{text-decoration:none;filter:brightness(1.08)}
.btn.ghost{background:transparent;color:var(--gold)}
section{padding:44px 0;border-top:1px solid var(--line)}
h2{font-size:26px;letter-spacing:-.01em;margin-bottom:6px}
.lede{color:var(--dim);font-size:15px;margin-bottom:26px;max-width:680px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.card{border:1px solid var(--line);background:var(--panel);padding:22px}
.card h3{font-size:17px;font-family:var(--mono);margin-bottom:4px}
.card .tag{font-family:var(--mono);font-size:11.5px;color:var(--gold);letter-spacing:.06em;text-transform:uppercase}
.card p{margin-top:10px;font-size:14px;color:var(--dim)}
.card .go{display:inline-block;margin-top:14px;font-family:var(--mono);font-size:13px}
.free{color:var(--gold);font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:24px}
.pricebox{border:1px solid var(--gold-dim);background:linear-gradient(180deg,#16130a,#121214);padding:30px}
.pricebox .row{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.pricebox .amt{font-family:var(--mono);font-size:44px;font-weight:800;color:var(--gold)}
.pricebox .per{font-size:13px;color:var(--dim)}
.pricebox p{margin-top:14px;color:var(--dim);font-size:15px;max-width:640px}
ul.inc{margin-top:18px;list-style:none}
ul.inc li{padding:7px 0 7px 26px;position:relative;font-size:14.5px;border-bottom:1px dashed #1e1e22}
ul.inc li:before{content:"▸";position:absolute;left:4px;color:var(--gold)}
.legal{font-size:13.5px;color:var(--dim)}
.legal h3{font-family:var(--mono);font-size:15px;color:var(--ink);margin:22px 0 8px}
.legal p,.legal li{max-width:720px}
.legal ol,.legal ul{padding-left:22px}
footer{border-top:1px solid var(--line);padding:34px 0 44px;margin-top:20px}
footer .cols{display:flex;gap:40px;flex-wrap:wrap;justify-content:space-between}
footer .f{font-family:var(--mono);font-size:12.5px;color:var(--dim);line-height:1.9}
footer .f b{color:var(--ink);font-size:13px}
footer .f a{color:var(--dim)}
footer .f a:hover{color:var(--gold)}
.badge{display:inline-block;font-family:var(--mono);font-size:11px;letter-spacing:.1em;color:var(--gold);border:1px solid var(--gold-dim);padding:3px 8px;margin-bottom:16px}
</style>
</head>
<body>
<header><div class="wrap bar">
  <span class="brand">aipps<b>.vip</b></span>
  <nav>
    <a href="#tools">Free tools</a>
    <a href="#boilerplate">Boilerplate</a>
    <a href="/pricing">Pricing</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </nav>
</div></header>
${body}
<footer><div class="wrap">
  <div class="cols">
    <div class="f">
      <b>Free tools</b><br>
      <a href="https://api.aipps.vip" target="_blank" rel="noopener">api-mint</a> ·
      <a href="https://qr.aipps.vip" target="_blank" rel="noopener">qr-mint</a> ·
      <a href="https://short.aipps.vip" target="_blank" rel="noopener">short-mint</a>
    </div>
    <div class="f">
      <b>Company</b><br>
      <a href="/pricing">Pricing</a><br>
      <a href="/privacy">Privacy Policy</a><br>
      <a href="/terms">Terms of Service</a>
    </div>
    <div class="f">
      <b>Support</b><br>
      ${SUPPORT_EMAIL}<br>
      Response within 3 business days
    </div>
  </div>
</div></footer>
</body>
</html>`;
}

function homeBody() {
  const tools = TOOLS.map((t) => `
  <div class="card">
    <span class="tag">${t.tag}</span>
    <h3>${t.name}</h3>
    <p>${t.desc}</p>
    <span class="go"><a href="${t.url}" target="_blank" rel="noopener">${t.url.replace("https://", "")} →</a></span>
  </div>`).join("");
  return `
<div class="wrap hero">
  <div class="kicker">Free tools · Zero ads · No tracking</div>
  <h1>Free developer tools that <em>never expire</em>.</h1>
  <p class="sub">Three production utilities running on the Cloudflare Workers free tier — no accounts, no rate-limit paywalls, no 30-day expiring links. Below them: the exact boilerplate we use to build them, for sale.</p>
  <div class="btnrow">
    <a class="btn" href="#tools">Try the free tools</a>
    <a class="btn ghost" href="#boilerplate">Get the boilerplate</a>
  </div>
</div>
<section id="tools"><div class="wrap">
  <div class="free">Free forever</div>
  <h2>The cluster</h2>
  <p class="lede">Every tool is a single Cloudflare Worker. No dependencies, no cold starts, no database to babysit. Use them directly or through the APIs.</p>
  <div class="grid">${tools}</div>
</div></section>
<section id="boilerplate"><div class="wrap">
  <div class="pricebox">
    <div class="badge">One-time purchase</div>
    <div class="row">
      <span class="amt">${PRODUCT.price}</span>
      <span class="per">once · lifetime updates · single developer license</span>
    </div>
    <p><strong style="color:var(--ink)">${PRODUCT.name}</strong> — ${PRODUCT.desc}</p>
    <ul class="inc">${PRODUCT.includes.map((i) => `<li>${i}</li>`).join("")}</ul>
    <div class="btnrow">
      <a class="btn" href="/buy">Buy the boilerplate</a>
      <a class="btn ghost" href="mailto:${SUPPORT_EMAIL}?subject=Boilerplate%20question">Questions? Email us</a>
    </div>
    <p style="margin-top:16px;font-size:13px">Checkout is handled by <a href="https://creem.io" target="_blank" rel="noopener">Creem</a> (merchant of record — they handle global sales tax). We never see your card details.</p>
  </div>
</div></section>
<section><div class="wrap">
  <h2>Why it's all free</h2>
  <p class="lede" style="margin-bottom:0">The tools are the demo. They prove the architecture works in production — and the boilerplate is how you get the same setup for your own project. We earn on the shovel, not the gold.</p>
</div></section>`;
}

function buyBody() {
  return `
<div class="wrap hero">
  <div class="badge">One-time purchase · lifetime updates</div>
  <h1 style="font-size:36px">${PRODUCT.name}</h1>
  <p class="sub">${PRODUCT.desc}</p>
</div>
<section><div class="wrap">
  <div class="pricebox">
    <div class="row"><span class="amt">${PRODUCT.price}</span><span class="per">USD, one-time · tax calculated at checkout by Creem</span></div>
    <ul class="inc">${PRODUCT.includes.map((i) => `<li>${i}</li>`).join("")}</ul>
    <div class="btnrow">
      <button class="btn" id="buyBtn" onclick="buy()">Buy for ${PRODUCT.price}</button>
    </div>
    <p style="font-size:13px;margin-top:14px" id="buyMsg"></p>
    <script>
    async function buy(){
      var b=document.getElementById('buyBtn'),m=document.getElementById('buyMsg');
      b.disabled=true;b.textContent='Creating checkout…';
      try{
        var r=await fetch('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({product:'${PRODUCT.id}'})});
        var j=await r.json();
        if(r.ok&&j.checkout_url){window.location.href=j.checkout_url;}
        else{m.textContent=(j.error||'Checkout not ready yet. Email us: ${SUPPORT_EMAIL}');b.disabled=false;b.textContent='Buy for ${PRODUCT.price}';}
      }catch(e){m.textContent='Network error — try again.';b.disabled=false;b.textContent='Buy for ${PRODUCT.price}';}
    }
    </script>
  </div>
</div></section>
<section><div class="wrap legal">
  <h2>What you get</h2>
  <p>Immediate delivery: after payment, the download link appears in your confirmation email and in the Creem customer portal. Delivery is fully automated — no waiting for a human.</p>
  <h2>Refunds</h2>
  <p>Digital goods: refund requests go to ${SUPPORT_EMAIL} and are handled within 3 business days.</p>
</div></section>`;
}

function pricingBody() {
  const rows = TOOLS.map((t) => `<tr><td class="mono">${t.name}</td><td>${t.tag}</td><td>Free forever</td><td>No key, no limits, no account</td></tr>`).join("");
  return `
<div class="wrap hero">
  <div class="kicker">Pricing</div>
  <h1 style="font-size:36px">Simple, visible pricing.</h1>
  <p class="sub">Tools are free. The boilerplate is a one-time purchase. No subscriptions, no hidden tiers.</p>
</div>
<section><div class="wrap">
  <table style="width:100%;border-collapse:collapse;font-size:14.5px">
    <tr style="border-bottom:1px solid var(--gold-dim);text-align:left">
      <th style="padding:10px 12px;font-family:var(--mono)">Product</th>
      <th style="padding:10px 12px;font-family:var(--mono)">What it is</th>
      <th style="padding:10px 12px;font-family:var(--mono)">Price</th>
      <th style="padding:10px 12px;font-family:var(--mono)">Notes</th>
    </tr>
    ${rows}
    <tr style="border-bottom:1px solid var(--line);background:#141210">
      <td class="mono" style="padding:10px 12px">${PRODUCT.name.split("—")[0].trim()}</td>
      <td style="padding:10px 12px">CF Workers SEO tool boilerplate (full source)</td>
      <td style="padding:10px 12px"><span class="mono" style="color:var(--gold);font-weight:700">${PRODUCT.price} one-time</span></td>
      <td style="padding:10px 12px">Lifetime updates, single developer license</td>
    </tr>
  </table>
  <p class="lede" style="margin-top:22px;margin-bottom:0">All prices in USD. Sales tax (VAT/GST) is calculated and remitted by our merchant of record, <a href="https://creem.io" target="_blank" rel="noopener">Creem</a>, based on your location — the amount you see at checkout is the final amount.</p>
</div></section>
<section><div class="wrap">
  <h2>Buy the boilerplate</h2>
  <p class="lede"><a class="btn" href="/buy">Go to checkout → ${PRODUCT.price}</a></p>
</div></section>`;
}

function legalPage(kind) {
  const isPrivacy = kind === "privacy";
  return `
<div class="wrap hero">
  <div class="kicker">Legal</div>
  <h1 style="font-size:34px">${isPrivacy ? "Privacy Policy" : "Terms of Service"}</h1>
  <p class="sub">Last updated: 2026-08-31 · aipps.vip and its subdomains (api.aipps.vip, qr.aipps.vip, short.aipps.vip)</p>
</div>
<section><div class="wrap legal">
${isPrivacy ? `
  <h3>1. What we collect</h3>
  <ol>
    <li><strong>Free tools (api-mint, qr-mint, short-mint):</strong> no accounts, no personal data, no cookies. QR content and shortened URLs you submit are processed on the edge to produce the QR image or redirect and are not used for anything else. Short-mint stores the mapping between a short code and your target URL so the link keeps working; the code is unguessable (32-char, 58-alphabet) and not published in any index of user content.</li>
    <li><strong>Server logs:</strong> our infrastructure provider (Cloudflare) may keep standard access logs (IP, timestamp, request line) for abuse prevention and security. These are retained per Cloudflare's own policy.</li>
    <li><strong>Purchases (boilerplate):</strong> payment processing, invoicing and delivery are handled by our merchant of record, Creem (creem.io). Your name, email and payment details go to Creem's systems under <a href="https://creem.io/privacy" target="_blank" rel="noopener">Creem's privacy policy</a>; we only receive the delivery information needed to send your download.</li>
  </ol>
  <h3>2. What we don't do</h3>
  <ol start="4">
    <li>No advertising, no third-party analytics, no trackers, no selling of data.</li>
    <li>No cross-site tracking. Each tool is a plain Worker that answers a request and forgets it.</li>
  </ol>
  <h3>3. Rate limiting & abuse</h3>
  <p>IP-based rate limits may apply to free tools. Repeated abusive use (SSRF attempts, scraping at attack volumes) may result in IP blocks.</p>
  <h3>4. Contact</h3>
  <p>Privacy questions: ${SUPPORT_EMAIL}</p>` : `
  <h3>1. The service</h3>
  <p>aipps.vip provides free developer utilities (api-mint, qr-mint, short-mint) and sells one digital product: the aipps-cluster boilerplate (a code package with documentation).</p>
  <h3>2. Free tools</h3>
  <ol>
    <li>Provided "as is", without warranty of any kind. We do not guarantee availability or specific performance.</li>
    <li>You may use outputs (QR images, short links, API responses) for any lawful purpose.</li>
    <li>Free tools may change or be discontinued at any time; short links are permanent while the service operates.</li>
  </ol>
  <h3>3. Boilerplate license</h3>
  <ol start="4">
    <li>One purchase = one developer, for personal projects. Deploying multiple products from the codebase is fine; reselling the boilerplate itself (or re-licensing it, including as "PLR") is not.</li>
    <li>Lifetime updates: you can re-download new versions for as long as we host the product.</li>
    <li>Refund requests: email ${SUPPORT_EMAIL}, answered within 3 business days.</li>
  </ol>
  <h3>4. Acceptable use</h3>
  <p>Don't use our services to send spam, host malicious content, perform SSRF/attack probing, or violate law. We block and refuse refunds in those cases.</p>
  <h3>5. Limitation of liability</h3>
  <p>To the maximum extent permitted by law, our total liability is limited to the amount you paid us (US$29 for the boilerplate; zero for free tools).</p>
  <h3>6. Changes & contact</h3>
  <p>We may update these terms; continued use means acceptance. Questions: ${SUPPORT_EMAIL}</p>`}
</div></section>`;
}

/* ---------------- worker ---------------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // API: create a Creem checkout session
    if (path === "/api/checkout" && request.method === "POST") {
      const key = env.CREEM_API_KEY;
      if (!key) {
        return Response.json({ error: "Checkout coming soon — email " + SUPPORT_EMAIL + " for early access." }, { status: 503, headers: cors });
      }
      let body;
      try { body = await request.json(); } catch { return Response.json({ error: "invalid json" }, { status: 400, headers: cors }); }
      const product = (body && body.product) || PRODUCT.id;
      if (product !== PRODUCT.id) return Response.json({ error: "unknown product" }, { status: 400, headers: cors });
      const test = env.CREEM_TEST_MODE === "1" || key.startsWith("creem_test_");
      const base = test ? "https://test-api.creem.io" : "https://api.creem.io";
      try {
        // Product is created in the dashboard (or via /v1/products); we reference it by
        // env.CREEM_PRODUCT_ID (set after Kane creates the product). Fallback: search by name.
        let productId = env.CREEM_PRODUCT_ID;
        if (!productId) {
          const sr = await fetch(`${base}/v1/products/search?limit=5`, { headers: { "x-api-key": key } });
          const sj = await sr.json();
          const hit = (sj.products || sj.data || []).find((p) => p.name && p.name.includes("boilerplate"));
          if (hit) productId = hit.id;
        }
        if (!productId) return Response.json({ error: "Product not configured yet" }, { status: 503, headers: cors });
        const cr = await fetch(`${base}/v1/checkouts`, {
          method: "POST",
          headers: { "x-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            success_url: "https://aipps.vip/thank-you",
            customer: body.email ? { email: String(body.email).slice(0, 254) } : undefined,
          }),
        });
        const cj = await cr.json();
        if (!cr.ok) return Response.json({ error: cj.message || cj.error || "checkout failed", detail: cj }, { status: cr.status, headers: cors });
        return Response.json({ checkout_url: cj.checkout_url || cj.checkoutUrl }, { headers: cors });
      } catch (e) {
        return Response.json({ error: "checkout backend error" }, { status: 502, headers: cors });
      }
    }

    // ---- pages ----
    if (request.method === "GET") {
      if (path === "/health") return Response.json({ ok: true, service: "aipps-store", uptime: UPTIME, checkout: env.CREEM_API_KEY ? "enabled" : "pending" }, { headers: cors });
      if (path === "/robots.txt") {
        return new Response("User-agent: *\nAllow: /\n\nSitemap: https://aipps.vip/sitemap.xml\n", { headers: { "content-type": "text/plain", ...cors } });
      }
      if (path === "/sitemap.xml") {
        const urls = ["/", "/pricing", "/buy", "/privacy", "/terms"].map((p) => `  <url><loc>https://aipps.vip${p}</loc><lastmod>2026-08-31</lastmod></url>`).join("\n");
        return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { headers: { "content-type": "application/xml", ...cors } });
      }
      if (path === "/") {
        const desc = "Free developer tools that never expire: utility APIs (api-mint), QR code generator (qr-mint), URL shortener with click stats (short-mint). Plus the CF Workers boilerplate.";
        return new Response(htmlPage("aipps.vip — free developer tools + the boilerplate behind them", desc, homeBody()), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", ...cors } });
      }
      if (path === "/buy") {
        return new Response(htmlPage(`Buy the ${PRODUCT.name.split("—")[0].trim()} — ${PRODUCT.price}`, `One-time ${PRODUCT.price}. The Cloudflare Workers SEO tool boilerplate behind aipps: full source, SEO pages, rate limiting, DO counters, deploy scripts.`, buyBody()), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", ...cors } });
      }
      if (path === "/pricing") {
        return new Response(htmlPage("Pricing — aipps.vip", "Free tools, no hidden tiers. Boilerplate: $29 one-time, lifetime updates.", pricingBody()), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", ...cors } });
      }
      if (path === "/privacy") {
        return new Response(htmlPage("Privacy Policy — aipps.vip", "What aipps collects: almost nothing. No accounts, no ads, no trackers.", legalPage("privacy")), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", ...cors } });
      }
      if (path === "/terms") {
        return new Response(htmlPage("Terms of Service — aipps.vip", "Terms for the aipps free tools and the boilerplate license.", legalPage("terms")), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", ...cors } });
      }
      if (path === "/thank-you") {
        return new Response(htmlPage("Thank you — aipps.vip", "Your purchase is confirmed.", `
<div class="wrap hero">
  <div class="kicker">Payment complete</div>
  <h1 style="font-size:36px">Thanks for buying 🎉</h1>
  <p class="sub">Your download link is in the confirmation email from Creem. You can always find it again in the <a href="https://creem.io/dashboard" target="_blank" rel="noopener">Creem customer portal</a>.</p>
  <p class="sub">Anything missing or broken? Email ${SUPPORT_EMAIL} — we answer within 3 business days.</p>
</div>`), { headers: { "content-type": "text/html; charset=utf-8", ...cors } });
      }
    }

    return new Response(JSON.stringify({ error: "not found", paths: ["/", "/buy", "/pricing", "/privacy", "/terms", "/api/checkout"] }), {
      status: 404,
      headers: { "content-type": "application/json", ...cors },
    });
  },
};
