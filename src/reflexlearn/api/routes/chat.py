from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from reflexlearn.api.deps import get_current_user
from reflexlearn.api.service_deps import safe_pg_pool
from reflexlearn.collaboration.traces import get_default_trace_store
from reflexlearn.common.auth import CurrentUser
from reflexlearn.learning.spaces import SessionOutcome, get_space_store
from reflexlearn.learning.tutoring import answer_question
from reflexlearn.llm_gateway.gateway import LLMGateway
from reflexlearn.orchestration.graph import run_session
from reflexlearn.orchestration.intent import TutorIntent, classify_intent, direct_reply_for
from reflexlearn.safety import SafetyGateway, safety_audit_event
from reflexlearn.security.audit import AuditLog

router = APIRouter()

logger = logging.getLogger(__name__)

_llm: LLMGateway | None = None


def _get_llm() -> LLMGateway:
    global _llm
    if _llm is None:
        _llm = LLMGateway()
    return _llm


def set_llm_for_tests(gateway) -> None:
    global _llm
    _llm = gateway


def reset_llm_for_tests() -> None:
    global _llm
    _llm = None


def sse_event(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


class ChatRequest(BaseModel):
    message: str
    user_id: str = "anonymous"
    session_id: str = ""
    space_id: str = ""


async def _record_trace(pg_pool, user_id: str, tenant_id: str, session_id: str, node: str, payload: dict) -> None:
    try:
        await get_default_trace_store().record(
            user_id=user_id,
            tenant_id=tenant_id,
            session_id=session_id,
            node=node,
            event_type="agent_step",
            payload=payload,
            pg_pool=pg_pool,
        )
    except Exception:
        return


async def event_stream(
    message: str,
    user_id: str,
    tenant_id: str,
    session_id: str,
    pg_pool=None,
    space_id: str = "",
):
    # 首帧回传原始 session_id：前端仅在当前浏览器会话内保存，服务端存储另做用户/租户隔离。
    yield sse_event("session", {"session_id": session_id})
    await _record_trace(
        pg_pool,
        user_id,
        tenant_id,
        session_id,
        "session_start",
        {"message": message[:200]},
    )
    yield sse_event("agent_step", {"step": "session_start", "message": message})

    gateway = SafetyGateway()
    input_decision = gateway.check_input(message)
    if not input_decision.allowed:
        await AuditLog(pg_pool=pg_pool).record(
            safety_audit_event(
                stage="input",
                decision=input_decision,
                user_id=user_id,
                tenant_id=tenant_id,
            )
        )
        yield sse_event("error", {"error": "input_blocked", "reasons": input_decision.reasons})
        yield sse_event("done", {"status": "blocked"})
        return

    # 意图分流：导师只做学术答疑、生成学习方案、拒绝范围外请求三件事。
    # 只有 learning_plan 才值得跑完整多智能体链路并沉淀学习目标——其余意图
    # 走到下面的 run_session 会白花十几次外呼，还会凭空建出一个学习目标。
    decision = await classify_intent(message, gateway=_get_llm())
    yield sse_event(
        "agent_step",
        {"step": "intent", "detail": f"识别意图：{decision.intent.value}", "source": decision.source},
    )

    reply = direct_reply_for(decision.intent)
    if reply is not None:
        yield sse_event("assistant_message", {"content": reply})
        yield sse_event("done", {"status": "completed"})
        return

    if decision.intent is TutorIntent.ACADEMIC_QA:
        result = await answer_question(
            message,
            user_id=user_id,
            tenant_id=tenant_id,
            gateway=_get_llm(),
        )
        yield sse_event("assistant_message", {"content": result.answer})
        yield sse_event("done", {"status": "completed", "degraded": result.degraded})
        return

    # 收集本次会话的可沉淀产出（assemble 资源全文 + path_plan 路径），done 前落空间。
    final_resources: list[dict] = []
    final_path: dict = {}
    try:
        async for event in run_session(message, user_id, session_id, tenant_id):
            # PERF-A 增量帧：generator 经 custom 通道上抛的 token 增量，转 resource_delta SSE。
            if "__stream__" in event:
                delta = event["__stream__"]
                if isinstance(delta, dict):
                    yield sse_event("resource_delta", _safe_delta(gateway, delta))
                continue
            for node_name, node_output in event.items():
                if isinstance(node_output, dict):
                    await _record_trace(
                        pg_pool,
                        user_id,
                        tenant_id,
                        session_id,
                        node_name,
                        _trace_payload(node_name, node_output),
                    )
                if node_name == "profile":
                    yield sse_event("agent_step", {"step": "profile", "detail": "画像构建完成"})

                elif node_name == "planner":
                    plan = node_output.get("plan", [])
                    yield sse_event(
                        "agent_step",
                        {"step": "planner", "detail": f"规划了 {len(plan)} 个资源任务"},
                    )

                elif node_name == "generate_resource":
                    completed = node_output.get("completed", [])
                    for item in completed:
                        if item.get("status") == "passed":
                            yield sse_event(
                                "resource_card",
                                {
                                    "type": item.get("type", "doc"),
                                    "task_id": item.get("task_id", ""),
                                    "content": gateway.check_output(item.get("content", "")).redacted_text[:200],
                                },
                            )

                elif node_name == "gate":
                    yield sse_event("agent_step", {"step": "gate", "detail": "验收完成"})

                elif node_name == "critic":
                    reflections = node_output.get("reflections", [])
                    latest = reflections[-1] if reflections else {}
                    yield sse_event(
                        "agent_step",
                        {
                            "step": "critic",
                            "detail": latest.get("fix_strategy", "失败归因完成，准备重规划"),
                        },
                    )

                elif node_name == "debate":
                    for item in node_output.get("debate_rounds", []):
                        yield sse_event("debate_round", item)

                elif node_name == "judge":
                    yield sse_event(
                        "judge_verdict",
                        node_output.get("debate_verdict", {}),
                    )

                elif node_name == "pipeline":
                    completed = node_output.get("completed", [])
                    for item in completed:
                        if item.get("status") == "passed":
                            yield sse_event(
                                "resource_card",
                                {
                                    "type": item.get("type", "doc"),
                                    "task_id": item.get("task_id", ""),
                                    "content": gateway.check_output(item.get("content", "")).redacted_text[:200],
                                },
                            )
                    passed_n = sum(1 for c in completed if c.get("status") == "passed")
                    yield sse_event(
                        "agent_step",
                        {"step": "pipeline", "detail": f"流水线完成 {passed_n} 段"},
                    )

                elif node_name == "assemble":
                    bundle = node_output.get("resource_bundle", {})
                    total = bundle.get("total", 0)
                    yield sse_event(
                        "agent_step",
                        {"step": "assemble", "detail": f"组装完成，共 {total} 个资源"},
                    )

                    if bundle.get("resources"):
                        final_resources = list(bundle["resources"])
                        for res in bundle["resources"]:
                            yield sse_event(
                                "resource_card",
                                {
                                    "type": res.get("type", "doc"),
                                    "task_id": res.get("task_id", ""),
                                    "content": gateway.check_output(res.get("content", "")).redacted_text,
                                },
                            )

                elif node_name == "path_plan":
                    path = node_output.get("learning_path", []) or []
                    final_path = {
                        "steps": path,
                        "summary": node_output.get("path_summary", ""),
                        "strategy": node_output.get("path_strategy", ""),
                    }
                    yield sse_event(
                        "learning_path",
                        {
                            "steps": path,
                            "summary": node_output.get("path_summary", ""),
                            "strategy": node_output.get("path_strategy", ""),
                        },
                    )
                    yield sse_event(
                        "agent_step",
                        {"step": "path_plan", "detail": f"生成 {len(path)} 步个性化学习路径"},
                    )

    except Exception as e:
        yield sse_event("error", {"error": str(e)})

    try:
        saved = await _persist_outcome(
            space_id=space_id,
            message=message,
            user_id=user_id,
            tenant_id=tenant_id,
            final_resources=final_resources,
            final_path=final_path,
            pg_pool=pg_pool,
        )
        if saved:
            yield sse_event("space_saved", saved)
    except Exception as exc:
        # 沉淀失败不该中断已经产出的对话，但也不能无声无息——否则「资源生成了却没落库」
        # 只能靠翻数据库才发现。
        logger.warning("persist session outcome failed: %s: %s", type(exc).__name__, exc)

    yield sse_event("done", {"status": "completed"})


async def _persist_outcome(
    *,
    space_id: str,
    message: str,
    user_id: str,
    tenant_id: str,
    final_resources: list[dict],
    final_path: dict,
    pg_pool=None,
) -> dict | None:
    """有实质产出（资源或路径）才沉淀；未指定空间时自动按学习目标创建。"""
    path_steps = final_path.get("steps", []) or []
    if not final_resources and not path_steps:
        return None
    store = get_space_store()
    target_space = space_id
    if not target_space:
        created = await store.create_space(
            user_id=user_id,
            tenant_id=tenant_id,
            title=message[:80],
            pg_pool=pg_pool,
        )
        target_space = created.space_id
    concept_by_task = {
        str(s.get("task_id")): str(s.get("concept") or "")
        for s in path_steps
        if s.get("task_id")
    }
    resources = [
        {
            "type": r.get("type", "doc"),
            "content": r.get("content", ""),
            "concept": concept_by_task.get(str(r.get("task_id", "")), ""),
            "title": concept_by_task.get(str(r.get("task_id", "")), "") or message[:40],
        }
        for r in final_resources
    ]
    outcome = SessionOutcome(
        resources=resources,
        path_steps=path_steps,
        path_summary=str(final_path.get("summary", "")),
        path_strategy=str(final_path.get("strategy", "")),
    )
    return await store.save_session_outcome(
        space_id=target_space,
        user_id=user_id,
        tenant_id=tenant_id,
        outcome=outcome,
        pg_pool=pg_pool,
    )


def _safe_delta(gateway: SafetyGateway, delta: dict) -> dict:
    """增量帧透传 task_id/type/reset，仅对文本做输出安全脱敏（末帧完整卡片仍会再脱敏一次）。"""
    return {
        "task_id": str(delta.get("task_id", "")),
        "type": str(delta.get("type", "doc")),
        "delta": gateway.check_output(str(delta.get("delta", ""))).redacted_text,
        "reset": bool(delta.get("reset", False)),
    }


def _trace_payload(node_name: str, node_output: dict) -> dict:
    if node_name == "planner":
        return {"plan_count": len(node_output.get("plan", []))}
    if node_name in {"generate_resource", "pipeline"}:
        completed = node_output.get("completed", [])
        return {
            "completed": len(completed),
            "passed": sum(1 for item in completed if item.get("status") == "passed"),
        }
    if node_name == "assemble":
        bundle = node_output.get("resource_bundle", {}) or {}
        return {"total": bundle.get("total", 0)}
    if node_name == "path_plan":
        return {"steps": len(node_output.get("learning_path", []) or [])}
    return {"keys": sorted(str(key) for key in node_output.keys() if not str(key).startswith("_"))[:12]}


@router.post("/chat")
async def chat(req: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    # session_id 缺省由后端生成（uuid hex）；前端首轮不带、后续带回延续会话
    session_id = req.session_id or uuid.uuid4().hex
    pg_pool = await safe_pg_pool()
    return StreamingResponse(
        event_stream(
            req.message,
            user.user_id,
            user.tenant_id,
            session_id,
            pg_pool=pg_pool,
            space_id=req.space_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream; charset=utf-8",
        },
    )
