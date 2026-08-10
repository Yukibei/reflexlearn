from contextlib import asynccontextmanager
from typing import Any


from reflexlearn.common.config import get_settings


_pg_pool: Any = None
_redis: Any = None
_qdrant: Any = None
_neo4j = None  # type: "AsyncDriver | None"  (neo4j.AsyncDriver, 延迟 import)


async def get_pg_pool():
    global _pg_pool
    if _pg_pool is None:
        import asyncpg

        settings = get_settings()
        _pg_pool = await asyncpg.create_pool(dsn=settings.database_url, min_size=2, max_size=10)
    return _pg_pool


async def get_redis():
    global _redis
    if _redis is None:
        import redis.asyncio as aioredis

        settings = get_settings()
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def get_qdrant():
    global _qdrant
    if _qdrant is None:
        from qdrant_client import AsyncQdrantClient

        settings = get_settings()
        _qdrant = AsyncQdrantClient(
            url=settings.qdrant_url,
            timeout=settings.qdrant_timeout_s,
            trust_env=settings.qdrant_trust_env,
        )
    return _qdrant


def get_neo4j():
    """Neo4j async driver 单例（仿 get_qdrant）。neo4j 包未装（graph extra）时此处才报错，
    不影响 db.py 其余连接——故 import 放函数内。连接是惰性的，driver() 不立即建连。"""
    global _neo4j
    if _neo4j is None:
        from neo4j import AsyncGraphDatabase

        settings = get_settings()
        _neo4j = AsyncGraphDatabase.driver(
            settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
        )
    return _neo4j


@asynccontextmanager
async def lifespan_db():
    yield
    global _pg_pool, _redis, _qdrant, _neo4j
    if _pg_pool:
        await _pg_pool.close()
        _pg_pool = None
    if _redis:
        await _redis.aclose()
        _redis = None
    if _qdrant:
        await _qdrant.close()
        _qdrant = None
    if _neo4j:
        await _neo4j.close()
        _neo4j = None
