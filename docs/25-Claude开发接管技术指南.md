# 25 · Claude 开发接管技术指南

更新时间：2026-08-11  
适用对象：接手 ReflexLearn 后续开发的 Claude / Claude Code  
文档定位：当前代码状态、开发约束、运行方式、核心链路和接管顺序的单一交接入口

## 1. 接管前必须先知道的事实

ReflexLearn 是一个面向个性化学习的多智能体系统，目前处于“可演示原型向产品化工作台演进”的阶段，不是生产完成态。

当前 Git 状态非常重要：

- 分支：`main`
- 本地与远端共同基线：`362abe5 工程收口先把可用性落到可验证基线`
- 工作区存在大规模未提交修改：约 94 个已跟踪文件变化，另有多批新增文件
- 这些修改包含最近完成的工作台视觉重构、AI 导师、牛牛学伴、目标 CRUD、聊天滚动、AI CSS 风格组件、生产部署脚本等

接手后的第一条规则：

> 不得执行 `git reset --hard`、`git checkout -- .`、批量覆盖、自动格式化全仓或未经确认的 pull/rebase。先阅读并保护当前工作区，再讨论如何分批提交。

建议首次进入仓库立即执行：

```bash
git status --short
git diff --stat
git log -8 --oneline --decorate
```

## 2. 项目目标与产品边界

产品目标是构建一个真正的 1 对 1 AI 学习导师：

1. 理解学生的目标、知识基础、偏好和薄弱点。
2. 通过多智能体协作完成诊断、规划、资源生成、质检、反思和路径编排。
3. 把对话产物沉淀为学习目标、路径、资源、错题、画像和成长证据。
4. 让用户能看见系统为什么推荐、当前学到哪里、下一步做什么。

禁止把功能做成静态演示：按钮必须连接真实路由或真实 API；不存在后端能力时，应明确显示“尚未接通”，不能伪造成功状态、假搜索结果、假未读数或假视频。

## 3. 强制开发规则

仓库根规则来自用户提供的 `AGENTS.md` 指令，接管时必须继续遵守：

- 永远使用简体中文沟通和编写项目文档。
- 正式文档写入 `docs/`，讨论方案写入 `discuss/`。
- React 固定使用 19，Next.js 固定使用 15.4，Tailwind CSS 固定使用 v4。
- Python 固定使用 3.11+、`.venv` 和 `uv`，不得使用 pip/poetry/conda。
- 所有 Run & Debug 必须通过 `scripts/*.sh`，不得直接运行 npm、uvicorn、python 或 Next.js。
- 日志必须写入 `logs/`。
- 动态语言文件尽量不超过 300 行，每层目录尽量不超过 8 个文件。
- 发现根因后直接修正源头，不叠加兼容补丁、临时开关、复制逻辑或假 fallback。
- 优先复用现有依赖，不无理由新增包。
- 不自动运行完整构建和测试，除非用户明确要求；日常改动只做与风险匹配的检查。

## 4. 技术栈

### 4.1 后端

- Python 3.11+
- FastAPI + Uvicorn
- Pydantic v2
- LangGraph + LangChain Core
- LiteLLM / OpenAI-compatible LLM 网关
- PostgreSQL、Redis、Qdrant、Neo4j
- 可选 Kafka、MinIO、Prometheus、Grafana
- pytest、pytest-asyncio、ruff

依赖定义：`pyproject.toml`，锁文件：`uv.lock`。

### 4.2 前端

- Next.js `15.4.11`
- React / React DOM `19.2.7`
- TypeScript
- Tailwind CSS `4.3.0`
- Framer Motion
- Radix UI
- Lucide React
- `use-stick-to-bottom`
- Markdown、KaTeX、Mermaid、Shiki

依赖定义：`frontend/package.json`，锁文件：`frontend/package-lock.json`。

## 5. 目录与模块边界

```text
src/reflexlearn/api/              FastAPI 装配、鉴权、中间件和路由
src/reflexlearn/orchestration/    LangGraph 主图、状态、节点和会话持久化
src/reflexlearn/skills/           文档、练习、代码、阅读、视频、路径等原子能力
src/reflexlearn/rag/              混合检索、融合排序、reranker 和 ACL
src/reflexlearn/memory/           多轮会话、摘要、画像和反思记忆
src/reflexlearn/learning/         目标、路径、资源、错题、画像等学习领域逻辑
src/reflexlearn/data_engineering/ 解析、清洗、分块、向量和图谱写入
src/reflexlearn/eval/             评测策略、Judge、报告和消融实验
frontend/app/                     Next.js App Router 页面
frontend/components/              业务组件和工作台 UI
frontend/lib/                     API 客户端、类型、Hooks 和前端领域逻辑
scripts/                          唯一允许的启停、初始化、检查、测试入口
logs/                             API、前端、检查和评测日志
docs/                             正式稳定文档
discuss/                          方案讨论和评审记录
```

