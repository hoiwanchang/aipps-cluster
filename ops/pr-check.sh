#!/usr/bin/env bash
# GitHub PR #7151 status check (public-apis/public-apis)
set -u
TOKEN_FILE="$HOME/.git-credentials"
TOKEN=""
if [ -f "$TOKEN_FILE" ]; then
  TOKEN=$(grep -oE 'https://[A-Za-z0-9._-]+:[A-Za-z0-9_>-]+@github\.com' "$TOKEN_FILE" | head -1 | sed -E 's#https://[^:]+:([^@]+)@.*#\1#')
fi
if [ -z "$TOKEN" ]; then
  echo "NO_TOKEN"
  exit 2
fi
curl -s -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  -o /tmp/pr7151.json -w "HTTP %{http_code}\n" \
  https://api.github.com/repos/public-apis/public-apis/pulls/7151
python3 - <<'PY'
import json
d = json.load(open('/tmp/pr7151.json'))
keys = ["number","title","state","merged","merged_at","draft","user","labels","body"]
out = {}
for k in keys:
    v = d.get(k)
    if k == "user" and isinstance(v, dict):
        v = v.get("login")
    if k == "labels" and isinstance(v, list):
        v = [l.get("name") for l in v]
    if k == "body" and isinstance(v, str):
        v = v[:500]
    out[k] = v
print(json.dumps(out, ensure_ascii=False, indent=1))
PY
