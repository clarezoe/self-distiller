# Research: 移动端 PWA 安装、离线缓存隐私与安全区/键盘

- **Query**: 查证 iOS Safari / Android Chrome 的 PWA 安装差异、离线/用户私密内容缓存风险、底部安全区/键盘官方指南；结合现有固定 `w-60` 侧栏、`main p-8`、Serwist SW、manifest 和 3 枚图标，给出引文来源、方案对比和文件行号。
- **Scope**: mixed（内部代码 + 外部官方文档/库源码）
- **Date**: 2026-10-15

## Findings

### Files Found

| File Path | Description |
|---|---|
| `src/app/(app)/layout.tsx:35-64` | 已认证 app shell；根部横向 flex，侧栏固定 `w-60`，主内容固定 `p-8`，没有移动断点或底部导航。 |
| `src/app/layout.tsx:18-25` | 根 metadata；链接 manifest，并设置 `appleWebApp: { capable: true, title }`，但没有显式 `viewport-fit=cover` 或 `interactive-widget` 配置。 |
| `src/app/manifest.ts:3-32` | manifest；`display: "standalone"`、`start_url: "/"`、192/512 普通图标和 512 maskable 图标。 |
| `src/app/sw.ts:15-23` | Serwist SW；启用 precache、`skipWaiting`、`clientsClaim`、`navigationPreload`，并直接使用 `defaultCache`。 |
| `next.config.ts:19-25` | `@serwist/next` 配置；生产构建生成 `public/sw.js`，开发环境禁用 SW。 |
| `src/app/globals.css:27-31` | body 仅有背景、前景、字体，没有 safe-area padding 或键盘 viewport CSS。 |
| `src/proxy.ts:7-13` | manifest、SW、静态图片等绕过登录重定向；这是 installability 所需，但不等于 API 内容不会被 SW 缓存。 |
| `src/app/api/projects/route.ts:6-10` | 已认证 GET API：按当前 session 返回用户项目。 |
| `src/app/api/materials/route.ts:8-20` | 已认证 GET API：按 `projectId` 返回用户材料。 |
| `src/app/api/persona/route.ts:9-53` | Bearer token 认证的用户私密 Self Model API；GET URL 是稳定的 `/api/persona?format=...`。 |

### Internal Code Patterns and Line References

1. **桌面 shell 目前没有移动布局分支**
   - `src/app/(app)/layout.tsx:35` 使用 `<div className="flex min-h-screen">`。
   - `src/app/(app)/layout.tsx:36` 使用固定宽度 `<aside ... className="... w-60 shrink-0 ... p-4">`。在约 320–430 CSS px 的手机宽度中，侧栏会占用 240 px，剩余主区域再叠加 `p-8`。
   - `src/app/(app)/layout.tsx:63` 使用 `<main className="flex-1 p-8">`；未发现 `sm:`/`md:` 断点、折叠菜单或底部导航。
   - `src/app/globals.css:27-31` 没有 `env(safe-area-inset-*)`、`100dvh`、`visualViewport` 相关样式。

2. **当前 PWA 已不是“从零添加”**
   - `src/app/manifest.ts:9` 已为 `display: "standalone"`；`:12-30` 已提供 192、512 和 maskable 512 图标。
   - `src/app/layout.tsx:23-24` 已声明 manifest 和 Apple capable metadata。
   - `src/app/sw.ts:15-20` 已将 Serwist 的 `defaultCache` 接入 service worker；`next.config.ts:21-24` 生产环境生成 SW，开发环境禁用。
   - 当前代码没有发现 iOS 专用 `apple-touch-icon` 链接的显式声明；现有 icon 配置主要在 Web App Manifest 中（manifest 行 12-30）。外部 web.dev 安装指南建议为 Apple 设备在 HTML `<head>` 中提供 `apple-touch-icon`，否则可能使用安装时的 PWA 截图作为主屏图标（见 External References）。

