"""学习目标改删的 SQL 语义测试。

重点锁一条容易被忽略的边界：删除目标时，其他目标路径里固定了本目标资源的节点
只能解绑，不能连节点一起删掉。
"""

from reflexlearn.learning.space_mutations import delete_space_record, update_space_record


class _TxCtx:
    async def __aenter__(self):
        return None

    async def __aexit__(self, *exc):
        return False


class _FakeConn:
    def __init__(self, goal_id: int | None = 7):
        self.goal_id = goal_id
        self.statements: list[str] = []

    def transaction(self):
        return _TxCtx()

    async def fetchval(self, query, *args):
        normalized = " ".join(query.split())
        if "UPDATE learning_goals" in normalized:
            self.statements.append(normalized)
            return self.goal_id
        if "FROM learning_goals" in normalized:
            return self.goal_id
        return None

    async def execute(self, query, *args):
        self.statements.append(" ".join(query.split()))
        return "DELETE 1"


class _AcquireCtx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


class _FakePool:
    def __init__(self, conn=None):
        self.conn = conn or _FakeConn()

    def acquire(self):
        return _AcquireCtx(self.conn)


def _path_item_statements(conn) -> list[str]:
    return [s for s in conn.statements if "path_items" in s]


def _first_index(statements: list[str], prefix: str) -> int:
    for index, statement in enumerate(statements):
        if statement.startswith(prefix):
            return index
    return -1


async def test_delete_space_unbinds_cross_goal_pinned_resources():
    """资源固定只校验所有权、不限制同一目标，所以跨目标固定是合法的。

    删除目标 A 时若按 resource_id 删 path_items，会连带打断目标 B 的路径——
    正确语义是把 B 的节点解绑（resource_id 置空），节点本身必须保留。
    """
    conn = _FakeConn()

    deleted = await delete_space_record(
        "7", user_id="u", tenant_id="t", memory={}, pg_pool=_FakePool(conn)
    )

    assert deleted is True
    statements = _path_item_statements(conn)

    unbind = [s for s in statements if s.startswith("UPDATE path_items SET resource_id=NULL")]
    assert unbind, f"跨目标固定的资源必须解绑，实际执行：{statements}"

    deletes = [s for s in statements if s.startswith("DELETE FROM path_items")]
    assert deletes, "本目标自己的路径节点仍应删除"
    assert all("resource_id IN" not in s for s in deletes), (
        f"DELETE 不得以 resource_id 为条件，否则会误删其他目标的节点：{deletes}"
    )


async def test_delete_space_clears_references_before_dropping_resources():
    """解绑必须发生在删除 resources 之前，否则外键引用悬空。"""
    conn = _FakeConn()

    await delete_space_record("7", user_id="u", tenant_id="t", memory={}, pg_pool=_FakePool(conn))

    unbind_at = _first_index(conn.statements, "UPDATE path_items SET resource_id=NULL")
    drop_at = _first_index(conn.statements, "DELETE FROM resources")
    assert unbind_at >= 0, f"缺少解绑语句：{conn.statements}"
    assert drop_at >= 0, f"缺少删除资源语句：{conn.statements}"
    assert unbind_at < drop_at, f"解绑应先于删除资源，实际顺序：{conn.statements}"


async def test_delete_space_rejects_other_owner_without_touching_rows():
    conn = _FakeConn(goal_id=None)

    deleted = await delete_space_record(
        "7", user_id="intruder", tenant_id="t", memory={}, pg_pool=_FakePool(conn)
    )

    assert deleted is False
    assert conn.statements == []


async def test_delete_space_memory_fallback_checks_owner():
    memory = {
        "7": {
            "space_id": "7",
            "user_id": "u",
            "tenant_id": "t",
            "title": "目标",
            "course": "c",
            "status": "active",
            "progress": 0.0,
        }
    }

    assert await delete_space_record("7", user_id="other", tenant_id="t", memory=memory) is False
    assert "7" in memory

    assert await delete_space_record("7", user_id="u", tenant_id="t", memory=memory) is True
    assert "7" not in memory


async def test_update_space_scopes_to_owner():
    conn = _FakeConn()

    updated = await update_space_record(
        "7",
        user_id="u",
        tenant_id="t",
        title="新标题",
        course="c",
        memory={},
        pg_pool=_FakePool(conn),
    )

    assert updated is True
    statement = next(s for s in conn.statements if "UPDATE learning_goals" in s)
    assert "user_id=$4" in statement and "tenant_id=$5" in statement
