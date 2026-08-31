# short-mint

aipps 集群第三个成员 — 免费短链服务，Cloudflare Workers 免费层，$0 基础设施。

**定位**：集群里流量/导流最强的产品。每条短链自带病毒传播（被分享=被广告），
"free url shortener" 是全球前 20 的 free tool 关键词，竞品（Bitly/TinyURL/Dub）
统计功能锁账号/付费墙，我们全免费。

## 差异化

| 能力 | short-mint | Bitly / Dub / TinyURL |
|---|---|---|
| 账号 | 永不 | 统计需要账号 |
| 链接有效期 | 永久（KV 无 TTL，无管理端） | 试用 7–30 天 |
| 点击统计 | 真计数（DO 原子，非采样非 JS） | 付费墙 |
| API | 免费、全 CORS、无 key | 限额度 |
| 跳转 | 干净 302，无 interstitial 广告 | 有 |

## 架构

- 单 Worker（ES module），无外部依赖
- `env.LINKS`（KV）：`code -> {u: target, t: createdMs}`，永久无 TTL
- `env.STATS`（Durable Object，sqlite 存储）：per-code 原子点击计数器
  - 免费层 10 万次状态操作/月 → 日均 ~3300 次点击/链接都不超
  - 注意：2026 起 CF 不再允许新建 KV-backed DO，必须 `[exports.X] type="durable-object" storage="sqlite"`
  - 调用方式：`env.STATS.get(env.STATS.idFromName(name)).method()`
- 限流 30 shorten/min/IP（KV，跳数有限，实际窗口可能 ~2 倍——同 qr-mint 已知问题）
- 目标 URL 校验：http/https only、禁私网/环回/链路本地/元数据 IP、禁凭据、
  禁 IPv6 字面量、要求完整域名（至少一个点，挡单标签内网名）
- cron 18:00 UTC：重数链接总数 → `meta:summary`（落地页展示）

## 端点

| Endpoint | 说明 |
|---|---|
| `POST /api/shorten` body `{"url":"https://…"}` | 创建短链 → `{code, short_url, stats_url}` |
| `GET /api/shorten?url=…` | 同上（浏览器/curl 友好） |
| `GET /{code}` | 302 → 目标，+1 点击 |
| `GET /api/stats/{code}` | `{code, url, clicks, created, short_url}` |
| `GET /` | 落地页（生成器 + 活 demo + API 文档 + FAQ，SEO） |
| `GET /health` / `/robots.txt` / `/sitemap.xml` | ops |

## 开发

```bash
# 复用 api-mint 的 wrangler/workerd
npx --prefix /home/kane/projects/api-mint wrangler dev --local --port 8893
curl -X POST localhost:8893/api/shorten -H 'content-type: application/json' -d '{"url":"https://aipps.vip"}'
```

## 部署

```bash
bash deploy.sh   # 需要 ~/.wrangler/.env
```

域名 `short.aipps.vip/*` 待 Kane 在 dashboard 加 route（同 api/qr 两个）。

## 推广

- 落地页关键词覆盖：free url shortener / no account / no expiry / click stats / bitly alternative
- 集群互链：footer 指向 api-mint、qr-mint；api/qr 落地页反向指向本服务
- 目录投稿：Free-for-developers、AlternativeTo（bitly alternatives）、Product Hunt（时机看流量）