3. **离线缓存的隐私边界是当前需要重点验证的地方**
   - `src/app/sw.ts:20` 使用 `defaultCache`，不是仅缓存静态 shell 的自定义策略。
   - Serwist `@serwist/next@9.5.11` 发布源码 `src/index.worker.ts`（外部 npm 包，固定版本）显示：
     - `:184-190` `/api/auth/*` 才明确 `NetworkOnly`；
     - `:192-204` 其他同源 `/api/` 的 **GET** 使用 `NetworkFirst`，cache name 为 `apis`，最多 16 条、24 小时，并在 10 秒网络超时后回退缓存；
     - `:207-243` 同源 RSC、HTML 页面使用 24 小时 `NetworkFirst`；
     - `:245-255` 其他同源非 `/api/` 请求也使用 24 小时 `NetworkFirst`；
     - `:257-267` 跨域请求使用 1 小时 `NetworkFirst`；
     - `:270-273` 非上述规则的 GET 使用 `NetworkOnly`。
   - 因此，当前策略**会缓存可能含用户内容的 GET API、RSC 和 HTML**，而不只是公开静态资源。`POST` mutation 不被上述 `/api/` 规则匹配，但 GET 列表和页面仍然受影响。
   - `src/app/api/projects/route.ts:6-10` 和 `src/app/api/materials/route.ts:8-20` 都是 session 认证的 GET，且响应 URL 可在不同登录用户之间保持相同；`src/app/api/persona/route.ts:9-53` 则是 Bearer token 认证的私密 GET。若网络断开，`NetworkFirst` 会返回此前缓存的响应。
   - 这不是已通过真机/浏览器复现的跨账号泄漏结论，而是策略与 URL/认证形态共同产生的**高风险待验证项**：同一 origin 的 service-worker Cache Storage 持久化，且用户退出后再由另一账号使用同设备时可能仍存在旧响应；离线时无法通过服务器重新确认当前 session/token。
   - 对 `/api/persona` 还需特别注意：`src/proxy.ts:11` 的 matcher 会排除 `api` 以外的静态扩展名，但 `src/lib/auth.config.ts` 将 `/api/persona` 放入公开前缀，实际 token gate 在 route handler 内（`src/app/api/persona/route.ts:9-18`）。这并不能阻止 `defaultCache` 的同源 GET API 规则（Serwist 源码 `:192-204`）接管该响应。
   - MDN Cache API 文档明确写出 Cache API “doesn't honor HTTP caching headers”；匹配算法会考虑存储响应的 `Vary`，但不能把普通 HTTP `Cache-Control` 当作 service-worker Cache Storage 的充分防线。仅凭当前代码未看到针对私密 API 的 `NetworkOnly` 排除或按用户/授权隔离 cache key。

### External References

#### iOS Safari / iOS home-screen web app

