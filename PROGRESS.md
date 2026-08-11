# ReflexLearn · 开发进度与接管手册

> **这份文档的用途**：会话/人员中断后 30 秒内接管开发。需求拆分到可执行粒度，
> 标注「做到哪、改了什么、下一步做什么」。**每完成一轮开发，更新第 5 节（追加本轮）+ 第 6 节（勾掉已完成）+ 第 2.3 节（服务状态）。**
> single source of truth 是 `docs/00-项目蓝图与里程碑.md`，本文件是它的「执行态快照」。

最后更新：2026-08-11 · 本轮成果：**能力边界体检 + 导师意图分流 + 流式失效根治**——体检划清「真实能力 vs 降级占位」并落 `discuss/2026-08-11-能力边界体检报告.md`；导师按能力边界分四类意图（寒暄 0s / 学术问答 17s / 范围外 5s / 学习方案走完整链路），判不准回落问答而非最贵分支，「一句 hi 建出一套学习资源」的根因就此堵住；**流式失效根治**——根因是 PERF-A 只接了中心化 fan-out 而真实会话走流水线模式，抽 `stream_bridge` 供两种模式共用后 **TTFD 无穷 → 31.42s、增量帧 0 → 836**。另清理 3 个垃圾学习目标（孤儿数据为 0）、沉淀失败不再静默吞异常、修好两处早已变红却没人发现的断言。**待办**：总时长仍 280s（15 次串行 LLM）、知识库仅 15 点、其余关闭态开关待逐个验证。上一轮：FS-17 修复删除目标误删其他目标路径节点。

---

## 1. 项目一句话

ReflexLearn = 软件杯 A3「自进化学习多智能体系统」。LangGraph 多智能体编排，按学习者画像生成
5+ 种学习资源（讲解文档/思维导图/代码/练习题/拓展阅读/多模态视频），具备 Reflexion 自我反思、
混合 RAG、个性化学习路径规划。前端流式展示 Agent 协作过程。

**当前里程碑：M1–M4 机制全部落地，P0 第一包和第二包已完成，M5 已启动。M4（大数据栈 + 多模态视频）六子项 A 写链路 / B 图谱 / C Kafka / D Spark·MinIO / E 视频 / F 前端均完成并配单测；Kafka+MinIO、API 写链路、前端上传/视频工具区已做真集群活体。M5-A/B/C 已能用 `scripts/run_eval.sh` 输出单策略报告，用 `scripts/run_eval.sh --compare` 输出消融对比报告；M5-C2 已具备 `--tags ablation` 切片、`resource_coverage` 指标与 controlled RAG/Reflexion 受控基线；M5-D 正式报告已落 docs。**

**仍需后续推进**：完整产品信息架构重构、数据库用户体系、HttpOnly Cookie + CSRF、登录限流、审计、上传隔离/扫描、防盗链、AI Safety Gateway 和对象级资源归属仍未完成。

---

## 2. 快速接管（必读）

### 2.1 环境致命陷阱（踩过的坑，务必遵守）

| # | 陷阱 | 正确做法 |
|---|------|---------|
| 1 | `.venv` 由 **uv** 创建，**无 pip** | 跑 python 一律用 `.venv/Scripts/python.exe`；装包用 `uv pip install` |
| 2 | 源码在 `src/` 布局 | 跑任何脚本/测试前置 `PYTHONPATH=src` |
| 3 | Windows 本机**死代理**，直连/镜像会被代理拦截卡死 | 命令前置 `NO_PROXY='*' no_proxy='*' HTTP_PROXY= HTTPS_PROXY= ALL_PROXY=` |
| 4 | **后台 Bash 命令的 cwd 不继承**项目根（相对路径 `.venv/...` 报 No such file） | 后台命令开头加 `cd /d/2026/multagent &&`（同时让 `.env` 被 pydantic 读到） |
| 5 | **双份 bge 模型死锁**：单测 e2e 会加载真实 2GB bge，叠加常驻后端的另一份 → 内存换页卡死 480s+ | 单测靠 `tests/conftest.py` autouse 守卫拦 `_get_model`（hermetic）；活体脚本与带 RAG 后端**不要同时**加载模型 |
| 6 | **Windows curl 命令行中文参数编码错乱** → 后端 400 "error parsing the body" | SSE/POST 中文 body 用 UTF-8 文件传：`--data-binary @body.json`（body 文件用 Write 工具写，保证 UTF-8） |
| 7 | HF 模型下载需镜像 + 离线优先 | 加 `HF_HUB_OFFLINE=1 HF_ENDPOINT=https://hf-mirror.com`；限线程 `OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1` |
| 8 | **BM25 中文小语料 IDF=0**（N≤3 时命中半数文档的词得分归零）+ 双模型死锁升级版 | 测试/小数据 ≥4 文档；图扩展**不 embed**；RAGService 的 `gather` **只并行召回、rerank 串行其后**（详见 memory 三条新坑） |
| 9 | **async 函数内不能用同步锁包 await**：`KeywordIndex.get()` 曾在并发 `real_full` 资源生成中阻塞事件循环 | 构建索引用 `asyncio.Lock`；同步锁只允许保护“创建锁对象”这种无 await 的极短临界区 |

### 2.2 常用命令（复制即用）

```bash
# —— 全量单元测试（hermetic，预期 400 passed）——
bash scripts/test_unit.sh

# —— M5 消融切片 smoke（ablation: rag_required + reflexion_required）——
bash scripts/run_eval.sh --compare --tags ablation --max-cases 2 --timeout 12

# —— M5 受控消融靶向验证 ——
bash scripts/run_eval.sh --compare --tags ablation,rag_required \
  --strategies no_rag,controlled_rag,single_agent_baseline --max-cases 1 --timeout 12
bash scripts/run_eval.sh --compare --tags ablation,reflexion_required \
  --strategies no_reflexion,controlled_reflexion,single_agent_baseline --max-cases 1 --timeout 12

# —— S2-T2 真实评测入口（有 LLM key 时 Judge 来源=LLM 或混合；无 key 自动规则降级）——
bash scripts/run_real_eval.sh \
  --strategies controlled_rag,controlled_reflexion,single_agent_baseline \
  --max-cases 0 --timeout 25
bash scripts/run_real_eval.sh --tags ablation,rag_required \
  --strategies real_full,real_no_rag,single_agent_baseline --max-cases 1 --timeout 180

# —— 启动后端（后台工作态，:8000）——
bash scripts/start_api.sh
# 健康检查：curl -s --noproxy '*' -w "%{http_code}" http://127.0.0.1:28000/docs

# —— 启动前端（frontend/）——
bash scripts/start_frontend.sh
bash scripts/build_frontend.sh     # 生产构建；可传 API base
bash scripts/stop_frontend.sh      # 停止前端；默认 :3000，可 bash scripts/stop_frontend.sh 3001 覆盖

# —— 启动中间件 ——
bash scripts/start_graph.sh      # core + graph
bash scripts/start_bigdata.sh    # Kafka + MinIO（会触发 Kafka 镜像拉取）
bash scripts/check_bigdata.sh    # Kafka produce/consume + MinIO put/get/remove
bash scripts/start_full.sh       # core + graph + bigdata + observe
# P0 安全底座后，check_api 会自动用 REFLEXLEARN_HEALTH_USER / REFLEXLEARN_HEALTH_PASSWORD 登录。
# 默认开发账号：admin / reflexlearn-admin；生产必须通过环境变量改掉。
bash scripts/check_api.sh        # 兼容入口：默认只跑安全冒烟；默认 :8000，可 bash scripts/check_api.sh 8001 覆盖
bash scripts/check_api_security.sh 8001      # 鉴权、受保护路由、上传 guard、视频提交、/metrics；不依赖 Qdrant/PG
bash scripts/check_api_integrations.sh 8001  # Qdrant/PG 真写和视频降级；需要依赖中间件可用
bash scripts/stop_api.sh         # 停止 API；默认 :8000，可 bash scripts/stop_api.sh 8001 覆盖

# —— SSE 联调（中文 body 必须走文件）——
# 先写 body.json: {"message":"线性回归从入门到精通","user_id":"demo"}
curl -N -s --noproxy '*' -X POST http://127.0.0.1:28000/api/chat \
  -H "Content-Type: application/json" --data-binary @body.json
```

### 2.3 当前服务状态（跨会话会失效，用上方命令重启）

- **2026-08-11 当前态（FS-16）**：中间件 4 容器已起并 healthy（PG 25432 / Redis 26379 /
  Qdrant 26333 / Neo4j 27687），API `:28000`、前端 `:23002` 均在运行且经同源代理连通。
  **应用与中间件端口已整体迁到 2xxxx 段**，本节下方历史条目里的 `1xxxx` / `8000` / `3000` /
  `3001` 端口号均已过时，一律以 `.env` 为准。本机同时运行 docpilot、new-api、medical-ppt、
  个人作品集站等项目，**判断本项目是否可用要看 `/api/health` 返回的 service 名与 `docker ps`
  里的 `multagent-*` 容器，而不是端口是否被监听**（交接时正是在这里误判过）。
- **W2-H 元认知评测链路**：本轮执行 `bash scripts/check_metacognition_perf.sh` 通过；最新验收轮 `metacognition_real_on latency_ms=38982`，trace 包含 `metacognition`，`self_refine_count=1`，Judge reasoning 为 LLM 评语且未出现 `rule:` 规则降级。该脚本依赖已配置的 OpenAI-compatible 中转站，网络抖动会影响耗时，但脚本会按 45s 阈值失败而不粉饰。
- **W2-G LoRA 样本导出**：新增 `scripts/check_lora_export.sh`，通过 API 触发一次对话轨迹、导出 `logs/lora_samples/*.jsonl` 与 `lora_samples_latest.jsonl`，并校验 JSONL 无明文 `user_id/token/Bearer`。该能力只是训练数据 MVP，不代表已经训练 LoRA 或证明微调收益。
- **波次 2 活体**：本轮执行 `bash scripts/check_wave2_live.sh` 通过：真实 Qdrant `experience_memory` 过期低命中点写入后被 `forget_stale` 删除（`deleted=1`），真实 Neo4j 图谱自生长写入成功（`status=ok concepts=2 relations=1 count=1`），直接 MERGE 活体也通过。该脚本依赖 Graph 服务可用，后续可用 `bash scripts/start_graph.sh && bash scripts/init_all.sh && bash scripts/check_wave2_live.sh` 复跑。
- **后端**：本轮临时启动 `:8002` 并执行 `bash scripts/check_api_security.sh 8002`，安全冒烟通过：health、未登录 401、auth login、auth me、非法上传 415、视频提交鉴权均 OK；随后已执行 `bash scripts/stop_api.sh 8002` 清理，当前未保留 8001/8002 常驻监听。`scripts/check_api.sh` 现在默认转发安全冒烟；Qdrant/PG 真写需显式运行 `scripts/check_api_integrations.sh`。
- **前端**：本轮清理双 dev 事故后仅保留 :3001（`bash scripts/start_frontend.sh 3001`，.next 已重建），:3000 已清空；路由含新增 `/profile`（学习档案视觉版）。验收 check_profile_page/check_frontend_ia/check_today_page 全 ok，/profile、/plan、/growth、/resources、/today 活体 200。**红线：dev 运行中严禁跑 `build_frontend.sh`（共写 .next 会 chunk 断裂，本轮已实证；build 前先 stop_frontend）。**
- **依赖中间件**：2026-06-08 本轮已通过 Docker Desktop Windows CLI 兼容重启并验证：Observe（Prometheus :19090、Grafana :13001）、Graph（PG :15432、Redis :16379、Qdrant :16333/:16334、Neo4j :17474/:17687）、Bigdata（Kafka :19092、MinIO :19000/:19001）均已起；`scripts/check_bigdata.sh` 通过 Kafka produce/consume + MinIO put/get/remove；`scripts/init_all.sh` 通过 PG schema、Qdrant collections/index、Neo4j 种子图谱初始化；`scripts/check_api_integrations.sh 8003` 通过知识上传真实写 Qdrant/PG 和视频 degraded 活检。Kafka 新建 health topic 时会出现短暂 metadata/leader warning，最终读写成功即可。
- **知识写链路（M4-A/B）**：`POST /api/knowledge/upload`（multipart：`file` + `course_id`/`user_id`/`tenant_id`/`visibility`/`title`/`enable_contextual`/`enable_graph_build`）→ 解析/分块/向量化/入库 +（可选）LLM 抽概念/先修关系入 Neo4j，返回 `IngestResult`（chunks/embedded/qdrant_written/pg_written/contextual/**graph/graph_concepts/graph_relations**/degraded/status）。唯一写入口 `data_engineering/ingest.py:ingest_document`（B 图谱已并入第 6.5 步；C Kafka 共用）。
- **增量链路（M4-C 新增）**：`enable_kafka=true` 时上传走异步——投递 `knowledge.changes` 事件、消费进程 `scripts/jobs/data/kafka_consumer.py` 异步入库（复用 `ingest_document`）；broker 不可用上传自动降级同步。aiokafka 0.14.0 已装；Kafka 当前在 :19092，`scripts/check_bigdata.sh` 已验证 produce/consume。
- **批处理（M4-D 新增）**：MinIO 原始存储（minio 7.2 已装，:19000）+ 批清洗 `scripts/jobs/data/run_clean.py`（clean 纯函数 + Spark/pandas/纯 Python 三级 runner）。MinIO 当前已通过 put/get/remove 活体；pyspark/pandas 未装 → 当前真实走纯 Python 清洗。
- **视频作业（M4-E 新增）**：`POST /api/video/jobs`（提交 storyboard）→ asyncio 后台 SeeDance 生成 → `GET /api/video/jobs/{id}` 轮询。JobStore Redis 降级内存；`enable_seedance=false`/无 key → 作业 degraded、storyboard 分镜脚本占位（不假装出视频）。

---

## 3. 里程碑总览（来自 docs/00，附执行态）

| 里程碑 | 可交付 | 状态 |
|--------|--------|------|
| M1 Agent 核心闭环 | Planner→Executor→Verifier→Critic；画像；讲解文档；流式前端 | ✅ |
| M2 多资源 + 前端 MVP | 5 种资源全通；多模态卡片；中心化/流水线协作 | ✅ |
| **M3 RAG + 记忆 + 路径** | Qdrant+Neo4j 混合检索；ACL；三级记忆；Reflexion；路径规划+推送 | ✅ |
| M4 大数据栈 + 多模态视频 | docker 全栈；文档清洗→分块→向量化→图谱；Kafka；SeeDance 视频 | ✅ 机制全落地（A 写链路 / B 图谱 / C Kafka / D Spark·MinIO / E 视频 / F 前端，全配单测；Kafka+MinIO、API 写链路、前端上传/视频工具区已活体） |
| **M5 评测 + 消融 + 微调** | eval harness；LLM-as-a-judge；消融报告；（GPU 行）LoRA | ✅/🚧 M5-A/B/C 与 S2-T2 已完成到小样本真实结论：`real_full`、`real_no_rag`、`single_agent_baseline` 三策略真实评测已跑通；仍缺扩大样本、人工抽检和 LoRA |

---

## 4. M3 详细拆分与状态（已全部完成）

| 子项（评分项） | 状态 | 落点 / 备注 |
|---------------|------|------------|
| ACL 物理隔离 | ✅ | reflexion 已验证跨用户召回为空；payload 带 tenant/visibility |
| Reflexion 自我反思 | ✅ | 上轮闭环增强：真实向量写入 + 语义召回 + 降级门控（见 5.2） |
| **个性化学习路径规划 + 推送** | ✅ | **本轮完成**：`path_plan` 节点 + 端到端推前端（见 5.1） |
| 三级记忆 + 递归摘要 + summary buffer | ✅ | **本轮完成**：L1 上下文工程（trim + 递归摘要）+ 多轮 Redis 持久化 + MemoryManager 补全 + 对话式 UI（见 5.0） |
| 混合 RAG（Qdrant 语义 + Neo4j 图谱 + 关键词）+ rerank | ✅ | **本轮完成**：`rag/` 9 模块，三路 + RRF(k=60) + bge-reranker + ACL；活体 `routes_used` 三路全命中（见 5.0） |
| 冲突辩论 | ✅ | debate/judge 节点已在主链路 |

---

## 5. 已完成轮次（倒序，含改动文件清单）

### FS-16 ✅ · Claude 接管：审查纠偏 + 工作区基线提交 + 端口收口（Claude 全栈轮）

**接管审查纠偏**：交接文档 `docs/25` §6.2 判定「3002 和 8000 有监听」，实为误判——`:8000` 上跑的是
**medical-ppt-agent**（`/api/health` 返回其 service 名），`:3002` 是一个个人作品集站；本项目的 API、
前端与四个中间件容器**均未运行**。前端 rewrites 默认指向 8000，照此启动会把 `/api/*` 打到别人后端，
任何「页面 200」都不作数。本机并存 docpilot(15432/16379/16333/19000)、new-api(3000)、
medical-ppt(8000/9000/6379/55432)、portfolio(3002) 四套项目，`1xxxx` 段与 8000/3002 全被占用。

**工作区基线提交**（95 改 + 42 新增，按功能域拆 6 个提交，原样固化接手时状态）：
`a6005f0` 中间件端口迁移与代理适配 → `b2a1575` 目标 CRUD + 问候意图 → `22a301f` 工作台重构 →
`70b1061` 落地页 → `1adfeef` 生产部署（标注未做生产验收）→ `9745863` 文档（标注其中错误结论待更正）。

**端口收口**（`ddf7711`）：API 迁 28000、前端迁 23002，与已迁的中间件同处 2xxxx 段；`_lib.sh` 新增
`env_port`——端口只在 `.env` 定义一次，13 个脚本不再各自硬编码，取值链为「位置参数 > 环境变量 >
.env > 兜底默认」；同步 next.config、CORS、prometheus、test_chat_utf8.ps1、README、docs/09、docs/25。
顺带修好 `test_core.py` 中**早已失效**的断言：脚本默认端口早已改成 3002，契约却仍断言 3000，
因为那一轮没跑测试所以一直没被发现。

**活体验证**：4 容器（25432/26333/26379/27687）healthy → `init_all` 通过（PG schema + Qdrant
collections/indexes + Neo4j 种子）→ API `reflexlearn-api` @28000、bge 预热 12.6s + 2.3s → 前端
23002 Ready 4.9s → 同源代理 `/api/health` 指向本项目 → 登录落 `reflexlearn_session` +
`reflexlearn_csrf` 双 cookie、仅凭 cookie `/auth/me` 200 → `/chat` 输入 `hi` 只回问候、不启动资源
规划 → **目标 CRUD 全闭环**（创建 id=50 真写 PG、列表可见、PATCH 改名、DELETE、detail 404、
列表消失，临时数据随删除清理）→ 10 个路由全 200。`tests/unit/test_core.py` 12 passed；
`scripts` 全量 `bash -n` 通过。

**遗留高危（已在 FS-17 修复）**：`learning/space_mutations.py` 的 `_delete_goal_relations` 中
`DELETE FROM path_items ... OR resource_id IN (SELECT id FROM resources WHERE goal_id=$1)`，
第二个条件会连带删除**其他学习目标路径中**固定了本目标资源的节点（FS-9 允许同一用户跨 space
固定资源）。正确语义是解绑（`SET resource_id=NULL`）而非删节点。

**未做**：全量单测与 `build_frontend.sh` 未跑（遵用户规矩不自动构建测试）；浏览器端视觉与交互
未验证，本轮只到 HTTP 层。

### FS-18 ✅ · 能力边界体检 + 导师意图分流 + 流式失效根治（Claude 全栈轮）

**能力边界体检**（`discuss/2026-08-11-能力边界体检报告.md`）：逐条实测「真实能力 vs 降级占位」。
真实可用：LLM 中转站（gpt-5.5，4.4s）、认证会话、目标 CRUD、B 站与 MDN 实时搜索、资源生成、
数据持久化。降级或未接通：token 流式（0 帧）、path_plan 本次 ValidationError 降规则、视频占位、
`knowledge_chunks` 仅 15 点、图谱检索/元认知/promote/autogrow/Kafka/MinIO/便宜档路由全为关闭态
（用户确认属遗漏而非有意）。

**垃圾数据清理**：删除标题为 `hi` 的目标等 3 个测试残留（19 → 16），孤儿资源/孤儿节点/
悬空 resource_id 均为 0。

**导师意图分流**：旧实现是 8 个问候词的精确匹配集合，只拦得住字面量 `hi`，「你好呀」「谢谢」
「嗯」全部漏过并触发完整链路（15 次 LLM + 凭空建目标）。重写为四类分类器
（small_talk / academic_qa / learning_plan / out_of_scope）：高置信规则走快路径，判不准交便宜档
LLM，LLM 再失败**回落 academic_qa**——降级方向是刻意的，旧版判不准时倒向最贵分支正是病根。
刻意不做「消息短就算寒暄」（「熵」「秩」这类单字学术词会被误伤）。答疑实现抽到
`learning/tutoring.py`，`/tutor/ask` 与 `/chat` 问答分流共用。活体：`你好呀` 0s、
`什么是梯度下降…` 17s、`帮我写辞职信` 5s（礼貌拒绝），三次对话后目标数不变；此前这三种输入
都要约 265 秒并各建一个目标。

**流式失效根治**：根因是 PERF-A 的流式只接在 `generate_resource`（中心化 fan-out）上，而 planner
常把 `collab_mode` 判成 `pipeline`，真实会话走 `pipeline_node` —— 那里一处流式接线都没有。
排查按层隔离并留证据：网关层探针实测 `complete_stream` 产出 48 个增量（正常）；LangGraph 层
最小复现 `Send` + `get_stream_writer`（custom 帧正常）；接线层三处都对；最后靠日志里
**只有 `pipeline_diag` 没有 `generator_diag`** 定位到走错分支。修复：抽 `nodes/stream_bridge.py`
供两种模式共用（避免复制一份导致下次仍只改一边），`pipeline_node` 接入；`sink_for` 用默认参数
绑定 task（流水线 while 循环复用闭包变量，不绑定则增量全挂最后一个 task）。
**实测 TTFD 无穷 → 31.42s，delta_frames 0 → 836**；TTFC 261s / total 282s 基本不变
（总时长由 6 个资源生成决定，属下一条待办）。

**沉淀失败不再静默**：`chat.py` 的 `except Exception: pass` 改为 warning 日志。此前「资源生成了
却没落库」完全无声，只能翻库才发现；本轮正是靠这条日志才发现 `SessionPathStep` 的
`sequence/task_id/resource_type` 三项必填、缺一项即 ValidationError。

**测试**：新增 `test_intent.py` 27 项、`test_chat_intent_routing.py` 3 项（用假 run_session 把
十分钟的真实会话压成秒级契约测试）、`test_pipeline_streaming.py` 3 项；修好 `test_core.py`（默认
端口早已改 3002 而契约仍断言 3000）与 `test_workspace_acl_api.py`（列表已改读 SpaceStore）两处
**早就变红却没人发现**的断言。`check_chat_perf.sh` 新增 TTFD 指标——此前探针只测 TTFC，
测不出「到底有没有增量」。

**未做**：总时长 280s 未动；`path_plan` ValidationError 是否稳定复现未确认；知识库仍只有 15 点；
其余关闭态开关尚未逐个验证；`chat.py` 已 383 行、`learning/` 22 文件，均超规约待治理。

### FS-17 ✅ · 修复删除学习目标误删其他目标路径节点（Claude 全栈轮）

**根因**：`_delete_goal_relations` 把「本目标的路径节点」和「引用了本目标资源的节点」合并成一条
带 `OR` 的 DELETE。后者会命中**别的学习目标**的节点——FS-9 的资源固定只校验所有权、不限制同一
目标，所以同一用户把 A 的资源钉到 B 的节点是合法用法，删 A 却会静默打断 B 的路径。作者写这个 `OR`
的动机应是避免后续 `DELETE FROM resources` 外键悬空，但用删节点来解决代价过大。

**修复**：拆成两条语句——① 删本目标自己的路径节点；② 其他路径上的引用改为
`UPDATE path_items SET resource_id=NULL`（解绑而非删除），且顺序上必须早于 `DELETE FROM resources`。

**测试**：新增 `tests/unit/learning/test_space_mutations.py` 5 项（跨目标解绑、解绑早于删资源、
越权不触碰任何行、内存降级校验 owner、update 带 owner 作用域）——**目标改删此前零测试覆盖**。
同时修好 `test_workspace_acl_api::test_workspace_lists_filter_by_current_user`：`/api/spaces` 列表
已改读 `SpaceStore`（与创建、详情同一事实源），测试却仍往只读的 asset store 塞数据，
自 `list_spaces` 改动起就是红的，改为用真实创建接口种数据。

**真实 PG 活体**：把目标 47 的资源 357 钉到目标 48 的节点 162 → `DELETE /api/spaces/47` →
目标 48 节点数**仍为 6**（修复前会掉到 5）、节点 162 保留且 `resource_id` 置空、目标 47 的
goal/资源/路径全部清零。learning 与 api 两个测试套件全绿。

**顺带发现（未处理）**：库里存在标题为 `hi` 的垃圾学习目标（`space_id=49`），是问候分流上线前
由问候语触发自动建空间留下的；机制已由 `orchestration/intent.py` 堵住，历史脏数据待清理。

