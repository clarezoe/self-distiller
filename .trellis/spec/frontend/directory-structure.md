# Frontend Directory Structure

Actual layout (Next.js App Router, `src/`).

```
src/
  app/
    layout.tsx                # root layout (html/body, fonts, metadata)
    globals.css               # Tailwind 4 entry
    login/page.tsx            # public login (server action signIn)
    (app)/                    # authenticated shell — proxy-gated + layout getCurrentUser
      layout.tsx              # sidebar nav (9 SECTIONS) + logout action
      page.tsx                # Dashboard
      <section>/page.tsx      # server component per nav section
      <section>/<x>-client.tsx# "use client" leaf for interactivity (chat, forms with state)
  components/
    submit-button.tsx         # useFormStatus pending button — reuse for all action buttons
    placeholder.tsx           # stub-section helper
```

Rules:
- **Pages are async Server Components**; fetch via `services/` directly. Mutations via inline server actions (`"use server"`) → re-check auth/ownership → service → `revalidatePath` → `redirect("...?saved=1")`.
- **Client components** only for interactivity (chat surfaces, multi-step forms, pending UI). Keep them leaf-level; pass server-fetched data as props. NEVER pass secrets or withheld data (e.g. calibration `hiddenAgentAnswer`) into client props.
- New top-level page → folder under `(app)/` + entry in `(app)/layout.tsx` `SECTIONS`.
- Styling: Tailwind utilities; reuse shared `inputCls`/`btnCls`/`card` strings; support `dark:`. See `.trellis/spec/frontend/component-guidelines.md` for patterns.
```
