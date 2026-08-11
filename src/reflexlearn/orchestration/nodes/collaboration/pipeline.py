from __future__ import annotations

import logging
import time

from reflexlearn.common.config import get_settings
from reflexlearn.orchestration.nodes.stream_bridge import emit_delta, sink_for, stream_writer
from reflexlearn.orchestration.state import AgentState
from reflexlearn.skills.base import SkillContext, SkillResult


ROLLBACK_BUDGET = 1
logger = logging.getLogger(__name__)


async def pipeline_node(state: AgentState) -> dict:
    """流水线协作：把 plan 当作强依赖链顺序执行，上游产出作为下游 context（上游输出入下游 spec）。

    每步后置校验 + 步内重试；某步彻底失败时回退一格（最多 ROLLBACK_BUDGET 次）重做上一步；
    回退预算耗尽或首步即失败则截断，已完成段作为部分结果并置 halt_reason，由 gate_route 短路降级收尾。
    整条链封装在单节点内（与 debate_node 同构），便于在节点内维护游标与回退。
    """
    plan = [t for t in state.get("plan", []) if t.get("status") == "pending"]
    skills = state.get("_skills", {})
    quality_skill = skills.get("quality_check")
    settings = get_settings()
    max_retries = max(1, settings.max_react_steps)
    _log_diag("start", plan_size=len(plan), status="start")

    if not plan:
        _log_diag("end", plan_size=0, status="empty")
        return {"completed": [], "iteration": state.get("iteration", 0) + 1}

    units: list[dict] = []
    upstream_content = ""
    rollback_budget = ROLLBACK_BUDGET
    i = 0
    # PERF-A：流水线同样要把逐 token 增量推给前端。此前只有 generate_resource 接了流式，
    # 而 planner 常把 collab_mode 判成 pipeline，导致真实会话一帧增量都不出。
    writer = stream_writer()
    _log_diag("stream_writer", status="ready" if writer is not None else "none")

    while i < len(plan):
        task = plan[i]
        _log_diag("step_start", task=task, step=i + 1, status="start")
        ctx = SkillContext(
            user_id=state.get("user_id", "anonymous"),
            acl=state.get("acl", {}),
            task_id=task["task_id"],
        )
        issues: list[str] = []
        step_passed = False

        for retry_index in range(max_retries):
            retry_step = retry_index + 1
            skill = _select_gen_skill(task.get("type", "doc"), skills)
            skill_name = _skill_name(skill, f"{task.get('type', 'doc')}_gen")
            gen_started = time.perf_counter()
            _log_diag(
                "generation_start",
                task=task,
                step=i + 1,
                retry=retry_step,
                skill=skill_name,
                status="start",
            )
            gen_ctx = ctx
            if writer is not None:
                # 每次重试前 reset，让前端清掉上一轮失败生成的残留增量
                emit_delta(writer, task, reset=True)
                gen_ctx = ctx.model_copy(update={"delta_sink": sink_for(writer, task)})
            gen = await _run_step(task, upstream_content, issues, skills, gen_ctx)
            _log_diag(
                "generation_end",
                task=task,
                step=i + 1,
                retry=retry_step,
                skill=skill_name,
                status="ok" if gen.ok else "failed",
                duration_ms=_elapsed_ms(gen_started),
                error=gen.error_type or "",
            )
            if not gen.ok or not gen.data:
                issues = [gen.error_type or "生成失败"]
                continue

            content = gen.data.get("content", "")
            verify_started = time.perf_counter()
            _log_diag("quality_start", task=task, step=i + 1, retry=retry_step, status="start")
            verify = await _verify_step(content, task, state, quality_skill, ctx)
            _log_diag(
                "quality_end",
                task=task,
                step=i + 1,
                retry=retry_step,
                status="passed" if verify.get("passed") else "failed",
                duration_ms=_elapsed_ms(verify_started),
                fixable=verify.get("fixable", True),
            )
            if verify.get("passed"):
                units.append(_passed_unit(task, content, i))
                upstream_content = content  # 上游产出注入下一步 context
                step_passed = True
                break

            issues = verify.get("issues", ["质量校验未通过"])
            if not verify.get("fixable", True):
                break

        if step_passed:
            i += 1
            continue

        # 失败回退一格：丢弃上一步产物、回退上游 context、重做上一步
        if i > 0 and rollback_budget > 0:
            rollback_budget -= 1
            _log_diag("rollback", task=task, step=i + 1, status="retry_previous")
            units.pop()
            upstream_content = units[-1]["content"] if units else ""
            i -= 1
            continue

        # 回退预算耗尽 / 首步即失败：截断，部分结果降级收尾
        units.append(_failed_unit(task, issues))
        _log_diag("end", task=task, step=i + 1, status="partial", plan_size=len(plan))
        return {
            "completed": units,
            "halt_reason": "pipeline_partial",
            "iteration": state.get("iteration", 0) + 1,
        }

    _log_diag("end", plan_size=len(plan), status="passed")
    return {"completed": units, "iteration": state.get("iteration", 0) + 1}


async def _run_step(
    task: dict,
    upstream_content: str,
    issues: list[str],
    skills: dict,
    ctx: SkillContext,
) -> SkillResult:
    skill = _select_gen_skill(task.get("type", "doc"), skills)
    if skill is None:
        return SkillResult(ok=False, error_type="generation_skill_missing")

    return await skill.run(
        {
            "spec": {**task["spec"], "previous_issues": issues},
            "context": upstream_content,
        },
        ctx,
    )


async def _verify_step(
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


def _select_gen_skill(task_type: str, skills: dict):
    return skills.get(f"{task_type}_gen") or skills.get("doc_gen")


def _skill_name(skill, fallback: str) -> str:
    return str(getattr(skill, "name", fallback) or fallback)


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def _log_diag(
    stage: str,
    *,
    status: str,
    task: dict | None = None,
    step: int = 0,
    retry: int = 0,
    skill: str = "",
    duration_ms: int = 0,
    error: str = "",
    fixable: bool | None = None,
    plan_size: int | None = None,
) -> None:
    try:
        if not get_settings().enable_generator_diagnostics:
            return
        parts = ["pipeline_diag", f"stage={stage}", f"status={status}"]
        if task:
            parts.append(f"task_id={task.get('task_id', '')}")
            parts.append(f"type={task.get('type', '')}")
        if step:
            parts.append(f"step={step}")
        if retry:
            parts.append(f"retry={retry}")
        if skill:
            parts.append(f"skill={skill}")
        if duration_ms:
            parts.append(f"duration_ms={duration_ms}")
        if error:
            parts.append(f"error={error}")
        if fixable is not None:
            parts.append(f"fixable={str(fixable).lower()}")
        if plan_size is not None:
            parts.append(f"plan_size={plan_size}")
        logger.info(" ".join(parts))
    except Exception:
        return


def _passed_unit(task: dict, content: str, step_index: int) -> dict:
    return {
        "task_id": task["task_id"],
        "status": "passed",
        "type": task.get("type", "doc"),
        "content": content,
        "pipeline_step": step_index + 1,
    }


def _failed_unit(task: dict, issues: list[str]) -> dict:
    return {
        "task_id": task["task_id"],
        "status": "failed",
        "type": task.get("type", "doc"),
        "issues": issues,
    }
