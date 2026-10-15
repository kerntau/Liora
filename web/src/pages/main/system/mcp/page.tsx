import * as React from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Drawer,
  FormControlLabel,
  FormGroup,
  IconButton,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { PlusIcon, RefreshCwIcon, ServerIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { Agent, MCPServer, MCPTool } from "@/lib/types";

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
export default function MCPPage() {
  const [servers, setServers] = React.useState<MCPServer[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [visibility, setVisibility] = React.useState<Record<number, string[]>>({});
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MCPServer | null>(null); // null = add mode
  const [tab, setTab] = React.useState<"config" | "tools">("config");
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [tools, setTools] = React.useState<MCPTool[]>([]);
  const [toolsLoading, setToolsLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const load = React.useCallback(() => {
    api
      .agents()
      .then(setAgents)
      .catch(() => {
        /* Optional catalog data remains empty if unavailable. */
      });
    api
      .mcpServers()
      .then((ss) => {
        setServers(ss);
        ss.forEach((s) => {
          void api
            .resourceVisibility("mcp", s.id)
            .then((ids) => setVisibility((v) => ({ ...v, [s.id]: ids })))
            .catch(() => {
              /* Optional catalog data remains empty if unavailable. */
            });
        });
      })
      .catch(() => {
        /* Optional catalog data remains empty if unavailable. */
      });
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);
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
    setEditing(null);
    setForm(emptyForm);
    setTools([]);
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
    void loadTools(s.id);
  }
  async function loadTools(id: number) {
    setToolsLoading(true);
    try {
      setTools(await api.mcpTools(id));
    } catch {
      setTools([]);
    } finally {
      setToolsLoading(false);
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
    setRefreshing(true);
    try {
      const t = await api.refreshMcpServer(editing.id);
      setTools(t);
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
  function renderForm() {
    return (
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Box component="span" sx={{ fontSize: "inherit" }}>
            传输方式
          </Box>
          <ToggleButtonGroup
            value={form.transport}
            exclusive
            size="small"
            aria-label="传输方式"
            onChange={(_event, value: Transport | null) => {
              if (value) setF({ transport: value });
            }}
          >
            <ToggleButton value="stdio">stdio（本地）</ToggleButton>
            <ToggleButton value="http">http（远程）</ToggleButton>
            <ToggleButton value="sse">sse（旧版）</ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="grid gap-2">
          <Box component="label" htmlFor="m-name" sx={{ fontSize: "inherit" }}>
            名称
          </Box>
          <TextField
            id="m-name"
            placeholder="filesystem"
            value={form.name}
            onChange={(e) => setF({ name: e.target.value })}
            fullWidth
            size="small"
            slotProps={{ htmlInput: { "aria-label": "名称" } }}
          />
        </div>
        {form.transport === "stdio" ? (
          <>
            <div className="grid gap-2">
              <Box component="label" htmlFor="m-cmd" sx={{ fontSize: "inherit" }}>
                命令
              </Box>
              <TextField
                id="m-cmd"
                placeholder="npx"
                value={form.command}
                onChange={(e) => setF({ command: e.target.value })}
                className={"font-mono"}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { "aria-label": "命令" } }}
                sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
              />
            </div>
            <div className="grid gap-2">
              <Box component="label" htmlFor="m-args" sx={{ fontSize: "inherit" }}>
                参数（空格分隔）
              </Box>
              <TextField
                id="m-args"
                placeholder="-y @modelcontextprotocol/server-filesystem /data"
                value={form.args}
                onChange={(e) => setF({ args: e.target.value })}
                className={"font-mono"}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { "aria-label": "参数（空格分隔）" } }}
                sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
              />
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <Box component="label" htmlFor="m-url" sx={{ fontSize: "inherit" }}>
              远程 URL
            </Box>
            <TextField
              id="m-url"
              placeholder="https://mcp.example.com/mcp"
              value={form.url}
              onChange={(e) => setF({ url: e.target.value })}
              className={"font-mono"}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { "aria-label": "远程 URL" } }}
              sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.insecure === true}
                  onChange={(_event, checked) => ((v) => setF({ insecure: v === true }))(checked)}
                  size="small"
                  slotProps={{ input: { "aria-label": undefined } }}
                />
              }
              label={
                <>
                  <Box
                    className="flex items-center gap-2 text-sm"
                    sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}
                  >
                    <Box component="span" sx={{ fontSize: "inherit" }}>
                      跳过 TLS 证书校验（自签证书）
                    </Box>
                  </Box>
                </>
              }
              sx={{
                m: 0,
                alignItems: "center",
                gap: 0.5,
                "& .MuiFormControlLabel-label": { minWidth: 0, flex: 1, fontSize: 14 },
              }}
            />
          </div>
        )}
        <div className="grid gap-2">
          <Box component="label" htmlFor="m-env" sx={{ fontSize: "inherit" }}>
            {form.transport !== "stdio"
              ? "请求头（每行 KEY=VALUE，如 Authorization=Bearer xxx）"
              : "环境变量（每行 KEY=VALUE）"}
          </Box>
          <TextField
            id="m-env"
            placeholder={form.transport !== "stdio" ? "Authorization=Bearer xxxx" : "API_KEY=xxxx\nFOO=bar"}
            value={form.env}
            onChange={(e) => setF({ env: e.target.value })}
            className={"font-mono"}
            multiline
            fullWidth
            size="small"
            slotProps={{
              htmlInput: {
                "aria-label": form.transport !== "stdio" ? "Authorization=Bearer xxxx" : "API_KEY=xxxx\nFOO=bar",
              },
            }}
            sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
          />
        </div>
      </div>
    );
  }
  function renderTools() {
    return (
      <div className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">{tools.length} 个工具</span>
          <Button disabled={refreshing} onClick={refreshTools} size="small" variant="outlined">
            <RefreshCwIcon className={refreshing ? "animate-spin" : ""} /> 刷新
          </Button>
        </div>
        {toolsLoading ? (
          <p className="text-muted text-sm">加载中…</p>
        ) : tools.length === 0 ? (
          <p className="text-muted text-sm">尚未发现工具，点击刷新重新获取。</p>
        ) : (
          <div className="flex flex-col divide-y">
            {tools.map((t) => (
              <div key={t.name} className="py-2.5">
                <code className="font-mono text-sm">{t.name}</code>
                {t.description && <p className="text-muted mt-0.5 text-xs leading-relaxed">{t.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">MCP</h1>
        <p className="text-muted text-sm">外部 MCP 工具服务器 · 按 Agent 授权可见</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Button
          type="button"
          onClick={openAdd}
          className="text-foreground/70 border-foreground/70 hover:bg-surface-secondary/60 hover:shadow-sm flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition"
          size="small"
          variant="text"
        >
          <PlusIcon className="size-6" />
          <span className="text-sm">添加 MCP</span>
        </Button>

        {servers.map((s) => (
          <Card key={s.id} variant="outlined">
            <Box sx={{ px: 3, pt: 3 }}>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => openEdit(s)}
                  size="small"
                  sx={{ minWidth: 0, justifyContent: "flex-start", gap: 1, flex: 1 }}
                  aria-label={`编辑 MCP ${s.name}`}
                >
                  <ServerIcon className="text-muted size-4 shrink-0" />
                  <Typography className="truncate text-base" component="span" variant="subtitle1">
                    {s.name}
                  </Typography>
                  <Chip className="uppercase" size="small" label={s.transport} />
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Switch
                    checked={s.enabled}
                    onChange={() => toggleEnabled(s)}
                    size="small"
                    slotProps={{ input: { "aria-label": `启用 MCP ${s.name}` } }}
                  />
                  <IconButton
                    aria-label={`删除 MCP ${s.name}`}
                    onClick={() => void removeServer(s)}
                    size="small"
                    color="error"
                  >
                    <Trash2Icon className="text-danger" />
                  </IconButton>
                </div>
              </div>
            </Box>
            <CardContent className="grid gap-3">
              <p className="text-muted text-sm">
                {s.tools && s.tools.length > 0 ? `${s.tools.length} 个工具` : "尚未发现工具"}
              </p>
              <div className="grid gap-2">
                <span className="text-muted text-xs">可见性（按 Agent 授权）</span>
                <FormGroup
                  aria-label={`${s.name} 的 Agent 授权`}
                  className="flex flex-wrap gap-x-4 gap-y-2"
                  role="group"
                >
                  {agents.map((a) => (
                    <FormControlLabel
                      key={a.key}
                      control={
                        <Checkbox
                          value={String(a.id)}
                          checked={(visibility[s.id] ?? []).includes(a.id)}
                          onChange={() => void toggleVisibility(s.id, a.id, a.name)}
                          size="small"
                          slotProps={{ input: { "aria-label": undefined } }}
                        />
                      }
                      label={
                        <>
                          <Box
                            className="flex items-center gap-2 text-sm"
                            sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}
                          >
                            <Box component="span" sx={{ fontSize: "inherit" }}>
                              {a.name}
                            </Box>
                          </Box>
                        </>
                      }
                      sx={{
                        m: 0,
                        alignItems: "center",
                        gap: 0.5,
                        "& .MuiFormControlLabel-label": { minWidth: 0, flex: 1, fontSize: 14 },
                      }}
                    />
                  ))}
                </FormGroup>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            "aria-labelledby": "mcp-editor-title",
            sx: { width: { xs: "100vw", sm: "clamp(420px,45vw,760px)" }, maxWidth: "100vw", overflow: "hidden" },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative" }}>
          <IconButton
            aria-label="关闭"
            onClick={() => setOpen(false)}
            size="small"
            sx={{ position: "absolute", right: 12, top: 12, zIndex: 1 }}
          >
            <XIcon size={18} />
          </IconButton>
          <Box sx={{ pt: 2, pb: 2, px: 2, pr: 5 }}>
            <Typography component="h2" variant="h6" id="mcp-editor-title">
              {editing ? editing.name : "添加 MCP 服务器"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              stdio（本地起进程）或 http（远程 Streamable HTTP）
            </Typography>
          </Box>

          {editing ? (
            <Box className="flex min-h-0 flex-1 flex-col px-4" sx={{ minWidth: 0 }}>
              <Tabs
                value={tab}
                onChange={(_event, value: "config" | "tools") => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ minHeight: 40, mb: 2 }}
              >
                <Tab
                  value={"config"}
                  label={<>配置</>}
                  id={"editor-tab-" + "config"}
                  aria-controls={"editor-panel-" + "config"}
                />
                <Tab
                  value={"tools"}
                  label={<>工具列表{tools.length ? `（${tools.length}）` : ""}</>}
                  id={"editor-tab-" + "tools"}
                  aria-controls={"editor-panel-" + "tools"}
                />
              </Tabs>

              <>
                {tab === "config" && (
                  <Box
                    className="min-h-0 flex-1 overflow-y-auto"
                    role="tabpanel"
                    id={"editor-panel-" + "config"}
                    aria-labelledby={"editor-tab-" + "config"}
                  >
                    {renderForm()}
                    <div className="flex gap-2 pt-2 pb-6">
                      <Button onClick={saveForm} disabled={saving} size="small" variant="contained">
                        保存
                      </Button>
                    </div>
                  </Box>
                )}
              </>
              <>
                {tab === "tools" && (
                  <Box
                    className="min-h-0 flex-1 overflow-y-auto"
                    role="tabpanel"
                    id={"editor-panel-" + "tools"}
                    aria-labelledby={"editor-tab-" + "tools"}
                  >
                    {renderTools()}
                  </Box>
                )}
              </>
            </Box>
          ) : (
            <Box
              className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4"
              data-scrollbar="thin"
              data-slot="scroll-shadow"
              sx={{ overflowY: "auto", overflowX: "hidden" }}
            >
              {renderForm()}
              <div className="pt-2 pb-6">
                <Button onClick={saveForm} disabled={saving} size="small" variant="contained">
                  <PlusIcon /> 添加
                </Button>
              </div>
            </Box>
          )}
        </Box>
      </Drawer>
    </div>
  );
}
