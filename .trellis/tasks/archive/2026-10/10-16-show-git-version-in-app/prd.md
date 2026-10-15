# Show git version in app

User (2026-10-16): "没加 git 版本号吗？我看不到" — wants to see which commit the deployed app is running.

## Facts
- No version display exists. package.json version is a static 0.1.0.
- Production = Dokploy builds `Dockerfile` from the git checkout (which has `.git`), but `.dockerignore` excludes `.git`, so the image build has no commit info. Dokploy `buildArgs` is empty and does not pass a commit SHA.
- Builder stage: `COPY . .` then `pnpm prisma generate` and `pnpm build`. Runner is a standalone Next image.

## Requirements
- Build-time version string `<short sha>` (7 chars) plus `<commit date YYYY-MM-DD>`; append `-dirty` is NOT needed.
- Dockerfile builder stage: get the commit from git inside the build. Remove `.git` from `.dockerignore`; install git in the builder stage (`apk add --no-cache git`); resolve with `git -c safe.directory=/app rev-parse --short=7 HEAD` and `git -c safe.directory=/app log -1 --format=%cd --date=short`. Allow override by optional build args `GIT_SHA` / `GIT_DATE` (use if set). If git info is unavailable, fall back to `unknown`; never fail the build. Export as `NEXT_PUBLIC_GIT_SHA` / `NEXT_PUBLIC_GIT_DATE` in the same RUN as `pnpm build` so Next inlines them. Runner image must not contain `.git` (it does not, standalone output only).
- Local dev / `next build` outside Docker: next.config computes the same values via `git` with try/catch (fallback `dev` / empty) and sets them in `env` unless already provided.
- Display: small muted text `v<sha> · <date>` (e.g. `a1b2c3d · 2026-10-16`) in (1) the desktop sidebar footer under the sign-out button, (2) the mobile More sheet bottom (near the install help), (3) the login page footer so it is visible before signing in. Make it selectable/copyable text. Link to the GitHub commit is optional; skip if it complicates things.
- Small shared component `src/components/app-version.tsx`. Pure helper to format the label with unit tests (handles `unknown`, missing date).
- No env var names or secrets leak; SHA and date are public anyway.
- Does not touch the PWA cache logic. Note service worker precache revisions are unaffected.

## Acceptance
lint, tsc --noEmit, vitest, build pass. Verify `NEXT_PUBLIC_GIT_SHA` is inlined in the build output (grep .next for the sha). Dockerfile change reviewed by reading; docker build may be unavailable locally, say so.
