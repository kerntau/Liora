# Liora 决策与续跑记录

> 本文件只追加，不覆盖、不删除历史。每条记录按时间顺序追加。
> 角色：产品与工程负责人。执行原则：先取证、再裁决、再施工、最后验收。

---

## 2026-10-21 首轮执行初始化

- 时间戳：2026-10-21 01:45:02 +08:00（Asia/Shanghai）
- 仓库：`C:\Users\Kerntau\Desktop\Liora`
- 当前分支：`main`
- 当前提交：`3e4894e`（merge: 清理 14 个零引用方法与失效的 bench compose）
- 工作区状态：`git status --short` 显示 9 个未跟踪项：`_asar.cjs`、`_asar2.cjs`、`_ext.cjs`、`_ext2.cjs`、`_install.log`、`_install.log.err`、`_plugin-cli.js`、`_pm/`、`_t.tar.gz`。无已暂存差异，无未暂存差异。
- 归属判断：以上未跟踪项均位于仓库根目录、与本项目 Go/React 代码无引用关系，推断为用户既有工具/构建残留；本轮不修改、不删除、不纳入提交。【推断·置信度：高】
- 当前执行阶段：P0（建立判据与固定目标）。尚未开始 P1 大规模取证。
- 本轮目标：完成 P0—P3 决策，随后自动进入 P4，交付可验证的工程改进。
- 已知限制：尚未确认实际测试、构建和类型检查命令；尚未确认核心链路真实实现程度；审批提示在本会话禁用，任何安全测试仅限本地授权环境。
- 文档规则：`docs/DECISIONS.md` 只追加；`docs/CONTRACT.md` 记录共享契约；`WORKLOG.md` 记录真实执行时间线。

### 初始纪律

1. 不覆盖用户既有未跟踪文件，不执行 `git reset --hard` 或强制推送。
2. 所有 `file:line` 必须来自实际读取；未读取的内容不写行号。
3. 任何共享 Schema/路由/API 契约改动，先在本文件追加提案，再修改代码。
4. 目标冻结后，不因实现困难更换目标或降低验收标准。

---

## 2026-10-21 02:05 P0 判据、目标冻结与 P1—P3 裁决

- 时间戳：2026-10-21 02:05 +08:00（Asia/Shanghai）
- 基线：分支 main，HEAD 3e4894e，工作区无已暂存/未暂存差异，9 个根目录未跟踪项与上一轮记录一致。
- 本轮阶段：P0.2—P0.4 已完成并冻结；P1 只读取证完成；P2 裁决完成；P3 方向排序完成；自动进入 P4。

### P0.2 产品价值判断

Liora 解决的核心问题不是「扫出更多漏洞」，而是把一次授权渗透测试从「命令、报文、判断散落在会话里」变成「可复核的证据链」：谁在什么约束下执行了什么、哪条流量证明了哪个漏洞、复测是否仍然成立、最终交付的报告是否与证据一致。当前最值得服务的用户是需要交付可复核结果的安全测试人员与答辩/验收场景，而不是追求扫描吞吐量的批量扫描用户。【推断·置信度：高，依据 README:5-13 与真实数据库中的 6 条发现全部绑定了流量证据】

用户选择 Liora 而不是手工测试或传统扫描器的理由是：多 Agent 探索过程、操作拦截与审批、流量取证、复测和报告在同一个任务上下文里闭环。用户会在以下场景放弃它：报告看不到已绑定的流量证据；审批记录在重启后变成永远无法处理的悬空项；报告声称「无发现」但实际是数据读取失败。决定产品是否有实际价值的最短链路是：任务执行 → 漏洞登记并绑定流量 → 复测 → 报告交付。本轮三个目标全部锚定这条链路。

### P0.3 三条取舍原则（冻结）

