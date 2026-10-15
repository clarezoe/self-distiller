# Frontend Directory Structure

Actual layout (Next.js App Router, `src/`).

```
src/
  lib/pwa/runtime-caching.ts # service-worker cache rules (pure, tested); app/sw.ts consumes it
  app/
    layout.tsx                # root layout (html/body, fonts, metadata)
    globals.css               # Tailwind 4 entry
    login/page.tsx            # public login (server action signIn)
    (app)/                    # authenticated shell — proxy-gated + layout getCurrentUser
      layout.tsx              # shell: desktop sidebar (md+) / mobile top bar + bottom tabs (<md); 9 SECTIONS + logout action
      page.tsx                # Dashboard
      <section>/page.tsx      # server component per nav section
      <section>/<x>-client.tsx# "use client" leaf for interactivity (chat, forms with state)
  components/
    mobile-nav.tsx            # "use client" bottom tab bar + More sheet (Interview = primary tab)
    sidebar-link.tsx          # "use client" active-route sidebar link
    submit-button.tsx         # useFormStatus pending button — reuse for all action buttons
    placeholder.tsx           # stub-section helper
```

Rules:
- **Pages are async Server Components**; fetch via `services/` directly. Mutations via inline server actions (`"use server"`) → re-check auth/ownership → service → `revalidatePath` → `redirect("...?saved=1")`.
- **Client components** only for interactivity (chat surfaces, multi-step forms, pending UI). Keep them leaf-level; pass server-fetched data as props. NEVER pass secrets or withheld data (e.g. calibration `hiddenAgentAnswer`) into client props.
- New top-level page → folder under `(app)/` + entry in `(app)/layout.tsx` `SECTIONS`.
- Styling: Tailwind utilities; reuse shared `inputCls`/`btnCls`/`card` strings; support `dark:`. See `.trellis/spec/frontend/component-guidelines.md` for patterns.
```

Mobile shell: `(app)/layout.tsx` stays a Server Component; `SECTIONS` is the single nav source. Below `md` it renders a top bar + fixed bottom tab bar (`MobileNav`, uses `env(safe-area-inset-bottom)`); `main` is `p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8`. New top-level sections go in the sidebar automatically and appear under "More" unless added to `MOBILE_TABS`.