- [web.dev — Installation](https://web.dev/learn/pwa/installation/)（Google web.dev，Installation → “iOS and iPadOS installation”）
  - iOS/iPadOS 没有浏览器安装 prompt；用户要从浏览器 Share 菜单选择 “Add to Home Screen”，确认名称后添加。
  - 推荐在 HTML head 提供 `<link rel="apple-touch-icon" href="/icons/ios.png">`；缺少专用图标时，浏览器可能以安装时的 PWA 截图作为图标。
  - iOS/iPadOS 仅支持 `standalone` display mode；`minimal-ui` 会退化成浏览器快捷方式，`fullscreen` 会退化到 standalone。
  - 同一个 PWA 在 Apple 设备上可以安装多次；每次安装具有隔离 storage，并作为不同 app 处理。安装后的 Web.app 与 Safari tab 运行在不同进程，可能存在实现差异。
  - 对当前代码的直接对应：manifest 已有 `display: "standalone"`（`src/app/manifest.ts:9`）和三枚 PNG（`:12-30`），但显式 Apple touch icon 未在 `src/app/layout.tsx:18-25` 看到。

#### Android Chrome / Android PWA

- [web.dev — Installation](https://web.dev/learn/pwa/installation/)（Installation → “Android installation”）
  - Android 的安装菜单文字会因设备/浏览器而异，可能显示 “Install” 或 “Add to Home Screen”，也可能出现不同形式的安装对话框。
  - 安装结果可能是 WebAPK、shortcut 或 QuickApp。Chrome 在有 Google Mobile Services 的设备上通常可使用 WebAPK；WebAPK 可出现在 launcher/home screen 和系统 Apps 设置中，并支持较多 OS 集成能力。
  - WebAPK 不能重复安装；不能生成 WebAPK 时浏览器会回退到其他形式，因此不能把“有 manifest”理解为所有 Android 设备都有相同安装窗口。
- [Chrome Help — Install a web app](https://support.google.com/chrome/answer/9658361)（Google Chrome Help）
  - Chrome 的安装入口是地址栏的 Install 图标或菜单中的安装项；页面也明确提示：有些 app 离线可用，但不一定所有功能都能在无网络时工作。

#### Safe area / bottom inset

- [WebKit Blog — Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
  - Safari 默认会把内容 inset 到 safe area，避免圆角和传感器区域遮挡；页面背景会填充 inset 区域。
  - 若要使用整块屏幕，WebKit 定义了 `viewport-fit`；`viewport-fit=cover` 让布局覆盖全屏，之后需要用 `env(safe-area-inset-top/right/bottom/left)` 给实际内容和固定底栏留出安全距离。
  - 官方示例 viewport 是 `<meta name='viewport' content='initial-scale=1, viewport-fit=cover'>`；该设置不是自动解决底部遮挡，必须将环境变量用于 padding/margin 等布局。
- [MDN — env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
  - `safe-area-inset-*` 表示当前可见 safe area 的动态 inset；矩形普通 viewport、没有遮挡特征时值可为 0，存在 notch、圆角或动态 UI/键盘占用时可为正的 px 值。
  - `safe-area-max-inset-*` 是动态变量在 UI 完全收起时的静态最大值；不能用 max 值替代当前动态 inset 来处理实时底部空间。
- 当前项目对应事实：`src/app/globals.css:27-31` 尚未设置 safe-area padding；`src/app/layout.tsx:37-49` 也没有显式 viewport metadata。是否采用 `viewport-fit=cover`、以及底部导航/输入栏如何组合 `env(safe-area-inset-bottom)`，属于实现方案选择而非当前已有行为。

#### Soft keyboard / visual viewport

- [Chrome Developers — Prepare for viewport resize behavior changes](https://developer.chrome.com/blog/viewport-resize-behavior)
  - Chrome 108 起 Android 在 OSK 显示时默认不再 resize Layout Viewport，而只 resize Visual Viewport，使行为与 iOS Safari 对齐。
  - `interactive-widget` viewport key 可控制行为：`resizes-visual` 只缩 Visual Viewport；`resizes-content` 同时缩 Layout/Visual Viewport；`overlays-content` 两者都不缩。未指定时 Chrome 默认 `resizes-visual`。
  - 该文还说明 `interactive-widget` 的支持范围不能直接推定为 iOS Chrome；iOS Chrome 使用 WebKit，需在目标 iPhone Safari/安装后的 Web.app 实测。
- [MDN — VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)
  - Layout viewport 是页面布局参考，Visual viewport 是实际可见区域；OSK 可以缩小 visual viewport 而不改变 layout viewport。
  - 需要让固定输入工具栏/控制条跟随屏幕可见区域时，顶层窗口的 `window.visualViewport` 提供 `height`、offset 和 resize/scroll 事件；不要只假定 `100vh` 或 `position: fixed` 会自动避开 OSK。
- 对当前代码的事实判断：当前 app shell 没有 fixed bottom input/tool bar（`src/app/(app)/layout.tsx:35-64`），但 interview、import、calibration、tasks 等 client 流程含输入与 fetch mutation。键盘打开时的输入滚动、底部按钮位置和 standalone Web.app 行为仍需要真实 iOS/Android 浏览器验证；本次静态检索没有真机结果。

#### Offline/cache strategy references

- [Serwist `@serwist/next@9.5.11` published source — `src/index.worker.ts`](https://registry.npmjs.org/@serwist%2fnext/-/next-9.5.11.tgz)
  - 包内源码可复核 `defaultCache` 的具体 matcher/handler；上述行号是下载的 9.5.11 npm tarball 内 `package/src/index.worker.ts` 行号（见本报告 `:184-204`, `:207-255` 等）。Serwist docs 也把 `defaultCache` 描述为 Next.js 推荐的 cache strategy 列表：[Worker exports](https://serwist.pages.dev/docs/next/worker-exports)。
- [Workbox — Strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies)
  - `CacheFirst` 适合不常变化的静态资源；`NetworkFirst` 先取最新网络响应，成功后写 cache，网络失败再返回 cache；`NetworkOnly` 强制请求网络。该定义支持将 authenticated/private GET 与静态资源分开比较。
- [MDN — Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
  - Cache Storage 通过 request/response 保存资源；匹配会考虑 `Vary`，但 Cache API 不遵守 HTTP caching headers。该文档是评估“只加 HTTP `Cache-Control: no-store` 是否足够”时的依据。
- [MDN — Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
  - Service worker 可以拦截 fetch，并把页面、脚本、样式和图片放入本地 cache；离线响应范围由 service worker 的 fetch/cache 策略决定。

## 方案对比（供实现决策引用）

| 方案 | iOS 安装行为 | Android Chrome 安装行为 | 离线/私密数据边界 | 适合当前已知事实 |
|---|---|---|---|---|
| A. 仅静态 shell 离线：静态资源/预缓存；认证 HTML、RSC、所有 `/api/**` 使用 NetworkOnly | 仍需 Share → Add to Home Screen；standalone 是当前 manifest 已选行为 | 可显示 Install/Add to Home Screen，结果依设备为 WebAPK/shortcut/QuickApp | 最容易证明“离线不显示旧账号数据”，但认证页面/API 无离线数据能力 | 与当前账号隔离和 `Definition of Done` 的“缓存不泄漏私人内容”最直接一致；需要改变当前 `defaultCache` 的 API/page 规则 |
| B. 保留 `defaultCache`：认证 GET 使用 NetworkFirst + 24h fallback | 安装路径不变 | 安装路径不变 | 可离线打开最近页面，但同 origin、相同 URL 的登录用户切换/离线时有旧响应残留风险；当前代码不能据此证明零泄漏 | 当前实现就是此方案（`src/app/sw.ts:15-20` + Serwist 9.5.11 defaultCache）；应把它视为待验证的隐私风险方案，不是已验证安全方案 |
| C. 按用户/会话隔离缓存 key，并在 logout/账户切换时清理 | 安装路径不变；iOS 多次安装本身还可能是独立 storage | 安装结果仍依设备 | 可支持有限离线数据，但需要严格处理 token/session 变化、失效、清理失败和 SSR/RSC cache；仅依 URL 不足 | 比 A 更复杂，且当前 route/API 没有展示用户作用域 cache key；若采用必须增加专门测试和清理验证 |

| 响应式底栏/输入栏方案 | 底部安全区 | 软键盘 | 依据 |
|---|---|---|---|
| 1. 默认 viewport + 正常文档流/滚动 | Safari 默认 inset 通常避免 notch；不主动覆盖全屏 | 依浏览器滚动/聚焦行为，避免 fixed 元素更简单 | WebKit safe-area 文档、Chrome viewport resize 文档 |
| 2. `viewport-fit=cover` + `env(safe-area-inset-bottom)` | 可边到边，但底部固定控件必须显式加动态 inset | safe area 与 keyboard 是两个问题，仍需 visual viewport/键盘测试 | WebKit `viewport-fit` + MDN `env()` |
| 3. 固定工具栏 + VisualViewport 事件 | 可与 safe-area padding 组合 | 可根据 `visualViewport.height/offset` 调整可见输入/操作区；实现和跨浏览器测试成本最高 | MDN VisualViewport API、Chrome `interactive-widget` 文档 |

## Caveats / Not Found

- 本次没有 iPhone Safari 或 Android Chrome 真机/远程设备运行结果；安装菜单、standalone Web.app 差异、键盘 resize、底部手势区必须在实际目标设备补验。
- 外部资料中的 iOS/Android 行为是平台文档总结，不保证所有 iOS 版本、Android 厂商和浏览器版本完全一致；尤其 Android 安装产物会因 WebAPK 支持、GMS 和厂商而变。
- Serwist `defaultCache` 的隐私判断基于固定依赖版本 `@serwist/next@9.5.11` 的发布源码；若 lockfile 实际解析到不同补丁版本，应重新核对 `node_modules/@serwist/next` 或对应 tarball。
- 当前静态检查未找到显式 `Cache-Control` 响应头、SW 的用户登出清缓存逻辑、按用户的 cache namespace 或 API 的 `NetworkOnly` 排除（除了 Serwist 默认的 `/api/auth/*`）。不能据此宣称已经发生跨账号泄漏，但也不能宣称当前离线实现已满足“不产生跨账号数据残留”。
- 仅检查到应用代码和项目规格；未编辑应用代码、未部署、未修改生产配置。

## Related Specs

- `.trellis/tasks/10-15-pwa/prd.md:28-47` — 明确 iPhone/Android 安装、软键盘、底部安全区、缓存不泄漏私人内容和不擅自部署等任务要求。
- `.trellis/spec/frontend/directory-structure.md:8-25` — App Router shell、页面和 client leaf 的项目结构约束。