### FS-15 ✅ · PERF-D：启动后台预热 bge 模型（Claude 全栈轮）

- 新增 `rag/warmup.py` 的 `warm_models(settings)`：app lifespan 启动时 `asyncio.ensure_future` 后台跑（不阻塞启动），**串行**预热 embedding 再 reranker（绝不并发两个 bge，OOM 铁律）、各 `asyncio.to_thread` 丢线程、复用各模块 `is_available()`（触发加载且吞异常）。
- 门控 `enable_model_warmup`(默认 True) ∧ `enable_rag`；全程降级（模型缺失/离线/加载失败只记日志，绝不崩启动）。消除「首请求 +10–30s 2GB 懒加载」。
- 测试：warmup +5（串行/各门控跳过/降级不外抛）；`with TestClient` 活体验证 lifespan 后台触发 `['emb','rr']` + health 200。**全量 605 passed**。
- Grafana p95 面板未做（指标已埋，属运维侧）。

### FS-14 ✅ · PERF-C：连接池复用 + PERSIST 后台化（Claude 全栈轮）

- PERF-C 三项：超时分级（FS-8 已做）；本轮补齐另两项。
- **共享 httpx client**：新增 `llm_gateway/http_client.py`（模块级 `AsyncClient` 单例 + `get/reset/aclose`）；`gateway._complete_openai_compat` 与 `streaming._stream_openai_compat` 改用，省每次外呼 TCP+TLS 握手（~0.3–1s/次 × 每请求 5–15 次）。独立模块避 gateway↔streaming 循环导入；app lifespan 退出 `aclose`。
- **PERSIST 后台化**：`run_session` 的 Redis 写回/递归摘要 LLM/promote/autogrow 从「yield 耗尽后同步」改 `asyncio.ensure_future` 后台 task（`_spawn_persist`+`_PERSIST_TASKS` 强引用防 GC，`_persist_session` 抽函数）。**done 帧不再等待**（多轮溢出递归摘要时省 3–10s）；`drain_persist_tasks()` 供单测收尾 + lifespan 优雅关停。
- 测试：gateway client 复用 +1、PERSIST 后台化 +1（persist 卡 gate 时 run_session 消费已结束）；3 处 run_session 测试消费方加 drain。**全量 600 passed**。
- **诚实边界**：端到端时长收益仍需真实可用中转站活体采集（relay 502）；连接池省握手、后台化省 done 帧等待（仅多轮溢出显著）。

### FS-13 ✅ · PERF-B（cheap 路由半）：评判类任务便宜档 + 中转站 cheap 路由修复（Claude 全栈轮）

- PERF-B = 砍串行前置 + cheap 路由；本轮做**后半 cheap 路由**（前半 merge profile+planner 留待，见诚实边界）。
- `gateway.CHEAP_TASK_TYPES` 扩为 `{summary, verification, judgment, reasoning}`——质检/judge/反思走便宜档；**不含 generation/planning/profiling**（定核心产出与个性化）。
- **修复 cheap 路由对中转站失效的旧坑**：原 `_select_model` 对 openai_compat 一律返回主模型、cheap→`summary_model` 在中转站会 key 查找失败。新增 `openai_compat_cheap_model` 配置；中转站下评判任务配了便宜档时走它（裸名进 wire payload + 复用中转站 key/base_url，`_is_openai_compat_model` 认便宜档），**默认空=零回归**。
- `openai_compat.payload/stream_payload` 加 `model=` 透传选定模型；新增 `bare_model`/`routed_model_for`。provider 档（qwen/anthropic）评判任务默认走便宜档（turbo/haiku）。
- 测试：gateway +4（评判任务 cheap、中转站便宜档路由+key/base、默认零回归、wire payload model）。**全量 598 passed**。
- **诚实边界**：中转站生产路径**默认零变化**，须运维配 `openai_compat_cheap_model` + eval ablation 守门才生效；**merge profile+planner（去一次串行往返）未做**（侵入图拓扑 + 无可用中转站难验证收益，单独一轮）；cheap 路由降评判类**单次时延**不减**次数**。

### FS-12 ✅ · fan-out 串行根因确认 + 修复（RAG 推理丢线程，Claude 全栈轮）

- 按 docs/19 §6「先确认根因再改」，最小复现逐层隔离：**LangGraph Send 并行**（4×1s=1.03s）、**网关 complete() 并行**（4×1s=1.01s）、**真 graph 扇出串行**（6 资源 gen 间隔 2s）、**retrieve 置空后并行**（span=0.00s，18.59s→4.34s）。**根因坐实：串行在 `generate_resource` 的 RAG retrieve**。
- 根因：`semantic.embed_query` / `rerank.predict` 是**同步 CPU**，在事件循环上跑阻塞 loop，使并发 N 资源 retrieve 逐个串行（LLM 调用无法重叠）；外加 `KeywordIndex` 构建失败未缓存，qdrant 不可用时每资源各自重试慢构建。
- 修复（守 OOM/双模型不并发铁律）：新增 `rag/model_infer.py` 的 `run_model()`——`asyncio.to_thread` 丢线程（事件循环让出→LLM 重叠）+ 全局 `threading.Lock` 串行实际推理（loop 无关，绝不并发 embedding/reranker）；`semantic`/`service._rerank_or_fallback` 接入。`KeywordIndex`：失败 30s 冷却（collapse 重试风暴）+ `invalidate()` 全量重置（含 `_build_lock`，修跨事件循环复用锁的潜在坑）。
- 验证：修复后同实验 6 资源 gen **span=0.00s 并行**，total 18.59s→8.38s。`test_model_infer.py` +3、keyword 冷却 +1、rag_service 事件循环响应性 +1。**全量 594 passed**。
- **诚实边界**：扇出并行性已在真 graph 坐实；端到端 TTFC/total 实降仍需真实可用中转站活体采集（当前 relay 502）。前置串行链（profile→planner→…→path_plan 4–5 次串行 LLM）属 PERF-B 范畴，未本轮处理。

### FS-11 ✅ · PERF-A 第 2 步：token 流式接入 generator/chat/前端（Claude 全栈轮）

- 目标：把 FS-10 的 `complete_stream()` 能力真正接进主链路，让资源逐 token 出（TTFC 体感）。
- `orchestration/nodes/core/generator.py`：取 LangGraph `get_stream_writer()`（`_stream_writer()` 无 run 上下文→None→一次性生成，零回归），每轮生成前发 `reset` 帧、逐 token 经 custom 通道上抛 `{task_id,type,delta,reset}`（带 task_id 供前端按 fan-out 分路）。
- `orchestration/graph.py`：`run_session` 的 `graph.astream` 从 `stream_mode="updates"` 改 `["updates","custom"]`，按 `(mode,chunk)` 解包；custom 帧包成 `{"__stream__":chunk}` yield（updates 帧契约不变）。
- `api/routes/chat.py`：`__stream__` 帧转 `resource_delta` SSE（增量也过 `check_output` 脱敏，末帧完整卡片再脱敏一次）。
- `skills/streaming.py`（新）：`generate_text(llm,messages,*,sink)` 流式优先助手（有 sink+开关→`complete_stream` 推增量，否则 `complete`）；`doc_gen`/`reading_gen` 接入（结构化 skill 不动）；`SkillContext` 加 `delta_sink`；`config` 加 `enable_llm_streaming`（kill-switch）。
- 前端：`useChat` 新增 `resource_delta` reducer（按 task_id 累积流式卡片、reset 清场、末帧 `resource_card` 落定转 streaming=false）；`ResourceCard` 显「生成中」脉冲；`types.ts` 加 `ResourceDelta`/`ResourceCard.streaming`。
- 守预算：gateway.py 433→228 行，拆出 `llm_gateway/models.py`（Completion/StreamChunk）+ `llm_gateway/streaming.py`（流式实现，gateway `complete_stream` 薄委托）。
- 测试：streaming 助手 +4、generator 流式 emit +2、chat `resource_delta`/脱敏 +2，code_health 行预算恢复绿。**全量 589 passed + 前端 tsc 通过**。真实 langgraph `["updates","custom"]` 元组形态已活体验证。
- **诚实边界**：TTFC 改善依赖中转站可流式响应；relay 502 时未产出增量→回退 `complete()`→离线兜底（无增量帧，不报错）。fan-out 仍串行（docs/19 §6），流式只让"首资源逐字出"，total 时长要靠 fan-out 并行化才降。

### FS-10 ✅ · PERF-A 流式地基：`gateway.complete_stream()` 能力 + 单测（Claude 全栈轮）

- 目标（docs/19 §5 优先级 2）：TTFC 186s→秒级的唯一解是 token 级流式。本轮按"先建能力 + 单测，再接 generator/chat"只做**网关流式能力**，零回归。
- `llm_gateway/gateway.py`：新增 `complete_stream()`（async generator，逐 `StreamChunk` yield 增量，末帧 `done=True` 带聚合 `Completion`）；compat 走 `httpx client.stream()`、litellm 走 `acompletion(stream=True)`；新增 `StreamChunk` 模型 + `_sse_json`/`_litellm_chunk_delta` 解析助手。**`complete()` 逐字节未动**。
- **降级铁律**：流式失败且**未产出增量**→回退一次性 `complete()`（degraded 单帧）；**已产出后失败**→用已收内容收尾、记降级、**不重复回退**（避免文本翻倍）；无凭证/generation 关闭仍抛错交上层本地兜底；schema 类任务不流式（调用方用 `complete()`）。
- `llm_gateway/openai_compat.py`：新增 `stream_payload`（+stream=True）、`stream_delta`（chat=`choices[0].delta.content`；responses=`response.output_text.delta`）。
- 测试：`test_gateway.py` +8（compat 增量→done、responses wire、502 未产出→回退、半截断流不重复、无 key 抛错、generation 关闭抛错、litellm 分支），`_S` 补 `enable_llm_generation`。**runtime 28 passed**。
- **未接 generator/chat**：仍是非流式体感。下一步（PERF-A 第 2 步）：LangGraph 自定义 stream 通道（`get_stream_writer`）把 skill 内增量经队列上抛 → chat 新增 `resource_delta` SSE 帧（带 task_id 区分 fan-out）→ 前端 ResourceCard 增量渲染。注意：fan-out 仍串行（见 §6），流式先改善"首资源首字"，并行化是另一项。

### FS-9 ✅ · 候选资源 → 学习路径节点显式绑定（产品闭环，Claude 全栈轮）

- 需求：把「发现/保存资源」与「学习路径」双向打通——资源详情页可把一个资源固定到路径的某个节点（docs/23 §5 第 6 项）。纯数据操作，不依赖 LLM，502 也能验。
- 后端 `learning/path_ops.py`：新增 `pin_resource_to_item`（写 `path_items.resource_id`，节点+资源**双重 ACL 校验**——绑别人资源=越权读，拒 403 `resource_forbidden`；空 resource_id 解绑写 NULL）；`load_active_path_items` 读出 pinned 资源、`_resources_by_id` 批查、`_merge_resources`（pinned 置顶标记、concept 自动关联去重补充，最多 3 个）；`PathItemResource.pinned` 字段。
- 后端 `api/routes/plan.py`：新增 `PUT /plan/items/{item_id}/resource`（403 区分 path_item/resource forbidden、404 not_found、无 PG 降级 `pg:unavailable`）。
- 后端 `learning/today.py`：`TodayPathResource.pinned` 透传，`_real_path_nodes` 映射 pinned。
- 前端：`lib/planApi.ts` +`pinResourceToItem`；`lib/todayTypes.ts` +`pinned`；新组件 `components/resource/PinToPathPanel.tsx`（读真实节点 picker→绑定，已绑定显示「已固定到节点 X」，无真实节点提示先生成路径）；接入资源详情页；`PlanTimeline.tsx` pinned 资源加 📌 徽标。
- 测试：`test_path_ops.py` +5（绑定/解绑/拒未拥有资源/拒他人节点/无 PG 降级），`test_plan_api.py` +2（auth gate + 降级）。**path/plan/today 24 passed；前端 tsc --noEmit 通过**。无需迁移（`path_items.resource_id` FK 列已存在）。未改 LangGraph 主链路。

### FS-8 ✅ · 审查修补 + PERF 地基（度量先行 + 超时分级，Claude 全栈轮）

- 审查修补（1d3f932）：MDN candidate_id→sha1 短 hash；client 工厂读 settings timeout；discover 路由层 +3 测试。
- PERF 地基：`scripts/check_chat_perf.sh`（真实 /chat SSE 采集 TTFC/total/llm_calls）；基线 **TTFC=186s/total=187s/15 次 LLM 串行**（暴露非流式+fan-out 疑似串行）。
- PERF-C 超时分级：`llm_connect_timeout_s=5s` 独立 read（gateway httpx.Timeout），SYN 黑洞快速降级；test_gateway 同步。
- docs/19 §5 写入基线 + 下一轮优先级（fan-out 真并行 / PERF-A 流式，单独一轮）。
- 全量 568 passed；未改 LangGraph 主链路。

### FS-7 ✅ · 官方文档真实接入（MDN 公开搜索 + 领域门控，Claude 全栈轮）

- `mdn_search.py`（新）：MDN 公开 search API（zh-CN，缓存/限频/降级/trust_env=False）+ `parse_mdn_payload`（score 过滤）+ `is_web_topic`（领域门控）。
- `resource_discovery.py` +`merge_live_docs`（替换静态 official_doc，保留其他）。
- `workspace.py` discover 路由：official_doc + is_web_topic 才查 MDN，否则回退静态。
- conftest 守卫拦 `MdnSearchClient.search_docs`；config +enable_mdn_search。
- 活体：前端目标得 MDN 真实文档，ML 目标门控回退静态。全量 564 passed。

### FS-6 ✅ · 资源详情页 B 站视频站内播放 + codex 审查交接（Claude 全栈轮）

- `components/resource/ResourceEmbed.tsx`（新）：external_video + embed_url → B 站官方播放器内嵌（sandbox/no-referrer，点击才挂 iframe，不自动外呼）；`resources/[id]/page.tsx` 接入。
- `docs/24`（新）：codex 审查向导，§4 主动暴露 7 项待确认边界（读侧 ACL/快照节流/concept 精确匹配/token 空串残留/candidate_id 唯一性/内存兜底多 worker/行数压线）。
- 活体：id=254 真实 bvid 站内播放成功，真实搜索→保存→播放闭环。全量 557 passed。

### FS-5 ✅ · W3 续：路径节点关联资源（plan↔resources 闭环补完，Claude 全栈轮）

- `path_ops.py`：节点按 concept 批量关联资源（`_resources_by_concept`，每节点≤2，一次查询）；`PathItemResource`/`PathItemView.resources`；`today.py` 透传 `TodayPathResource`。
- `seed_demo_cli.py`：路径节点 concept 改用该 space 真实资源 concept（对齐匹配），不足补 fallback 泛步。
- 前端 PlanTimeline 节点「这一步可以看」+ 资源链接进详情页；todayTypes +resources。
- 活体闭环：节点→资源链接→/resources/331 详情→学习状态，整条无断点。全量 557 passed。

### FS-4 ✅ · W3：/plan 真实路径节点操作 + /growth 双序列火花线（Claude 全栈轮）

- **后端**：新增 `learning/path_ops.py`（读真实 path_items / 标完成重算 progress / 补救节点插入 + sequence 重排 / owner ACL / PG 降级）；`today.py` 接真实节点（`_real_path_nodes`，节点带 item_id，progress 真算，空回落合成）；新增 `api/routes/plan.py`（PATCH status + POST insert，注册进 app.py）。`tests/unit/learning/test_path_ops.py` 6 项 + `tests/unit/api/test_plan_api.py` 4 项 + today 真实节点映射 2 项。
- **前端**：PlanTimeline「标记完成」按钮 + plan/page load 回调刷新；mistakes 补救计划「插入当前学习路径」入口（pathAnchor=当前节点 item_id）；`lib/planApi.ts`；GrowthTrendChart 双序列（progress 实线 + completed_resources 点线 + 图例）。
- **修坑**：cookie 模式 access_token 空串，按钮可用性判据从 `Boolean(token && ...)` 改为只看 item_id（已记 memory）。
- 活体：点标记完成→进度 0→33% + 节点状态联动；错题插入→路径 3→4 节点（异步状态补救节点入第 2 位）；/growth 双线火花图渲染。全量 556 passed。

### FS-3 ✅ · W2 主体：B 站真实搜索 + 行为闭环喂画像（Claude 全栈轮）

- **B 站搜索**：新增 `learning/bilibili_search.py`（wbi 签名/缓存/限频/降级，`trust_env=False`）；`resource_discovery.py` +`discovery_query`（goal+薄弱点组合词）/`merge_live_videos`（纯函数合并）；discover 路由接入（config 开关）；conftest 类级 hermetic 守卫；`tests/unit/learning/test_bilibili_search.py` 10 项。活体：真实条目 3 条 + 浏览器保存 bvid 落库。维护风险：wbi 算法变更→自动降级静态候选。
- **行为闭环**：`profile.py` +StudyStats 统计 + 快照 payload 合并（状态变化驱动新快照）；`profile_history.py` +completed_resources；GrowthEvidence +资源使用效果/错题复盘率。活体：标 done → v3 快照 completed_resources=1。
- 验证：全量 544 passed；tsc 0 错；截图 ws-resources-live-bili.png。

### FS-2 ✅ · W1 收口：资源详情页 + 学习状态回写 + 种子接线 + 导师中间态（Claude 全栈轮）

**核心**：行为回流第一块拼图——资源有了独立详情页和可回写的学习状态（unread/in_progress/done/reviewed），落 `resources.study_status` 列（可统计、后续喂画像 progress 重算）。

- 后端：新增 `learning/resource_detail.py`（聚合 + `ResourceStudyStore` 内存兜底）；`workspace.py` +`GET /resources/{id}/detail`、`PATCH /resources/{id}/status`（Literal 422；状态写权限强制 owner）；`init_db.py` resources +`study_status`/`status_updated_at`；测试 `tests/unit/api/test_resource_detail_api.py` 6 项（401/404/403/降级/回写往返/非法值）。
- 前端：`/resources/[id]/page.tsx`（223 行，档案化：状态印章 + Resource Nº + Why + `ResourceStudyActions` 四档点选即存 + 关联目标/错题卡 + 全文）；ResourceList 接「查看详情」；`lib/resourceDetailApi.ts`。
- 种子：`scripts/seed_product.sh` 接线 codex 写好未引用的 `seed_demo_cli`，灌 24 资源（带 provider/href/embed_url meta）→ 总量 139。
- 中间态：`CompanionThinking.tsx` 时间驱动四阶段文案（0/2.5/7/16s），替换牛牛面板 busy 骨架。
- 回归修复：IA 锚点词「推荐理由/成长趋势/能力变化」在档案化重构中丢失，加回组件。
- 环境坑：dev 长跑后 rewrites 静默失效（/api/* 404 进 _not-found），重启 dev 即愈（已记 memory）。

**验证**：全量 532 passed；tsc 0 错；check_frontend_ia/profile/today ok；活体=浏览器状态点选落 PG（id=117 in_progress）+ detail 聚合（goal/错题数/全文）+ 中间态文案抓取；截图 ws-resource-detail.png。

### FS-1 ✅ · Claude 全栈接管首轮：codex 验收 + 沉淀闭环三波（详见 git a50b516 与 docs/23）

①验收 codex 资源发现/画像历史：修**快照同质堆积**（每次 GET /api/profile 都写 → 内容变化才写，+3 测试）与 fallback 顿号串；②小账：mindmap/debate 映射、course id 裸露过滤、空间资源分组折叠、种子 meta 补 provider；③/plan「行程单」+ /growth「成长对账单」档案化（`GrowthTrendChart.tsx`：火花线/leader-dots 对账/快照<2 诚实占位；+ws-leader token）；④候选资源一键保存闭环（`save_resource` candidate_id 幂等 + `POST /resources/save` + 前端已入库态）；⑤修 `test_lora_export_api` 非 hermetic（路由测试必须 mock safe_pg_pool）；⑥`docs/23` 战略审视（四视角 + W1-W4 路线）。验证：526 passed；活体截图 ws-plan-itinerary / ws-growth-ledger-trend / ws-resources-save-flow.png。**协议**：codex 暂停写码，Claude 全栈 + 直接定计划实施。

### H-Review ✅ · H1-H4 验收修复 + /profile「学习档案」视觉升级（Claude 前端轮）

**背景**：分工切换——前端归 Claude、codex 转后端。codex 按 `discuss/H阶段学习闭环产品化执行计划.md` 连续交付 H1 `/profile`、H2 `/plan`、H3 `/growth`、H4 资源发现入口；Claude 逐轮独立验收（codex 看不到审批结果，问题直接就地修，全程避开其活跃区——动文件前查 mtime）。

**验收修复（4 处）**：
- `frontend/lib/nav.ts`：growth 描述「查看画像和自进化轨迹」→「能力随时间的变化与自进化轨迹」（/profile=当下快照、/growth=时间趋势，划清双入口边界）。
- `frontend/components/growth/GrowthEvidence.tsx`：薄弱点兜底误用 `today.profileSignals.map(s=>s.value)`（profile 接口失败时会把「62%」「视频讲解 + 五题短练习」当薄弱点渲染成 warning Tag）→ 改 `profile?.weak_points ?? []` 走既有空状态。
- `frontend/components/growth/GrowthSummary.tsx`：删同源 progress 伪 delta（`/api/profile` 与 `/api/today` 的 progress 同源，delta 恒 0）、「能力变化」文案改诚实；真趋势待后端画像快照历史表（已移交 codex，越早落库越早有数据）。
- `frontend/components/resource/ResourceDiscovery.tsx`：fallback 薄弱点是顿号连接串（「A、B、C」整条渲染成一个长 Tag）→ `flatMap(v=>v.split("、"))` 拆分。

**/profile 档案化（设计概念：学习档案 Learner's Dossier，印刷品隐喻贴合暖白×海军蓝）**：
- 新增 `frontend/components/profile/ProfileGauges.tsx`（152 行）：`ProgressRing`（SVG stroke-dashoffset 1.1s 生长 + serif 数字 count-up）、`MasteryMeter`（印刷尺刻度条，`ws-ticks` 卡片底色细线每 10% 切一刀，依次延迟生长，role=meter 无障碍）、`DossierStat`（大号 serif count-up 统计）、`useCountUp`（rAF，自理 prefers-reduced-motion——globals 只压 CSS 动画压不到 rAF）。
- 重构 `ProfileOverview.tsx`（79 行）：印章三态数据来源（redis=实时记忆青 / pg=历史画像灰 / empty=待完善 amber，`ws-stamp` 双线框微倾斜 hover 回正）+ PROFILE Nº 编号（user_id 前 8 位）+ 目标 serif 大字 + 环形进度不对称构图 + 三 stat 卡 90/170/250ms stagger。
- 重构 `ProfileEvidence.tsx`（199 行）：知识基础刻度条阵列；薄弱点 №01-08 编号排序（首位「最优先」accent，与错题 top_concepts 交叉命中标「错题印证」warning——画像证据链首版落地）；错题模式双大数字 count-up + 高频概念铅字排名（01/02/03 大号淡 serif）；偏好虚线档案条目。
- `frontend/app/(app)/workspace.css` 91→148 行：`ws-rise`（入场）、`ws-stamp`（印章）、`ws-ticks`（刻度轨道）。`check_profile_page.sh` 的 grep 关键词断言全程保留，`page.tsx` 零改动。

**事故修复**：codex 验证 H2-H4 时在 dev 运行中反复跑 `build_frontend.sh`（已知坑：dev/build 共写 `.next`），叠加 :3000 还遗留一组更早的 dev 进程（三方共写），/profile 热更新后 chunk 断裂（`Cannot find module './4985.js'`，webpack-runtime require stack）。处置：`stop_frontend.sh 3001` + `stop_frontend.sh`（清 :3000 双进程）→ `rm -rf frontend/.next` → `start_frontend.sh 3001` 重建（Ready 3.4s，/profile 冷编译 43.9s 后 200）。

**验证结果**：`check_profile_page`/`check_frontend_ia`/`check_today_page` 全 ok；tsc 0 错；五核心页活体 200；Playwright 桌面全页 + 390px 移动端截图（`ws-profile-dossier.png`/`ws-profile-mobile.png`）——印章/刻度/排名/count-up 全部生效，移动端单列无溢出；环形 0% 为 admin 画像真实 progress（诚实呈现，非 bug）；「错题印证」未现身因当前薄弱点与错题概念确实无交集（逻辑验证正确）。行数规约全过（≤300）。**移交 codex（后端）**：`POST /api/resources/discover`、画像快照历史表（/growth 真趋势）、tutor 流式或「仍在整理答案…」中间态。**前端 backlog**：牛牛面板避让策略、/plan //growth 同款档案化视觉（待用户验收 /profile 方向后铺开）。


### M8-Pet ✅ · AI 学伴「牛牛」产品化（companion/ 六状态 + 2D 漫游 + 拖拽）+ 产品化进度审查

**背景**：用户提供 CodexPet 标准宠物包（`E:\archives\zip`：1536×1872 = 8 列×9 行，单帧 192×208），按 docs/21 定位（学习陪伴代理，非聊天按钮）+ docs/22 §7.1 验收做产品级首版；后追加需求：全屏上下左右乱跑 + 可拖拽。本轮与另一会话（E1）并行，避开其活跃区。

