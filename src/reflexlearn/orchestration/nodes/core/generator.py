from __future__ import annotations

import logging
import time

from reflexlearn.common.config import get_settings
from reflexlearn.orchestration.nodes.stream_bridge import emit_delta as _stream_emit
from reflexlearn.orchestration.nodes.stream_bridge import sink_for
from reflexlearn.orchestration.nodes.stream_bridge import stream_writer as _stream_writer
from reflexlearn.orchestration.state import AgentState
from reflexlearn.skills.base import SkillContext, SkillResult


logger = logging.getLogger(__name__)


async def generate_resource(state: AgentState) -> dict:
    started = time.perf_counter()
    task = state.get("_current_task")
    if not task:
        plan = state.get("plan", [])
        task = next((t for t in plan if t["status"] == "pending"), None)
        if not task:
            return {"completed": [{"task_id": "none", "status": "failed"}]}

    skills = state.get("_skills", {})
    retrieve_skill = skills.get("retrieve")
    quality_skill = skills.get("quality_check")

    ctx = SkillContext(
        user_id=state.get("user_id", "anonymous"),
        acl=state.get("acl", {}),
        task_id=task["task_id"],
    )

    settings = get_settings()
    _log_diag("task_start", task=task, status="start")
    context_text = await _retrieve_context(task, retrieve_skill, ctx)
    issues: list[str] = []
    max_steps = max(1, settings.max_react_steps)
    # PERF-A：在 LangGraph 流式 run 上下文内取 writer，逐 token 增量经 custom 通道上抛；
    # 非流式 run / 直接单测调用 → get_stream_writer 抛错 → None → 走一次性生成（零回归）。
    stream_writer = _stream_writer()
    # 流式是否真的接上，此前只有 mock 测试覆盖，真实链路无从判断——这里留一条诊断。
    _log_diag(
        "stream_writer",
        task=task,
        status="ready" if stream_writer is not None else "none",
    )

    for step in range(max_steps):
        _log_diag("react_step_start", task=task, step=step + 1, status="start")
        gen_skill = _select_generation_skill(task.get("type", "doc"), skills)
        gen_skill_name = _skill_name(gen_skill, f"{task.get('type', 'doc')}_gen")
        gen_started = time.perf_counter()
        _log_diag(
            "generation_start",
            task=task,
            step=step + 1,
            skill=gen_skill_name,
            status="start",
        )
        gen_ctx = ctx
        if stream_writer is not None:
            # 新一轮生成前发 reset，让前端清空上一轮（质检失败重生成）的残留增量
            _stream_emit(stream_writer, task, reset=True)
            gen_ctx = ctx.model_copy(update={"delta_sink": sink_for(stream_writer, task)})
        gen_result = await _run_generation(task, context_text, issues, skills, gen_ctx)
        _log_diag(
            "generation_end",
            task=task,
            step=step + 1,
            skill=gen_skill_name,
            status="ok" if gen_result.ok else "failed",
            duration_ms=_elapsed_ms(gen_started),
            error=gen_result.error_type or "",
        )
        if not gen_result.ok or not gen_result.data:
            issues = [gen_result.error_type or "生成失败"]
            continue

        content = gen_result.data.get("content", "")
        verify_started = time.perf_counter()
        _log_diag("quality_start", task=task, step=step + 1, status="start")
        verify = await _verify_content(content, task, state, quality_skill, ctx)
        _log_diag(
            "quality_end",
            task=task,
            step=step + 1,
            status="passed" if verify.get("passed") else "failed",
            duration_ms=_elapsed_ms(verify_started),
            fixable=verify.get("fixable", True),
        )
        if verify.get("passed"):
            _log_diag("task_end", task=task, status="passed", duration_ms=_elapsed_ms(started))
            return {
                "completed": [
                    {
                        "task_id": task["task_id"],
                        "status": "passed",
                        "type": task["type"],
                        "content": content,
                        "react_steps": step + 1,
                    }
                ]
            }

        issues = verify.get("issues", ["质量校验未通过"])
        if not verify.get("fixable", True):
            break

    _log_diag("task_end", task=task, status="failed", duration_ms=_elapsed_ms(started))
    return {
        "completed": [
            {
                "task_id": task["task_id"],
                "status": "failed",
                "type": task["type"],
                "issues": issues,
            }
        ]
    }


