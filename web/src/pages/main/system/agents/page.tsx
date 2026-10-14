import * as React from "react";
import { AlertDialog, Button, Card, Chip, Description, Drawer, Input, Label, Modal, TextArea, TextField, } from "@heroui/react";
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
      <Button type="button" onClick={onOpen} className="flex flex-col gap-2 text-left" variant="ghost" size="sm">
        <div className="flex flex-wrap items-center gap-2">
          <Bot className="text-muted size-4"/>
          <span className="text-sm font-medium">{agent.name}</span>
          <span className="text-muted font-mono text-xs">{agent.key}</span>
          {agent.builtin ? (<Chip className="px-1.5 py-0 text-[10px]" size="sm" variant={"soft"}>
              内置
            </Chip>) : (<Chip className="px-1.5 py-0 text-[10px]" size="sm" variant={"secondary"}>
              自定义
            </Chip>)}
          {!agent.enabled && (<Chip className="text-danger px-1.5 py-0 text-[10px]" size="sm" variant={"secondary"}>
              已停用
            </Chip>)}
        </div>
        <p className="text-muted line-clamp-2 min-h-8 text-xs">{agent.description || "（无描述）"}</p>
        <div className="text-muted flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded border px-1.5 py-0.5">MCP {agent.mcp_count ?? 0}</span>
          <span className="rounded border px-1.5 py-0.5">Skill {agent.skill_count ?? 0}</span>
          <span className="rounded border px-1.5 py-0.5">工具 {agent.tool_count ?? 0}</span>
        </div>
      </Button>
      {!agent.builtin && (<AlertDialog>
          
            <Button className="text-muted hover:text-danger absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100" size="sm" isIconOnly variant={"ghost"}>
              <Trash2Icon className="size-3.5"/>
            </Button>
          
          <AlertDialog.Backdrop>
            <AlertDialog.Container>
              <AlertDialog.Dialog>
                <AlertDialog.Header>
                  <AlertDialog.Heading>删除 Agent「{agent.name}」？</AlertDialog.Heading>
                  <AlertDialog.Body>将一并删除它的提示词、变量、可见性与工具绑定。此操作不可撤销。</AlertDialog.Body>
                </AlertDialog.Header>
                <AlertDialog.Footer>
                  <Button slot="close" variant={"outline"}>
                    取消
                  </Button>
                  <Button onPress={del} slot="close">
                    删除
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>)}
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
    return (<Modal isOpen={open} onOpenChange={setOpen}>
      
        <Button size="sm">
          <PlusIcon /> 新建 Agent
        </Button>
      
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="关闭"/>
            <Modal.Header>
              <Modal.Heading>新建自定义 Agent</Modal.Heading>
              <Description>创建一个会话型助手。key 用于内部标识，创建后不可更改；名称与描述用于识别。</Description>
            </Modal.Header>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="agent-key">Key</Label>
                <TextField className="contents" aria-label={"如 research_helper"}>
                  <Input id="agent-key" placeholder="如 research_helper" value={key} onChange={(e) => setKey(e.target.value)} className="font-mono"/>
                </TextField>
                {key.length > 0 && !keyOk && (<span className="text-danger text-xs">小写字母开头，仅含小写字母/数字/下划线</span>)}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="agent-name">名称</Label>
                <TextField className="contents" aria-label={"如 研究助手"}>
                  <Input id="agent-name" placeholder="如 研究助手" value={name} onChange={(e) => setName(e.target.value)}/>
                </TextField>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="agent-desc">描述</Label>
                <TextField className="contents" aria-label={"一句话说明这个 Agent 是干什么的"}>
                  <TextArea id="agent-desc" placeholder="一句话说明这个 Agent 是干什么的" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}/>
                </TextField>
              </div>
            </div>
            <Modal.Footer>
              <Button onPress={create} isDisabled={!canCreate}>
                创建
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>);
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

      <Card>
        <Card.Header>
          <Card.Title>Agent 清单</Card.Title>
          <Card.Description>共 {agents.length} 个</Card.Description>
        </Card.Header>
        <Card.Content>
          {agents.length === 0 ? (<p className="text-muted py-6 text-center text-sm">（暂无 Agent）</p>) : (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => (<AgentGridCard key={a.key} agent={a} onOpen={() => setEditKey(a.key)} onDeleted={reload}/>))}
            </div>)}
        </Card.Content>
      </Card>

      
        <Drawer.Backdrop isOpen={!!editing} onOpenChange={(o) => !o && setEditKey(null)}>
          <Drawer.Content placement={"right"}>
            <Drawer.Dialog className="flex flex-col gap-0 p-0 data-[side=right]:w-[45vw] data-[side=right]:sm:max-w-[45vw]">
              <Drawer.CloseTrigger aria-label="关闭"/>
              {editing && (<>
                  <Drawer.Header className="px-4">
                    <Drawer.Heading className="flex items-center gap-2">
                      {editing.name}
                      <span className="text-muted font-mono text-xs">{editing.key}</span>
                      {!editing.builtin && (<Chip className="px-1.5 py-0 text-[10px]" size="sm" variant={"secondary"}>
                          自定义
                        </Chip>)}
                    </Drawer.Heading>
                    <Description>{editing.description || "提示词、配置、可见资源与工具绑定"}</Description>
                  </Drawer.Header>
                  <AgentEditor agentKey={editing.key} onSaved={reload}/>
                </>)}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      
    </div>);
}
