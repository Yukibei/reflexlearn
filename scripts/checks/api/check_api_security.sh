#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults
export API_PORT="${1:-${API_PORT:-$(env_port API_PORT 28000)}}"

{
  log_header "check_api_security"
  "$(python_cmd)" - "$API_PORT" <<'PY'
import asyncio
import os
import sys
import time

import httpx

API_ROOT = f"http://127.0.0.1:{sys.argv[1]}"
API = f"{API_ROOT}/api"
AUTH_USER = os.getenv("REFLEXLEARN_HEALTH_USER", "admin")
AUTH_PASSWORD = os.getenv("REFLEXLEARN_HEALTH_PASSWORD", "reflexlearn-admin")


async def wait_api(client: httpx.AsyncClient) -> None:
    deadline = time.time() + 60
    last_error = None
    while time.time() < deadline:
        try:
            resp = await client.get(f"{API}/health")
            if resp.status_code == 200 and resp.json().get("status") == "ok":
                print("[OK] api health")
                return
        except Exception as e:
            last_error = e
        await asyncio.sleep(1)
    raise RuntimeError(f"api health timeout: {last_error}")


async def login_headers(client: httpx.AsyncClient) -> dict[str, str]:
    resp = await client.post(
        f"{API}/auth/login",
        json={"username": AUTH_USER, "password": AUTH_PASSWORD},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    print("[OK] api auth login")
    return {"Authorization": f"Bearer {token}"}


async def check_me(client: httpx.AsyncClient, headers: dict[str, str]) -> None:
    resp = await client.get(f"{API}/auth/me", headers=headers)
    resp.raise_for_status()
    body = resp.json()
    if body.get("user_id") != AUTH_USER:
        raise RuntimeError(f"unexpected /me body: {body}")
    print("[OK] api auth me")


async def check_unauthorized(client: httpx.AsyncClient) -> None:
    chat = await client.post(f"{API}/chat", json={"message": "hi"})
    upload = await client.post(
        f"{API}/knowledge/upload",
        files={"file": ("note.txt", b"hello", "text/plain")},
    )
    video = await client.post(f"{API}/video/jobs", json={"storyboard": "scene"})
    if [chat.status_code, upload.status_code, video.status_code] != [401, 401, 401]:
        raise RuntimeError(
            f"expected 401 for protected routes, got "
            f"chat={chat.status_code} upload={upload.status_code} video={video.status_code}"
        )
    print("[OK] protected routes require bearer token")


async def check_upload_guard(client: httpx.AsyncClient, headers: dict[str, str]) -> None:
    resp = await client.post(
        f"{API}/knowledge/upload",
        files={"file": ("shell.exe", b"MZ\x00\x00", "application/octet-stream")},
        headers=headers,
    )
    if resp.status_code != 415:
        raise RuntimeError(f"expected upload guard 415, got {resp.status_code}: {resp.text}")
    print("[OK] upload guard rejects unsupported file")


async def check_video_auth(client: httpx.AsyncClient, headers: dict[str, str]) -> None:
    resp = await client.post(
        f"{API}/video/jobs",
        json={"storyboard": "Scene 1: Auth smoke."},
        headers=headers,
    )
    resp.raise_for_status()
    if not resp.json().get("job_id"):
        raise RuntimeError(f"missing job_id: {resp.text}")
    print("[OK] video submit with auth")


async def check_metrics(client: httpx.AsyncClient) -> None:
    resp = await client.get(f"{API_ROOT}/metrics")
    resp.raise_for_status()
    text = resp.text
    if "reflexlearn_http_requests_total" not in text:
        raise RuntimeError("metrics endpoint missing http request counter")
    print("[OK] prometheus metrics")


async def main() -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        await wait_api(client)
        await check_metrics(client)
        await check_unauthorized(client)
        headers = await login_headers(client)
        await check_me(client, headers)
        await check_upload_guard(client, headers)
        await check_video_auth(client, headers)


asyncio.run(main())
PY
} 2>&1 | tee -a "$LOG_DIR/check_api_security.log"