关键入口：

- 后端应用：`src/reflexlearn/main.py` → `src/reflexlearn/api/app.py`
- 聊天 SSE：`src/reflexlearn/api/routes/chat.py`
- 多智能体图：`src/reflexlearn/orchestration/graph.py`
- 前端认证布局：`frontend/app/(app)/layout.tsx`
- AI 导师工作区：`frontend/components/chat/TutorStudio.tsx`
- 聊天状态机：`frontend/lib/useChat.ts`
- 主对话视图：`frontend/app/_components/Workspace.tsx`
- 学习空间领域：`src/reflexlearn/learning/spaces.py`

## 6. 本地运行方式

### 6.1 端口约定

| 服务 | 默认地址 |
|---|---|
| 前端 | `http://127.0.0.1:3002` |
| API | `http://127.0.0.1:8000` |
| PostgreSQL | `127.0.0.1:25432` |
| Redis | `127.0.0.1:26379` |
| Qdrant HTTP | `http://127.0.0.1:26333` |
| Neo4j Bolt | `bolt://127.0.0.1:27687` |

前端必须使用相对地址 `/api`，由 Next.js rewrite 转发到 `BACKEND_ORIGIN`。不要改回浏览器直接跨域请求，否则 HttpOnly 会话 Cookie 在 localhost/127.0.0.1 组合下容易丢失。

### 6.2 标准启动顺序

```bash
bash scripts/start_core.sh
bash scripts/init_all.sh
bash scripts/start_api.sh 8000
bash scripts/start_frontend.sh 3002 /api http://127.0.0.1:8000
```

`init_all.sh` 用于首次初始化或明确需要重建基础数据时，不应每次启动都盲目执行。

停止服务：

```bash
bash scripts/stop_frontend.sh 3002
bash scripts/stop_api.sh 8000
bash scripts/stop_all.sh
```

日志：

```text
logs/start_frontend.log
logs/start_api.log
logs/api.log
logs/init_all.log
```

2026-08-11 交接快照：3002 和 8000 有监听；当时 ReflexLearn 自身的 PostgreSQL、Redis、Qdrant、Neo4j Docker 容器未在 `docker ps` 中出现。接手者必须重新确认依赖，不得因 API 端口存在就假定完整数据链路可用。

## 7. 核心运行链路

### 7.1 认证

前端通过 `/api/auth/login` 获取 HttpOnly 会话 Cookie。后端受保护路由统一依赖 `get_current_user`，Cookie 优先，Bearer Token 仅作为开发/脚本兼容入口。

生产环境会拒绝关闭鉴权、默认密钥和默认演示密码。不要绕开现有认证中间件自行传 `user_id`。

### 7.2 AI 导师对话

```text
用户输入
→ POST /api/chat
→ SSE session / agent_step / resource_delta / resource_card
→ debate_round / judge_verdict / learning_path / assistant_message
→ done
```

前端 `useChat.ts` 负责 SSE 解析、轮次状态、停止生成和会话 SID；`Workspace.tsx` 负责渲染思考过程、资源、辩论、路径和助手文本。

问候语 `hi/hello/你好` 等已在 `orchestration/intent.py` 做轻量分流，只返回简短助手消息，不应启动完整资源规划，也不应自动创建学习目标。

具体学习请求进入 LangGraph：

```text
profile → recall → planner
→ generate_resource 或 pipeline
→ gate
→ critic / debate + judge / metacognition / assemble
→ path_plan → END
```

只有存在真实资源或路径产物时，`chat.py` 才通过 `SpaceStore.save_session_outcome` 沉淀学习空间。

### 7.3 学习目标与空间

当前已经接通真实 CRUD：

- `POST /api/spaces`：创建目标
- `GET /api/spaces`：列表
- `GET /api/spaces/{id}/detail`：详情
- `PATCH /api/spaces/{id}`：修改标题/课程
- `DELETE /api/spaces/{id}`：删除目标及关联路径、资源、任务记录

前端详情页通过 `SpaceGoalActions.tsx` 提供编辑和二次确认删除。新增、列表、修改、删除必须继续共用 `SpaceStore`，不要重新拆出第二套内存状态。

### 7.4 资源发现

`POST /api/resources/discover` 使用现有资源发现链路：

- B 站搜索：配置允许时走真实搜索，失败时明确 degraded。
- 官方文档：Web 技术主题可走 MDN 真实搜索。
- OER 等其他来源存在静态候选或降级路径。

AI 导师中的“推荐学习资源”调用同一个真实接口。AI CSS 网站的 Web Search 组件属于付费源码，项目没有授权 Token，因此没有复制其源码；当前只借鉴交互思想，并使用项目自己的真实搜索 UI。

### 7.5 数据降级原则

