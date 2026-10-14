import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
const components: Components = {
    h1: ({ node, ...p }) => <div className="mt-2.5 text-base font-semibold text-foreground" {...p}/>,
    h2: ({ node, ...p }) => <div className="mt-2 text-sm font-semibold text-foreground" {...p}/>,
    h3: ({ node, ...p }) => <div className="mt-1.5 text-sm font-medium text-foreground" {...p}/>,
    h4: ({ node, ...p }) => <div className="mt-1.5 text-sm font-medium text-foreground" {...p}/>,
    p: ({ node, ...p }) => <p className="leading-relaxed text-foreground" {...p}/>,
    ul: ({ node, ...p }) => <ul className="my-1 list-disc space-y-0.5 pl-5 text-foreground" {...p}/>,
    ol: ({ node, ...p }) => <ol className="my-1 list-decimal space-y-0.5 pl-5 text-foreground" {...p}/>,
    strong: ({ node, ...p }) => <strong className="font-semibold text-foreground" {...p}/>,
    a: ({ node, ...p }) => (<a className="text-accent underline underline-offset-2 hover:opacity-80" target="_blank" rel="noreferrer" {...p}/>),
    hr: () => <hr className="my-2 border-separator"/>,
    blockquote: ({ node, ...p }) => (<blockquote className="my-1 border-l-2 border-separator pl-2.5 text-muted italic" {...p}/>),
    pre: ({ node, ...p }) => (<pre className="my-1.5 overflow-auto rounded-md bg-surface-secondary border border-border p-2.5 text-xs leading-relaxed" {...p}/>),
    code: ({ node, className, children, ...rest }) => {
        const block = /language-/.test(className || "");
        return block ? (<code className={"font-mono text-xs " + (className || "")} {...rest}>
        {children}
      </code>) : (<code className="break-all rounded bg-surface-secondary text-foreground border border-border/50 px-1 py-0.5 font-mono text-[0.85em]" {...rest}>
        {children}
      </code>);
    },
    table: ({ node, ...p }) => (<div className="my-1.5 overflow-x-auto" data-scrollbar="thin">
      <table className="w-full border-collapse text-xs" {...p}/>
    </div>),
    th: ({ node, ...p }) => (<th className="border border-separator bg-surface-secondary px-2 py-1 text-left font-medium text-foreground" {...p}/>),
    td: ({ node, ...p }) => <td className="border border-separator px-2 py-1 align-top text-foreground" {...p}/>,
};
export function Markdown({ text }: {
    text: string;
}) {
    return (<div className="min-w-0 space-y-1.5 text-sm [&>*:first-child]:mt-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>);
}
