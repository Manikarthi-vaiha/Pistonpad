#!/bin/sh
# Vercel build: prepare the database (if one is connected), then build the app.
set -e
if [ -n "$DATABASE_URL_UNPOOLED" ] || [ -n "$DATABASE_URL" ]; then
  node scripts/migrate.mjs
  npx tsx scripts/seed.ts
else
  echo "No database connected: skipping migrations and seed."
fi
exec npx next build
