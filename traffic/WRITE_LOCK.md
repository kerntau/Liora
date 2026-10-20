# 流量录制的全局写锁：实测与取舍

日期：2026-10-20。分支：`fix/trafficlock`。基线：`60362cf`。
环境：Go 1.26.5 / Windows / AMD Ryzen 7 7840HS（GOMAXPROCS=16）/ SSD。
数据目录位于 `%TEMP%`，会被 Windows Defender 实时扫描，因此下面所有 **fsync 绝对值偏保守**；
跨机器的结论应只看**占比**，不看毫秒数。

本文只回答一个问题：`Traffic.record` 那把覆盖整个写入路径的 `wmu` 值不值得动、能怎么动。
结论是 **不动**：可安全外提的工作合计不到 1%，而锁本身是承重的。数字与理由如下。

## 1. 结论摘要

| 结论 | 证据 |
| --- | --- |
| 锁内耗时的大头不是"我们的代码"，而是提交时的 fsync | 小 JSON 记录 45% 的 CPU 样本在 `FlushFileBuffers`；`synchronous=OFF` 让同一条记录从 2.32ms 掉到 1.06ms（−54%） |
| 512 KiB 文本记录的大头是 FTS trigram 建索引，且它必须留在事务里 | FTS 行从"空内容"变成 512 KiB 内容，记录从 3.3ms 涨到 50.3ms（+47ms，占 93%） |
| 可安全外提的工作合计 ≈ 1%（大正文）/ 0.1%（常见路径） | `BenchmarkPrepareOnly` 385µs / 45,000µs；头部序列化 ≈ 0 |
| sha256 单独外提没有意义 | 占 512 KiB 记录 0.7%（profile 0.66%，`SpillOnly` 350µs/45ms） |
| 锁不是"多余的串行化"，去掉它 99% 的并发写入会直接失败 | 无锁并发：`99.1%–99.7% busy-ops`（`SQLITE_BUSY`） |
| 真正的上限来自"一次记录一次事务一次 fsync"，不来自锁 | 批量化理论上限 ≈ 2.4×（525 条/秒 → ~1,250 条/秒），见 §5.3 |

## 2. 锁覆盖了什么

```text
wmu.Lock()                                   ← 临界区开始
  id / url / template / 请求头 / 响应头       纯 CPU，无共享状态
  spill(req) / spill(resp)                   分类 + sha256 + os.Stat + os.WriteFile(blob) + 预览截断
  db.Begin()
  INSERT exchanges            (+3 个索引)
  INSERT exchange_bodies
  INSERT blob_refs
  拼 FTS 文本缓冲（Grow + 逐段拷贝）
  INSERT ex_fts                ← trigram 分词 + 索引页
  Commit()                     ← WAL 帧写入 + FlushFileBuffers（+ 每 1000 页一次 autocheckpoint）
wmu.Unlock()                                 ← 临界区结束
```

同一把锁还被 `DeleteHost` / `StageDeleteHostsExact` / `RecoverHostDeleteStages` 持有，
其中 `gcBlobs` 靠它保证"不会删掉一条正在写入、尚未登记 `blob_refs` 的 blob"。
这条约束决定了 **blob 的写文件动作必须留在锁内**，可外提的只有它前面的纯计算。

## 3. 测量方法

三项独立证据，互相校验：

1. **CPU profile**（`-cpuprofile`）：给出同一段运行内的相对占比，不受跨进程噪声影响。
   注意 FTS 的 sync 与 pager 的 WAL 帧写入在调用栈上重叠，两者不能相加。
2. **分段阶梯**（`traffic_phases_bench_test.go`）：`record()` 的逐段复刻 + 开关，
   相邻两档的差就是那一段的耗时。复刻版与真实 `record()` 的绝对差在 10–25% 以内
   （同一台机器上 FTS 索引随行数增长而变贵），**只看差值**。
