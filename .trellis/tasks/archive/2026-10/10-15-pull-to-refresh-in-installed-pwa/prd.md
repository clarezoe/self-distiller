# Pull to refresh in installed PWA

## Problem (user, 2026-10-15)

The iPhone home-screen app (Safari "Add to Home Screen", `display: standalone`) has no
browser chrome, so there is no reload button and iOS gives no native pull-to-refresh.
The user cannot refresh. Request: add swipe-down / pull-to-refresh.

## Requirements

- New client component (e.g. `src/components/pull-to-refresh.tsx`) mounted in
  `src/app/(app)/layout.tsx` so it covers all signed-in pages (mobile only is fine; harmless on desktop).
- Gesture: touch starts while the page is scrolled to the top (`window.scrollY <= 0`),
  user drags down. Show an indicator under the top header that follows the finger
  with resistance (e.g. distance * 0.5, capped). Past a threshold (~70px after resistance)
  the indicator shows "release to refresh"; releasing triggers refresh. Below threshold, it snaps back.
- Refresh action: full `window.location.reload()`, same as a browser reload. Some pages
  (e.g. tasks) hold client-fetched state that `router.refresh()` would not re-fetch, and
  the user expects a real reload. Show a spinner in the indicator until the page unloads.
- Only enable in standalone display mode (`matchMedia('(display-mode: standalone)')` or
  `navigator.standalone` on iOS). Normal browsers already have native refresh, and
  Android Chrome tabs have native pull-to-refresh; don't double up.
- Must not interfere with: horizontal swipes, scrolling inside inner scrollable
  elements (textarea, overflow containers: ignore gesture if touch target is inside an
  element that is itself scrolled down), the More sheet when open, multi-touch.
- Use passive listeners where possible; only call `preventDefault` on `touchmove` when
  actively pulling (needs non-passive listener for that one).
- Add `overscroll-behavior-y: contain` on body only in standalone mode if needed so
  iOS rubber-band does not fight the custom gesture.
- Indicator text i18n in en/zh (`nav.pullToRefresh`, `nav.releaseToRefresh`,
  `nav.refreshing` or similar), accessible: `aria-live="polite"` status for refreshing.
- Respect `prefers-reduced-motion` (no snap animation).

## Acceptance

- lint, tsc, tests, build pass.
- Unit-test the pure gesture math (resistance/threshold) if extracted to a helper.
