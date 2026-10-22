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

[T11][13:40] 第五轮启动：运行时体验与健壮性｜6 个实施会话｜峰值 6 并发
[T11.1][13:52] 会话页拆分｜2120 → 1220 行 + 6 处轮询统一｜typecheck/test/build 0｜merge 91ef965
[T11.2][13:55] 孤儿触发器清理与调度器校验｜启动 DELETE + 每 tick 存在性过滤｜db/server 测试全绿｜merge 5a235fb
[T11.3][13:58] 任务页轮询统一｜列表/详情/待审批/漏洞/资产改 usePolling；未知任务 404 提示｜typecheck/test/build 0｜merge fe2a708
[T11.4][14:02] 系统页收尾｜LLM 池状态失败可见、MCP 授权失败、工具旁路数据、技能删除确认｜typecheck/test/build 0｜merge 05e91f5
[T11.5][14:18] 仪表盘拆分｜1351 → 379 行，11 个组件 + usePolling｜typecheck/test/build 0｜merge c0c0309
[T11.6][14:24] e2e 回归｜新增 5 个用例 × 双模式｜首次调试修正 token 前置与可访问名定位｜10/10 通过
[T11.7][14:44] 全量复验｜go test -p 1 ./... 15 包全绿；typecheck 0；npm test 29/29；build 0；e2e 72/72｜命令输出｜第五轮交付完成

