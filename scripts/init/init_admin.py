"""按生产环境变量幂等创建管理员账号。"""

import asyncio

import asyncpg

from reflexlearn.accounts.passwords import hash_password
from reflexlearn.common.config import get_settings


async def main() -> None:
    settings = get_settings()
    connection = await asyncpg.connect(dsn=settings.database_url)
    try:
        await connection.execute(
            """
            INSERT INTO users (id, role, tenant_id, password_hash, password_alg, disabled)
            VALUES ($1, $2, $3, $4, 'pbkdf2_sha256', FALSE)
            ON CONFLICT (id) DO UPDATE SET
                role=EXCLUDED.role,
                tenant_id=EXCLUDED.tenant_id,
                password_hash=EXCLUDED.password_hash,
                password_alg=EXCLUDED.password_alg,
                disabled=FALSE
            """,
            settings.auth_demo_username,
            settings.auth_demo_role,
            settings.auth_demo_tenant_id,
            hash_password(settings.auth_demo_password),
        )
        print("[OK] Production admin account initialized.")
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
