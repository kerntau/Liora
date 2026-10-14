import * as React from "react";
import { Link } from "react-router";
import { Alert, Button, buttonVariants, Card, Chip, Disclosure, Skeleton, Spinner } from "@heroui/react";
import { RotateCcwIcon } from "lucide-react";
import { FindingRetestDialog } from "@/components/finding-retest-dialog";
import { Markdown } from "@/components/markdown";
import { api } from "@/lib/api";
import type { FindingRetest } from "@/lib/types";
import { cn } from "@/lib/utils";
const statusLabels: Record<string, string> = {
    pending: "等待启动",
    running: "复测中",
    completed: "已完成",
    failed: "复测失败",
    stopped: "已停止",
};
const verdictLabels: Record<string, string> = {
    reproduced: "仍可复现",
    fixed: "已修复",
    inconclusive: "无法确认",
};
function active(r: FindingRetest) {
    return r.status === "pending" || r.status === "running";
}
export function FindingRetestPanel({ findingId, findingName, readOnly = false, onCompleted, }: {
    findingId: string;
    findingName?: string;
    readOnly?: boolean;
    onCompleted?: () => void;
}) {
    const [items, setItems] = React.useState<FindingRetest[] | null>(null);
    const [error, setError] = React.useState("");
    const [open, setOpen] = React.useState(false);
    const requestSeq = React.useRef(0);
    const previousItems = React.useRef<FindingRetest[]>([]);
    const load = React.useCallback(async () => {
        const seq = ++requestSeq.current;
        try {
            const rows = await api.findingRetests(findingId);
            if (seq !== requestSeq.current)
                return;
            const completed = previousItems.current.some((item) => active(item) && rows.some((row) => row.id === item.id && !active(row)));
            previousItems.current = rows;
            setItems(rows);
            setError("");
            if (completed)
                onCompleted?.();
        }
        catch (e) {
            if (seq === requestSeq.current)
                setError((e as Error).message);
        }
    }, [findingId, onCompleted]);
    React.useEffect(() => {
        void load();
        return () => {
            requestSeq.current++;
        };
    }, [load]);
    React.useEffect(() => {
        if (error || !items?.some(active))
            return;
        const timer = setTimeout(() => void load(), 3000);
        return () => clearTimeout(timer);
    }, [error, items, load]);
    const running = items?.find(active);
    return (<Card className="border border-border">
      <Card.Header className="flex flex-row flex-wrap items-start justify-between gap-3 p-4 border-b border-border">
        <div className="flex flex-col gap-1">
          <Card.Title className="text-base font-semibold">漏洞复测</Card.Title>
          <Card.Description className="text-xs text-muted">
            在独立会话中验证当前状态，保留每次复测的结论与证据。
          </Card.Description>
        </div>
        <div className="flex items-center gap-2">
          {running?.conversation_id != null ? (<Link to={`/function/conversations/detail?c=${running.conversation_id}`} title="查看正在进行的复测会话" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
              <Spinner size="sm"/>
              复测中
            </Link>) : null}
          {!running && !readOnly ? (<Button size="sm" onPress={() => setOpen(true)} isDisabled={items === null || !!error} className="gap-1.5" variant={"primary"}>
              <RotateCcwIcon className="size-4"/>
              发起复测
            </Button>) : null}
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3 p-4">
        {error ? (<Alert status="danger">
            <Alert.Description className="flex items-center justify-between gap-2">
              <span>加载复测记录失败：{error}</span>
              <Button size="sm" onPress={() => void load()} variant={"outline"}>
                重试
              </Button>
            </Alert.Description>
          </Alert>) : null}
        {!error && items === null ? <Skeleton className="h-16 w-full rounded-md"/> : null}
        {!error && items?.length === 0 ? (<div className="flex flex-col items-center justify-center p-8 text-center text-muted">
            <RotateCcwIcon className="size-8 mb-2 opacity-50"/>
            <p className="font-medium text-foreground">暂无复测记录</p>
            <p className="text-xs mt-1">修复部署完成后，可发起复测并比较新旧证据。</p>
          </div>) : null}
        {!error && items
            ? items.map((item) => {
                const isReproduced = item.status === "completed" && item.verdict === "reproduced";
                const isFixed = item.status === "completed" && item.verdict === "fixed";
                const chipColor = isReproduced ? "danger" : isFixed ? "success" : "default";
                return (<div key={item.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-secondary/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" color={chipColor} variant={"soft"}>
                      {item.status === "completed" && item.verdict
                        ? verdictLabels[item.verdict]
                        : statusLabels[item.status]}
                    </Chip>
                    <span className="text-muted text-xs">
                      #{item.id} · {new Date(item.created_at).toLocaleString("zh-CN")}
                    </span>
                    {item.conversation_id != null ? (<Link to={`/function/conversations/detail?c=${item.conversation_id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto h-7 text-xs")}>
                        查看会话
                      </Link>) : (<span className="text-muted text-xs ml-auto">会话已删除</span>)}
                  </div>
                  {item.status === "completed" && item.summary ? (<p className="whitespace-pre-wrap break-words text-sm">{item.summary}</p>) : null}
                  {item.error ? (<p className="whitespace-pre-wrap break-words text-danger text-sm">{item.error}</p>) : null}
                  {item.notes ? (<p className="whitespace-pre-wrap break-words text-muted text-xs">补充说明：{item.notes}</p>) : null}
                  {item.status === "completed" && item.evidence ? (<Disclosure className="min-w-0">
                      <Disclosure.Heading>
                        <Disclosure.Trigger className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
                          复测证据
                        </Disclosure.Trigger>
                      </Disclosure.Heading>
                      <Disclosure.Content>
                        <Disclosure.Body>
                          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface p-3">
                            <Markdown text={item.evidence}/>
                          </div>
                        </Disclosure.Body>
                      </Disclosure.Content>
                    </Disclosure>) : null}
                </div>);
            })
            : null}
      </Card.Content>
      {open ? (<FindingRetestDialog findingId={findingId} findingName={findingName} onClose={() => setOpen(false)} onStarted={(retest) => {
                requestSeq.current++;
                const rows = [retest, ...previousItems.current.filter((item) => item.id !== retest.id)];
                previousItems.current = rows;
                setItems(rows);
                setError("");
                void load();
            }}/>) : null}
    </Card>);
}
