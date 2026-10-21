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

### P4.1 执行结构重设计（真实多会话）

- 触发：2026-10-21 02:22 用户指出首轮 P4 采用单会话逻辑隔离，未使用环境已支持的真实多 Agent 并发。
- 裁决：产品目标 G1—G3 保持冻结（P0.4 禁止为实施便利改目标）；重设计的是执行结构，不是验收标准。已落地的 T1—T3 保留，新增 3 个真实子会话线程做独立验收。
- 真实并发声明：本轮使用 subagent 启动 3 个独立会话，不是口头标签；主会话在它们运行期间不修改 server/db/web 源码，只追加本文档，避免读写冲突。

| 线程 | 类型 | 独立目标 | 文件白名单 | 契约快照 | 依赖 | DoD |
| --- | --- | --- | --- | --- | --- | --- |
| T4 | 子会话·只读验收 | 独立复验 G1 报告链路（同源、证据、错误语义、排序） | 只读，无写 | CONTRACT 3.1 | 无 | 逐项 PASS/FAIL + file:line + 命令输出 |
| T5 | 子会话·只读验收 | 独立复验 G2 重启恢复与 G3 快照回退（含真实进程重启） | 只读，无写 | CONTRACT 2.5、5.2、5.3 | 无 | 实测日志/DB 状态 + PASS/FAIL |
| T6 | 子会话·只读验收 | 前端闭环、typecheck/test/build、文档与实现一致性 | 只读；构建产物除外 | CONTRACT 3.1 | 无 | 构建退出码 + 缺口清单 |
| T1—T3 | 主会话·实现 | G1/G2/G3 实现与提交 | feat/report-delivery、feat/approval-recovery、feat/approval-provenance | 已合并 | 无 | go test ./... 全绿 |

- 不冲突证明：T4/T5/T6 均不写仓库，主会话只写 docs/DECISIONS.md 与 WORKLOG.md；三条线程读取的代码在运行期间保持不变。
- 合并点 2 更新：T4/T5/T6 的结论将决定是否需要补丁；任何补丁先在主会话复现，再按 P5 失败处理流程修复。
- 记录规则：子会话的结论只作为独立证据，不替代主会话自检；未通过的项必须修复或如实保留。

### P4.2 独立验收结果与修复裁决（T5/T6，2026-10-21 02:25）

#### T6（前端闭环 / 构建 / 文档）

- 构建：npm run typecheck 退出 0；npm test 7/7；npm run build 退出 0（Rsbuild 2.72s）。
- FAIL：后端 500 被前端渲染为「暂无报告」。证据：web/src/lib/api.ts:674 丢弃 {"error"}；report-tab.tsx:32-35 只 setReport("")，无 error 状态；report-tab.tsx:97-103 空串即空态。用户无法区分「数据库读取失败」与「没有报告」。
- FAIL：docs/CONTRACT.md 3.1 与实现存在行号与口径偏差；「与发现页同源」表述过宽：任务内「漏洞结果」Tab 走 exploration_nodes（server/server.go:1846、1882，200 条上限）并追加来源任务继承节点（1901-1930），只有全局发现页与导出使用 findings 表。
- 附带缺陷：report/report.go:110 的 sevRank 对未知 severity 返回 map 零值 0，与 critical 同档；db/findings.go:473 的导出 SQL 把未知等级排最后，两处排序不一致。

#### T5（G2/G3 独立验收）

- G2 核心 PASS：真实二进制重启后日志出现「已失效 1 条」，数据库 status=timeout、decided_at 非空、audit 原因/快照保留、allowed 终态未变、第三次启动幂等。
- G3 PASS：SQL 与 Go 两级验证；规则删除后列表/详情返回 audit 快照名。
- FAIL（边界）：当某行 audit 为 JSON 数组（如 []）时，liora_json_merge 报 cannot unmarshal array，整条 UPDATE 失败，所有 pending 仍为 pending；启动仅告警，不阻断服务。
- 已知限制：多进程共享同一 SQLite 时，后启动实例会收敛先启动实例正在等待的 pending（实测 A 18789 的 pending 被 B 18790 置为 timeout）；当前无单实例锁，属于部署约束而非代码可判定状态。

#### 修复裁决

1. G1 前端闭环：修 api.ts 透出后端错误、report-tab 增加 error 状态与重试；新增 src/lib/report-error.ts + 3 个单测。状态：已实施，待复验。
2. 排序一致性：把 sevRank 改为函数，未知 severity 返回 4（与导出 SQL 一致）。状态：待实施。
3. G2 边界：恢复 SQL 对 audit 非对象行改为写入决策补丁而不是 merge，保证整批成功；新增数组 audit 用例。状态：待实施。
4. 文档：修正 CONTRACT 行号与「同源」口径、DEMO 的对比对象与错误态描述。状态：待实施。
5. 多进程误伤：不新增锁（超出本轮目标）；在 CONTRACT 与 DEMO 明确为单进程部署约束。