PostgreSQL、Redis、Qdrant、Neo4j 或外部搜索不可用时，代码通常选择不中断主链路并返回 `degraded`。降级必须诚实：

- 内存兜底仅适用于单进程开发，不保证多 worker 一致性。
- 静态候选不能标记成“实时搜索成功”。
- 视频无真实生成凭证时只能展示 storyboard/degraded，不能宣称生成了真实视频。
- API 返回成功前必须确认数据确实落库。

## 8. 前端信息架构

| 路由 | 功能 |
|---|---|
| `/` | 公开产品首页 |
| `/today` | 登录后今日学习驾驶舱 |
| `/chat` | AI 学习导师、思考过程、Todo 路径和资源工具 |
| `/spaces` | 学习目标/空间列表与创建 |
| `/spaces/[id]` | 目标详情、编辑、删除、路径和资源 |
| `/plan` | 当前学习路径、节点完成和下一步行动 |
| `/resources` | 资源发现、保存和资源库 |
| `/resources/[id]` | 资源详情和学习状态回写 |
| `/knowledge` | 私有资料上传与知识库 |
| `/mistakes` | 错题记录、复盘、反思和补救路径 |
| `/profile` | 学习画像和证据 |
| `/growth` | 成长档案和学习行为趋势 |

工作台采用 Sofia Pro、暖灰玻璃面板、黄色强调色和顶部浮动导航。后续页面应延续当前视觉语言，不要重新引入紫色 AI 渐变、通用后台侧栏或大面积无意义卡片。

顶部入口的真实语义：

- “学习画像”和头像均进入 `/profile`。
- 动态图标进入 `/growth`，当前没有真实未读系统，因此不得恢复固定黄色未读点。
- 退出按钮调用真实登出。
- `RouteProgress.tsx` 在内部导航点击时显示顶部进度条。

## 9. 最近一轮尚未提交的主要改动

1. 登录后全页面改造成统一暖灰/黄色工作台风格。
2. 牛牛学习学伴恢复透明背景、缩小尺寸和页面漫游行为。
3. AI 导师改成双栏工作室：左侧对话，右侧导师状态和学习产物。
4. 聊天区改用 `use-stick-to-bottom`，修复嵌套滚动和流式内容锁死。
5. 引入 AI CSS 免费组件思想：Thinking + Reasoning、Todo Task List；资源和辩论默认紧凑折叠。
6. AI 导师资源按钮接入真实资源发现接口。
7. `hi` 等问候不再生成整套资源和学习路线。
8. 学习目标补齐真实修改和删除链路。
9. 路径页取消嵌套滚动和 Grid 等高拉伸，修复底部不可达和大片留白。
10. 添加全局页面跳转进度反馈。
11. 新增前端生产 Dockerfile、Compose、打包和部署脚本，但尚未做最终生产验收。

## 10. 当前已知风险与待验证事项

### 10.1 工作区未提交

这是当前最高风险。应先按功能域审查 diff，再由用户决定提交粒度。不要把全部变化压成一个无法审查的大提交，也不要擅自丢弃用户已有修改。

### 10.2 最近改动未跑完整回归

用户此前明确要求不要自动反复构建测试，因此最近一轮只做了：

- Next.js 热更新编译
- `/chat`、`/plan`、`/spaces` HTTP 200
- API 重启和路由装配检查
- `git diff --check`

尚未在最新工作区执行完整 `scripts/test_unit.sh` 和 `scripts/build_frontend.sh`。如用户授权自动测试，优先补这一轮基线。

### 10.3 目标 CRUD 需要登录态活体验证

PATCH/DELETE 路由已加载并受认证保护，但交接前没有实际删除用户数据做端到端验证。应使用演示账号创建临时目标，验证新增→修改→删除→列表消失，再清理临时数据。

### 10.4 对话意图仍是最小实现

当前只对明确问候做直接响应。模糊输入、闲聊、澄清问题和真正的学习任务还没有完整意图分类器。下一步应设计“问候 / 澄清 / 普通问答 / 资源生成 / 路径规划 / 操作命令”意图，而不是继续在 `chat.py` 叠字符串特判。

### 10.5 文件和目录规模

- `src/reflexlearn/learning/spaces.py` 当前约 322 行，仍超过 300 行建议线，应继续把持久化聚合职责拆出。
- `src/reflexlearn/api/routes/workspace.py` 约 281 行，接近上限，新增资源接口前应先按领域拆路由。
- 多个前端组件目录已接近或超过每层 8 文件，需要按 `chat/agent-ui/workspace/spaces` 的领域边界继续整理。

### 10.6 模型预热

API 启动会后台预热 embedding 和 reranker。日志可能出现 Hugging Face 未认证请求、404 探测和较长模型加载时间。不要把这些请求误判为 API 启动失败；应以 `/api/health` 和最终 warmup 日志判断。但生产环境应固定模型缓存和离线策略，避免启动时依赖公网。