1. **宁可报告生成失败，也不能把读取失败渲染成「本次未确认漏洞」。** 数据完整性优先于页面可用性；任何静默降级都必须改为显式错误。
2. **宁可让审批在重启后显示为「已失效」，也不能留下永远无法被消费的 pending 记录。** 审批状态必须收敛到终态，且保留失效原因与审计快照。
3. **宁可减少一个报告章节，也不能让报告与发现页使用两套数据口径。** 交付物与页面必须能相互核对；无法核对的内容不进报告。

### P0.4 三个固定目标（2026-10-21 02:05 冻结，后续不得降标准）

#### G1｜任务报告交付完整性

【基线现状】
- 任务报告直接读探索图节点，且丢弃数据库错误：server/server.go:3597 的 findings, _ := t.Store.ListByKind(db.KindFinding, 1000)；查询失败时仍返回 200 并渲染「本次未确认漏洞」。
- 报告渲染只有严重等级、名称、摘要、PoC：report/report.go:49-92；不含发现状态、已绑定流量证据、复测结论。
- 同样的流量证据在发现导出里已经渲染：report/findings.go:178-199，说明数据存在但任务报告未使用。
- 真实数据库只读核验（2026-10-21 02:03）：findings 6 条、全部关联任务、探索图 finding 节点 6 个、图节点与 findings 行一一对应（缺失 0）、6 条发现全部已有流量绑定。也就是说当前真实数据下，任务报告 100% 漏掉了流量证据。
- report 包没有任何测试：go test ./... 输出 ? liora/report [no test files]。

【目标值】
1. GET /api/report 以 findings 表按任务读取（与发现页/导出同源），不再有 1000 条静默截断；读取失败返回 500 且不输出 Markdown。
2. 每条发现渲染：中文状态、类别、发现时间、最新一次已完成复测的结论（reproduced/fixed/inconclusive 与摘要）、按顺序排列的流量证据（用途、方法、URL、状态码、说明）。
3. report 包新增不少于 8 个测试用例；server 包新增报告处理器测试，覆盖「只有 findings 行、没有图节点」「带流量」「带复测」「数据库关闭时 500」。

【验收手段】go test ./report ./server -count=1 全绿；用临时数据库造 1 条仅 findings 行的发现，curl /api/report 必须出现；关闭数据库后请求必须 500。

【失败判定】发现页可见的发现未出现在报告；数据库错误时仍返回 200；任一新增测试失败。

【对应取舍原则】原则 1、原则 3。

【验证环境】Windows 10/11、Go 1.26.5、SQLite 临时库（LIORA_SQLITE_PATH），不接触 data/liora.db。

#### G2｜审批生命周期一致性

【基线现状】
- ask 审批在内存 channel 上等待：intercept/intercept.go:584-666；进程重启后等待方消失。
- pending 行持久化在 intercept_pending：db/intercept.go:112-136；状态约束只有 pending/allowed/denied/timeout：db/schema.sql:620-621。
- 启动路径没有恢复逻辑：server/manager.go:337-441 只恢复复测、流量删除暂存、LLM 录制表；全仓检索 RecoverInterceptPending 无结果。
- 同类问题已有正确先例：复测在启动时被置为 stopped 并写入原因，db/finding_retests.go:259-261。
- 影响：崩溃/重启后审批页仍显示「待审批」，用户点击允许返回 200，但没有任何执行方会被唤醒；记录既不真实也无法清理。

【目标值】liora 启动、HTTP 服务开始监听之前，把所有遗留 pending 收敛为 timeout（按拒绝处理），写入 decided_at、审计 effective_action=deny、decision_reason=「服务重启，审批已失效（按拒绝处理）」；日志输出处理条数；重复执行返回 0；不影响非 pending 行。

【验收手段】新增 db 测试：造 2 条 pending + 1 条 allowed，执行恢复后 pending 为 0、2 条变为 timeout 且 audit 含原因、allowed 不变、二次执行 0；新增 Manager 方法测试；go test ./db ./server ./cmd/liora -count=1。

【失败判定】恢复后仍有 pending；恢复改写非 pending 行；审计 JSON 丢失原因；测试失败。

