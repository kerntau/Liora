import * as React from "react";
import { Button, Card, Input, ListBox, Meter, Select, Table, TextField } from "@heroui/react";
import { ActivityIcon, AlertTriangleIcon, BugIcon, CheckIcon, ClockIcon, CoinsIcon, ListChecksIcon, PencilIcon, PlusIcon, RefreshCwIcon, ShieldAlertIcon, ShieldCheckIcon, TargetIcon, Trash2Icon, XIcon, } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import type { Finding, ModelTokenStat, Stats, Task, TaskConstraint, TaskGoal, TaskNode, TaskScopeRow, } from "@/lib/types";
// 紧凑格式化 token 数（12345 → 12.3k，2000000 → 2M）。
function fmtTokens(n: number): string {
    if (n >= 1000000)
        return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "M";
    if (n >= 1000)
        return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
    return String(n);
}
// 缓存命中率 = 缓存读 / 输入（InputTokens 已含 cache_read 子集，故比值在 0–100%）。
function cacheHitRate(cacheRead: number, input: number): string {
    if (input <= 0)
        return "—";
    return Math.round((cacheRead / input) * 100) + "%";
}
// 测试范围一条的显示值：域名 / 网段 / 公司。
function scopeValue(row: TaskScopeRow): string {
    if (row.value)
        return row.value;
    if (row.domain)
        return row.domain;
    if (row.net)
        return row.net;
    if (row.company_id)
        return row.company_name?.trim() ? row.company_name : `企业 #${row.company_id}`;
    return "—";
}
const SCOPE_KIND_LABELS: Record<TaskScopeRow["kind"], string> = {
    company: "公司",
    root_domain: "根域名",
    subdomain: "子域名",
    ip: "IP",
    cidr: "网段",
    icp: "ICP",
    keyword: "关键词",
};
const SCOPE_SOURCE_LABELS: Record<TaskScopeRow["source"], string> = {
    auto: "自动",
    agent: "Agent",
    manual: "手动",
};
function StatCard({ label, value, sub, icon: Icon, }: {
    label: string;
    value: React.ReactNode;
    sub?: string;
    icon: React.ElementType;
}) {
    return (<Card className="gap-1.5">
      <Card.Header className="pb-0">
        <Card.Description className="flex items-center gap-1.5">
          <Icon className="size-3.5"/> {label}
        </Card.Description>
        <Card.Title className="text-2xl tabular-nums">{value}</Card.Title>
      </Card.Header>
      {sub && <Card.Content className="text-xs text-muted">{sub}</Card.Content>}
    </Card>);
}
export function OverviewTab({ taskId }: {
    taskId: string;
}) {
    const [task, setTask] = React.useState<Task | null>(null);
    const [stats, setStats] = React.useState<Stats | null>(null);
    const [intents, setIntents] = React.useState<TaskNode[]>([]);
    const [findings, setFindings] = React.useState<Finding[]>([]);
    const [coverage, setCoverage] = React.useState<{
        enabled: boolean;
        scope_rows: number;
        denominator: number;
        tested: number;
        pct: number | null;
        by_type: {
            type: string;
            total: number;
            tested: number;
        }[];
    } | null>(null);
    // 正在重跑的意图 id（含 "__all__" 表示批量），用于禁用按钮 + 转圈。
    const [rerunning, setRerunning] = React.useState<Set<string>>(new Set());
    // 测试范围列表 + 新增表单状态。
    const [scope, setScope] = React.useState<TaskScopeRow[]>([]);
    const [scopeKind, setScopeKind] = React.useState<TaskScopeRow["kind"]>("root_domain");
    const [scopeValueInput, setScopeValueInput] = React.useState("");
    const [scopeBusy, setScopeBusy] = React.useState(false);
    const [scopeErr, setScopeErr] = React.useState("");
    // 按模型的 token 用量（来自常开的 llm_usage 计量账本，逐次精确）。
    const [modelTokens, setModelTokens] = React.useState<ModelTokenStat[]>([]);
    // 目标管理：目标列表 + 新增表单 + 行内编辑状态。
    const [goals, setGoals] = React.useState<TaskGoal[]>([]);
    const [goalText, setGoalText] = React.useState("");
    const [goalVuln, setGoalVuln] = React.useState("");
    const [goalBusy, setGoalBusy] = React.useState(false);
    const [goalErr, setGoalErr] = React.useState("");
    const [editingGoalId, setEditingGoalId] = React.useState<string | null>(null);
    const [editText, setEditText] = React.useState("");
    const [editVuln, setEditVuln] = React.useState("");
    // 约束管理：约束列表 + 新增表单 + 行内编辑状态。
    const [constraints, setConstraints] = React.useState<TaskConstraint[]>([]);
    const [conText, setConText] = React.useState("");
    const [conKind, setConKind] = React.useState<TaskConstraint["kind"]>("deny");
    const [conBusy, setConBusy] = React.useState(false);
    const [conErr, setConErr] = React.useState("");
    const [editingConId, setEditingConId] = React.useState<string | null>(null);
    const [editConText, setEditConText] = React.useState("");
    const [editConKind, setEditConKind] = React.useState<TaskConstraint["kind"]>("deny");
    const loadTokens = React.useCallback(async () => {
        try {
            const resp = await api.tokensByModel(taskId);
            setModelTokens(resp.models);
        }
        catch {
            // 忽略：无 PG 时接口报错，卡片自然为空
        }
    }, [taskId]);
    const loadScope = React.useCallback(async () => {
        try {
            const resp = await api.taskScope(taskId);
            setScope(resp.scope);
        }
        catch {
            // 忽略：无 asset store 时接口 503，范围卡片自然为空
        }
    }, [taskId]);
    const loadGoals = React.useCallback(async () => {
        try {
            const resp = await api.taskGoals(taskId);
            setGoals(resp.goals);
        }
        catch {
            // 忽略：瞬时错误，下次轮询重试
        }
    }, [taskId]);
    const addGoal = async () => {
        const text = goalText.trim();
        if (!text)
            return;
        setGoalBusy(true);
        setGoalErr("");
        try {
            await api.addGoal(taskId, text, goalVuln.trim() || undefined);
            setGoalText("");
            setGoalVuln("");
            await loadGoals();
        }
        catch (e) {
            setGoalErr(e instanceof Error ? e.message : "添加失败");
        }
        finally {
            setGoalBusy(false);
        }
    };
    const startEditGoal = (g: TaskGoal) => {
        setEditingGoalId(g.id);
        setEditText(g.text);
        setEditVuln(g.vulnclass ?? "");
    };
    const cancelEditGoal = () => {
        setEditingGoalId(null);
        setEditText("");
        setEditVuln("");
    };
    const saveEditGoal = async (g: TaskGoal) => {
        const text = editText.trim();
        if (!text)
            return;
        setGoalBusy(true);
        setGoalErr("");
        try {
            await api.updateGoal(taskId, g.id, text, editVuln.trim() || undefined);
            cancelEditGoal();
            await loadGoals();
        }
        catch (e) {
            setGoalErr(e instanceof Error ? e.message : "保存失败");
        }
        finally {
            setGoalBusy(false);
        }
    };
    const removeGoal = async (g: TaskGoal) => {
        setGoals((prev) => prev.filter((x) => x.id !== g.id));
        try {
            await api.deleteGoal(taskId, g.id);
        }
        catch {
            await loadGoals(); // 删除失败：重新拉取还原
        }
    };
    const loadConstraints = React.useCallback(async () => {
        try {
            const resp = await api.taskConstraints(taskId);
            setConstraints(resp.constraints);
        }
        catch {
            // 忽略：瞬时错误，下次轮询重试
        }
    }, [taskId]);
    const addConstraint = async () => {
        const text = conText.trim();
        if (!text)
            return;
        setConBusy(true);
        setConErr("");
        try {
            await api.addConstraint(taskId, text, conKind);
            setConText("");
            await loadConstraints();
        }
        catch (e) {
            setConErr(e instanceof Error ? e.message : "添加失败");
        }
        finally {
            setConBusy(false);
        }
    };
    const startEditConstraint = (c: TaskConstraint) => {
        setEditingConId(c.id);
        setEditConText(c.text);
        setEditConKind(c.kind);
    };
    const cancelEditConstraint = () => {
        setEditingConId(null);
        setEditConText("");
        setEditConKind("deny");
    };
    const saveEditConstraint = async (c: TaskConstraint) => {
        const text = editConText.trim();
        if (!text)
            return;
        setConBusy(true);
        setConErr("");
        try {
            await api.updateConstraint(taskId, c.id, text, editConKind);
            cancelEditConstraint();
            await loadConstraints();
        }
        catch (e) {
            setConErr(e instanceof Error ? e.message : "保存失败");
        }
        finally {
            setConBusy(false);
        }
    };
    const removeConstraint = async (c: TaskConstraint) => {
        setConstraints((prev) => prev.filter((x) => x.id !== c.id));
        try {
            await api.deleteConstraint(taskId, c.id);
        }
        catch {
            await loadConstraints(); // 删除失败：重新拉取还原
        }
    };
    const addScope = async () => {
        const value = scopeValueInput.trim();
        if (!value)
            return;
        setScopeBusy(true);
        setScopeErr("");
        try {
            await api.addTaskScope(taskId, scopeKind, value);
            setScopeValueInput("");
            await loadScope();
        }
        catch (e) {
            setScopeErr(e instanceof Error ? e.message : "添加失败");
        }
        finally {
            setScopeBusy(false);
        }
    };
    const removeScope = async (row: TaskScopeRow) => {
        setScope((prev) => prev.filter((s) => s.id !== row.id));
        try {
            await api.deleteTaskScope(taskId, row.id);
        }
        catch {
            await loadScope(); // 删除失败：重新拉取还原
        }
    };
    const markRerun = (key: string, on: boolean) => setRerunning((prev) => {
        const next = new Set(prev);
        if (on)
            next.add(key);
        else
            next.delete(key);
        return next;
    });
    // 重跑单条：置回 open（乐观更新本地 state，3s 轮询兜底），worker 会重新认领、从头再跑。
    const rerunOne = async (id: string) => {
        markRerun(id, true);
        try {
            await api.rerunIntent(taskId, id);
            setIntents((prev) => prev.map((i) => (i.id === id ? { ...i, state: "open" } : i)));
        }
        catch {
            // 失败忽略：下次轮询仍显示 blocked，用户可再点
        }
        finally {
            markRerun(id, false);
        }
    };
    // 批量重跑本任务全部 blocked。
    const rerunAll = async () => {
        markRerun("__all__", true);
        try {
            await api.rerunBlocked(taskId);
            setIntents((prev) => prev.map((i) => (i.state === "blocked" ? { ...i, state: "open" } : i)));
        }
        catch {
            // ignore
        }
        finally {
            markRerun("__all__", false);
        }
    };
    React.useEffect(() => {
        let cancelled = false;
        let loading = false;
        const load = async () => {
            if (loading)
                return;
            loading = true;
            try {
                const [taskResp, statsResp, intentsResp, findingsResp] = await Promise.all([
                    api.task(taskId),
                    api.stats(taskId),
                    api.intents(taskId),
                    api.findings(taskId),
                ]);
                if (cancelled)
                    return;
                const activeTask = statsResp.active_task;
                setTask(activeTask
                    ? {
                        ...taskResp,
                        in_flight: activeTask.in_flight,
                        goals_total: activeTask.goals_total,
                        goals_met: activeTask.goals_met,
                        engine_mode: statsResp.engine_mode ?? activeTask.engine_mode,
                        paused: activeTask.paused,
                    }
                    : taskResp);
                setStats(statsResp);
                setIntents(intentsResp);
                setFindings(findingsResp);
                // coverage is independent + may 503 when no asset store — fetch separately so
                // its failure never blocks the others.
                api
                    .taskCoverage(taskId)
                    .then((c) => {
                    if (!cancelled)
                        setCoverage(c);
                })
                    .catch(() => {
                    // A transient coverage failure is retried by the next poll.
                });
            }
            catch {
                // transient errors are ignored; the next poll will retry
            }
            finally {
                loading = false;
            }
        };
        void load();
        void loadScope();
        void loadTokens();
        void loadGoals();
        void loadConstraints();
        const timer = setInterval(() => {
            void load();
            void loadTokens();
            void loadGoals();
            void loadConstraints();
        }, 3000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [taskId, loadScope, loadTokens, loadGoals, loadConstraints]);
    const running = intents.filter((i) => i.state === "running");
    const open = intents.filter((i) => i.state === "open");
    const blocked = intents.filter((i) => i.state === "blocked");
    const taskFindings = findings.filter((f) => f.task_id === taskId);
    const goalsPct = task?.goals_total ? Math.round(((task.goals_met ?? 0) / task.goals_total) * 100) : 0;
    // token 合计（跨全部模型），用于卡片头部总览。
    const tokenTotals = modelTokens.reduce((acc, m) => {
        acc.input += m.input_tokens;
        acc.output += m.output_tokens;
        acc.cacheRead += m.cache_read_tokens;
        acc.cacheWrite += m.cache_write_tokens;
        acc.calls += m.calls;
        return acc;
    }, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 });
    return (<div className="flex flex-col gap-4">
      {/* 原始任务描述与目标(创建时填写的),置顶便于随时回看。 */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2 text-base">
            <TargetIcon className="size-4 text-accent"/> 任务描述与目标
          </Card.Title>
        </Card.Header>
        <Card.Content className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-medium text-muted">描述</div>
            <p className="text-sm whitespace-pre-wrap break-words">{task?.description?.trim() || "—"}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-medium text-muted">目标</div>
            <p className="text-sm whitespace-pre-wrap break-words">{task?.goal?.trim() || "—"}</p>
          </div>
        </Card.Content>
      </Card>
      {/* 目标管理：查看/新增/修改/删除本任务的探索目标。新增与修改会通知规划者并复活任务，
                            删除仅通知规划者（不复活）。目标 = 最终可交付/可核验的结果，不是攻击步骤或侦察动作。 */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2 text-base">
            <ListChecksIcon className="size-4 text-accent"/> 目标管理
            <span className="text-muted text-xs font-normal">
              （最终可核验的目标，共 {goals.length} 条；新增/修改会通知规划者并复活任务）
            </span>
          </Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          {/* 新增表单 */}
          <div className="flex flex-wrap items-center gap-2">
            <TextField className="contents" aria-label={"新增目标，如『拿到管理员账号的越权访问』"} isDisabled={goalBusy}>
              <Input className="h-7 min-w-56 flex-1 text-sm" placeholder="新增目标，如『拿到管理员账号的越权访问』" value={goalText} onChange={(e) => setGoalText(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter")
                void addGoal();
        }}/>
            </TextField>
            <TextField className="contents" aria-label={"漏洞类(可选)"} isDisabled={goalBusy}>
              <Input className="h-7 w-32 text-sm" placeholder="漏洞类(可选)" value={goalVuln} onChange={(e) => setGoalVuln(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter")
                void addGoal();
        }}/>
            </TextField>
            <Button size="sm" isDisabled={goalBusy || !goalText.trim()} onPress={() => void addGoal()} variant={"outline"}>
              <PlusIcon className="size-3.5"/> 添加
            </Button>
            {goalErr && <span className="text-xs text-danger">{goalErr}</span>}
          </div>
          {/* 目标列表 */}
          {goals.length > 0 ? (<div className="flex flex-col gap-1.5">
              {goals.map((g) => editingGoalId === g.id ? (<div key={g.id} className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5">
                    <TextField className="contents" aria-label={"\u8F93\u5165"} isDisabled={goalBusy}>
                      <Input className="h-7 min-w-56 flex-1 text-sm" value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => {
                    if (e.key === "Enter")
                        void saveEditGoal(g);
                    if (e.key === "Escape")
                        cancelEditGoal();
                }} autoFocus/>
                    </TextField>
                    <TextField className="contents" aria-label={"漏洞类(可选)"} isDisabled={goalBusy}>
                      <Input className="h-7 w-32 text-sm" placeholder="漏洞类(可选)" value={editVuln} onChange={(e) => setEditVuln(e.target.value)} onKeyDown={(e) => {
                    if (e.key === "Enter")
                        void saveEditGoal(g);
                    if (e.key === "Escape")
                        cancelEditGoal();
                }}/>
                    </TextField>
                    <Button size="sm" className="h-6 shrink-0 px-1.5" isDisabled={goalBusy || !editText.trim()} onPress={() => void saveEditGoal(g)} variant={"ghost"}>
                      <CheckIcon className="size-3.5 text-success"/>
                    </Button>
                    <Button size="sm" className="h-6 shrink-0 px-1.5" isDisabled={goalBusy} onPress={cancelEditGoal} variant={"ghost"}>
                      <XIcon className="size-3.5"/>
                    </Button>
                  </div>) : (<div key={g.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                    <StatusBadge domain="goal" value={g.state}/>
                    <span className="min-w-0 flex-1 break-words">{g.text}</span>
                    {g.vulnclass && (<span className="bg-surface-secondary text-muted shrink-0 rounded px-1.5 py-0.5 text-xs">
                        {g.vulnclass}
                      </span>)}
                    <Button size="sm" className="h-6 shrink-0 px-1.5" isDisabled={goalBusy} onPress={() => startEditGoal(g)} variant={"ghost"}>
                      <PencilIcon className="size-3.5"/>
                    </Button>
                    <Button size="sm" className="h-6 shrink-0 px-1.5" isDisabled={goalBusy} onPress={() => void removeGoal(g)} variant={"ghost"}>
                      <Trash2Icon className="size-3.5 text-danger"/>
                    </Button>
                  </div>))}
            </div>) : (<p className="text-muted text-sm">暂无目标，添加后规划者会据此派发探索意图并判定达成。</p>)}
        </Card.Content>
      </Card>
      {/* 操作约束管理：allow=允许 / deny=禁止。约束会在下一轮规划时注入 planner/worker 的系统
                            提示以框定探索边界（注入范围可在 系统设置 里按 planner/worker 开关）。改动不即时打断，
                            下一轮规划自然读到。 */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2 text-base">
            <ShieldAlertIcon className="size-4 text-warning"/> 操作约束
            <span className="text-muted text-xs font-normal">
              （框定 planner/worker 的探索边界，共 {constraints.length} 条；改动下一轮规划生效）
            </span>
          </Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          {/* 新增表单 */}
          <div className="flex flex-wrap items-center gap-2">
            <Select selectedKey={conKind} aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((nextValue) => setConKind(String(nextValue) as TaskConstraint["kind"]))(String(key));
        }}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="deny" textValue="禁止">
                    禁止
                  </ListBox.Item>
                  <ListBox.Item id="allow" textValue="允许">
                    允许
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            <TextField className="contents" aria-label={"一条操作约束，如『仅测当前端口，不扫其他端口』"} isDisabled={conBusy}>
              <Input className="h-7 min-w-56 flex-1 text-sm" placeholder="一条操作约束，如『仅测当前端口，不扫其他端口』" value={conText} onChange={(e) => setConText(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter")
                void addConstraint();
        }}/>
            </TextField>
            <Button size="sm" isDisabled={conBusy || !conText.trim()} onPress={() => void addConstraint()} variant={"outline"}>
              <PlusIcon className="size-3.5"/> 添加
            </Button>
            {conErr && <span className="text-xs text-danger">{conErr}</span>}
          </div>
          {/* 约束列表 */}
          {constraints.length > 0 ? (<div className="flex flex-col gap-1.5">
              {constraints.map((c) => editingConId === c.id ? (<div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5">
                    <Select selectedKey={editConKind} aria-label="选择选项" onSelectionChange={(key) => {
                    if (key !== null)
                        ((nextValue) => setEditConKind(String(nextValue) as TaskConstraint["kind"]))(String(key));
                }}>
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="deny" textValue="禁止">
                            禁止
                          </ListBox.Item>
                          <ListBox.Item id="allow" textValue="允许">
                            允许
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <TextField className="contents" aria-label={"\u8F93\u5165"} isDisabled={conBusy}>
                      <Input className="h-7 min-w-56 flex-1 text-sm" value={editConText} onChange={(e) => setEditConText(e.target.value)} onKeyDown={(e) => {
                    if (e.key === "Enter")
                        void saveEditConstraint(c);
                    if (e.key === "Escape")
                        cancelEditConstraint();
                }} autoFocus/>
                    </TextField>
                    <Button size="sm" className="h-6 shrink-0 px-1.5" isDisabled={conBusy || !editConText.trim()} onPress={() => void saveEditConstraint(c)} variant={"ghost"}>
                      <CheckIcon className="size-3.5 text-success"/>
                    </Button>
                    <Button size="sm" className="h-6 shrink-0 px-1.5" isDisabled={conBusy} onPress={cancelEditConstraint} variant={"ghost"}>
                      <XIcon className="size-3.5"/>
                    </Button>
                  </div>) : (<div key={c.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${c.kind === "allow"
                    ? "bg-success/15 text-success dark:text-success"
                    : "bg-danger/15 text-danger dark:text-danger"}`}>
                      {c.kind === "allow" ? "允许" : "禁止"}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{c.text}</span>
                    <Button size="sm" className="h-6 shrink-0 px-1.5" isDisabled={conBusy} onPress={() => startEditConstraint(c)} variant={"ghost"}>
                      <PencilIcon className="size-3.5"/>
                    </Button>
                    <Button size="sm" className="h-6 shrink-0 px-1.5" isDisabled={conBusy} onPress={() => void removeConstraint(c)} variant={"ghost"}>
                      <Trash2Icon className="size-3.5 text-danger"/>
                    </Button>
                  </div>))}
            </div>) : (<p className="text-muted text-sm">
              暂无操作约束。建任务时会自动从描述/目标抽取；也可在此手动增删改，用来框定「允许/禁止做哪些操作」。
            </p>)}
        </Card.Content>
      </Card>
      {coverage && coverage.enabled && coverage.scope_rows > 0 && (<Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-base">
              <TargetIcon className="size-4 text-success"/> 资产测试覆盖度
              <span className="text-muted text-xs font-normal">（粗估，仅供参考）</span>
            </Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tabular-nums">
                {coverage.pct != null ? Math.round(coverage.pct * 100) + "%" : "—"}
              </span>
              <span className="text-muted text-sm">
                已测 {coverage.tested} / 范围内 {coverage.denominator}
              </span>
            </div>
            {coverage.pct != null && (<Meter value={Math.round(coverage.pct * 100)} aria-label="进度">
                <Meter.Track>
                  <Meter.Fill />
                </Meter.Track>
              </Meter>)}
            {coverage.by_type.length > 0 && (<div className="flex flex-wrap gap-1.5 text-xs">
                {coverage.by_type.map((b) => (<span key={b.type} className="bg-surface-secondary rounded px-1.5 py-0.5">
                    <span className="text-muted">{b.type}</span>{" "}
                    <span className="tabular-nums font-medium">
                      {b.tested}/{b.total}
                    </span>
                  </span>))}
              </div>)}
          </Card.Content>
        </Card>)}
      {/* LLM Token 用量：按模型分组，数据来自 llm_records（需开启 LLM 录制）。 */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2 text-base">
            <CoinsIcon className="size-4 text-warning"/> LLM Token 用量
            <span className="text-muted text-xs font-normal">
              （按模型统计{tokenTotals.calls > 0 ? `，共 ${tokenTotals.calls} 次调用` : ""}）
            </span>
          </Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          {modelTokens.length > 0 ? (<>
              {/* 合计总览 */}
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span className="tabular-nums">
                  <span className="text-muted">输入 </span>
                  <span className="font-semibold">{fmtTokens(tokenTotals.input)}</span>
                </span>
                <span className="tabular-nums">
                  <span className="text-muted">输出 </span>
                  <span className="font-semibold">{fmtTokens(tokenTotals.output)}</span>
                </span>
                <span className="tabular-nums">
                  <span className="text-muted">缓存读 </span>
                  <span className="font-semibold">{fmtTokens(tokenTotals.cacheRead)}</span>
                </span>
                <span className="tabular-nums">
                  <span className="text-muted">缓存命中率 </span>
                  <span className="font-semibold text-success">
                    {cacheHitRate(tokenTotals.cacheRead, tokenTotals.input)}
                  </span>
                </span>
              </div>
              {/* 按模型明细表 */}
              <div className="overflow-x-auto">
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content className="w-full text-sm" aria-label="数据表">
                      <Table.Header>
                        <Table.Column className="py-1.5 pr-3 font-medium" id="column-27262" isRowHeader>
                          模型
                        </Table.Column>
                        <Table.Column className="py-1.5 pr-3 text-right font-medium" id="column-27332" isRowHeader>
                          调用
                        </Table.Column>
                        <Table.Column className="py-1.5 pr-3 text-right font-medium" id="column-27413" isRowHeader>
                          输入
                        </Table.Column>
                        <Table.Column className="py-1.5 pr-3 text-right font-medium" id="column-27494" isRowHeader>
                          输出
                        </Table.Column>
                        <Table.Column className="py-1.5 pr-3 text-right font-medium" id="column-27575" isRowHeader>
                          缓存读
                        </Table.Column>
                        <Table.Column className="py-1.5 text-right font-medium" id="column-27657" isRowHeader>
                          命中率
                        </Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {modelTokens.map((m) => (<Table.Row key={m.model} className="border-b last:border-0" id={`${m.model}-27836`}>
                            <Table.Cell className="max-w-[16rem] truncate py-1.5 pr-3 font-mono text-xs">
                              <span title={m.model}>{m.model}</span>
                            </Table.Cell>
                            <Table.Cell className="py-1.5 pr-3 text-right tabular-nums">{m.calls}</Table.Cell>
                            <Table.Cell className="py-1.5 pr-3 text-right tabular-nums">
                              {fmtTokens(m.input_tokens)}
                            </Table.Cell>
                            <Table.Cell className="py-1.5 pr-3 text-right tabular-nums">
                              {fmtTokens(m.output_tokens)}
                            </Table.Cell>
                            <Table.Cell className="py-1.5 pr-3 text-right tabular-nums">
                              {fmtTokens(m.cache_read_tokens)}
                            </Table.Cell>
                            <Table.Cell className="py-1.5 text-right tabular-nums text-success">
                              {cacheHitRate(m.cache_read_tokens, m.input_tokens)}
                            </Table.Cell>
                          </Table.Row>))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              </div>
            </>) : (<p className="text-muted text-sm">暂无 LLM 用量（任务尚未产生调用，或记录仍在写入）。</p>)}
        </Card.Content>
      </Card>
      {/* 测试范围：覆盖度分母 + 授权边界，可手动增删。 */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2 text-base">
            <ShieldCheckIcon className="size-4 text-success"/> 测试范围
            <span className="text-muted text-xs font-normal">（覆盖度分母 + 授权边界，共 {scope.length} 条）</span>
          </Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          {/* 新增表单 */}
          <div className="flex flex-wrap items-center gap-2">
            <Select selectedKey={scopeKind} aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((nextValue) => setScopeKind(String(nextValue) as TaskScopeRow["kind"]))(String(key));
        }}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="root_domain" textValue="根域名">
                    根域名
                  </ListBox.Item>
                  <ListBox.Item id="subdomain" textValue="子域名">
                    子域名
                  </ListBox.Item>
                  <ListBox.Item id="ip" textValue="IP">
                    IP
                  </ListBox.Item>
                  <ListBox.Item id="cidr" textValue="网段">
                    网段
                  </ListBox.Item>
                  <ListBox.Item id="icp" textValue="ICP">
                    ICP
                  </ListBox.Item>
                  <ListBox.Item id="keyword" textValue="关键词">
                    关键词
                  </ListBox.Item>
                  <ListBox.Item id="company" textValue="公司">
                    公司
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            <TextField className="contents" aria-label={scopeKind === "company"
            ? "公司名或 id"
            : scopeKind === "ip" || scopeKind === "cidr"
                ? "如 10.0.0.1 或 10.0.0.0/24"
                : scopeKind === "icp"
                    ? "如 京ICP备12345678号-1"
                    : scopeKind === "keyword"
                        ? "如 企业名称关键词"
                        : "如 example.com"} isDisabled={scopeBusy}>
              <Input className="h-7 w-56 text-sm" placeholder={scopeKind === "company"
            ? "公司名或 id"
            : scopeKind === "ip" || scopeKind === "cidr"
                ? "如 10.0.0.1 或 10.0.0.0/24"
                : scopeKind === "icp"
                    ? "如 京ICP备12345678号-1"
                    : scopeKind === "keyword"
                        ? "如 企业名称关键词"
                        : "如 example.com"} value={scopeValueInput} onChange={(e) => setScopeValueInput(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter")
                void addScope();
        }}/>
            </TextField>
            <Button size="sm" isDisabled={scopeBusy || !scopeValueInput.trim()} onPress={() => void addScope()} variant={"outline"}>
              <PlusIcon className="size-3.5"/> 添加
            </Button>
            {scopeErr && <span className="text-xs text-danger">{scopeErr}</span>}
          </div>
          {/* 范围列表 */}
          {scope.length > 0 ? (<div className="flex flex-col gap-1.5">
              {scope.map((row) => (<div key={row.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                  <span className="bg-surface-secondary text-muted shrink-0 rounded px-1.5 py-0.5 text-xs">
                    {SCOPE_KIND_LABELS[row.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{scopeValue(row)}</span>
                  <span className="text-muted shrink-0 text-xs">{SCOPE_SOURCE_LABELS[row.source]}</span>
                  {row.task_id.toString() === taskId ? (<Button size="sm" className="h-6 shrink-0 px-1.5" onPress={() => void removeScope(row)} variant={"ghost"}>
                      <Trash2Icon className="size-3.5 text-danger"/>
                    </Button>) : (<span className="text-muted shrink-0 text-xs">继承</span>)}
                </div>))}
            </div>) : (<p className="text-muted text-sm">暂无测试范围，添加后可作为资产覆盖度的分母。</p>)}
        </Card.Content>
      </Card>
      {/* Heartbeat */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2 text-base">
            <ActivityIcon className="size-4 text-accent"/> 心跳
          </Card.Title>
        </Card.Header>
        <Card.Content className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted">引擎态</div>
            <StatusBadge domain="engine" value={stats?.engine_mode ?? task?.engine_mode ?? "idle"} dot className="mt-1"/>
          </div>
          <div>
            <div className="text-xs text-muted">运行中 Worker</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{running.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted">最近活动</div>
            <div className="mt-1 inline-flex items-center gap-1 text-sm">
              <ClockIcon className="size-3.5"/>
              {task?.last_activity ? new Date(task.last_activity).toLocaleTimeString("zh-CN") : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">
              目标 {task?.goals_met ?? 0}/{task?.goals_total ?? 0}
            </div>
            <Meter value={goalsPct} className="mt-2" aria-label="进度">
              <Meter.Track>
                <Meter.Fill />
              </Meter.Track>
            </Meter>
          </div>
          {task?.completed_unix && task.completed_unix > 0 ? (<div>
              <div className="text-xs text-muted">完成时间</div>
              <div className="mt-1 inline-flex items-center gap-1 text-sm">
                <ClockIcon className="size-3.5"/>
                {new Date(task.completed_unix * 1000).toLocaleString("zh-CN")}
              </div>
            </div>) : null}
        </Card.Content>
      </Card>

      {/* Work set */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-sm">
              <TargetIcon className="size-4"/> 进行中意图
            </Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-2">
            {running.slice(0, 6).map((i) => (<div key={i.id} className="flex items-center gap-2 text-sm">
                <StatusBadge domain="intent" value={i.state}/>
                <span className="min-w-0 flex-1 truncate">{i.payload}</span>
              </div>))}
            {running.length === 0 && <p className="text-sm text-muted">暂无进行中意图</p>}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-sm">
              <AlertTriangleIcon className="size-4 text-warning"/> 需要关注
            </Card.Title>
          </Card.Header>
          <Card.Content className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-danger">{taskFindings.length}</div>
              <div className="text-xs text-muted">确认漏洞</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-accent">{running.length}</div>
              <div className="text-xs text-muted">执行中</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{open.length}</div>
              <div className="text-xs text-muted">frontier 待领</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-danger">{blocked.length}</div>
              <div className="text-xs text-muted">被拦意图</div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-sm">
              <BugIcon className="size-4 text-danger"/> 最近发现
            </Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-2">
            {taskFindings.slice(0, 6).map((f) => (<div key={f.id} className="flex items-center gap-2 text-sm">
                <StatusBadge domain="severity" value={f.severity} dot/>
                <span className="min-w-0 flex-1 truncate">{f.summary}</span>
              </div>))}
            {taskFindings.length === 0 && <p className="text-sm text-muted">暂无发现</p>}
          </Card.Content>
        </Card>
      </div>

      {/* Blocked intents — 出错/被拦(如 LLM 网络问题)的意图，可一键重跑：置回 open，
                            worker 会重新认领、从头再跑（已写回图谱的数据保留）；任务若已终态/暂停会自动复活。 */}
      {blocked.length > 0 && (<Card className="border-danger/30">
          <Card.Header className="flex-row items-center justify-between gap-2 space-y-0">
            <Card.Title className="flex items-center gap-2 text-sm">
              <AlertTriangleIcon className="size-4 text-danger"/> 被拦/出错意图
              <span className="text-xs font-normal text-muted">（共 {blocked.length} 条，可重跑）</span>
            </Card.Title>
            <Button size="sm" isDisabled={rerunning.has("__all__")} onPress={() => void rerunAll()} variant={"outline"}>
              <RefreshCwIcon className={`size-3.5 ${rerunning.has("__all__") ? "animate-spin" : ""}`}/>
              全部重跑
            </Button>
          </Card.Header>
          <Card.Content className="flex flex-col gap-2">
            {blocked.slice(0, 20).map((i) => (<div key={i.id} className="flex items-center gap-2 text-sm">
                <StatusBadge domain="intent" value={i.state}/>
                <span className="min-w-0 flex-1 truncate">{i.payload}</span>
                <Button size="sm" className="h-7 shrink-0 px-2 text-xs" isDisabled={rerunning.has(i.id)} onPress={() => void rerunOne(i.id)} variant={"ghost"}>
                  <RefreshCwIcon className={`size-3 ${rerunning.has(i.id) ? "animate-spin" : ""}`}/>
                  重跑
                </Button>
              </div>))}
            {blocked.length > 20 && (<p className="text-xs text-muted">仅显示前 20 条，点「全部重跑」处理剩余 {blocked.length - 20} 条。</p>)}
          </Card.Content>
        </Card>)}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="待领意图" value={open.length} icon={ShieldCheckIcon} sub="frontier 开放"/>
        <StatCard label="确认发现" value={taskFindings.length} icon={BugIcon} sub="本任务"/>
        <StatCard label="意图总数" value={intents.length} icon={AlertTriangleIcon} sub="本任务全部意图"/>
      </div>
    </div>);
}
