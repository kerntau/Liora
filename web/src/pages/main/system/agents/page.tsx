"use client";

import * as React from "react";
import { toast } from "@/components/ui/sonner";
import {
  Bot,
  ExternalLinkIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { AsyncState } from "@/components/async-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentEditor } from "@/components/agent-editor";
import { api } from "@/lib/api";
import Link from "@/lib/router-compat";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

function CountChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
      <Icon className="size-3" />
      {label}
      <span className="font-mono font-semibold text-foreground tabular-nums">{value}</span>
    </span>
  );
}

// AgentGridCard is one clickable tile opening the agent's editor drawer. Custom
// (non-builtin) agents get a delete button.
function AgentGridCard({
  agent,
  onOpen,
  onDeleted,
}: {
  agent: Agent;
  onOpen: () => void;
  onDeleted: () => void;
}) {
  async function del() {
    try {
      await api.deleteAgent(agent.key);
      toast.success(`已删除 Agent「${agent.name}」`);
      onDeleted();
    } catch (e) {
      toast.error("删除失败：" + (e as Error).message);
    }
  }
  return (
    <Card className="group relative flex flex-col gap-0 py-0 transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col gap-2.5 rounded-lg p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-2.5 pr-16">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              agent.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Bot className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-foreground">{agent.name}</span>
              {agent.builtin ? (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  内置
                </span>
              ) : (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  自定义
                </span>
              )}
              {!agent.enabled && (
                <span className="rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                  已停用
                </span>
              )}
            </div>
            <code className="mt-0.5 block truncate font-mono text-[12px] text-muted-foreground">{agent.key}</code>
          </div>
        </div>
        <p className="line-clamp-2 min-h-8 text-[12px] leading-4 text-muted-foreground">
          {agent.description || "（无描述）"}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2">
          <CountChip icon={PlugIcon} label="MCP" value={agent.mcp_count ?? 0} />
          <CountChip icon={SparklesIcon} label="Skill" value={agent.skill_count ?? 0} />
          <CountChip icon={WrenchIcon} label="工具" value={agent.tool_count ?? 0} />
          <span className="ml-auto flex items-center gap-1.5">
            {agent.web_search ? (
              <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">联网</span>
            ) : null}
            {agent.interactive_shell ? (
              <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Shell</span>
            ) : null}
          </span>
        </div>
      </button>
      <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
        <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
          <Link
            href={`/system/agents/detail?key=${encodeURIComponent(agent.key)}`}
            aria-label={`在新页面打开 Agent ${agent.name}`}
          >
            <ExternalLinkIcon className="size-3.5" />
          </Link>
        </Button>
        {!agent.builtin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`删除 Agent ${agent.name}`}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除 Agent「{agent.name}」？</AlertDialogTitle>
                <AlertDialogDescription>
                  将一并删除它的提示词、变量、可见性与工具绑定。此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={del}>删除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </Card>
  );
}

