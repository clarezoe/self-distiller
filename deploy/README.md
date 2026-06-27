# Deploy — feifeiecom VPS (managed by Dokploy)

Live: **https://distill.feifeiecom.com** (magic-link login, allowlist `clarezoe@gmx.com`).

**Managed by Dokploy** (project "Self Distiller"): app `distill-app` (github source
`clarezoe/self-distiller`, Dockerfile build) + Postgres `distill-db`, on the
`dokploy-network` overlay, TLS via Let's Encrypt.

## Redeploy
- **Auto**: `git push origin main` → Dokploy webhook rebuilds + redeploys (triggerType=push).
- **Manual**: Dokploy UI → Self Distiller → distill-app → Deploy. Or API `application.deploy`.
- Build runs on-box from the Dockerfile (standalone, `next build --webpack`; needs the box's swap). `packageManager: pnpm@9.15.4` is pinned (box corepack pulls pnpm 10 otherwise → build fails).

## Env / secrets
Managed in the Dokploy UI (app → Environment). Includes DATABASE_URL (→ `distill-db`),
AUTH_SECRET, ENCRYPTION_KEY (reused from the original deploy so stored LLM creds
decrypt), AUTH_ALLOWLIST, SMTP_* (magic-link). Not in git.

## Data
Postgres `distill-db` (Dokploy-managed). Backups: `~/Downloads/distill-backups/` (local)
+ `/opt/distill/backups/` (box). To push local dev data up: `pg_dump` → restore into the
`distill-db` container (see push-data-to-cloud.sh, adjust the target container name).

## Legacy (superseded)
`stack.yml`, `traefik-distill.yml`, `redeploy.sh` were the original **SSH-only Docker
Swarm** deploy (issue #6), now replaced by Dokploy (issue #10). The old swarm stack
`distill` was torn down. These files are kept for reference only — do not run them.
