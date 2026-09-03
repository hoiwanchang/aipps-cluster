#!/usr/bin/env bash
# daily ops check: short-mint via proxy + proxy sanity
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
P="http://127.0.0.1:7890"
URL="https://short.aipps.vip"

echo "=== proxy sanity (api.aipps.vip via proxy) ==="
curl -s -x "$P" -A "$UA" -o /dev/null -w "%{http_code} %{time_total}s\n" --max-time 20 https://api.aipps.vip/health

echo "=== short-mint /health ==="
curl -s -x "$P" -A "$UA" -o /tmp/short_health.json -w "%{http_code} %{time_total}s\n" --max-time 25 "$URL/health"
cat /tmp/short_health.json; echo

echo "=== short-mint /api/stats/demo ==="
curl -s -x "$P" -A "$UA" -o /tmp/short_demo.json -w "%{http_code} %{content_type}\n" --max-time 25 "$URL/api/stats/demo"
cat /tmp/short_demo.json; echo

echo "=== short-mint / ==="
curl -s -x "$P" -A "$UA" -o /dev/null -w "%{http_code}\n" --max-time 25 "$URL/"
