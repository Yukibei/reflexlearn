#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults
API_PORT="${1:-${API_PORT:-$(env_port API_PORT 28000)}}"

{
  log_header "check_mistake_flywheel"
  "$(python_cmd)" - "$API_PORT" <<'PY'
import asyncio
import sys
import time

import httpx

from reflexlearn.common.auth import CurrentUser, issue_token
from reflexlearn.common.config import Settings

API = f"http://127.0.0.1:{sys.argv[1]}/api"


def headers(user_id: str) -> dict[str, str]:
    token = issue_token(
        CurrentUser(user_id=user_id, tenant_id="default", role="student"),
        Settings(),
    )
    return {"Authorization": f"Bearer {token}"}


async def wait_api(client: httpx.AsyncClient) -> None:
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            resp = await client.get(f"{API}/health")
            if resp.status_code == 200:
                print("[OK] api health")
                return
        except Exception:
            pass
        await asyncio.sleep(1)
    raise RuntimeError("api health timeout")


async def main() -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        await wait_api(client)
        owner = headers("flywheel-u1")
        other = headers("flywheel-u2")
        created = await client.post(
            f"{API}/mistakes",
            json={
                "question": "用 Python 写线性回归梯度下降，为什么损失没有下降？",
                "answer": "直接把梯度加到参数上。",
                "expected": "应沿负梯度方向更新，并检查学习率和梯度公式。",
                "concept": "梯度下降",
            },
            headers=owner,
        )
        created.raise_for_status()
        mistake_id = created.json()["mistake_id"]

        reflected = await client.post(f"{API}/mistakes/{mistake_id}/reflect", headers=owner)
        reflected.raise_for_status()
        if not reflected.json().get("category"):
            raise RuntimeError("reflection missing category")

        planned = await client.post(f"{API}/mistakes/{mistake_id}/plan", headers=owner)
        planned.raise_for_status()
        steps = planned.json().get("steps", [])
        if not (3 <= len(steps) <= 5):
            raise RuntimeError(f"plan expected 3-5 steps, got {len(steps)}")

        resources = await client.post(f"{API}/mistakes/{mistake_id}/resources", headers=owner)
        resources.raise_for_status()
        types = {item["type"] for item in resources.json().get("resources", [])}
        if not {"doc", "quiz"}.issubset(types):
            raise RuntimeError(f"resources missing doc/quiz: {types}")

        reviewed = await client.patch(
            f"{API}/mistakes/{mistake_id}/review",
            json={"review_status": "reviewed"},
            headers=owner,
        )
        reviewed.raise_for_status()
        if reviewed.json().get("status") != "reviewed":
            raise RuntimeError("review status not persisted")

        denied = await client.post(f"{API}/mistakes/{mistake_id}/resources", headers=other)
        if denied.status_code != 403:
            raise RuntimeError(f"cross-user expected 403, got {denied.status_code}")

        print(f"[OK] mistake flywheel e2e mistake_id={mistake_id} types={sorted(types)}")


asyncio.run(main())
PY
} 2>&1 | tee -a "$LOG_DIR/check_mistake_flywheel.log"
