# ReflexLearn

> A self-evolving multi-agent learning system for turning a learning goal into a verified, adaptive resource plan.

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-orchestration-111827)](https://langchain-ai.github.io/langgraph/)
[![CI](https://github.com/Yukibei/reflexlearn/actions/workflows/ci.yml/badge.svg)](https://github.com/Yukibei/reflexlearn/actions/workflows/ci.yml)`r`n[![Tests](https://img.shields.io/badge/tests-650%20passed%20%7C%204%20skipped-2ea44f)](./scripts/test_unit.sh)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**Demo status:** runnable end-to-end prototype · **Primary focus:** agent orchestration, RAG quality, evaluation and recovery

### Why this project exists

Most agent demos stop after the first generated answer. ReflexLearn treats generation as a workflow that must be inspected, scored and improved: profile the learner, retrieve evidence, plan resources, generate, run quality gates, reflect on failures, and assemble an adaptive path.

### See it in one minute

| Evidence | What to inspect |
| --- | --- |
| [Pipeline walkthrough](./reflexlearn-e2e-pipeline.png) | Stage-by-stage orchestration and intermediate state |
| [Debate result](./reflexlearn-e2e-debate.png) | Critic / debate / judge quality loop |
| [Video task](./reflexlearn-e2e-video.png) | Long-running task and degraded-mode handling |
| [Evaluation notes](./docs/08-评测报告与消融结果.md) | Baseline comparison and known sample-size limits |

The project is deliberately honest about its maturity: it is a strong engineering prototype with a real frontend, security guards, integration scripts and evaluation hooks, not a claim of production readiness.

ReflexLearn 是一个面向“自进化学习资源生成”的多智能体系统原型。它围绕学习目标输入，完成学习画像构建、资源规划、检索增强生成、质量验收、反思重规划、辩论裁决、学习路径生成和前端交互展示。

当前项目已具备可演示的端到端闭环，但仍处于原型到产品化之间的阶段：P0 最小安全底座已经落地，真正的生产级用户体系、对象级权限、内容审核网关、上传隔离区和部署流水线还需要继续补强。

LLM 可使用 DeepSeek、Qwen、Anthropic，或 OpenAI-compatible 中转站。中转站配置项为 `OPENAI_COMPAT_API_KEY`、`OPENAI_COMPAT_BASE_URL`、`OPENAI_COMPAT_MODEL`、`OPENAI_COMPAT_WIRE_API`；timicc 当前使用 `responses` 协议。

## 核心能力

- 多智能体编排：基于 LangGraph 串联 profile、recall、planner、generator、gate、critic、debate、judge、assemble、path_plan 等节点。
- 多类型学习资源生成：支持文档、测验、思维导图、代码示例、相关阅读、视频脚本等资源任务。
- RAG 与记忆：包含关键词检索、语义检索、图谱检索、融合排序、短期会话记忆和反思记忆的实现。
- 质量闭环：生成结果经过 gate 质量验收；失败时进入 critic 归因和重规划，冲突时可进入 debate/judge。
- 数据工程底座：支持文件解析、清洗、分块、向量写入、图谱构建、Kafka 事件和对象存储的分层实现。
- 前端演示台：Next.js 15.4、React 19、Tailwind CSS v4，提供登录门禁、聊天流式输出、资源卡片、知识上传和视频任务入口。
- P0 安全底座：后端演示登录、HMAC Bearer token、受保护 API、生产安全开关、CORS 白名单、上传大小/扩展名/MIME/魔数校验。

## 技术栈

- 后端：Python 3.11+、FastAPI、Pydantic v2、LangGraph、LiteLLM、Redis、Qdrant、PostgreSQL、Neo4j、Kafka。
- 前端：Next.js 15.4、React 19、TypeScript、Tailwind CSS v4。
- 工程化：uv、Docker Compose、统一 `scripts/*.sh` 启停脚本、`logs/` 文件日志、pytest 单元测试。

## 快速启动

所有运行、调试、测试操作都应通过 `scripts/` 下的脚本完成。

1. 复制环境变量：

```bash
cp .env.example .env
```

2. 启动核心中间件：

```bash
bash scripts/start_core.sh
```

3. 初始化数据库和知识库：

```bash
bash scripts/init_all.sh
```

4. 启动 API：

```bash
bash scripts/start_api.sh
```

5. 启动前端：

```bash
bash scripts/start_frontend.sh
```

6. 打开前端：

```text
http://127.0.0.1:23002
```

端口由 `.env` 的 `API_PORT` / `FRONTEND_PORT` 统一驱动（本机多项目共存，已整体迁到 2xxxx 段），
脚本第一个位置参数可临时覆盖。前端一律走相对 `/api`，由 Next rewrites 代理到后端——
不要改回绝对地址，否则 HttpOnly 会话 cookie 会因跨站而丢失。

默认演示账号来自 `.env.example`：

```text
用户名：admin
密码：reflexlearn-admin
```

## 常用脚本

```bash
bash scripts/start_core.sh
bash scripts/start_graph.sh
bash scripts/start_bigdata.sh
bash scripts/start_full.sh
bash scripts/start_api.sh
bash scripts/start_frontend.sh
bash scripts/check_api.sh
bash scripts/check_api_security.sh
bash scripts/check_api_integrations.sh
bash scripts/check_bigdata.sh
bash scripts/run_eval.sh --compare --tags ablation --max-cases 2 --timeout 12
bash scripts/run_real_eval.sh --tags ablation,rag_required --strategies real_full,real_no_rag,single_agent_baseline --max-cases 1 --timeout 180
bash scripts/run_real_eval.sh --strategies controlled_rag,controlled_reflexion,single_agent_baseline --max-cases 0 --timeout 25
bash scripts/build_frontend.sh
bash scripts/test_unit.sh
bash scripts/stop_api.sh
bash scripts/stop_frontend.sh
bash scripts/stop_all.sh
```

`check_api.sh` 是安全冒烟入口；涉及 Qdrant/PostgreSQL 真写入的检查请单独运行 `check_api_integrations.sh`。

## 目录说明

```text
src/reflexlearn/api/              FastAPI 应用、路由、鉴权依赖、上传校验
src/reflexlearn/common/           配置、日志、数据库、认证、embedding 公共能力
src/reflexlearn/orchestration/    LangGraph 多智能体编排和节点
src/reflexlearn/skills/           各类学习资源生成技能
src/reflexlearn/rag/              检索、融合、重排和 ACL 过滤
src/reflexlearn/memory/           会话记忆、递归摘要、反思记忆
src/reflexlearn/data_engineering/ 数据解析、清洗、分块、入库、图谱构建、Kafka
src/reflexlearn/eval/             评测集、评测策略、报告生成
frontend/                         Next.js 前端演示台
scripts/                          统一运行、调试、测试脚本
docs/                             正式设计文档
discuss/                          计划、评审、阶段路线讨论文档
```

## Current verification snapshot

最近一次本地验证结果（以仓库脚本输出为准）：

- `bash scripts/test_unit.sh`：650 passed, 4 skipped（GitHub Actions CI）。
- `bash scripts/build_frontend.sh`：通过。
- `bash -n scripts/*.sh`：通过。
- `bash scripts/check_api_security.sh`：通过。
- `bash scripts/check_bigdata.sh`：通过，Kafka produce/consume + MinIO put/get/remove。
- `bash scripts/check_observe.sh 8003`：通过，Prometheus `/metrics` 可抓取。
- `bash scripts/check_api_integrations.sh 8003`：通过，知识上传真实写 Qdrant/PG，视频任务 degraded。
- `bash scripts/check_llm.sh`：OpenAI-compatible timicc /responses 中转通过，返回合法 JSON。
- `bash scripts/run_eval.sh --compare --tags ablation,rag_required --strategies controlled_rag,single_agent_baseline --max-cases 1 --timeout 45`：通过，`controlled_rag overall=0.4967`，`single_agent_baseline overall=0.1800`，当前 Judge 来源为 `LLM 或混合`。
- `bash scripts/run_real_eval.sh --tags ablation,rag_required --strategies real_full,real_no_rag,single_agent_baseline --max-cases 1 --timeout 180`：通过，`real_full overall=0.6900`，`real_no_rag overall=0.5467`，`single_agent_baseline overall=0.2000`。

这些数字用于说明评测链路可以运行，不代表最终论文结论；真实 RAG 目前仍是小样本，欢迎贡献更多 case、人工标注和可重复的消融实验。

## 已知限制

- 当前登录是演示账号和 HMAC token，不是数据库用户体系。
- 多轮会话已按用户/租户派生内部会话 key；仍需继续补审计、会话管理页和服务端会话撤销能力。
- 上传已有基础 guard，但还没有隔离区、病毒扫描、内容审核、签名 URL、防盗链和对象级访问控制。
- AI 输入输出还没有统一 Safety Gateway，不能把提示词限制视为安全边界。
- 视频任务和知识资源仍需补对象归属校验、审计日志和更细粒度权限。
- 真实 RAG 目前已有 1 条 case 小样本结论；仍需扩大样本、补人工抽检和真实 Reflexion 消融，不能把小样本当最终统计结论。
- 前端仍是演示台形态，距离成熟产品的信息架构、导航、数据管理和异常恢复还有差距。

## 文档入口

- [项目蓝图与里程碑](docs/00-项目蓝图与里程碑.md)
- [系统架构与数据流](docs/01-系统架构与数据流.md)
- [Agent 编排层详细设计](docs/02-Agent编排层详细设计.md)
- [记忆与 RAG 详细设计](docs/03-记忆与RAG详细设计.md)
- [数据工程底座详细设计](docs/04-数据工程底座详细设计.md)
- [LLM 网关与 MCP 工具详细设计](docs/05-LLM网关与MCP工具详细设计.md)
- [评测与可观测详细设计](docs/06-评测与可观测详细设计.md)
- [工程化与目录结构详细设计](docs/07-工程化与目录结构详细设计.md)
- [评测报告与消融结果](docs/08-评测报告与消融结果.md)
- [启动与发布说明](docs/09-启动与发布说明.md)
- [开发进度与交接审查说明](docs/10-开发进度与交接审查说明.md)
- [发展路线图](docs/11-发展路线图.md)
- [阶段二任务派工书](docs/12-阶段二任务派工书.md)

## Contributing

欢迎从小而完整的改进开始：

1. 先阅读 [贡献指南](CONTRIBUTING.md) 和对应模块文档。
2. 新行为请附测试或可复现脚本；评测改动请说明数据集、策略和限制。
3. 一个 PR 只解决一个问题，并在描述中写清动机、验证命令和已知风险。
4. 安全问题请不要公开提交 issue，先通过 GitHub Security Advisories 联系维护者。

适合第一次参与的方向：补充英文文档、完善示例数据、扩展评测 case、修复边界条件测试。

## License

尚未选择正式开源许可证。当前仓库内容默认保留版权；在许可证确定前，请不要将代码作为依赖分发。

## GitHub 发布与后续更新

仓库推送到 GitHub 后，后续升级按正常 Git 流程同步：

```bash
git pull
git add <changed-files>
git commit -m "更新说明"
git push
```

仓库已配置 GitHub Actions CI：每次推送和 Pull Request 会自动安装依赖、执行单元测试、校验脚本语法并运行 Ruff 源码检查。CI 通过代表代码质量门禁通过，不等同于生产环境部署。