【对应取舍原则】原则 2。

【验证环境】同上；启动恢复只在 cmd/liora 主路径调用，避免测试进程内多 Manager 互相干扰。

#### G3｜审批来源可追溯

【基线现状】
- 审批时已经把规则名快照进 audit：intercept/trace.go:155-180，其中 RuleName 在 :163。
- 但列表/详情的 rule_name 只来自当前 intercept_rules 表连接：db/intercept.go:227-231；规则删除后 rule_id 置空，页面回退显示「规则未记录或已删除」：web/src/components/approval-records.tsx:121。
- 影响：删除或重建规则后，历史审批无法证明当时命中了哪条规则，取证链断裂。

【目标值】列表与详情的 rule_name 优先取当前规则名；当前规则不存在时回退到 audit JSON 中的 rule_name 快照；两者都没有时保持空串由前端回退。不得改变已有正常记录的显示。

【验收手段】新增 db 测试：创建规则与 pending（audit.RuleName=快照名），删除规则后 ListAllIntercepts/GetInterceptDetail 仍返回快照名；未删除时返回当前名；无快照时为空。go test ./db -count=1。

【失败判定】删除规则后返回空或「已删除」；正常记录显示变化；测试失败。

【对应取舍原则】原则 3（证据可核对）。

【验证环境】临时 SQLite 库。

### P1 只读取证

#### 表 A：宣称重心与代码重心偏差

| 能力 | 文档宣称 | 实际实现 | 证据 file:line | 偏差及目标影响 |
| --- | --- | --- | --- | --- |
| 报告交付 | README:9 结果查看含报告；报告页有下载/刷新 | 部分实现：可下载，但内容与发现页不同源，缺流量/复测，读取失败静默 | server/server.go:3591-3612；report/report.go:49-92 | 影响 G1：交付物不可核对 |
| 流量取证 | README:9 证据与报告 | 真实实现：6/6 发现已绑定流量，绑定写入与漏洞登记同事务 | db/finding_traffic.go:342-395；真实库只读统计 | 报告未消费 → G1 |
| 漏洞复测 | README:10 漏洞复测 | 真实实现：结论写入 finding_retests，完成时联动 triage | db/finding_retests.go:193-257 | 报告未展示 → G1 |
| 操作拦截与审批 | README:10-11 拦截规则/审批记录 | 真实实现：规则、模型兜底、超时、执行结果审计 | intercept/intercept.go:584-689；db/intercept_detail.go:74-113 | 重启后 pending 悬空 → G2 |
| 审批来源定位 | README:10 审批来源定位 | 部分实现：规则名只 join 当前表，删除后丢来源 | db/intercept.go:227-231；intercept/trace.go:163 | 取证链断裂 → G3 |
| GC | 无公开宣称 | no-op 桩，固定返回 removed:0 | server/server.go:3623-3626；路由 :769 | 误导性接口，本轮下线 |
| 文档入库 | docs 作为交付物 | 未入库：/docs/ 被忽略，git ls-files docs = 0 | .gitignore:27 | 交付可追溯性风险，本轮以 git add -f 交付三份文档 |
| 报告测试 | README:92-105 验证清单 | 真实存在且通过，但 report 包无测试 | go test ./... 实跑输出 | G1 缺回归护栏 |

#### 表 B：正在进行的改动

| 文件或模块 | 实际状态 | 证据来源 | 归属 | 处理方式 |
| --- | --- | --- | --- | --- |
| 根目录 _asar.cjs/_asar2.cjs/_ext.cjs/_ext2.cjs/_install.log/_install.log.err/_plugin-cli.js/_pm/_t.tar.gz | 未跟踪 | git status --short | 用户既有工具/构建残留 | 不读取、不修改、不删除、不纳入提交 |
| docs/DECISIONS.md | 未跟踪（被忽略） | git check-ignore -v | 本轮与上一轮新增 | 只追加；交付时 git add -f |
| 业务代码 | 无未暂存/已暂存差异 | git status --short | — | 本轮改动全部在新分支产生 |
| data/liora.db | 存在，25MB，含真实业务数据 | Get-ChildItem data | 用户数据 | 只读查询，不写入、不迁移 |