3. **A/B 开关**：`synchronous=OFF` 隔离 fsync；`cache_size` 隔离页缓存；
   去掉 `wmu` 隔离锁本身。

噪声对照（未改任何代码的 `BenchmarkRecordLargeBinary`，`-count=5`）：
3.10 / 3.17 / 3.60 / 4.23 / 4.79 ms —— **±27%**。
因此本文只采信 >20% 的差异；低于这个幅度的改善在这台机器上无法被证明。

## 4. 各段耗时占比

### 4.1 常见路径：小 JSON（请求 56 B / 响应 1.8 KB，全内联）

中位数 1.99 ms/op（5 次：1.94 / 1.98 / 2.03 / 2.17 / 1.99），9.1 KB/op，123 allocs/op。
CPU 样本占比（总计 4.67 s）：

| 段 | 占比 | 折算 |
| --- | --- | --- |
| 提交 fsync（`FlushFileBuffers`） | **45.4%** | 0.85 ms |
| WAL / 库文件写（`WriteFile`） | 8.6% | 0.16 ms |
| WAL autocheckpoint（每 1000 页，落在提交里） | 6.6% | 0.12 ms |
| FTS 索引维护（`IndexMergeLevel` + `Fts5HashWrite`） | **19.7%** | 0.37 ms |
| 其余 SQL（3 个索引 + bodies + blob_refs + 事务簿记） | ~19% | 0.36 ms |
| sha256 | 0 | 0（正文未溢出，不算哈希） |

A/B 校验：同一条记录 `synchronous=OFF` 后 2.32 ms → **1.06 ms（−54%）**，
与 profile 的"fsync + 同步排序 ≈ 50%"一致。**一半以上的临界区时间花在一次 fsync 上。**

### 4.2 溢出路径：512 KiB 文本

中位数 43.4 ms/op（41.3 / 41.5 / 43.4 / 45.7 / 48.4），693 KB/op，2,674 allocs/op。

| 段 | 占比 | 折算 |
| --- | --- | --- |
| FTS trigram 分词（`fts5TriTokenize`） | 32.8% | 15.0 ms |
| FTS 哈希写（`Fts5HashWrite`） | 25.0% | 11.4 ms |
| FTS 索引合并（`IndexMergeLevel`） | 17.9% | 8.2 ms |
| 提交时 FTS 索引落盘（`Fts5StorageSync`） | 27.1% | 12.4 ms |
| 提交 fsync | 17.3% | 7.9 ms |
| WAL autocheckpoint | 13.1% | 6.0 ms |
| B-tree 平衡（`balance_nonroot`） | 9.0% | 4.1 ms |
| **sha256** | **0.7%** | **0.35 ms** |
| 头部序列化 | ~0 | < 5 µs |

上表各行在调用栈上互相包含（`Fts5StorageSync` 含它触发的 fsync 与 WAL 帧写入），**不可相加**。

阶梯校验（中位数）：全行但 FTS 内容为空 3.29 ms → 全量 50.3 ms。
**即 512 KiB 正文的 trigram 建索引（含它引起的索引落盘）≈ 93% 的记录成本，全部在锁内。**

### 4.3 可外提部分的上限

| 项 | 512 KiB 文本 | 小 JSON |
| --- | --- | --- |
| 头部 / url / id 构造 | < 5 µs | ~2 µs |
| sha256 | 350 µs | 0 |
| `os.Stat`（blob 去重检查，随写文件一起） | 62 µs | 0 |
| FTS 文本缓冲组装（一次 512 KiB 分配 + 拷贝） | ~80 µs | ~2 µs |
| **合计** | **≈ 500 µs / 45,000 µs ≈ 1.1%** | **≈ 0.2%** |

## 5. 逐项评估

### 5.1 把 sha256 / 头部 / FTS 缓冲挪到锁外 —— 不实现

