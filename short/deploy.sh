#!/usr/bin/env bash
# short-mint 一键部署
set -euo pipefail
cd "$(dirname "$0")"
[ -f ~/.wrangler/.env ] || { echo "缺少 ~/.wrangler/.env"; exit 1; }
set -a; source ~/.wrangler/.env; set +a
npx --prefix /home/kane/projects/api-mint wrangler deploy
sleep 5
echo "--- 线上验证 ---"
curl -s -m 15 https://short.aipps.vip/health || true
echo ""
echo "部署完成 ✅（域名 short.aipps.vip 需 Kane 在 dashboard 加 route 后生效）"
