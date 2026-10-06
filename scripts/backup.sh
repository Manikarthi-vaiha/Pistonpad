#!/bin/sh
# Daily database backup, keeps the last 14 days. Install with:
#   echo "30 2 * * * root /opt/pistonpad/scripts/backup.sh" > /etc/cron.d/pistonpad-backup
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
docker compose exec -T db pg_dump -U spares -d spares -Fc > "backups/spares-$(date +%F).dump"
find backups -name 'spares-*.dump' -mtime +14 -delete