### P4.3 验收修复与复验（2026-10-21 02:42）

#### 独立验收汇总（真实子会话）

| 线程 | 结论 | 关键证据 | 处置 |
| --- | --- | --- | --- |
| T4 G1 报告 | 冻结口径通过；严格任务 Tab 口径 FAIL | 1500 条无截断、三处 500、流量/复测/排序/隔离实测；任务 Tab 继承与 node-only 不在报告；资产计数全局；未知 severity 排序错误；40000 id 触发 SQLite 变量上限 | 修复资产/关联发现/排序/分批；node-only 记录为边界 |
| T5 G2/G3 | G2 核心 PASS + 数组边界 FAIL；G3 PASS | 真实二进制重启日志与 DB 状态；G3 SQL/Go 两级；audit=[] 导致整批恢复失败；多进程误伤实测 | 修复 audit 非对象分支；多进程记为部署约束 |
| T6 前端/构建 | 构建 PASS；前端错误闭环 FAIL；文档不一致 | typecheck 0、npm test 7/7、build 0；500 显示「暂无报告」；CONTRACT 行号/口径偏差 | 修复错误态与文档；新增 report-error 单测 |

#### 已实施修复

1. G1 前端闭环：web/src/lib/api.ts:670-682 透出后端 {"error"}；新增 web/src/lib/report-error.ts 与 3 个单测；report-tab.tsx 增加 error 状态、错误原因与重试，刷新失败保留旧报告并提示。
2. 资产任务隔离：server/server.go:3626 改用 db.AssetStore.CountsByTypeForTask（db/assets.go:1129-1136），不再全局 QueryByType。
3. 关联任务发现：server/server.go:3654-3676 读取直接来源任务 findings；报告新增「关联任务发现（只读，不计入本任务统计）」章节；本任务计数不受影响。
4. 未知 severity：report/report.go:142-156 severityRank 未知值返回 4，与 db/findings.go:473 导出排序一致。
5. 统计口径：报告区分「发现记录」「确认发现（status=confirmed）」「状态分布」，不再把所有 triage 状态都叫确认发现。
6. 批量查询分批：db/finding_traffic.go:282-313、db/finding_retests.go:261-290 按 500 个 ID 分批，避免 SQLite 变量上限导致 500。
7. G2 边界：db/intercept.go:189-197 对 audit 非对象（数组/标量）改为写入决策补丁；db/intercept_recovery_test.go 新增 audit='[]' 用例，恢复 3 条、终态 0 条 pending。
8. 下线：server/server.go 删除 POST /api/gc 与 no-op handler；server/retired_routes_test.go 断言 404。

#### 复验（全部真实执行）

| 命令 | 结果 |
| --- | --- |
| go test ./... -count=1 | 15 个包全部 ok；TEST_EXIT=0 |
| go vet ./... | VET_EXIT=0 |
| cd web; npm run typecheck | TYPECHECK_EXIT=0 |
| cd web; npm test | 10 pass / 0 fail |
| cd web; npm run build | BUILD_EXIT=0，Total 4310.9 kB |
| go test ./report -count=1 | ok，9 个用例 |
| go test ./server -run TestReport -count=1 | 6 个用例通过 |

#### 残余边界（不计为通过，也不隐藏）

1. 仅存在于 exploration_nodes、没有 findings 行的历史发现节点：任务 Tab 可见，报告不包含；当前 data/liora.db 为 0 条。触发条件：出现任一此类真实样本 → 改为 findings 为主 + 图节点补漏的并集实现。
2. 任务详情「漏洞结果」Tab 自身有 200 条上限（server/server.go:1882、1907）；报告无此上限，数量可能多于 Tab。
3. 多进程共享同一 SQLite：后启动实例会收敛先启动实例的 pending；无单实例锁，按部署约束记录。
4. 500 响应包含底层错误字符串（便于本地诊断），未做脱敏。
5. Playwright e2e 本轮未执行；不以历史 62/62 代替本轮结果。
6. npm run check（biome）基线 178 errors，主要是 import 排序；CI 未启用，本轮未批量重排用户代码。

#### 协议偏差（如实记录）

- T0 未按 P4.2 使用独立分支 feat/t0-decouple；CONTRACT.md 与 P0-P3 决策一起落在 bffec34。内容已建立并被后续实现引用，但分支纪律未满足。
- T1—T3 为单会话串行实现；P4.1 要求的真实多会话在收到用户纠正后以 T4/T5/T6 三个 subagent 验收线程补做。实现阶段的并发未达成，验收阶段达成。

