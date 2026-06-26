# Deploy — feifeiecom VPS (self-host)

Live: **https://distill.feifeiecom.com** (login `owner@distill.me`).

The cloud instance is the single source of truth — use it from any machine via
the URL. There is no local↔cloud "sync": one DB, accessed everywhere.

## Architecture
- Host: `ssh feifeiecom` (64.112.126.84), Docker Swarm + Dokploy + Traefik.
- App + Postgres run as a Swarm stack `distill` on the `dokploy-network` overlay.
  - `distill_app` (Next.js standalone, port 3000), `distill_postgres` (volume `distill-pgdata`).
- Traefik routes `distill.feifeiecom.com` → `distill_app:3000` via
  `/etc/dokploy/traefik/dynamic/distill.yml` (TLS = Let's Encrypt, wildcard DNS `*.feifeiecom.com`).
- Secrets on the box: `/opt/distill/.env.deploy` (PGPASS, AUTH_SECRET, ENCRYPTION_KEY) — NOT in git.
  - `ENCRYPTION_KEY` matches the local dev key so migrated LLM credentials still decrypt.

## Files
- `stack.yml` — the Swarm stack (env-interpolated; no secrets).
- `traefik-distill.yml` — Traefik dynamic route (copied to the box's dynamic dir).
- `redeploy.sh` — rebuild image on the box + roll the app after a code change (data untouched).
- `push-data-to-cloud.sh` — one-shot: overwrite cloud DB with local DB (only if you distilled locally).

## First deploy (already done) / re-deploy
```bash
bash deploy/redeploy.sh          # sync source, build on box, roll app
```

## Initial provisioning (reference)
```bash
# secrets → box
printf 'PGPASS=%s\nAUTH_SECRET=%s\nENCRYPTION_KEY=%s\n' "$PG" "$AUTH" "$ENC" \
  | ssh feifeiecom 'cat > /opt/distill/.env.deploy && chmod 600 $_'
scp deploy/stack.yml feifeiecom:/opt/distill/stack.yml
ssh feifeiecom 'cd /opt/distill && set -a && . ./.env.deploy && set +a && docker stack deploy -c stack.yml distill'
scp deploy/traefik-distill.yml feifeiecom:/etc/dokploy/traefik/dynamic/distill.yml
# migrate data: pg_dump local | gunzip into docker exec psql (see push-data-to-cloud.sh)
```

## Notes
- Build is on-box (RAM ~1.3G free + 3G swap). `next build` peaks ~2G — swap required.
- Postgres is NOT exposed to the public internet (overlay-only). Chat content is
  plaintext at rest in Postgres (only LLM keys are app-encrypted) — acceptable for
  a single-owner box; see the privacy note if you want content-level encryption.
