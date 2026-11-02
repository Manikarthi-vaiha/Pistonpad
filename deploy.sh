#!/usr/bin/env bash
set -e

VPS="root@187.126.120.115"
REMOTE="/opt/pistonpad"

echo "→ Syncing files to VPS..."
rsync -avz \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env*' \
  --exclude='docker-compose.override.yml' \
  ./ "$VPS:$REMOTE/"

echo "→ Building and restarting app on VPS..."
ssh "$VPS" "cd $REMOTE && docker compose up -d --build app"

echo "✓ Deploy complete."
