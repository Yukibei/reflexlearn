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
  log_header "check_wave2_api"
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


async def check_mistakes(client: httpx.AsyncClient) -> str:
    resp = await client.post(
        f"{API}/mistakes",
        json={
            "question": "为什么过拟合模型泛化差？",
            "answer": "训练集太少",
            "expected": "模型复杂度过高，需要正则化和验证集约束。",
            "concept": "过拟合",
        },
        headers=headers("wave2-u1"),
    )
    resp.raise_for_status()
    mistake_id = resp.json()["mistake_id"]

    denied = await client.get(f"{API}/mistakes/{mistake_id}", headers=headers("wave2-u2"))
    if denied.status_code != 403:
        raise RuntimeError(f"mistake cross-user expected 403, got {denied.status_code}")

    review = await client.post(
        f"{API}/mistakes/{mistake_id}/review",
        headers=headers("wave2-u1"),
    )
    review.raise_for_status()
    if not review.json().get("review_plan"):
        raise RuntimeError("mistake review missing review_plan")
    print(f"[OK] mistakes create/review/acl mistake_id={mistake_id}")
    return mistake_id


async def check_video_acl(client: httpx.AsyncClient) -> None:
    resp = await client.post(
        f"{API}/video/jobs",
        json={"storyboard": "Scene 1: Explain object-level ACL."},
        headers=headers("wave2-u1"),
    )
    resp.raise_for_status()
    job_id = resp.json()["job_id"]
    denied = await client.get(f"{API}/video/jobs/{job_id}", headers=headers("wave2-u2"))
    if denied.status_code != 403:
        raise RuntimeError(f"video cross-user expected 403, got {denied.status_code}")
    print(f"[OK] video object acl job_id={job_id}")


async def check_traces(client: httpx.AsyncClient) -> None:
    resp = await client.get(f"{API}/collaboration/traces", headers=headers("wave2-u1"))
    resp.raise_for_status()
    if "items" not in resp.json():
        raise RuntimeError("trace list missing items")
    print("[OK] collaboration traces query")


async def check_workspace_acl_lists(client: httpx.AsyncClient) -> None:
    for path in ("spaces", "resources", "knowledge/documents"):
        resp = await client.get(f"{API}/{path}", headers=headers("wave2-u1"))
        resp.raise_for_status()
        if "items" not in resp.json():
            raise RuntimeError(f"{path} list missing items")
    print("[OK] workspace acl list endpoints")


async def main() -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        await wait_api(client)
        await check_mistakes(client)
        await check_video_acl(client)
        await check_traces(client)
        await check_workspace_acl_lists(client)


asyncio.run(main())
PY
} 2>&1 | tee -a "$LOG_DIR/check_wave2_api.log"