[T12][14:56] 第六轮启动：查询效率与错误可定位｜4 个实施会话｜峰值 4
[T12.1][15:00] API no-store｜/api/* 响应禁止缓存，SPA 静态资源不受影响｜server 测试通过｜提交 9f99a8b
[T12.2][15:01] 静态资源缓存｜/static/* immutable 一年，index 仍 no-cache｜测试通过｜提交 98dd00a
[T12.3][15:02] CORS 暴露请求 ID｜跨源可读 X-Request-Id｜测试通过｜提交 12e6b05
[T12.4][15:03] 5xx 请求 ID｜withRequestId + http() 包装 + 4 个用例｜typecheck/test/build 0｜merge f422281
[T12.5][15:04] 资产组件去重｜asset-cells.tsx，两页显示不变｜typecheck/build/test 0｜merge d170219
[T12.6][15:06] stats SQL 聚合｜KindStateCounts + 500 语义 + 2 个测试｜go test db/server 全绿｜merge 224a83a
[T12.7][15:08] 可访问性｜资产勾选/分页、漏洞详情下拉、会话附件与当前项｜typecheck/build/test 0｜merge dcd8606
[T12.8][15:20] e2e 复验｜embedded 36/36 通过；rsbuild 受主机内存阻塞（rspack panic os error 1455），分块仅 mui-system/editors/controls 10/10 通过｜命令输出｜环境限制，已记录

[T13][15:29] 第七轮启动：安全与查询效率｜4 个实施会话｜峰值 4
[T13.1][15:31] 登录限流｜5 分钟/5 次，429 + Retry-After，成功清零｜4 个测试 + race 通过｜merge f8923de
[T13.2][15:33] 状态计数覆盖索引｜idx_expnodes_kind_state，EXPLAIN 命中 COVERING INDEX｜go test ./db 全绿｜merge faa8b01
[T13.3][15:36] server.go 拆分｜3685 → 3169 行，findings/stream 纯移动｜go test ./server 全绿｜merge 247254d
[T13.4][15:45] 系统页可访问性｜日志级别、MCP 传输、技能调用、工具绑定｜typecheck 0｜merge f3487a9
[T13.5][15:48] 前端构建受阻｜rspack panic os error 1455（主机提交内存耗尽），重试/关缓存/限堆均无效｜记录为环境限制｜待重启后复跑 build 与 e2e

[T14][15:55] 第八轮启动：认证错误与性能基线｜2 个实施会话 + 1 个只读审计｜峰值 3
[T14.1][16:05] 认证错误收敛｜init/change-password 通用 500，登录读配置失败不计限流｜db/server 测试全绿｜已合并
[T14.2][16:06] DB 关闭优化｜PRAGMA optimize + wal_checkpoint(TRUNCATE)｜db 测试全绿｜已合并
[T14.3][16:12] 热点基准｜四个 benchmark 统一到 bench_hot_paths_test.go｜1x 基线记录｜已合并
[T14.4][16:13] 前端构建复测｜仍因主机提交内存耗尽失败（os error 1455）｜记录环境限制｜待重启
[T14.5][16:14] traffic/agent 审计｜首个会话被中断无产出，已重新发起只读审计｜等待结论

[T15][16:30] 第九轮：运维可见性与保留（主会话直提，审计会话连续中断）
[T15.1][16:32] 日志保留｜PruneServerLogs 保留 10 万行 + 边界测试｜db 测试全绿｜提交 e8eb732
[T15.2][16:34] 健康检查｜/api/health 增加 database ok/error/unavailable｜db/server 测试全绿｜提交 7b592c7
[T15.3][16:40] 全量复验｜go build/vet/test -p 1 15 包全绿｜命令输出｜前端构建仍受主机内存阻塞

[T16][16:45] 第十轮：LLM 保留期｜llm_usage 365 天、llm_records 30 天，启动清理 + 边界测试｜go test -p 1 ./... 全绿｜提交 5e80136
[T16.1][16:50] 收尾｜清理调试产物（web/*-debug.txt），工作区仅剩 10 个既有未跟踪文件｜git status｜本轮结束

[T17][17:00] 项目收尾｜删除 3 个已合并分支；10 个本地残留写入 .gitignore；工作区干净｜git branch/worktree/status｜待 gc
[T17.1][17:02] 仓库整理｜git gc --prune=now；fsck 无错误；松散对象打包｜git count-objects/fsck｜Git 记录规整完成

[T17.2][17:05] 收尾复验｜npm run build 成功；build:embed 成功；e2e embedded 36/36、rsbuild 36/36｜命令输出｜此前内存阻塞已消除

[T18][17:15] 第十一轮启动：UI 交互细节｜4 个实施会话｜峰值 4
[T18.1][17:30] 任务列表/共享原语｜页码收敛、搜索焦点、批量失败保持、防重复提交、未处理拒绝｜typecheck/build/test 0｜merge d6e5aeb
[T18.2][17:35] 资产/发现｜窄屏工具栏、提交锁、失败态保留旧数据、DSL 候选滚动、焦点环｜typecheck/build/test 0｜merge 3480e2e
[T18.3][17:36] 任务详情/会话｜自动贴底、发送/停止反馈与回焦、旁路焦点、审批 pending、方向键｜typecheck/build/test 0｜merge 2a61b25
[T18.4][17:37] 系统页/侧栏｜移动端收起、页签保活、内联校验、IME 回车、未保存确认、日志键盘滚动｜typecheck/build/test 0｜merge 0d6a9bf
[T18.5][17:40] 合并复验｜typecheck 0；npm test 33/33；build 成功；build:embed 成功｜命令输出｜e2e 运行中
[T18.6][17:46] e2e 复验｜embedded 36/36、rsbuild 36/36（合计 72/72）｜命令输出｜第十一轮交付完成

## 2026-10-22

[T19][00:11] 第十二轮启动：按用户参考图整体重做 UI/布局｜7 个并行子代理（任务列表、任务详情外壳、详情页签、漏洞/资产、系统配置、Skills/工具/拦截、登录/杂项）+ 主会话公共层与总览｜目标：功能全保留，只改界面与交互
[T19.1][00:40] 公共层落地｜深蓝侧栏、白底顶栏+信息条、PageHeader/SectionCard/Donut/MetricRow、卡片/按钮/表格/页签/状态胶囊令牌化｜typecheck 0
[T19.2][00:55] 总览驾驶舱｜当前项目/运行阶段/目标范围/Agent 编排/资源/覆盖/发现/系统状态/证据表；旧面板完整保留在「系统数据看板」｜截图 1440/390
[T19.3][01:20] 子代理页面改版陆续完成｜任务列表、任务详情九页签、漏洞/资产、系统 9 页、Skills/工具/拦截/审批、登录/初始化/404/对话详情｜各页 1440/390 截图无溢出
[T19.4][01:55] 全量 e2e 首跑｜28 passed / 8 failed（仪表盘面板被页签隐藏、移动端头部 44px、账户菜单 strict、主题对比度、自定义工具同名按钮）｜逐项修复
[T19.5][02:10] 修复与复跑｜仪表盘改为驾驶舱+数据看板顺序渲染、primary #2b64f5、深色 primary 深字、移动端头部 44px、工具空态按钮改名、账户 trigger 独立 data-slot｜相关 25 例全绿
[T19.6][02:12] 全量 e2e｜rsbuild 36/36 通过；typecheck 0；npm run build 成功
[T19.7][02:40] 平板/深色审计｜768 下仪表盘栅格 min-w-0、编排 2×2、证据工具栏堆叠、头部按 xl 收敛；1440/1024/768/390/375 浅深色均无页面级横滚
[T19.8][02:50] 最终复验｜rsbuild e2e 36/36；typecheck 0；build 成功；设计规范归档 docs/UI改版-深蓝控制台-2026-10.md｜本轮 UI 改版交付

[T20][03:20] 第十三轮：按参考图二次收敛驾驶舱｜主会话直改｜目标：更少侧栏/顶栏噪声、无总览页头、三卡右栏、单表证据区
[T20.1][03:30] 侧栏收敛｜216px、仅品牌图标、平铺导航+细分隔线、移除侧栏账户卡、底栏山形剪影｜截图 1440
[T20.2][03:40] 顶栏收敛｜搜索改图标并移入右侧动作组、品牌「灵探」提升、信息条精简｜375 头部四按钮 44px、无溢出
[T20.3][03:50] 总览收敛｜移除 PageHeader、刷新/新建移入项目卡、右栏 4→3 卡、编排加宽与阶段块放大、证据页签改类型下拉｜截图 1440/375
[T20.4][04:05] 回归修复｜账户菜单顺序改为「修改密码→退出登录→当前账户」，兼顾 ui-controls 与 ui-navigation；主题按钮恢复移动端可见｜migration 通过
[T20.5][04:30] 全量 e2e｜rsbuild 36/36；typecheck 0；build 成功｜本轮收敛交付
