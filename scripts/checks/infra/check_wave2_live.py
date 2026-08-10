from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue, PointStruct

import reflexlearn.common.db as db
from reflexlearn.common.config import get_settings
from reflexlearn.common.db import get_neo4j
from reflexlearn.data_engineering.graph_build import GraphExtraction, merge_into_neo4j
from reflexlearn.llm_gateway.gateway import Completion
from reflexlearn.memory.forgetting import forget_stale
from reflexlearn.memory.graph_autogrow import autogrow_session_graph
from reflexlearn.memory.reflexion import EXPERIENCE_COLLECTION


class FakeGraphGateway:
    def __init__(self, marker: str):
        self._marker = marker

    async def complete(self, messages, *, task_type="generation", schema=None, temperature=0.2):
        concept = f"波次二活检{self._marker[-6:]}"
        text = (
            f'{{"concepts":[{{"name":"{concept}","description":"协作轨迹与错题飞轮验证",'
            '"difficulty":0.4},{"name":"对象级ACL","description":"按用户租户隔离对象",'
            f'"difficulty":0.5}}],"relations":[{{"source":"对象级ACL","target":"{concept}",'
            '"type":"RELATED_TO"}]}'
        )
        return Completion(text=text, model_used="fake-live-graph")


async def check_qdrant_forgetting(settings) -> bool:
    marker = f"wave2-live-{uuid4().hex}"
    client = AsyncQdrantClient(
        url=settings.qdrant_url,
        timeout=settings.qdrant_timeout_s,
        trust_env=settings.qdrant_trust_env,
    )
    try:
        await client.get_collection(EXPERIENCE_COLLECTION)
        point_id = uuid4().hex
        old_time = datetime.now(timezone.utc) - timedelta(days=30)
        await client.upsert(
            collection_name=EXPERIENCE_COLLECTION,
            points=[
                PointStruct(
                    id=point_id,
                    vector=[0.0] * 1024,
                    payload={
                        "task_type": "wave2_live",
                        "user_id": "wave2",
                        "created_at": old_time.isoformat(),
                        "hit_count": 0,
                        "live_marker": marker,
                    },
                )
            ],
        )
        deleted = await forget_stale(
            qdrant=client,
            now_iso=datetime.now(timezone.utc).isoformat(),
            ttl_days=1,
            min_hits=1,
        )
        points, _ = await client.scroll(
            collection_name=EXPERIENCE_COLLECTION,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="live_marker",
                        match=MatchValue(value=marker),
                    )
                ]
            ),
            limit=1,
            with_payload=True,
            with_vectors=False,
        )
        ok = deleted >= 1 and not points
        print(f"[{'OK' if ok else 'BLOCKED'}] qdrant forgetting deleted={deleted} marker_left={len(points)}")
        return ok
    except Exception as exc:
        print(f"[BLOCKED] qdrant forgetting: {type(exc).__name__}: {exc}")
        return False
    finally:
        await client.close()


async def check_neo4j_autogrow(settings) -> bool:
    marker = f"wave2-live-{uuid4().hex}"
    neo4j = None
    try:
        neo4j = get_neo4j()
        settings.enable_graph_autogrow = True
        status, concepts, relations, notes = await autogrow_session_graph(
            text="波次二活检需要对象级ACL和协作轨迹落库。",
            tenant_id="wave2",
            visibility="public",
            doc_id=marker,
            neo4j=neo4j,
            settings=settings,
            gateway=FakeGraphGateway(marker),
        )
        async with neo4j.session() as session:
            result = await session.run(
                "MATCH (n:Concept {tenant_id:$tid, source_doc:$doc}) RETURN count(n) AS n",
                tid="wave2",
                doc=marker,
            )
            row = await result.single()
        count = int(row["n"]) if row else 0
        ok = status == "ok" and count >= 1
        print(
            f"[{'OK' if ok else 'BLOCKED'}] neo4j autogrow "
            f"status={status} concepts={concepts} relations={relations} count={count} notes={notes}"
        )
        return ok
    except Exception as exc:
        print(f"[BLOCKED] neo4j autogrow: {type(exc).__name__}: {exc}")
        return False
    finally:
        pass


async def check_neo4j_merge_direct(settings) -> bool:
    neo4j = None
    marker = f"wave2-merge-{uuid4().hex}"
    try:
        neo4j = get_neo4j()
        extraction = GraphExtraction.model_validate(
            {
                "concepts": [{"name": marker, "description": "direct merge", "difficulty": 0.2}],
                "relations": [],
            }
        )
        concepts, relations = await merge_into_neo4j(
            neo4j,
            extraction,
            tenant_id="wave2",
            visibility="public",
            doc_id=marker,
        )
        ok = concepts == 1 and relations == 0
        print(f"[{'OK' if ok else 'BLOCKED'}] neo4j direct merge concepts={concepts}")
        return ok
    except Exception as exc:
        print(f"[BLOCKED] neo4j direct merge: {type(exc).__name__}: {exc}")
        return False
    finally:
        if neo4j is not None:
            await neo4j.close()
            db._neo4j = None


async def main() -> int:
    settings = get_settings()
    results = [
        await check_qdrant_forgetting(settings),
        await check_neo4j_autogrow(settings),
        await check_neo4j_merge_direct(settings),
    ]
    return 0 if all(results) else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
