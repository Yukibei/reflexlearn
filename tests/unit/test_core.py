"""验证 LangGraph 图能正常构建和编译。"""
import pytest


def test_graph_builds():
    from reflexlearn.orchestration.graph import build_graph
    from reflexlearn.llm_gateway.gateway import LLMGateway

    llm = LLMGateway()
    graph = build_graph(llm)
    assert graph is not None


def test_state_schema():
    from reflexlearn.orchestration.state import AgentState

    state: AgentState = {
        "user_id": "test",
        "acl": {},
        "messages": [],
        "learner_profile": {},
        "learning_goal": "test",
        "collab_mode": "central",
        "plan": [],
        "completed": [],
        "reflections": [],
        "iteration": 0,
        "replan_count": 0,
        "token_used": 0,
        "halt_reason": None,
        "conflict": None,
        "debate_rounds": None,
        "debate_verdict": None,
        "resource_bundle": None,
        "learning_path": None,
    }
    assert state["user_id"] == "test"
    assert state["iteration"] == 0


def test_schemas():
    from reflexlearn.orchestration.schemas import (
        LearnerProfile,
        ResourceSpec,
        VerifyResult,
        Reflection,
        ACLScope,
    )

    profile = LearnerProfile(goal="学习线性回归")
    assert profile.cognitive_style == "active"

    spec = ResourceSpec(type="doc", concept_ids=["linear_regression"])
    assert spec.difficulty == 0.5

    vr = VerifyResult(passed=True, score=0.9)
    assert vr.layer_failed == "none"

    r = Reflection(task_type="doc_gen", failure_type="empty", cause="检索为空", fix_strategy="换策略")
    assert r.success is False

    acl = ACLScope(user_id="u1")
    assert "public" in acl.visibility


def test_skill_base():
    from reflexlearn.skills.base import SkillContext, SkillResult

    ctx = SkillContext(user_id="u1", acl={}, task_id="t1")
    assert ctx.trace_id == ""

    result = SkillResult(ok=True, data={"test": 1}, duration_ms=50)
    assert result.cached is False


def test_run_debug_scripts_have_logging_contract():
    root = __import__("pathlib").Path(__file__).resolve().parents[2]
    scripts = root / "scripts"
    moved = {
        "start_core.sh": "ops/start_core.sh",
        "start_graph.sh": "ops/start_graph.sh",
        "start_bigdata.sh": "ops/start_bigdata.sh",
        "start_full.sh": "ops/start_full.sh",
        "stop_all.sh": "ops/stop_all.sh",
        "init_all.sh": "init/init_all.sh",
        "check_bigdata.sh": "checks/infra/check_bigdata.sh",
    }
    required = [
        "start_core.sh",
        "start_graph.sh",
        "start_bigdata.sh",
        "start_full.sh",
        "start_api.sh",
        "start_frontend.sh",
        "build_frontend.sh",
        "clean_frontend.sh",
        "stop_frontend.sh",
        "stop_all.sh",
        "test_unit.sh",
        "init_all.sh",
        "check_bigdata.sh",
        "check_api.sh",
        "stop_api.sh",
    ]

    for name in required:
        path = scripts / name
        assert path.exists(), f"missing {name}"
        text = path.read_text(encoding="utf-8")
        assert 'source "$SCRIPT_DIR/_lib.sh"' in text
        assert "ensure_logs" in text
        if name in moved:
            impl = scripts / moved[name]
            assert f'exec "$SCRIPT_DIR/{moved[name]}" "$@"' in text
            impl_text = impl.read_text(encoding="utf-8")
            assert 'source "$SCRIPTS_ROOT/_lib.sh"' in impl_text
            assert 'tee -a "$LOG_DIR/' in impl_text
        else:
            assert 'tee -a "$LOG_DIR/' in text

    assert "--profile bigdata" in (scripts / "ops/start_full.sh").read_text(encoding="utf-8")
    assert "--profile bigdata" in (scripts / "ops/stop_all.sh").read_text(encoding="utf-8")


def test_bigdata_images_use_configured_mirror_prefix():
    root = __import__("pathlib").Path(__file__).resolve().parents[2]
    import yaml

    compose = yaml.safe_load((root / "docker-compose.yml").read_text(encoding="utf-8"))
    services = compose["services"]

    assert services["kafka"]["image"].startswith("${DOCKER_IMAGE_PREFIX")
    assert services["minio"]["image"].startswith("${DOCKER_IMAGE_PREFIX")


def test_common_db_keeps_heavy_clients_lazy():
    root = __import__("pathlib").Path(__file__).resolve().parents[2]
    text = (root / "src" / "reflexlearn" / "common" / "db.py").read_text(encoding="utf-8")
    top_imports = [
        line.strip()
        for line in text.splitlines()
        if line.startswith("import ") or line.startswith("from ")
    ]

    assert "from qdrant_client import AsyncQdrantClient" not in top_imports
    assert "import asyncpg" not in top_imports
    assert "import redis.asyncio as aioredis" not in top_imports