function CreateAgentDialog({
  onCreated,
  triggerLabel = "新建 Agent",
}: {
  onCreated: (key: string) => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function create() {
    setBusy(true);
    try {
      const a = await api.createAgent(key.trim(), name.trim(), description.trim());
      toast.success(`已创建 Agent「${a.name}」`);
      setOpen(false);
      setKey("");
      setName("");
      setDescription("");
      onCreated(a.key);
    } catch (e) {
      toast.error("创建失败：" + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const keyOk = /^[a-z][a-z0-9_]*$/.test(key.trim());
  const canCreate = keyOk && name.trim().length > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建自定义 Agent</DialogTitle>
          <DialogDescription>
            创建一个会话型助手。key 用于内部标识，创建后不可更改；名称与描述用于识别。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="agent-key">Key</Label>
            <Input
              id="agent-key"
              placeholder="如 research_helper"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="font-mono"
            />
            {key.length > 0 && !keyOk && (
              <span className="text-destructive text-xs">小写字母开头，仅含小写字母/数字/下划线</span>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="agent-name">名称</Label>
            <Input
              id="agent-name"
              placeholder="如 研究助手"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="agent-desc">描述</Label>
            <Textarea
              id="agent-desc"
              placeholder="一句话说明这个 Agent 是干什么的"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={!canCreate}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [editKey, setEditKey] = React.useState<string | null>(null);
  // 失败时保留旧清单并记录 error,列表区据此显示错误/重试,而不是伪装成「0 个」。
  const [loadError, setLoadError] = React.useState<Error | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState<"all" | "builtin" | "custom">("all");

  const reload = React.useCallback(() => {
    api
      .agents()
      .then((next) => {
        setAgents(next);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error : new Error(String(error)));
      })
      .finally(() => setLoaded(true));
  }, []);
  React.useEffect(() => {
    reload();
  }, [reload]);

  const editing = agents.find((a) => a.key === editKey) ?? null;

  const builtinCount = agents.filter((a) => a.builtin).length;
  const customCount = agents.length - builtinCount;
  const needle = q.trim().toLowerCase();
  const filtered = agents.filter(
    (a) =>
      (kind === "all" || (kind === "builtin" ? a.builtin : !a.builtin)) &&
      (!needle ||
        a.name.toLowerCase().includes(needle) ||
        a.key.toLowerCase().includes(needle) ||
        (a.description ?? "").toLowerCase().includes(needle)),
  );
  const filtering = needle !== "" || kind !== "all";

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        icon={Bot}
        title="Agent 管理"
        description="内置 Agent 的提示词与配置，以及自定义会话 Agent 的创建与管理。"
        // 总数 = 内置 + 自定义，三个数字并列是同一口径的重复计数；
        // 内置是常态，只有存在自定义 Agent 时才值得单独说一句。
        meta={[
          <span className="tabular-nums">共 {agents.length} 个 Agent</span>,
          customCount > 0 ? <span className="tabular-nums">其中自定义 {customCount} 个</span> : null,
        ]}
        actions={<CreateAgentDialog onCreated={(key) => { reload(); setEditKey(key); }} />}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2 shadow-[var(--shadow-card)]">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="搜索 Agent"
              placeholder="搜索名称、key 或描述…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 pl-8 text-[13px]"
            />
          </div>
          <Select value={kind} onValueChange={(v) => setKind(v as "all" | "builtin" | "custom")}>
            <SelectTrigger aria-label="Agent 类型筛选" className="h-8 w-full text-[13px] sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="builtin">内置</SelectItem>
              <SelectItem value="custom">自定义</SelectItem>
            </SelectContent>
          </Select>
          {filtering && (
            <>
              <span className="text-[12px] tabular-nums text-muted-foreground">
                {filtered.length} / {agents.length}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  setQ("");
                  setKind("all");
                }}
              >
                清除筛选
              </Button>
            </>
          )}
      </div>

        <AsyncState
          status={!loaded ? "loading" : loadError && agents.length === 0 ? "error" : "ready"}
          error={loadError}
          onRetry={reload}
          isEmpty={loaded && !loadError && agents.length === 0}
          empty={
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-6 text-center">
              <Bot className="size-6 text-muted-foreground/50" />
              <p className="text-[13px] font-medium text-foreground">还没有 Agent</p>
              <p className="max-w-sm text-[12px] leading-5 text-muted-foreground">
                内置 Agent 会在初始化时创建；也可以点右上角「新建 Agent」创建自定义会话 Agent。
              </p>
            </div>
          }
          skeleton={
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((key) => (
                <Skeleton key={key} className="h-44 w-full rounded-lg" />
              ))}
            </div>
          }
        >
          <>
            {loadError && agents.length > 0 && (
              <div
                role="alert"
                className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">刷新 Agent 清单失败：{loadError.message}</span>
                <Button size="sm" variant="outline" onClick={reload}>
                  重试
                </Button>
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-6 text-center">
                <SearchIcon className="size-6 text-muted-foreground/50" />
                <p className="text-[13px] font-medium text-foreground">没有匹配的 Agent</p>
                <p className="text-[12px] leading-5 text-muted-foreground">调整关键词或类型筛选后再试。</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => {
                    setQ("");
                    setKind("all");
                  }}
                >
                  清除筛选
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((a) => (
                  <AgentGridCard key={a.key} agent={a} onOpen={() => setEditKey(a.key)} onDeleted={reload} />
                ))}
              </div>
            )}
          </>
        </AsyncState>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditKey(null)}>
        <SheetContent
          side="right"
          className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[45vw] data-[side=right]:sm:max-w-[45vw]"
        >
          {editing && (
            <>
              <SheetHeader className="gap-2 border-b border-border/70 px-4 pt-4 pb-3">
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="size-4" />
                  </span>
                  {editing.name}
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">
                    {editing.key}
                  </span>
                  {!editing.builtin && (
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      自定义
                    </span>
                  )}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {editing.description || "提示词、配置、可见资源与工具绑定"}
                </SheetDescription>
              </SheetHeader>
              <AgentEditor agentKey={editing.key} onSaved={reload} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
