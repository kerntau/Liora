import * as React from "react";
import { ListBox, Popover, SearchField } from "@heroui/react";
import { cn } from "@/lib/utils";
const DSL_FIELDS: {
    name: string;
    desc: string;
    ops: {
        op: string;
        desc: string;
    }[];
}[] = [
    {
        name: "domain",
        desc: "域名（根域名/子域名/服务域名）",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "ip",
        desc: "IPv4/IPv6 地址",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "url",
        desc: "完整 URL（服务/接口）",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "root_domain",
        desc: "根域名",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "page_title",
        desc: "页面标题（HTTP 服务）",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "icp",
        desc: "ICP 备案号",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "service_name",
        desc: "服务名称（非 HTTP 服务）",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "app_name",
        desc: "应用名称",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "bundle_id",
        desc: "应用 Bundle ID",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "category",
        desc: "应用分类",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "app_icp",
        desc: "应用 ICP 备案",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "method",
        desc: "HTTP 方法 GET/POST/PUT/…",
        ops: [
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "service_type",
        desc: "服务类型：http | other",
        ops: [
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "record_type",
        desc: "DNS 解析类型 A/CNAME/MX/…",
        ops: [
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "technology",
        desc: "技术指纹（数组字段）",
        ops: [
            { op: "=", desc: "模糊匹配" },
            { op: "==", desc: "精确匹配" },
            { op: "!=", desc: "排除" },
        ],
    },
    {
        name: "port",
        desc: "端口号（整数）",
        ops: [
            { op: "==", desc: "等于" },
            { op: "!=", desc: "不等于" },
            { op: ">", desc: "大于" },
            { op: ">=", desc: "大于等于" },
            { op: "<", desc: "小于" },
            { op: "<=", desc: "小于等于" },
        ],
    },
    {
        name: "status_code",
        desc: "HTTP 状态码（整数）",
        ops: [
            { op: "==", desc: "等于" },
            { op: "!=", desc: "不等于" },
            { op: ">", desc: "大于" },
            { op: ">=", desc: "大于等于" },
            { op: "<", desc: "小于" },
            { op: "<=", desc: "小于等于" },
        ],
    },
    { name: "company_id", desc: "归属企业 ID（整数）", ops: [{ op: "==", desc: "等于" }] },
    { name: "task_id", desc: "来源任务 ID（整数）", ops: [{ op: "==", desc: "等于" }] },
];
const LOGIC_OPS = [
    { label: "AND", desc: "且（两个条件都满足）" },
    { label: "OR", desc: "或（满足其中之一）" },
];
interface DslSuggestion {
    kind: "field" | "operator" | "logic";
    label: string;
    desc: string;
    replaceStart: number;
    replaceEnd: number;
    insertText: string;
}
function getDslSuggestions(text: string, cursor: number): DslSuggestion[] {
    const before = text.slice(0, cursor);
    const tokenMatch = before.match(/([^\s()]*$)/);
    const currentToken = tokenMatch?.[1] ?? "";
    const tokenStart = cursor - currentToken.length;
    if (/^[a-z_]+(==|!=|>=|<=|=|>|<)/.test(currentToken))
        return [];
    const exactField = DSL_FIELDS.find((f) => f.name === currentToken.toLowerCase());
    if (exactField) {
        return exactField.ops.map(({ op, desc }) => ({
            kind: "operator",
            label: `${exactField.name}${op}`,
            desc,
            replaceStart: tokenStart,
            replaceEnd: cursor,
            insertText: `${exactField.name}${op}`,
        }));
    }
    const beforeToken = before.slice(0, tokenStart).trimEnd();
    const afterExpression = beforeToken.length > 0 && !/\b(AND|OR)\s*$/i.test(beforeToken) && !beforeToken.endsWith("(");
    if (/^(a|an|and|o|or)$/i.test(currentToken) && afterExpression) {
        return LOGIC_OPS.filter((l) => l.label.startsWith(currentToken.toUpperCase())).map(({ label, desc }) => ({
            kind: "logic",
            label,
            desc,
            replaceStart: tokenStart,
            replaceEnd: cursor,
            insertText: `${label} `,
        }));
    }
    if (!currentToken && afterExpression) {
        return LOGIC_OPS.map(({ label, desc }) => ({
            kind: "logic",
            label,
            desc,
            replaceStart: cursor,
            replaceEnd: cursor,
            insertText: `${label} `,
        }));
    }
    const prefix = currentToken.toLowerCase();
    return DSL_FIELDS.filter((f) => f.name.startsWith(prefix)).map((f) => ({
        kind: "field",
        label: f.name,
        desc: f.desc,
        replaceStart: tokenStart,
        replaceEnd: cursor,
        insertText: f.name,
    }));
}
function applyDslSuggestion(text: string, s: DslSuggestion): {
    text: string;
    cursor: number;
} {
    const newText = text.slice(0, s.replaceStart) + s.insertText + text.slice(s.replaceEnd);
    return { text: newText, cursor: s.replaceStart + s.insertText.length };
}
const KIND_STYLE: Record<string, string> = {
    field: "text-accent",
    operator: "text-warning",
    logic: "text-success",
};
export function AssetDslSearch({ query, onChange, loading, error, count, }: {
    query: string;
    onChange: (v: string) => void;
    loading: boolean;
    error: string;
    count?: number;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [suggestions, setSuggestions] = React.useState<DslSuggestion[]>([]);
    const [selIdx, setSelIdx] = React.useState(0);
    const [open, setOpen] = React.useState(false);
    const refresh = React.useCallback((val: string, pos: number) => {
        const suggs = getDslSuggestions(val, pos);
        setSuggestions(suggs);
        setSelIdx(0);
        setOpen(suggs.length > 0);
    }, []);
    const handleChange = (val: string) => {
        onChange(val);
        refresh(val, inputRef.current?.selectionStart ?? val.length);
    };
    const apply = React.useCallback((s: DslSuggestion) => {
        const cursor = inputRef.current?.selectionStart ?? query.length;
        const adjusted: DslSuggestion = s.kind === "logic" && !query.slice(s.replaceStart, s.replaceEnd)
            ? { ...s, replaceStart: cursor, replaceEnd: cursor }
            : s;
        const { text: newText, cursor: newCursor } = applyDslSuggestion(query, adjusted);
        onChange(newText);
        requestAnimationFrame(() => {
            if (!inputRef.current)
                return;
            inputRef.current.setSelectionRange(newCursor, newCursor);
            inputRef.current.focus();
            refresh(newText, newCursor);
        });
    }, [query, onChange, refresh]);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open || suggestions.length === 0)
            return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelIdx((i) => Math.min(i + 1, suggestions.length - 1));
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelIdx((i) => Math.max(i - 1, 0));
        }
        else if (e.key === "Tab" || e.key === "Enter") {
            const s = suggestions[selIdx];
            if (s) {
                e.preventDefault();
                apply(s);
            }
        }
        else if (e.key === "Escape") {
            setOpen(false);
        }
    };
    const cursorPos = () => inputRef.current?.selectionStart ?? query.length;
    return (<div className="flex flex-col gap-1">
      <div className="relative max-w-lg">
        <SearchField value={query} onChange={handleChange} aria-label="DSL 资产搜索" className="w-full">
          <SearchField.Group className="flex items-center gap-2 border border-border rounded-lg px-2.5 py-1.5 bg-surface-secondary focus-within:border-accent">
            <SearchField.SearchIcon className="size-3.5 text-muted shrink-0"/>
            <SearchField.Input ref={inputRef} placeholder="DSL 搜索：domain=example AND status_code>=400" onKeyDown={handleKeyDown} onFocus={() => refresh(query, cursorPos())} onClick={() => refresh(query, cursorPos())} onBlur={() => setTimeout(() => setOpen(false), 120)} className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted"/>
            <SearchField.ClearButton className="text-xs text-muted hover:text-foreground"/>
          </SearchField.Group>
        </SearchField>

        {open && suggestions.length > 0 && (<Popover isOpen={open} onOpenChange={setOpen}>
            <Popover.Content triggerRef={inputRef} isNonModal placement="bottom start" className="min-w-72 max-w-sm border border-border bg-overlay p-1 shadow-overlay" onMouseDown={(event) => event.preventDefault()}>
              <div>
                <ListBox aria-label="DSL 语法提示" selectionMode="single" onAction={(key) => {
                const s = suggestions[Number(key)];
                if (s)
                    apply(s);
            }} className="p-1">
                  {suggestions.map((s, i) => (<ListBox.Item key={i} id={String(i)} textValue={`${s.label} ${s.desc}`} className={cn("flex items-center gap-3 px-3 py-1.5 rounded-md cursor-pointer text-left outline-none", i === selIdx ? "bg-surface-secondary" : "hover:bg-surface-secondary/60")} onMouseEnter={() => setSelIdx(i)}>
                      <span className={cn("shrink-0 font-mono text-xs font-semibold", KIND_STYLE[s.kind])}>
                        {s.label}
                      </span>
                      <span className="text-xs text-muted truncate">{s.desc}</span>
                    </ListBox.Item>))}
                </ListBox>
              </div>
            </Popover.Content>
          </Popover>)}
      </div>

      {query.trim() && !open && (<p className="pl-1 text-[11px] text-muted">
          {loading ? "搜索中…" : error ? <span className="text-danger">{error}</span> : `找到 ${count ?? 0} 条`}
        </p>)}
    </div>);
}
