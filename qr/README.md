# qr-mint

**Free QR code generator on Cloudflare Workers — no login, no watermark, no ads.**

Part of the aipps.vip cluster (with [api-mint](https://api.aipps.vip) free utility APIs).

Live: https://qr.aipps.vip

## Why it exists
"QR code generator" is one of the highest-volume search intents on the internet.
Most generators require login, add watermarks, or lock custom colors/exports
behind a paywall. qr-mint gives everything free at the edge:

- PNG (any size up to 2048px) and vector SVG downloads
- custom colors, margin, size
- **permanent shareable page per QR** (`/q/{data}`) — programmatic SEO surface
- JSON API for embedding in other tools
- zero server-side dependencies: `qrcode.js` (MIT) + `pako` (MIT) are bundled,
  QR generation happens at the edge in <10ms, no upstream APIs to break

## Endpoints
| Endpoint | Description |
|---|---|
| `/` | landing + generator (SEO HTML) |
| `/g?data=…&size=512&margin=4&fg=%23000000` | result page with downloads |
| `/q/{base64url}` | permanent public page for one QR |
| `/svg?data=…` or `/svg/{base64url}` | raw SVG |
| `/png?data=…&size=1024` or `/png/{base64url}` | raw PNG (64–2048px) |
| `/api/qr/{base64url}` | JSON: svg/png/page/generator URLs |
| `/health` `/pricing` `/sitemap.xml` `/robots.txt` | ops |

## Data encoding
`{base64url}` = base64url (no padding) of the UTF-8 payload.
Wi-Fi payload example: `WIFI:T:WPA;S:my-ssid;P:pass123;;`

## Self-host
```bash
# 1. build (bundles the UMD libs into src/index.js)
node src/build.js
# 2. deploy (needs CLOUDFLARE_API_TOKEN + account with Workers + KV)
npx wrangler deploy
```
Rate limit: 60 QR/min/IP via KV.

## Limits & notes
- KV read-after-write is eventually consistent (~60s), so the effective
  in-window limit can be ~2× nominal. Fine as a cost guardrail (generation is
  free-tier CPU only); upgrade to Durable Objects if abuse appears.
- Max payload 2000 chars. Error correction auto-falls back M→Q→H.

## License
MIT. `qrcode.js` (c) Kazuhiko Arase, MIT. `pako` (c) Andriy Sasha, MIT AND Zlib.
