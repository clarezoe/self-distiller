# Frontend Component Guidelines

Real conventions from the Foundation build. Match these in later phases.

## Default to Server Components + Server Actions
- Pages under `src/app/(app)/**` are **async Server Components**. Fetch via services directly (`await listContexts(projectId)`), not via client fetch.
- Mutations use **inline server actions** (`async function x(formData: FormData){ "use server"; ... }`) that: re-check auth + ownership, call a service, `revalidatePath(...)`, then `redirect("...?saved=1")` for feedback. See `src/app/(app)/contexts/page.tsx` and `settings/page.tsx`.
- Reach for a Client Component (`"use client"`) only for interactivity: pending state, optimistic UI, local form state, chat. Keep them small and leaf-level.

## Established patterns to reuse
- **Pending feedback**: `src/components/submit-button.tsx` (`SubmitButton` uses `useFormStatus`; pass `pendingText`). Use it for every action button so slow calls (LLM) show progress.
- **Result banners**: read a `searchParams` flag (`saved`, `test`) and render an inline colored `<p>` near the relevant control, not only at page top.
- **Auth gate**: `(app)/layout.tsx` calls `getCurrentUser()` and `redirect("/login")`; pages can assume a user but should still null-guard.
- **Forms**: native `<form action={serverAction}>` + `FormData`. React Hook Form is available but not required; only use it for complex client-side validation (e.g. interview/calibration flows).

## Styling
- Tailwind 4 utility classes inline. Reuse the shared class strings (`inputCls`, `btnCls`) seen in existing pages for consistency; promote to a component if repeated 3+ times. Support dark mode (`dark:` variants) as existing pages do.
- shadcn/ui primitives + `cn()` (`src/lib/utils.ts`) for composed components.

## Next 16 specifics
- `searchParams` / `params` props are **Promises** — type as `Promise<{...}>` and `await` them.
- Never put secrets or LLM keys in client components; all provider calls stay server-side.

## Navigation
- The 9 sections live in `(app)/layout.tsx` `SECTIONS`. New top-level pages go under `(app)/` and get a nav entry there.
