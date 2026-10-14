import * as React from "react";
import { Button, Popover, Spinner, Surface } from "@heroui/react";
import { ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
export function TodoPopover({ seq, fetchDetail, }: {
    seq: number | null;
    fetchDetail: (seq: number) => Promise<string>;
}) {
    const [open, setOpen] = React.useState(false);
    const [todos, setTodos] = React.useState<{
        content: string;
        status: string;
    }[] | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [err, setErr] = React.useState("");
    const load = React.useCallback(async () => {
        if (seq == null)
            return;
        setLoading(true);
        setErr("");
        try {
            const detail = await fetchDetail(seq);
            const start = detail.indexOf("{");
            const parsed = JSON.parse(start >= 0 ? detail.slice(start) : detail);
            setTodos(Array.isArray(parsed?.todos) ? parsed.todos : []);
        }
        catch {
            setErr("解析 Todo 失败");
            setTodos(null);
        }
        finally {
            setLoading(false);
        }
    }, [seq, fetchDetail]);
    React.useEffect(() => {
        if (open)
            load();
    }, [open, load]);
    const disabled = seq == null;
    const MARK: Record<string, string> = { pending: "☐", in_progress: "▶", completed: "✔" };
    return (<Popover isOpen={open} onOpenChange={disabled ? undefined : setOpen}>
      
        <Button type="button" size="sm" isDisabled={disabled} className="h-7 px-2 text-xs text-muted hover:text-foreground gap-1" variant={"outline"}>
          <ListTodo className="size-3.5"/>
          <span>Todo</span>
        </Button>
      
      <Popover.Content className="w-80 p-3 bg-surface border border-border rounded-xl shadow-xl">
        <Popover.Dialog className="outline-none">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground">最近 Todo 状态</span>
            {loading && <Spinner size="sm"/>}
          </div>

          {err && <p className="text-danger px-1 text-xs">{err}</p>}
          {todos && todos.length === 0 && !loading && (<p className="text-muted px-1 text-xs py-2 text-center">（暂无 Todo 项）</p>)}

          <Surface variant="secondary" className="max-h-60 overflow-y-auto rounded-lg p-2 bg-surface-secondary" data-scrollbar="thin">
            <ul className="space-y-1.5">
              {(todos ?? []).map((t, i) => (<li key={`${i}:${t.content}`} className={cn("flex items-start gap-2 text-xs text-foreground", t.status === "completed" && "text-muted line-through", t.status === "in_progress" && "text-accent font-medium")}>
                  <span className="shrink-0 font-mono">{MARK[t.status] ?? "☐"}</span>
                  <span className="break-words leading-relaxed">{t.content}</span>
                </li>))}
            </ul>
          </Surface>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>);
}