def test_api_script_does_not_reload_on_log_writes():
    root = __import__("pathlib").Path(__file__).resolve().parents[2]
    text = (root / "scripts" / "start_api.sh").read_text(encoding="utf-8")
    check_text = (root / "scripts" / "check_api.sh").read_text(encoding="utf-8")
    stop_text = (root / "scripts" / "stop_api.sh").read_text(encoding="utf-8")

    assert "--reload" not in text
    assert "API_PORT" in text
    assert "API_PORT" in check_text
    assert "API_PORT" in stop_text
    # 端口取值四级：位置参数 > 环境变量 > .env（单一事实源）> 兜底默认。
    # 本机多项目共存，8000 被占用，应用端口统一迁到 2xxxx 段。
    assert '${1:-${API_PORT:-$(env_port API_PORT 28000)}}' in text
    assert '${1:-${API_PORT:-$(env_port API_PORT 28000)}}' in check_text
    assert '${1:-${API_PORT:-$(env_port API_PORT 28000)}}' in stop_text


def test_frontend_scripts_support_port_and_api_base_overrides():
    root = __import__("pathlib").Path(__file__).resolve().parents[2]
    start_text = (root / "scripts" / "start_frontend.sh").read_text(encoding="utf-8")
    build_text = (root / "scripts" / "build_frontend.sh").read_text(encoding="utf-8")
    stop_text = (root / "scripts" / "stop_frontend.sh").read_text(encoding="utf-8")

    assert 'FRONTEND_PORT="${1:-${FRONTEND_PORT:-$(env_port FRONTEND_PORT 23002)}}"' in start_text
    # 默认相对 /api：浏览器同源请求经 next.config rewrites 代理到 BACKEND_ORIGIN，
    # HttpOnly 会话 cookie 才能在刷新后随请求发送（绝对地址跨站会丢 cookie）。
    assert 'FRONTEND_API_BASE="${2:-${NEXT_PUBLIC_API_BASE:-/api}}"' in start_text
    assert (
        'BACKEND_ORIGIN="${3:-${BACKEND_ORIGIN:-http://127.0.0.1:$(env_port API_PORT 28000)}}"'
        in start_text
    )
    assert 'NEXT_PUBLIC_API_BASE="$FRONTEND_API_BASE"' in start_text
    assert '--port "$FRONTEND_PORT"' in start_text
    # 当前开发环境是 WSL bash；cmd.exe //C 会打开交互式 cmd 并空跑，必须使用 /C。
    assert "cmd.exe /C" in start_text
    assert "cmd.exe //C" not in start_text
    assert (
        "set NEXT_PUBLIC_API_BASE=$FRONTEND_API_BASE&& set BACKEND_ORIGIN=$BACKEND_ORIGIN&& npm run dev"
        in start_text
    )
    assert 'FRONTEND_API_BASE="${1:-${NEXT_PUBLIC_API_BASE:-/api}}"' in build_text
    assert (
        'BACKEND_ORIGIN="${2:-${BACKEND_ORIGIN:-http://127.0.0.1:$(env_port API_PORT 28000)}}"'
        in build_text
    )
    assert (
        "set NEXT_PUBLIC_API_BASE=$FRONTEND_API_BASE&& set BACKEND_ORIGIN=$BACKEND_ORIGIN&& npm run build"
        in build_text
    )
    assert 'FRONTEND_PORT="${1:-${FRONTEND_PORT:-$(env_port FRONTEND_PORT 23002)}}"' in stop_text


def test_stop_api_avoids_powershell_reserved_pid_variable():
    root = __import__("pathlib").Path(__file__).resolve().parents[2]
    text = (root / "scripts" / "stop_api.sh").read_text(encoding="utf-8")

    assert "foreach (\\$pid" not in text
    assert "uvicorn reflexlearn.main:app" in text
    assert "\\$_.Name -like 'python*'" in text
    assert "--multiprocessing-fork" in text
    assert text.count("-ErrorAction SilentlyContinue") >= 2


def test_configure_logging_writes_file(tmp_path, monkeypatch):
    from reflexlearn.common.logging import configure_logging
    import logging

    log_file = tmp_path / "api.log"
    monkeypatch.setenv("REFLEXLEARN_LOG_FILE", str(log_file))

    configure_logging(force=True)
    logging.getLogger("reflexlearn.test").info("file-output-ok")

    text = log_file.read_text(encoding="utf-8")
    assert "file-output-ok" in text


def test_configure_logging_adds_file_handler_when_handlers_exist(tmp_path, monkeypatch):
    from reflexlearn.common.logging import configure_logging
    import io
    import logging

    root = logging.getLogger()
    old_handlers = root.handlers[:]
    old_level = root.level
    try:
        root.handlers = [logging.StreamHandler(io.StringIO())]
        root.setLevel(logging.INFO)
        log_file = tmp_path / "api.log"
        monkeypatch.setenv("REFLEXLEARN_LOG_FILE", str(log_file))

        configure_logging()
        logging.getLogger("reflexlearn.test").info("existing-handler-file-output")

        assert "existing-handler-file-output" in log_file.read_text(encoding="utf-8")
    finally:
        root.handlers = old_handlers
        root.setLevel(old_level)
