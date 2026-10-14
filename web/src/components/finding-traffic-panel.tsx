import * as React from "react";
import { Alert, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, Skeleton, TextField } from "@mui/material";
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
      <Card variant="outlined" className="border border-border">
        <div className="flex flex-row flex-wrap items-center justify-between gap-2 p-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <div className="text-base font-semibold">
              关联流量 {data ? `(${data.bindings.length})` : ""}
            </div>
            <div className="text-xs text-muted">
              按复现顺序组织请求与响应。清理原始流量后，已绑定证据仍然保留。
            </div>
          </div>
          <div>
            {!readOnly ? (<Button size="small" disabled={!data || busy} onClick={() => setAdding(true)} className="gap-1.5" variant="outlined">
                <PlusIcon className="size-4"/>
                绑定流量
              </Button>) : (<Chip size="small" label="继承证据 · 只读" />)}
          </div>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {error ? (<Alert severity="error" className="flex items-center justify-between gap-2">
                <span>{error}</span>
                <Button size="small" onClick={() => setReload((n) => n + 1)} variant="outlined">
                  重试
                </Button>
            </Alert>) : null}
          {!data ? (<Skeleton className="h-28 w-full rounded-md"/>) : data.bindings.length === 0 ? (<div className="flex flex-col items-center justify-center p-8 text-center text-muted">
              <p className="font-medium text-foreground">暂无关联流量</p>
              <p className="text-xs mt-1">可绑定正常对照、漏洞证明和补充验证请求。</p>
            </div>) : (data.bindings.map((b, index) => {
            const statusColor = b.snapshot.status >= 400 ? "warning" : "success";
            return (<div key={b.id} className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-surface-secondary/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="small" label={`${index + 1}. ${ROLES[b.role]}`} />
                    <Chip size="small" color={statusColor === "warning" ? "warning" : "success"} label={`${b.snapshot.method} · ${b.snapshot.status}`} />
                    <span className="text-xs text-muted">证据 #{b.id}</span>
                  </div>
                  <Button type="button" className="text-left text-accent hover:underline cursor-pointer" onClick={() => setPreview(b.id)} variant="text" size="small">
                    <span className="break-all font-mono text-xs">{b.snapshot.url}</span>
                  </Button>
                  {b.note ? <p className="text-sm whitespace-pre-wrap">{b.note}</p> : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted">
                      {new Date(b.snapshot.captured_at * 1000).toLocaleString("zh-CN")}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button size="small" onClick={() => setPreview(b.id)} variant="outlined">
                        查看报文
                      </Button>
                      {!readOnly ? (<>
                          <Button size="small" disabled={busy} onClick={() => {
                        setEditing(b);
                        setRole(b.role);
                        setNote(b.note);
                    }} variant="text">
                            编辑说明
                          </Button>
                          <IconButton size="small" aria-label={`上移证据 ${b.id}`} disabled={busy || index === 0} onClick={() => move(index, -1)}>
                            <ArrowUpIcon className="size-4"/>
                          </IconButton>
                          <IconButton size="small" aria-label={`下移证据 ${b.id}`} disabled={busy || index === data.bindings.length - 1} onClick={() => move(index, 1)}>
                            <ArrowDownIcon className="size-4"/>
                          </IconButton>
                          <Button size="small" disabled={busy} onClick={() => void mutate(() => api.removeFindingTraffic(findingId, b.id, data.version, contextTask))} className="text-danger hover:bg-danger/10" variant="text">
                            解除绑定
                          </Button>
                        </>) : null}
                    </div>
                  </div>
                </div>);
        }))}
        </div>
      </Card>

      {adding && data ? (<TrafficPickerDialog findingId={findingId} contextTask={contextTask} bound={data.bindings} onClose={() => setAdding(false)} onBound={() => {
                setReload((n) => n + 1);
                onChanged();
            }}/>) : null}

      <TrafficEvidenceViewer findingId={findingId} bindingId={preview} contextTask={contextTask} onClose={() => setPreview(null)}/>

      
        <Dialog open={editing !== null} onClose={() => { if (!busy) setEditing(null); }} fullWidth maxWidth="sm">
              <DialogTitle>编辑流量证据</DialogTitle>
              <DialogContent className="space-y-4">
                <p className="text-xs text-muted">说明这组请求/响应如何支持漏洞结论。</p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">用途</label>
                  <Select fullWidth size="small" value={role} aria-label="用途" onChange={(event) => setRole(event.target.value as TrafficEvidenceRole)}>
                    {Object.entries(ROLES).map(([val, lbl]) => <MenuItem key={val} value={val}>{lbl}</MenuItem>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">证据说明</label>
                  <TextField value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={3} fullWidth size="small" />
                </div>
              </DialogContent>
              <DialogActions>
                <Button disabled={busy} onClick={() => setEditing(null)} variant="outlined">
                  取消
                </Button>
                <Button disabled={busy || !editing || !data} onClick={() => {
            if (editing && data)
                void mutate(() => api.editFindingTraffic(findingId, editing.id, data.version, { role, note }, contextTask));
        }} variant="contained">
                  保存说明
                </Button>
              </DialogActions>
        </Dialog>
      
    </>);
}
