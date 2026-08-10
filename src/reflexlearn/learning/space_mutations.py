from __future__ import annotations

import logging
from collections.abc import MutableMapping
from typing import TypedDict

logger = logging.getLogger(__name__)


class SpaceRecord(TypedDict):
    space_id: str
    user_id: str
    tenant_id: str
    title: str
    course: str
    status: str
    progress: float


async def update_space_record(
    space_id: str,
    *,
    user_id: str,
    tenant_id: str,
    title: str,
    course: str,
    memory: MutableMapping[str, SpaceRecord],
    pg_pool=None,
) -> bool:
    if pg_pool is not None:
        try:
            async with pg_pool.acquire() as conn:
                updated = await conn.fetchval(
                    """
                    UPDATE learning_goals SET goal_text=$1, course=$2
                    WHERE id::text=$3 AND user_id=$4 AND tenant_id=$5
                    RETURNING id
                    """,
                    title,
                    course,
                    space_id,
                    user_id,
                    tenant_id,
                )
            return updated is not None
        except Exception as exc:
            logger.info("update space pg degraded: %s", exc)
    item = memory.get(space_id)
    if item is None or item["user_id"] != user_id or item["tenant_id"] != tenant_id:
        return False
    item.update({"title": title, "course": course})
    return True


async def delete_space_record(
    space_id: str,
    *,
    user_id: str,
    tenant_id: str,
    memory: MutableMapping[str, SpaceRecord],
    pg_pool=None,
) -> bool:
    if pg_pool is not None:
        try:
            async with pg_pool.acquire() as conn, conn.transaction():
                goal_id = await conn.fetchval(
                    """
                    SELECT id FROM learning_goals
                    WHERE id::text=$1 AND user_id=$2 AND tenant_id=$3
                    """,
                    space_id,
                    user_id,
                    tenant_id,
                )
                if goal_id is None:
                    return False
                await _delete_goal_relations(conn, goal_id)
                await conn.execute("DELETE FROM learning_goals WHERE id=$1", goal_id)
            return True
        except Exception as exc:
            logger.info("delete space pg degraded: %s", exc)
    item = memory.get(space_id)
    if item is None or item["user_id"] != user_id or item["tenant_id"] != tenant_id:
        return False
    memory.pop(space_id, None)
    return True


async def _delete_goal_relations(conn, goal_id: int) -> None:
    await conn.execute(
        """
        DELETE FROM path_items
        WHERE path_id IN (SELECT id FROM learning_paths WHERE goal_id=$1)
        """,
        goal_id,
    )
    # 资源固定只校验所有权、不限制同一目标，因此别的目标路径上可能固定着本目标的资源。
    # 那些节点属于另一条学习路径，只能解绑，不能随本目标一起删掉；解绑也必须早于
    # 删除 resources，否则外键引用悬空。
    await conn.execute(
        """
        UPDATE path_items SET resource_id=NULL
        WHERE resource_id IN (SELECT id FROM resources WHERE goal_id=$1)
        """,
        goal_id,
    )
    await conn.execute("DELETE FROM learning_paths WHERE goal_id=$1", goal_id)
    run_scope = """
        SELECT id FROM agent_runs WHERE task_id IN (
            SELECT id FROM tasks WHERE goal_id=$1
        )
    """
    await conn.execute(f"DELETE FROM reflections WHERE run_id IN ({run_scope})", goal_id)
    await conn.execute(f"DELETE FROM tool_calls WHERE run_id IN ({run_scope})", goal_id)
    await conn.execute("DELETE FROM resources WHERE goal_id=$1", goal_id)
    await conn.execute(
        "DELETE FROM agent_runs WHERE task_id IN (SELECT id FROM tasks WHERE goal_id=$1)",
        goal_id,
    )
    await conn.execute("DELETE FROM tasks WHERE goal_id=$1", goal_id)
