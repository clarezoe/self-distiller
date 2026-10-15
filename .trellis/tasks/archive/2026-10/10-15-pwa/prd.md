# 移动端重新设计与 PWA 支持

## Goal

用户反馈线上 Self Distiller 在手机上操作费劲，希望重新设计手机体验，并提供手机 PWA 版本，而非仅将桌面界面缩小。

## What I already know

- 用户原话：“我要手机pwa 版，现在手机打开操作起来费劲，重新设计一下”。
- 项目：`clarezoe/self-distiller`；线上地址：https://distill.feifeiecom.com。
- 当前工作树 main，任务创建前仅有未跟踪的 `.claude/settings.local.json`，不得覆盖。
- package.json 使用 Next.js 16.2.9、React 19.2.4、Tailwind 4，并有 Serwist 9.5.11。
- 现有 app shell 在 `src/app/(app)/layout.tsx` 用固定 240px 侧栏列出 9 个导航项，主内容固定 `p-8`；未看到移动导航断点。页面详细内容与实际手机表现仍待逐项核查。
- 已有 `src/app/manifest.ts`、Serwist service worker `src/app/sw.ts` 与生产构建配置；不能把需求当成“从零添加 PWA”，需查清安装体验和缓存策略缺口。
- `src/app/globals.css` 目前只定义主题颜色与字体；app layout 没有显式 `viewport-fit=cover` 元数据。需核对 Next 默认 viewport 行为、safe-area 与键盘交互。

## Assumptions (temporary)

- 在同一个 Web 应用内改善手机体验，保留桌面使用能力，不建立独立原生应用。
- 保留现有账号、数据和业务流程。

## Open Questions

- iPhone 与 Android 真机安装、键盘、安全区仍需设备验证。
- Jev 判断（模型 `jev-1.13.0`，同一输入的 Choice + 三个 Score）：MVP 仅缓存静态 shell / 公开静态资源，禁止缓存认证页面、API 响应、Self Model 与访谈内容。Choice 概率：仅静态资源 1.00、认证数据 0.00、完全无离线缓存 0.00（confidence 1.00）。评分：仅静态资源 3.57（confidence 0.66）；认证及用户内容 0.55（0.55）；无离线缓存 2.42（0.17）。源码研究发现现有 Serwist `defaultCache` 会缓存认证 GET API、RSC 和 HTML，须纳入修复与回归验收。

## Requirements (evolving)

- 手机端重新设计，优化实际操作，不只添加安装图标。
- 用户已确认同时兼顾 iPhone 与 Android：分别验证 Safari / Chrome 浏览器与安装后的独立窗口体验，覆盖安装引导、软键盘、底部安全区和触控操作；无法进行真机验证时明确记录限制。
- 重新设计认证后的移动 app shell 与导航，采用研究推荐的移动导航形态；桌面侧栏继续保留。
- 首要移动操作为“继续或开始访谈”（Jev 决定，见 Decision）；首页与底部导航以此为主 CTA。不新增“快速记录”等新功能。
- Service worker 仅缓存静态 shell 与明确公开的静态资源；认证页面、RSC、所有 API 和用户私密数据使用 NetworkOnly，并验证登出/切换账号后无旧缓存内容。
- 补齐 iOS 安装图标及双平台安装说明；确认 manifest、安装后启动和 service worker 更新状态可理解。
- 核查并补足 PWA 安装及独立窗口使用体验。
- 不覆盖原有本地设置，不改生产服务配置，不擅自部署。

## Acceptance Criteria (evolving)

- [ ] 在 320–430 CSS px 手机视口中，导航与主要内容无横向溢出，触控目标可用，输入与主操作不被软键盘遮挡。
- [ ] iPhone Safari 与 Android Chrome 均可按平台提示安装/添加到主屏幕并以 standalone 启动；同时验证普通浏览器使用。
- [ ] Service worker 不缓存认证页面、RSC、API 或用户内容；登出后离线、同设备切换账号时不显示前一账号内容。
- [ ] 对支持的浏览器验证底部安全区、键盘打开/收起、缓存更新及离线提示；未能真机覆盖的项目明确标记，不宣称已验证。
- [ ] 桌面功能与现有数据访问权限无回归。
- [ ] 核心移动流程（启动/继续访谈、查看 Self Model）在浏览器中完成。

## Definition of Done

- 补充适用测试，完成 lint、typecheck、测试与构建验证；如受环境限制，记录实际结果。
- 对变更行为补充文档。
- 验证缓存不泄漏私人内容，不产生跨账号数据残留。
- 发布与生产验证需另行取得授权。

## Out of Scope (provisional)

- 原生 App Store / Google Play 上架。
- 更换后端、模型供应商、账号系统或数据库。

## Technical Notes

- 已读取项目 AGENTS.md、CLAUDE.md、.trellis/workflow.md 与 package.json。
- 现状及官方资料研究见 `research/mobile-pwa.md`；包括移动导航方案与 iOS/Android 安装差异。
- Serwist 9.5.11 的 `defaultCache` 会缓存认证 GET API、RSC 与 HTML；需改为仅缓存静态资源，并覆盖登出/切换账号的离线隐私回归测试。当前为静态分析风险，尚未在设备复现。
- Jev 同输入 Choice/Score 推荐仅缓存静态 shell/公开静态资源；认证数据和完整离线缓存不适合作为此 MVP。
- 本任务目前处于 planning；尚未修改应用代码。

## Decision (ADR-lite)

**Context**: 用户要求由 Jev 决策手机首页首要操作，不要再询问用户。

**Decision**: Jev（`jev-1.13.0`）同一状态下 Choice 选“继续或开始访谈”，概率 1.00，confidence 1.00。Score（0-4）：继续访谈 3.84（confidence 0.89），运行任务 0.87（0.28），查看 Self Model 0.78（0.36），快速记录 0.00（1.00）。Choice 与 Score 一致。离线缓存决策见 Open Questions：仅缓存静态 shell/公开静态资源。

**Consequences**: 首页与底部导航围绕访谈；Self Model、任务等进入次级导航；快速记录作为新功能排除。
