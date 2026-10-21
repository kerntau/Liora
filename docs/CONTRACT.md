# Liora 共享契约

> 本文件记录已经由代码证实、跨模块共享的 Schema、路由、API 入参出参、事件名与模块边界。
> 标注【已证实】的内容来自实际读取的代码；标注【已批准·未实现】的内容是本轮决策后计划落地的契约；标注【待验证】的内容不得当作事实使用。
> 决策与理由见 docs/DECISIONS.md；执行时间线见 WORKLOG.md。

更新时间：2026-10-21 02:42 +08:00

## 1. 身份与传输边界【已证实】

- 所有 /api/* 业务接口使用 Bearer JWT；令牌由 server/auth.go 签发与校验，账号固定为 Liora（README:40）。
- 响应默认 JSON；例外：
  - GET /api/report 返回 text/markdown; charset=utf-8（server/server.go:3646-3648）。
  - GET /api/exploration/findings/export 按 format 返回 markdown / zip / csv / json，并设置 Content-Disposition（server/server.go:2091-2120）。
- SSE 事件通过同一 /api 前缀转发，开发代理与内嵌部署同源（README:42）。

## 2. 数据表契约【已证实】

### 2.1 findings（独立漏洞表，db/schema.sql:631-649）

| 列 | 类型/约束 | 语义 |
| --- | --- | --- |
| id | INTEGER PK | 独立漏洞 ID，前端 finding_id |
| task_id | BIGINT → tasks(id) ON DELETE SET NULL | 所属任务；任务删除后保留行 |
| node_id | BIGINT → exploration_nodes(id) ON DELETE SET NULL | 来源探索节点 |
| vulnclass / name / severity / summary / evidence / worker | TEXT | 漏洞描述与 PoC |
| asset_ids | JSON 数组 | 受影响资产 ID |
| status | TEXT 默认 pending | triage 状态，见 db/findings.go:39-50 |
| report | TEXT | 详细报告 Markdown |
| evidence_version / report_evidence_version | INTEGER | 证据版本与报告所依据版本，不一致即报告过期 |

状态枚举：pending、in_progress、confirmed、resolved、fixed、false_positive、ignored、duplicate、risk_accepted（db/findings.go:39-50）。

### 2.2 探索图节点（exploration_nodes）

- kind=finding 表示「已确认漏洞」；state 固定 confirmed（db/constants.go:8；db/finding_traffic.go:366-367）。
- 漏洞登记在同一事务内同时写 exploration_nodes 与 findings（db/finding_traffic.go:342-395）。这是任务报告可以改用 findings 表的依据。

### 2.3 finding_traffic_bindings + traffic_evidence_snapshots（db/finding_traffic.go:93-109、189-205）

- binding：id、finding_id、snapshot_id、role、note、position、created_at。
- role 枚举：baseline、proof、verification、supporting（db/finding_traffic.go:72-74）。
- snapshot：id（内容哈希）、source_traffic_id、captured_at、url、method、status、content_type、req_head、resp_head、req_hash、resp_hash、req_len、resp_len、created_at。
- 绑定写入与 evidence_version 自增同事务；同一 finding 的同一 snapshot 去重（db/finding_traffic.go:207-238）。

### 2.4 finding_retests（db/finding_retests.go:17-35、193-257）

- 字段：id、finding_id、conversation_id、status、verdict、notes、snapshot、summary、evidence、error、created_at、started_at、finished_at。
- status：pending、running、completed、failed、stopped。
- verdict：reproduced、fixed、inconclusive；completed 且 verdict=fixed 时同事务把 findings.status 置为 fixed。
- 启动恢复：pending/running → stopped，error=「服务重启，复测已中断，请重新发起」（db/finding_retests.go:259-261）。

### 2.5 intercept_pending（db/schema.sql:612-629）

- 字段：id、rule_id、conversation_id、task_id、agent_name、tool_name、tool_input、status、reason、decided_at、created_at、audit、decision_source。
- status 约束：pending、allowed、denied、timeout（db/schema.sql:620-621）。
- audit 为 JSON，包含 correlation、input_digest、initial_action、initial_reason、effective_action、decision_reason、rule_name、execution_status 等（db/intercept_detail.go:21-45）。
- rule_name 快照写入 audit（intercept/trace.go:163）；查询优先当前规则名，缺失时回退快照（db/intercept.go:255-259），见第 5 节。

## 3. HTTP API 契约

### 3.1 任务报告【已证实 + 本轮变更】

GET /api/report?task=<task_id>

- 变更前（历史实现，见提交 370fc47 的父提交）：读探索图节点，limit 1000，数据库错误被丢弃；返回 200 + Markdown。
- 变更后【已实现】：
  - 数据源：findings 表按 task_id 读取（与全局发现页、发现导出同源），不设 1000 截断。任务详情「漏洞结果」Tab 仍走 exploration_nodes（server/server.go:1843-1932），并包含来源任务继承节点；报告把继承发现放在独立的「关联任务发现（只读，不计入本任务统计）」章节，不混入本任务计数。
  - 资产统计：按任务过滤（db/assets.go:1129-1136；server/server.go:3626），不再使用全局 QueryByType。
  - 失败：findings、流量证据、复测、资产、关联任务任一读取失败 → HTTP 500 JSON {"error": "..."}，不输出 Markdown；无活跃任务 → 404 {"error":"no active task"}。
  - 成功：200 text/markdown，包含任务目标、生成时间、发现记录/确认发现/状态分布、按任务统计的资产、按严重等级排序的每条发现（状态、类别、发现时间、最新 completed 复测、流量证据、详细报告），以及关联任务发现章节。
  - 排序：严重等级降序（critical→high→medium→low→未知最后），同级别按 created_at 降序，再按 id 降序；未知 severity 与导出 SQL 一致排在最后（report/report.go:142-156）。
  - 大数据量：流量/复测批量查询按 500 个 finding 分批（db/finding_traffic.go:282-313；db/finding_retests.go:261-290），避免 SQLite 变量上限导致 500。
- 前端：api.ts:670-682 透出后端 {"error"} 文案；report-tab.tsx 失败时显示「报告加载失败」+ 原因 + 重试，不再把 500 显示成「暂无报告」。
- 调用方：web/src/lib/api.ts:670-682；web/src/pages/main/function/tasks/detail/_tabs/report-tab.tsx。

### 3.2 发现列表与导出【已证实】

- GET /api/exploration/findings：无 task 为全局发现页，从 findings 表读取（server/server.go:1844-1875）；带 task 为任务详情 Tab，从 exploration_nodes 读取（上限 200）并追加来源任务继承节点（server/server.go:1877-1932）。两者口径不同，报告采用前者。
- GET /api/exploration/findings/export：format=md-single|md-zip|csv|json，支持筛选与勾选 ID（server/server.go:2025-2120）。
- 导出渲染在 report/findings.go，包含状态、所属任务、详细报告、流量证据；与任务报告共用 writeFindingBlock。

### 3.3 审批【已证实】

- GET /api/intercept/pending：仅 status='pending'（db/intercept.go:175-191）。
- GET /api/intercept/pending/{id}：单条。
- POST /api/intercept/pending/{id}/decide：body {"decision":"allowed"|"denied"}；重复决策 409（server/intercept.go:345-371）。
- GET /api/intercept/history、/history/{id}、/history/{id}/execution：历史与执行结果。
- GET /api/intercept/task/{taskID}：任务维度审批。
- 决策语义：ResolveIntercept 只更新 status='pending' 的行，合并 audit 的 effective_action/decision_reason/execution_status（db/intercept_detail.go:74-96）。

### 3.4 已下线【本轮】

- POST /api/gc：固定返回 {"removed":0} 的 no-op，前端 0 调用，本轮删除路由与 handler。删除后返回 404。

## 4. 模块边界【已证实】

| 模块 | 职责 | 不得越界 |
| --- | --- | --- |
| agent | Planner/Worker/主 Agent、工具调用、finding 登记 | 不直接写 findings/traffic 表；经 db.ExplorationStore / evidence.Store |
| db | SQLite Schema、事务、查询、triage、审批持久化 | 不渲染 Markdown、不发 HTTP |
| report | 纯渲染：输入 db 行，输出 Markdown/CSV | 不查数据库、不读文件 |
| server | HTTP、DTO、编排、调用 db/report/evidence | 不复制渲染逻辑 |
| intercept | 规则匹配、模型兜底、pending 生命周期、审计快照 | 不直接发 HTTP；Reviewer 由 server 注入 |
| guard | PreToolUse/PostToolUse 钩子、内存审计、失败归因 | 不硬编码破坏性规则（规则在 DB） |
| traffic | 录制代理、交换存储、归档 | 不决定漏洞归属 |
| evidence | 证据导出/暂存/GC | 不改写漏洞结论 |

## 5. 本轮共享契约变更提案（P5.4）

### 5.1 任务报告数据源变更

- 原因：报告与发现页两套口径；真实库 6/6 发现已绑流量但报告未展示；数据库错误被吞。
- 调用方：web/src/lib/api.ts:670；report-tab.tsx。
- 受影响文件：server/server.go（getReport、relatedTaskFindings）、report/report.go、report/findings.go、db/finding_traffic.go、db/finding_retests.go、report/report_test.go、server/report_test.go、server/report_related_test.go、web/src/lib/report-error.ts、web/src/lib/api.ts、report-tab.tsx。
- 兼容性：HTTP 路径、查询参数、Content-Type 不变；Markdown 内容增加状态分布/关联任务章节，不删除任务目标/摘要/发现；「确认发现」保留但只统计 status=confirmed，另列「发现记录」总数。
- 回滚：revert feat/report-delivery 的提交与后续验收修复提交，恢复图节点渲染。

### 5.2 审批启动恢复

- 原因：进程重启后 pending 永远无法被消费。
- 调用方：cmd/liora/main.go（新增调用）；server.Manager 新增方法。
- 受影响文件：db/intercept.go、db/intercept_recovery_test.go（新增）、server/manager.go、cmd/liora/main.go。
- 兼容性：只改 status='pending' 的行；终态行不变；状态枚举不新增值（使用既有 timeout）。audit 为 JSON 对象时合并决策补丁；为 NULL 时保持 NULL；为数组/标量时整体替换为补丁，避免 liora_json_merge 报错导致整批恢复失败。
- 回滚：删除 main 中的调用。

### 5.3 审批 rule_name 回退

- 原因：规则删除后历史审批丢失来源，而 audit 已有快照。
- 受影响文件：db/intercept.go（approvalRowColumns）。
- 兼容性：当前规则存在时行为不变；仅在缺失时回退；无快照仍为空。
- 回滚：单行 SQL 还原。

## 6. 事件与状态【已证实】

- 审批 inline 事件：activity.kind = intercept_request，detail 含 pending_id/tool/input（intercept/intercept.go:605-623）。
- 任务状态：created、queued、paused、running、done、failed、timeout（server/server.go:1009-1030 与 terminal 判断）。
- 发现 triage 状态见 2.1。
- 复测状态见 2.4。

## 7. 待验证【不得当作事实】

- 归档/恢复任务中 findings 行与探索图节点是否仍保持一一对应（本轮只验证了当前活动库）。
- 多进程共享同一 SQLite 数据目录时的审批归属：无单实例锁，后启动实例会收敛先启动实例的 pending（本轮已实测）；部署约束声明为不支持（db/finding_traffic.go:21-28）。
- 仅存在于 exploration_nodes、没有 findings 行的历史发现节点：任务 Tab 可见，但任务报告不包含；当前真实库为 0 条。若出现，按 DECISIONS 的触发条件改为并集实现。
- Guard 内存审计在任务重载后的可见范围（本轮不做 UI）。

---

## 8. 2026-10-21 第三轮（工程收敛）【已实现】

> 本节只记录本轮已经落地并有测试/构建证据的行为，旧章节未删除。

### 8.1 HTTP 边界与可观测性

- 中间件顺序：`securityHeaders(cors(withObservability(recoverPanic(limitJSONBody(requireAuth(mux))))))`（server/server.go:883）。
- CORS：`Access-Control-Allow-Headers: Content-Type, Authorization`，`Access-Control-Max-Age: 600`。跨源部署（独立 SSE 基址）的预检不再失败。
- 请求 id：每个 /api 响应带 8 位十六进制 `X-Request-Id`；同一 id 注入 request context（server/observability.go）。
- 失败日志：5xx 或耗时 >=2s 记录 `[http] METHOD PATH -> STATUS in DURATION id=ID`；`writeErr` 在 status>=500 时额外记录 `[http] STATUS: 原因`；panic 记录 `[http] panic on METHOD PATH id=ID` 与堆栈。
- 请求体：Content-Type 以 `application/json` 开头的请求上限 2 MiB（multipart 上传不受此限，各上传端点保留自己的 MaxBytesReader）。
- 安全响应头：`X-Content-Type-Options: nosniff`、`Referrer-Policy: same-origin`、`X-Frame-Options: DENY`，API 与内嵌前端统一生效。
- 服务器超时：`ReadHeaderTimeout=10s`、`IdleTimeout=120s`、`MaxHeaderBytes=1MiB`；`WriteTimeout` 保持 0（SSE 长连接）。

### 8.2 认证来源

- 接受 `Authorization: Bearer` 或 `liora_token` cookie。
- `?token=` 仅对路径以 `/stream` 或 `/events` 结尾的 SSE 端点生效（server/auth.go）。其他端点带 query token 视为未认证。
- 前端收到 401 时清 token 并跳转 `/login?expired=1`，登录页显示「登录状态已过期」；并行 401 只跳转一次（web/src/lib/auth.ts、api.ts）。

### 8.3 读取边界

- `GET /api/intercept/task/{id}`：无 page/size 时返回最新 100 条，响应 `{items,total,truncated}`；total 为真实总数，truncated=total>len(items)。带 page/size 时行为不变。
- `GET /api/conversations/{id}/messages?since=`：since 必须是非负整数，否则 400 `{"error":"since 必须是非负整数"}`；增量突发上限固定 1000 条，`?limit` 只作用于历史分页。
- `GET /api/exploration/findings`（无 page/limit 的汇总分支）与 `GET /api/exploration/frontier`：读取失败返回 500 与原因，不再返回 200 空数组。
- 任务不存在时 `GET /api/exploration/findings?task=` 仍返回 200 `[]`（既有前端契约，本轮未改，见 8.7）。

### 8.4 数据一致性

- 发现字段更新：findings 行与 exploration_nodes payload 的同步写入在同一事务内；节点同步失败回滚整个更新（db/findings.go）。
- 裁判配置：judge_enabled 与 5 个 setting 通过 `db.SetSettings` 单事务写入；失败整体回滚（intercept/intercept.go、db/settings.go）。
- 归档恢复：`rowExists` 返回 `(bool, error)`，查询失败中止恢复事务，不再把错误当成「行不存在」（db/task_archives_restore.go）。
- 证据 GC：元数据事务只负责 unreferenced_at/删除与候选收集，blob 文件在事务提交后删除；失败的下一次 GC 重试（evidence/store.go）。
- 覆盖率：`scope_rows` 查询失败返回错误，不再以 0 表示「范围未锚定」（db/task_assets_context.go）。
- 资产登记：来源关联写入失败会进入响应的 errors 数组，不再静默成功（server/assets.go）。

### 8.5 索引

- `idx_act_kind_created ON activity(kind, created_at)`（schema.sql，并在每次 Open 幂等补建）。
- `idx_llm_usage_ts ON llm_usage(ts)`（llm_usage 表惰性创建，索引随表创建并在每次 Open 补建）。
- 两者都有 `EXPLAIN QUERY PLAN` 断言测试（db/index_plan_test.go）。

### 8.6 前端异步契约

- `useAsyncData.status` 表示「当前是否有可用数据」：首载 loading、有数据 ready、无数据失败 error；刷新时保持 ready 并给出 `refreshing`。
- `AsyncState`：仅首载渲染骨架；有数据刷新时保留内容并显示非遮挡「更新中」；有数据刷新失败显示可关闭/可重试的窄条错误；无数据失败保持整块错误。
- 状态推导唯一入口：`web/src/lib/async-status.ts` 的 `deriveAsyncView`，由 hook 与组件共用，并有 node:test 用例。

### 8.7 已知偏差（本轮保留）

- `GET /api/exploration/findings?task=<unknown>` 返回 200 `[]`：改成 404 需要前端任务详情同步处理，单独立项。
- 前端仍有多套时间格式化（fmtTime 5 种样式）与 token 格式化（dashboard 显示 2.0M、其他页 2M）；本轮只统一了逐字节相同的 fmtBytes/fmtTokens 的实现位置，未改显示。
- biome 基线仍有大量 import 排序/format 诊断，CI 未启用，本轮不批量重排。

---

## 9. 2026-10-21 第四轮（结构与一致性）【已实现】

### 9.1 删除 Agent 的事务边界

- DELETE /api/agents/{key}：agents 行与 agent_triggers 在同一事务内删除；任一步失败整体回滚并返回 500。
- 删除不存在的 key 仍为 404（HTTP 层先查 agentByKey）；DB 层 DeleteAgentWithTriggers 对未知/内置 key 保持 no-op。
- 工具绑定清理仍为 best-effort（既有语义）。agent_triggers.agent_key 无外键，已有库不重建表。

### 9.2 批量删除资产上限

- DELETE /api/assets 的 ids 数量上限 5000（maxAssetDeleteIDs）；超过返回 400，文案包含实际数量。
- DB 层改为 WHERE id IN (SELECT value FROM json_each($1))，不再受 SQLite 变量数量上限约束。

### 9.3 分页参数

- 统一入口 pageParams(q, defPage, defSize, cap)（server/httputil.go）：page<1→1；size<=0→defSize；size>cap→cap；cap<=0 表示不设上限。
- 现有端点参数与上限保持不变：findings 1/20/200，分组 1/10/100，intercept 1/20/100，exploration nodes 1/20/200。page 仍为 1-based。
- 仍为单值 ?limit 的端点（intents、activityHistory）未折叠，避免改变 0 值的回落语义。

### 9.4 SSE 帧

- 三个流（日志、活动、旁路问答）共用 server/sse.go 的 newSSE/Send/Ping；帧字节与改造前一致：
  - 日志/活动：id: N + data: {...} + 空行（无 event 行）。
  - 旁路 snapshot：id: N + event: snapshot + data；cleared：event: cleared + data。
  - 心跳：: ping / : keepalive。
- 先断言 http.Flusher 再查询的既有优先级保留。

### 9.5 前端格式化、轮询与拆分

- web/src/lib/format.ts 成为字节/token/时间/时长的唯一实现；format.test.mjs 覆盖边界与非法输入。
  - 时间样式：short = MM/DD HH:mm，datetime = YYYY-MM-DD HH:mm:ss，seconds = MM/DD HH:mm:ss；空值/非法值返回 —。
  - fmtDuration 以 unit 区分 sec（1m 30s）与 ms（1m30s）两种既有排版。
- web/src/hooks/use-polling.ts：启用即执行、隐藏标签页暂停、可见时补跑、重叠跳过、卸载清理；错误仍由调用方处理。
- 拆分（无行为变化）：tasks/page.tsx 3301 → 1456 行；findings/page.tsx 1427 → 1057 行。

### 9.6 启动期播种与迁移

- 复测 Agent 播种事务与 finding workflow 工具 schema/绑定迁移从 server 移入 db（EnsureFindingRetesterAgent / EnsureToolSchema）；SQL、flag、顺序与幂等语义不变。
- 提示词与工具 schema 默认值由调用方注入（db 不反向依赖 agent/traffic）。

### 9.7 本轮新增已知偏差

- findings/detail 的发现时间由 toLocaleString 默认格式（2026/10/21 12:34:56）改为 datetime 样式（2026-10-21 12:34:56），分隔符变化。
- 轮询相位：改筛选/翻页不再重置 5s 倒计时（hook 用 ref 保存任务），最坏等待仍为 5s。
- 资产视图仍有 5s 空 tick（不发请求）。