### 10.7 跳转进度条

当前进度条通过捕获站内链接点击并监听 pathname 完成，常规页面跳转可用。仅查询参数变化、编程式 `router.push` 和失败导航仍需专项验证，必要时统一封装导航入口，不要继续散落监听器。

## 11. Claude 接手后的推荐顺序

### 第一步：保护现场

1. 阅读本文件、`README.md`、`docs/21`、`docs/22` 和 `PROGRESS.md`。
2. 运行 `git status --short`、`git diff --stat`。
3. 不修改前先按前端、后端、脚本、部署四组阅读 diff。
4. 与用户确认是否先建立“当前工作区基线提交”。

### 第二步：恢复完整本地环境

1. 检查 Docker Desktop。
2. 通过 `scripts/start_core.sh` 启动本项目中间件。
3. 检查 `.env`，不要输出密钥。
4. 通过脚本启动 API 和前端。
5. 查看 `logs/start_api.log` 与 `logs/start_frontend.log`。

### 第三步：做最小活体检查

1. 登录、登出和刷新会话。
2. `/chat` 输入 `hi`，确认只返回问候。
3. 输入明确学习目标，确认思考、资源、路径和滚动行为。
4. 点击“推荐学习资源”，确认真实来源和 degraded 表达。
5. 创建临时目标，完成修改和删除闭环。
6. `/plan` 滚动到底部，确认节点完整可达且无拉伸空白。
7. 点击顶部导航，确认立即出现进度反馈。

### 第四步：再开始新功能

新需求必须先判断属于哪条业务链，优先修改单一事实源：

- 对话事件：`chat.py` + `useChat.ts`
- 路径：`path_ops.py` / `plan.py` + `PlanTimeline.tsx`
- 目标空间：`spaces.py` / `workspace.py` + `spacesApi.ts`
- 资源：`resource_discovery.py` / `resource_detail.py` + resource 组件
- 画像：`profile.py` / `profile_history.py` + profile 组件
- Today 聚合：`today.py` + `todayApi.ts`

## 12. 检查命令

除非用户要求自动验证，不要一次性全部运行。按变更风险选择：

```bash
# 启停与健康
bash scripts/start_core.sh
bash scripts/start_api.sh 8000
bash scripts/start_frontend.sh 3002 /api http://127.0.0.1:8000
bash scripts/check_api.sh 8000

# 用户授权后再运行
bash scripts/test_unit.sh
bash scripts/build_frontend.sh /api http://127.0.0.1:8000
bash scripts/check_api_security.sh 8000
bash scripts/check_api_integrations.sh 8000
```

修改后至少执行与文件范围对应的 `git diff --check -- <files>`，并检查日志是否出现类型错误、导入错误或未捕获异常。

## 13. 可直接交给 Claude 的开场提示词

```text
你现在接管 D:\2026\multagent 的 ReflexLearn 项目。

先完整阅读根目录开发规则、docs/25-Claude开发接管技术指南.md、README.md、
docs/21-AI导师学习系统产品化开发文档.md 和 PROGRESS.md。

当前 main/origin/main 停在 362abe5，但工作区有大规模未提交修改。禁止 reset、checkout 覆盖、
自动格式化全仓或擅自丢弃文件。先运行 git status --short、git diff --stat，按功能域审查改动。

所有 Run & Debug 必须使用 scripts/*.sh，Python 使用 .venv + uv，前端保持 Next.js 15.4、
React 19、Tailwind CSS 4。正式文档写 docs/，讨论方案写 discuss/。

功能不能造假：按钮必须连接真实路由/API；没有能力时明确说明，不伪造搜索、未读、视频、
保存或成功状态。优先找根因和单一事实源，不叠补丁。

第一轮只做接管审查和运行环境核对，输出：
1. 当前工作区分组；
2. 可运行状态；
3. 高风险问题；
4. 建议的提交拆分；
5. 开始下一项开发前需要用户确认的事项。
```

## 14. 相关文档

- `README.md`：项目概览与常用命令
- `docs/01-系统架构与数据流.md`：整体架构
- `docs/02-Agent编排层详细设计.md`：LangGraph 和 Agent 节点
- `docs/09-启动与发布说明.md`：基础运行说明
- `docs/21-AI导师学习系统产品化开发文档.md`：产品主线
- `docs/22-产品演示链路与验收清单.md`：演示验收
- `docs/24-Claude全栈接管代码审查交接.md`：6 月历史审查上下文
- `PROGRESS.md`：长期执行记录，较长，按需检索，不要整份塞进上下文

本文件反映 2026-08-11 的当前工作区状态；若后续完成提交、测试或架构调整，应同步更新本文件中的 Git 基线、验证状态和已知风险。
