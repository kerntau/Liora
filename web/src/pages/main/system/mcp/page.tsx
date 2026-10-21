"use client";

import * as React from "react";
import { toast } from "@/components/ui/sonner";
import { PlusIcon, RefreshCwIcon, ServerIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AsyncState } from "@/components/async-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAsyncData } from "@/hooks/use-async-data";
import type { MCPServer, MCPTool, Agent } from "@/lib/types";

type Transport = "stdio" | "http" | "sse";
type FormState = {
  name: string;
  transport: Transport;
  command: string;
  args: string;
  url: string;
  env: string;
  insecure: boolean;
};
const emptyForm: FormState = {
  name: "",
  transport: "stdio",
  command: "",
  args: "",
  url: "",
  env: "",
  insecure: false,
};

// 授权区的错误行：权限或 Agent 列表没拉到时必须明确报错，
// 不能把「没拉到」渲染成「谁都没授权」。
function AuthErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 text-destructive text-xs">
      <span>{message}</span>
      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}

export default function MCPPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [visibility, setVisibility] = React.useState<Record<number, string[]>>({});
  const [visibilityError, setVisibilityError] = React.useState<string | null>(null);
  const visibilitySeq = React.useRef(0);

  // 服务器列表走统一四态：首载骨架、失败常驻可重试；刷新保留上一份，卡片不闪空。
  const serversQ = useAsyncData(() => api.mcpServers(), []);
  const servers = serversQ.data ?? [];
  const [pendingDelete, setPendingDelete] = React.useState<MCPServer | null>(null);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MCPServer | null>(null); // null = add mode
  const [tab, setTab] = React.useState<"config" | "tools">("config");
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [tools, setTools] = React.useState<MCPTool[]>([]);
  const [toolsLoading, setToolsLoading] = React.useState(false);
  const [toolsError, setToolsError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  // 切换服务器时旧请求可能后到；序号保证只有最新一次请求能写入工具列表。
  const toolsSeq = React.useRef(0);

  // Agent 列表拉不到时不能静默：空数组会被渲染成「一个 Agent 都没授权」。
  const [agentsFailed, setAgentsFailed] = React.useState(false);
  const loadAgents = React.useCallback(() => {
    setAgentsFailed(false);
    api.agents()
      .then(setAgents)
      .catch(() => setAgentsFailed(true));
  }, []);
  // 变更后统一刷新：Agent 列表 + 服务器列表。
  const load = React.useCallback(() => {
    loadAgents();
    serversQ.reload();
  }, [loadAgents, serversQ.reload]);
  React.useEffect(() => {
    loadAgents();
  }, [loadAgents]);
  // 可见性按服务器批量补拉：一次刷新只发一轮并发请求，不拖慢列表首屏。
  // 失败时明确报错，不能把"没拉到"渲染成"未授权"。
  const loadVisibility = React.useCallback(() => {
    const list = serversQ.data ?? [];
    const seq = ++visibilitySeq.current;
    if (list.length === 0) {
      setVisibilityError(null);
      return;
    }
    setVisibilityError(null);
    void Promise.all(
      list.map((s) => api.resourceVisibility("mcp", s.id).then((ids) => [s.id, ids] as const)),
    )
      .then((pairs) => {
        if (visibilitySeq.current !== seq) return;
        setVisibility((prev) => {
          const next = { ...prev };
          for (const [id, ids] of pairs) next[id] = ids;
          return next;
        });
      })
      .catch(() => {
        if (visibilitySeq.current !== seq) return;
        setVisibilityError("权限加载失败");
      });
  }, [serversQ.data]);

  React.useEffect(() => { loadVisibility(); }, [loadVisibility]);

  function setF(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function parseEnv(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        if (key) out[key] = trimmed.slice(idx + 1).trim();
      }
    }
    return out;
  }
  function envToText(env: Record<string, string> | undefined): string {
    return Object.entries(env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
  }

  function openAdd() {
    toolsSeq.current++; // 作废仍在途的工具请求，避免回填到新建表单
    setToolsLoading(false);
    setEditing(null);
    setForm(emptyForm);
    setTools([]);
    setToolsError(null);
    setTab("config");
    setOpen(true);
  }

  function openEdit(s: MCPServer) {
    setEditing(s);
    setForm({
      name: s.name,
      transport: s.transport,
      command: s.command ?? "",
      args: (s.args ?? []).join(" "),
      url: s.url ?? "",
      env: envToText(s.env),
      insecure: s.insecure ?? false,
    });
    setTab("config");
    setOpen(true);
    loadTools(s.id);
  }

  async function loadTools(id: number) {
    const seq = ++toolsSeq.current;
    setToolsLoading(true);
    setToolsError(null);
    try {
      const list = await api.mcpTools(id);
      if (toolsSeq.current !== seq) return;
      setTools(list);
    } catch (e) {
      if (toolsSeq.current !== seq) return;
      setToolsError((e as Error).message || "加载失败");
    } finally {
      if (toolsSeq.current === seq) setToolsLoading(false);
    }
  }

  async function saveForm() {
    if (!form.name.trim()) {
      toast.error("请填写名称");
      return;
    }
    if (form.transport === "stdio" && !form.command.trim()) {
      toast.error("请填写命令");
      return;
    }
    if (form.transport !== "stdio" && !form.url.trim()) {
      toast.error("请填写远程 URL");
      return;
    }
    setSaving(true);
    try {
      const base =
        form.transport !== "stdio"
          ? {
              transport: form.transport,
              url: form.url.trim(),
              command: "",
              args: [] as string[],
              env: parseEnv(form.env), // 远程模式下 env 即请求头
              insecure: form.insecure,
            }
          : {
              transport: "stdio" as const,
              command: form.command.trim(),
              args: form.args.trim() ? form.args.trim().split(/\s+/) : [],
              env: parseEnv(form.env),
              insecure: false,
            };
      await api.saveMcpServer({
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        enabled: editing ? editing.enabled : true,
        ...base,
      });
      toast.success(editing ? "已保存" : "已添加 MCP 服务器");
      if (!editing) setOpen(false);
      load();
    } catch (e) {
      toast.error("保存失败：" + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function refreshTools() {
    if (!editing) return;
    const seq = ++toolsSeq.current;
    setToolsLoading(false); // 作废在途的 loadTools，其 finally 不再负责复位
    setRefreshing(true);
    try {
      const t = await api.refreshMcpServer(editing.id);
      if (toolsSeq.current !== seq) return;
      setTools(t);
      setToolsError(null);
      toast.success(`发现 ${t.length} 个工具`);
      load();
    } catch (e) {
      toast.error("刷新失败：" + (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  async function removeServer(s: MCPServer) {
    try {
      await api.deleteMcpServer(s.id);
      toast.success(`已删除：${s.name}`);
      setOpen(false);
      load();
    } catch (e) {
      toast.error("删除失败：" + (e as Error).message);
      // 抛给 ConfirmDialog：失败时保持确认框打开，不假装已删除。
      throw e;
    }
  }

  async function toggleEnabled(s: MCPServer) {
    try {
      await api.saveMcpServer({ ...s, enabled: !s.enabled });
      load();
    } catch (e) {
      toast.error("操作失败：" + (e as Error).message);
    }
  }

  async function toggleVisibility(serverId: number, agentId: string, agentName: string) {
    const on = (visibility[serverId] ?? []).includes(agentId);
    try {
      await api.toggleVisibility(agentId, "mcp", serverId, !on);
      toast.success(`${on ? "取消" : "授予"}「${agentName}」可见`);
      load();
    } catch (e) {
      toast.error("操作失败：" + (e as Error).message);
    }
  }

  // 授权区：权限或 Agent 列表任一失败都必须明确报错，不能渲染成「谁都没授权」。
  function renderVisibility(server: MCPServer) {
    if (visibilityError) {
      return <AuthErrorRow message="权限加载失败，暂无法查看或修改授权。" onRetry={loadVisibility} />;
    }
    if (agentsFailed) {
      return <AuthErrorRow message="Agent 列表加载失败，暂无法查看或修改授权。" onRetry={loadAgents} />;
    }
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {agents.map((a) => (
          <label key={a.key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={(visibility[server.id] ?? []).includes(a.id)}
              onCheckedChange={() => toggleVisibility(server.id, a.id, a.name)}
            />
            {a.name}
          </label>
        ))}
      </div>
    );
  }

  function renderForm() {
    return (
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>传输方式</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={form.transport === "stdio" ? "default" : "outline"}
              aria-pressed={form.transport === "stdio"}
              onClick={() => setF({ transport: "stdio" })}
            >
              stdio（本地）
            </Button>
            <Button
              type="button"
              variant={form.transport === "http" ? "default" : "outline"}
              aria-pressed={form.transport === "http"}
              onClick={() => setF({ transport: "http" })}
            >
              http（远程）
            </Button>
            <Button
              type="button"
              variant={form.transport === "sse" ? "default" : "outline"}
              aria-pressed={form.transport === "sse"}
              onClick={() => setF({ transport: "sse" })}
            >
              sse（旧版）
            </Button>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="m-name">名称</Label>
          <Input
            id="m-name"
            placeholder="filesystem"
            value={form.name}
            onChange={(e) => setF({ name: e.target.value })}
          />
        </div>
        {form.transport === "stdio" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="m-cmd">命令</Label>
              <Input
                id="m-cmd"
                className="font-mono"
                placeholder="npx"
                value={form.command}
                onChange={(e) => setF({ command: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-args">参数（空格分隔）</Label>
              <Input
                id="m-args"
                className="font-mono"
                placeholder="-y @modelcontextprotocol/server-filesystem /data"
                value={form.args}
                onChange={(e) => setF({ args: e.target.value })}
              />
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="m-url">远程 URL</Label>
            <Input
              id="m-url"
              className="font-mono"
              placeholder="https://mcp.example.com/mcp"
              value={form.url}
              onChange={(e) => setF({ url: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.insecure}
                onCheckedChange={(v) => setF({ insecure: v === true })}
              />
              跳过 TLS 证书校验（自签证书）
            </label>
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="m-env">
            {form.transport !== "stdio"
              ? "请求头（每行 KEY=VALUE，如 Authorization=Bearer xxx）"
              : "环境变量（每行 KEY=VALUE）"}
          </Label>
          <Textarea
            id="m-env"
            className="font-mono"
            placeholder={
              form.transport !== "stdio" ? "Authorization=Bearer xxxx" : "API_KEY=xxxx\nFOO=bar"
            }
            value={form.env}
            onChange={(e) => setF({ env: e.target.value })}
          />
        </div>
      </div>
    );
  }

  function renderTools() {
    let body: React.ReactNode;
    if (toolsLoading) {
      body = <p className="text-muted-foreground text-sm">加载中…</p>;
    } else if (toolsError) {
      body = (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-destructive text-sm">
          <span>工具列表加载失败：{toolsError}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { if (editing) void loadTools(editing.id); }}
          >
            重试
          </Button>
        </div>
      );
    } else if (tools.length === 0) {
      body = <p className="text-muted-foreground text-sm">尚未发现工具，点击刷新重新获取。</p>;
    } else {
      body = (
        <div className="flex flex-col divide-y">
          {tools.map((t) => (
            <div key={t.name} className="py-2.5">
              <code className="font-mono text-sm">{t.name}</code>
              {t.description && (
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  {t.description}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{tools.length} 个工具</span>
          <Button size="sm" variant="outline" disabled={refreshing} onClick={refreshTools}>
            <RefreshCwIcon className={refreshing ? "animate-spin" : ""} /> 刷新
          </Button>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">MCP</h1>
        <p className="text-muted-foreground text-sm">外部 MCP 工具服务器 · 按 Agent 授权可见</p>
      </div>

      <AsyncState
        status={serversQ.status}
        error={serversQ.error}
        onRetry={serversQ.reload}
        refreshing={serversQ.refreshing}
        skeleton={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[116px] rounded-xl" />
            ))}
          </div>
        }
      >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={openAdd}
          className="text-foreground/70 border-foreground/70 hover:bg-muted/60 hover:shadow-sm flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition"
        >
          <PlusIcon className="size-6" />
          <span className="text-sm">添加 MCP</span>
        </button>

        {servers.map((s) => (
          <Card
            key={s.id}
            onClick={() => openEdit(s)}
            className="hover:border-primary/60 cursor-pointer gap-3 transition hover:shadow-sm"
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <ServerIcon className="text-muted-foreground size-4 shrink-0" />
                <CardTitle className="min-w-0 flex-1 truncate text-base">
                  <button type="button" className="max-w-full truncate rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`编辑 MCP ${s.name}`} onClick={(event) => { event.stopPropagation(); openEdit(s); }}>
                    {s.name}
                  </button>
                </CardTitle>
                <Badge variant="outline" className="uppercase">
                  {s.transport}
                </Badge>
                <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={() => toggleEnabled(s)}
                    aria-label={`启用 MCP ${s.name}`}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={`删除 MCP ${s.name}`}
                    onClick={() => setPendingDelete(s)}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-muted-foreground text-sm">
                {s.tools && s.tools.length > 0 ? `${s.tools.length} 个工具` : "尚未发现工具"}
              </p>
              <div role="group" aria-label={`${s.name} 的 Agent 授权`} className="grid gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-muted-foreground text-xs">可见性（按 Agent 授权）</span>
                {renderVisibility(s)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </AsyncState>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          busy={saving}
          className="w-full! data-[side=right]:sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle>{editing ? editing.name : "添加 MCP 服务器"}</SheetTitle>
            <SheetDescription>
              stdio（本地起进程）或 http（远程 Streamable HTTP）
            </SheetDescription>
          </SheetHeader>

          {editing ? (
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "config" | "tools")}
              className="flex min-h-0 flex-1 flex-col px-4"
            >
              <TabsList>
                <TabsTrigger value="config">配置</TabsTrigger>
                <TabsTrigger value="tools">
                  工具列表{tools.length ? `（${tools.length}）` : ""}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="config" className="min-h-0 flex-1 overflow-y-auto">
                {renderForm()}
                <div className="flex gap-2 pt-2 pb-6">
                  <Button onClick={saveForm} disabled={saving}>
                    保存
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="tools" className="min-h-0 flex-1 overflow-y-auto">
                {renderTools()}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
              {renderForm()}
              <div className="pt-2 pb-6">
                <Button onClick={saveForm} disabled={saving}>
                  <PlusIcon /> 添加
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => { if (!o) setPendingDelete(null); }}
        title={pendingDelete ? `删除 MCP 服务器「${pendingDelete.name}」？` : "删除 MCP 服务器？"}
        description="将删除该服务器的连接配置、已发现的工具，以及各 Agent 的可见性授权。此操作不可撤销。"
        confirmLabel="删除"
        destructive
        onConfirm={async () => {
          if (pendingDelete) await removeServer(pendingDelete);
        }}
      />
    </div>
  );
}
