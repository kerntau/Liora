# 演示：审批生命周期恢复（G2）

> 对应决策：docs/DECISIONS.md 的 G2；契约：docs/CONTRACT.md 5.2。
> 目标：证明进程重启后，遗留的 pending 审批会被收敛为终态，而不是永远显示「待审批」。

## A. 自动化路径（当前环境可跑通）

1. 数据库层：

   go test ./db -run TestRecoverInterceptPending -count=1 -v

   预期：TestRecoverInterceptPendingSettlesOnlyPendingRows 通过。它验证：
   - 2 条 pending 被收敛为 timeout，decided_at 已写入；
   - audit 的 effective_action=deny、execution_status=not_executed、decision_reason 含「服务重启」；
   - 原有 rule_name 快照保留；
   - 已 allowed 的终态行不被改写；
   - 第二次执行影响 0 行（幂等）。

2. Manager 委托层：

   go test ./server -run TestManagerRecoversPendingIntercepts -count=1 -v

   预期：通过，status 变为 timeout。

3. 失败判定：任一测试失败；pending 仍存在；终态行被改写；审计原因丢失。

## B. 真实进程路径（临时库，不接触业务库）

前置：Go 1.26.5、Python 3（或任意 sqlite3 客户端）。

1. 创建临时目录并首次启动，生成 schema：

   $tmp = Join-Path $env:TEMP "liora-recover-demo"
   New-Item -ItemType Directory -Force $tmp | Out-Null
   $env:LIORA_SQLITE_PATH = Join-Path $tmp "demo.db"
   go run ./cmd/liora -addr 127.0.0.1:18788 -proxy 127.0.0.1:0 -data $tmp
   # 看到监听日志后 Ctrl+C

2. 写入造数脚本并插入一条 pending（模拟崩溃前未处理的审批）：

   $seed = Join-Path $tmp "seed.py"
   @'
   import json, os, sqlite3
   p = os.path.join(os.environ["TEMP"], "liora-recover-demo", "demo.db")
   c = sqlite3.connect(p)
   audit = {"correlation": "exact", "initial_action": "ask", "rule_name": "演示规则", "execution_status": "not_started"}
   c.execute(
       "INSERT INTO intercept_pending(task_id,agent_name,tool_name,tool_input,reason,status,audit) VALUES(?,?,?,?,?,?,?)",
       ("demo", "worker", "Bash", '{"command":"id"}', "需要审批", "pending", json.dumps(audit)),
   )
   c.commit()
   print("inserted")
   '@ | Set-Content -Encoding UTF8 $seed
   python $seed

3. 再次启动：

   go run ./cmd/liora -addr 127.0.0.1:18788 -proxy 127.0.0.1:0 -data $tmp

   预期日志出现：已失效 1 条重启前遗留的待审批记录（按拒绝处理）。

4. 只读核对：

   $check = Join-Path $tmp "check.py"
   @'
   import os, sqlite3
   p = os.path.join(os.environ["TEMP"], "liora-recover-demo", "demo.db")
   c = sqlite3.connect(p)
   print(c.execute("select status, decided_at, audit from intercept_pending where task_id='demo'").fetchall())
   '@ | Set-Content -Encoding UTF8 $check
   python $check

   预期：status=timeout，decided_at 非空，audit 含 decision_reason=服务重启，审批已失效（按拒绝处理）。

5. 清理：

   Ctrl+C；Remove-Item -Recurse -Force $tmp；Remove-Item Env:LIORA_SQLITE_PATH

## 回滚

- 代码回滚：git revert 9e335fa，移除 cmd/liora/main.go 中的恢复调用即可恢复旧行为。
- 数据回滚：恢复不会删除行，只改 status/decided_at/audit；如需保留原状，演示必须使用临时库，不得对 data/liora.db 执行。

## 已知边界

- 仅适用于单进程部署。多进程共享同一 SQLite 时，一个进程的启动会收敛另一个进程正在等待的 pending；项目已在 db/finding_traffic.go:21-28 声明不支持多进程共享。
- 恢复不会自动重放被中断的审批请求；用户需要在任务恢复后重新触发操作。