---

## P6 最终交付与验收

### ② P0 目标验收表

| 目标 | 基线 | 目标值 | 实际结果 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| G1 任务报告交付完整性 | server/server.go 旧 getReport 吞错 + 1000 截断；report/report.go 只渲染 PoC；真实库 6/6 发现已绑流量但报告 0 展示；report 包 0 测试 | findings 表按任务读取；失败 500；状态/流量/最新复测；≥8 report 测试 + 4 server 测试 | 已实现；9 个 report 用例、6 个 server 用例；资产任务隔离、关联发现单列、未知 severity 修正、批量查询分批；前端 500 显示错误与重试 | go test ./report ./server 全绿；eab8c51；T4/T6 报告；CONTRACT 3.1 | 通过（冻结口径：全局发现页/导出同源） |
| G2 审批生命周期一致性 | intercept/intercept.go:584-666 内存等待；db/schema.sql:620-621 状态约束；启动无恢复；复测有先例 db/finding_retests.go:259-261 | 启动前收敛所有 pending 为 timeout，写原因，幂等，不改终态 | 已实现；真实重启实测日志与 DB 状态；audit 数组边界已修复并加用例 | 9e335fa、bb8e4fd；T5 报告；db/intercept_recovery_test.go | 通过（多进程误伤为部署约束） |
| G3 审批来源可追溯 | intercept/trace.go:163 已存快照；db/intercept.go 只 join 当前规则；删除规则丢来源 | 当前规则名优先，缺失回退 audit 快照，无快照为空 | 已实现；SQL 与 Go 两级验证；删除/改名/无快照三态 | 27919c6；T5 报告；db/intercept_provenance_test.go | 通过 |

### ③ 取证表

见 P1 表 A/表 B 与 P4.3；关键偏差均已修复或列为边界。自检命令清单见 P1.2 与 P4.3 复验表。

### ④ 裁决表

见 P2。已执行：下线 POST /api/gc（server/server.go 路由与 handler 删除，retired_routes_test 断言 404）；合并逐条发现渲染（writeFindingBlock 被任务报告与导出共用）。

### ⑤ 三个工作方向

见 P3.1—P3.4；优先级 D1 > D2 > D3；只做三件事、四周路线图、最大不确定性实验（真实库 6=6）、自我反驳与冲突决胜均已记录。

### ⑥ 共享契约与工作日志

