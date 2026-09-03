/* api-mint cluster · qr-mint
 * Free QR code generator on Cloudflare Workers.
 * Zero upstream dependencies — qrcode.js (Kazuhiko Arase, MIT) + pako (MIT) are
 * bundled by build.js ahead of this file. self.qrcode / self.pako are set by
 * the UMD wrappers.
 *
 * Routes:
 *   GET /                landing + generator form (SEO HTML)
 *   GET /g?data=&size=&margin=&fg=&bg=   result page (inline SVG + downloads)
 *   GET /q/{base64url}   permanent public page for one QR (programmatic SEO)
 *   GET /svg?data=...    raw SVG (or /svg/{base64url})
 *   GET /png?data=...    raw PNG (or /png/{base64url})
 *   GET /api/qr/{enc}    JSON API
 *   GET /health /pricing /sitemap.xml /robots.txt
 *
 * Rate limit: 60 gen/min/IP via KV (string get + parseInt, workerd-safe).
 */

const RATE_LIMIT = 60;
const RATE_WINDOW = 60;

function enc(s) {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function dec(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return decodeURIComponent(escape(atob(s)));
}

/* ---------------- PNG encoder (RGB, filter 0) ---------------- */
let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function pngChunk(type, data) {
  const t = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  out[0] = (data.length >>> 24) & 0xff;
  out[1] = (data.length >>> 16) & 0xff;
  out[2] = (data.length >>> 8) & 0xff;
  out[3] = data.length & 0xff;
  out.set(t, 4);
  out.set(data, 8);
  const c = crc32(out.subarray(4, 8 + data.length));
  out[8 + data.length] = (c >>> 24) & 0xff;
  out[9 + data.length] = (c >>> 16) & 0xff;
  out[10 + data.length] = (c >>> 8) & 0xff;
  out[11 + data.length] = c & 0xff;
  return out;
}
function hexToRgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function makeQR(data) {
  let qr = null;
  // try error correction levels until it fits
  for (const ecl of ["M", "Q", "H"]) {
    try {
      qr = qrcode(0, ecl);
      qr.addData(data);
      qr.make();
      return qr;
    } catch (e) {
      // data too big for this config — retry with next
    }
  }
  const qr2 = qrcode(0, "M");
  qr2.addData(data);
  qr2.make();
  return qr2;
}
function encodePng(data, sizePx, marginCells, fgHex, bgHex) {
  const qr = makeQR(data);
  const n = qr.getModuleCount();
  const margin = marginCells >= 0 ? marginCells : 4;
  const totalCells = n + margin * 2;
  const cell = Math.max(1, Math.floor(sizePx / totalCells));
  const w = totalCells * cell;
  const fg = hexToRgb(fgHex || "#000000");
  const bg = hexToRgb(bgHex || "#ffffff");
  const raw = new Uint8Array(w * (1 + w * 3));
  for (let y = 0; y < w; y++) {
    const gy = Math.floor(y / cell) - margin;
    const rowOff = y * (1 + w * 3);
    raw[rowOff] = 0; // no filter
    for (let x = 0; x < w; x++) {
      const gx = Math.floor(x / cell) - margin;
      const dark = gx >= 0 && gy >= 0 && gx < n && gy < n && qr.isDark(gy, gx);
      const px = dark ? fg : bg;
      const o = rowOff + 1 + x * 3;
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2];
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, w);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor
  const idat = pako.deflate(raw, { level: 9 });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ih = pngChunk("IHDR", ihdr);
  const id = pngChunk("IDAT", new Uint8Array(idat));
  const ie = pngChunk("IEND", new Uint8Array(0));
  const total = sig.length + ih.length + id.length + ie.length;
  const out = new Uint8Array(total);
  let o = 0;
  out.set(sig, o); o += sig.length;
  out.set(ih, o); o += ih.length;
  out.set(id, o); o += id.length;
  out.set(ie, o); o += ie.length;
  return out;
}

/* ---------------- HTML pages ---------------- */
const SITE_NAME = "qr-mint";
const CLUSTER = `<footer class="foot">
  <span>aipps.vip — free utilities, no ads, no tracking</span>
  <a href="https://api.aipps.vip" target="_blank" rel="noopener">api-mint · free APIs</a>
  <a href="https://short.aipps.vip" target="_blank" rel="noopener">short-mint · free URL shortener</a>
  <a href="/health">status</a>
</footer>`;

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
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' fill='%230a0a0a'/><rect x='2' y='2' width='5' height='5' fill='%23FFB81C'/><rect x='9' y='2' width='5' height='5' fill='%23fff'/><rect x='2' y='9' width='5' height='5' fill='%23fff'/><rect x='9' y='9' width='3' height='3' fill='%23FFB81C'/><rect x='12' y='12' width='2' height='2' fill='%23fff'/></svg>">
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
input[type=text],select{width:100%;background:var(--bg);border:1px solid var(--line);color:var(--txt);
padding:10px 12px;font-family:inherit;font-size:14px}
input[type=text]:focus,select:focus{outline:none;border-color:var(--accent)}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
button{margin-top:18px;width:100%;background:var(--accent);color:#0a0a0a;border:none;
padding:12px;font-family:inherit;font-size:14px;font-weight:700;letter-spacing:2px;cursor:pointer}
button:hover{background:#ffc63d}
.qrbox{display:flex;flex-direction:column;align-items:center;gap:16px}
.qrbox .canvas{background:#fff;padding:12px;border:1px solid var(--line)}
.qrbox .canvas svg{display:block;width:min(280px,100%);height:auto}
.dl{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
.dl a{display:block;text-align:center;background:var(--bg);border:1px solid var(--accent);color:var(--accent);
padding:10px;font-size:13px;letter-spacing:1px;text-decoration:none}
.dl a:hover{background:var(--accent);color:#0a0a0a}
.meta{font-size:12px;color:var(--dim);line-height:1.8;word-break:break-all}
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
</style>
${extraHead}
</head>
<body><div class="wrap">
<header><div class="logo"></div><h1>QR<em>-MINT</em></h1><span class="tag">FREE · NO LOGIN · NO WATERMARK</span></header>
${body}
${CLUSTER}
</div></body>
</html>`;
}

function landingHtml(base) {
  const demo = svgImage(base || "https://aipps.vip", 280, 4, "#000000", "#ffffff");
  return pageShell(
    "qr-mint — free QR code generator, no login, no watermark",
    "Generate free QR codes online with no login and no watermark. Choose size, margin and colors, download as PNG or SVG. Free forever on Cloudflare.",
    `<div class="hero">
<div class="kicker">FREE QR CODE GENERATOR</div>
<h2>Mint a QR code.<br><span>Free. No login. No watermark.</span></h2>
<p>Point it at a URL, Wi-Fi string, vCard, payment info or plain text. Download as PNG (any size) or crisp SVG. Every QR gets a permanent shareable page. Runs on Cloudflare Workers — instant, no account, no ads.</p>
</div>
<div class="grid">
<div class="panel">
<label for="d">1 · WHAT SHOULD IT POINT TO?</label>
<input type="text" id="d" name="data" placeholder="https://your.site  (or any text)" value="">
<div class="row3">
<div><label for="sz">SIZE (PX)</label><select id="sz" name="size"><option>256</option><option selected>512</option><option>1024</option><option>2048</option></select></div>
<div><label for="mg">MARGIN</label><select id="mg" name="margin"><option>0</option><option>2</option><option selected>4</option><option>8</option></select></div>
<div><label for="fg">COLOR</label><select id="fg" name="fg"><option value="#000000">black</option><option value="#0a0a0a">charcoal</option><option value="#00356B">navy</option><option value="#FFB81C">amber</option></select></div>
</div>
<button type="submit" form="mintform">MINT IT →</button>
<div class="hint">Tip: Wi-Fi → <code>WIFI:T:WPA;S:network;P:password;;</code> · vCard → <code>BEGIN:VCARD...</code></div>
</div>
<div class="panel qrbox" style="justify-content:center">
<div class="canvas">${demo}</div>
<div class="hint">live demo — this is a real QR. scan it.<br>(points to ${base || "https://aipps.vip"})</div>
</div>
</div>
<h3 class="sec">WHY QR-MINT</h3>
<table>
<tr><th></th><th>qr-mint</th><th>typical QR sites</th></tr>
<tr><td>Login / account</td><td>none, ever</td><td>often required</td></tr>
<tr><td>Watermark</td><td>never</td><td>often</td></tr>
<tr><td>SVG download (print-ready)</td><td>yes</td><td>rare</td></tr>
<tr><td>Custom colors / margin / size</td><td>yes</td><td>paid tier</td></tr>
<tr><td>Permanent shareable page</td><td>yes</td><td>rare</td></tr>
<tr><td>Price</td><td>$0, free tier is generous</td><td>$–$$</td></tr>
</table>
<h3 class="sec">HOW IT WORKS</h3>
<table>
<tr><th>endpoint</th><th>what you get</th></tr>
<tr><td><code>GET /svg?data=…</code></td><td>raw SVG, embed anywhere</td></tr>
<tr><td><code>GET /png?data=…&amp;size=1024</code></td><td>raw PNG, any size up to 2048px</td></tr>
<tr><td><code>GET /q/…</code></td><td>permanent public page for one QR</td></tr>
<tr><td><code>GET /api/qr/…</code></td><td>JSON (svg url, png url, page url)</td></tr>
</table>
<form id="mintform" action="/g" method="get" style="display:none"><input type="hidden" name="data"><input type="hidden" name="size"><input type="hidden" name="margin"><input type="hidden" name="fg"></form>
<script>
(function(){
  var f=document.getElementById('mintform');
  f.onsubmit=function(e){
    e.preventDefault();
    var d=document.getElementById('d').value.trim();
    if(!d){d.focus();return;}
    window.location.href='/g?data='+encodeURIComponent(d)+'&size='+document.getElementById('sz').value
      +'&margin='+document.getElementById('mg').value+'&fg='+document.getElementById('fg').value;
  };
})();
</script>`
  );
}

function resultHtml(data, size, margin, fg, bg) {
  const e = enc(data);
  const short = data.length > 80 ? data.slice(0, 80) + "…" : data;
  const safeTitle = short.replace(/</g, "&lt;");
  return pageShell(
    `QR code for ${safeTitle} — free download PNG/SVG`,
    `Free QR code pointing to: ${short}. Download as PNG or SVG, or share this permanent page.`,
    `<div class="hero"><div class="kicker">YOUR QR CODE</div><h2>Minted.</h2></div>
<div class="grid">
<div class="panel qrbox">
<div class="canvas">${svgImage(data, 280, margin, fg, bg)}</div>
<div class="dl">
<a href="/png/${e}?size=${size}&margin=${margin}&fg=${encodeURIComponent(fg)}&bg=${encodeURIComponent(bg || "#ffffff")}" download>↓ PNG ${size}px</a>
<a href="/svg/${e}?margin=${margin}&fg=${encodeURIComponent(fg)}&bg=${encodeURIComponent(bg || "#ffffff")}" download>↓ SVG (vector)</a>
</div>
</div>
<div class="panel">
<label>POINTING TO</label>
<div class="meta">${short.replace(/</g, "&lt;")}</div>
<label>SHARE / SAVE THIS PAGE</label>
<div class="meta"><a class="plain" href="/q/${e}">/q/${e.slice(0, 44)}${e.length > 44 ? "…" : ""}</a><br>This exact QR lives at the URL above, forever. Copy it, put it in an email, print it.</div>
<label>SPEC</label>
<div class="meta">size ${size}px · margin ${margin} modules · color ${fg}<br>error correction: auto (M→Q→H)<br>no tracking · no upload · generated at the edge</div>
</div>
</div>
<h3 class="sec">MINT ANOTHER</h3>
<div class="panel"><a class="plain" href="/?data=${encodeURIComponent(data)}">← back to generator</a></div>`
  );
}

function psePage(data, size, margin, fg, bg) {
  // same as result page but framed for Google
  const short = data.length > 90 ? data.slice(0, 90) + "…" : data;
  const isUrl = /^https?:\/\//i.test(data);
  const subject = isUrl ? `QR code for ${short.replace(/&/g, "&amp;").replace(/</g, "&lt;")}` : `QR code containing: ${short.replace(/&/g, "&amp;").replace(/</g, "&lt;")}`;
  return resultHtml(data, size || 512, margin == null ? 4 : margin, fg || "#000000", bg || "#ffffff");
}

function svgImage(data, px, margin, fgHex, bgHex) {
  const qr = makeQR(data);
  const n = qr.getModuleCount();
  const m = margin == null ? 4 : margin;
  const total = n + m * 2;
  const cell = Math.max(1, Math.floor(px / total));
  const w = total * cell;
  const rects = [];
  const fg = fgHex || "#000000";
  const bg = bgHex || "#ffffff";
  rects.push(`<rect width="${w}" height="${w}" fill="${bg}"/>`);
  rects.push(`<g fill="${fg}">`);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.isDark(y, x))
        rects.push(`<rect x="${(x + m) * cell}" y="${(y + m) * cell}" width="${cell}" height="${cell}"/>`);
  rects.push(`</g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" shape-rendering="crispEdges" width="${px}" height="${px}">${rects.join("")}</svg>`;
}

function jsonBody(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  });
}

async function rateLimit(env, ip) {
  if (!env.RATE) return;
  const now = Date.now();
  const k = "rl:" + ip;
  const v = await env.RATE.get(k);
  const n = v ? parseInt(v, 10) : 0;
  if (n >= RATE_LIMIT) {
    await env.RATE.put(k, String(n), { expirationTtl: RATE_WINDOW });
    throw { status: 429, body: { error: "rate limit exceeded", limit: RATE_LIMIT, window_seconds: RATE_WINDOW } };
  }
  await env.RATE.put(k, String(n + 1), { expirationTtl: RATE_WINDOW });
}

/* sample permanent pages for the sitemap */
const SAMPLES = [
  "https://aipps.vip",
  "https://api.aipps.vip",
  "https://github.com",
  "https://vite.dev",
  "https://cloudflare.com",
  "WIFI:T:WPA;S:office-guest;P:change-me;;",
  "mailto:hello@example.com",
  "BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nTEL:+15551234567\nEND:VCARD",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const ip = request.headers.get("cf-connecting-ip") || "anon";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Content-Type",
        "access-control-max-age": "86400",
      }});
    }
    if (request.method !== "GET") return jsonBody({ error: "method not allowed" }, 405);

    // cheap routes
    if (path === "/health") return jsonBody({ ok: true, service: "qr-mint", uptime: "2026-08-31" });
    if (path === "/pricing") return jsonBody({
      free: { rate: "60 QR/min/IP", features: ["png up to 2048px", "svg", "custom color/margin/size", "permanent page"] },
      paid: "coming soon",
    });
    if (path === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (path === "/sitemap.xml") {
      const base = new URL("/", request.url).origin;
      const urls = ["/", ...SAMPLES.map((s) => "/q/" + enc(s))];
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join("\n") + `\n</urlset>`;
      return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
    }

    // everything below consumes rate limit
    let limited;
    try {
      await rateLimit(env, ip);
    } catch (e) {
      return jsonBody(e.body, e.status);
    }

    try {
      if (path === "/") {
        const accept = request.headers.get("accept") || "";
        if (accept.includes("application/json") && !accept.includes("text/html"))
          return jsonBody({ service: "qr-mint", base: new URL("/", request.url).origin, endpoints: ["/svg", "/png", "/q/{data}", "/api/qr/{data}"] });
        const origin = new URL("/", request.url).origin;
        return new Response(landingHtml(origin), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
      }

      const size = Math.min(2048, Math.max(64, parseInt(url.searchParams.get("size") || "512", 10) || 512));
      const margin = Math.min(16, Math.max(0, parseInt(url.searchParams.get("margin") ?? "4", 10) || 4));
      const fg = url.searchParams.get("fg") || "#000000";
      const bg = url.searchParams.get("bg") || "#ffffff";

      // raw images (query-string form)
      if (path === "/svg" || path === "/png") {
        const d = url.searchParams.get("data");
        if (!d) return jsonBody({ error: "missing data param" }, 400);
        if (d.length > 2000) return jsonBody({ error: "data too long (max 2000 chars)" }, 413);
        if (path === "/svg") {
          const svg = svgImage(d, size, margin, fg, bg);
          return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
        }
        const png = encodePng(d, size, margin, fg, bg);
        return new Response(png, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
      }

      // /svg/{enc} /png/{enc}
      const m2 = path.match(/^\/(svg|png)\/([A-Za-z0-9_-]+)$/);
      if (m2) {
        let d;
        try { d = dec(m2[2]); } catch (e) { return jsonBody({ error: "bad encoding" }, 400); }
        if (!d || d.length > 2000) return jsonBody({ error: "bad data" }, 400);
        if (m2[1] === "svg") {
          return new Response(svgImage(d, size, margin, fg, bg), { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
        }
        return new Response(encodePng(d, size, margin, fg, bg), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
      }

      // /g?data=... result page
      if (path === "/g") {
        const d = url.searchParams.get("data");
        if (!d || d.length > 2000) return jsonBody({ error: "missing or oversized data" }, 400);
        return new Response(resultHtml(d, size, margin, fg, bg), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
      }

      // /q/{enc} permanent page
      const m3 = path.match(/^\/q\/([A-Za-z0-9_-]+)$/);
      if (m3) {
        let d;
        try { d = dec(m3[1]); } catch (e) { return jsonBody({ error: "bad encoding" }, 400); }
        if (!d || d.length > 2000) return jsonBody({ error: "bad data" }, 400);
        return new Response(psePage(d, size, margin, fg, bg), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
      }

      // /api/qr/{enc} JSON
      const m4 = path.match(/^\/api\/qr\/([A-Za-z0-9_-]+)$/);
      if (m4) {
        let d;
        try { d = dec(m4[1]); } catch (e) { return jsonBody({ error: "bad encoding" }, 400); }
        if (!d || d.length > 2000) return jsonBody({ error: "bad data" }, 400);
        const base = new URL("/", request.url).origin;
        const e = enc(d);
        return jsonBody({
          data: d,
          svg: `${base}/svg/${e}?margin=${margin}&fg=${encodeURIComponent(fg)}`,
          png: `${base}/png/${e}?size=${size}&margin=${margin}&fg=${encodeURIComponent(fg)}`,
          page: `${base}/q/${e}`,
          generator: `${base}/?data=${encodeURIComponent(d)}`,
        });
      }

      return jsonBody({ error: "not found", hint: "see / for endpoints" }, 404);
    } catch (err) {
      console.error("qr-mint error", err);
      return jsonBody({ error: "internal error" }, 500);
    }
  },
};
