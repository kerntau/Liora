import * as React from "react";
import { Alert, Button, Checkbox, Chip, Input, ListBox, Modal, Select, Table, TextField } from "@heroui/react";
import { toast } from "sonner";
import { CapturedTrafficViewer } from "@/components/traffic-evidence-viewer";
import { api } from "@/lib/api";
import type { FindingTrafficBinding, TrafficResp } from "@/lib/types";
const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
export function TrafficPickerDialog({ findingId, contextTask, bound, onClose, onBound, }: {
    findingId: string;
    contextTask?: string;
    bound: FindingTrafficBinding[];
    onClose: () => void;
    onBound: () => void;
}) {
    const [host, setHost] = React.useState("");
    const [method, setMethod] = React.useState("all");
    const [query, setQuery] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [data, setData] = React.useState<TrafficResp | null>(null);
    const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
    const [preview, setPreview] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState("");
    const alreadyBound = new Set(bound.map((b) => b.snapshot.source_traffic_id));
    React.useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");
        const timer = setTimeout(() => {
            api
                .traffic(page, 25, host, method === "all" ? "" : method, query)
                .then((d) => {
                if (active)
                    setData(d);
            })
                .catch((e: Error) => {
                if (active)
                    setError(e.message);
            })
                .finally(() => {
                if (active)
                    setLoading(false);
            });
        }, 250);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [page, host, method, query]);
    const rows = data?.exchanges ?? [];
    const selectable = rows.filter((e) => !alreadyBound.has(e.id));
    function toggle(id: string, checked: boolean) {
        setSelected((previous) => {
            const next = new Set(previous);
            if (checked)
                next.add(id);
            else
                next.delete(id);
            return next;
        });
    }
    async function save() {
        setBusy(true);
        setError("");
        try {
            await api.bindFindingTraffic(findingId, [...selected].map((traffic_id) => ({ traffic_id })), contextTask);
            toast.success(`已绑定 ${selected.size} 条流量`);
            onBound();
            onClose();
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    const allSelected = selectable.length > 0 && selectable.every((e) => selected.has(e.id));
    return (<>
      
        <Modal.Backdrop isOpen onOpenChange={(open) => {
            if (!open && !busy)
                onClose();
        }}>
          <Modal.Container>
            <Modal.Dialog className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
              <Modal.Header>
                <Modal.Heading>绑定流量</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <p className="text-xs text-muted">
                  筛选并多选请求/响应，已选记录会跨页保留。绑定后可设置用途、说明和顺序。
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <TextField value={host} onChange={(v) => {
            setHost(v);
            setPage(0);
        }} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground">目标 host</label>
                    <Input placeholder="域名或 IP" className="text-xs"/>
                  </TextField>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground">请求方法</label>
                    <Select aria-label="请求方法" selectedKey={method} onSelectionChange={(key) => {
            if (key !== null)
                ((v) => {
                    setMethod(String(v));
                    setPage(0);
                })(String(key));
        }}>
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="all">全部方法</ListBox.Item>
                          {METHODS.map((m) => (<ListBox.Item key={m} id={m}>
                              {m}
                            </ListBox.Item>))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  <TextField value={query} onChange={(v) => {
            setQuery(v);
            setPage(0);
        }} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground">关键词</label>
                    <Input placeholder="URL / 正文关键词" className="text-xs"/>
                  </TextField>
                </div>

                {error ? (<Alert status="danger">
                    <Alert.Description>{error}</Alert.Description>
                  </Alert>) : null}

                <div className="max-h-[45vh] overflow-auto rounded-md border border-border" aria-busy={loading}>
                  <Table>
                    <Table.ScrollContainer>
                      <Table.Content className="w-full table-fixed text-left text-xs" aria-label="数据表" selectionMode="multiple" selectedKeys={new Set([...selected, ...alreadyBound])} disabledKeys={alreadyBound} disabledBehavior="selection" onSelectionChange={(keys) => setSelected(new Set((keys === "all" ? selectable.map((row) => row.id) : Array.from(keys).map(String)).filter((id) => !alreadyBound.has(id))))}>
                        <Table.Header className="border-b border-border bg-surface-secondary/50 font-medium text-muted">
                          <Table.Column className="w-10 px-3 py-2.5" id="column-5732" isRowHeader>
                            <Checkbox slot={null} aria-label="选择本页未绑定流量" isDisabled={loading || busy || selectable.length === 0} onChange={(checked) => setSelected((previous) => {
            const next = new Set(previous);
            for (const e of selectable) {
                if (checked)
                    next.add(e.id);
                else
                    next.delete(e.id);
            }
            return next;
        })} isSelected={allSelected === true}>
                              <Checkbox.Content>
                                <Checkbox.Control>
                                  <Checkbox.Indicator />
                                </Checkbox.Control>
                              </Checkbox.Content>
                            </Checkbox>
                          </Table.Column>
                          <Table.Column className="px-3 py-2.5" id="column-6384" isRowHeader>
                            方法 / URL
                          </Table.Column>
                          <Table.Column className="w-36 px-3 py-2.5" id="column-6448" isRowHeader>
                            时间
                          </Table.Column>
                          <Table.Column className="w-20 px-3 py-2.5" id="column-6511" isRowHeader>
                            状态码
                          </Table.Column>
                          <Table.Column className="w-16 px-3 py-2.5" id="column-6575" isRowHeader>
                            操作
                          </Table.Column>
                        </Table.Header>
                        <Table.Body className="divide-y divide-border">
                          {rows.map((e) => (<Table.Row key={e.id} className="hover:bg-surface-secondary/40 transition-colors" id={e.id}>
                              <Table.Cell className="px-3 py-2">
                                <Checkbox slot={null} aria-label={`选择流量 ${e.id}`} isDisabled={busy || loading || alreadyBound.has(e.id)} onChange={(checked) => toggle(e.id, checked)} isSelected={(selected.has(e.id) || alreadyBound.has(e.id)) === true}>
                                  <Checkbox.Content>
                                    <Checkbox.Control>
                                      <Checkbox.Indicator />
                                    </Checkbox.Control>
                                  </Checkbox.Content>
                                </Checkbox>
                              </Table.Cell>
                              <Table.Cell className="px-3 py-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-xs truncate">
                                    {e.method} {e.url}
                                  </span>
                                  {alreadyBound.has(e.id) ? (<Chip size="sm" color="default" className="shrink-0 text-[10px]" variant={"soft"}>
                                      已绑定
                                    </Chip>) : null}
                                </div>
                              </Table.Cell>
                              <Table.Cell className="px-3 py-2 whitespace-nowrap text-muted">
                                {new Date(e.ts).toLocaleString("zh-CN")}
                              </Table.Cell>
                              <Table.Cell className="px-3 py-2 font-mono">
                                <span className={e.status >= 400 ? "text-warning" : "text-success"}>{e.status}</span>
                              </Table.Cell>
                              <Table.Cell className="px-3 py-2">
                                <Button size="sm" className="h-6 px-1.5 text-xs" onPress={() => setPreview(e.id)} variant={"ghost"}>
                                  预览
                                </Button>
                              </Table.Cell>
                            </Table.Row>))}
                          {!rows.length ? (<Table.Row id="row-8560">
                              <Table.Cell colSpan={5} className="py-8 text-center text-muted">
                                {loading ? "加载中…" : "没有匹配的流量"}
                              </Table.Cell>
                            </Table.Row>) : null}
                        </Table.Body>
                      </Table.Content>
                    </Table.ScrollContainer>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted">
                    已选 <strong className="text-foreground">{selected.size}</strong> 条 · 共 {data?.total ?? 0} 条
                  </span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" isDisabled={loading || page === 0} onPress={() => setPage((p) => p - 1)} variant={"outline"}>
                      上一页
                    </Button>
                    <span className="text-xs">第 {page + 1} 页</span>
                    <Button size="sm" isDisabled={loading || (page + 1) * 25 >= (data?.total ?? 0)} onPress={() => setPage((p) => p + 1)} variant={"outline"}>
                      下一页
                    </Button>
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button isDisabled={busy} onPress={onClose} variant={"outline"}>
                  取消
                </Button>
                <Button isDisabled={busy || selected.size === 0} onPress={() => void save()} variant={"primary"}>
                  {busy ? "保存中…" : `绑定 ${selected.size} 条流量`}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      

      <CapturedTrafficViewer id={preview} onClose={() => setPreview(null)}/>
    </>);
}
