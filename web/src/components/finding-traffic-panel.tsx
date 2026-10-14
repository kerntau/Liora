import * as React from "react";
import { Alert, Button, Card, Chip, ListBox, Modal, Select, Skeleton, TextArea } from "@heroui/react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { TrafficEvidenceViewer } from "@/components/traffic-evidence-viewer";
import { TrafficPickerDialog } from "@/components/traffic-picker-dialog";
import { api } from "@/lib/api";
import type { FindingTraffic, FindingTrafficBinding, TrafficEvidenceRole } from "@/lib/types";
const ROLES: Record<TrafficEvidenceRole, string> = {
    baseline: "正常对照",
    proof: "漏洞证明",
    verification: "补充验证",
    supporting: "辅助证据",
};
export function FindingTrafficPanel({ findingId, contextTask, readOnly, onChanged, }: {
    findingId: string;
    contextTask?: string;
    readOnly?: boolean;
    onChanged: () => void;
}) {
    const [data, setData] = React.useState<FindingTraffic | null>(null);
    const [error, setError] = React.useState("");
    const [adding, setAdding] = React.useState(false);
    const [preview, setPreview] = React.useState<string | null>(null);
    const [editing, setEditing] = React.useState<FindingTrafficBinding | null>(null);
    const [role, setRole] = React.useState<TrafficEvidenceRole>("supporting");
    const [note, setNote] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [reload, setReload] = React.useState(0);
    // biome-ignore lint/correctness/useExhaustiveDependencies: retry token intentionally refreshes this request.
    React.useEffect(() => {
        let active = true;
        setData(null);
        setError("");
        api
            .findingTraffic(findingId, contextTask)
            .then((value) => {
            if (active)
                setData(value);
        })
            .catch((e: Error) => {
            if (active)
                setError(e.message);
        });
        return () => {
            active = false;
        };
    }, [findingId, contextTask, reload]);
    async function mutate(action: () => Promise<FindingTraffic>) {
        setBusy(true);
        try {
            setData(await action());
            setEditing(null);
            onChanged();
            toast.success("流量证据已更新");
        }
        catch (e) {
            toast.error((e as Error).message);
            setReload((n) => n + 1);
        }
        finally {
            setBusy(false);
        }
    }
    function move(index: number, delta: number) {
        if (!data)
            return;
        const ids = data.bindings.map((b) => b.id);
        [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
        void mutate(() => api.orderFindingTraffic(findingId, ids, data.version, contextTask));
    }
    return (<>
      <Card className="border border-border">
        <Card.Header className="flex flex-row flex-wrap items-center justify-between gap-2 p-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <Card.Title className="text-base font-semibold">
              关联流量 {data ? `(${data.bindings.length})` : ""}
            </Card.Title>
            <Card.Description className="text-xs text-muted">
              按复现顺序组织请求与响应。清理原始流量后，已绑定证据仍然保留。
            </Card.Description>
          </div>
          <div>
            {!readOnly ? (<Button size="sm" isDisabled={!data || busy} onPress={() => setAdding(true)} className="gap-1.5" variant={"outline"}>
                <PlusIcon className="size-4"/>
                绑定流量
              </Button>) : (<Chip size="sm" color="default" variant={"soft"}>
                继承证据 · 只读
              </Chip>)}
          </div>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3 p-4">
          {error ? (<Alert status="danger">
              <Alert.Description className="flex items-center justify-between gap-2">
                <span>{error}</span>
                <Button size="sm" onPress={() => setReload((n) => n + 1)} variant={"outline"}>
                  重试
                </Button>
              </Alert.Description>
            </Alert>) : null}
          {!data ? (<Skeleton className="h-28 w-full rounded-md"/>) : data.bindings.length === 0 ? (<div className="flex flex-col items-center justify-center p-8 text-center text-muted">
              <p className="font-medium text-foreground">暂无关联流量</p>
              <p className="text-xs mt-1">可绑定正常对照、漏洞证明和补充验证请求。</p>
            </div>) : (data.bindings.map((b, index) => {
            const statusColor = b.snapshot.status >= 400 ? "warning" : "success";
            return (<div key={b.id} className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-surface-secondary/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" color="default" variant={"soft"}>
                      {index + 1}. {ROLES[b.role]}
                    </Chip>
                    <Chip size="sm" color={statusColor} variant={"soft"}>
                      {b.snapshot.method} · {b.snapshot.status}
                    </Chip>
                    <span className="text-xs text-muted">证据 #{b.id}</span>
                  </div>
                  <Button type="button" className="text-left text-accent hover:underline cursor-pointer" onClick={() => setPreview(b.id)} variant="ghost" size="sm">
                    <span className="break-all font-mono text-xs">{b.snapshot.url}</span>
                  </Button>
                  {b.note ? <p className="text-sm whitespace-pre-wrap">{b.note}</p> : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted">
                      {new Date(b.snapshot.captured_at * 1000).toLocaleString("zh-CN")}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button size="sm" onPress={() => setPreview(b.id)} variant={"outline"}>
                        查看报文
                      </Button>
                      {!readOnly ? (<>
                          <Button size="sm" isDisabled={busy} onPress={() => {
                        setEditing(b);
                        setRole(b.role);
                        setNote(b.note);
                    }} variant={"ghost"}>
                            编辑说明
                          </Button>
                          <Button size="sm" isIconOnly className="size-7" aria-label={`上移证据 ${b.id}`} isDisabled={busy || index === 0} onPress={() => move(index, -1)} variant={"ghost"}>
                            <ArrowUpIcon className="size-4"/>
                          </Button>
                          <Button size="sm" isIconOnly className="size-7" aria-label={`下移证据 ${b.id}`} isDisabled={busy || index === data.bindings.length - 1} onPress={() => move(index, 1)} variant={"ghost"}>
                            <ArrowDownIcon className="size-4"/>
                          </Button>
                          <Button size="sm" isDisabled={busy} onPress={() => void mutate(() => api.removeFindingTraffic(findingId, b.id, data.version, contextTask))} className="text-danger hover:bg-danger/10" variant={"ghost"}>
                            解除绑定
                          </Button>
                        </>) : null}
                    </div>
                  </div>
                </div>);
        }))}
        </Card.Content>
      </Card>

      {adding && data ? (<TrafficPickerDialog findingId={findingId} contextTask={contextTask} bound={data.bindings} onClose={() => setAdding(false)} onBound={() => {
                setReload((n) => n + 1);
                onChanged();
            }}/>) : null}

      <TrafficEvidenceViewer findingId={findingId} bindingId={preview} contextTask={contextTask} onClose={() => setPreview(null)}/>

      
        <Modal.Backdrop isOpen={editing !== null} onOpenChange={(open) => {
            if (!open && !busy)
                setEditing(null);
        }}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-md">
              <Modal.Header>
                <Modal.Heading>编辑流量证据</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <p className="text-xs text-muted">说明这组请求/响应如何支持漏洞结论。</p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">用途</label>
                  <Select aria-label="用途" selectedKey={role} onSelectionChange={(key) => {
            if (key !== null)
                ((k) => setRole(String(k) as TrafficEvidenceRole))(String(key));
        }}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {Object.entries(ROLES).map(([val, lbl]) => (<ListBox.Item key={val} id={val}>
                            {lbl}
                          </ListBox.Item>))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">证据说明</label>
                  <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full text-xs"/>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button isDisabled={busy} onPress={() => setEditing(null)} variant={"outline"}>
                  取消
                </Button>
                <Button isDisabled={busy || !editing || !data} onPress={() => {
            if (editing && data)
                void mutate(() => api.editFindingTraffic(findingId, editing.id, data.version, { role, note }, contextTask));
        }} variant={"primary"}>
                  保存说明
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      
    </>);
}
