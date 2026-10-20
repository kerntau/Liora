# Liora 共享契约

> 本文件记录已经由代码证实、跨模块共享的 Schema、路由、API 入参出参、事件名与模块边界。
> 标注【已证实】的内容来自实际读取的代码；标注【已批准·未实现】的内容是本轮决策后计划落地的契约；标注【待验证】的内容不得当作事实使用。
> 决策与理由见 docs/DECISIONS.md；执行时间线见 WORKLOG.md。

更新时间：2026-10-21 02:10 +08:00

## 1. 身份与传输边界【已证实】

- 所有 /api/* 业务接口使用 Bearer JWT；令牌由 server/auth.go 签发与校验，账号固定为 Liora（README:40）。
- 响应默认 JSON；例外：
  - GET /api/report 返回 text/markdown; charset=utf-8（server/server.go:3609-3611）。
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
- rule_name 快照写入 audit（intercept/trace.go:163）；当前查询只 join 当前规则表（db/intercept.go:227-231）——本轮改为回退快照，见第 5 节。

## 3. HTTP API 契约

### 3.1 任务报告【已证实 + 本轮变更】

GET /api/report?task=<task_id>

- 变更前【已证实】：读探索图节点，limit 1000，数据库错误被丢弃；返回 200 + Markdown（server/server.go:3591-3612）。
- 变更后【已批准·本轮实现】：
  - 数据源：findings 表按 task_id 读取（与发现页/导出同源），不设 1000 截断。
  - 失败：任一数据库查询失败 → HTTP 500 JSON {"error": "..."}，不输出 Markdown。
  - 成功：200 text/markdown，包含任务目标、生成时间、发现计数、按严重等级排序的每条发现、状态、类别、发现时间、最新 completed 复测结论、流量证据列表、详细报告。
  - 排序：严重等级降序（critical→high→medium→low→其他），同级别按 created_at 降序，再按 id 降序，保证重复生成顺序稳定。
- 调用方：web/src/lib/api.ts:669-675；web/src/pages/main/function/tasks/detail/_tabs/report-tab.tsx。

### 3.2 发现列表与导出【已证实】

- GET /api/exploration/findings?task=<id>：任务内发现；无 task 为全局发现页，从 findings 表读取（server/server.go:1844-1845）。
- GET /api/exploration/findings/export：format=md-single|md-zip|csv|json，支持筛选与勾选 ID（server/server.go:2025-2120）。
- 导出渲染在 report/findings.go:37-199，包含状态、所属任务、详细报告、流量证据。

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
- 调用方：web/src/lib/api.ts:669；report-tab.tsx。
- 受影响文件：server/server.go（getReport）、report/report.go、report/findings.go、report/report_test.go（新增）、server/report_test.go（新增）。
- 兼容性：HTTP 路径、查询参数、Content-Type 不变；Markdown 内容增加章节，不删除任务目标/摘要/发现；旧报告中的「确认发现」保留。
- 回滚：revert feat/report-delivery 的提交，恢复图节点渲染。

### 5.2 审批启动恢复

- 原因：进程重启后 pending 永远无法被消费。
- 调用方：cmd/liora/main.go（新增调用）；server.Manager 新增方法。
- 受影响文件：db/intercept.go、db/intercept_recovery_test.go（新增）、server/manager.go、cmd/liora/main.go。
- 兼容性：只改 status='pending' 的行；终态行不变；状态枚举不新增值（使用既有 timeout）。
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
- 多进程共享同一 SQLite 数据目录时的审批归属（部署约束声明为不支持，db/finding_traffic.go:21-28）。
- Guard 内存审计在任务重载后的可见范围（本轮不做 UI）。
