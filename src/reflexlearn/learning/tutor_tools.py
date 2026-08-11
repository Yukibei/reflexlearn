"""导师管家的只读工具集。

导师此前只能"说"：答题时只拿得到画像里的薄弱点，看不到学习目标、路径进度、
错题本，于是它是贴在项目上的聊天框，不是管家。这里把项目已有的领域接口暴露成
一组**无参只读**工具，让导师能纵观全局。

两条刻意的约束：
- 只读。写操作（改路径、删目标）风险远高于收益，误操作学习记录不可接受，
  第一版一律不给；导师可以"建议你去标记完成"，但不代你动数据。
- 无参数。LLM 只需从固定清单里挑名字，不必构造参数，调错的概率大幅降低。
用户身份一律由调用方注入，LLM 无法指定查谁的数据。
"""

from __future__ import annotations

import logging

from reflexlearn.learning.mistakes import MistakeStore
from reflexlearn.learning.path_ops import load_active_path_items
from reflexlearn.learning.spaces import get_space_store
from reflexlearn.memory import session_store

logger = logging.getLogger(__name__)

TOOL_CATALOG: dict[str, str] = {
    "learning_goals": "用户的学习目标列表与各自状态",
    "active_path": "当前学习路径的节点、掌握状态与下一步该学什么",
    "learner_profile": "学习画像：当前目标、薄弱点、知识掌握度",
    "recent_mistakes": "最近的错题、涉及概念与错因",
}

_EMPTY = "（暂无数据）"


async def collect_context(
    names: list[str],
    *,
    user_id: str,
    tenant_id: str,
    pg_pool=None,
) -> str:
    """执行选中的工具并拼成可读上下文。单个工具失败只影响自己那一段。"""
    sections: list[str] = []
    for name in names:
        if name not in TOOL_CATALOG:
            continue
        try:
            body = await _run_tool(name, user_id=user_id, tenant_id=tenant_id, pg_pool=pg_pool)
        except Exception as exc:
            logger.info("tutor tool %s degraded: %s", name, exc)
            body = "（该项数据暂时读取失败）"
        sections.append(f"【{TOOL_CATALOG[name]}】\n{body}")
    return "\n\n".join(sections)


async def _run_tool(name: str, *, user_id: str, tenant_id: str, pg_pool) -> str:
    if name == "learning_goals":
        return await _learning_goals(user_id, tenant_id, pg_pool)
    if name == "active_path":
        return await _active_path(user_id, tenant_id, pg_pool)
    if name == "learner_profile":
        return await _learner_profile(user_id, tenant_id)
    if name == "recent_mistakes":
        return await _recent_mistakes(user_id, tenant_id, pg_pool)
    return _EMPTY


async def _learning_goals(user_id: str, tenant_id: str, pg_pool) -> str:
    result = await get_space_store().list_spaces(
        user_id=user_id, tenant_id=tenant_id, pg_pool=pg_pool
    )
    items = result.get("items", []) if isinstance(result, dict) else []
    if not items:
        return _EMPTY
    lines = [
        f"- {item.get('title', '未命名')}（状态：{item.get('status', 'active')}）"
        for item in items[:12]
    ]
    return "\n".join(lines)


async def _active_path(user_id: str, tenant_id: str, pg_pool) -> str:
    items = await load_active_path_items(user_id=user_id, tenant_id=tenant_id, pg_pool=pg_pool)
    if not items:
        return _EMPTY
    done = sum(1 for i in items if i.mastery_status == "done")
    lines = [f"共 {len(items)} 步，已完成 {done} 步。"]
    for item in items[:10]:
        lines.append(
            f"- 第 {item.sequence} 步「{item.concept or '未命名'}」：{item.mastery_status}"
            + (f"；目标：{item.objective}" if item.objective else "")
        )
    return "\n".join(lines)


async def _learner_profile(user_id: str, tenant_id: str) -> str:
    profile = await session_store.load_profile(user_id, tenant_id=tenant_id)
    if not profile:
        return _EMPTY
    lines: list[str] = []
    if profile.get("goal"):
        lines.append(f"当前目标：{profile['goal']}")
    weak = profile.get("weak_points") or []
    if weak:
        lines.append("薄弱点：" + "、".join(str(w) for w in weak[:8]))
    base = profile.get("knowledge_base") or {}
    if isinstance(base, dict) and base:
        pairs = [f"{k} {round(float(v) * 100)}%" for k, v in list(base.items())[:8]]
        lines.append("掌握度：" + "，".join(pairs))
    return "\n".join(lines) or _EMPTY


async def _recent_mistakes(user_id: str, tenant_id: str, pg_pool) -> str:
    result = await MistakeStore().list_for_user(
        user_id=user_id, tenant_id=tenant_id, pg_pool=pg_pool, limit=10
    )
    if not result.items:
        return _EMPTY
    lines = []
    for item in result.items[:8]:
        concept = item.concept or "未标注概念"
        question = (item.question or "").strip().replace("\n", " ")[:40]
        lines.append(f"- {concept}｜{question}" if question else f"- {concept}")
    return "\n".join(lines)
