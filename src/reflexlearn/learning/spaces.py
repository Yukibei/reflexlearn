"""学习空间：一个学习目标的完整容器（路径 + 资源 + 进度）。

写读闭环的关键模块：/chat 会话产出（资源、学习路径、画像快照）通过
save_session_outcome 沉淀到 PG（learning_goals / resources / learning_paths /
path_items），空间详情页通过 get_space_detail 聚合读出。PG 不可用一律降级
内存，绝不报错中断主链路。
"""

from __future__ import annotations

import itertools
import json
import logging

from reflexlearn.learning.space_mutations import (
    SpaceRecord,
    delete_space_record,
    update_space_record,
)
from reflexlearn.learning.space_models import (
    SessionOutcome,
    SpaceDetail,
    SpacePathStep,
    SpaceResource,
)

logger = logging.getLogger(__name__)


class SpaceStore:
    """PG 优先、内存降级的学习空间存储。"""

    def __init__(self) -> None:
        self._mem_seq = itertools.count(1)
        self._spaces: dict[str, SpaceRecord] = {}
        self._resources: dict[str, list[dict]] = {}
        self._paths: dict[str, dict] = {}

    async def list_spaces(self, *, user_id: str, tenant_id: str, pg_pool=None) -> dict:
        if pg_pool is not None:
            try:
                async with pg_pool.acquire() as conn:
                    rows = await conn.fetch(
                        """
                        SELECT id::text AS space_id, user_id, tenant_id,
                               goal_text AS title, status
                        FROM learning_goals
                        WHERE user_id=$1 AND tenant_id=$2
                        ORDER BY created_at DESC LIMIT 100
                        """,
                        user_id,
                        tenant_id,
                    )
                return {"items": [dict(row) for row in rows], "degraded": []}
            except Exception as exc:
                logger.info("list spaces pg degraded: %s", exc)
        items = [
            {key: item[key] for key in ("space_id", "title", "status")}
            for item in self._spaces.values()
            if item["user_id"] == user_id and item["tenant_id"] == tenant_id
        ]
        return {"items": items, "degraded": ["pg:unavailable"]}

    # ---------- 创建 ----------

    async def create_space(
        self,
        *,
        user_id: str,
        tenant_id: str,
        title: str,
        course: str = "",
        pg_pool=None,
    ) -> SpaceDetail:
        title = (title or "").strip()[:200] or "未命名学习目标"
        if pg_pool is not None:
            try:
                async with pg_pool.acquire() as conn:
                    row = await conn.fetchrow(
                        """
                        INSERT INTO learning_goals (user_id, tenant_id, course, goal_text, status)
                        VALUES ($1, $2, $3, $4, 'active')
                        RETURNING id::text AS space_id
                        """,
                        user_id,
                        tenant_id,
                        course,
                        title,
                    )
                return SpaceDetail(
                    space_id=row["space_id"],
                    user_id=user_id,
                    tenant_id=tenant_id,
                    title=title,
                    course=course,
                )
            except Exception as exc:
                logger.info("create_space pg degraded: %s", exc)
        space_id = f"mem-{next(self._mem_seq)}"
        self._spaces[space_id] = {
            "space_id": space_id,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "title": title,
            "course": course,
            "status": "active",
            "progress": 0.0,
        }
        return SpaceDetail(**self._spaces[space_id], degraded=["pg:unavailable"])

    async def update_space(
        self,
        space_id: str,
        *,
        user_id: str,
        tenant_id: str,
        title: str,
        course: str = "",
        pg_pool=None,
    ) -> SpaceDetail | None:
        clean_title = title.strip()[:200]
        if not clean_title:
            return None
        updated = await update_space_record(
            space_id,
            user_id=user_id,
            tenant_id=tenant_id,
            title=clean_title,
            course=course.strip()[:200],
            memory=self._spaces,
            pg_pool=pg_pool,
        )
        if not updated:
            return None
        return await self.get_space_detail(space_id, pg_pool=pg_pool)

    async def delete_space(
        self,
        space_id: str,
        *,
        user_id: str,
        tenant_id: str,
        pg_pool=None,
    ) -> bool:
        deleted = await delete_space_record(
            space_id,
            user_id=user_id,
            tenant_id=tenant_id,
            memory=self._spaces,
            pg_pool=pg_pool,
        )
        if not deleted:
            return False
        self._resources.pop(space_id, None)
        self._paths.pop(space_id, None)
        return True

    # ---------- 聚合详情 ----------

    async def get_space_detail(self, space_id: str, *, pg_pool=None) -> SpaceDetail | None:
        if pg_pool is not None:
            try:
                return await self._detail_from_pg(space_id, pg_pool)
            except Exception as exc:
                logger.info("space detail pg degraded: %s", exc)
        return self._detail_from_memory(space_id)

    async def _detail_from_pg(self, space_id: str, pg_pool) -> SpaceDetail | None:
        async with pg_pool.acquire() as conn:
            goal = await conn.fetchrow(
                """
                SELECT id::text AS space_id, user_id, tenant_id,
                       COALESCE(course, '') AS course, goal_text AS title,
                       status, progress
                FROM learning_goals WHERE id::text=$1
                """,
                space_id,
            )
            if goal is None:
                return None
            path = await conn.fetchrow(
                """
                SELECT id, summary, strategy FROM learning_paths
                WHERE goal_id=$1 ORDER BY created_at DESC LIMIT 1
                """,
                int(goal["space_id"]),
            )
            steps: list[SpacePathStep] = []
            if path is not None:
                rows = await conn.fetch(
                    """
                    SELECT sequence, task_ref, resource_type, concept, objective,
                           rationale, difficulty, mastery_status
                    FROM path_items WHERE path_id=$1 ORDER BY sequence ASC
                    """,
                    path["id"],
                )
                steps = [SpacePathStep.model_validate(dict(r)) for r in rows]
            res_rows = await conn.fetch(
                """
                SELECT id::text AS resource_id, type,
                       COALESCE(meta->>'title', type) AS title,
                       concept, COALESCE(content, '') AS content, quality_score
                FROM resources WHERE goal_id=$1 ORDER BY created_at ASC LIMIT 200
                """,
                int(goal["space_id"]),
            )
        return SpaceDetail(
            **dict(goal),
            path_summary=path["summary"] if path else "",
            path_strategy=path["strategy"] if path else "",
            steps=steps,
            resources=[SpaceResource.model_validate(dict(r)) for r in res_rows],
        )

    def _detail_from_memory(self, space_id: str) -> SpaceDetail | None:
        base = self._spaces.get(space_id)
        if base is None:
            return None
        path = self._paths.get(space_id, {})
        return SpaceDetail(
            **base,
            path_summary=path.get("summary", ""),
            path_strategy=path.get("strategy", ""),
            steps=[SpacePathStep.model_validate(s) for s in path.get("steps", [])],
            resources=[SpaceResource.model_validate(r) for r in self._resources.get(space_id, [])],
            degraded=["pg:unavailable"],
        )

    # ---------- 会话产出沉淀 ----------

    async def save_session_outcome(
        self,
        *,
        space_id: str,
        user_id: str,
        tenant_id: str,
        outcome: SessionOutcome,
        pg_pool=None,
    ) -> dict:
        saved = {"space_id": space_id, "resources_saved": 0, "path_saved": False}
        if pg_pool is not None:
            try:
                return await self._save_to_pg(space_id, user_id, tenant_id, outcome, pg_pool)
            except Exception as exc:
                logger.info("save outcome pg degraded: %s", exc)
        bucket = self._resources.setdefault(space_id, [])
        for idx, res in enumerate(outcome.resources):
            bucket.append(
                {
                    "resource_id": f"{space_id}-r{len(bucket) + 1}",
                    "type": res.get("type", "doc"),
                    "title": res.get("title", "") or res.get("type", "doc"),
                    "concept": res.get("concept", ""),
                    "content": res.get("content", ""),
                    "quality_score": res.get("quality_score"),
                }
            )
            saved["resources_saved"] = idx + 1
        if outcome.path_steps:
            self._paths[space_id] = {
                "summary": outcome.path_summary,
                "strategy": outcome.path_strategy,
                "steps": [
                    {
                        "sequence": s.get("sequence", i + 1),
                        "task_ref": s.get("task_id", ""),
                        "resource_type": s.get("resource_type", ""),
                        "concept": s.get("concept", "") or "",
                        "objective": s.get("objective", "") or "",
                        "rationale": s.get("rationale", "") or "",
                        "difficulty": float(s.get("difficulty") or 0),
                    }
                    for i, s in enumerate(outcome.path_steps)
                ],
            }
            saved["path_saved"] = True
        saved["degraded"] = ["pg:unavailable"]
        return saved

    async def _save_to_pg(
        self, space_id: str, user_id: str, tenant_id: str, outcome: SessionOutcome, pg_pool
    ) -> dict:
        saved = {"space_id": space_id, "resources_saved": 0, "path_saved": False}
        goal_id = int(space_id)
        async with pg_pool.acquire() as conn:
            for res in outcome.resources:
                await conn.execute(
                    """
                    INSERT INTO resources (goal_id, type, content, meta, quality_score,
                                           user_id, tenant_id, visibility, concept)
                    VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, 'private', $8)
                    """,
                    goal_id,
                    res.get("type", "doc"),
                    res.get("content", ""),
                    json.dumps(
                        {"title": res.get("title", "") or res.get("type", "doc")},
                        ensure_ascii=False,
                    ),
                    res.get("quality_score"),
                    user_id,
                    tenant_id,
                    res.get("concept", ""),
                )
                saved["resources_saved"] += 1
            if outcome.path_steps:
                row = await conn.fetchrow(
                    """
                    INSERT INTO learning_paths (user_id, tenant_id, goal_id, summary, strategy)
                    VALUES ($1, $2, $3, $4, $5) RETURNING id
                    """,
                    user_id,
                    tenant_id,
                    goal_id,
                    outcome.path_summary,
                    outcome.path_strategy,
                )
                for i, step in enumerate(outcome.path_steps):
                    await conn.execute(
                        """
                        INSERT INTO path_items (path_id, sequence, task_ref, resource_type,
                                                concept, objective, rationale, difficulty)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        """,
                        row["id"],
                        int(step.get("sequence") or i + 1),
                        str(step.get("task_id", "")),
                        str(step.get("resource_type", "")),
                        str(step.get("concept", "") or ""),
                        str(step.get("objective", "") or ""),
                        str(step.get("rationale", "") or ""),
                        float(step.get("difficulty") or 0),
                    )
                saved["path_saved"] = True
        return saved


_store = SpaceStore()


def get_space_store() -> SpaceStore:
    return _store


def reset_space_store_for_tests() -> None:
    global _store
    _store = SpaceStore()
