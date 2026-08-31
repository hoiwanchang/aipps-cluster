# 集群路线图（按"搜索量 × 建设成本 × 变现潜力"排序）

原则：每个新产品 = 一个高搜索量的"free X tool"关键词族 + 程序化 SEO 页面 + 交叉链接 + $0 CF 基础设施。
流量先跑起来，变现靠 Lemon Squeezy 数字产品（模板/指南/付费 API tier），不做订阅 SaaS（个人合规成本高）。

> 收款平台 2026-08-31 更新：Lemon Squeezy 结款走 Stripe，中国个人无法使用（已弃用）。
> 改用 **Creem**（creem.io，个人可注册、支付宝/Wise 提现、费率 3.9%+$0.4），备选 Gumroad/Paddle。

## 已上线
- api-mint — 开发者 API 引流（时区/汇率/币价/URL 提取）
- qr-mint — QR 生成（"free qr code generator" 全球月搜索 ~400万+，头部结果多为登录墙/水印站，我们免费无墙）
- short-mint — 免费短链（"url shortener" 月搜 ~150万，DO 原子点击计数、永久无过期、免费 API）。集群导流最强：每条短链自带传播。
  - 技术：KV 存映射（永久无 TTL）+ sqlite Durable Object 存点击（免费层 10万次/月）。CF 2026 起禁用新建 KV-backed DO，必须 `[exports.X] storage="sqlite"`。

## 候补（按优先级）
1. **meta-mint** 网页 SEO 检查工具（输入 URL 出 title/desc/OG/结构化数据报告，HTML 报告页可被索引）— "seo checker online free" 竞争中等
2. **text-mint** 文本工具集（字数统计/JSON 格式化/Base64/Markdown 预览，单页多工具，程序化 SEO 每个工具一页）— 长尾词海
3. **pdf-mint** PDF 合并/拆分（CF R2 + pdf-lib 边缘处理，免费层有 1GB 存储额度）— 流量大但实现重，放最后
4. **boilerplate 变现** — 把集群本身（Workers + CF 配置 + SEO 模板 + 运营 cron）打包成 "CF Workers SEO Tool Boilerplate" 卖 $29-49（Creem 一次性）— 卖铲子给淘金人

## 变现顺序
1. 流量数据跑 2-4 周（Search Console + Umami 免费）
2. 先上 boilerplate（一次性收入，验证 Creem 收款链路）
3. 视流量决定：短链付费 tier / 模板包 / API 付费 key
4. 收入自动记入 ops/ledger.json，周报发 Kane
