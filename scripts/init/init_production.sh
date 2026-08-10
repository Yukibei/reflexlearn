#!/usr/bin/env bash
set -euo pipefail

mkdir -p logs

{
  printf '\n[%s] init_production\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  uv run --no-sync python scripts/init/init_db.py
  uv run --no-sync python scripts/init/init_qdrant.py
  uv run --no-sync python scripts/init/init_admin.py
  uv run --no-sync python -m reflexlearn.learning.seed_demo_cli \
    --user-id "${AUTH_DEMO_USERNAME:-admin}" \
    --tenant-id "${AUTH_DEMO_TENANT_ID:-default}"
} 2>&1 | tee -a logs/init_production.log
