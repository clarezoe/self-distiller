#!/usr/bin/env bash
# One-shot: push the LOCAL dev database up to the cloud (feifeiecom) instance.
#
# Use only if you distilled something locally and want it on the cloud. Normally
# you just use https://distill.feifeiecom.com directly from any machine — the
# cloud is the single source of truth, so there is nothing to "sync".
#
# This OVERWRITES the cloud data with your local data (clean reload). Make sure
# local is the version you want to keep before running.
#
# Usage:  bash deploy/push-data-to-cloud.sh
set -euo pipefail

LOCAL_DB="${LOCAL_DB:-distill_me}"
SSH_HOST="${SSH_HOST:-feifeiecom}"

echo "Local → cloud DB push. This OVERWRITES cloud data with local."
read -r -p "Continue? [y/N] " ok
[ "$ok" = "y" ] || { echo "aborted"; exit 1; }

echo "Dumping local '$LOCAL_DB' and restoring into the cloud postgres…"
pg_dump --no-owner --no-privileges --clean --if-exists "$LOCAL_DB" \
  | gzip -c \
  | ssh -o ConnectTimeout=8 "$SSH_HOST" '
      c=$(docker ps -q -f name=distill_postgres | head -1)
      [ -n "$c" ] || { echo "distill_postgres container not found on host" >&2; exit 1; }
      gunzip -c | docker exec -i "$c" psql -U distill -d distill_me -v ON_ERROR_STOP=0 >/tmp/push-restore.log 2>&1
      echo "restore done"
      grep -iE "error|fatal" /tmp/push-restore.log | grep -viE "does not exist|already exists" | head -10 || true
    '

echo "Restarting the cloud app…"
ssh -o ConnectTimeout=8 "$SSH_HOST" 'docker service update --force distill_app >/dev/null 2>&1 && echo restarted'
echo "Done. Verify: https://distill.feifeiecom.com"