#### 自检命令核实（实跑）

| 命令 | 是否存在 | 本轮结果 |
| --- | --- | --- |
| go build ./... | 是 | 通过（exit 0） |
| go test ./... -count=1 | 是 | 14 个包通过，report 无测试文件 |
| go vet ./... | 是 | 通过（exit 0） |
| npm run typecheck | 是（web/package.json） | 通过 |
| npm test | 是 | 7/7 通过 |
| npm run build:embed | 是 | 本轮施工后执行 |
| npm run test:e2e | 是 | 本轮不执行，需先构建内嵌前端与 Playwright 浏览器；不以未执行结果冒充通过 |
| npm run check（biome） | 是 | 失败：178 errors（主要为 import 排序）。CI 未启用该检查，本轮不据此判定回归，也不批量重排用户代码 |

### P2 裁决与功能减法

| 模块 | 现状 file:line | 裁决 | 一句话理由 | 对齐目标 | 选择与放弃 |
| --- | --- | --- | --- | --- | --- |
| 任务报告渲染 Markdown(Input) | report/report.go:49-92 | 重做 | 旧实现只读图节点、吞错、无证据，局部补丁无法同时解决同源与完整性 | G1 | 选择：以 findings 行为输入重写；放弃：保留图节点渲染再加一段流量（会形成两套口径） |
| 逐条发现渲染（FindingsMarkdown 与任务报告） | report/findings.go:37-91 | 合并 | 两份渲染各自维护标题/状态/证据/流量，已出现任务报告漏流量的漂移 | G1 | 选择：抽出共享 writeFindingBlock 与流量渲染；放弃：复制一份任务专用渲染 |
| POST /api/gc | server/server.go:769、3623-3626 | 下线 | 固定返回 removed:0 的 no-op，前端 0 调用，保留只会误导运维 | 工程诚实 | 选择：删路由与 handler；放弃：实现一个没有明确语义的 GC |
| 审批 pending 生命周期 | intercept/intercept.go:584-666；db/intercept.go:112-191 | 保留 | 阻塞等待本身正确，缺的是启动时的终态收敛 | G2 | 选择：补启动恢复；放弃：把 ask 改成异步轮询（会改变执行时序） |
| 审批 rule_name 查询 | db/intercept.go:227-231 | 重做 | 只 join 当前表导致删除规则即丢来源，而快照已在 audit 中 | G3 | 选择：SQL 回退到 audit 快照；放弃：前端读取 detail 再拼（列表页无 audit） |
| Guard 审计 UI（GET /api/audit） | server/server.go:768、3614-3621；前端 0 引用 | 降级 | 内存环形缓冲、按任务、含全部 allow，噪声大；审批记录已覆盖决策链 | 本轮不排期 | 选择：保留 API；放弃：本轮做 UI（投入产出低于 G1/G2/G3） |
| docs/ 版本库策略 | .gitignore:27 | 保留 | 整个 docs 含 4.5MB 审计产物，取消忽略会污染仓库 | 交付 | 选择：仅 git add -f 三份交付文档；放弃：取消 /docs/ 忽略 |
| 内嵌前端清理测试 build tag | server/webui_cleanup_test.go:1 | 保留 | 依赖 server/webui/dist，默认测试环境不保证存在 | 本轮不排期 | 选择：维持现状并记录；放弃：本轮改造测试基建 |

安全阀说明：本轮存在真实的下线与合并对象（/api/gc、两份渲染），无需启用「不可替代性逐模块论证」条款。

### P3 三个方向与执行路线

#### D1｜报告交付完整性（G1，优先级 1）