**关键实现**：
- 资产：`frontend/public/pets/cow/spritesheet.webp`（Pillow q88，2.4MB→566KB）；行映射：0 待机/1 走路/2 受挫/3 开心/4 庆祝/5 睡觉/6 思考/7 敲电脑/8 看书。
- 新增 `frontend/components/companion/`（7 文件）：`sprites.ts`（精灵元数据）、`companionState.ts`（六产品状态 idle/thinking/running/waiting/success/failed→精灵行映射 + `describePage` 页面上下文含 /spaces/[id] 的 space_id 提取 + `buildContextHint` + `companion:status` CustomEvent 后台联动入口）、`CompanionAvatar.tsx`（CSS 逐帧动画，prefers-reduced-motion 静帧，idle 120s 自动入睡）、`useCompanionRoam.ts`（**2D 漫游**：视口内随机目标、顶部留 96px 防遮页头、<768px 不漫游只可拖、面板打开走回右下角家位）、`CompanionPanel.tsx`（暖白纸面板：上下文行「正在陪你看：X · 状态」+问答+输入）、`LearningCompanion.tsx`（编排：**拖拽**（>6px 判拖、落点夹回视口、click 抑制）、悬停停步（只认 mouse 指针）、调 `/api/tutor/ask` 带 question+context_hint、thinking→success/failed 状态机、/chat 自动退场、mounted 前不渲染防水合闪烁）、`index.ts`。
- `(app)/layout.tsx` 挂 `<LearningCompanion />`；`FloatingTutor.tsx` 恢复原始 FAB 版本退役保留（无人引用）。
- **scripts 修复**：`start_frontend.sh`/`build_frontend.sh` 的 cmd.exe 行加 `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'`——Git Bash 不再把 /C、/api 转成 D:/Program Files/Git/...（契约 `cmd.exe /C` 子串保留，test_core 契约测试通过）。

**验证结果**：`bash scripts/check_today_page.sh` ok；`bash scripts/check_frontend_ia.sh` ok；`bash scripts/build_frontend.sh` 通过（14 路由，Git Bash 原生首通）；`bash scripts/test_unit.sh`（today/assets/demo_seed/today_api/前端脚本契约）**12 passed**。活体：底部漫游版已浏览器验证（截图 companion-roaming.png：牛牛走到页面中部）+ 面板/状态机验证；**2D+拖拽版 build 通过但浏览器活体未完成**（dev server 被会话后台任务回收反复秒死，环境因素非代码），交 codex 验证：登录 → 看牛牛全屏乱走 → 鼠标悬停应停步 → 点击开面板（上下文行）→ 拖拽换位 → 提问看 思考中/庆祝/受挫 状态。

**审查结论（同轮完成，证据见截图 review-*.png）**：A1/A2/A3/B1/C1/D1 代码质量高、TDD 到位（today/seed/assets 单测 11 项全过）；但 ①B1 末两步未完——`demo_seed.py` 无任何脚本引用，新种子（B 站视频/官方资料/oer 元数据）没灌库，PG 里仍是 M8-P1 旧 114 资源（provider 全空），D1 的来源分类 UX 实际不可见；②`/spaces/[id]` 把 60 资源平铺超长列表，违反计划书「禁止堆成后台表格」；③resources 页 RESOURCE_VIEW 缺 mindmap/debate 旧类型映射（20 条 mindmap 落兜底「学习资源」）；④空间详情把 course id「seed-demo」裸露给用户（文案红线 demo 字样）；⑤`check_productized_learning.sh` 未建。环境真相：用户「看不到效果」系三重环境问题——:3000 被 portfolio-site-deploy 占用、后端是 6-11 23:35 旧进程（无 /today 路由 404→前端静默 fallback 静态数据）、Docker Desktop 掉线 PG 不可用；本轮已拉起 Docker+graph 栈、重启后端 :8000（/today 真数据已活体）。

### M8-P1 ✅ · 产品雏形第一波：空间闭环 + Today 驾驶舱 + 种子数据 + 微辅导浮窗

**背景**：用户要求按 `docs/21-AI导师学习系统产品化开发文档.md`（与 codex 共创的产品化文档）落地产品雏形，并指定「学习空间详情优先」、数据允许占位但结构要真实（§13：20 画像 + 100+ 资源）。本轮对应 docs/21 §16 优先级清单与阶段 1/3/4。

**关键实现**：
- **闭环命门**（自主补充，已向用户说明）：`learning/spaces.py` 新增 `SpaceStore`（PG 优先降级内存，仿 mistakes 范式）——`create_space`/`get_space_detail`（聚合 goal+path_items+resources）/`save_session_outcome`；`chat.py` 收集 assemble 资源全文 + path_plan 路径，done 前 best-effort 沉淀（无 space_id 且有实质产出 → 自动按目标建空间），emit `space_saved`。此前 chat 产出是一次性的，learning_goals/learning_paths/path_items/resources 四表建好从未写入——这是 /plan、/resources、/spaces 空壳的根因。
- **迁移列**：`init_db.py` 给 learning_goals+progress、resources+goal_id/concept、learning_paths+goal_id/tenant_id/summary/strategy、path_items+task_ref/resource_type/concept/objective/rationale/difficulty。
- **新端点**：POST /api/spaces、GET /api/spaces/{id}/detail（ACL 403/404）、GET /api/profile（Redis 画像优先→PG learner_profiles→空，聚合错题 top 概念/空间/资源统计，≥6 维对齐 docs/21 §10）、POST /api/tutor/ask（SafetyGateway 进出双闸 + 画像上下文注入 + LLM 异常降级离线占位）。
- **种子数据**：`scripts/seed_demo.sh` → `scripts/jobs/data/seed_demo.py` + `seed_content.py`（22 真实概念×6 类生成器=114 资源；21 画像；10 空间；10 路径 36 步带 mastery_status；30 错题；course='seed-demo' 幂等先删后插；admin upsert 真实 password_hash）。
- **前端**：`/today`（问候+主目标进度+下一步建议带推荐理由+画像薄弱点+错题提醒+快速入口+最近资源）、`/spaces/[id]`（StatCard×3+进度条+路径时间线（done/in_progress/not_started 三态+「为什么是这一步」）+资源类型筛选可展开）、/spaces 列表+创建表单+卡片链接、`nav.ts` 重排（today 首位、chat→「AI 导师」、SideNav +Sunrise 图标）、`components/chat/FloatingTutor.tsx` 全局浮窗（页面上下文 hint，/chat 不挂）挂 (app)/layout。

**验证结果**：
- `bash scripts/test_unit.sh`：**501 passed, 2 warnings**（484→501，+17：spaces_flow 6 + tutor_profile 5 + 既有）。顺手修 `test_video_jobs.py` 限流污染（login 测试无 reset_login_limiter_for_tests，新增测试改变时序后顶进 5 次/300s 窗口 → 429；按 security 测试既有模式补 reset）。
- `npx tsc --noEmit` 零错误；`check_frontend_ia.sh` ok；`bash -n` 新脚本通过。
- 活体：seed 输出 21/10/10(36)/114/30；login→GET /spaces（3 空间）→GET /spaces/11/detail（10 步 60 资源 progress 0.35 当前步=过拟合与正则化）→GET /profile（source=redis，错题 30/20，资产统计齐）→POST /tutor/ask（200，3.5s 降级占位）；浏览器 /today、/spaces、/spaces/11、浮窗提问全通（截图 ws-today/ws-space-detail/ws-spaces-list/ws-floating-tutor.png）。
- 环境插曲：Docker Desktop 中途掉线（PG/Redis 等容器全停）→ 已拉起 Docker Desktop + start_graph + init_all + 重灌 seed。

**诚实限制**：tutor 真 LLM 答案未活体（中转站 key 403 GROUP_DISABLED，同 M7-RunFix 外部因素；降级矩阵已兜底，恢复即自动切真答案）；chat 沉淀的真实 LLM 全链路活体待中转站恢复后验（机制由 6 个单测锁定）；`check_frontend_glass` 失败系 globals.css 668 行（codex 活跃区，本轮零接触）；`next build` 未跑（codex dev 占用 .next）；/profile 画像页、/plan 接真数据、/chat 导师化（docs/21 阶段 2/5）未做属下一轮；Redis 实时画像与 PG seed 画像可能不一致（Redis 优先是设计行为）。

### M8-WS-Fix ✅ · 会话持久化修复：Next rewrites 同源代理（刷新不再掉登录）

**背景**：用户报告「每次刷新都回到登录页」。根因：dev 绑 `127.0.0.1:3000` 而脚本注入的 API base 是 `http://localhost:8000/api`，页面源与 API 源 host 不同 = **跨站**；后端会话 cookie `SameSite=Lax` 在跨站 fetch 一律不发送 → 刷新后 `/auth/me` 永远 401 → 踢回登录页。登录后页内正常是开发模式 Bearer 兜底掩盖了 cookie 链路断裂；同根因还导致 csrf cookie 在浏览器侧不可读（CSRF 双提交实际失效，全靠 Authorization 豁免规则放行）。

**修复（业界标准同源化）**：
- `frontend/next.config.mjs` 加 `rewrites`：`/api/:path*` → `BACKEND_ORIGIN`（默认 `http://127.0.0.1:8000`）`/api/:path*`。浏览器只面对一个源，session/csrf cookie 都是第一方。
- 10 处 `API_BASE` 默认值从绝对地址改相对 `/api`（6 页面 + MistakeForm + KnowledgeUpload/VideoJobCard + lib/auth + lib/useChat），`NEXT_PUBLIC_API_BASE` 仍可覆盖直连。
- `scripts/start_frontend.sh` / `build_frontend.sh`：API base 默认 `/api`，新增第 3/2 位参数与 `BACKEND_ORIGIN` 环境变量透传进 cmd.exe set 串。
- `tests/unit/test_core.py` 契约断言同步更新（默认 `/api` + BACKEND_ORIGIN 注入）。
- 后端零改动（CORS/SameSite=Lax 保持，脚本直连场景照旧）。

**验证结果**：
- 契约测试 `test_frontend_scripts_support_port_and_api_base_overrides` 通过；`bash -n` 通过；check_frontend_glass/ia 双 ok。
- 重启 dev 活体（经 :3000 代理）：`/api/health` 200；**login → Set-Cookie 落同源 → 仅凭 cookie（无 Bearer）`/auth/me` 200** = 刷新恢复链路修复；SSE `/api/chat` 经代理逐帧流出不缓冲（session/agent_step/resource_card 帧）；纯 cookie 会话 + `X-CSRF-Token` 双提交写请求放行 = CSRF 机制在浏览器侧首次真正可用。
- 同源请求无条件携带第一方 cookie 是 HTTP 协议行为，curl 与浏览器一致；用户侧需硬刷新一次加载新 bundle 后登录即可。

**诚实限制**：本机 `localhost:3000` 被另一 IPv6 服务占用（裸 404），访问入口请统一用 `127.0.0.1:3000`（同源代理下 cookie 不再受访问 host 影响，但 dev 只绑了 127.0.0.1）；production `next start` 的 rewrites 同样生效，但生产部署若走独立反代需在反代层配置同源转发。

### M8-WS ✅ · 内部工作台视觉重设计：「暖白纸张 × 海军蓝」（Shell + 6 页）

**背景**：用户反馈内部页面「完全没有设计，没有使用欲望」；且 codex 并行开发的首页/登录页已转向「深海军蓝 + 暖白纸张 #f7f5f0 + 衬线标题」新品牌，旧「深紫黑 + 白玻璃」工作台与之割裂。用户拍板：工作台基调改「暖白纸张 × 海军蓝」；本轮做 App Shell + 6 功能页，/chat 下一轮专做（本轮仅最小不割裂调整）。

**关键实现**：
- 新增 `frontend/app/(app)/workspace.css`（91 行）：`.ws-root` 作用域变量（--ws-navy/--ws-ink #051A24/--ws-paper #f7f5f0/--ws-line/--ws-accent cyan-700）+ ws-serif/ws-card/ws-eyebrow/ws-skeleton 工具类；**三个暗色泄漏修复**（`.ws-root ::selection`、`.ws-root .markdown` 整组翻亮——/chat 白卡 markdown 可读性的命门、ws-root 自身盖 body 暗渐变）。**globals.css 零接触**（codex 活跃区），覆盖全靠 .ws-root 后代选择器特异性。
- 新增 `frontend/components/workspace/`（9 文件，components 根目录第 8 条目 **已封顶**）：SideNav（墨蓝侧边栏：lucide 图标导航 + active 青色竖条 + 用户卡；<lg 变顶栏+横滚 pill）、PageHeader（eyebrow+衬线大标题）、WsCard/StatCard/EmptyState/Tag（6 语义 tone）/WsButton（primary/outline/ghost）、resourceMeta（6+1 资源类型→图标/中文名/配色）、index barrel。展示组件无 "use client"（plan 页保持 RSC）。
- 重做 `(app)/layout.tsx`：去整块 GlassPanel → ws-root 暖白底 + SideNav + max-w-6xl 内容区。
- 六页重做（统一三态：ws-skeleton 加载 / EmptyState 引导 / 数据卡片；**全部 API 调用与状态逻辑保留**）：plan TODO→「路径如何生成」3 步引导页+双 CTA；spaces 卡片网格+状态 Tag；resources 类型筛选 chips+图标网格卡；knowledge 上传引导条+行式文档卡（格式/visibility Tag）；growth StatCard×3+导出按钮上移 PageHeader+协作轨迹竖向时间线（payload 收进 details 折叠）；mistakes 重构主从布局（左可选列表+右 sticky 详情），拆 `MistakeDetail.tsx`(165) + `MistakeForm.tsx`(74)，page 259 行。
- /chat 最小调整：page 加 PageHeader；`Workspace.tsx` embedded 模式不再渲染与 shell 重复的品牌/用户/退出 header（保留「新会话」），非 embedded 路径原样。
- 依赖：+`lucide-react@^1.17.0`（React 19 peer 兼容；npm install 隔离执行避开 codex 的 package.json 改动）。

**验证结果**：
- `bash scripts/check_frontend_glass.sh`：ok（全文件 ≤300 行、components 根 8/8、globals token、glass 5 组件保留）。
- `bash scripts/check_frontend_ia.sh`：ok（4 个 API 字符串 + workspaceNavItems）。
- `npx tsc --noEmit`：零错误；dev :3000 下 7 个工作台路由 + `/` + `/design` 全部 200 无编译错误标记。
- Playwright 视觉活体（codex 释放浏览器后补做）：spaces/plan/resources/knowledge/growth/mistakes/chat 七页桌面截图全过；**错题飞轮全链路活体**（创建→选中→归因→补救计划→针对性资源）端到端跑通，主从布局/语义色块/资源卡正常；growth 真实数据（StatCard、轨迹时间线、payload 折叠）正常；375px 移动端顶栏+横滚导航正常；SPA 侧边栏导航与激活态正常。截图存项目根 `ws-check-*.png`。
- **未跑 `next build`**：codex 正用 dev server 工作（Playwright 浏览器一度被其占用），dev/build 共写 .next 会破坏其会话；tsc+热编译已覆盖类型与模块解析面，build 留待 codex 收尾后补跑。

**诚实限制**：/chat 内部（AgentTimeline/ResourceCard/DebatePanel 等 slate 亮色组件、prompt-kit 接入、上传/视频工具区样式、「开始」按钮仍是旧 indigo 紫）属下一轮；spaces/resources 数据态卡片仅靠类型与空态截图保证（后端当前无 spaces/resources 数据）；跨页硬刷新后需重登录是 127.0.0.1↔localhost cookie 跨站环境因素，非本轮引入。**components 根目录已满 8/8，后续新组件必须放进现有子目录**。

### M7-RunFix ✅ · 运行修复：LLM 凭证失效降级一致性 + Windows 前端脚本

**背景**：用户转入"亲手测试 + 前端优化"阶段，本轮把全栈跑起来供用户验收，过程中活体暴露两个运行级 bug 并修复。

**关键修复**：
- **生成 skill 降级判定缺口**：旧实现只对异常消息含 `OFFLINE_TAG`（no_api_key）走离线占位；中转站 403（`GROUP_DISABLED`，key 分组被停）抛 `HTTPStatusError` → `ok=False` → critic 全拒 → 4 轮重规划 → **0 资源 0 路径**收场（违反降级铁律）。修复：6 个 `*_gen` skill 的 try 块只包 LLM 调用，任何异常统一降级离线占位（`offline.log_llm_fallback` 记日志 + `degraded_from` 标注异常类型），"无 key"与"key 失效/网络故障"行为一致。`path_plan`/`quality_check` 原本已是全异常降级，未动。
- **前端脚本 cmd.exe 参数空跑**：当前开发面是 WSL bash，`cmd.exe //C` 会进入交互式 cmd、npm 从未执行；历史 Git Bash 场景与当前环境相反。修复 `start_frontend.sh`/`build_frontend.sh` 改为 `cmd.exe /C ...`，并由 `test_core.py` 契约锁定，避免脚本返回 0 但未真实构建。

**验证结果**：
- 红灯：新增 `tests/unit/flow/skills/test_llm_unavailable_fallback.py` 7 项（6 skill×403 + ConnectError）初跑全红。
- 绿灯：`bash scripts/test_unit.sh`：**484 passed, 2 warnings**（477→484；`test_reading_gen_handles_llm_error` 按新契约更新为降级断言）。
- 复验：`bash scripts/build_frontend.sh` 真实执行 `next build` 通过，13 路由；`bash scripts/test_unit.sh tests/unit/test_core.py::test_frontend_scripts_support_port_and_api_base_overrides -q` 通过；递归 `bash -n scripts/*.sh` 通过。
- 活体（中转站 13:31 恢复后）：`/chat` 真实 LLM 全链路「线性回归入门」一轮过验收：**6 资源 + 6 步个性化学习路径**（带 depends_on/难度/objective/个性化 strategy），~75s 收口 `event: done`；前端 done 后正常解锁输入框，多轮可继续。`check_api_security.sh 8000` 7 项通过。
- 服务态：8 容器全在（PG/Redis/Qdrant/Neo4j/Kafka/MinIO/Prometheus/Grafana）、后端 :8000、前端 :3000（dev）。

**诚实限制**：403 场景因中转站当日自行恢复无法再活体复现，降级行为由 7 个单测锁定；中转站稳定性是外部不可控变量（docs/19 §1 因素 6），凭证侧防线=降级占位 + 日志 + degraded_from 可审计。reranker 模型仍未下载（rerank 走 weighted_sort 降级）；RAG semantic 路有一处 "qdrant failed" 空消息警告待查（不影响 keyword/graph 路与最终生成）。

### M7-W3-E ✅ · LoRA 数据质量门禁与数据集版本化

**背景**：W2-G 已能导出 LoRA JSONL，但缺训练前质量门禁，且历史 smoke 只等到 `session_start` 就断开，导致 `lora_samples_latest.jsonl` 里出现只有“协作轨迹摘要：”的空样本。W3-E 补齐数据质量检查、版本化输出和导出端空轨迹过滤，避免垃圾样本直接进入训练。

**关键实现**：
- 新增 `src/reflexlearn/training/dataset_quality.py`：`QualityMetrics` / `QualityReport` 强类型报告，检查样本数、三段完整性、敏感泄漏、重复率、assistant 长度和关注节点覆盖率（critic/metacognition/generate_resource/debate/judge/pipeline）。
- 新增 `src/reflexlearn/training/dataset_registry.py`：按 `logs/lora_datasets/YYYYMMDD-HHMMSS/` 写 `train.jsonl`、`manifest.json`、`quality_report.md`；质量通过才写 `READY` 标记，失败会移除旧 READY。
- 新增 `scripts/jobs/training/prepare_lora_dataset.py` + `scripts/prepare_lora_dataset.sh`：默认读取 `logs/lora_samples/lora_samples_latest.jsonl`，质量不达标非 0 退出，所有运行仍走 scripts 入口并写 `logs/prepare_lora_dataset.log`。
- 修改 `src/reflexlearn/training/lora_samples.py`：`load_lora_samples` 支持从 JSONL 读回强类型样本；只有 `session_start` 的空轨迹不再生成训练样本。
- 修改 `scripts/checks/api/check_lora_export.sh`：LoRA 导出 smoke 等待 `generate_resource`/`assemble`/`path_plan`/resource/learning_path 等实质协作帧，避免刷新出空 latest。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/training/test_dataset_quality.py tests/unit/training/test_dataset_registry.py tests/unit/training/test_lora_samples.py tests/unit/collaboration/test_lora_export_api.py -q`：15 passed，1 warning。
- `bash scripts/check_lora_export.sh 8010`：通过，latest JSONL 已脱敏，不含 user/token/Bearer，并包含 profile/planner/generate_resource/critic/assemble/path_plan 等真实协作节点。
- `bash scripts/prepare_lora_dataset.sh`：通过，生成 READY 数据集版本，指标：sample_count=1、duplicate_rate=0、sensitive_leak_count=0、node_coverage=1.0。
- `bash scripts/test_unit.sh`：**477 passed, 2 warnings**（W3-D 465→W3-E 477，零回归）。

**诚实限制**：W3-E 只证明“训练前数据可检查、可版本化、可拒绝坏样本”，不证明 LoRA 模型收益；收益必须由 W3-G eval 对比证明。当前活体验收样本数仍很小，后续训练前应扩大轨迹样本并做人工抽检。

### M7-W3-D ✅ · 上传隔离区 + 扫描占位 + 签名 URL

**背景**：上传此前是"基础校验后直接入库"。W3-D 升级为"隔离区 → 扫描 → 受控入库 + 短 TTL 签名访问"，为公网部署准备，完成 P0 安全合规闭环。

**关键实现**：
- 新增 `src/reflexlearn/security/uploads.py`：`UploadObject`（quarantined/scanned/accepted/rejected/expired）+ `scan_upload`（占位规则：可执行魔数 MZ/ELF/Mach-O + 仅对 html/htm 检查 `<script>`/`javascript:`/`<iframe>`/`on*=`，md/txt 纯文本不误伤）+ `UploadQuarantineStore`（注入 pg_pool，PG 降级内存）。
- 新增 `src/reflexlearn/security/signed_url.py`：HMAC（`auth_secret_key`）绑定 object_id/tenant/user/expires，默认 TTL 300s，`now` 参数便于测试。
- `api/routes/knowledge.py`：上传先 `read_validated_upload`（基础校验）→ 隔离 register + `scan_upload`，命中危险内容 → mark rejected + 审计 `upload.rejected` + 422；放行 → accepted → 原 kafka/ingest 链路。
- `common/config.py` 新增 `enable_upload_quarantine`(True)/`signed_url_ttl_s`(300)；`scripts/init/init_db.py` 新增 `upload_objects` 表 + 索引。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/security/test_upload_quarantine.py tests/unit/security/test_signed_url.py -q`：通过（隔离 6 + 签名 5）。
- `bash scripts/test_unit.sh`：**465 passed, 2 warnings**（453→465，零回归）。
- `bash scripts/check_api_security.sh 8000`：通过（upload guard 415 路径不受隔离影响）。
- 上传隔离真 uvicorn 活体：恶意 `<html><script>...` 上传 → 422 `upload_rejected`。

**降级矩阵**：`enable_upload_quarantine=false` 跳过隔离；PG 不可用 → 隔离元数据退内存；扫描是占位规则引擎（非企业级杀毒）。

**诚实限制**：扫描为占位规则（魔数 + 危险 HTML），不等同病毒查杀；签名 URL 提供 sign/verify 能力原语，下载端点接入待产品化；隔离区原始字节未接 MinIO 持久化（元数据在 PG/内存）。**W3-D 完成即 P0 安全合规闭环（W3-0~D）**：认证会话 + CSRF/限流/审计 + Safety + 上传隔离。

### M7-W3-C ✅ · AI Safety Gateway

**背景**：W3-A/B 完成会话与 CSRF/限流/审计后，缺统一的输入/输出内容安全闸门。W3-C 为用户输入与资源输出增加规则优先的安全网关，识别 prompt injection、越权、恶意请求与密钥泄漏，降级时结构化解释并审计。

