from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://reflexlearn:reflexlearn@127.0.0.1:25432/reflexlearn"
    redis_url: str = "redis://127.0.0.1:26379/0"
    qdrant_url: str = "http://127.0.0.1:26333"
    qdrant_trust_env: bool = False
    neo4j_uri: str = "bolt://127.0.0.1:27687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "reflexlearn"

    deepseek_api_key: str = ""
    qwen_api_key: str = ""
    anthropic_api_key: str = ""
    openai_compat_api_key: str = ""      # OpenAI-compatible 中转站 key（如 timicc）
    openai_compat_base_url: str = ""     # 中转站 base URL；按服务要求填 https://... 或 https://.../v1
    openai_compat_model: str = ""        # 中转站模型名，如 gpt-5.5；网关会规范化为 openai/{model}
    openai_compat_cheap_model: str = ""  # 中转站「便宜档」模型名（PERF-B）：评判类任务(质检/judge/反思)走它降时延；空=全用主模型(零回归)
    openai_compat_wire_api: str = "chat_completions"  # chat_completions 或 responses（timicc 走 /responses）
    llm_request_timeout_s: float = 30.0  # 单次 LLM 外呼总超时（read/write）；中转站无响应时快速降级
    llm_connect_timeout_s: float = 5.0   # 连接超时单独设短：中转站 SYN 黑洞时 5s 快速降级，不等满总超时（PERF-C）

    kafka_bootstrap_servers: str = "127.0.0.1:29092"

    enable_reflexion: bool = True
    enable_rerank: bool = True
    enable_graph_retrieval: bool = False
    enable_kafka: bool = False
    enable_rag: bool = True
    enable_model_warmup: bool = True     # PERF-D：启动后台预热 bge embedding(+reranker)，消首请求 2GB 懒加载卡顿；仅 enable_rag 时生效

    # —— 三级记忆 / 多轮会话（6.2）——
    enable_multi_turn: bool = True       # kill-switch：False 即彻底退化单轮（跳过 Redis load/persist）
    session_ttl: int = 7200              # Redis session:{sid} TTL 秒（docs §7 = 2h）
    profile_ttl: int = 30 * 86400        # Redis profile:{tenant}:{user} TTL 秒（跨 session 画像沉淀）
    enable_promote: bool = False         # 会话结束是否自动升迁 Reflexion 经验；默认关，避免无依赖时空转
    summary_model: str = ""              # summary 任务显式模型覆盖（空 = 按 provider 自动选便宜档）
    summary_recent_turns: int = 6        # trim 保留最近 N 轮原文
    context_max_chars: int = 6000        # trim 总字符预算
    summary_max_layer_chars: int = 800   # 递归摘要单层字符上限
    summary_max_depth: int = 3           # 递归摘要最大层数
    enable_memory_consolidation: bool = True  # 召回命中回写 hit_count，作为记忆巩固信号
    enable_forgetting: bool = False       # 离线遗忘作业开关；默认关，避免误删经验
    memory_ttl_days: int = 90             # 经验超过此天数且低复用时允许遗忘
    memory_forget_min_hits: int = 1       # hit_count 低于此阈值才允许遗忘
    enable_graph_autogrow: bool = False   # 会话结束自动抽概念入图；默认关

    embedding_model: str = "BAAI/bge-large-zh-v1.5"
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    knowledge_collection: str = "knowledge_chunks"
    retrieve_top_k: int = 5
    qdrant_timeout_s: float = 3.0       # Qdrant 单次请求超时；评测环境不可用时快速降级
    rag_route_timeout_s: float = 3.0    # RAG 单路召回超时；避免真实评测被外部依赖拖死

    # —— M4 数据工程 / 写链路 ——
    enable_contextual: bool = False      # 上传时为每 chunk 生成 LLM 定位摘要（contextual retrieval）；
                                         # 默认关：每 chunk 一次 LLM，大文档串行会显著拉长上传时延
    contextual_max_chunks: int = 50      # 开启 contextual 时的 chunk 上限，超过则整体跳过摘要（控成本）

    enable_graph_build: bool = False     # 上传时 LLM 抽取概念/关系入 Neo4j（M4-B 写侧；读侧是 enable_graph_retrieval）
    graph_extract_max_chars: int = 8000  # 图谱抽取输入文本上限（文档级一次 LLM 调用，超长截断控成本）

    # —— M4-D MinIO 原始存储 + Spark/批清洗 ——
    enable_minio: bool = False           # 是否用 MinIO 原始存储（缺服务降级）
    minio_endpoint: str = "127.0.0.1:29000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "reflexlearn-raw"
    minio_secure: bool = False
    clean_min_chars: int = 30            # 批清洗质量过滤：内容短于此视为噪声丢弃（docs §6.1 取 100，小语料放宽）

    # —— 阶段二 4.1 可观测：Prometheus 指标导出与应用埋点 ——
    enable_metrics: bool = True          # False 时保留 /metrics，但业务路径不新增指标样本
    enable_generator_diagnostics: bool = False  # 真实评测调试：记录 generate_resource 内部阶段耗时
    eval_force_collab_mode: str = ""     # M5 评测隔离变量：central/pipeline/debate；空字符串表示不强制
    enable_llm_profile: bool = True      # False 时画像抽取走规则，用于真实评测减少无关 LLM 外呼
    enable_llm_quality_check: bool = True  # False 时质量检查走规则，用于真实评测减少内部额外 LLM 外呼
    eval_skip_path_plan: bool = False    # M5 资源质量评测跳过终态路径规划，避免无关 LLM 外呼拖慢
    enable_llm_planner: bool = True      # False 时 Planner 走规则规划，用于评测隔离资源生成变量
    enable_llm_generation: bool = True   # False 时生成 Skill 走离线降级，LLM key 仍可留给元认知/Judge
    enable_llm_streaming: bool = True    # 生成 Skill 优先走 complete_stream() 逐 token 推增量（PERF-A）；kill-switch 回退一次性
    eval_judge_max_resources: int = 0    # 评测时最多送 Judge 的资源数；0 表示不限制
    enable_metacognition: bool = False   # 元认知 self-refine 默认关，开启后才插入主链路
    enable_llm_intent: bool = True       # 意图分流：规则判不准时用便宜档 LLM 兜底；关掉则一律按学术问答处理
    max_self_refine: int = 1             # 单轮最多自我改进重试次数，防无限循环
    metacognition_max_reviews: int = 1   # 单轮最多审查资源数，默认只审最值得改的 1 个
    metacognition_timeout_s: float = 12.0  # 元认知单资源审查超时，超时即 noop 降级
    metacognition_min_score: float = 0.7   # 低于该分数才触发 self-refine
    metacognition_content_chars: int = 1200  # 送审资源内容截断长度，控制 token 和延迟

    # —— M4-E 多模态视频（SeeDance）——
    enable_seedance: bool = False        # 视频作业是否调真实 SeeDance（关闭 / 无 key → 降级 storyboard 占位）
    seedance_api_key: str = ""           # 火山方舟 ARK API key（SeeDance 视频生成）
    seedance_model: str = "doubao-seedance-1-0-pro-250528"
    seedance_endpoint: str = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks"
    video_job_ttl: int = 86400           # Redis video_job:{id} TTL 秒（默认 1 天）

    # P0 security baseline: auth / CORS / upload limits
    app_env: str = "development"
    auth_enabled: bool = True
    auth_secret_key: str = "dev-only-change-me-reflexlearn-auth-secret"
    auth_token_ttl_seconds: int = 7200
    auth_issuer: str = "reflexlearn"
    auth_audience: str = "reflexlearn-web"
    auth_demo_username: str = "admin"
    auth_demo_password: str = "reflexlearn-admin"
    auth_demo_tenant_id: str = "default"
    auth_demo_role: str = "admin"
    # —— W3-A: HttpOnly Cookie 会话 ——
    session_cookie_name: str = "reflexlearn_session"
    session_cookie_samesite: str = "lax"  # lax/strict/none；生产 Secure 由 app_env 推导
    # —— W3-B: CSRF / 登录限流 ——
    csrf_cookie_name: str = "reflexlearn_csrf"
    enable_login_rate_limit: bool = True
    login_rate_limit: int = 5          # 窗口内最大登录尝试次数
    login_rate_window_s: int = 300     # 限流窗口秒数（默认 5 分钟）
    # —— W3-C: AI Safety Gateway ——
    enable_safety_gateway: bool = True   # 输入闸门 + 输出脱敏；规则优先，正常请求不受影响
    enable_safety_llm: bool = False      # LLM safety checker（默认关，无 key/超时退规则）
    # —— W3-D: 上传隔离 / 签名 URL ——
    enable_upload_quarantine: bool = True  # 上传先入隔离区扫描，拒绝可执行/危险 HTML 内容
    signed_url_ttl_s: int = 300            # 签名 URL 有效期秒数（短 TTL）
    # —— W2: 资源发现真实搜索 ——
    enable_bilibili_search: bool = True    # B 站 wbi 签名搜索；失败/限频自动回落静态候选
    bili_search_timeout_s: float = 6.0     # 单次外呼超时；discover 不被外站拖死
    enable_mdn_search: bool = True         # MDN 官方文档搜索（Web/前端概念）；失败/无结果回落静态
    mdn_search_timeout_s: float = 6.0

    cors_allow_origins: str = (
        "http://localhost:3000,http://localhost:3001,http://localhost:23002,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:23002"
    )
    trusted_hosts: str = "127.0.0.1,localhost,testserver"

    max_upload_bytes: int = 10 * 1024 * 1024
    allowed_upload_extensions: str = "pdf,docx,pptx,html,htm,md,txt"
    allowed_upload_mime_types: str = (
        "application/pdf,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document,"
        "application/vnd.openxmlformats-officedocument.presentationml.presentation,"
        "text/html,text/markdown,text/plain"
    )

    max_iterations: int = 20
    max_replan: int = 3
    token_budget: int = 50000
    max_react_steps: int = 5

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