1. 现状证据：server/server.go:3597 吞错 + 1000 截断；report/report.go:49-92 无流量/复测；真实库 6/6 发现已绑流量但报告 0 条展示。用户损失：交付给客户/答辩的报告无法证明漏洞，且数据库故障时得到虚假的「无发现」。
2. 当前时机：原则 1 与原则 3；G1。
3. 具体任务：
   - T1.1 report 包：新增 Input.Traffic/Retests，抽出共享 writeFindingBlock，任务报告渲染状态、流量、复测；失败时由调用方决定不输出。
   - T1.2 server getReport：改用 ListFindingsForExport(TaskID) + 批量流量查询 + 批量最新复测查询；任一查询失败 500；删除 1000 截断。
   - T1.3 测试：report 单测 8+；server 集成测试 4 项（仅 findings 行、流量、复测、关闭库 500）。
   - T1.4 文档与演示脚本：docs/DEMO-report.md。
4. 投入成本：0.5—1 人日；前置依赖：无；依据：现有渲染与导出代码可复用，数据库查询已有同源接口。
5. 用户感知：任务报告页出现「关联流量证据」和「复测」；发现页可见的漏洞必然出现在报告；数据库异常时看到明确错误而不是空报告。
6. 明确不做：PDF/HTML 导出、项目级汇总报告、报告持久化缓存；理由：不影响「报告与证据可核对」这一核心判定。
7. 风险与回滚：超大任务报告体积增大；回滚为 revert 分支提交，旧渲染保留在 git 历史。
8. DoD：go test ./report ./server -count=1 通过；临时库演示脚本输出包含流量 URL 与复测结论；关闭数据库请求返回 500。
9. 两周最小演示切片：临时库造 1 个任务、1 条带流量和复测的发现，启动服务，打开报告页，下载 Markdown，核对 URL/状态码/复测结论。

#### D2｜审批生命周期恢复（G2，优先级 2）

1. 现状证据：intercept/intercept.go:584-666 内存等待；db/schema.sql:620-621 状态约束；server/manager.go:337-441 无恢复；对照 db/finding_retests.go:259-261 已有正确先例。
2. 当前时机：原则 2；G2。
3. 具体任务：
   - T2.1 db.RecoverInterceptPending：单条 UPDATE 把 pending 收敛为 timeout，合并 audit 原因，返回影响行数。
   - T2.2 Manager.RecoverPendingIntercepts + cmd/liora/main.go 在 New 之前调用并记录条数。
   - T2.3 测试：db 层 2 条 pending + 1 条 allowed、幂等；Manager 包装层。
4. 投入成本：2—4 小时；前置依赖：无；依据：复测恢复已有同构实现。
5. 用户感知：重启后审批页不再出现无法处理的待审批；历史记录显示「已超时」并注明服务重启失效。
6. 明确不做：自动重放被中断的审批请求、跨进程审批接管；理由：需要执行上下文，当前无可靠恢复语义。
7. 风险与回滚：多进程共享同一 SQLite 时可能误伤另一进程的 pending；部署约束本就是单进程（db/finding_traffic.go:21-28 已声明）。回滚：移除 main 调用即可恢复旧行为。
8. DoD：go test ./db ./server ./cmd/liora -count=1；启动日志出现恢复条数；临时库预置 pending 后启动，状态变为 timeout。
9. 两周最小演示切片：临时库插入 1 条 pending，启动 liora，GET /api/intercept/pending 返回空，历史里该条为 timeout 且原因可见。

#### D3｜审批来源快照（G3，优先级 3）

1. 现状证据：intercept/trace.go:163 已存 RuleName；db/intercept.go:227-231 只 join 当前表；approval-records.tsx:121 回退「已删除」。
2. 当前时机：原则 3；G3。
3. 具体任务：
   - T3.1 SQL：rule_name 改为 COALESCE(当前规则名, audit 快照名, '')。
   - T3.2 测试：删除规则后列表/详情仍显示快照名；未删除显示当前名；无快照为空。
