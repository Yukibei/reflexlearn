"""初始化 Qdrant collections 和 payload index。"""
import asyncio

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import VectorParams, Distance, PayloadSchemaType

from reflexlearn.common.config import get_settings


COLLECTIONS = {
    "knowledge_chunks": VectorParams(size=1024, distance=Distance.COSINE),
    "experience_memory": VectorParams(size=1024, distance=Distance.COSINE),
}

PAYLOAD_INDEXES = [
    ("knowledge_chunks", "tenant_id", PayloadSchemaType.KEYWORD),
    ("knowledge_chunks", "visibility", PayloadSchemaType.KEYWORD),
    ("knowledge_chunks", "course_id", PayloadSchemaType.KEYWORD),
    ("knowledge_chunks", "user_id", PayloadSchemaType.KEYWORD),
    ("knowledge_chunks", "source_trust", PayloadSchemaType.FLOAT),
    ("experience_memory", "task_type", PayloadSchemaType.KEYWORD),
    ("experience_memory", "user_id", PayloadSchemaType.KEYWORD),
]


async def main():
    settings = get_settings()
    client = AsyncQdrantClient(
        url=settings.qdrant_url,
        timeout=settings.qdrant_timeout_s,
        trust_env=settings.qdrant_trust_env,
    )

    try:
        existing = [c.name for c in (await client.get_collections()).collections]

        for name, params in COLLECTIONS.items():
            if name in existing:
                print(f"  [SKIP] Collection '{name}' already exists.")
            else:
                await client.create_collection(collection_name=name, vectors_config=params)
                print(f"  [OK] Collection '{name}' created.")

        for coll, field, schema_type in PAYLOAD_INDEXES:
            try:
                await client.create_payload_index(
                    collection_name=coll,
                    field_name=field,
                    field_schema=schema_type,
                )
                print(f"  [OK] Index '{coll}.{field}' created.")
            except Exception:
                print(f"  [SKIP] Index '{coll}.{field}' may already exist.")

        print("\n[OK] Qdrant initialization complete.")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
