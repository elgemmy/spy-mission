#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  npx supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

npx supabase start
npx supabase db reset --local --no-seed

set -a
eval "$(npx supabase status --output env)"
set +a

export RUN_SUPABASE_INTEGRATION=1
export SUPABASE_URL="${API_URL}"
export VITE_SUPABASE_URL="${API_URL}"
export VITE_SUPABASE_ANON_KEY="${ANON_KEY}"
export SUPABASE_SECRET_KEY="${SERVICE_ROLE_KEY}"
export SUPABASE_DB_URL="${DB_URL}"

npx vitest run src/server/rooms/service.integration.test.ts

npx supabase db reset --local --version 0003 --no-seed
psql "${DB_URL}" --set=ON_ERROR_STOP=1 --file supabase/tests/0003-populated.sql
psql "${DB_URL}" --set=ON_ERROR_STOP=1 --file supabase/migrations/0004_room_lifecycle.sql
psql "${DB_URL}" --set=ON_ERROR_STOP=1 --file supabase/migrations/0005_partner_mission.sql
psql "${DB_URL}" --set=ON_ERROR_STOP=1 --file supabase/tests/0005-upgrade.test.sql
psql "${DB_URL}" --set=ON_ERROR_STOP=1 --file supabase/tests/0004-upgrade.test.sql