**关键实现**：
- 新增 `src/reflexlearn/safety/`：`schemas.py`（`SafetyDecision`：allowed/action/reasons/redacted_text/audit_required/confidence）、`rules.py`（确定性规则：prompt injection / 索要系统提示 / 恶意代码 / 跨租户越权 / 密钥泄漏样式）、`gateway.py`（`SafetyGateway.check_input` 拦明显恶意/注入/越权、`check_output` 脱敏密钥；开关关/异常一律放行原文）、`audit.py`（`safety_audit_event` 复用 `security.AuditLog`）。
- `common/config.py` 新增 `enable_safety_gateway`（默认 True，仅拦明显高危，正常请求/脚本不受影响）、`enable_safety_llm`（默认关）。
- `api/routes/chat.py` 接入：`event_stream` 开头 `check_input`，命中高危则审计 + emit `error: input_blocked` + 终止（不进 run_session）；资源 emit（generate_resource/pipeline/assemble）前 `check_output` 脱敏密钥。
- 设计取舍：输入闸门只拦注入/恶意/越权；用户输入中的疑似密钥不直接拦（可能正常讨论），密钥治理交给输出脱敏，避免误伤 `check_lora_export` 的 `token=local-secret` 用例。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/safety -q`：15 passed（rules 6 + gateway 6 + chat 集成 3）。
- `bash scripts/test_unit.sh`：**453 passed, 2 warnings**（438→453，零回归）。
- `bash scripts/check_api_security.sh 8000`：通过（uvicorn 启动 + chat import safety + 现有路径不破坏）。
- Safety 真 uvicorn 活体：cookie 登录 + CSRF 通过 + 恶意输入 `ignore all previous instructions...` → SSE `input_blocked` + `prompt_injection`（串联 W3-A 认证 / W3-B CSRF / W3-C Safety 全链路）。

**降级矩阵**：`enable_safety_gateway=false` 或规则异常 → 放行原文；LLM safety checker 默认关；输出含密钥 → 脱敏为 `[REDACTED]` + 审计，不阻断。

**诚实限制**：Safety 只降低风险、非完全防越狱；规则覆盖 prompt injection/恶意/越权/密钥四类常见样式，LLM safety checker 未启用（接口预留）；输出脱敏接在 `/chat` API 层，`gateway.complete`/`doc_gen`/`code_gen` 的 LLM 内部输出未逐层接入，可后续扩展。

### M7-W3-B ✅ · CSRF 双提交 + 登录限流 + 审计日志

**背景**：W3-A 落地 HttpOnly Cookie 会话后，cookie 自动携带带来 CSRF 风险，登录缺暴力破解防护，关键安全事件无审计。W3-B 补齐这三项应用层安全。

**关键实现**：
- 新增 `src/reflexlearn/security/`：`csrf.py`（双提交：login 下发非 HttpOnly `reflexlearn_csrf` cookie，写请求校验 `X-CSRF-Token`==cookie；**纯 ASGI 中间件**不包装 response 以免破坏 /chat SSE；**带 Authorization 头的请求豁免**——跨站攻击无法注入自定义头，故 Bearer/脚本/开发不受影响）、`rate_limit.py`（`RateLimiter` Redis `incr`+`expire` 优先、异常降级进程内存滑窗，进程单例 + `reset_login_limiter_for_tests`）、`audit.py`（`AuditLog` 写 `audit_events` 表，PG 不可用退结构化日志）。
- `common/config.py` 新增 `csrf_cookie_name`/`enable_login_rate_limit`/`login_rate_limit`(5)/`login_rate_window_s`(300)。
- `api/app.py` 挂 `CSRFMiddleware`，CORS 放行 `PATCH/PUT/DELETE` 与 `X-CSRF-Token` 头。
- `api/routes/auth.py`：login 限流（超限 429 + 审计 `rate_limited`）→ 认证（失败审计 `failed`）→ 成功设 session+csrf cookie + 审计 `ok`；logout 清两 cookie + 审计。`service_deps` 新增 `safe_redis`。
- `scripts/init/init_db.py` 新增 `audit_events` 表 + 索引。
- 前端 `apiClient`/`sse` 写请求自动从 csrf cookie 读 token 放入 `X-CSRF-Token`。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/security -q`：通过（新增 `test_csrf` 10 + `test_rate_limit` 6 + `test_audit_log` 3）。
- `bash scripts/test_unit.sh`：**438 passed, 2 warnings**（419→438，零回归）。
- `bash scripts/build_frontend.sh`：通过，13 路由。
- `bash scripts/check_api_security.sh 8000`：通过（Bearer 路径不受 CSRF 影响、单次登录不误伤限流）。
- CSRF 真 uvicorn 活体：cookie 写请求不带 token → 403 `csrf_failed`，带正确 `X-CSRF-Token` → 200；登录限流 5 次后第 6 次 429（API 集成测试验证）。

**降级矩阵**：Redis 不可用 → 限流退进程内存；PG 不可用 → 审计退结构化日志；CSRF 仅对"无 Authorization 且带 session cookie"的写请求强制，其余豁免；`enable_login_rate_limit=false` 关限流。

**诚实限制**：W3-B 是应用层安全补强，非合规认证；限流进程内存在多实例下不共享（生产需 Redis）；审计目前覆盖登录/登出，资源级操作审计待后续扩展；Safety Gateway 与上传隔离在 W3-C/W3-D。

### M7-W3-A ✅ · DB 用户体系 + HttpOnly Cookie 会话

**背景**：P0 第二包的前端凭证是 sessionStorage Bearer MVP（`docs/17` §1 明令禁止带到生产）。W3-A 把会话从前端可读 Bearer 迁移到 HttpOnly Cookie，并落地 DB 用户体系与密码哈希，作为公网上线的会话地基。

**关键实现**：
- 新增 `src/reflexlearn/accounts/`：`passwords.py`（标准库 PBKDF2-HMAC-SHA256，格式 `pbkdf2_sha256$iterations$salt$hash`，verify 从编码串读迭代数向后兼容）、`models.py`（`Account` 强类型）、`store.py`（`AccountStore` 依赖注入 `pg_pool`，PG 查 `users` 表，PG 不可用仅 development 走 demo fallback；demo 用低迭代加速本地/单测）、`sessions.py`（set/clear/read HttpOnly cookie，生产 Secure）。
- `common/config.py` 新增 `session_cookie_name`/`session_cookie_samesite`。
- `api/deps.py`：`get_current_user` 加 `Request`，**优先 HttpOnly cookie**，cookie 失效回退 Bearer（开发/脚本兼容）。
- `api/routes/auth.py`：`/auth/login` 用 `AccountStore.authenticate` + `set_session_cookie`，返回 `LoginResponse`（生产不返回 access_token、仅 cookie；开发保留供脚本烟测）；新增 `POST /auth/logout` 清 cookie。
- `scripts/init/init_db.py`：`users` 表迁移列 `password_hash/password_alg/disabled/last_login_at`。
- 前端：`apiClient`/`sse` 全部 `credentials:"include"` + token 空串不附加 Bearer；`auth.ts` 移除 sessionStorage token，改 `login`(credentials)/`fetchSession`(GET /auth/me 恢复)/`logout`(POST)；`AuthGate` 刷新态改 `/auth/me` 恢复。`AuthToken.access_token` 生产为空串、凭证走 cookie，(app) 页面与 Workspace 零改动。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/security -q`：通过（新增 `test_accounts_store.py` 9 + `test_cookie_auth.py` 6）。
- `bash scripts/test_unit.sh`：**419 passed, 2 warnings**（404→419，零回归）。
- `bash scripts/build_frontend.sh`：通过，13 路由，`next build` 类型检查零错。
- `bash scripts/check_api_security.sh 8000`：通过（health/metrics/401/login/me/upload guard/video）。
- cookie 活体：`login_http=200` 且设 `reflexlearn_session`，`/auth/me` 仅凭 cookie 返回 admin，`logout_http=200`。

**降级矩阵**：PG 不可用 → development 用 demo fallback、production 拒绝登录；cookie 缺失/失效 → 回退 Bearer（开发）→ 否则 401；前端 `/auth/me` 失败 → 视为未登录回登录页。

**诚实限制**：W3-A 只完成"会话从前端可读 Bearer 迁移到 HttpOnly Cookie + DB 用户/密码哈希"。CSRF 双提交、登录限流、审计日志在 W3-B；真实 DB 用户注册/管理后台、密码找回未做；demo fallback 仍是开发便利，生产须建真实用户。

### M7-W3-0 ✅ · 波次 3 基线冻结与风险门禁

**背景**：波次 2 工程任务收口、`docs/17` 波次 3 派工书制定后，在动安全/训练/部署前先冻结基线、建立 preflight，避免后续把环境问题误判成代码回归，并防止派工书安全红线被误删。本轮只做基线门禁，不新增产品能力。

**关键实现**：
- 新增 `scripts/check_wave3_preflight.sh`（根瘦包装）+ `scripts/checks/ops/check_wave3_preflight.sh`（真实实现）：顺序跑 `unit-tests`（全量单测）、`frontend-build`、`script-syntax`（`find scripts -name '*.sh'` 逐个 `bash -n`）三道代码门禁；再探测 `http://127.0.0.1:PORT/api/health`，可达则附加 `wave2-api-smoke` 与 `lora-export-smoke`，不可达标注 `SKIP` 而非 FAIL；任一代码门禁 FAIL 退出非 0，并打印 PASS/FAIL/SKIP 汇总。
- 新增 `tests/unit/code_health/test_wave3_boundaries.py`：锁定波次 3 关键根脚本入口存在（含本卡 preflight）、`checks/ops` 真实实现存在、`docs/17-波次3任务派工书.md` 存在、派工书明确"不把 demo Bearer/sessionStorage 方案带到生产上线"。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/code_health/test_wave3_boundaries.py -q`：4 passed（先红：缺 preflight 脚本/真实实现 → 实现后转绿）。
- `bash scripts/test_unit.sh`：**404 passed, 2 warnings**（400→404，零回归）。
- `bash scripts/check_wave3_preflight.sh 8000`：5 gate 全 PASS（本轮后端恰在 :8000 运行，W2 API + LoRA 导出 smoke 一并验证；后端不在时这两项 SKIP，代码门禁仍判定）。
- `git diff --check`：干净（仅 `.env.example` 历史 CRLF 提示）。

**诚实限制**：W3-0 只冻结基线、建立门禁，不新增产品能力；HttpOnly Cookie/CSRF/Safety/上传隔离/LoRA 训练均归后续 W3-A~I。

### M7-W2-I ✅ · 目录结构治理：测试 / nodes / RAG / scripts / docs 分层

**背景**：波次 2 后半段功能已完成，剩余主要坏味道是目录和文件组织：测试、节点、RAG、脚本实现开始拥挤。用户确认本轮只做工程结构治理，不新增业务能力，不改变 API/前端路由/eval 分数口径。

**关键实现**：
- 拆分 `tests/unit/flow/test_metacognition.py` 到 `tests/unit/flow/metacognition/`：`test_node.py`、`test_route.py`、`test_graph.py`、`test_generator_hint.py`。
- `src/reflexlearn/orchestration/nodes/` 分层为 `core/`、`collaboration/`、`reflection/`、`planning/`；同步更新 `src/`、`tests/` import。logger 名称随模块新路径变化。
- `src/reflexlearn/rag/` 分层为 `access/`、`retrieval/`、`ranking/`、`routing/`；`service.py` 与 `schemas.py` 留根，`rag/__init__.py` 暴露关键公共对象。
- `scripts/` 保留根 `.sh` 包装入口，真实实现移动到 `checks/`、`jobs/`、`init/`、`ops/`、`probes/`；子目录脚本统一通过 `SCRIPTS_ROOT/_lib.sh` 引用公共库。
- `scripts/checks/` 继续二级分组为 `api/`、`frontend/`、`infra/`、`eval/`，`scripts/jobs/data/` 收纳数据类离线任务，避免新实现目录继续超过 8 文件。
- 新增 `docs/README.md`，只做编号文档索引，不搬迁历史文档。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/flow/metacognition -q`：8 passed。
- `bash scripts/test_unit.sh tests/unit/agent tests/unit/flow -q`：通过。
- `bash scripts/test_unit.sh tests/unit/rag -q`：通过。
- `bash scripts/test_unit.sh`：400 passed, 2 warnings。
- `bash scripts/build_frontend.sh`：通过，13 个路由构建成功。
- `bash scripts/check_lora_export.sh 8000`：通过，导出 JSONL 脱敏校验通过。
- `bash scripts/check_wave2_api.sh 8000`：通过，错题、视频对象 ACL、协作轨迹、workspace ACL 均 OK。
- `bash scripts/check_frontend_ia.sh` / `bash scripts/check_frontend_glass.sh`：通过。
- `bash -n scripts/*.sh`：通过。
- `find scripts -name "*.sh" -print0 | xargs -0 bash -n`：通过。
- `git diff --check`：通过。

**诚实限制**：根 `scripts/` 仍有 34 个入口文件，受 Run & Debug 根入口兼容约束，本轮不宣称所有目录永久满足 8 文件限制；`docs/` 仍保留 00-16 编号文档体系，本轮只新增索引。W2-I 是工程治理，不代表真实 LoRA 训练、Safety Gateway、HttpOnly Cookie/CSRF 或生产部署已完成。波次 2 工程任务当前约 100%，剩余 0%；下一步进入波次 3 规划与派工。

### M7-W2-G ✅ · 协作轨迹 LoRA 样本导出 MVP：脱敏 JSONL 训练数据

**背景**：W2-C 已完成协作轨迹落库与 `/growth` 展示；用户要求下一顺位完成 W2-G，把 trace/prompt/工具选择/critic/refine 原料整理为可训练、可审计、可脱敏的 JSONL 样本。本轮只做样本导出 MVP，不接真实训练。

**关键实现**：
- 新增 `training/lora_samples.py`：强类型 `TrainingMessage`、`LoraSampleMetadata`、`LoraSftSample`、`ExportResult`；按 `session_id` 聚合 `CollaborationTraceEvent`，生成 system/user/assistant 三段 SFT 样本。
- 脱敏策略：移除 payload 中 `user_id/tenant_id/token/api_key/secret/password/authorization` 等敏感键；URL query 替换为 `?[redacted]`；Bearer/token 文本清洗；`user_id/tenant_id/session_id` 仅保留 sha256 scoped id。
- `api/routes/traces.py` 新增 `POST /api/growth/lora-samples/export` 与 `GET /api/growth/lora-samples`；导出文件写入 `logs/lora_samples/YYYYMMDD-HHMMSS.jsonl`，并维护 `lora_samples_latest.jsonl`。
- `/growth` 页面新增 LoRA 样本导出面板，展示最近样本数、过滤轨迹、脱敏状态、最近导出文件，并保留协作轨迹列表。
- 新增 `scripts/check_lora_export.sh`：登录后触发 `/api/chat` 生成轨迹，调用导出端点，查询导出列表，并校验 JSONL 角色结构与脱敏结果。
- 新增 `tests/unit/training/test_lora_samples.py` 与 `tests/unit/collaboration/test_lora_export_api.py`，覆盖样本聚合、脱敏、JSONL 写入、导出列表和当前用户轨迹过滤。

**验证结果**：
- `bash scripts/test_unit.sh`：400 passed, 2 warnings。
- `bash scripts/build_frontend.sh`：通过，13 个路由构建成功；`/growth` 首载约 104kB，`/chat` 仍 467kB。
- `bash scripts/check_lora_export.sh 8000`：通过；导出样本数 ≥1，`lora_samples_latest.jsonl` 存在且无明文 `lora-u1/local-secret/Bearer`。
- `bash scripts/check_wave2_api.sh 8000`、`bash scripts/check_frontend_ia.sh`、`bash scripts/check_frontend_glass.sh`、`bash -n scripts/*.sh`、`git diff --check` 均通过。

**诚实限制**：W2-G 只能宣称“协作轨迹 LoRA 样本导出 MVP 已完成，支持从轨迹生成脱敏 JSONL SFT 样本，并可在 `/growth` 查看导出状态”。不能宣称已完成 LoRA 训练闭环或证明微调收益；真实训练、样本质量抽检、AutoDL/vLLM 接入与 eval `Δ>0` 属于波次 3。波次 2 当前约 90%，剩余约 10%；下一顺位是 W2-I 目录治理。

### M7-W2-H ✅ · 元认知性能治理：限审查、限 Judge、短输入、可解释降级

**背景**：用户要求 W2-H 只解决一个目标：`metacognition_real_on` 稳定进入元认知并完成二次生成，同时把总耗时压到可评测区间，避免 Judge 超时规则降级。本轮不做 LoRA，也不做目录治理。

**关键实现**：
- `common/config.py` 新增 `eval_judge_max_resources`，配合已有 `metacognition_max_reviews/metacognition_timeout_s/metacognition_min_score/metacognition_content_chars` 控制评测与审查成本。
- `eval/strategies.py` 为 `metacognition_real_off/on` 固定 `EVAL_JUDGE_MAX_RESOURCES=1`，`metacognition_real_on` 单独给元认知 LLM 20s 上限；默认配置仍保持 12s 元认知超时。
- `eval/runner.py` 在不改变资源覆盖率统计的前提下，只对优先级最高的资源做 LLM Judge，且 doc 优先，避免 3 次 Judge 把总耗时推到 60-90s。
- `orchestration/nodes/metacognition.py` 强化短 prompt：离线占位、降级内容、内容空泛或缺 expected concepts 时要求低分并给 `refine_hint`；超时/坏 JSON/异常仍写入 degraded `meta_reviews`，不影响 assemble。
- `skills/offline.py` 在离线 doc 二次生成中写入 `previous_issues` 的“元认知修复建议”，让 self-refine 的改动可被 Judge 和人工复核看见。
- 新增 `tests/unit/eval/test_metacognition_perf.py`，锁定 Judge 限流、真实策略配置、离线占位 prompt 约束和离线 doc 修复建议。

**验证结果**：
- `bash scripts/test_unit.sh`：397 passed, 2 warnings。
- `bash scripts/build_frontend.sh`：通过，13 个路由构建成功。
- `bash scripts/check_metacognition_perf.sh`：通过；最新验收轮 `metacognition_real_off overall=0.18`，`metacognition_real_on overall=0.55`，`metacognition_real_on latency_ms=38982`，trace 含 `metacognition` 与 `self_refine_count=1`，Judge 未规则降级。
- `bash scripts/check_wave2_api.sh 8000`：通过；health、错题 ACL、视频 ACL、协作轨迹、workspace ACL 均 OK。
- `bash scripts/check_frontend_ia.sh && bash scripts/check_frontend_glass.sh && bash -n scripts/*.sh`：通过。
- `git diff --check`：退出码 0；仅提示 `.env.example` LF/CRLF 换行警告。

**诚实限制**：本轮只能宣称“元认知真实评测链路已完成性能治理，能在限定资源数和超时保护下稳定进入 self-refine，并避免 Judge 超时降级”。不能宣称元认知稳定提升学习效果；当前只跑 1 个 `reflexion_required` case，且为了稳定评测只 Judge 1 个 doc 优先资源，效果结论仍需更多 case、稳定 LLM Judge 样本和人工抽检。波次 2 当前约 80%，剩余约 20%；下一顺位是 W2-G LoRA 样本导出，然后 W2-I 目录治理。

### M7-W2-F ✅ · 错题飞轮 MVP：归因 → 补救计划 → 针对性资源 → 复习回写

**背景**：用户明确下一阶段只认一个主目标：错题 → 归因 → path_plan 调整 → 针对性资源生成 → 复习状态回写；W2-F 完成后波次 2 推进到约 70%，后续再做 W2-H/W2-G/W2-I。本轮只做 W2-F，不碰 LoRA 和目录治理。

**关键实现**：
- 新增 `learning/mistake_flywheel.py`：规则归因固定 5 类（概念不清、步骤遗漏、公式/代码错误、审题偏差、记忆遗忘）；按错题概念、错因、难度生成补救目标；复用 `PathPlanSkill` 的规则降级生成 3-5 个复习节点；复用 doc/quiz/code skill 的离线降级生成针对性资源包。
- `api/routes/mistakes.py` 新增 `POST /api/mistakes/{id}/reflect`、`POST /api/mistakes/{id}/plan`、`POST /api/mistakes/{id}/resources`、`PATCH /api/mistakes/{id}/review`；本人可操作、跨用户 403、不存在 404，错误 detail 固定。
- `learning/mistakes.py` 新增 `save_analysis()`，把 reflection/remedial_plan/targeted_resources/review_status 回写到 `analysis`，PG 不可用时继续内存降级。
- `frontend/app/(app)/mistakes/page.tsx` 升级为错题飞轮工作台：列表、详情、归因结果、补救计划、针对性资源、复习状态按钮。
- 新增 `scripts/check_mistake_flywheel.sh`：登录/创建错题/归因/计划/资源/标记复习/跨用户 403 端到端 smoke。

**验证结果**：
- `bash scripts/check_mistake_flywheel.sh 8000`：通过，端到端生成 doc/quiz/code 三类针对性资源并完成跨用户 403。
- `bash scripts/test_unit.sh tests/unit/learning/test_mistakes_api.py -q`：4 passed。
- `bash scripts/build_frontend.sh`：通过；`/mistakes` 首载 105kB，`/chat` 仍 467kB。
- `bash scripts/check_wave2_api.sh 8000 && bash scripts/check_frontend_ia.sh && bash scripts/check_frontend_glass.sh && bash -n scripts/*.sh`：通过。

**诚实限制**：W2-F 只能宣称“错题飞轮 MVP 已端到端跑通，支持规则归因、补救计划、针对性资源生成和复习状态回写，并通过 ACL/API/前端构建验证”。不能宣称已证明错题飞轮提升学习效果；学习效果要等后续 eval case 或人工抽检。W2-F 完成当时波次 2 约 70%，剩余约 30%；下一顺位为 W2-H，现已在后续完成。

### M7-W2-E ✅ · 对象级 ACL 扩面：学习空间 / 资源库 / 知识文档

**背景**：用户确认波次 2 首批 MVP 只应按 45% 口径验收，并要求后半段优先级为 ACL 扩面 > 错题飞轮闭环 > 元认知耗时治理 > LoRA 样本导出 > 目录治理。本轮继续完成 W2-E，把对象级安全从视频/错题扩到学习空间、资源库和知识文档。

**关键实现**：
- 新增 `learning/assets.py`：强类型 `LearningSpace`、`LearningResource`、`KnowledgeDocument` 与 `LearningAssetStore`，PG 可用读表，PG 不可用走内存降级。
- 新增 `api/routes/workspace.py`：`GET /api/spaces`、`GET /api/spaces/{id}`、`GET /api/resources`、`GET /api/resources/{id}`、`GET /api/knowledge/documents`、`GET /api/knowledge/documents/{id}`；详情跨用户 403，公共文档同租户可读。
- `scripts/init/init_db.py` 为 `learning_goals`、`resources` 补 `tenant_id/user_id/visibility` 迁移列，支持后续产品对象归属。
- `/spaces`、`/resources`、`/knowledge` 前端页面从 TODO 空壳升级为真实 API 只读列表。
- `scripts/check_wave2_api.sh` 增加 workspace ACL 列表端点 smoke；`scripts/check_frontend_ia.sh` 改为检查真实 API 接入。

**验证结果**：
- `bash scripts/test_unit.sh`：390 passed, 2 warnings。
- `bash scripts/test_unit.sh tests/unit/learning/test_workspace_acl_api.py tests/unit/learning/test_mistakes_api.py tests/unit/security/test_object_acl.py -q`：5 passed。
- `bash scripts/build_frontend.sh`：通过；`/spaces`、`/resources`、`/knowledge` 首载约 104kB，`/chat` 仍 467kB。
- `bash scripts/check_wave2_api.sh 8000`：通过，含 workspace ACL list endpoints。
- `bash scripts/check_frontend_ia.sh && bash scripts/check_frontend_glass.sh && bash -n scripts/*.sh`：通过。

**诚实限制**：W2-E 已覆盖读侧 ACL 与详情 403，但还未完成“写侧资源归属自动落库”的全链路：生成资源是否持久化到 `resources` 表、学习空间创建/更新、知识文档删除/转移仍需在 W2-F/W2 后续产品闭环中补齐。波次 2 当前约 55%，剩余约 45%。

### M7-W2-Seed ✅ · 波次 2 首批 MVP：活体补证 + ACL/错题本/协作轨迹地基

**背景**：用户确认波次 1 可工程验收后，进入 `docs/14` 波次 2。根据上一轮诚实限制，本轮不直接铺大功能，先补 W2-0 真实活体，再落对象级 ACL、错题本飞轮和协作轨迹数据地基，形成可演示的个人工作台首版。

**关键实现**：
- W2-0：新增 `docs/16-波次2任务派工书.md` 与 `scripts/check_wave2_live.sh`（真实实现位于 `scripts/checks/infra/`）；真实 Qdrant 遗忘删除、真实 Neo4j 图谱自生长写入和 direct MERGE 活体均可复跑。
- W2-A：新增 `api/acl.py`；`VideoJob` 增加 `user_id/tenant_id`，`GET /api/video/jobs/{job_id}` 跨用户返回 403；抽出 `api/service_deps.py` 统一 PG/Qdrant/Neo4j 安全依赖获取。
- W2-B：新增 `learning/mistakes.py` 与 `api/routes/mistakes.py`，提供 `POST /api/mistakes`、`GET /api/mistakes`、`GET /api/mistakes/{id}`、`POST /api/mistakes/{id}/review`；PG 不可用时走内存降级并标注 `pg:unavailable`。
- W2-C：新增 `collaboration/traces.py` 与 `api/routes/traces.py`，`/api/chat` SSE 过程中 best-effort 记录节点轨迹；`GET /api/collaboration/traces` 只返回当前用户/租户数据。
- W2-D：`frontend/app/(app)/mistakes/page.tsx` 接入错题创建/列表/归因；`frontend/app/(app)/growth/page.tsx` 接入协作轨迹列表；`frontend/lib/types.ts` 补强类型。
- 评测策略：新增 `metacognition_real_off` / `metacognition_real_on`，保留 LLM key，不再把清空 key 的 smoke 结果误当真实收益证据。

