import * as React from "react";
import { Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, TextField } from "@mui/material";
import { Bot, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { AgentEditor } from "@/components/agent-editor";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";
// AgentGridCard is one clickable tile opening the agent's editor drawer. Custom
// (non-builtin) agents get a delete button.
function AgentGridCard({ agent, onOpen, onDeleted }: {
    agent: Agent;
    onOpen: () => void;
    onDeleted: () => void;
}) {
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    async function del() {
        try {
            await api.deleteAgent(agent.key);
            toast.success(`已删除 Agent「${agent.name}」`);
            onDeleted();
        }
        catch (e) {
            toast.error("删除失败：" + (e as Error).message);
        }
    }
    return (<div className="hover:border-accent/50 group relative flex flex-col gap-2 rounded-lg border p-4 transition-colors">
      <Button type="button" onClick={onOpen} className="flex flex-col gap-2 text-left" variant="text" size="small">
        <div className="flex flex-wrap items-center gap-2">
          <Bot className="text-muted size-4"/>
          <span className="text-sm font-medium">{agent.name}</span>
          <span className="text-muted font-mono text-xs">{agent.key}</span>
          {agent.builtin ? <Chip className="px-1.5 py-0 text-[10px]" size="small" label="内置" /> : <Chip className="px-1.5 py-0 text-[10px]" size="small" label="自定义" />}
          {!agent.enabled && <Chip className="text-danger px-1.5 py-0 text-[10px]" size="small" label="已停用" />}
        </div>
        <p className="text-muted line-clamp-2 min-h-8 text-xs">{agent.description || "（无描述）"}</p>
        <div className="text-muted flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded border px-1.5 py-0.5">MCP {agent.mcp_count ?? 0}</span>
          <span className="rounded border px-1.5 py-0.5">Skill {agent.skill_count ?? 0}</span>
          <span className="rounded border px-1.5 py-0.5">工具 {agent.tool_count ?? 0}</span>
        </div>
      </Button>
      {!agent.builtin && (<>
            <IconButton className="text-muted hover:text-danger absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100" size="small" aria-label="删除 Agent" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon className="size-3.5"/>
            </IconButton>
          <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
                <DialogTitle>删除 Agent「{agent.name}」？</DialogTitle>
                <DialogContent>将一并删除它的提示词、变量、可见性与工具绑定。此操作不可撤销。</DialogContent>
                <DialogActions>
                  <Button onClick={() => setDeleteOpen(false)} variant="outlined">
                    取消
                  </Button>
                  <Button onClick={async () => { await del(); setDeleteOpen(false); }} variant="contained" color="error">
                    删除
                  </Button>
                </DialogActions>
          </Dialog>
        </>)}
    </div>);
}
function CreateAgentDialog({ onCreated }: {
    onCreated: (key: string) => void;
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
        }
        catch (e) {
            toast.error("创建失败：" + (e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    const keyOk = /^[a-z][a-z0-9_]*$/.test(key.trim());
    const canCreate = keyOk && name.trim().length > 0 && !busy;
    return (<>
        <Button size="small" onClick={() => setOpen(true)} variant="contained">
          <PlusIcon /> 新建 Agent
        </Button>
      
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>新建自定义 Agent</DialogTitle>
            <DialogContent>
              <p className="text-muted text-sm">创建一个会话型助手。key 用于内部标识，创建后不可更改；名称与描述用于识别。</p>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <TextField id="agent-key" label="Key" placeholder="如 research_helper" value={key} onChange={(e) => setKey(e.target.value)} slotProps={{ htmlInput: { className: "font-mono" } }} fullWidth size="small"/>
                {key.length > 0 && !keyOk && (<span className="text-danger text-xs">小写字母开头，仅含小写字母/数字/下划线</span>)}
              </div>
              <div className="grid gap-1.5">
                <TextField id="agent-name" label="名称" placeholder="如 研究助手" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small"/>
              </div>
              <div className="grid gap-1.5">
                <TextField id="agent-desc" label="描述" placeholder="一句话说明这个 Agent 是干什么的" multiline minRows={2} value={description} onChange={(e) => setDescription(e.target.value)} fullWidth size="small"/>
              </div>
            </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={create} disabled={!canCreate} variant="contained">
                创建
              </Button>
            </DialogActions>
      </Dialog>
    </>);
}
export default function AgentsPage() {
    const [agents, setAgents] = React.useState<Agent[]>([]);
    const [editKey, setEditKey] = React.useState<string | null>(null);
    const reload = React.useCallback(() => {
        api
            .agents()
            .then(setAgents)
            .catch(() => setAgents([]));
    }, []);
    React.useEffect(() => {
        reload();
    }, [reload]);
    const editing = agents.find((a) => a.key === editKey) ?? null;
    return (<div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agent</h1>
          <p className="text-muted text-sm">内置 Agent 的提示词/配置，以及自定义会话 Agent 的创建与管理</p>
        </div>
        <CreateAgentDialog onCreated={(key) => {
            reload();
            setEditKey(key);
        }}/>
      </div>

      <Card variant="outlined">
        <div className="p-4"><div className="font-semibold">Agent 清单</div><div className="text-muted text-sm">共 {agents.length} 个</div></div>
        <div className="p-4">
          {agents.length === 0 ? (<p className="text-muted py-6 text-center text-sm">（暂无 Agent）</p>) : (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => (<AgentGridCard key={a.key} agent={a} onOpen={() => setEditKey(a.key)} onDeleted={reload}/>))}
            </div>)}
        </div>
      </Card>

      
        <Drawer anchor="right" open={!!editing} onClose={() => setEditKey(null)} slotProps={{ paper: { sx: { width: { xs: "100vw", sm: "45vw" }, maxWidth: "45vw" } } }}>
            <div className="flex flex-col gap-0 p-0 h-full">
              {editing && (<>
                  <div className="px-4 py-4 border-b">
                    <div className="flex items-center gap-2 font-semibold">
                      {editing.name}
                      <span className="text-muted font-mono text-xs">{editing.key}</span>
                      {!editing.builtin && <Chip className="px-1.5 py-0 text-[10px]" size="small" label="自定义" />}
                    </div>
                    <p className="text-muted text-sm">{editing.description || "提示词、配置、可见资源与工具绑定"}</p>
                  </div>
                  <AgentEditor agentKey={editing.key} onSaved={reload}/>
                </>)}
            </div>
        </Drawer>
      
    </div>);
}
