# aipps.cluster

Kane + Hermes（AI agent）自主运营的 **免费工具集群**，全部跑在 Cloudflare Workers 免费层（$0 基础设施），目标：程序化 SEO 引流 → Creem 数字产品变现（模板/数字产品，备选 Gumroad/Paddle）。

## 集群成员

| 项目 | 状态 | 角色 |
|---|---|---|
| [api-mint](https://api.aipps.vip) | ✅ live（`api.aipps.vip`，端点：时区/汇率/币价/URL提取） | 开发者受众引流入口，GitHub 可发现性（public-apis PR #7151） |
| [qr-mint](https://qr.aipps.vip) | ✅ live（`qr.aipps.vip`，QR 生成 PNG/SVG/永久页） | **高搜索量消费品流量引擎**，程序化 SEO（/q/ 页） |
| [short-mint](https://short.aipps.vip) | ✅ live（`short.aipps.vip` 已绑，代码 `short/`） | **病毒传播引擎**：短链自带曝光；DO 原子点击计数、永久无过期、免费 API |
| [store](https://www.aipps.vip) | ✅ live（`www.aipps.vip` 已绑，代码 `store/`） | **变现门面**：集群主页 + $29 boilerplate 产品页/定价/法律页 + `/thanks` 付款成功页；Creem live checkout 已全链路打通 |

统一使用 `*.aipps.vip` 子域访问（workers.dev 备用地址国内不可达）

## 流量漏斗设计

```
Google/目录 (free QR generator, public APIs)
   ↓
qr-mint /q/{data} 永久页 + api-mint 落地页        ← SEO 着陆
   ↓ 页面内交叉链接
集群其他产品 (roadmap: meta-mint, text-mint, pdf-mint)
   ↓ 高价值用户
Creem: 模板/数字产品/付费 API                     ← 变现（待 Kane 注册 creem.io，支付宝/Wise 可提现）
```

## 运营

- Hermes cron 每日巡检（健康、流量、PR/收录、故障 Bark 告警）
- 推广渠道：public-apis 目录（PR #7151 已提交）、GitHub 仓库、程序化 SEO、产品内交叉链接
- 状态文件：各项目 `ops/state.json`

## 待解锁

1. ~~`api.aipps.vip` / `qr.aipps.vip` / `short.aipps.vip` / `www.aipps.vip` 域名绑定~~ ✅ 已绑定并验证（2026-08-31）
2. ~~Creem 注册 + boilerplate 产品 + checkout~~ ✅ 已打通（2026-08-31）：live key 走 CF secrets（`store/deploy.sh` 一键 deploy+secrets），`POST /api/checkout` 线上真实建单成功，success_url → `https://www.aipps.vip/thanks`
3. Creem 账户/产品审核通过后：配结款账户（Wise/Payoneer）；首单后确认交付邮件
4. 集群第 4 个产品 meta-mint（SEO 检查，roadmap 首位；见 CLUSTER-ROADMAP.md）