能挪，且行为完全不变（都是对 `f.Request.Body`/`f.Response.Body` 的纯计算，
不产生文件、不碰数据库、不依赖 `seq`）。
但收益是 **0.7%（sha256）/ 1.1%（全部可外提项）**，远在 ±27% 的噪声之下，
无法用数据证明，却要把热路径上唯一的函数拆成"锁外准备 + 锁内提交"两段并长期维护。
**收益不足以抵消风险，不做。** 数字见 §4.3。

### 5.2 FTS 行批量化 —— 否决

FTS 行按 `rowid` 与 `exchanges` 行一一对应，`rowid` 来自同一事务的 `LastInsertId`。
若把 FTS 插入攒批延后：
- 正文搜索在"记录已返回、FTS 行未写"的窗口里搜不到这条记录，**可见性变了**；
- 崩溃后窗口内的记录永久缺 FTS 行（没有修复路径），**崩溃可见性变了**；
- 若为保住原子性而放进同一事务，那就没有可攒的东西了（同一事务里必须立刻插）。

在本事务内批量化不可能，跨事务批量化改可见性。**否决。**

### 5.3 单写者写入队列 —— 只设计，不实现

**形态**：`record()` 拆成"锁外准备（payload）"+"投递"；一个写者 goroutine 独占
`wmu` 与数据库连接，从有界 channel 取货，攒够 N 条或等满 T 毫秒后**一个事务、一次 fsync** 提交。
blob 的 `os.WriteFile` 必须由写者执行（或继续在 `wmu` 内），否则 `gcBlobs` 会删掉
"已落盘、`blob_refs` 尚未提交"的文件——这正是锁存在的理由之一。

**收益上限**（按 §4.1 的实测拆解，每条 1.9 ms = fsync 1.15 + 其余 0.75）：

| 每事务条数 | 每条约 | 吞吐 | 相对今天 |
| --- | --- | --- | --- |
| 1（今天） | 1.90 ms | ~525/s | 1.0× |
| 8 | 0.75 + 0.14 = 0.89 ms | ~1,120/s | 2.1× |
| 32 | 0.75 + 0.04 = 0.79 ms | ~1,270/s | 2.4× |
| ∞ | 0.75 ms | ~1,330/s | 2.5× |

关键判断：**即使队列做得完美，也只有 ~2.4×**，因为剩下的 0.75 ms 是真实的 SQLite
CPU 工作（FTS 分词 + 3 个 B-tree 索引），单写者模型下它永远串行。
16 核在这套 schema 上永远换不来 16×。

**必须一起改的语义（这是它高风险的原因）**：
1. **可见性**：`record()` 返回即表示"已提交"是今天的契约（`TestRecordKeepsBodiesInIndex`
   记录后立刻读）。要保住它，生产者必须同步等待自己那批的提交结果（acked），
   队列退化成"批量提交 + 同步确认"，收益仍在（fsync 被摊销），但吞吐上限按上表。
2. **失败路径**：今天单条失败只丢这一条并记日志。批量提交失败必须能**逐条归因**，
   否则一次失败会静默丢掉一整批；同时已写入的 blob 文件会因 `blob_refs` 未提交
   而在下次 `gcBlobs` 被回收（只是浪费，不会不一致，但要有测试钉住）。
3. **关闭语义**：今天 `Close()` 之后库里一定有所有已返回的记录。队列版必须在
   `Close()` 里排空队列并等待写者退出，否则会丢最后一批。需要新的关闭测试。
4. **顺序**：单写者 + FIFO 保持 `seq`/`ts` 顺序；但 `ts` 在准备阶段取值，
   队列积压时"晚提交的旧 ts"必须靠 FIFO 保证不乱序——需要测试。
5. **背压**：有界 channel 满时生产者阻塞，与今天阻塞在 `wmu` 上等价；
   无界则内存无上限，不可取。
6. **锁序**：写者持 `wmu`，而 `DeleteHost`/`StageDeleteHostsExact` 也持 `wmu`。
   生产者**不得**在持锁时投递（否则与写者互等）。这条与另一个会话正在改的
   `server/` 锁序耦合，本分支不应碰。