**验证结果**：
- `bash scripts/test_unit.sh`：388 passed, 2 warnings。
- `bash scripts/build_frontend.sh`：通过，13 个 App Router 路由构建成功；`/mistakes` 3.05kB、`/growth` 2.63kB，`/chat` 首载仍 467kB。
- `bash scripts/check_frontend_ia.sh && bash scripts/check_frontend_glass.sh && bash -n scripts/*.sh && git diff --check`：通过。
- `bash scripts/check_wave2_api.sh 8000`：通过；错题创建/归因/跨用户 403、视频跨用户 403、协作轨迹查询均 OK。
- `bash scripts/check_wave2_live.sh`：通过；Qdrant forgetting `deleted=1 marker_left=0`，Neo4j autogrow `status=ok concepts=2 relations=1 count=1`，direct merge `concepts=1`。
- `bash scripts/check_llm.sh`：通过，`model_used=openai/gpt-5.5`，`json_parse=ok`。
- `bash scripts/run_eval.sh --compare --tags ablation,rag_required --strategies metacognition_real_off,metacognition_real_on --max-cases 1 --timeout 90`：通过；`metacognition_real_off overall=0.5733`，`metacognition_real_on overall=0.6408`，on 策略 trace 进入 `metacognition` 并触发二次生成。

**诚实限制**：首批 MVP 当时整体约 45%，剩余约 55%；W2-E 完成后调整为约 55% / 剩余约 45%。错题本当时仍是规则归因 + 复习计划 MVP，还未自动驱动 path_plan 或资源生成；协作轨迹已可查但还未形成 LoRA 训练样本导出。元认知真实对比当时只跑 1 条 `rag_required` case；已观察到 `metacognition_real_on` 进入 `metacognition` 并触发二次生成，且本次分数更高（0.6408 > 0.5733），但由于耗时接近 90s 且 Judge 出现规则降级，当时不能宣称稳定真实收益；该性能限制已在 W2-H 收敛，收益泛化仍需后续扩大样本。

### M7-W1 ✅ · 波次 1 完成：自进化快回路 + 灵动玻璃工作台骨架

**背景**：按 `docs/15-波次1任务派工书.md` 执行四张卡：W1-A 记忆系统进化、W1-B 元认知自我改进、W1-C 灵动玻璃设计系统、W1-D 工作台信息架构骨架。后端线 A→B，前端线 C→D；C 由 teammate 并行完成后由本轮复核。

**关键实现**：
- W1-A：`memory/reflexion.py` 的 Qdrant payload 新增 `created_at` / `hit_count`；召回命中 best-effort 回写 `hit_count+1`；新增 `memory/forgetting.py` + `scripts/run_forget.sh`（真实 Python 入口在 `scripts/jobs/run_forget.py`）离线遗忘作业；新增 `memory/graph_autogrow.py` 并在 `run_session` PERSIST 段按 `enable_graph_autogrow` 复用 M4-B 图谱抽取。
- W1-B：新增 `orchestration/nodes/metacognition.py`、`MetaReview`、`enable_metacognition` / `max_self_refine`；默认关，开启后 `gate→metacognition→generate_resource/assemble`，低分资源标记 `needs_refine` 并注入 `refine_hint`；`DocGenSkill` 已读取修复提示。
- W1-C/W1-D：新增 Tailwind v4 玻璃 token、`components/glass/*`、`/design` 演示页；新增公共门户 `/`、赛道详情 `/tracks/[slug]`、受保护工作台 `/spaces /chat /plan /resources /knowledge /mistakes /growth`，`/chat` 复用现有 SSE 工作区。
- 评测策略：`metacognition_off` / `metacognition_on` 已加入显式 eval profile；快速 smoke profile 清空 LLM key，稳定走离线降级，真实收益需另跑带 key 长 timeout 评测。

**验证结果**：
- `bash scripts/test_unit.sh`：383 passed, 2 warnings。
- `bash scripts/build_frontend.sh`：通过，13 个 App Router 路由构建成功，`/chat` First Load JS 467kB。
- `bash scripts/check_frontend_ia.sh && bash scripts/check_frontend_glass.sh && bash -n scripts/*.sh`：通过。
- `bash scripts/run_eval.sh --compare --tags ablation,reflexion_required --strategies no_reflexion,controlled_reflexion --max-cases 1 --timeout 12`：通过；`no_reflexion overall=0.7058`，`controlled_reflexion overall=0.9521`。
- `bash scripts/run_eval.sh --compare --tags ablation,reflexion_required --strategies metacognition_off,metacognition_on --max-cases 1 --timeout 12`：通过；两者 `overall=0.7058`，`metacognition_on` trace 进入 `metacognition` 节点。
- 路由活检：本机 `http://127.0.0.1:3000/`、`/design`、`/spaces`、`/chat`、`/tracks/ai-programming` 均返回 200。

**诚实限制**：W1-A 的遗忘/图谱自生长使用 hermetic 单测验证，未做真实 Qdrant 删除和真实 Neo4j 写入活体；W1-B 的 12s smoke 为保证稳定清空 LLM key，`metacognition_on` 走到节点但自评降级跳过，所以 on/off 暂无分数差异。要证明元认知收益，需要用真实 key、较长 timeout 和可控低分资源样本另跑。

### M7-W1-MemoryMetrics ✅ · 自进化快回路第一步：记忆复用度量

**背景**：`docs/14-下一阶段升级蓝图.md` 将主线升级为“自进化学习平台”，波次 1 要先做记忆系统进化和元认知自我改进。其中“记忆复用度量”是风险最低、最容易量化的第一步：不改变业务结果，只把 Reflexion 经验是否被召回、走哪条路径、命中多少条暴露成 Prometheus 指标。

**关键实现**：
- `src/reflexlearn/observability/metrics.py` 新增 `reflexlearn_memory_recalls_total` 和 `reflexlearn_memory_recall_result_count`。
- `src/reflexlearn/memory/reflexion.py` 在 `recall_reflections()` 的 qdrant 不可用、semantic 命中、scroll 降级、空结果路径统一记录记忆召回指标。
- `tests/unit/observability/test_metrics.py` 覆盖新指标导出。
- `tests/unit/memory/test_reflexion.py` 覆盖真实 recall 命中后记录 `mode="semantic"` / `status="ok"`。
- 面试资料同步：`D:/2026/A11/paper-deliverables/03-resume/notes/05-interview-backend-foundation.md` 新增“什么是死锁？项目里遇到过吗？”答题稿。

**验证结果**：
- 定向回归：`bash scripts/test_unit.sh tests/unit/observability/test_metrics.py tests/unit/memory/test_reflexion.py tests/unit/memory/test_memory_manager.py -q`：26 passed，1 warning。
- 代码健康：`metrics.py=193` 行、`memory/reflexion.py=265` 行、`test_reflexion.py=291` 行，均小于 300 行。

**诚实限制**：本轮只完成“记忆复用可观测”，还没有实现记忆巩固、主动遗忘、图谱自生长，也没有跑扩大样本评测证明分数提升。下一步建议继续做元认知节点或记忆巩固策略。

### S2-Final ✅ · 阶段二活体验证收口 + real_full 真实 RAG 小样本跑通

**背景**：用户要求把阶段二最后任务执行完。上一轮剩余项集中在 Docker/Grafana/Prometheus/Graph/Bigdata 活体、MCP SDK 联调、真实 RAG 评测复跑和文档落盘。

**关键实现与修复**：
- Docker 脚本兼容 Windows Docker Desktop CLI：`scripts/_lib.sh` 新增 `docker_cmd()`，`start_core/start_graph/start_bigdata/start_full/start_observe/stop_*` 改用检测到的 Docker CLI。
- 修复 RAG 并发死锁：`src/reflexlearn/rag/keyword.py` 将 `KeywordIndex.get()` 的同步锁 await 临界区改为 `asyncio.Lock`，新增并发回归测试，避免多资源并发 RAG 时阻塞事件循环。
- `scripts/run_real_eval.sh` 默认 `REAL_EVAL_TIMEOUT=180`、`ENABLE_RERANK=false`，避免真实评测默认加载第二个 bge-reranker 重模型；资源足够时仍可显式 `ENABLE_RERANK=true`。

**活体验证结果**：
- `bash scripts/check_bigdata.sh`：通过，Kafka produce/consume + MinIO put/get/remove。
- `bash scripts/check_observe.sh 8003`：通过，`/metrics` 暴露核心 Prometheus 指标。
- `bash scripts/check_api_security.sh 8003`：通过，health、metrics、受保护路由、登录、上传 guard、视频提交均 OK。
- `bash scripts/check_api_integrations.sh 8003`：通过，知识上传 `chunks=1 embedded=1 qdrant=1 pg=True`，视频任务无 SeeDance key 时 degraded。
- `bash scripts/test_unit.sh tests/unit/mcp_tools/test_mcp_tools.py -q`：5 passed；`bash scripts/start_mcp.sh` 不再缺 `mcp` 包。
- `bash scripts/init_all.sh`：通过，PG schema、Qdrant collections/index、Neo4j 种子图谱初始化。

**真实评测结果**：
- 命令：`bash scripts/run_real_eval.sh --tags ablation,rag_required --strategies real_full,real_no_rag,single_agent_baseline --max-cases 1 --timeout 180`（本轮运行时显式 `ENABLE_RERANK=false`，现已写入脚本默认）。
- `real_full`：`task_completion_rate=1.0`，`resource_coverage=1.0`，`overall=0.6900`。
- `real_no_rag`：`task_completion_rate=1.0`，`resource_coverage=1.0`，`overall=0.5467`。
- `single_agent_baseline`：`task_completion_rate=1.0`，`resource_coverage=0.3333`，`overall=0.2000`。

**诚实限制**：这是 1 条 `rag_required` case 的小样本真实 RAG 结论，已足够证明链路不再 blocked，但还不是比赛最终统计结论；后续仍应扩大样本、补 `reflexion_required` 真实消融和人工抽检。

### S2-T2-RealEval ✅ · 真实评测小样本跑通，real_full 预检阻断收敛为真实 RAG 通过

**背景**：`real_no_rag` 先前在 45s 超时，`real_full` 进入 Qdrant / bge 模型链路后外层超时。需要先把真实 LLM judge + 真实资源生成的小样本跑通，同时让真实 RAG 环境缺失时可结构化阻断，而不是让评测进程卡死。

**关键实现**：
- `EvalTraceEvent` 新增 `summary`，评测报告能记录 Planner 输出的 `collab_mode`、资源类型和 assemble 资源数，timeout 时也能定位最后有效阶段。
- `run_session(..., resource_type_hints=...)` + `scripts/run_eval.py` 把 `EvalCase.expected_resource_types` 传给 Planner；Planner 在评测 hints 存在时只规划目标资源类型，避免 fallback 生成 6 类资源拖垮评测。
- `scripts/run_eval.py` 在看到 `assemble` 事件后停止收集，M5 资源质量评测不再等待无关的 `path_plan` 终态节点。
- `scripts/run_real_eval.sh` 默认固定 `EVAL_FORCE_COLLAB_MODE=central`、`ENABLE_LLM_PROFILE=false`、`ENABLE_LLM_PLANNER=false`、`ENABLE_LLM_QUALITY_CHECK=false`、`MAX_REACT_STEPS=1`、`EVAL_SKIP_PATH_PLAN=true`、`LLM_REQUEST_TIMEOUT_S=15`，隔离资源生成/RAG变量并控制外呼成本。
- `EvalRunner` 评分阶段纳入 case timeout；LLM judge 超预算时当前资源走 `RuleJudge` 降级并标注 `judge_timeout_rule_fallback`。
- `scripts/run_eval.py --real` 新增 RAG preflight：`real_full` / `real_no_reflexion` 需要真实 RAG 时先检查 Qdrant collection，不可用则输出 `rag_preflight_failed` 报告，不进入 LangGraph。
- `RAGService` / `KeywordIndex` / `Reflexion` 召回路径增加 Qdrant collection 预检与短超时，避免 Qdrant 不可用时仍加载 embedding 或长时间 scroll。
- 新增/调整单测覆盖 Planner hints、关闭 LLM Planner、关闭内部质量 LLM、path_plan skip、评测 trace 摘要和 assemble 后停止收集。
- 代码健康同步：拆分 `tests/unit/flow/test_pipeline.py`、`tests/unit/flow/test_path_plan.py` 的 e2e 段到子目录，相关文件回到 300 行内。

**测评结果**：
- `bash scripts/run_real_eval.sh --tags ablation,rag_required --strategies real_full,real_no_rag,single_agent_baseline --max-cases 1 --timeout 60`：组合评测 72.7s 收口；因 `real_full` preflight blocked，脚本按预期返回非 0，但 non-RAG 策略继续产出结果。
  - `real_full`：`task_completion_rate=0.0`，`error=rag_preflight_failed`，`last_event=preflight`，原因 `qdrant unavailable: ConnectError http://127.0.0.1:16333/collections/knowledge_chunks`。
  - `real_no_rag`：`task_completion_rate=1.0`，`resource_coverage=1.0`，生成 `doc,mindmap,reading`，`overall=0.6758`；第三个资源 judge 因剩余 case 预算不足走规则降级，结果标注 `judge_timeout_rule_fallback`。
  - `single_agent_baseline`：`task_completion_rate=1.0`，`resource_coverage=0.3333`，`overall=0.1800`。

**验证结果**：
- 定向测试：Planner / eval / pipeline / path_plan 相关测试均通过。
- 全量单测：`bash scripts/test_unit.sh`：**366 passed, 2 warnings**。
- LLM smoke：`bash scripts/check_llm.sh`：通过，`model_used=openai/gpt-5.5`，`json_parse=ok`。
- 脚本语法：`bash -n scripts/*.sh`：通过。
- Diff 检查：`git diff --check`：仅 `.env.example` CRLF 提示。

**诚实限制**：本轮已证明真实资源生成 + LLM/混合 judge 在 `real_no_rag` 小样本可跑，并优于单 Agent baseline；`real_full` 已从“外层卡死”收敛为“RAG 环境 preflight blocked”。这不是 RAG 效果结论，下一步仍需在可用 Qdrant/知识库/模型服务环境下重跑 `real_full`，并补人工抽检。

### S2-CodeHealth ✅ · 文件健康收口 + LLM Judge 测评续跑

**背景**：阶段二推进后，`skills/path_plan.py`、`llm_gateway/gateway.py` 超过 300 行，`tests/unit/` 根目录测试文件 42 个，违反项目代码健康约束；同时用户要求继续推进测评。

**关键实现**：
- 新增 `tests/unit/code_health/test_code_health.py`：锁住 `path_plan.py` / `gateway.py` 不超过 300 行，并要求 `tests/unit` 根目录 `test_*.py` 不超过 8 个。
- 新增 `src/reflexlearn/skills/path_topology.py`：把 Kahn 拓扑排序、概念模糊匹配、跨概念前置 task_id 锚点从 `path_plan.py` 抽出；`path_plan.py` 从 340 行降到 232 行。
- 新增 `src/reflexlearn/llm_gateway/openai_compat.py`：把 OpenAI-compatible 的 model/wire API/payload/url/response parser/token parser 抽出；`gateway.py` 从 327 行降到 191 行。
- `tests/unit` 根目录仅保留 `test_core.py`；其余按 `agent/flow/rag/data/memory/runtime/security/media/eval` 等领域移动，当前根目录 1 个测试文件、递归 48 个测试文件。
- 修复 `scripts/run_real_eval.sh`：自定义参数时执行 `bash run_eval.sh --real --compare "$@"`，不再叠加默认参数导致重复 `--tags/--strategies/--max-cases`。

**测评结果**：
- `bash scripts/check_llm.sh`：通过，`model_used=openai/gpt-5.5`，`json_parse=ok`。
- `bash scripts/run_eval.sh --compare --tags ablation,rag_required --strategies controlled_rag,single_agent_baseline --max-cases 1 --timeout 45`：通过，`Judge 来源=LLM 或混合`；`controlled_rag overall=0.4967`，`single_agent_baseline overall=0.1800`。
- `bash scripts/run_eval.sh --compare --tags ablation --strategies controlled_rag,controlled_reflexion,single_agent_baseline --max-cases 2 --timeout 60`：通过；LLM judge 显示受控策略资源覆盖率 100%，但内容解释深度不足，分数明显低于规则 judge 乐观结果。
- `bash scripts/run_real_eval.sh --tags ablation,rag_required --strategies real_no_rag,single_agent_baseline --max-cases 1 --timeout 45`：`real_no_rag` 超时，`single_agent_baseline` 完成；说明真实主链路耗时不只由 RAG 导致，需专项排查。
- `real_full` 最小尝试进入 Qdrant 兼容性检查和模型权重加载后超过 240s 外层超时，已清理残留评测进程。

**验证结果**：
- 红灯：新增代码健康测试初次运行失败，指出 `path_plan.py=340`、`gateway.py=327`、根目录测试文件 42。
- 绿灯：`bash scripts/test_unit.sh tests/unit/code_health/test_code_health.py -q`：2 passed。
- 定向回归：`bash scripts/test_unit.sh tests/unit/runtime/test_gateway.py tests/unit/flow/test_path_plan.py tests/unit/flow/test_concept_graph.py tests/unit/eval/test_eval_ablation.py tests/unit/eval/test_eval_harness.py tests/unit/eval/test_real_eval_mode.py -q`：通过。
- 全量单测：`bash scripts/test_unit.sh`：通过，**366 passed, 2 warnings**。

**诚实限制**：当前测评证明 LLM judge 和受控消融能跑，并能揭示资源质量短板；尚不能证明真实 RAG/Reflexion 全链路有效。下一步应先排查 `real_no_rag` 超时，再恢复 `real_full` 小样本真实消融。

### S2-T2 🚧 · 真实评测入口脚本化 + Judge 来源标记（真实 LLM judge 最小验证已通，真实 RAG/Reflexion 结论待服务）

**背景**：阶段二还剩 M5 真实评测结论。真实 LLM-as-a-judge 和真实 RAG/Reflexion 消融依赖外部 LLM key、Qdrant/Neo4j/Redis 服务和知识入库状态。本轮已把真实评测入口、真实策略 profile 和报告诚实标记补齐，并在用户已填 OpenAI-compatible key 后验证 timicc `/responses` 中转可返回合法 JSON；后续仍需真实 RAG/Reflexion 环境和人工抽检形成比赛级结论。

**关键实现**：
- `scripts/run_eval.py` 新增 `--real`：显式开启 `ENABLE_RAG=true`、`ENABLE_MULTI_TURN=true`、`ENABLE_REFLEXION=true`。
- `eval.strategies` 新增 `real_full` / `real_no_rag` / `real_no_reflexion`；普通 `run_eval.sh --compare` 默认仍只跑 smoke/受控策略，避免误触真实 RAG 模型加载。
- 新增 `scripts/run_real_eval.sh`：默认跑 `real_full,real_no_rag,real_no_reflexion,single_agent_baseline`，并写 `logs/run_real_eval.log`；可用 `--strategies` 覆盖为受控基线。
- `eval.report` 的单策略/对比 Markdown 均新增 `Judge 来源`，明确显示 `规则降级` 或 `LLM 或混合`。
- `LLMGateway` 新增 OpenAI-compatible 中转站支持：`OPENAI_COMPAT_API_KEY` / `OPENAI_COMPAT_BASE_URL` / `OPENAI_COMPAT_MODEL` 填满后优先使用；中转调用改为直连 HTTP，避免 LiteLLM 初始化卡顿。
- 新增 `OPENAI_COMPAT_WIRE_API`：默认 `chat_completions`；timicc 本地配置设为 `responses`，实际调用 `https://timicc.com/responses`，兼容 `output_text` 和 `output[].content[].text` 两种 Responses 返回结构。
- 新增 `scripts/check_llm.sh` 与 `scripts/probe_llm_routes.sh`：前者验证真实 LLM JSON 返回，后者探测中转站候选路径且不打印 key。
- 新增 `tests/unit/eval/test_real_eval_mode.py`，覆盖真实策略、报告来源标记、脚本契约和默认策略保护。
- `tests/unit/runtime/test_gateway.py` 增加中转站模型选择、key 映射、直连 chat completions、Responses payload / URL / token / 文本解析测试。
- 更新 `docs/08` / `docs/10` / `docs/11` / `docs/12` / `README.md`，沉淀 S2-T2 当前状态与真实环境命令。

**验证结果**：
- 红灯：新增 `tests/unit/eval/test_real_eval_mode.py` 最初 3 项失败（缺真实策略、缺 Judge 来源、缺 `run_real_eval.sh`）；随后新增默认策略保护测试，确认旧逻辑未支持 `real` 参数。
- 绿灯：`bash scripts/test_unit.sh tests/unit/eval/test_real_eval_mode.py -q`：6 passed。
- 评测回归：`bash scripts/test_unit.sh tests/unit/eval/test_eval_harness.py tests/unit/eval/test_eval_ablation.py tests/unit/eval/test_real_eval_mode.py -q`：通过，27 passed。
- 网关回归：`bash scripts/test_unit.sh tests/unit/runtime/test_gateway.py -q`：通过，13 passed。
- 真实 LLM 探针：`bash scripts/check_llm.sh`：通过，`model_used=openai/gpt-5.5`，`json_parse=ok`。
- 真实 Judge 最小验证：`bash scripts/run_eval.sh --compare --tags ablation,rag_required --strategies controlled_rag --max-cases 1 --timeout 45`：通过，`Judge 来源=LLM 或混合`，`overall=0.5433`。
- 脚本语法：`bash -n scripts/*.sh`：通过。
- 受控复验：`bash scripts/run_real_eval.sh --strategies controlled_rag,controlled_reflexion,single_agent_baseline --max-cases 0 --timeout 25`：通过；无 key 时会显示 `Judge 来源=规则降级`，有 key 时可显示 `LLM 或混合`。
- 全量单测：`bash scripts/test_unit.sh`：通过，**344 passed, 2 warnings**。

**诚实限制**：本轮只完成真实 LLM judge 最小验证，没有运行默认 `real_full`。真实 RAG 会触发 bge/外部服务加载，且效果依赖知识库入库质量；最终比赛级结论仍需启动真实服务、跑 `scripts/run_real_eval.sh` 的真实策略组并补人工抽检。

### S2-T1 / S2-T3 / S2-T4 ✅ · 可观测落地 + MCP 基础适配 + 记忆深度接线

**背景**：阶段二主线已锁定为创新深度补全。Claude 已产出 `docs/12-阶段二任务派工书.md`，本轮直接接管执行，不停留在任务书。优先完成不依赖真实 LLM key 的 S2-T1 可观测、S2-T4 记忆深度和 S2-T3 MCP 基础适配；S2-T2 真实评测仍需外部 key/真实服务环境。

**关键实现**：
- 新增 `observability.metrics` 与 `/metrics`，导出 Prometheus 文本指标。
- HTTP 中间件记录请求量/耗时；`harness_guard` 记录 LangGraph 节点运行状态/耗时；`LLMGateway` 记录 LLM 请求、token、延迟、无 key/异常降级；`RAGService` 记录 route 命中、结果数、rerank/route 降级；视频作业记录 pending/running/done/degraded/failed 状态。
- 新增 Grafana provisioning 和 `reflexlearn.json` dashboard；新增 `start_observe.sh` / `check_observe.sh` / `stop_observe.sh`。
- `session_store` 新增 `profile:{tenant}:{user}` 跨会话画像读写；`run_session` LOAD/PERSIST 阶段读写 profile。
- `profile` 节点 fallback 会合并历史画像，不再从零覆盖；`build_graph` 给 profile 节点注入共享 LLM。
- 新增 `enable_promote` 开关，开启后会话结束构造 session reflection 并调用 `MemoryManager.promote_session`。
- `mcp_tools.server` 新增基础适配层，默认暴露 `retrieve`、`doc_gen`、`quiz_gen` 三个无副作用工具；`call_skill` 统一构造最小 public ACL，skill 异常降级为结构化 error payload。
- `pyproject.toml` 新增 `mcp` optional dependency；`scripts/start_mcp.sh` 按项目脚本契约启动 MCP server。