async def _retrieve_context(task: dict, retrieve_skill, ctx: SkillContext) -> str:
    if retrieve_skill:
        started = time.perf_counter()
        skill_name = _skill_name(retrieve_skill, "retrieve")
        _log_diag("retrieve_start", task=task, skill=skill_name, status="start")
        try:
            ret_result = await retrieve_skill.run(
                {"query": task["spec"].get("concept_ids", [""])[0]}, ctx
            )
        except Exception as exc:
            _log_diag(
                "retrieve_end",
                task=task,
                skill=skill_name,
                status="error",
                duration_ms=_elapsed_ms(started),
                error=type(exc).__name__,
            )
            return ""
        status = "ok" if ret_result.ok and ret_result.data else "empty"
        chunks = ret_result.data.get("chunks", []) if ret_result.data else []
        _log_diag(
            "retrieve_end",
            task=task,
            skill=skill_name,
            status=status,
            duration_ms=_elapsed_ms(started),
            error=ret_result.error_type or "",
            chunks=len(chunks),
        )
        if ret_result.ok and ret_result.data:
            return "\n".join(c.get("content", "") for c in chunks)
    else:
        _log_diag("retrieve_end", task=task, skill="retrieve", status="missing")
    return ""


async def _run_generation(
    task: dict,
    context_text: str,
    issues: list[str],
    skills: dict,
    ctx: SkillContext,
):
    skill = _select_generation_skill(task.get("type", "doc"), skills)
    if skill is None:
        return SkillResult(ok=False, error_type="generation_skill_missing")

    try:
        return await skill.run(
            {
                "spec": _generation_spec(task.get("spec", {}), issues),
                "context": context_text,
            },
            ctx,
        )
    except Exception as exc:
        return SkillResult(ok=False, error_type=type(exc).__name__)


def _generation_spec(spec: dict, issues: list[str]) -> dict:
    previous = list(issues)
    refine_hint = (spec or {}).get("refine_hint", "")
    if refine_hint:
        previous.append(str(refine_hint))
    return {**spec, "previous_issues": previous}


def _select_generation_skill(task_type: str, skills: dict):
    skill_name = f"{task_type}_gen"
    return skills.get(skill_name) or skills.get("doc_gen")


def _skill_name(skill, fallback: str) -> str:
    return str(getattr(skill, "name", fallback) or fallback)


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def _log_diag(
    stage: str,
    *,
    task: dict,
    status: str,
    step: int = 0,
    skill: str = "",
    duration_ms: int = 0,
    error: str = "",
    fixable: bool | None = None,
    chunks: int | None = None,
) -> None:
    try:
        if not get_settings().enable_generator_diagnostics:
            return
        parts = [
            "generator_diag",
            f"stage={stage}",
            f"task_id={task.get('task_id', '')}",
            f"type={task.get('type', '')}",
            f"status={status}",
        ]
        if step:
            parts.append(f"step={step}")
        if skill:
            parts.append(f"skill={skill}")
        if duration_ms:
            parts.append(f"duration_ms={duration_ms}")
        if error:
            parts.append(f"error={error}")
        if fixable is not None:
            parts.append(f"fixable={str(fixable).lower()}")
        if chunks is not None:
            parts.append(f"chunks={chunks}")
        logger.info(" ".join(parts))
    except Exception:
        return


async def _verify_content(
    content: str,
    task: dict,
    state: AgentState,
    quality_skill,
    ctx: SkillContext,
) -> dict:
    if quality_skill is None:
        return {"passed": True, "issues": [], "fixable": True}

    result = await quality_skill.run(
        {
            "content": content,
            "spec": task["spec"],
            "profile": state.get("learner_profile", {}),
        },
        ctx,
    )
    if result.ok and result.data:
        return {
            "passed": result.data.get("passed", False),
            "issues": result.data.get("issues", []),
            "fixable": result.data.get("fixable", True),
        }
    return {"passed": False, "issues": [result.error_type or "质量校验失败"], "fixable": True}
