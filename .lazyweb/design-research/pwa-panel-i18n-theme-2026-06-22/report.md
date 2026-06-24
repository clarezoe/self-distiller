# Design + Tech Research: PWA Panel — i18n (zh/en) + Theme (light/dark)

Date: 2026-06-22 · Stack: Next.js 16 / Prisma 7 / Auth.js 5

## TL;DR
For a Next.js 16 App Router panel, the winning stack is **Serwist** (PWA service worker) + **next-themes** (theme) + **next-intl** (i18n). Avoid `next-pwa` — unmaintained, weak App Router support. Lazyweb evidence (strong, 60+ real apps) shows the dominant pattern is a **tri-state theme** (System / Light / Dark, not a binary toggle) and a **language list with checkmark** living together on a Settings/Appearance screen reached from a profile/More entry.

## Recommendations (priority order)

1. **PWA → Serwist (`@serwist/next`)** — successor to `next-pwa`, App-Router-native, actively maintained. Add `app/manifest.ts` (Next.js typed manifest) + icons + `sw.ts`. Gives installable "Add to Home Screen" + offline shell. `next-pwa` is dead; manual SW is unnecessary work.

2. **Theme → next-themes, tri-state default System** — Lazyweb shows Brave, AP, NYT Post, electrify-america, truth-social, fotmob all ship **System / Light / Dark** as radio/segmented, not a 2-way switch. `next-themes` handles no-FOUC, `localStorage` persist, and `prefers-color-scheme`. Pair with Tailwind `darkMode: 'class'`.

3. **i18n → next-intl, cookie-based locale** — App Router native. For just zh/en a cookie-based locale (no `/en` `/zh` URL prefix) keeps URLs clean; switch via a simple toggle or 2-item select. Lazyweb pattern: native-script + English label, checkmark on active.

4. **Placement** — one **Settings → Appearance/Language** screen. Theme as segmented control, language as checklist. Entry from a profile/More tab (mobile) or top-right gear (desktop). Persist both server-side per-user if logged in (Auth.js session), fall back to cookie/localStorage for guests.

```
Settings
┌─────────────────────────────┐
│  ← Settings                 │
│                             │
│  Appearance                 │
│  ┌─────┬─────┬─────┐        │
│  │Sys ✓│Light│Dark │  ← segmented (next-themes)
│  └─────┴─────┴─────┘        │
│                             │
│  Language                   │
│   中文            ✓         │  ← checklist (next-intl)
│   English                   │
└─────────────────────────────┘
```

## Patterns (from Lazyweb, strong coverage)
- **Tri-state theme is table stakes.** System/Light/Dark via radio or segmented control. Binary toggles look dated.
- **Theme + language co-located** in Settings/Appearance, not scattered.
- **Active selection = checkmark**; language labeled in its own script + English.
- Theme picker often a **bottom sheet** on mobile (AP, nyt-games, fotmob, f1).

## Anti-Patterns
- `next-pwa` on App Router — unmaintained, hydration/caching issues.
- Binary light/dark toggle with no System option — ignores OS preference.
- Locale in URL prefix for a 2-language internal panel — unnecessary routing complexity; cookie is cleaner.
- Theme flash on load (FOUC) — solved by `next-themes` inline script; don't hand-roll.

## Stack decision table
| Concern   | Pick                | Why over alternatives                          |
|-----------|---------------------|------------------------------------------------|
| PWA       | Serwist             | App-Router native, maintained; next-pwa is dead|
| Theme     | next-themes         | No-FOUC, System support, Tailwind class mode    |
| i18n      | next-intl           | App-Router native; cookie locale for 2 langs    |
| Persist   | Auth.js session + cookie | per-user when logged in, cookie for guests |

## Sources
- Lazyweb (strong coverage): theme settings — brave, ap, nyt-post, electrify-america, truth-social, fotmob, nothing-x, trello; language — guitartuna, speak, klarna, merlin-bird, mta, persist.
- Tech: Serwist docs (next-pwa successor), next-themes, next-intl App Router guides.
