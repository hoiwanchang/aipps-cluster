#!/usr/bin/env bash
# aipps-store deploy (one command):
#   1. sync .dev.vars from ../ops/creem.env (gitignored) — for local `wrangler dev`
#   2. wrangler deploy — code + routes (www.aipps.vip/*)
#   3. CF REST PUT secrets (type=secret_text) — production CREEM_API_KEY etc.
#      (wrangler 4.127 `secret put` breaks in non-TTY; REST is reliable)
# NOTE: CREEM_* must NOT also appear in wrangler.toml [vars] — empty vars block the secrets.
set -euo pipefail
cd "$(dirname "$0")"
set -a
source ~/.wrangler/.env
source ../ops/creem.env
set +a
: "${CLOUDFLARE_API_TOKEN:*** token not loaded from ~/.wrangler/.env}"
: "${CREEM_API_KEY:?ops/creem.env missing CREEM_API_KEY}"
: "${CREEM_PRODUCT_ID:?ops/creem.env missing CREEM_PRODUCT_ID}"
CREEM_TEST_MODE="${CREEM_TEST_MODE:-0}"

grep -E '^CREEM_' ../ops/creem.env > .dev.vars
chmod 600 .dev.vars

npx --prefix ~/projects/api-mint wrangler deploy

API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/aipps-store/secrets"
H=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json")
put_secret() {
  curl -sS -X PUT "${H[@]}" \
    -d "$(python3 -c 'import json,sys;print(json.dumps({"name":sys.argv[1],"text":sys.argv[2],"type":"secret_text"}))' "$1" "$2")" \
    "$API" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('success') else 1)" \
    || { echo "secret put $1 FAILED"; exit 1; }
  echo "secret $1 -> OK"
}
put_secret CREEM_API_KEY "$CREEM_API_KEY"
put_secret CREEM_PRODUCT_ID "$CREEM_PRODUCT_ID"
put_secret CREEM_TEST_MODE "$CREEM_TEST_MODE"
echo "deploy complete: https://www.aipps.vip"
