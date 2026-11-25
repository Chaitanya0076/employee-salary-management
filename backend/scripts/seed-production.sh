#!/usr/bin/env bash
# One-off production seed (docs/deployment.md, step 2). WIPES all data, then loads
# the 10,000 demo employees and the HR Manager login.
#
# Every secret is typed at a hidden prompt: nothing goes on the command line or
# into shell history. Run from backend/:   bash scripts/seed-production.sh
set -euo pipefail
cd "$(dirname "$0")/.."

read -rsp 'Paste the External Database URL from Render, then Enter: ' DATABASE_URL; echo
[[ "$DATABASE_URL" == postgres* ]] || { echo 'That does not look like a postgres:// URL.' >&2; exit 1; }
# Render requires TLS for external connections.
[[ "$DATABASE_URL" == *sslmode=* ]] || DATABASE_URL+=$([[ "$DATABASE_URL" == *\?* ]] && echo '&' || echo '?')sslmode=require

read -rp 'HR login email: ' SEED_HR_EMAIL
read -rsp 'HR login password (12+ characters): ' SEED_HR_PASSWORD; echo
read -rsp 'Repeat the password: ' CONFIRM; echo
[[ "$SEED_HR_PASSWORD" == "$CONFIRM" ]] || { echo 'Passwords do not match.' >&2; exit 1; }

echo
echo "About to WIPE and seed: ${DATABASE_URL%%\?*}" | sed -E 's#//[^:]+:[^@]+@#//***:***@#'
read -rp 'Type "seed" to continue: ' ANSWER
[[ "$ANSWER" == seed ]] || { echo 'Cancelled.'; exit 1; }

DATABASE_URL="$DATABASE_URL" SEED_HR_EMAIL="$SEED_HR_EMAIL" SEED_HR_PASSWORD="$SEED_HR_PASSWORD" \
  NODE_ENV=production SEED_ALLOW_PRODUCTION=true npx tsx prisma/seed/index.ts
