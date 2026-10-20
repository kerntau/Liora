# 演示：任务报告交付完整性（G1）

> 对应决策：docs/DECISIONS.md 的 G1；契约：docs/CONTRACT.md 3.1。
> 本演示分两条路径：A 为无需 LLM、可重复的自动化路径；B 为需要已配置模型与流量捕获的界面路径。
> 未执行的部分不得写成已通过。

## A. 自动化路径（当前环境可跑通）

### 前置条件

- Windows 10/11，Go 1.26.5。
- 仓库根目录 C:\Users\Kerntau\Desktop\Liora。
- 不读取、不写入 data/liora.db；测试使用 LIORA_SQLITE_PATH 临时库。

### 步骤与预期

1. 运行渲染单测：

   go test ./report -count=1 -v

   预期：全部通过；覆盖空报告、排序、状态、流量、复测、过期报告、标题换行、导出共用块、CSV 状态。

2. 运行报告接口测试：

   go test ./server -run TestReport -count=1 -v

   预期 4 项通过：
   - TestReportIncludesFindingsTableRows：仅存在于 findings 表的发现出现在报告，状态为「待处理」。
   - TestReportIncludesBoundTrafficEvidence：报告出现「## 关联流量证据」、证据编号、proof、URL、状态码与说明。
   - TestReportIncludesLatestCompletedRetest：报告出现「复测：已复现」与复测摘要。
   - TestReportReturns500WhenFindingsReadFails：数据库关闭后返回 500，且响应不含「本次未确认漏洞」。

3. 失败判定：任一测试失败；或 500 用例返回 200；或报告缺少上述任一片段。

### 真实数据只读核对（不修改业务库）

只读查询 data/liora.db 的结果（2026-10-21 02:03）：

- findings 6 条，全部关联任务。
- 探索图 finding 节点 6 个，与 findings 行一一对应，缺失 0。
- 6 条发现全部已有流量绑定。
- 结论：旧报告在这份真实数据上会漏掉 6/6 的流量证据；新实现按 findings 表读取。

## B. 界面路径（需要已配置模型与流量捕获）

### 前置条件

- 已按 README 启动后端与前端（dev.bat 或 go run ./cmd/liora + npm run dev）。
- 已配置可用模型；已开启流量捕获；目标在授权范围内。
- 测试目标必须是本地或明确授权的环境。

### 步骤

1. 新建任务，等待 Worker 登记一条漏洞并绑定流量证据（或在已有任务的漏洞详情中手动绑定）。
2. 打开任务详情 → 报告页签。
3. 预期看到：
   - 「数据来源：发现记录 N 条」。
   - 每条发现的「状态」「类别」「发现时间」。
   - 存在已完成复测时显示「复测：…」。
   - 存在绑定流量时显示「## 关联流量证据」，含用途、方法、URL、状态码。
4. 点击「下载 Markdown」，文件名 liora-report-<taskId>.md，内容与页面一致。
5. 与「漏洞结果」页同一任务下的发现数量核对：数量与条目必须一致。

### 失败与回滚

- 若报告页显示错误而不是内容：查看后端日志的「读取发现失败/读取流量证据失败/读取复测结论失败」，这是预期的显式失败，不是空报告。
- 回滚：git revert 73944e7，恢复旧的图节点报告。
- 安全清理：演示产生的任务与证据只存在于演示数据库；不要对 data/liora.db 执行业务写入。