4. 投入成本：1—2 小时；前置依赖：无。
5. 用户感知：删除或重建规则后，历史审批仍能说明当时命中了哪条规则。
6. 明确不做：完整审计 UI、规则版本历史表；理由：当前快照已足够证明来源。
7. 风险与回滚：SQL 表达式依赖 JSON1（项目已使用 audit->> 语法）；回滚为单行 SQL 还原。
8. DoD：go test ./db -count=1；临时库删除规则后接口仍返回名称。
9. 两周最小演示切片：创建规则 → 触发 pending → 删除规则 → 审批记录仍显示规则名。

#### P3.2 优先级表

| 排名 | 方向 | 收益 | 成本 | 风险 | 排序理由 |
| --- | --- | --- | --- | --- | --- |
| 1 | D1 报告交付完整性 | 高：真实库 6/6 发现缺证据；直接决定交付物可信度 | 中（0.5—1 人日） | 中：报告体积、渲染回归 | 用户最短路径的终点，且已有数据与渲染可复用 |
| 2 | D2 审批生命周期恢复 | 中高：消除永久悬空状态 | 低（2—4h） | 低：单进程假设 | 有同构先例，改动小，数据完整性收益明确 |
| 3 | D3 审批来源快照 | 中：取证链完整 | 低（1—2h） | 低：单条 SQL | 价值真实但发生频率低于 D1/D2 |

#### P3.3 如果只做三件事

1. 任务报告接入 findings 表并渲染流量/复测（G1）。解决「报告无法证明漏洞」。
2. 启动时收敛 pending 审批（G2）。解决「重启后审批永远悬空」。
3. 审批规则名回退 audit 快照（G3）。解决「删规则即丢来源」。
依赖顺序：G1 独立；G2 独立；G3 独立，但 G3 的测试复用 G2 的 pending 造数方式。先做 G1，因为它直接决定最终交付物是否可信，且真实数据已经证明缺口存在。

明确不做：Guard 审计 UI、PDF 导出、GC 实现、批量 biome 重排、e2e 全量重跑（本轮以单测+构建+定向演示为准，未跑就如实记录）。

#### P3.4 四周路线图

| 时间 | 工作范围 | 交付物 | 验收方式 |
| --- | --- | --- | --- |
| W1 | D1 + D2 | report 重做、启动恢复、单测/集成测试 | go test ./report ./server ./db；临时库演示 |
| W2 | D3 + 演示闭环 | 来源快照、docs/DEMO-*.md、演示脚本 | go test ./db；启动服务按脚本操作 |
| W3—W4（展望） | 报告导出 PDF/HTML、审批审计 UI、报告缓存 | 待定 | 需先确认依赖与用户需求，不作为本轮成果 |

#### P3.5 最大不确定性

- 判断：findings 表可以安全替代探索图作为任务报告的数据源。置信度：高（真实库 6 条发现与 6 个图节点一一对应，0 缺失；登记在同一事务内完成，db/finding_traffic.go:342-395）。
- 判断错误的代价：历史/归档任务中若存在只有图节点、没有 findings 行的漏洞，报告会漏报。
- 最低成本验证实验（已执行）：对 data/liora.db 只读执行 count 对比，结果 findings_total=6、graph_findings=6、graph_findings_with_row=6、findings_without_graph=0。
- 成功触发：按计划切换到 findings 表。失败触发：发现任一任务图节点数大于 findings 行数，则改为「findings 为主 + 图节点补漏」的并集实现，并先补测试再改代码。

#### P3.6 自我反驳

我认为当前设计中的「任务报告以探索图节点为唯一数据源」是错误的。支持证据：报告无法渲染状态/流量/复测，真实库 6/6 发现已绑流量却 0 条进入报告；发现页与导出使用 findings 表，形成两套口径。反对方最强理由：探索图是 Agent 推理的原始事实来源，findings 行是派生投影，理论上可能出现投影缺失。最终立场：在当前事务模型下投影与图节点同事务写入，真实库 0 缺失，改用 findings 表利大于弊；保留「图节点补漏」作为触发条件。改变判断的触发条件：出现任一图节点无 findings 行的真实样本，或 findings 行被独立删除而图节点仍在。

