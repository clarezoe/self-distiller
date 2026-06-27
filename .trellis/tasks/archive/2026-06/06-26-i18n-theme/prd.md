# Panel i18n + theme + PWA (GitHub #1)

Stack decided by the earlier session's Lazyweb + Next 16 research (issue #1 comment). Implement all three behind one Settings → Appearance screen. None of next-intl/next-themes/@serwist is installed yet. App = Next.js 16 App Router, Tailwind v4, all pages already use `dark:` classes.

## Decisions (from research — do NOT re-litigate)
- **Theme**: `next-themes`, **tri-state System / Light / Dark** (segmented control, not binary). Tailwind class-based dark, no-FOUC.
- **i18n (zh / en)**: `next-intl`, **cookie-based locale (NO URL prefix)** — internal 2-lang panel. Default `en`.
- **PWA**: `@serwist/next` (NOT next-pwa). Installable + offline shell via `app/manifest.ts` + service worker; **disabled in dev**.
- **Placement**: a single **Settings → Appearance & Language** screen — theme as a segmented control, language as a checklist with checkmark.
- **Persist**: cookie (works for the logged-in owner). Per-user Auth.js-session storage is a nice-to-have — OK to defer; cookie is the source of truth this pass.

## Build

### Theme (next-themes)
- Install `next-themes`. `ThemeProvider` in root layout: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Add `suppressHydrationWarning` to `<html>`.
- Tailwind v4 class dark: add `@custom-variant dark (&:where(.dark, .dark *));` to `src/app/globals.css` so existing `dark:` utilities respond to the `.dark` class (not just prefers-color-scheme).
- Tri-state theme control component (System/Light/Dark) using `useTheme()`.

### i18n (next-intl, cookie-based, no routing)
- Install `next-intl`. `next.config.ts`: wrap with `createNextIntlPlugin()`.
- `src/i18n/request.ts` (`getRequestConfig`): read locale from a `locale` cookie (default `en`), load `messages/${locale}.json`.
- `messages/en.json` + `messages/zh.json` — extract EVERY user-facing string from the ~16 files under `src/app/(app)/**`, `src/app/login/**`, shared components, into namespaced keys; translate to zh. Use `useTranslations` (client) / `getTranslations` (server). No hardcoded UI text left.
- `NextIntlClientProvider` in root layout (pass messages + locale). Root `<html lang>` = current locale (dynamic, not hardcoded "en"). Fix the placeholder `metadata` (title/description) too.
- A server action `setLocale(locale)` that writes the `locale` cookie + `revalidatePath('/')`.

### PWA (@serwist/next)
- Install `@serwist/next` + `serwist`. `next.config.ts`: `withSerwist({ swSrc: 'src/app/sw.ts', swDest: 'public/sw.js', disable: process.env.NODE_ENV === 'development' })`.
- `src/app/sw.ts` (Serwist service worker, defaultCache, offline-ready). `src/app/manifest.ts` (name, short_name, theme_color, icons — add a simple icon set under `public/`). Link manifest in layout metadata.
- Ensure the standalone Docker build includes `public/sw.js` + manifest (the runner copies `public/` already).

### Settings → Appearance & Language
- New screen (a section on `/settings` OR a sub-page `(app)/settings` appearance block): theme segmented control + language checklist (✓ on active). Wire to `useTheme()` + `setLocale` action.
- Add a nav entry / make it reachable. Keep the existing LLM Settings intact.

## Acceptance Criteria
- [ ] Theme System/Light/Dark switches live, persists across reload, no FOUC; existing `dark:` styles respond to the toggle.
- [ ] Language zh/en switches via the Appearance screen, persists (cookie), `<html lang>` updates; no hardcoded UI strings remain in the translated files (spot-check several pages render zh).
- [ ] App is installable (valid manifest + SW registered in prod build); SW disabled in dev (dev still works).
- [ ] `pnpm typecheck`, `lint`, `build`, `test` all green. Existing 116 tests still pass.
- [ ] Build emits `public/sw.js`; standalone runner serves it.

## Invariants / notes
- Don't break auth/proxy (next-intl cookie mode needs NO middleware — no conflict with `proxy.ts`).
- Don't regress existing features/pages; keep server-component + server-action patterns.
- After merge, redeploy to cloud (`bash deploy/redeploy.sh`) — new deps + SW build.
- Reference research report (on box): `.lazyweb/design-research/pwa-panel-i18n-theme-2026-06-22/report.md` (placement/tri-state rationale).
