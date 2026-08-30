# aipps.cluster

Kane + Hermes（AI agent）自主运营的 **免费开发者工具集群**，全部跑在 Cloudflare Workers 免费层（$0 基础设施），目标：程序化 SEO 引流 → 未来 Lemon Squeezy 变现（模板/数字产品/付费 API）。

## 集群成员

| 项目 | 状态 | 角色 |
|---|---|---|
| [api-mint](https://api.aipps.vip) | ✅ live（`api.aipps.vip`，端点：时区/汇率/币价/URL提取） | 开发者受众引流入口，GitHub 可发现性（public-apis PR #7151） |
| [qr-mint](https://qr.aipps.vip) | ✅ live（`qr.aipps.vip`，QR 生成 PNG/SVG/永久页） | **高搜索量消费品流量引擎**，程序化 SEO（/q/ 页） |

workers.dev 备用地址（国内不可达）：`*.hoiwan.workers.dev`

## 流量漏斗设计

```
Google/目录 (free QR generator, public APIs)
   ↓
qr-mint /q/{data} 永久页 + api-mint 落地页        ← SEO 着陆
   ↓ 页面内交叉链接
集群其他产品 (roadmap: short-mint, meta-mint, text-mint, pdf-mint)
   ↓ 高价值用户
Lemon Squeezy: 模板/数字产品/付费 API             ← 变现（账号已注册，等 API 凭据）
```

## 运营

- Hermes cron 每日巡检（健康、流量、PR/收录、故障 Bark 告警）
- 推广渠道：public-apis 目录（PR #7151 已提交）、GitHub 仓库、程序化 SEO、产品内交叉链接
- 状态文件：各项目 `ops/state.json`

## 待解锁

1. ~~`api.aipps.vip` / `qr.aipps.vip` 域名绑定~~ ✅ 已绑定并验证（2026-08-31）
2. Lemon Squeezy API 凭据（Dashboard → Developers → API keys 的 token + merchant ID）→ 接入每日对账
3. 集群第 3 个产品 short-mint（短链，roadmap 首位；见 CLUSTER-ROADMAP.md）