#### P3.7 冲突决胜

冲突：D1 要求报告完整（更多查询、更大输出）与「最小改动、低风险」冲突。候选方案 A：保留图节点渲染，额外查流量拼一段；候选方案 B：改用 findings 表并复用导出渲染。按 P3 决胜规则选择 B：它让用户完成「核对报告与发现」的实际路径最短，同时不牺牲证据真实性；A 会长期维护两套数据口径。被放弃方案 A 的理由与回滚路径已记录在 P2 与 D1。

#### P3.8 自动进入实施

P0—P3 已完成并记录，立即进入 P4；不等待用户回复。施工采用单会话逻辑隔离的 T1/T2/T3 任务包，分别使用 feat/report-delivery、feat/approval-recovery、feat/approval-provenance 分支，逐个合并回 main。

### P4 施工记录

#### T1｜feat/report-delivery（G1）

- 分支：feat/report-delivery；提交：73944e7（feat(report): source task report from findings and render evidence）。
- 变更：
  - report/report.go：Input 增加 Traffic/Retests；任务报告按 findings 行渲染状态、流量、复测；标题/目标换行消毒；严重等级与复测汇总。
  - report/findings.go：抽出 writeFindingBlock 与 trafficMarkdown，任务报告与发现导出共用；排序增加 ID 兜底；状态/复测中文化。
  - db/finding_traffic.go：新增 ListFindingTrafficByFindingIDs 批量查询。
  - db/finding_retests.go：新增 LatestCompletedRetestsByFindingIDs。
  - server/server.go：getReport 改读 findings 表，查询失败 500，删除 1000 截断。
  - report/report_test.go：9 个用例；server/report_test.go：4 个集成用例。
- 自检：go test ./report ./server ./db ./agent -count=1 全部通过（server 10.1s、db 10.9s）。
- 合并点 1：裁决表与实施范围对齐——本轮只做 G1 报告链路，未触碰审批与前端。
- 未完成：PDF/HTML 导出、报告缓存（明确不做）。
- 下一步：T2 审批启动恢复。

#### T2｜feat/approval-recovery（G2）

- 分支：feat/approval-recovery；提交：9e335fa（fix(intercept): settle pending approvals left by a previous process）。
- 变更：
  - db/intercept.go：新增 RecoverInterceptPending，把 status='pending' 的行收敛为 timeout，写入 decided_at 并合并 audit 原因；终态行不变。
  - server/manager.go：新增 Manager.RecoverPendingIntercepts 委托。
  - cmd/liora/main.go：NewManager 之后、HTTP 监听之前调用，记录处理条数。
  - db/intercept_recovery_test.go：2 条 pending + 1 条 allowed、审计原因、快照保留、幂等。
  - server/intercept_recovery_test.go：Manager 委托测试（私有临时库）。
- 自检：go test ./... -count=1 全部通过（db 12.1s、server 10.3s）。
- 合并点 1 复核：裁决表「保留 + 补启动恢复」与实现一致；未改变 ask 的阻塞时序。
- 未完成：自动重放被中断的审批（明确不做）。
- 下一步：T3 审批来源快照。

#### T3｜feat/approval-provenance（G3）

- 分支：feat/approval-provenance；提交：27919c6（fix(db): keep approval rule provenance after rule deletion）。
- 变更：
  - db/intercept.go：approvalRowColumns 的 rule_name 改为 COALESCE(当前规则名, audit 快照 rule_name, '')。
  - db/intercept_provenance_test.go：规则存在/删除/无快照三种情况，列表与详情。
- 自检：go test ./... -count=1 全部通过（db 14.8s、server 12.4s）。
- 合并点 2：路线、共享契约与实现对齐——CONTRACT 2.5/5.3 描述的快照回退与 SQL 一致；前端无需改动。
- 未完成：审计 UI（明确降级）。
- 下一步：下线 /api/gc 空桩并完成最终验收。




---