- docs/CONTRACT.md：已按实现修正行号与口径，标注待验证边界。
- WORKLOG.md：按 [T#][时间] 追加真实执行事实。

### ⑦ 各方向 DoD、演示脚本与任务包

- G1：docs/DEMO-report.md；DoD 见 P3.1 D1；任务包 T1 + T4/T6 验收。
- G2：docs/DEMO-approval-recovery.md；DoD 见 P3.1 D2；任务包 T2 + T5 验收。
- G3：docs/DEMO-approval-provenance.md；DoD 见 P3.1 D3；任务包 T3 + T5 验收。
- 多会话任务包：P4.1 表格（线程、白名单、契约、依赖、DoD）。

### ⑧ 设计判断与最终立场

- 最初的错误判断：任务报告应以探索图节点为唯一数据源。
- 支持证据：报告缺状态/流量/复测；真实库 6/6 发现已绑流量但报告 0 展示；发现页/导出使用 findings 表。
- 最强反驳：探索图是 Agent 推理的原始事实，findings 是派生投影，投影可能缺失。
- 最终立场：漏洞登记在同事务写图节点与 findings 行（db/finding_traffic.go:342-395），真实库 0 缺失，改用 findings 表；来源任务继承发现单列；node-only 历史节点保留触发条件。
- 改变判断的条件：出现任一图节点无 findings 行的真实样本，或 findings 行被独立删除而图节点仍在。

### 最终工程报告

#### 已完成且通过验收

- G1 报告同源、无 1000 截断、失败 500、状态/流量/最新复测、资产任务隔离、关联发现单列、未知 severity 排序、批量查询分批、前端错误态与重试。
- G2 启动收敛遗留 pending、审计原因与快照保留、幂等、非对象 audit 边界。
- G3 规则名回退 audit 快照。
- POST /api/gc 下线并加 404 回归。
- 决策文档、共享契约、工作日志、三份演示脚本。

#### 已实现但验收不通过

- 无（T4/T5/T6 指出的可修复项均已修复并复验；node-only 历史节点列为边界而非已修复）。

#### 部分实现

- 任务 Tab 与报告的 node-only 历史节点一致性（真实库 0 条）。
- 任务 Tab 200 条上限与报告无上限的差异（UI 既有行为，本轮未改）。

#### 未实现

- Guard 审计 UI（GET /api/audit 仍无前端入口）。
- PDF/HTML 报告导出、报告持久化缓存。
- 多进程审批归属锁。
- Playwright e2e 本轮未执行。

#### 受环境阻塞

- 无外部权限阻塞。e2e 未执行是时间/范围选择，不是环境不可用；不以未执行结果冒充通过。

#### 实际修改文件（本轮全部提交）

- report/report.go、report/findings.go、report/report_test.go
- db/finding_traffic.go、db/finding_retests.go、db/intercept.go、db/intercept_recovery_test.go、db/intercept_provenance_test.go
- server/server.go、server/manager.go、server/report_test.go、server/report_related_test.go、server/intercept_recovery_test.go、server/retired_routes_test.go
- cmd/liora/main.go
- web/src/lib/api.ts、web/src/lib/report-error.ts、web/src/lib/report-error.test.mjs、web/src/pages/main/function/tasks/detail/_tabs/report-tab.tsx
- docs/DECISIONS.md、docs/CONTRACT.md、docs/DEMO-report.md、docs/DEMO-approval-recovery.md、docs/DEMO-approval-provenance.md、WORKLOG.md

#### 分支与提交

- feat/report-delivery：73944e7 + bffec34 → merge 370fc47
- feat/approval-recovery：9e335fa + a17d48c → merge 3e6f44e
- feat/approval-provenance：27919c6 + 63f913a → merge 3cae40b
- main 验收修复：eab8c51（G1 + gc 下线）、bb8e4fd（G2 边界）
- 未推送远端；未使用 force push。

#### 真实执行的测试

- go build ./...、go test ./... -count=1、go vet ./...：全部退出 0。
- cd web; npm run typecheck、npm test（10/10）、npm run build：全部退出 0。
- 真实进程：T5 在临时库完成 G2 重启复现；T4 在临时副本完成 1500 条/隔离/失败路径对抗测试。
- 未执行：npm run test:e2e、npm run check（基线 178 errors）。

#### 未解决风险与回滚路径

- node-only 历史发现：回滚为 revert eab8c51；若需并集实现，先补测试。
- 多进程 pending 误伤：回滚为移除 cmd/liora/main.go 的恢复调用；部署上保持单进程。
- 前端错误态：revert eab8c51 中的 web 文件即可恢复旧空态。
- 文档：revert 对应 docs 提交；docs/ 仍被 .gitignore 忽略，交付文档以 git add -f 跟踪。







---


---

## 2026-10-21 11:35 第三轮：整体功能逻辑与页面精细化（多会话并行）

- 时间戳：2026-10-21 11:35 +08:00（Asia/Shanghai）
- 用户指令：整体项目功能逻辑优化、底层功能设计、页面精细化休整；多开会话智能体全面完成；自行设定目标；以原子提交合入 main；不询问。
- 基线：main @ 26209ad；go build/test、npm run typecheck、npm test、npm run build 全绿；biome 基线 167 errors（CI 未启用，不作为门禁）。
- 工作区：10 个既有未跟踪根文件（_asar*.cjs、_ext*.cjs、_install.log*、_plugin-cli.js、_pm/、_t.tar.gz、tsc-out.txt），本轮不读取、不修改、不删除、不纳入提交。

### 目标冻结（G4—G7）

1. **G4 读取边界与故障可见性**：任何读取失败不得渲染成「没有数据」；客户端可控的 limit/size/游标必须有上限与校验。
2. **G5 数据一致性**：跨表写入必须同事务；不可回滚的文件删除不得放在数据库事务内。
3. **G6 前端四态与请求时序**：加载/失败/空/有数据四态分离；旧响应不得覆盖新响应；后台标签页停止轮询；重复提交必须被拦截。
4. **G7 底层共享与可观测性**：HTTP 边界（CORS、体积、panic、请求 id、5xx 日志）集中；任务生命周期 SQL 归位 db；LLM base URL 归一化唯一实现；handler 前奏去重。

三条取舍原则沿用上一轮，并新增第 4 条：
4. **宁可让用户看到「加载失败 + 重试」，也不能让故障显示成空列表。** 空态只属于「读取成功且确实没有数据」。

### 只读取证（3 个会话，结论均带 file:line）

- 前端：7 个页面把请求失败渲染成空态（tasks/page.tsx:513-532、tasks/detail/page.tsx:252-279、findings-tab.tsx:141-167、agents/page.tsx:225-230、intercept/page.tsx:419-430、assets/page.tsx:140-146、归档面板 1794-1806）；同一 /intercept/task 被两个组件每 5s 各轮询一次；skills/mcp 详情无请求序号；日志 SSE 无连接态；exploration-graph.tsx:160 使用真实 NUL 字节导致文件被判定为二进制。
- 后端：GET /api/intercept/task/{id} 默认分支无 LIMIT；conversations 的 since 解析失败静默归零；覆盖率 scope_rows 查询错误被丢弃；发现字段跨表双写无事务；归档恢复 rowExists 吞错；裁判配置 6 次独立写；证据 GC 在写事务内删文件；token 聚合缺时间索引；触发器 watermark 失败仍触发；资产来源写入失败被吞；500 响应无服务端日志（209 处仅 5 处有日志）。
- 架构：tasks 生命周期 SQL 在 server 与 db 两处；LLM base URL 归一化两份；26 处 task 查找、9 处 JSON 解码前奏、5 处路径 id 解析重复。

### 裁决（做/不做）

| 项 | 裁决 | 理由 |
| --- | --- | --- |
| 上述 P0/P1 缺陷 | 全部修复 | 直接违反 G4—G7 |
| 500 原因日志与请求 id | 做 | 故障无法关联是本轮审计最大可观测性缺口 |
| query token 限制到 SSE | 做 | URL 泄漏面收敛，前端只在这三类端点使用 |
| 日志 SSE 补 id 行 | 做 | 断线重连会从 since=0 重放，属真实缺陷 |
| 全仓 biome 重排 | 不做 | 基线 167 errors，CI 未启用；批量重排会淹没行为差异 |
| tasks/page.tsx 等大文件拆分 | 本轮不做 | 纯移动仍需逐块回归，留待专门一轮 |
| 前端时间/token 格式化统一 | 部分做 | 只统一逐字节相同的实现位置，显示差异保留并记录 |
| findings?task=unknown 改 404 | 不做 | 需要前端任务详情同步改，单独立项，已在 CONTRACT 8.7 记录 |
| 登录限流 | 不做 | 单管理员、默认 127.0.0.1，避免误锁；如需公网部署再立项 |
| agent_triggers 外键级联 | 不做 | 需要迁移已有库，收益低于本轮风险预算；已在 CONTRACT 待验证 |

### 执行方式与协调

- 3 个只读审计会话先产出证据；随后 7 个实施会话各占一个独立 git worktree 与分支（backend、backend2、backend3、frontend、frontend2、frontend3、frontend4），文件所有权互不重叠。
- 主会话负责：设定目标、裁决、在 main 上做跨切面小修、按主题合并、复验。
- 每个实施会话内部按主题拆原子提交；主会话对每个分支使用 --no-ff 合并，冲突只在 server/server.go（utils 迁移 vs 新增中间件）出现一次，已手工合并并复验。
- 并发上限 10 个会话，本轮峰值 5 个；审计会话在收到收敛指令后交付。

### 交付分支与合并

| 分支 | 内容 | 合并 |
| --- | --- | --- |
| feat/backend-hardening | HTTP 边界、读取边界、水位、资产来源 | 378fce0 |
| feat/ui-refine | 异步状态语义收敛（deriveAsyncView） | d527615 |
| refactor/shared-logic | 任务生命周期 SQL 归位、URL 归一化、httputil | b26cdb5 |
| fix/backend-data | 发现双写事务、恢复检查、裁判配置、索引 | 46fa428 |
| feat/ui-dashboard | 仪表盘部分失败、刷新计数、轮询可见性 | 0ebc3b6 |
| fix/ui-sequencing | 请求序号、可见性批量、日志连接态、a11y、NUL | a4690fd |
| fix/ui-error-states | 7 个页面四态、重复轮询上提、防重复提交 | 604192c |
| refactor/handler-preamble | taskOr404/decodeBody/pathInt 去重 | 80dfdc5 |
| main 直提 | 请求 id/失败日志、5xx 原因、query token 限制、日志 SSE id、发现读取 500、证据 GC 顺序 | 见 git log |

### 风险与回滚

- 回滚单位是 merge commit 或单个主题提交；不涉及数据迁移，回滚不需要改库。
- 行为变更点：无分页的 intercept 任务列表改为 100 条上限并带 truncated；query token 仅 SSE 可用；5xx 返回 500 而非 200 空数组；日志 SSE 帧新增 id 行。均已写入 CONTRACT 第 8 节。
- 已知未覆盖：浏览器手测未执行（e2e 覆盖了主要页面）；biome 基线未清理；大文件未拆分。

---

## 2026-10-21 12:32 第四轮：结构可维护性与剩余一致性（多会话并行）

- 时间戳：2026-10-21 12:32 +08:00（Asia/Shanghai）
- 基线：main @ 7b0b631；第三轮全部验证（go test / typecheck / npm test / build / e2e 62/62）通过。
- 用户指令：继续创建目标、多会话开炮。

### 目标冻结（G8—G11）

1. **G8 可维护性**：把超过 2000 行的页面拆成功能组件，行为不变，以 typecheck/build/e2e 验证。
2. **G9 一致性**：格式化、SSE 帧、分页解析、启动迁移各自只有一份实现。
3. **G10 数据完整性**：删除 Agent 与触发器同事务；批量删除资产有明确上限。
4. **G11 验证资产**：新增测试覆盖拆分与修复，补 race 检测。

### 多会话分工（6 个实施会话，峰值 6 ≤ 上限 10）

| 会话 | 分支 | 内容 |
| --- | --- | --- |
| tasks-split | feat/tasks-split | tasks/page.tsx 拆分 5 个组件 + task-format |
| format-lib | feat/format-lib | lib/format.ts + 9 处调用点收敛 |
| findings-split | feat/findings-split | findings 页拆分 + usePolling |
| db-seed | refactor/db-seed | 启动播种/工具迁移归位 db |
| trigger-integrity | fix/trigger-integrity | Agent 删除事务 + 资产批量上限 |
| sse-paging | refactor/sse-paging | SSE 写入器 + pageParams |

主会话并行完成：待审批角标按服务端 total 计数、侧栏角标后台暂停、初始化页加载态、文档与合并复验。

### 裁决

| 项 | 裁决 | 理由 |
| --- | --- | --- |
| tasks/findings 页面拆分 | 做 | 两个最大页面降到 1500 行以内，逐字搬移 |
| CategoryManagementSheet 继续外移 | 不做 | 当前 1456 行可接受，避免一次改动过大 |
| dashboard 的 2.0M 显示统一 | 不做 | 属显示变更，需产品确认 |
| assets-tab 的 fmtBytes（log 分档） | 不做 | 与共享实现不同，强并会改变显示 |
| findings?task=unknown 改 404 | 不做 | 需前端同步，仍列为已知偏差 |
| 历史孤儿触发器回填清理 | 不做 | 需要一次数据迁移；本轮保证删除路径不再产生新孤儿 |
| 全仓 biome 格式化 | 不做 | 基线仍非 clean，批量重排淹没行为差异 |

### 交付分支与合并

| 分支 | 合并 |
| --- | --- |
| refactor/sse-paging | 9882fdd |
| fix/trigger-integrity | 9e6a2c0 |
| refactor/db-seed | 5af08f1 |
| feat/format-lib | 6f4aec2 |
| feat/tasks-split | 796436d |
| feat/findings-split | 42701b5 |

### 验证

- go build ./...、go vet ./...、go test ./... -count=1：全绿（15 包）。
- go test -race ./server -count=1：通过（34.5s）。
- npm run typecheck、npm test（26/26）、npm run build：通过。
- npm run test:e2e：62 passed / 0 failed（rsbuild + embedded，3.0m）。
- 真实进程冒烟：health/401/预检/内嵌 SPA/深链/404/安全头（第三轮已验，本轮后端改动未触及这些路径）。

### 风险与回滚

- 拆分均为逐字搬移，回滚单个 merge commit 即可；不涉及数据迁移。
- Agent 删除失败从 200 变为 500，是刻意的契约变化（CONTRACT 9.1）。
- 资产删除 >5000 从可能 500 变为明确 400（CONTRACT 9.2）。
- 页面拆分后的轮询相位与资产视图空 tick 已记录在 CONTRACT 9.7。

---

## 2026-10-21 13:40 第五轮：运行时体验与健壮性（多会话并行）

- 时间戳：2026-10-21 13:40 +08:00（Asia/Shanghai）
- 基线：main @ 35fd62b；第四轮验证（go test / typecheck / npm test / build / e2e 62/62）通过。
- 用户指令：继续干，没说停不许停。

### 目标冻结（G12—G16）

1. **G12 页面结构**：拆分 sessions-tab 与 dashboard 两个大页面，行为不变。
2. **G13 轮询统一**：所有数据轮询走 usePolling（隐藏暂停、重叠跳过、主体切换立即刷新）。
3. **G14 后端健壮性**：历史孤儿触发器清理、调度器存在性校验、未知任务显式 404。
4. **G15 系统页体验**：LLM/MCP/工具/技能的失败态、防重复提交与可访问性。
5. **G16 验证资产**：新增 10 个 e2e 回归用例（失败态、部分失败、刷新保留内容、过期会话提示）。

### 多会话分工（6 个实施会话，峰值 6 ≤ 上限 10）

| 会话 | 分支 | 内容 |
| --- | --- | --- |
| sessions-split | feat/sessions-split | 会话页 2120 → 1220 行 + 6 处轮询统一 |
| dashboard-split | feat/dashboard-split | 仪表盘 1351 → 379 行 + 三源轮询 |
| polling-adopt | feat/polling-adopt | 任务列表/详情/漏洞/资产轮询 + 任务缺失提示 |
| backend-robust | fix/backend-robust | 孤儿触发器清理、调度器校验、findings 404 |
| system-pages | feat/system-pages | LLM/MCP/工具/技能失败态与 a11y |
| e2e-regression | test/e2e-regression | 新增回归用例（由主会话接手完成） |

执行偏差（如实记录）：本轮 6 个会话在运行中因主机内存/页面文件耗尽被中断，其中 4 个已完成改动但未提交、1 个（仪表盘）停在组件已抽出但页面未接线、e2e 会话未产出。主会话接手完成：仪表盘接线与轮询替换、MCP 缺失的 renderVisibility、所有未提交改动的验证与原子提交、e2e 用例编写与调试。

### 裁决

| 项 | 裁决 | 理由 |
| --- | --- | --- |
| 仪表盘继续拆分到 <400 行 | 做 | 组件已抽出，接线后 379 行 |
| 会话页继续拆分 | 不做 | 1220 行且逻辑内聚，再拆收益递减 |
| 历史孤儿触发器回填 | 做（启动清理） | 一条幂等 DELETE，风险低 |
| 调度器删除孤儿行 | 不做 | 删除职责归启动清理，调度器只跳过 |
| findings?task 404 | 做 | 前端已能区分「任务不存在」 |
| 全仓 biome 格式化 | 不做 | 基线仍非 clean |

### 交付分支与合并

| 分支 | 合并 |
| --- | --- |
| fix/backend-robust | 5a235fb |
| feat/polling-adopt | fe2a708 |
| feat/system-pages | 05e91f5 |
| feat/sessions-split | 91ef965 |
| feat/dashboard-split | c0c0309 |
| test/e2e-regression | 由主会话直接提交（cf2b6ed、ef92033、1dcce3b） |

### 验证

- go build ./...、go vet ./...、go test -p 1 ./... -count=1：15 包全绿（并行编译在内存紧张时会触发工具链 OOM，故用 -p 1 复验）。
- npm run typecheck、npm test（29/29，含 format/task-not-found 等新增用例）、npm run build：通过（构建偶发 rspack os error 1455，重试通过，属主机内存限制）。
- npm run test:e2e：72 passed / 0 failed（62 原有 + 10 新增，rsbuild + embedded）。
- 新增用例覆盖：过期会话提示、任务列表失败态、发现列表失败态、仪表盘部分失败、刷新期间保留列表内容。

### 风险与回滚

- 页面拆分是逐字搬移，回滚对应 merge commit 即可。
- findings 未知任务从 200 [] 改为 404 是契约变化（CONTRACT 10.1），前端已同步。
- 启动清理孤儿触发器只删除 agent 已不存在的行；回滚为移除调用。
- 已知偏差：仪表盘 token 仍为 2.0M 风格；请求序号只丢弃旧响应，不取消在途请求。

---

## 2026-10-21 14:56 第六轮：查询效率与错误可定位（多会话并行）

- 时间戳：2026-10-21 14:56 +08:00（Asia/Shanghai）
- 基线：main @ 5a8d0ff；第五轮验证（go test / typecheck / npm test / build / e2e 72/72）通过。
- 用户指令：没让停就持续优化。

### 目标冻结（G17—G20）

1. **G17 查询效率**：/api/stats 不再全量读取节点，改 SQL 聚合。
2. **G18 错误可定位**：5xx 前端提示携带请求 ID；API 不缓存；静态资源可长期缓存；跨源可读请求 ID。
3. **G19 前端复用**：资产页与任务资产页的重复展示组件收敛。
4. **G20 可访问性**：资产/漏洞详情/会话详情/会话列表的真实可访问名缺口。

### 多会话分工（4 个实施会话，峰值 4）

| 会话 | 分支 | 内容 |
| --- | --- | --- |
| backend-stats | perf/stats-counts | KindStateCounts + stats handler + 测试 |
| request-id | feat/request-id | withRequestId + http() 5xx 附加 id + 测试 |
| asset-cells | refactor/asset-cells | asset-cells.tsx 抽取（MethodBadge/statusTone/Chips/PAGE_SIZES/assetLabel） |
| a11y | a11y/asset-finding-session | 9 处可访问名/状态文本 |

主会话并行完成：API no-store、静态资源 immutable 缓存、CORS 暴露 X-Request-Id。

### 裁决

| 项 | 裁决 | 理由 |
| --- | --- | --- |
| 合并两份 AssetCard | 不做 | 分页/多选/空态结构不同，合并会改变视觉 |
| stats 失败返回 500 | 做 | 与「读失败显式化」原则一致 |
| 4xx 也附请求 ID | 不做 | 参数错误无需对日志，避免噪音 |
| 跨源 Expose-Headers | 做 | 否则跨源部署读不到 id |

### 交付分支与合并

| 分支 | 合并 |
| --- | --- |
| feat/request-id | f422281 |
| refactor/asset-cells | d170219 |
| perf/stats-counts | 224a83a |
| a11y/asset-finding-session | dcd8606 |
| main 直提 | 98dd00a（静态缓存）、12e6b05（CORS 暴露 id）、9f99a8b（API no-store） |

### 验证

- go build ./...、go vet ./...、go test -p 1 ./... -count=1：15 包全绿。
- npm run typecheck、npm test（33/33）、npm run build：通过。
- npm run test:e2e --project=embedded：36 passed / 0 failed（完整套件）。
- npm run test:e2e --project=rsbuild：受主机提交内存耗尽阻塞。rspack dev server 多次 panic（unable to allocate fiber: 页面文件太小, os error 1455），表现为部分用例通过后 ERR_CONNECTION_REFUSED 或懒加载 chunk 卡在「正在加载…」；同一主机在第五轮曾完整通过 72/72，属环境退化而非代码回归。分块运行仅 chunk 3（mui-system/mui-editors/mui-controls）10/10 通过，其余块在 panic 后中断。

### 风险与回滚

- stats 语义变化（错误由 0 变 500）已写入 CONTRACT 11.1；回滚对应 merge。
- asset-cells 的 Chips dense 参数保留两页原有字号；未做浏览器视觉回归，e2e 覆盖资产页交互。
- 请求 ID 只改 http()；fetchBlobText 等直连请求不带 id。

---

## 2026-10-21 15:29 第七轮：安全与查询效率（多会话并行）

- 时间戳：2026-10-21 15:29 +08:00（Asia/Shanghai）
- 基线：main @ febdd16；第六轮 Go 测试全绿、typecheck/npm test 通过、embedded e2e 36/36。
- 用户指令：持续优化。

### 目标冻结（G21—G24）

1. **G21 认证安全**：登录失败按 IP 限流，返回 429 与 Retry-After。
2. **G22 查询效率**：状态计数使用覆盖索引，EXPLAIN 断言固定。
3. **G23 可维护性**：server.go 拆分 findings/stream handler（纯移动）。
4. **G24 可访问性**：设置/日志/MCP/技能/工具页剩余可访问名缺口。

### 多会话分工（4 个实施会话，峰值 4）

| 会话 | 分支 | 内容 |
| --- | --- | --- |
| login-throttle | feat/login-throttle | 内存限流 + 4 个测试 |
| stats-index | perf/stats-index | 覆盖索引 + EXPLAIN + benchmark |
| server-split | refactor/server-split | findings/stream handler 纯移动 |
| a11y-remaining | a11y/system-remaining | 4 个系统页可访问名 |

执行偏差：a11y 会话在验证阶段被主机内存阻塞，改动已就绪但未提交；主会话执行 typecheck 后代为提交并合并。

### 裁决

| 项 | 裁决 | 理由 |
| --- | --- | --- |
| 登录限流窗口/阈值 | 5 分钟 / 5 次 | 常规阈值，单管理员场景足够 |
| 解析 X-Forwarded-For | 不做 | 信任边界未定义，贸然解析可被伪造 |
| 删除旧索引 idx_expnodes_part | 不做 | 其它查询仍可复用前缀 |
| server.go 继续拆到 <3000 | 本轮不做 | 需动 activity/traffic 等未授权 handler |

### 交付分支与合并

| 分支 | 合并 |
| --- | --- |
| feat/login-throttle | f8923de |
| perf/stats-index | faa8b01 |
| refactor/server-split | 247254d |
| a11y/system-remaining | f3487a9 |

### 验证

- go build ./...、go vet ./...、go test -p 1 ./... -count=1：15 包全绿（含新增限流、索引计划、拆分后 handler 测试）。
- go test -race ./server -run TestLoginThrottle：通过（由实施会话执行）。
- npm run typecheck：exit 0；npm test：33/33。
- npm run build：**受主机提交内存耗尽阻塞**（rspack panic: unable to allocate fiber, 页面文件太小 os error 1455，多次重试与关闭 buildCache、限制 Node 堆均无效）。同一命令在本轮合并 a11y 之前曾成功；a11y 改动仅为 aria 属性且 typecheck 通过。
- e2e：本轮未执行（依赖 build:embed，同上被阻塞）。

### 风险与回滚

- 登录限流：NAT 后共用额度可能造成 5 分钟拒绝；反向代理需在代理侧限流。回滚为 revert f8923de。
- 覆盖索引：10 万节点约 +2.5MB、写入 +12.8%，读取约 4.5×；回滚为 DROP INDEX。
- server 拆分：纯移动，回滚为 revert 247254d。
- 主机内存限制需重启后复跑 build 与 e2e。
