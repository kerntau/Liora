# Liora 工作日志

> 只追加真实执行事实。格式：[T#][时间] 动作｜结果｜验证｜后续依赖
> 决策与理由见 docs/DECISIONS.md；共享契约见 docs/CONTRACT.md。

## 2026-10-21

[T0][01:45] 建立 docs/DECISIONS.md｜完成｜文件存在，含初始工作区快照｜无
[T0][01:51] 复核仓库状态与工具链｜main @ 3e4894e，9 个未跟踪根文件；Go 1.26.5 / Node 22.19.0｜git status、go version｜基线取证
[T0][01:53] 运行基线自检｜go build 通过；go test ./... 14 包通过（report 无测试）；npm typecheck 通过；npm test 7/7 通过｜命令退出码｜目标冻结
[T0][01:54] 运行 go vet 与 biome check｜vet 通过；biome 178 errors（import 排序为主，CI 未启用）｜命令输出｜记录为已知基线
[T0][02:03] 只读核验 data/liora.db｜findings 6、graph finding 6、缺失 0、6 条均有流量绑定、pending 审批 0｜Python sqlite3 mode=ro｜G1 目标依据
[P0-P3][02:05] 冻结 G1/G2/G3 与三条取舍原则，完成裁决与方向排序｜完成｜docs/DECISIONS.md 已追加｜进入 P4
[P0-P3][02:10] 建立 docs/CONTRACT.md 与 WORKLOG.md｜完成｜文件存在｜施工前契约冻结

[T1][02:10] feat/report-delivery 实现报告同源与证据渲染｜完成｜go test ./report ./server ./db ./agent 全绿；提交 73944e7｜T2

[T2][02:15] feat/approval-recovery 启动收敛遗留 pending｜完成｜go test ./... 全绿；提交 9e335fa｜T3

[T3][02:19] feat/approval-provenance 规则名回退审计快照｜完成｜go test ./... 全绿；提交 27919c6｜多会话验收

[P4.1][02:22] 按用户要求改为真实多会话｜启动 T4/T5/T6 三个 subagent 只读验收线程；主会话暂停改源码｜subagent 已激活｜等待验收结论

[T6][02:23] 前端/构建独立验收｜构建通过（typecheck 0、npm test 7/7、build 0）；G1 前端闭环 FAIL（500 显示「暂无报告」）；CONTRACT 行号/口径 6 处不一致｜subagent 只读报告｜待修复
[T5][02:25] G2/G3 独立验收｜G2 核心 PASS（真实重启实测）、G3 PASS；发现 audit 为数组时恢复整批失败；实测多进程会误伤另一实例的 pending｜subagent 只读报告｜待修复 audit 数组边界
[T4][02:30] G1 独立验收｜冻结口径 PASS（1500 条无截断、三处 500、流量/复测/隔离实测）；严格任务 Tab 口径 FAIL（继承/node-only、资产全局、未知 severity、变量上限）｜subagent 只读报告｜待修复
[T7][02:36] 修复验收缺口｜资产按任务统计、关联发现单列、severityRank、状态分布、批量 500、audit 数组 CASE、/api/gc 下线、前端错误态｜go test ./... 与 npm typecheck/test/build 全绿｜提交 eab8c51、bb8e4fd
[T8][02:42] 最终复验｜go test ./... TEST_EXIT=0；go vet 0；typecheck 0；npm test 10/10；build 0｜命令输出｜文档收尾



[T9][11:35] 第三轮启动：多会话并行｜3 个只读审计（前端/后端/架构）+ 7 个实施 worktree｜基线全绿｜G4—G7 冻结
[T9.1][11:40] 后端 HTTP 边界收敛｜CORS 授权头、panic 兜底、JSON 2MiB、安全头、IdleTimeout｜5 个中间件测试｜merge 378fce0
[T9.2][11:45] 读取边界修复｜拦截任务默认分页 100、会话游标 400、覆盖率错误、水位失败跳过、资产来源可审计｜2 个回归测试｜同上
[T9.3][11:52] 请求 id 与失败日志｜X-Request-Id、5xx/慢请求日志、writeErr 记录 5xx 原因、SSE 保留 Flusher｜6 个测试｜提交 637352a、0031cc7
[T9.4][11:56] 异步状态语义收敛｜status 表示数据可用性、refreshing 非遮挡、deriveAsyncView 纯函数｜typecheck/test/build 0｜merge d527615
[T9.5][11:58] 底层共享归位｜任务生命周期 SQL 移入 db、NormalizeBaseURL 唯一实现、httputil.go｜go test ./db ./agent ./server 全绿｜merge b26cdb5（手工解冲突）
[T9.6][12:01] 数据一致性｜发现双写事务、rowExists 返回错误、裁判配置单事务、token 聚合索引｜EXPLAIN 断言通过｜merge 46fa428
[T9.7][12:01] 仪表盘容错｜settleAll 部分失败、代次刷新计数、隐藏标签页停轮询｜typecheck/test/build 0｜merge 0ebc3b6
[T9.8][12:06] 前端时序与 a11y｜skills/mcp 请求序号、可见性批量、日志连接态、aria-label、NUL 转义｜typecheck/test/build 0｜merge a4690fd
[T9.9][12:11] 页面四态｜7 个页面失败不再显示空态、待审批轮询上提、暂停防重复提交｜typecheck/test/build 0｜merge 604192c
[T9.10][12:12] handler 前奏去重｜taskOr404 26 处、decodeBody 9 处、pathInt 5 处｜go build/vet/test 全绿｜已合并
[T9.11][12:10] e2e 首跑｜60 passed / 2 failed，均为会话过期跳转期望 /login$ 未包含 ?expired=1｜已修正期望，待复跑
[T9.12][12:20] e2e 复跑｜62 passed / 0 failed（rsbuild + embedded 双模式），3.2m｜E2E_EXIT=0｜覆盖登录过期跳转、深链、SSE、移动端、控件与主题
[T9.13][12:22] 最终复验｜go build 0；go vet 0；go test ./... 15 包全绿；npm typecheck 0；npm test 10/10；npm run build 0；npm run test:e2e 62/62｜命令输出｜本轮交付完成

[T10][12:32] 第四轮启动：结构可维护性｜6 个实施会话（tasks/findings 拆分、format、SSE/分页、db 播种、触发器完整性）｜峰值 6 并发
[T10.1][12:35] 待审批角标修正｜改为 status=pending 显式分页 + 服务端 total，避免 100 条分页漏计｜typecheck/build 0｜提交 eb4383b
[T10.2][12:36] 侧栏角标后台暂停｜隐藏停表、可见补拉、请求串行｜typecheck/build 0｜提交 0b237be
[T10.3][12:38] 初始化页加载态｜检查期间显示文案不再白屏｜typecheck 0｜提交 8de00dc
[T10.4][12:46] SSE 与分页统一｜sseWriter 三种流帧字节不变、pageParams 16 例表驱动｜go test ./server 全绿｜merge 9882fdd
[T10.5][12:47] 删除完整性｜Agent+触发器同事务、资产批量 json_each + 5000 上限｜db/server 测试全绿｜merge 9e6a2c0
[T10.6][12:49] 播种归位｜复测 Agent 与工具迁移移入 db，SQL 字节级一致｜go test ./db ./server 全绿｜merge 5af08f1
[T10.7][12:51] 格式化收敛｜lib/format + 10 个测试；9 个调用点替换｜typecheck/test/build 0｜merge 6f4aec2
[T10.8][12:52] 任务页拆分｜3301 → 1456 行，7 个文件，逐字搬移校验缺失 0 行｜typecheck/test/build 0｜merge 796436d
[T10.9][12:53] 发现页拆分｜1427 → 1057 行 + usePolling 统一三处轮询｜typecheck/test/build 0｜merge 42701b5
[T10.10][12:55] 格式化收尾｜任务页改用 lib/format、findings 移除过渡再导出｜typecheck/test/build 0｜提交 f3eeb5d、7aa7063
[T10.11][12:56] 全量复验｜go build/vet/test 15 包全绿；go test -race ./server 通过（34.5s）｜命令输出｜e2e 待跑
[T10.12][13:00] e2e 复跑｜62 passed / 0 failed（rsbuild + embedded，3.0m）｜E2E_EXIT=0｜第四轮交付完成
