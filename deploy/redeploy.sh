#!/usr/bin/env bash
# Rebuild + roll the cloud app after a code change. Runs on the box (RAM-tight,
# uses swap). Data is untouched (only the app image + service are rolled).
#
# Usage:  bash deploy/redeploy.sh
set -euo pipefail
SSH_HOST="${SSH_HOST:-feifeiecom}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Syncing source → $SSH_HOST:/opt/distill-src …"
rsync -az --delete \
  --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='.env' \
  --exclude='.trellis' --exclude='.claude' --exclude='docs' --exclude='scratchpad' \
  --exclude='src/generated' \
  -e "ssh -o ConnectTimeout=8" \
  "$REPO_ROOT/" "$SSH_HOST:/opt/distill-src/"

echo "Building image on the box…"
ssh -o ConnectTimeout=8 "$SSH_HOST" \
  'cd /opt/distill-src && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 docker build -t distill-app:latest . 2>&1 | tail -3'

echo "Rolling app service…"
ssh -o ConnectTimeout=8 "$SSH_HOST" 'docker service update --force --image distill-app:latest distill_app >/dev/null 2>&1 && echo rolled'
echo "Done. Verify: https://distill.feifeiecom.com"