**改动文件清单**：
- 新建：`src/reflexlearn/observability/metrics.py`、`src/reflexlearn/observability/routes.py`。
- 新建：`deploy/grafana/provisioning/datasources/prometheus.yml`、`deploy/grafana/provisioning/dashboards/dashboard.yml`、`deploy/grafana/dashboards/reflexlearn.json`。
- 新建：`scripts/start_observe.sh`、`scripts/check_observe.sh`、`scripts/stop_observe.sh`。
- 新建：`scripts/start_mcp.sh`。
- 新建：`src/reflexlearn/mcp_tools/server.py`。
- 新建：`tests/unit/observability/test_metrics.py`、`tests/unit/observability/test_observe_assets.py`、`tests/unit/memory/test_promote_session.py`、`tests/unit/mcp_tools/test_mcp_tools.py`。
- 修改：`api/app.py`、`common/config.py`、`executor/video_jobs.py`、`llm_gateway/gateway.py`、`memory/session_store.py`、`orchestration/graph.py`、`orchestration/harness.py`、`orchestration/nodes/profile.py`、`rag/service.py`、`docker-compose.yml`、`scripts/check_api_security.sh`。
- 修改：`mcp_tools/__init__.py`、`pyproject.toml`。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/observability/test_metrics.py tests/unit/observability/test_observe_assets.py -q`：通过。
- `bash scripts/test_unit.sh tests/unit/memory/test_session_store.py tests/unit/memory/test_multi_turn.py tests/unit/memory/test_promote_session.py -q`：通过。
- `bash scripts/test_unit.sh tests/unit/mcp_tools/test_mcp_tools.py -q`：通过。
- 受影响模块定向回归：通过。
- `bash -n scripts/*.sh`：通过。
- `bash scripts/test_unit.sh`：当时通过，**333 passed, 2 warnings**；S2-T2 入口和中转站支持补齐后当前基线见 §8：**344 passed, 2 warnings**。
- API `/metrics` 活体：后台启动 `bash scripts/start_api.sh 8003` 后执行 `bash scripts/check_observe.sh 8003`，通过；随后 `bash scripts/stop_api.sh 8003` 清理。

**诚实限制**：当前 WSL 未启用 Docker 集成，`bash scripts/start_observe.sh` 报 `docker could not be found`，所以 Prometheus/Grafana 容器和 dashboard 展示尚未活体验证。`uv pip install -e ".[mcp]"` 因 PyPI 网络超时失败，真实 MCP SDK 启动和客户端联调未完成。`enable_promote` 默认关闭；无 Redis/Qdrant 时 profile/promote 按设计降级，不影响主响应。

### P0 前端登录与生产安全加固第二包 ✅ · 前端 Bearer 闭环 / 生产安全开关 / 脚本拆分

**背景**：P0 第一包完成后，后端已要求 Bearer token，但前端仍没有登录门禁，chat / upload / video 请求无法在鉴权开启后闭环；同时生产环境仍需要禁止默认 demo 密码和 `AUTH_ENABLED=false` 逃生口，API 活体脚本也需要区分“安全冒烟”和“依赖真写”。

**关键实现**：
- `common.auth.validate_auth_runtime()` 统一校验生产环境 auth 运行配置；`create_app()`、`get_current_user()`、`/api/auth/login` 都接入校验，生产关闭 auth、默认 secret、默认 demo 密码都会失败或返回 `auth_misconfigured`。
- 前端新增短期 Bearer MVP：`frontend/lib/auth.ts` 只用 `sessionStorage` 恢复刷新态，不写 `localStorage`，不存 refresh token；`AuthGate` 负责登录、恢复和退出清理。
- `frontend/lib/apiClient.ts` 与 `parseSSEStream(..., token)` 统一注入 `Authorization`；chat / knowledge upload / video submit / video poll 均携带 Bearer token。
- `frontend/lib/types.ts` 新增 `CurrentUser` / `AuthToken`，并将 `SSEMessage.data` 从 `any` 收紧为 `unknown`；`KnowledgeUpload` / `VideoJobCard` 去掉本轮涉及的 `any`。
- `scripts/check_api_security.sh` 只检查 health、login、me、未登录 401、非法上传 415、视频提交鉴权；`scripts/check_api_integrations.sh` 保留 Qdrant/PG 真写检查；`scripts/check_api.sh` 兼容转发安全冒烟并保留日志契约。
- 架构处理：`frontend/components` 已达 8 个条目上限，本轮新增登录门禁与工作台组件放入 `frontend/app/_components/`，避免继续扩大共享组件根目录。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/test_auth_security.py -q`：通过，20 passed。
- `bash scripts/test_unit.sh`：通过，312 passed, 2 warnings。
- `bash -n scripts/*.sh`：通过。
- `bash scripts/build_frontend.sh`：通过。
- `bash scripts/check_api_security.sh 8002`：通过，health、未登录 401、auth login、auth me、非法上传 415、视频提交鉴权均 OK；随后 `bash scripts/stop_api.sh 8002` 已清理。
- `rg -n "any|catch \(e: any\)|result: any|SSEMessage.*any" frontend/app frontend/components frontend/lib`：仅剩 `frontend/components/cards/MarkdownView.tsx` 的第三方 `oneDark as any`，不属于本轮核心类型扩散。

**诚实限制**：当前前端 token 方案为短期 Bearer MVP，使用 `sessionStorage` 恢复刷新态，不是最终生产会话方案。后续应升级为 HttpOnly Cookie + CSRF、数据库用户体系、登录限流、审计和对象级资源归属。`frontend/components` 已达目录条目上限，后续新增共享组件前建议先做组件目录分层。

### P0 最小安全闭环第一包 ✅ · 后端鉴权 / 租户注入 / CORS / 上传基础校验

**背景**：安全审查指出后端缺少最小认证边界，上传接口信任表单 `user_id` / `tenant_id`，CORS 仍是 `* + credentials`，上传文件缺少基础类型校验。本轮只做 P0 第一包，不扩展完整 SaaS 用户系统和前端登录页。

**关键实现**：
- 新增 `common.auth`：演示用户认证、HMAC-SHA256 token 签发/验签、`CurrentUser` / `TokenPayload` / `AuthToken` 强类型模型；生产环境默认 secret 会拒绝签发。
- 新增 `api.deps.get_current_user` 与 `routes/auth.py`：`POST /api/auth/login` 公开，`GET /api/auth/me` 需要 Bearer token。
- `chat` / `knowledge` / `video` 三组接口默认需要登录；`knowledge` 不再从表单读取可信 `user_id` / `tenant_id`，统一使用 token 中的用户与租户。
- `api.app` 接入配置化 CORS 白名单与 `TrustedHostMiddleware`，移除 `allow_origins=["*"]`。
- 新增 `api.upload_guard`：上传文件统一经过大小、扩展名、MIME、魔数和 visibility 校验；route 不再直接 `file.read()`。
- `scripts/check_api.sh` 保持 health 公开，上传和视频检查前自动登录并携带 Bearer token。

**验证结果**：
- `bash scripts/test_unit.sh tests/unit/test_auth_security.py tests/unit/test_knowledge_upload.py tests/unit/test_kafka_io.py tests/unit/test_video_jobs.py -q`：通过，39 passed。
- `bash scripts/test_unit.sh`：通过，309 passed, 2 warnings。
- `bash -n scripts/*.sh`：通过。
- 可选活体：`bash scripts/start_api.sh 8002` 后执行 `bash scripts/check_api.sh 8002`，health 与 auth login 通过；上传在真写入检查处失败，原因是当前环境 Qdrant/PG 不可用（返回 `qdrant:ResponseHandlingException`、`pg:unavailable`）。随后已执行 `bash scripts/stop_api.sh 8002` 清理。

**诚实限制**：当前只是最小后端安全边界，仍未完成数据库用户体系、前端登录页、上传隔离区、病毒扫描、内容审核、防盗链签名 URL、AI Safety Gateway、视频作业对象级归属校验。`tests/unit/` 文件数量仍远超“每层尽量不超过 8 个”的理想指标，本轮按计划不做测试目录重构，后续可单独整理。

### M5-A ✅ · 评测最小闭环（默认 ML 评测集 + 规则 Judge + EvalRunner + CLI）

**背景**：原规划 M5 要求 eval harness、LLM-as-a-judge、消融报告与量化证据。接手时 `src/reflexlearn/eval/` 只有空包，`scripts/run_eval.sh` 只有外壳并提示 `scripts/run_eval.py is not implemented yet.`。本轮先补一条快速可跑的 smoke 评测链路，为后续 LLM judge / 消融对比铺接口。

**关键设计决策**：
- **先离线规则 Judge，后接 LLM judge**：`RuleJudge` 用概念覆盖、难度区间、内容完整度、格式提示打分，无 LLM key 也能稳定跑；后续可在同一接口下扩展 LLM-as-a-judge。
- **真实编排接入但有超时**：`EvalRunner` 接收 async orchestrator，CLI 默认调用 `run_session()`，每个 case 有 `per_case_timeout_s`，避免主对话长链路拖死评测。
- **默认 smoke 关闭 RAG/多轮**：`scripts/run_eval.py` 默认设置 `ENABLE_RAG=false`、`ENABLE_MULTI_TURN=false`，优先保证速度与演示稳定；需要真实 RAG 评测时再显式调整环境。

**改动文件清单**：
- 新建 `src/reflexlearn/eval/schemas.py`：`EvalProfile` / `EvalCase` / `EvalResource` / `JudgeScore` / `EvalResult` / `EvalReport`。
- 新建 `src/reflexlearn/eval/dataset.py`：3 条机器学习默认评测 case（线性回归、过拟合正则化、神经网络路径）。
- 新建 `src/reflexlearn/eval/judge.py`：`RuleJudge` 确定性 fallback 评审器。
- 新建 `src/reflexlearn/eval/runner.py`：事件收集、资源解析、超时处理、指标聚合。
- 新建 `scripts/run_eval.py`：CLI 运行评测并输出 `logs/eval_report.json`；改 `scripts/run_eval.sh` 透传参数。
- 新建 `tests/unit/test_eval_harness.py`：TDD 红绿覆盖数据集、judge、runner 聚合、timeout、脚本契约。

**验证结果**：
- 红灯：缺少 `eval.dataset` / `eval.judge` / `eval.runner` / `scripts/run_eval.py` 时 5 个新增测试失败。
- 绿灯：`bash scripts/test_unit.sh tests/unit/test_eval_harness.py` 实际跑全量单测，**274 passed, 2 warnings**。
- 脚本：`bash -n scripts/*.sh` 通过。
- Smoke：`bash scripts/run_eval.sh --max-cases 2 --timeout 12 --strategy full-smoke` 通过，`task_completion_rate=1.0`，`avg_overall=0.8103`，报告写入 `logs/eval_report.json`。

**诚实记录**：当前是规则评测，不是 LLM-as-a-judge；指标可用于 smoke 和趋势对比，但不能单独作为最终比赛质量证据。下一步要补 LLM judge、固定评测报告 Markdown、消融策略开关与可观测指标汇总。

### M5-B ✅ · LLM-as-a-judge 降级链路 + Markdown 评测报告

**背景**：M5-A 已经能输出规则 judge 的 JSON smoke 报告，但还不能体现 `docs/06` 规划的 LLM-as-a-judge，也不方便 PPT/答辩直接引用。本轮在不牺牲速度的前提下补 LLM judge 接口和 Markdown 报告。

**关键设计决策**：
- **LLMJudge 与 RuleJudge 同接口**：`LLMJudge.evaluate(...)` 调 `LLMGateway.complete(..., task_type="judgment", schema=JudgeScore, temperature=0.0)`；无 key、外呼异常、JSON/schema 异常全部降级 `RuleJudge`。
- **报告双输出**：`scripts/run_eval.py` 同时写 `logs/eval_report.json` 和 `logs/eval_report.md`，JSON 供机器处理，Markdown 供 PPT/答辩/评审阅读。
- **保持 smoke 稳定**：默认仍设置 `ENABLE_RAG=false`、`ENABLE_MULTI_TURN=false`，避免真实模型/Redis/RAG 状态拖慢评测；有 LLM key 时自动尝试 LLM judge，无 key 自动规则降级。

**改动文件清单**：
- 改 `src/reflexlearn/eval/judge.py`：新增 `LLMJudge`、judge prompt、异常降级到 `RuleJudge`。
- 新建 `src/reflexlearn/eval/report.py`：`report_to_markdown(EvalReport)`，输出总览指标和 case 明细表。
- 改 `scripts/run_eval.py`：接入 `LLMJudge(LLMGateway())`，输出 JSON + Markdown。
- 改 `src/reflexlearn/eval/__init__.py`：导出 `LLMJudge` / `report_to_markdown`。
- 改 `tests/unit/test_eval_harness.py`：新增 LLM judge 调用参数、LLM 失败降级、Markdown 报告契约测试。

**验证结果**：
- 红灯：缺 `LLMJudge` / `report_to_markdown` / `eval_report.md` 输出时 4 个新增测试失败。
- 绿灯：`bash scripts/test_unit.sh tests/unit/test_eval_harness.py` 实际跑全量单测，**277 passed, 2 warnings**。
- 脚本：`bash -n scripts/*.sh` 通过。
- Smoke：`bash scripts/run_eval.sh --max-cases 2 --timeout 12 --strategy full-smoke` 通过，`task_completion_rate=1.0`，`avg_overall=0.8103`，报告写入 `logs/eval_report.json` 和 `logs/eval_report.md`。

**诚实记录**：当前环境没有 LLM key 时仍会走规则 judge；这条链路已经具备 LLM judge 调用契约，但最终质量论据仍需要有 key 环境跑一次真实 LLM-as-a-judge，并配人工抽检。

### M5-C ✅ · 消融对比基础设施（strategy suite + comparison report）

**背景**：M5 需要“单 Agent vs 多 Agent、有/无 RAG、有/无 Reflexion”等消融论据。M5-B 只有单策略报告，不能批量跑策略和生成对比表。本轮先补消融对比基础设施，保证后续只改策略环境即可跑多组。

**关键设计决策**：
- **策略配置独立建模**：`EvalStrategy(name, description, env)` 表示一个消融策略，默认提供 `full-smoke` / `no_rag` / `no_reflexion` / `single_agent_baseline`。
- **环境切换带 cache 清理**：`strategy_env` 设置策略环境变量并清理 `get_settings` 缓存，结束后恢复环境，避免策略之间串配置。
- **对比报告单独输出**：`scripts/run_eval.py --compare` 运行多个策略，输出 `logs/eval_comparison.json` + `logs/eval_comparison.md`。
- **smoke 策略不触碰慢外部依赖**：`no_rag` 也显式设置 `ENABLE_REFLEXION=false`，避免评测 smoke 因 memory recall 触碰 Qdrant；`single_agent_baseline` 只生成 doc，用于和多 Agent 资源包拉开基础差距。

**改动文件清单**：
- 新建 `src/reflexlearn/eval/strategies.py`：`EvalStrategy`、默认策略、环境上下文、`run_strategy_suite`。
- 新建 `src/reflexlearn/eval/baselines.py`：`single_agent_baseline` 朴素单 Agent/doc-only 基线。
- 改 `src/reflexlearn/eval/report.py`：新增 `comparison_to_markdown`。
- 改 `scripts/run_eval.py`：新增 `--compare` / `--strategies` 参数，输出消融对比报告。
- 改 `scripts/test_unit.sh`：支持位置参数透传到 pytest，后续可 `bash scripts/test_unit.sh tests/unit/test_eval_harness.py -q` 定向验证。
- 改 `src/reflexlearn/eval/__init__.py`：导出策略与对比报告函数。
- 改 `tests/unit/test_eval_harness.py`：新增策略、环境恢复、suite、comparison Markdown、CLI 合约测试。

**验证结果**：
- 红灯：缺 `eval.strategies` / `comparison_to_markdown` / `--compare` 时 5 个新增测试失败。
- 绿灯：`bash scripts/test_unit.sh tests/unit/test_eval_harness.py` 定向通过，**13 passed**；`bash scripts/test_unit.sh` 全量通过，**284 passed, 2 warnings**。
- 脚本：`bash -n scripts/*.sh` 通过。
- Smoke：`bash scripts/run_eval.sh --compare --max-cases 2 --timeout 12` 通过，生成 `logs/eval_comparison.json` / `logs/eval_comparison.md`；输出无 Qdrant 相关告警。当前 `full-smoke avg_overall=0.8103`，`single_agent_baseline avg_overall=0.7258`。

**诚实记录**：当前 `full-smoke` 为保证速度也关闭慢依赖，因此 `full-smoke` / `no_rag` / `no_reflexion` 的 smoke 分数相同；`single_agent_baseline` 已能体现 doc-only 基线差距，但仍只是 smoke 论据。要形成比赛论据，需要在可控环境下放开 RAG/LLM judge，并设计能触发失败重试的 Reflexion case。

### M5-C2 阶段一 ✅ · 消融靶场增强（ablation case tags + resource_coverage）

**背景**：M5-C 已能跑 strategy suite，但 smoke 默认关闭慢依赖，`full-smoke` / `no_rag` / `no_reflexion` 分数相同；已有 `single_agent_baseline` 只能从 overall 间接看出差距。为了后续形成可解释消融论据，本轮先补“评测靶场”：能筛选检索依赖 / 失败修复依赖 case，并在报告中展示资源覆盖率。

**关键设计决策**：
- **case tags 做切片入口**：新增 `select_eval_cases(tags=[...], max_cases=...)`，`--tags ablation` 可只跑消融靶场；多个 tag 采用 all-match，`--tags ablation,rag_required` 只跑 RAG 依赖 case。
- **新增 resource_coverage 指标**：按 `expected_resource_types` 计算每个 case 的资源覆盖率，再聚合成 `avg_resource_coverage`；它能直接暴露单 Agent/doc-only 基线与多资源生成的结构差距。
- **先靶场、后真实依赖**：新增 `rag_required` / `reflexion_required` case，但默认 smoke 仍不触碰真实 Qdrant/Reflexion。真实消融时复用同一批 case，放开 RAG/LLM judge 后再得正式结论。

**改动文件清单**：
- 改 `src/reflexlearn/eval/dataset.py`：新增 `ml-004`（RAG 三路检索依赖）与 `ml-005`（失败归因/修复策略依赖），新增 `select_eval_cases`。
- 改 `src/reflexlearn/eval/schemas.py` / `runner.py`：`EvalResult.resource_coverage`、`EvalReport.avg_resource_coverage` 与聚合计算。
- 改 `src/reflexlearn/eval/report.py`：单策略报告和消融对比报告展示 `resource_coverage`。
- 改 `scripts/run_eval.py`：新增 `--tags` 过滤；无匹配 case 返回非 0。
- 新建 `tests/unit/test_eval_ablation.py`：覆盖 ablation case、tag 过滤、资源覆盖率聚合、报告列与 CLI 契约。

**验证结果**：
- 红灯：`bash scripts/test_unit.sh tests/unit/test_eval_ablation.py` 初次运行 5 failed，分别缺 case、selector、coverage 字段、报告列与 `--tags` 参数。
- 绿灯：`bash scripts/test_unit.sh tests/unit/test_eval_ablation.py` 通过，**5 passed**；`bash scripts/test_unit.sh tests/unit/test_eval_harness.py` 通过，**13 passed**。
- Smoke：`bash scripts/run_eval.sh --compare --tags ablation --max-cases 2 --timeout 12` 通过；`full-smoke avg_resource_coverage=1.0 avg_overall=0.6260`，`single_agent_baseline avg_resource_coverage=0.3333 avg_overall=0.5275`。

**诚实记录**：这一步让“结构覆盖差距”可量化，但还不是最终 RAG/Reflexion 真实效果结论。`ml-004` 在当前 smoke 下 correctness 很低，正说明它需要真实知识库/RAG 内容；下一步应启动受控 RAG 环境或注入固定知识上下文跑 `rag_required` 切片。

### M5-C2 阶段二 ✅ · 受控 RAG / Reflexion 消融基线

**背景**：阶段一有了 ablation 切片，但 `full-smoke` 仍关闭慢依赖，不能在 correctness 上证明“有知识上下文 / 有失败经验”会提升。为保证速度且不依赖外部 Qdrant/Redis，本轮补 eval-only 受控基线：把固定参考知识或失败修复经验注入生成资源，用于量化上限和区分目标能力。

**关键设计决策**：
- **明确命名为 controlled，不伪装真实链路**：`controlled_rag` / `controlled_reflexion` 不触碰外部向量库或记忆库，只是 eval 靶场中的受控上限基线。
- **按标签定向注入**：`controlled_rag_baseline` 只对 `rag_required` case 注入 `reference_concepts`；`controlled_reflexion_baseline` 只对 `reflexion_required` case 注入失败归因 / 修复策略概念。
- **输出资源类型对齐 expected_resource_types**：受控基线不是 doc-only，而是按 case 期望资源类型生成，用 `resource_coverage` 与 correctness 同时展示结构覆盖与内容命中。

**改动文件清单**：
- 改 `src/reflexlearn/eval/baselines.py`：新增 `controlled_rag_baseline` / `controlled_reflexion_baseline` 与共享受控资源生成器。
- 改 `src/reflexlearn/eval/strategies.py`：默认策略加入 `controlled_rag` / `controlled_reflexion`。
- 改 `scripts/run_eval.py`：`EVAL_BASELINE` 映射新增两个受控 orchestrator。
- 改 `src/reflexlearn/eval/__init__.py`：导出受控基线。
- 改 `tests/unit/test_eval_ablation.py`：新增 3 个红绿测试覆盖策略注册、RAG 目标 case 提升、Reflexion 目标 case 提升。

**验证结果**：
- 红灯：`bash scripts/test_unit.sh tests/unit/test_eval_ablation.py` 初次运行新增 3 failed，缺 `controlled_rag` / `controlled_reflexion` 策略与 baseline 导出。
- 绿灯：`bash scripts/test_unit.sh tests/unit/test_eval_ablation.py` 通过，**8 passed**；`bash scripts/test_unit.sh tests/unit/test_eval_harness.py` 通过，**13 passed**。
- Smoke：`bash scripts/run_eval.sh --compare --tags ablation --max-cases 2 --timeout 12` 通过；`controlled_rag avg_correctness=0.6000 avg_overall=0.7871`，`controlled_reflexion avg_correctness=0.5000 avg_overall=0.7598`，均高于 `full-smoke avg_overall=0.6260` 与 `single_agent_baseline avg_overall=0.5275`。
- 靶向证据：`bash scripts/run_eval.sh --compare --tags ablation,rag_required --strategies no_rag,controlled_rag,single_agent_baseline --max-cases 1 --timeout 12` 通过，`no_rag avg_correctness=0.0000 avg_overall=0.6058`，`controlled_rag avg_correctness=1.0000 avg_overall=0.9495`。
- 靶向证据：`bash scripts/run_eval.sh --compare --tags ablation,reflexion_required --strategies no_reflexion,controlled_reflexion,single_agent_baseline --max-cases 1 --timeout 12` 通过，`no_reflexion avg_correctness=0.2000 avg_overall=0.6463`，`controlled_reflexion avg_correctness=1.0000 avg_overall=0.9521`。

**诚实记录**：这仍是受控上限基线，不是“真 Qdrant/真 Reflexion 召回”的最终证明。它的价值是把评测靶场、报告字段和对照逻辑全部跑通；下一步若要比赛级论据，应在相同 `--tags` 切片上接真实知识库或固定假 Qdrant/RAG service。

### M5-D ✅ · 正式评测报告沉淀

**背景**：M5-C/M5-C2 的报告此前主要写在 `logs/`，属于运行产物，跨会话容易被覆盖。docs/ 需要有正式版本承接当前结论、限制与下一步计划。

**改动文件清单**：
- 新建 `docs/08-评测报告与消融结果.md`：汇总 M5-A/B/C/C2 的评测集、指标定义、已验证命令、RAG/Reflexion 靶向消融结果、当前限制与后续计划。
- 改 `PROGRESS.md`：更新 M5-D 状态与快速接管摘要。

**验证结果**：
- 报告引用的命令均已在本轮跑通：脚本语法、全量单测、RAG 靶向消融、Reflexion 靶向消融。

**诚实记录**：该文档是当前阶段的正式报告，不是最终比赛版报告。最终版仍需真实 RAG/Reflexion 环境、LLM-as-a-judge key 环境和人工抽检结果补齐。

### 5.0 本轮 ✅ · M4 大数据栈推进（持续）—— B 图谱 + C Kafka + D Spark·MinIO + E 视频 + F 前端

> 本轮（同一接管会话）连续推进 M4 各子项（docs/04），全程降级铁律、零回归。为免反复重排历史编号，本轮各子项以 `####` 小节追加于此章。

#### 接手补丁 · Run & Debug 脚本 + 文件日志契约 + 真集群活体

**背景**：AGENTS 规则要求所有 Run & Debug 操作统一走 `scripts/*.sh`，且启动/调试前必须有文件日志输出到 `logs/`。接手时脚本只覆盖 core/graph/full/api/stop，且 `start_api.sh`、README、Makefile 仍引导直接 `uv`/`npm`/pytest；`logs/` 目录不存在，API 无应用级文件日志。

**改动文件清单**：
- 新建 `scripts/_lib.sh`：统一 `PROJECT_ROOT`/`LOG_DIR`、`ensure_logs`、本地网络变量、Python 默认环境、`.venv` 解释器定位。
- 新建 `scripts/start_bigdata.sh`、`check_bigdata.sh`、`start_frontend.sh`、`test_unit.sh`、`init_all.sh`、`run_eval.sh`、`check_api.sh`、`stop_api.sh`；改 `start_core.sh`/`start_graph.sh`/`start_full.sh`/`start_api.sh`/`stop_all.sh`，全部 `tee -a "$LOG_DIR/*.log"`。
- 新建 `common/logging.py` 并在 `api/app.py:create_app` 调用；`REFLEXLEARN_LOG_FILE` 默认 `logs/api.log`。
- 改 `docker-compose.yml`：Kafka/MinIO 镜像走 `${DOCKER_IMAGE_PREFIX:-docker.m.daocloud.io/}`，避免直连 Docker Hub。
- 改 `common/embedding.py`：embedding 默认本地缓存优先，传 `local_files_only=True`，并设置 HF/Transformers 离线变量与 `DISABLE_SAFETENSORS_CONVERSION=1`；避免上传活体时联网卡死。
- 改 `Makefile` 和 `README.md`，把初始化/测试/启动入口改为脚本封装。
- 改 `tests/unit/test_core.py` / `test_embedding.py`，新增脚本契约、文件日志、mirror 镜像、API 端口覆盖、stop_api 清理、embedding 离线加载测试。

**验证结果**：
- TDD 红灯已确认：缺少公共脚本库与 `common.logging` 时 `test_core.py` 两测失败。
- `bash scripts/test_unit.sh`：当时 **268 passed, 2 warnings**；当前基线已随前端脚本契约测试更新为 **269 passed, 2 warnings**（FastAPI TestClient/httpx2 弃用提醒；jieba/pkg_resources 弃用提醒）。
- `bash -n scripts/*.sh` 通过；`bash scripts/start_graph.sh` 通过并写 `logs/start_graph.log`，core+graph 四容器保持运行。
- `bash scripts/start_bigdata.sh`：Kafka/MinIO 经 mirror 拉取并启动；`bash scripts/check_bigdata.sh`：MinIO put/get/remove + Kafka produce/consume 通过。
- `bash scripts/start_api.sh 8001` + `bash scripts/check_api.sh 8001`：health、上传真写、视频作业降级均通过；`bash scripts/stop_api.sh 8001` 清理成功，无 uvicorn/check/test 残留进程。脚本仍保留 `API_PORT=8001` 环境变量写法，但位置参数在 Windows/PowerShell 调用链中更稳定。

**环境结论**：当前 Windows/WSL 混合 shell 下 `uv run ...` 会卡住，且 Bash `export` 不会传给 Windows `.venv/Scripts/python.exe`；脚本内部运行 Python 任务改走 `.venv`，端口等运行参数优先用命令行参数传递，依赖安装/维护仍应使用 uv。

#### 前端依赖升级 · Next 15.4 / React 19 / Tailwind 4 + 浏览器活体联调

**背景**：AGENTS 硬性规则要求 Next.js v15.4、React v19、Tailwind CSS v4。接手时 `frontend/package.json` 仍是 Next 14.2.5 / React 18.3.1 / Tailwind 3.4.7，且前端构建/停止没有脚本封装，`NEXT_PUBLIC_API_BASE` 在 Windows Git Bash → Windows Node 调用链中不能稳定继承。

**改动文件清单**：
- 改 `frontend/package.json` / `package-lock.json`：升级到 `next@15.4.11`、`react@19.2.7`、`react-dom@19.2.7`、`tailwindcss@4.3.0`、`@tailwindcss/postcss@4.3.0`、`@types/react@19.2.16`、`@types/react-dom@19.2.3`；移除 `autoprefixer`。
- 改 `frontend/postcss.config.mjs`：PostCSS 插件改为 `@tailwindcss/postcss`。
- 改 `frontend/app/globals.css`：Tailwind v4 入口改为 `@import "tailwindcss";`。
- 删 `frontend/tailwind.config.ts`：Tailwind v4 CSS-first 与自动内容检测下不再需要 v3 config。
- 改 `scripts/start_frontend.sh`：支持 `bash scripts/start_frontend.sh 3001 http://localhost:8001/api`；Windows 下用 `cmd.exe /C "set NEXT_PUBLIC_API_BASE=...&& npm ..."` 确保 API base 进入 Node 进程。
- 新增 `scripts/build_frontend.sh` / `scripts/stop_frontend.sh`：前端构建和停止也统一走脚本并写 `logs/`。
- 改 `frontend/lib/useChat.ts`：修复“停止生成”只 abort 但不退出 streaming 的状态机问题；同时将异常处理从 `any` 收紧为 `unknown`。
- 改 `tests/unit/test_core.py`：新增前端脚本契约测试，锁定端口/API base 覆盖与 Windows env 注入。

**验证结果**：
- `npm ls next react react-dom tailwindcss @tailwindcss/postcss @types/react @types/react-dom --depth=0`：确认 Next 15.4.11 / React 19.2.7 / Tailwind 4.3.0。
- `bash -n scripts/*.sh`：通过。
- `bash scripts/build_frontend.sh http://localhost:8001/api`：Next 15.4.11 生产构建通过，静态页 5/5，首屏 466kB。
- `bash scripts/test_unit.sh`：**269 passed, 2 warnings**（第三方 FastAPI/httpx2、jieba/pkg_resources 弃用提醒）。
- Playwright 活体（前端 `:3001` → API `:8001`）：页面标题正常、控制台 error/warning 为 0；上传 `data/knowledge/linear_regression.md` → `POST http://localhost:8001/api/knowledge/upload` 200，页面显示 `ok`、chunks=5、embedded=5、Qdrant=5、PG=✓；视频 storyboard → `POST /api/video/jobs` 200、`GET /api/video/jobs/{id}` 200，页面显示 `降级（展示分镜脚本）`；主对话 SSE 请求命中 `http://localhost:8001/api/chat`，点击“停止生成”后 UI 退出 streaming，网络请求为浏览器主动 `ERR_ABORTED`。

**诚实记录**：主对话后端长链路在 RAG/记忆查询后超过 2 分钟未自然收尾；前端请求与停止状态机已验证，后端服务端取消/长耗时需下一轮单独排查，不归入本轮前端依赖升级范围。

#### M4-B · 图谱构建（LLM 抽取概念/先修关系 → MERGE 入 Neo4j，写读闭环）

**背景**：M4-A 打通了「上传 → 解析/分块/向量化入 Qdrant + documents 登记」的写链路，但 `IngestResult.graph` 仅占位，Neo4j 知识图谱只有 `scripts/ingest_graph.py` 灌的 4 个手工种子概念。本轮补齐 docs/04 的图谱构建：上传链路用 LLM 从文档抽取核心概念 + 先修依赖关系，MERGE 幂等入 Neo4j，使 6.1 的图谱检索（`graph_retrieval`）与 path_plan 拓扑回填能吃到用户上传的真实知识，而非仅种子。

**三个关键设计决策**：
- **schema 严格对齐读侧**（写读闭环的命门）：写入 `(:Concept {name, tenant_id, description, difficulty, visibility})` + `PREREQUISITE_OF`/`RELATED_TO`，与 `rag/graph_retrieval.py` 读侧逐字段对齐——读侧 ACL 靠 `c.tenant_id=$tid OR c.visibility='public'`，故**写入必带 tenant_id + visibility**，否则抽出的概念检索不到、path_plan 回填不上。
- **文档级一次抽取**（非 contextual 的逐 chunk）：拼接 chunks 截断到 `graph_extract_max_chars`（默认 8000），一篇文档一次 LLM 调用产出一张概念图，控成本/时延；与每 chunk 一次的 contextual 摘要正交、互不干扰。
- **ON CREATE / ON MATCH 分治保护种子**：概念 MERGE 时 `ON CREATE SET` 全字段、`ON MATCH SET coalesce(...)` 只补缺失——种子图（权威 difficulty / 拓扑）不被用户上传抽取覆盖，抽取仅作补充。关系 type 不能参数化，按 PREREQUISITE_OF / RELATED_TO 分两条 Cypher（仿种子脚本）。

**依赖注入（延续 M4-A 范式）**：`build_graph(*, neo4j, gateway=None, ...)` 由 `ingest_document` 注入 `neo4j`（route 经 `_safe_neo4j()` 取，连接失败吞 None）。conftest **不拦 get_neo4j、不拦 gateway**，单测注入假 neo4j / 假 gateway 既测成功又测降级，绝不让函数内自取触发真实连接 / 外呼。

**改动文件清单**：
- 新建 `data_engineering/graph_build.py`：`GraphExtraction`/`ExtractedConcept`/`ExtractedRelation` schema + `extract_concepts`（LLM 抽取，`schema=GraphExtraction` 触发 json_object）+ `_loads_lenient`（剥 json 代码块围栏 + 截首尾花括号，容忍 LLM 赘述）+ `_sanitize`（去空名 / 去重 / difficulty 夹 [0,1] / 悬空·自环关系过滤 / type 归一）+ `merge_into_neo4j`（MERGE 幂等）+ `build_graph`（编排，返回 status/concepts/relations/notes 四元组）
- 改 `data_engineering/ingest.py`：`IngestResult` +`graph_concepts`/`graph_relations`（`graph` 状态语义化 disabled|skipped|ok|degraded）；`ingest_document` +`neo4j`/`enable_graph_build` 注入参数 + 第 6.5 步图谱构建（PG 登记后、关键词失效前）
- 改 `api/routes/knowledge.py`（+`_safe_neo4j` + 注入 + `enable_graph_build` Form）、`common/config.py`（+`enable_graph_build`/`graph_extract_max_chars`）

**验证结果**：
- 单测 **227 passed**（212→227，+15，零回归）：test_graph_build —— `_loads_lenient` 剥围栏 / `_sanitize` 去重·clamp·过滤 / extract 成功·围栏·LLM 降级·JSON 降级·空文本 / merge 概念+关系分流（断言 tid/vis/doc 参数对齐读侧 ACL）/ build_graph 四态（neo4j None→skipped、成功→ok、LLM 挂→skipped、MERGE 异常→degraded）/ ingest 集成三态（成功 graph=ok·2概念1关系、默认 disabled、neo4j None→skipped）。
- **诚实记录**：Docker daemon 未起（同往轮）→ 真 Neo4j 写入未活体；`.env` LLM key 全空 → 真 LLM 抽取未跑。机制完整：抽取/MERGE/降级全单测覆盖，schema 对齐由 merge 测试的参数断言锁定，Cypher 语法（MERGE / ON CREATE / ON MATCH、关系分治）与已活体验证的 `scripts/ingest_graph.py` 同构，真环境就绪即自动切换无需改业务代码。

**降级矩阵**：开关关→graph=disabled；neo4j None→skipped(`graph:neo4j_unavailable`)；LLM 无凭证/外呼失败→skipped(`graph:llm_*`)；LLM 输出非法 JSON→skipped(`graph:parse_*`)；抽不出概念→skipped(`graph:no_concepts`)；MERGE 异常→degraded(`graph:merge_*`)。任一降级不抛错、不中断 ingest 主链路（qdrant/pg 照常）。

**本轮要点**（并入 memory）：写侧图谱 schema 必须对齐读侧 ACL 字段（tenant_id + visibility），否则写了也检索不到——写读闭环的命门。

#### M4-C · Kafka 增量（aiokafka 生产/消费，broker 不可用降级同步链路）

**背景**：M4-A/B 打通同步写链路（上传即解析/分块/向量化/图谱）。docs/04 §7 要求 Kafka 增量：上传只投递事件、消费端异步入库，削峰 + 解耦。本轮落地生产/消费两端 + route 分流，并坚守降级铁律——broker 不可用时上传**降级为同步链路**，用户仍立即得结果，绝不因 broker 挂而上传失败。

**关键设计决策**：
- **生产端 broker 不可用降级同步**（铁律命门）：`enable_kafka=True` 时 route 先 `enqueue_document` 投递 `doc_added` 事件；broker 连不上 → 返回 None → route **回退同步 `ingest_document`**。`enable_kafka=False` 直接同步。三态单测全覆盖。
- **事件载荷内联 base64**：M4-C 简化为 payload 内联 `content_b64`（小/中文档；Kafka 默认单消息 ~1MB 上限）。M4-D 接 MinIO 后改投递 object key、消费端从对象存储拉，规避大消息边界（docs/04 §7.3）。
- **消费端复用唯一写入口**：`handle_event` 解码 → `ingest_document`（与上传 API 同链路，含图谱构建），单条事件失败不拖垮消费循环。消费者是**独立进程**（`scripts/kafka_consumer.py`），不塞进后端 lifespan——避免后端启动依赖 broker。
- **依赖注入 + aiokafka 已装**：`publish_event`/`handle_event` 的 producer/qdrant/pg/neo4j 由调用方注入。aiokafka 0.14.0 已装（import 不降级，只 broker 连接降级），单测注入假 producer **绝不真连 broker**（127.0.0.1:19092 会超时卡死）。

**改动文件清单**：
- 新建 `data_engineering/events.py`（`KnowledgeEvent` schema + `build_doc_event`（raw→base64）+ `decode_payload_raw` + topic/event_type 常量；**无 aiokafka 依赖**，生产/消费/单测共用）
- 新建 `data_engineering/kafka_io.py`（`_get_producer` 惰性单例 + `publish_event`（失败 False）+ `enqueue_document`（成功 queued dict / broker 挂 None）+ `handle_event`（消费→ingest）+ `run_consumer`（消费循环）+ `KafkaUnavailable`）
- 新建 `scripts/kafka_consumer.py`（消费进程入口，仿 ingest_graph.py）
- 改 `api/routes/knowledge.py`（+`get_settings` import + `enable_kafka` 分流：投递成功返 queued、broker 挂降级同步）

**验证结果**：
- 单测 **236 passed**（227→236，+9，零回归）：test_kafka_io —— 事件 JSON 往返、publish 成功/broker 降级、enqueue 成功/broker None、handle_event doc_added 入库（payload 还原经唯一写入口）/doc_deleted noop、route enable_kafka 投递 queued / broker 挂降级同步。
- **诚实记录**：无真实 Kafka broker（Docker 未起）→ 真投递/消费未活体；机制完整：生产/消费/降级/route 分流全单测覆盖，事件编解码 JSON 往返验证，真 broker 就绪 + `enable_kafka=true` + 跑 `scripts/kafka_consumer.py` 即生效。

**降级矩阵**：enable_kafka=False→同步链路（M4-A/B 原样）；enable_kafka=True + broker 挂→publish/enqueue 失败→route 降级同步；消费端单条事件解析/入库失败→记日志跳过、不中断循环；消费端 broker 挂→启动报错退出（后端不受影响）。

#### M4-D · Spark/MinIO 批清洗（clean 纯函数 + 三级 runner 降级）

**背景**：docs/04 §6 要求离线批清洗（去重/标准化/术语统一/质量过滤）保证知识底座质量 + MinIO/HDFS 原始存储。本轮落地：清洗逻辑写成**引擎无关纯函数**，runner 三级降级（Spark local[*]→pandas→纯 Python），MinIO 作原始/中间结果对象存储。

**关键设计决策**：
- **clean 纯函数与执行引擎解耦**：`cleaning.clean_one`/`clean_batch` 无 pyspark/pandas/settings 依赖，是确定性清洗内核；Spark UDF（`rdd.map`）、pandas（`apply`）、纯 Python 三种 runner 复用同一函数——引擎只决定并行度、不改清洗语义，便于测试（纯函数真实可跑）与降级。
- **三级 runner 降级**：`run_cleaning` 探测 `import pyspark`→spark、`import pandas`→pandas、都缺→`clean_batch` 纯 Python。环境实测 **pyspark/pandas 均未装 → 真实走纯 Python**；装上任一自动提速无需改码。`report.engine` 标记实际引擎。
- **去重简化为精确 hash**：`content_hash`=归一化文本 sha1 前 16 位（同文判重）。docs §6.1 的 SimHash/MinHash 近似去重需指纹库，留待；精确去重已覆盖「同文重传」主场景。
- **MinIO 注入降级**：`storage` 全 I/O try/except 吞错（无服务返回 False/空），`run_cleaning_job` 无 MinIO 返回 None 跳过。client 注入，单测用内存假 client 绝不真连。

**改动文件清单**：
- 新建 `data_engineering/cleaning.py`（`normalize_text`（bs4 去标签缺库回退正则）+ `normalize_terms`（术语词典）+ `content_hash` + `is_quality` + `clean_one`/`clean_batch` 纯函数）
- 新建 `data_engineering/batch.py`（`run_cleaning` 三级 runner + `_run_spark`/`_run_pandas` + `run_cleaning_job` 串 MinIO + `CleaningReport`）
- 新建 `data_engineering/storage.py`（MinIO `make_minio_client` + `put_bytes`/`get_bytes` + `put_documents`/`get_documents` JSON Lines，全降级）
- 新建 `scripts/run_clean.py`（批清洗作业入口）；改 `common/config.py`（+minio_* / enable_minio / clean_min_chars）

**验证结果**：
- 单测 **248 passed**（236→248，+12，零回归）：test_data_clean —— 纯函数（normalize/terms/hash/quality/clean_one/clean_batch 去重过滤）、runner（engine/计数/空输入）、MinIO 假 client（往返/失败降级/job 注入/无 MinIO 返回 None）。
- **诚实记录**：环境 minio 已装但无 MinIO 服务（Docker 未起）→ 真对象存储未活体（单测内存假 client 覆盖）；pyspark/pandas 未装 → Spark/pandas runner 缺库降级路径验证，**纯 Python 清洗是真实活体路径**（单测真跑）。装 spark/pandas + 起 MinIO 即切换。

**降级矩阵**：pyspark 缺→pandas；pandas 缺→纯 Python（永不失败）；clean 纯函数无外部依赖永不降级；MinIO 不可用→storage 返回 False/空、run_cleaning_job 返回 None 跳过；坏 JSON 行→跳过不中断。

#### M4-E · 多模态视频（SeeDance 异步作业 + 轮询 + storyboard 降级）

**背景**：VideoGenSkill（M2）已产出 storyboard 分镜脚本，docs/00 点名 SeeDance 视频生成、docs/05 §3.3 用 Celery 异步重任务。本轮落地视频生成作业系统：storyboard → SeeDance 异步生成 → 前端轮询，无凭证降级 storyboard 占位。

**关键设计决策**：
- **asyncio 轻量异步替代 Celery**：提交作业 `asyncio.create_task` 后台跑 `process_job`，免独立 worker 进程；提交立即返回 job_id（pending），前端轮询 `GET /api/video/jobs/{id}`。`submit_video_job(autostart=False)` 供单测只创建不跑后台（确定性）。
- **JobStore Redis 降级内存**（仿 session_store）：作业状态优先 Redis（`video_job:{id}` + TTL，多 worker 共享）、不可用降级内存 dict（同进程轮询仍工作）。redis 注入，单测假 redis 绝不真连。
- **SeeDance 降级 storyboard 占位**（铁律）：`enable_seedance=false`/无 key/外呼失败 → 作业落 `degraded`、video_url=None、storyboard 分镜脚本作占位（前端展示脚本，不假装出视频），呼应 docs/00 §「降级图文」对策。
- **依赖注入**：`call_seedance(client=...)`/`JobStore(redis=...)` 注入，单测假 httpx client + 假 redis，绝不真外呼/真连。

**改动文件清单**：
- 新建 `executor/video_jobs.py`（`VideoJob` + `JobStore`（Redis 降级内存）+ `call_seedance`（httpx，无凭证抛）+ `process_job`（running→done/degraded/failed）+ `submit_video_job`/`get_video_job` + `SeeDanceUnavailable`）
- 新建 `api/routes/video.py`（POST 提交 + GET 轮询）；改 `api/app.py`（注册 video 路由）、`common/config.py`（+seedance_* / enable_seedance / video_job_ttl）

**验证结果**：
- 单测 **259 passed**（248→259，+11，零回归）：test_video_jobs —— JobStore Redis 往返/降级内存、call_seedance 无 key 抛/假 client 取 url/无 url 抛、process_job 降级（storyboard 占位）/成功/作业不存在、submit pending、route 提交+查询/404。
- **诚实记录**：无 SeeDance 凭证（enable_seedance=false）→ 真视频生成未活体，降级 storyboard 占位是真实运行路径；无 Redis → JobStore 降级内存（真实路径，单测假 redis 覆盖 Redis 路径）。真 ARK key + enable_seedance + Redis 就绪即切换。

**降级矩阵**：enable_seedance=false/无 key→degraded + storyboard 占位；SeeDance 外呼失败→degraded；响应无 url→degraded；其他异常→failed；Redis 不可用→JobStore 内存；作业不存在→404。

#### M4-F · 前端上传可视化（拖拽上传 + 结果面板 + 视频卡轮询）

**背景**：M4-A~E 的后端能力（上传写链路 / 图谱 / Kafka / 批清洗 / 视频作业）需要前端入口演示。本轮在对话式 UI 上叠加 M4 数据工程工具区，复用既有 Tailwind/组件范式，零侵入主对话流。

**关键设计决策**：
- **折叠工具区零侵入**：page.tsx 在 header 与对话流之间插入 `<details>` 折叠区（默认收起），含上传 + 视频两组件，不挤占多轮对话 UX。
- **上传结果可视化**：`KnowledgeUpload` 拖拽/选择文件 → FormData POST `/api/knowledge/upload` → 面板展示 IngestResult 全字段（分块/向量化/Qdrant/PG/图谱/概念/关系 + status 徽标 + degraded 列表）；queued（Kafka）单独提示。
- **视频卡轮询**：`VideoJobCard` 提交 storyboard → POST `/api/video/jobs` → 2s setTimeout 轮询 GET 直到 done/degraded/failed（≤30 次）；done 显示视频链接、degraded 展示 storyboard 占位、卸载清定时器。
- **API base 复用既有范式**：`process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api"`（同 useChat），CORS 已开 `*`。

**改动文件清单**：
- 新建 `frontend/components/KnowledgeUpload.tsx`（拖拽上传 + IngestResultPanel）、`frontend/components/VideoJobCard.tsx`（提交 + 轮询）
- 改 `frontend/lib/types.ts`（+IngestResult / VideoJob 接口）、`frontend/app/page.tsx`（import + 折叠工具区接入）

**验证结果**：
- `npm run build` **类型检查零错**、5/5 静态页生成、首屏 445kB（Next.js 14.2）。
- **诚实记录**：UI 交互未起 dev server 活体点击（同往轮，需 `npm run dev` + 后端联调）；类型与构建全绿，组件逻辑（拖拽/FormData/轮询/降级展示）直观可审，后端就绪即端到端联通。

### 5.1 ✅ · M4-A 知识写链路（上传 API + 多格式解析 + 结构感知分块 + 向量化入库）

**背景**：M3 收官进入 M4。`data_engineering/` 此前是空目录，写侧仅 `scripts/ingest_knowledge.py`（朴素灌种子）。本轮补齐 docs/04 的 L0 写链路：文档上传 → 多格式解析 → 结构感知分块 →（可选 contextual 摘要）→ 真实 bge 向量化入 Qdrant + `documents` 表登记 + 关键词索引失效，作 B（图谱）/C（Kafka）共用的唯一写入口。

**四个关键设计决策**：
- **依赖注入（仿 reflexion.write_reflection）**：`ingest_document(*, qdrant, pg_pool, ...)` 由调用方传入。因 conftest **不拦 pg**，若函数内 `get_pg_pool()` 自取，单测会触发真实 asyncpg 连接卡死——故注入而非自取，单测注入假对象/None 既测成功又测降级。
- **payload.content 存原文、向量含 contextual 增强**：Anthropic contextual retrieval 语义——embed 带 LLM 定位摘要前缀的文本，但 payload 存原文供检索展示。
- **contextual 默认关 + Semaphore(4) + 上限**：每 chunk 一次 LLM，大文档串行会拉长上传时延；`enable_contextual=False` 默认，超 `contextual_max_chunks` 整体跳过。
- **不建 document_chunks 表**：读侧 chunk 全从 Qdrant payload / Neo4j 读，`documents` 表（已存在）足够；`uuid5(tenant::course::file)`→doc_id 幂等、`uuid5(doc_id::idx)`→point 幂等。

**改动文件清单**：
- 新建 `data_engineering/parsing.py`（ParsedDoc/Section + `parse_document` 按扩展名分派；pdf=PyMuPDF / docx=python-docx / pptx=python-pptx / html=bs4 均函数内 import、缺库抛 `ParserUnavailable`；md/txt 内置永不降级；`detect_format`）
- 新建 `data_engineering/chunking.py`（结构感知分块：section 边界内段落聚合到 max_chars、超长滑窗带 overlap、heading 随块带出；算法与 ingest_knowledge 一致）
- 新建 `data_engineering/ingest.py`（`ingest_document` 核心写链路 + `IngestResult` + `_contextualize`；7 步全 try/except 降级，payload 八字段对齐既有契约 + heading/doc_id，source_trust=0.7）
- 新建 `api/routes/knowledge.py`（`POST /api/knowledge/upload` multipart；`_safe_qdrant`/`_safe_pg` 吞连接失败为 None）
- 改 `api/app.py`（注册 knowledge 路由）、`common/config.py`（+enable_contextual/contextual_max_chunks）、`pyproject.toml`（+data/kafka/storage extra）

**验证结果**：
- 单测 **212 passed**（182→212，+30，零回归）：test_chunking(7) / test_parsing(11，含 fitz/docx/pptx 真实解析活体) / test_data_ingest(12，成功+每条降级+contextual) / test_knowledge_upload(2)。
- 活体（真实 bge-large-zh 离线缓存加载）：md 文档 → chunks=2 / embedded=2 / 向量 1024 维非零 / payload 八字段契约齐全（source_trust=0.7、visibility=public）；qdrant=None+pg=None → status=degraded、degraded=['qdrant:unavailable','pg:unavailable'] 不崩、embedding 仍真实。
- **诚实记录**：Docker daemon 未起 → Qdrant/PG 真集群写入活体受限（同往轮 reranker/真 LLM）；真实写入由 CaptureQdrant 活体脚本 + hermetic 单测的降级路径覆盖，机制完整、真环境就绪即自动切换无需改业务代码。

**降级矩阵**：解析缺库/不支持→该文档 degraded（chunks=0）链路仍 200；embedding 不可用/RAG 关→embedded=0 不写零向量、PG 仍登记；qdrant None/异常→qdrant_written=0；pg None/异常→pg_written=False；contextual LLM 不可用→逐块回退原文；qdrant+pg 全降级仍返回 degraded 200。

**本轮新踩的坑**（已并入 memory）：写链路依赖必须**注入而非函数内自取**（conftest 不拦 pg，自取会卡死单测）；**幂等覆盖残留边界**（重传若分块变少，旧 point 残留——doc_id/source 无 payload index 暂不能 filter-delete，记为已知边界，重传分块数稳定时无影响）。

### 5.2 ✅ · 6.2 三级记忆完善 —— L1 上下文工程 + 多轮会话 + 成本感知路由 + 对话式 UI

**背景**：M3 仅剩 6.2。改造前系统**单轮无状态**（每次单条消息、无 session、profile 用朴素 `messages[-8:]`、`memory/manager.py` 仅 37 行骨架）。本轮按 docs/03 补齐 **L1 短期记忆/上下文工程**（L2 Reflexion、L3 混合检索已完成），并落地**真正多轮**。

**四个关键设计决策**（与 docs/03 的刻意差异）：
- **summary 状态归属 Redis（per-session）**，绝不放 MemoryManager 单例实例属性（docs §2.4/§6 的 `self.layers` 会跨用户串台）→ TrimStrategy / RecursiveSummaryBuffer 全做**无状态纯函数**。
- **trim 只供 LLM 调用前临时构造**，绝不回写 `state["messages"]`（add_messages reducer 只追加）→ 长对话历史走 Redis 绕过 reducer。
- **无 Mem0**：recall 转发 reflexion，promote_session 直接调 write_reflection。
- **session_store.py 薄封装**：所有 Redis I/O 收敛于此（conftest 不拦 get_redis，集成测试在此 mock）。

**改动文件清单**：
- 新建 `memory/session_store.py`（load/persist 单 key JSON + TTL，全程降级）、`memory/trim.py`（TrimConfig + trim_context + is_important，规范化 dict 兼容 BaseMessage）、`memory/recursive_summary.py`（add_and_compress/get_context/_merge，LLM 降级规则截断）
- 升级 `memory/manager.py`（+trim_context/get_summary_context/update_summary/promote_session 无状态转发；recall/recall_memory_node 不变）
- 改 `orchestration/state.py`（+session_id/+summary_layers）、`orchestration/graph.py`（run_session 接 session_id + load/persist + persist 段递归摘要 + 复用单个 LLMGateway）、`orchestration/nodes/profile.py`（`messages[-8:]`→trim_context）、`orchestration/nodes/planner.py`（summary 注入 system prompt，仿 reflections）
- 改 `api/routes/chat.py`（ChatRequest +session_id，首帧 emit `event:session`）、`common/config.py`（+enable_multi_turn/session_ttl/summary_*）、`llm_gateway/gateway.py`（`_select_model` 成本感知：summary→便宜档 qwen-turbo/claude-haiku，+summary_model 覆盖；非 summary 选型逐字节不变）
- 前端 `frontend/lib/useChat.ts`（单一 state→`turns[]`，sessionRef+localStorage+resetSession）、`frontend/app/page.tsx`（对话式累积渲染 + 「＋ 新会话」按钮，展示组件全复用）

**验证结果**：
- 单测 **182 passed**（135→182，+47，零回归）：新增 session_store(7)/multi_turn(5)/gateway(8)/trim(9)/recursive_summary(8)/memory_manager(8) + planner(2)；前端 `npm run build` 类型检查零错。
- 活体多轮（真起 Redis :16379 + 后端 `ENABLE_RAG=false` 隔离模型）：① `event:session` 首帧回传 session_id；② 两轮 HTTP 串联同 sid → Redis `session:{sid}` messages 累积 4 条（user turns=['linear regression','gradient descent']）；③ 14 条超窗口历史 → 递归摘要触发 `summary_layers=1` 层。
- **诚实记录**：`.env` 三个 LLM key 全空 → summary 走**规则截断**（"（离线摘要）..."），真 LLM 摘要内容未跑（环境所限，类似上轮 reranker）；机制完整（触发/落盘/planner 注入路径全通）。`ENABLE_RAG=false` 隔离 bge（避陷阱#5/#7）。

**降级矩阵**：Redis 挂→多轮退单轮（load 空/persist False）；LLM 无凭证→summary 规则截断、profile/planner 走 fallback；trim 短输入直返；layers 超 max_depth→merge（LLM 挂则字符串拼接）；promote 无 qdrant/pg→write_reflection 返回 False；`enable_multi_turn=False`→恒单轮。

**本轮新踩的坑**（已并入 2.1 / memory）：conftest 不拦 `get_redis`（新 Redis I/O 必须 session_store 层 try/except + 测试 mock）；add_messages 把 dict 转 BaseMessage（trim 需规范化为 dict，否则 `json.dumps` 失败——原 profile 的 `messages[-8:]` 暗藏此坑）；MemoryManager 单例不可持有 session 级可变状态；旧后端进程跨会话残留占 8000（验证前先 netstat 查杀）。

### 5.3 ✅ · 6.1 混合检索（三路 RAG）+ Neo4j 知识图谱 + path_plan 拓扑回填

**背景**：M3 DoD 要求 Qdrant 语义 + Neo4j 图谱 + 关键词 三路混合检索 + rerank + ACL 物理隔离。改造前仅
`RetrieveSkill` 单路 Qdrant 语义。本轮补全 `rag/` 模块、Neo4j 连接工厂 + 种子图，并回填上轮 path_plan 预留的真实概念依赖拓扑（`nodes/path_plan.py` 的 `graph=None`）。详见 5.2。

**三个关键设计决策**（与 docs/03 参考实现的差异，刻意为之）：
- ACL 用 **dict**（复用 `SkillContext.acl` 的 `should=OR(public/user/tenant)`），不引入 ACLScope、不照抄 docs/03 的 `__NOT__` 伪逻辑。
- 图扩展**不 embed**：图路 Cypher 查相关概念名 → 用概念名走 BM25 命中 chunk，绝不对扩展概念二次 encode（防双模型死锁 + RRF 只用名次不用分数）。
- 三路融合用 **RRF(k=60)** 而非加权分数（cosine/BM25/图间接命中量纲不可比）；rerank 做精排，`weighted_sort` 仅 rerank 不可用时降级兜底（不与 rerank 串联）。

**改动文件清单**：
- 新建 `rag/`（9 模块）：`schemas`(ChunkMeta/RetrievalStrategy/RetrievalResult)、`router`(query_type→选路)、`acl`(build_qdrant_filter + acl_check)、`semantic`、`keyword`(BM25Okapi+jieba 单例)、`graph_retrieval`(Cypher 扩展，不 embed)、`rerank`(CrossEncoder 懒加载单例)、`fusion`(rrf_fuse/fuse_and_dedup/weighted_sort)、`service`(RAGService 七步编排)
- 改现有：`common/db.py`(+`get_neo4j` 单例)、`common/config.py`(+neo4j_user/reranker_model)、`skills/retrieve.py`(`_hybrid_search` 委托 RAGService，契约 100% 不变)、`orchestration/nodes/path_plan.py`(+`_load_concept_graph` 查 Neo4j PREREQUISITE_OF)、`skills/path_plan.py`(`_rule_based_order` +`_topo_order` Kahn 拓扑)、`tests/conftest.py`(守卫加拦 `_get_reranker` + `get_qdrant` 三处绑定)
- 新建脚本：`scripts/ingest_graph.py`(灌种子图，全 MERGE 幂等)

**种子知识图谱**（Neo4j 已灌）：4 Concept（线性回归0.3 / 梯度下降0.4 / 过拟合与正则化0.5 / 神经网络基础0.7）+ 4 PREREQUISITE_OF + 1 RELATED_TO，构成 DAG，拓扑序契合由浅入深。

**验证结果**：
- 单测 **135 passed**（92→135，+43，零回归）：新增 rag_fusion/router/keyword/rerank/graph/service + concept_graph，改 retrieve。
- 活体三路混合（Neo4j + Qdrant 真起、bge-large-zh 真加载）：`routes_used=['semantic','keyword','graph']` **三路全命中**，4 个 public chunk 经 ACL 召回。
- 活体 path_plan 真拓扑：从 Neo4j 加载概念图，输出 **线性回归→{梯度下降, 过拟合}→神经网络** 真实 PREREQUISITE_OF 拓扑序，`depends_on` 跨概念前置正确。
- rerank 真 bge-reranker 精排：**能力已封装 + 单测验证**（mock CrossEncoder 按分降序、≤1 直返、is_available 失败兜底）；真模型活体推理**未跑** —— bge-reranker-v2-m3(~2.3GB) 当前网络经 hf-mirror 仅 ~1MB/min（10min 只下 10MB），数十小时不可行，已停。降级 `weighted_sort` 已活体验证（enable_rerank=false 时三路召回排序正常）。

**降级矩阵**（铁律：绝不假装成功、绝不报错中断）：enable_rag=False→mock；embedding 挂→keyword+graph 仍工作；Neo4j 挂→退两路 + path_plan 启发式；BM25 挂→退两路；reranker 挂→weighted_sort；全路挂→空→RetrieveSkill 退 mock；概念不在图/图有环→拓扑退化启发式。

**本轮新踩的坑**（已并入 memory）：BM25 中文小语料 IDF=0、双模型错峰（gather 只并行召回 rerank 串行）、图扩展不 embed。

### 5.4 ✅ · path_plan 学习路径规划 Agent 节点

**背景**：设计（docs/02 §8）主链路是 `assemble → path_plan → END`，但代码缺 `path_plan`，
`learning_path` 是 assemble 按完成顺序编号的「假路径」（无依赖/无梯度/不可解释）。本轮补全为真路径：
按**教学法 + 画像**排序，每步带「学习目标 + 排序理由」（可解释），**LLM 优先、规则降级**，端到端推前端。

**范围边界**：知识库无依赖元数据、`rag/` 空 → 图谱概念依赖只留接口（skill 入参 `graph`，本轮恒传 `None` → 启发式排序），Neo4j 真依赖留待 6.1。

**改动文件清单（13 个）**：

后端：
- `src/reflexlearn/orchestration/schemas.py` — 新增 `LearningPathStep` / `LearningPathPlan` 两个 Pydantic 模型
- `src/reflexlearn/skills/path_plan.py` — **新增**（244 行）`PathPlanSkill`：LLM 排序 + `_rule_based_order` 规则兜底（教学序权重 doc<mindmap<code<quiz<reading<video，未知 type→99；画像 weak_points 命中提权前置）
- `src/reflexlearn/orchestration/nodes/path_plan.py` — **新增**（81 行）`path_plan_node`：从 `completed` 取 passed，按 task_id join `plan[].spec` 补 concept/difficulty；debate-verdict 容错；**不自增 iteration**；空/无 skill 回退 `_simple_fallback`
- `src/reflexlearn/orchestration/graph.py` — 8 处接线：import、`PathPlanSkill` 实例化、skills 字典、`path_plan_with_skills` 闭包、节点注册、改边 `assemble→path_plan→END`、initial_state 加 2 字段
- `src/reflexlearn/orchestration/state.py` — `AgentState` 加 `path_summary` / `path_strategy`
- `src/reflexlearn/api/routes/chat.py` — 加 `path_plan` 分支，emit `event: learning_path`（steps/summary/strategy）+ 一条 agent_step

前端：
- `frontend/lib/types.ts` — 加 `LearningPathStep` / `LearningPath` 接口
- `frontend/lib/useChat.ts` — 6 处：import、ChatState 加 `path`、Action、initialState 重置、reducer case、SSE switch case `learning_path`
- `frontend/components/LearningPathCard.tsx` — **新增**：渲染有序步骤（sequence/concept/objective/rationale/difficulty 徽标/depends_on）
- `frontend/app/page.tsx` — import + `hasOutput` 加 `|| !!state.path` + cards 前渲染 `<LearningPathCard>`
- `frontend/components/AgentTimeline.tsx` — `STEP_LABEL` 加 `path_plan: "规划学习路径"`

测试：
- `tests/unit/test_path_plan.py` — **新增** 15 测试（规则排序/画像提权/LLM 解析/各类降级/node join/集成图流转）
- `tests/unit/test_assemble.py` — **新增** 1 测试，锁定 assemble 的 bundle + 简单 path fallback 契约（防误删破坏纵深防御）

**验证结果**：
- 单测 92 passed（76→92，零回归）
- 活体降级（无凭证）：6 步路径，教学序 `doc→mindmap→code→quiz→reading→video` 正确，每步含 objective/rationale，sequence 连续
- 前端 `npm run build` 通过（类型检查零错）
- SSE 联调：`event: learning_path` 帧出现，data 含 steps（中文 UTF-8、可解释）

**本轮新踩的坑**（已并入 2.1）：质检阈值 `len>50`（#5/集成测试文本要够长）、后台 cwd（#4）、curl 中文 body 编码（#6）。

### 5.5 ✅ · Reflexion 闭环增强

把空转的「反思学习」修为真正的语义闭环。三处修复：① `_write_qdrant` 不再写 `[0.0]*1024` 零向量 →
`embed_documents` 真实向量化；② `recall_reflections` 从 scroll 拉 N 条改为 `embed_query + query_points`
语义检索 + ACL 下推；③ 补 `enable_rag` kill-switch 门控（写/召回两端，关闭时零模型加载）。
改动：`src/reflexlearn/memory/reflexion.py`（核心）+ `tests/unit/test_reflexion.py`（11 测试）+ `tests/conftest.py`（hermetic 守卫）。降级矩阵纯增强、契约零改动。

---

## 6. 未来待办（优先级排序，精细拆分）

### 6.1 ✅ 已完成（详见 5.2）· 混合检索 + Neo4j 知识图谱

三路混合检索（语义 Qdrant + 关键词 BM25 + 图谱 Neo4j）+ RRF(k=60) + bge-reranker 精排 + ACL 物理隔离已落地并活体验证；path_plan 真实 PREREQUISITE_OF 拓扑回填。详见 5.0。

**后续可选增强**：知识库 md 扩充 → 更多 Concept/边；LLM 自动抽取概念依赖入图；rerank 批处理与缓存优化。

### 6.2 ✅ 已完成（详见 5.1）· 三级记忆完善

L1 上下文工程（TrimStrategy 语义重要性保留 + 递归摘要 summary buffer）+ 多轮会话（Redis session 持久化 + 前端对话式累积 UI）+ MemoryManager 补全（trim/summary/promote）+ gateway 成本感知路由，已落地并活体验证。详见 5.0。

**后续可选增强**：引入真 LLM 凭证验证 summary 真推理；profile 跨 session 缓存（`profile:{uid}:summary`）；promote_session 接入主链路（会话结束自动经验升迁）；Mem0 替换自研 recall（若需更强记忆抽取/去重）。

### 6.3 ✅ 本轮全部完成 · M4 大数据栈 + 多模态视频

- **M4-A 核心写链路** ✅ 本轮（详见 5.0）：上传 API + 多格式解析 + 结构感知分块 + 向量化入库 + documents 登记 + KeywordIndex 失效。
- **M4-B 图谱构建** ✅ 本轮（详见 5.0）：上传链路 LLM 抽取核心概念 + 先修关系 MERGE 入 Neo4j（schema 对齐读侧 ACL：tenant_id+visibility），无 LLM/Neo4j 降级；并入 `ingest_document` 第 6.5 步。
- **M4-C Kafka 增量** ✅ 本轮（详见 5.0）：aiokafka 生产/消费，`enable_kafka` 开关，broker 不可用降级同步链路；事件经 `knowledge.changes`，消费进程 `scripts/kafka_consumer.py` 复用 `ingest_document`。
- **M4-D Spark/MinIO 批处理** ✅ 本轮（详见 5.0）：MinIO 原始存储（minio 已装）+ clean 纯函数 + 三级 runner（Spark local[*]→pandas→纯 Python，pyspark/pandas 缺降级纯 Python）；批清洗脚本 `scripts/run_clean.py`。
- **M4-E 多模态视频** ✅ 本轮（详见 5.0）：SeeDance 异步作业（asyncio）+ JobStore Redis 降级内存 + 轮询 API（提交/查询）+ storyboard 占位降级。
- **M4-F 前端上传可视化** ✅ 本轮（详见 5.0）：折叠工具区 = 拖拽上传（chunks/embedded/图谱面板 + 降级标注）+ 视频卡（提交 storyboard → 2s 轮询）；npm run build 类型检查零错。

见 docs/00 §6、docs/04。

### 6.4 🚧 已启动 · M5 评测 + 消融 + 微调

- **M5-A 评测最小闭环** ✅：默认 ML 评测集 + 规则 judge + EvalRunner + `scripts/run_eval.py` 已落地；`bash scripts/run_eval.sh --max-cases 2 --timeout 12 --strategy full-smoke` 通过。
- **M5-B LLM-as-a-judge + Markdown 报告** ✅：`LLMJudge` 接入 `LLMGateway.complete(..., task_type="judgment")`，无 key/异常自动降级规则 judge；脚本生成 `logs/eval_report.json` + `logs/eval_report.md`。
- **M5-C 消融对比基础设施** ✅：增加 strategy profile（full-smoke / no_rag / no_reflexion / single_agent_baseline）、环境切换、对比报告；`bash scripts/run_eval.sh --compare --max-cases 2 --timeout 12` 通过。
- **M5-C2 / S2-T2 真实评测入口** 🚧：已补 `ablation` / `rag_required` / `reflexion_required` 评测切片、`--tags` 过滤、`resource_coverage` 指标、controlled RAG/Reflexion 受控上限基线，以及 `--real` / `run_real_eval.sh` / `real_full` / `real_no_rag` / `real_no_reflexion`；`real_no_rag` 小样本真实 LLM judge 已跑通并优于单 Agent baseline，`real_full` 仍待稳定 RAG 服务环境和人工抽检。
- **M5-D 正式评测报告沉淀** ✅：已新增 `docs/08-评测报告与消融结果.md`，沉淀当前评测集、指标、命令、结果、限制和下一步。
- **M5-E LoRA** ⬜：仍按原规划作为可选加强项；没有 GPU/训练数据前不抢主线。

**当前风险**：规则 judge 只能做 smoke 和趋势指标，不能替代最终 LLM-as-a-judge / 人工抽检；当前消融是管线 smoke，默认策略为保速度关闭慢依赖，尚不能作为最终创新性论据；主对话长链路虽在 eval smoke 中未复现，但 `/api/chat` 端到端长耗时仍需单独排查。

**📋 剩余活体验证派工清单（接手「完善」从这里开工）**：阶段二代码侧已收口，剩余 6% **全是活体验证**，卡在 **Docker（bash 不可达）/ PyPI（网络超时）两个环境根因**上。已拆成可直接领取的 **V0–V5 验证卡**（V0 固化成果 / V1 Grafana 活体 / V2 `real_full` 真实 RAG+Reflexion 消融 / V3 记忆 Redis·Qdrant 活体 / V4 MCP SDK 联调 / V5 人工抽检+`docs/08`），含解锁前置、可复制命令与 DoD，见 **`docs/13-阶段二收尾活体验证派工书.md`**。

### 6.5 📋 下一阶段发展计划（四阶段 · 主线=阶段二）

> 2026-06-08 与用户确认；详细版见 `docs/11-发展路线图.md`，此处只留执行态摘要。
> 排序说明：docs/10 §7 原建议「安全优先」，本轮经用户拍板改为「演示拿分优先」——阶段二（创新深度）提为当前主线，阶段一（安全闭环）顺延但**不降级、不丢弃**。阶段二作业期间不得引入新的多用户暴露面（不新增可被越权访问的对象级数据通路）。

**🆕 主线升级（2026-06-08 与用户共创）**：阶段二已收尾至 ~99%，主线升级为「**自进化学习平台**」长期演进——**自进化飞轮**（记忆进化 / 元认知 / 协作深化 / LoRA 闭环）为内核、**灵动玻璃工作台**为门面、**多租户安全**为底座；新增里程碑 **M7 自进化飞轮 / M8 学习平台产品化 / M9 多用户安全上线**。下方四阶段被重新编织为演进波次（安全=底座、前端=门面、LoRA/爬虫=波次 3/砍单尾）。**完整蓝图见 `docs/14-下一阶段升级蓝图.md`，接手下一阶段从那里开工。**

- **阶段一 · P0 安全合规闭环**（多用户上线硬门槛，docs/10 §7 列最高优先级）：对象级权限归属校验 → AI Safety Gateway（输入/输出审核 + 审计）→ 上传隔离区/扫描/签名 URL/防盗链 → DB 用户体系 + HttpOnly Cookie + CSRF + 登录限流。
- **阶段二 · 创新深度补全** 🎯 **当前主线**（直对比赛「技术质量 + 创新性」评分项；4 张可派工任务卡见 `docs/12-阶段二任务派工书.md`）：
  1. 可观测落地 ✅ 代码完成——`observability/` 已落地 Prometheus `/metrics`，覆盖 HTTP/Agent/LLM/RAG/Video/Degradation 指标；Grafana provisioning/dashboard 与 observe 脚本已落地，Docker 环境活体验证待补。
  2. M5 真实评测结论 🚧 入口完成——`run_real_eval.sh` / `--real` / 真实策略 profile / Judge 来源标记已落地；下一步带 LLM key 跑真实 LLM-as-a-judge + 真实 RAG/Reflexion 消融 + 人工抽检，把「管线 smoke」升级为「可信论据」。
  3. MCP 工具暴露 ✅ 基础适配完成——`mcp_tools.server` 默认暴露 retrieve/doc_gen/quiz_gen；真实 MCP SDK 安装和客户端联调因 PyPI 网络超时待补。
  4. 记忆深度 ✅ 代码完成——profile 跨会话沉淀、`run_session` profile 读写、`enable_promote` 会话经验升迁接线已完成。
- **阶段三 · 前端产品化 + M6 包装**：前端 45% → 工作台（会话列表/知识库列表/资源库/管理台/系统状态）；M6 演示视频 ≤7min + PPT + 部署/测试/开发文档 + AI Coding 标注；代码健康首轮已完成（测试目录分层、`path_plan.py`/`gateway.py` 拆分），后续继续清理超长测试文件和前端产品化债务。
- **阶段四 · P2 锦上添花**：LoRA 微调（M5-E，需 GPU）、分布式爬虫、实时增量链路加强。砍单从阶段四往上砍，**P0（阶段一）永不砍**。

**已知技术债（落点）**：`mcp_tools/` 已有基础适配但缺真实 SDK/客户端联调；`observability/` 已有 Prometheus 指标和 Grafana provisioning，但 Docker/Grafana 活体展示与 LangSmith/OTel trace 待补；真实评测 `real_no_rag` 60s 小样本已通，`real_full` 当前会因 Qdrant/知识库不可用输出 `rag_preflight_failed`，需在稳定 RAG 服务环境重跑。

---

## 7. 关键架构事实（接管必读）

**主链路（LangGraph，build_graph in `orchestration/graph.py`）**：
```
START → profile → recall → planner → [gate 路由]
         ├─ central:  generate_resource (fan-out 并行) → critic → (replan 回 planner | 继续)
         ├─ pipeline: pipeline (串行多步)
         └─ debate:   debate → judge
       → assemble → path_plan → END
```
- 每个节点被 `harness_guard` 包裹（iteration/token 闸门，超限则跳过节点原样返回）。
- `learning_path` 等**非 reducer 字段**：后写覆盖前写（path_plan 覆盖 assemble 的兜底）。
- `completed` 是 `Annotated[..., add]` reducer：fan-out 各分支结果自动汇聚。

**降级哲学（全项目铁律）**：**绝不假装成功、绝不报错中断**。无 LLM 凭证→`gateway.complete` 抛
`RuntimeError("llm_no_api_key")`，各节点/skill 捕获走本地 fallback（规则规划、离线占位、规则排序）。
DB/模型不可用→try/except 降级。每个新功能必须配降级矩阵。

**契约边界（改动勿破坏）**：节点返回 dict 合并进 state；skill 返回 `SkillResult(ok, data)`；
质检 `quality_check._rule_check` = `len(content)>50`；`assemble_node` 保持不动（path_plan 的纵深兜底）。

---

## 8. 测试与验证基线

- **单测**：`tests/unit` 根目录 1 个 Python 测试文件，递归共 50+ 个 Python 测试文件，**484 passed, 2 warnings**（2026-06-10 RunFix 后更新；W2 基线 400 + W3-0 边界 4 + W3-A 15 + W3-B 19 + W3-C safety 15 + W3-D upload/signed_url 12 + W3-E training 12 + RunFix 降级 7），hermetic（conftest 拦 `_get_model`/`_get_reranker`/`get_qdrant`，**不拦 `get_redis`/`get_pg_pool`/`get_neo4j`** → 多轮/写链路测试须在封装层 mock 或**注入假对象**，绝不让被测函数内自取 pg/redis）。新功能必须配单测 + 降级测试。
- **活体验证套路**：无凭证跑 `run_session()` 验证降级路径；带 RAG 后端 curl SSE 验证端到端帧。临时脚本放 `scripts/_verify_*.py`，验完即删。
- **零回归原则**：集成测试抓 assemble 帧、不断言图终止点；新增 state 字段用 `.get()` 读，不破坏手构 state 的测试。