**结论**：值得做，但它是"改语义 + 改关闭路径 + 改锁序"的三重改动，收益 2.4× 而非数量级。
需要独立的、带崩溃/关闭/并发测试的分支，不能混在锁内耗时优化里。

### 5.4 实测后放弃的调参

| 候选 | 结果 | 处置 |
| --- | --- | --- |
| `PRAGMA cache_size=-65536` | 512 KiB 文本 47.5 → 37.6 ms（−21%），但小 JSON 1.76 → 2.72 ms（+55%）；换顺序复测仍然同向 | **不采纳**：常见路径回归，且 `cache_size` 是**连接级**设置，`db.Exec` 只作用于一条连接，要全局生效得改 DSN——收益不足以换这个改动面 |
| `PRAGMA synchronous=NORMAL/OFF` | 小 JSON 2.32 → 1.06 ms（−54%），512 KiB 50 → 42.5 ms（−15%） | **不采纳**：掉电会丢最近已提交的记录，属于"崩溃后可见性"变化，违反本任务底线 |
| 去掉 `wmu` 并发写 | 99%+ `SQLITE_BUSY`（见 §6） | **不可能** |
| `wal_autocheckpoint=0` + 锁外定时 checkpoint | 理论上省 6.6%（小）/ 13.1%（大） | 未实现：低于噪声，且 WAL 无界增长与恢复时间需要单独评估 |

## 6. 锁是承重的：去掉它 99% 的并发写入直接失败

`BenchmarkParallelUnlocked`（`traffic_phases_bench_test.go`）在不持 `wmu` 的情况下
并发调用 `record()` 的复刻体，把失败数报成 `%busy-ops` 指标：

| GOMAXPROCS | 锁 | 结果 |
| --- | --- | --- |
| 1 | 有 | 2.39–2.60 ms/op |
| 16 | 有 | 2.66–2.94 ms/op（并发让每条贵 ~10%） |
| 4 | 无 | **99.1% busy-ops** |
| 16 | 无 | **99.7% busy-ops** |

原因是 `Open()` 里的 `PRAGMA busy_timeout=5000` 是**连接级**的，`db.Exec` 只把它
设在了当时那条连接上；连接池里其余连接的超时是 0，第二个写者立刻拿到 `SQLITE_BUSY`。
生产上 `wmu` 掩盖了这个隐患，所以它一直没暴露。

**给后续工作的两条提醒**：
1. 任何"去掉/缩短 `wmu`"的尝试，都必须先把 `busy_timeout` 挪进 DSN
   （`file:...?_pragma=busy_timeout(5000)`），否则并发写入会静默丢记录
   （`record()` 对错误只 `log.Printf` 然后 `return`）。
2. 即便补上 `busy_timeout`，SQLite 单写者 + 每事务 fsync 仍然把上限压在 ~1,300 条/秒（§5.3）。

## 7. 复现

```powershell
# 基线（5 次取中位数，含噪声对照项 BenchmarkRecordLargeBinary）
go test ./traffic/ -run '^$' -bench 'BenchmarkRecord' -benchmem -count=5

# 分段阶梯 + fsync 隔离 + 页缓存 A/B + 有锁/无锁并发
go test ./traffic/ -run '^$' -bench 'BenchmarkPhases|BenchmarkSpillOnly|BenchmarkPrepareOnly|BenchmarkPragmaCacheSize|BenchmarkParallel' -benchmem -count=5

# 并发扩展性
go test ./traffic/ -run '^$' -bench 'BenchmarkParallel' -cpu 1,2,4,8,16 -count=3

# CPU 归因
go test ./traffic/ -run '^$' -bench 'BenchmarkRecordLargeText$' -benchtime 3s -cpuprofile cpu.out
go tool pprof -top -cum traffic.test.exe cpu.out
```
