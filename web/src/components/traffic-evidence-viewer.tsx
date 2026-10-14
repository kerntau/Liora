import * as React from "react";
import { Alert, Button, Modal, Skeleton, Tabs } from "@heroui/react";
import { toast } from "sonner";
import { HttpCodeBlock } from "@/components/http-code-block";
import { api } from "@/lib/api";
import type { FindingTrafficDetail, TrafficDetail } from "@/lib/types";
export function TrafficEvidenceViewer({ findingId, bindingId, contextTask, onClose, }: {
    findingId: string;
    bindingId: string | null;
    contextTask?: string;
    onClose: () => void;
}) {
    const [detail, setDetail] = React.useState<FindingTrafficDetail | null>(null);
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    React.useEffect(() => {
        if (!bindingId)
            return;
        let active = true;
        setDetail(null);
        setError("");
        api
            .findingTrafficDetail(findingId, bindingId, contextTask)
            .then((d) => {
            if (active)
                setDetail(d);
        })
            .catch((e: Error) => {
            if (active)
                setError(e.message);
        });
        return () => {
            active = false;
        };
    }, [findingId, bindingId, contextTask]);
    async function more(side: "request" | "response") {
        if (!detail || !bindingId)
            return;
        setBusy(true);
        try {
            const next = await api.findingTrafficBody(findingId, bindingId, side, detail[side].next_offset, contextTask);
            setDetail((current) => current?.binding.id === bindingId
                ? { ...current, [side]: { ...next, content: current[side].content + next.content } }
                : current);
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    return (
      <Modal.Backdrop isOpen={bindingId !== null} onOpenChange={(open) => {
            if (!open)
                onClose();
        }}>
        <Modal.Container>
          <Modal.Dialog className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <Modal.Header>
              <Modal.Heading>流量证据 #{bindingId}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <p className="text-xs text-muted break-all">
                {detail?.binding.snapshot.url ?? "查看绑定时保存的请求与响应"}
              </p>

              {error ? (<Alert status="danger">
                  <Alert.Description>{error}</Alert.Description>
                </Alert>) : detail ? (<Tabs defaultSelectedKey="request" variant="secondary">
                  <Tabs.ListContainer>
                    <Tabs.List>
                      <Tabs.Tab id="request">
                        请求 Request
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab id="response">
                        响应 Response
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                  {(["request", "response"] as const).map((side) => (<Tabs.Panel key={side} id={side} className="space-y-3 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted">
                          正文 {detail[side].total.toLocaleString()} 字节
                          {detail[side].truncated ? " · 当前为预览" : ""}
                        </span>
                        <Button size="sm" onPress={() => void api
                    .downloadFindingTrafficBody(findingId, detail.binding.id, side, contextTask)
                    .catch((e: Error) => toast.error(e.message))} variant={"outline"}>
                          下载完整{side === "request" ? "请求" : "响应"}正文
                        </Button>
                      </div>
                      <HttpCodeBlock raw={`${(side === "request" ? detail.binding.snapshot.req_head : detail.binding.snapshot.resp_head)?.trimEnd() ?? ""}\n\n${detail[side].content}`}/>
                      {detail[side].truncated && !detail[side].binary ? (<Button size="sm" isDisabled={busy} onPress={() => void more(side)} variant={"outline"}>
                          加载更多正文
                        </Button>) : null}
                    </Tabs.Panel>))}
                </Tabs>) : (<Skeleton className="h-56 w-full rounded-md"/>)}
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={onClose} variant={"outline"}>
                关闭
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    );
}
export function CapturedTrafficViewer({ id, onClose }: {
    id: string | null;
    onClose: () => void;
}) {
    const [detail, setDetail] = React.useState<TrafficDetail | null>(null);
    const [error, setError] = React.useState("");
    React.useEffect(() => {
        if (!id)
            return;
        let active = true;
        setDetail(null);
        setError("");
        api
            .trafficExchange(id)
            .then((d) => {
            if (active)
                setDetail(d);
        })
            .catch((e: Error) => {
            if (active)
                setError(e.message);
        });
        return () => {
            active = false;
        };
    }, [id]);
    return (
      <Modal.Backdrop isOpen={id !== null} onOpenChange={(open) => {
            if (!open)
                onClose();
        }}>
        <Modal.Container>
          <Modal.Dialog className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <Modal.Header>
              <Modal.Heading>预览流量</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <p className="text-xs text-muted">流量 ID：{id}。绑定时会保存完整正文。</p>
              {error ? (<Alert status="danger">
                  <Alert.Description>{error}</Alert.Description>
                </Alert>) : detail ? (<Tabs defaultSelectedKey="request" variant="secondary">
                  <Tabs.ListContainer>
                    <Tabs.List>
                      <Tabs.Tab id="request">
                        请求 Request
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab id="response">
                        响应 Response
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                  <Tabs.Panel id="request" className="pt-3">
                    <HttpCodeBlock raw={detail.req}/>
                  </Tabs.Panel>
                  <Tabs.Panel id="response" className="pt-3">
                    <HttpCodeBlock raw={detail.resp}/>
                  </Tabs.Panel>
                </Tabs>) : (<Skeleton className="h-56 w-full rounded-md"/>)}
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={onClose} variant={"outline"}>
                关闭
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    );
}
