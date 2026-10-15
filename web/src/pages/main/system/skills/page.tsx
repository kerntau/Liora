import * as React from "react";

import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  IconButton,
  Popover,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { Agent, MCPServer, MissingSkill, SkillCall, SkillItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmtTime(ts?: string) {
  if (!ts) return "从未调用";
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
// ── Tree node ──────────────────────────────────────────────────────────────
interface TreeNode {
  name: string;
  path: string; // relative to skill root, dirs WITHOUT trailing slash
  type: "file" | "dir";
  children: TreeNode[];
}
// Backend returns dirs as "scripts/" (trailing slash) and files as "scripts/a.py".
function buildTree(entries: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();
  function ensureDir(dirPath: string, parentNodes: TreeNode[]): TreeNode[] {
    if (dirMap.has(dirPath)) return dirMap.get(dirPath)!.children;
    const parts = dirPath.split("/");
    let nodes = root;
    let cur = "";
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (!dirMap.has(cur)) {
        const d: TreeNode = { name: part, path: cur, type: "dir", children: [] };
        nodes.push(d);
        dirMap.set(cur, d);
      }
      nodes = dirMap.get(cur)!.children;
    }
    return nodes;
  }
  for (const entry of [...entries].sort()) {
    if (entry.endsWith("/")) {
      // Explicit directory entry — ensure the node exists (may already be created)
      ensureDir(entry.slice(0, -1), root);
    } else {
      // File — ensure parent dirs exist, then push file node
      const parts = entry.split("/");
      let nodes = root;
      let cur = "";
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        if (!dirMap.has(cur)) {
          const d: TreeNode = { name: parts[i], path: cur, type: "dir", children: [] };
          nodes.push(d);
          dirMap.set(cur, d);
        }
        nodes = dirMap.get(cur)!.children;
      }
      const fname = parts[parts.length - 1];
      if (fname) nodes.push({ name: fname, path: entry, type: "file", children: [] });
    }
  }
  sortNodes(root);
  return root;
}
// sortNodes orders every level like a file explorer: directories before files,
// then case-insensitive by name. Recurses into children.
function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  for (const n of nodes) {
    if (n.children.length > 0) sortNodes(n.children);
  }
}
// ── State types ───────────────────────────────────────────────────────────
type Selected =
  | {
      skill: string;
      path: null;
    }
  | {
      skill: string;
      path: string;
    };
type Creating = {
  skill: string;
  inDir: string;
  kind: "file" | "dir";
} | null;
type PendingDelete =
  | {
      kind: "skill";
      skill: string;
    }
  | {
      kind: "file";
      skill: string;
      path: string;
    }
  | {
      kind: "dir";
      skill: string;
      path: string;
    }
  | null;
// ── Overview (empty-state) ──────────────────────────────────────────────────
// Shown when nothing is selected: a library-wide snapshot from data already loaded
// (the skill list carries per-skill usage; missing is fetched alongside). No extra
// requests — this is pure aggregation over props.
function SkillsOverview({
  skills,
  missing,
  onSelect,
}: {
  skills: SkillItem[];
  missing: MissingSkill[];
  onSelect: (name: string) => void;
}) {
  const agg = React.useMemo(() => {
    const totalCalls = skills.reduce((n, s) => n + s.calls, 0);
    const used = skills.filter((s) => s.calls > 0);
    const ranked = [...used].sort((a, b) => b.calls - a.calls);
    const neverUsed = skills.filter((s) => s.calls === 0);
    const recent = skills
      .filter((s) => s.last_used)
      .sort((a, b) => (a.last_used! < b.last_used! ? 1 : -1))
      .slice(0, 6);
    const missingCalls = missing.reduce((n, m) => n + m.calls, 0);
    return {
      totalCalls,
      usedCount: used.length,
      ranked,
      topCalls: ranked[0]?.calls ?? 0,
      neverUsed,
      recent,
      missingCalls,
    };
  }, [skills, missing]);
  if (skills.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted">暂无 Skill，点击左侧「新建」或「上传压缩包」开始</p>
      </div>
    );
  }
  const stats: {
    label: string;
    value: React.ReactNode;
    hint?: string;
  }[] = [
    { label: "Skill 总数", value: skills.length, hint: `${agg.usedCount} 个被调用过` },
    { label: "累计调用", value: agg.totalCalls },
    {
      label: "未使用",
      value: agg.neverUsed.length,
      hint: agg.neverUsed.length > 0 ? "从未被任何 agent 加载" : "全部用过",
    },
    {
      label: "未命中调用",
      value: agg.missingCalls,
      hint: missing.length > 0 ? `${missing.length} 个不存在的 skill` : "无",
    },
  ];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h2 className="text-base font-semibold">技能库总览</h2>
        <p className="text-muted text-sm">选择左侧的 Skill 查看详情与调用记录，或从这里快速了解整体使用情况。</p>
      </div>

      {/* 指标卡 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border p-3">
            <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs font-medium">{s.label}</p>
            {s.hint && <p className="text-muted mt-0.5 text-[11px]">{s.hint}</p>}
          </div>
        ))}
      </div>

      {/* 调用排行 */}
      <div className="space-y-2">
        <Box component="span" className="text-xs text-muted" sx={{ fontSize: "inherit" }}>
          调用排行
        </Box>
        {agg.ranked.length === 0 ? (
          <p className="text-muted rounded-lg border border-dashed p-4 text-center text-xs">
            还没有任何 Skill 调用记录。
          </p>
        ) : (
          <div className="space-y-1.5">
            {agg.ranked.slice(0, 8).map((s) => (
              <Button
                key={s.name}
                type="button"
                onClick={() => onSelect(s.name)}
                className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface-secondary"
                size="small"
                variant="text"
              >
                <span className="w-40 shrink-0 truncate font-mono text-xs" title={s.name}>
                  {s.name}
                </span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-secondary">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-accent/70"
                    style={{ width: `${agg.topCalls > 0 ? (s.calls / agg.topCalls) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">{s.calls} 次</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* 最近调用 */}
        <div className="space-y-2">
          <Box component="span" className="text-xs text-muted" sx={{ fontSize: "inherit" }}>
            最近调用
          </Box>
          {agg.recent.length === 0 ? (
            <p className="text-muted text-xs">暂无记录。</p>
          ) : (
            <div className="space-y-1">
              {agg.recent.map((s) => (
                <Button
                  key={s.name}
                  type="button"
                  onClick={() => onSelect(s.name)}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-surface-secondary"
                  size="small"
                  variant="text"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs" title={s.name}>
                    {s.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted">{fmtTime(s.last_used)}</span>
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* 未使用（可清理 / 需曝光） */}
        <div className="space-y-2">
          <Box component="span" className="text-xs text-muted" sx={{ fontSize: "inherit" }}>
            未使用的 Skill
            {agg.neverUsed.length > 0 && <span className="ml-1 font-normal">（{agg.neverUsed.length}）</span>}
          </Box>
          {agg.neverUsed.length === 0 ? (
            <p className="text-muted text-xs">所有 Skill 都被调用过。</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {agg.neverUsed.map((s) => (
                <Button
                  key={s.name}
                  type="button"
                  onClick={() => onSelect(s.name)}
                  aria-label={s.name}
                  size="small"
                  variant="text"
                >
                  <Chip
                    className="max-w-[12rem] cursor-pointer truncate font-mono text-xs font-normal hover:bg-surface-secondary"
                    size="small"
                    variant="filled"
                    label={<>{s.name}</>}
                  />
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ── Page ──────────────────────────────────────────────────────────────────
export default function SkillsPage() {
  const [viewTab, setViewTab] = React.useState("basic");
  const [missingAnchor, setMissingAnchor] = React.useState<HTMLElement | null>(null);
  const [skills, setSkills] = React.useState<SkillItem[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [selected, setSelected] = React.useState<Selected | null>(null);
  const [visibility, setVisibility] = React.useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  // file editor
  const [fileContent, setFileContent] = React.useState("");
  const [fileLoading, setFileLoading] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  // inline create — using a ref to avoid stale closure in onBlur
  const [creating, setCreating] = React.useState<Creating>(null);
  const [newEntryName, setNewEntryName] = React.useState("");
  const inlineRef = React.useRef<HTMLInputElement>(null);
  // cancelRef prevents onBlur from committing when Escape was pressed
  const cancelRef = React.useRef(false);
  // new skill dialog
  const [newOpen, setNewOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newLicense, setNewLicense] = React.useState("");
  const [newCompat, setNewCompat] = React.useState("");
  const [newInst, setNewInst] = React.useState("");
  const [newMcps, setNewMcps] = React.useState<string[]>([]);
  const [newVisibility, setNewVisibility] = React.useState<string[]>([]);
  const [mcpOptions, setMcpOptions] = React.useState<MCPServer[]>([]);
  const [creatingSkill, setCreatingSkill] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [overwriteUpload, setOverwriteUpload] = React.useState<{ file: File; message: string } | null>(null);
  const uploadRef = React.useRef<HTMLInputElement>(null);
  // skill detail — MCP edit state (optimistic, rolls back on error)
  const [detailMcps, setDetailMcps] = React.useState<string[]>([]);
  // delete confirmation
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete>(null);
  const [deleting, setDeleting] = React.useState(false);
  // 调用统计：列表页的次数/最近调用随 api.skills() 一起回来；选中某个 skill 时再拉它的
  // 最近调用明细。missing = 被点名但不存在的 skill（想用但没有）。
  const [usageCalls, setUsageCalls] = React.useState<SkillCall[]>([]);
  const [usageLoading, setUsageLoading] = React.useState(false);
  const [missing, setMissing] = React.useState<MissingSkill[]>([]);
  // ── Data ──────────────────────────────────────────────────────────────────
  const load = React.useCallback(() => {
    api
      .agents()
      .then(setAgents)
      .catch(() => {
        /* Optional catalog data remains empty if unavailable. */
      });
    api
      .mcpServers()
      .then(setMcpOptions)
      .catch(() => {
        /* Optional catalog data remains empty if unavailable. */
      });
    api
      .missingSkills()
      .then(setMissing)
      .catch(() => {
        /* Optional catalog data remains empty if unavailable. */
      });
    api
      .skills()
      .then((ss) => {
        setSkills(ss);
        ss.forEach((s) => {
          void api
            .skillVisibility(s.name)
            .then((ids) => setVisibility((v) => ({ ...v, [s.name]: ids })))
            .catch(() => {
              /* Optional catalog data remains empty if unavailable. */
            });
        });
      })
      .catch(() => {
        /* Optional catalog data remains empty if unavailable. */
      });
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);
  // ── Upload a .zip skill ───────────────────────────────────────────────────
  async function uploadZip(file: File, overwrite = false) {
    setUploading(true);
    try {
      const r = await api.uploadSkill(file, overwrite);
      toast.success(`已安装 Skill：${r.name}（${r.files} 个文件）`);
      load();
    } catch (e) {
      const msg = (e as Error).message;
      // offer overwrite when the skill already exists
      if (!overwrite && msg.includes("已存在")) {
        setOverwriteUpload({ file, message: msg });
      } else {
        toast.error("上传失败：" + msg);
      }
    } finally {
      setUploading(false);
    }
  }
  function onUploadPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file again re-fires
    if (f) void uploadZip(f);
  }
  React.useEffect(() => {
    if (creating) {
      // Small timeout so the element is actually in the DOM before focusing
      setTimeout(() => inlineRef.current?.focus(), 20);
    }
  }, [creating]);
  // Sync detail-panel MCP state when the selected skill changes.
  React.useEffect(() => {
    if (!selected || selected.path !== null) return;
    const sk = skills.find((s) => s.name === selected.skill);
    setDetailMcps(sk?.mcps ?? []);
  }, [selected, skills]);
  // Recent calls for the selected skill (detail panel only).
  React.useEffect(() => {
    if (!selected || selected.path !== null) {
      setUsageCalls([]);
      return;
    }
    const name = selected.skill;
    setUsageLoading(true);
    api
      .skillUsage(name, 20)
      .then((calls) => setUsageCalls(calls))
      .catch(() => setUsageCalls([]))
      .finally(() => setUsageLoading(false));
  }, [selected]);
  React.useEffect(() => {
    if (!selected || selected.path === null) {
      setFileContent("");
      setDirty(false);
      return;
    }
    setFileLoading(true);
    api
      .readSkillFile(selected.skill, selected.path)
      .then((c) => {
        setFileContent(c);
        setDirty(false);
      })
      .catch(() => toast.error("读取文件失败"))
      .finally(() => setFileLoading(false));
  }, [selected]);
  // ── Expand helpers ────────────────────────────────────────────────────────
  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function ensureExpanded(skill: string, dirPath: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(skill);
      if (dirPath) {
        let cur = "";
        for (const part of dirPath.split("/")) {
          cur = cur ? `${cur}/${part}` : part;
          next.add(`${skill}:${cur}`);
        }
      }
      return next;
    });
  }
  // ── Inline create ─────────────────────────────────────────────────────────
  function startCreate(skill: string, inDir: string, kind: "file" | "dir") {
    cancelRef.current = false;
    ensureExpanded(skill, inDir);
    setCreating({ skill, inDir, kind });
    setNewEntryName("");
  }
  // Use a ref snapshot so commitCreate reads the latest creating value
  // without depending on potentially stale closure state.
  const creatingRef = React.useRef<Creating>(null);
  React.useEffect(() => {
    creatingRef.current = creating;
  }, [creating]);
  const newEntryRef = React.useRef("");
  React.useEffect(() => {
    newEntryRef.current = newEntryName;
  }, [newEntryName]);
  async function commitCreate() {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const c = creatingRef.current;
    const name = newEntryRef.current.trim();
    setCreating(null);
    setNewEntryName("");
    if (!c || !name) return;
    const fullPath = c.inDir ? `${c.inDir}/${name}` : name;
    try {
      if (c.kind === "dir") {
        await api.createSkillDir(c.skill, fullPath);
        toast.success(`已创建文件夹：${fullPath}`);
        ensureExpanded(c.skill, fullPath);
      } else {
        await api.writeSkillFile(c.skill, fullPath, "");
        toast.success(`已创建文件：${fullPath}`);
        setSelected({ skill: c.skill, path: fullPath });
        ensureExpanded(c.skill, c.inDir);
      }
      load();
    } catch (e) {
      toast.error("创建失败：" + (e as Error).message);
    }
  }
  function cancelCreate() {
    cancelRef.current = true;
    setCreating(null);
    setNewEntryName("");
  }
  async function deletePath(skill: string, path: string) {
    try {
      await api.deleteSkillPath(skill, path);
      toast.success(`已删除：${path}`);
      if (selected?.skill === skill && selected.path === path) setSelected(null);
      load();
    } catch (e) {
      toast.error("删除失败：" + (e as Error).message);
    }
  }
  async function deleteSkill(name: string) {
    try {
      await api.deleteSkill(name);
      toast.success(`已删除 Skill：${name}`);
      if (selected?.skill === name) setSelected(null);
      load();
    } catch (e) {
      toast.error("删除失败：" + (e as Error).message);
    }
  }
  async function runPendingDelete() {
    const p = pendingDelete;
    if (!p) return;
    setDeleting(true);
    try {
      if (p.kind === "skill") await deleteSkill(p.skill);
      else await deletePath(p.skill, p.path);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }
  async function saveFile() {
    if (!selected || selected.path === null) return;
    setSaving(true);
    try {
      await api.writeSkillFile(selected.skill, selected.path, fileContent);
      toast.success("已保存");
      setDirty(false);
    } catch (e) {
      toast.error("保存失败：" + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function toggleSkillMcp(skillName: string, mcpName: string, mcpOn: boolean) {
    const next = mcpOn ? [...detailMcps, mcpName] : detailMcps.filter((n) => n !== mcpName);
    setDetailMcps(next);
    try {
      await api.updateSkillMeta(skillName, { mcps: next });
      toast.success(`${mcpOn ? "关联" : "取消关联"}「${mcpName}」`);
      load();
    } catch (e) {
      // roll back on error
      setDetailMcps(detailMcps);
      toast.error("操作失败：" + (e as Error).message);
    }
  }
  async function toggleVisibility(skillName: string, agentId: string, agentName: string) {
    const on = (visibility[skillName] ?? []).includes(agentId);
    try {
      await api.toggleSkillVisibility(agentId, skillName, !on);
      toast.success(`${on ? "取消" : "授予"}「${agentName}」可见`);
      const ids = await api.skillVisibility(skillName);
      setVisibility((v) => ({ ...v, [skillName]: ids }));
    } catch (e) {
      toast.error("操作失败：" + (e as Error).message);
    }
  }
  async function createNewSkill() {
    if (!newName.trim()) {
      toast.error("请填写 name");
      return;
    }
    if (!newDesc.trim()) {
      toast.error("description 为必填项");
      return;
    }
    setCreatingSkill(true);
    try {
      const name = newName.trim();
      await api.createSkill({
        name,
        description: newDesc.trim(),
        license: newLicense.trim() || undefined,
        compatibility: newCompat.trim() || undefined,
        mcps: newMcps.length ? newMcps : undefined,
        instructions: newInst.trim() || undefined,
      });
      // apply initial visibility (fire-and-forget per agent; best-effort)
      await Promise.all(newVisibility.map((id) => api.toggleSkillVisibility(id, name, true)));
      toast.success("已创建 Skill");
      setNewOpen(false);
      setNewName("");
      setNewDesc("");
      setNewLicense("");
      setNewCompat("");
      setNewInst("");
      setNewMcps([]);
      setNewVisibility([]);
      load();
    } catch (e) {
      toast.error("创建失败：" + (e as Error).message);
    } finally {
      setCreatingSkill(false);
    }
  }
  // ── Inline input JSX helper (NOT a React component — avoids remount on re-render) ──
  // Defined as a plain function returning JSX so React never sees a new component type.
  function inlineInputJSX(indent: number) {
    return (
      <div key="__inline_create__" className="flex items-center gap-1 py-0.5 pr-2" style={{ paddingLeft: indent }}>
        {creating?.kind === "dir" ? (
          <FolderIcon className="size-3.5 shrink-0 text-warning" />
        ) : (
          <FileTextIcon className="size-3.5 shrink-0 text-muted" />
        )}
        <TextField
          placeholder={creating?.kind === "dir" ? "folder-name" : "filename.py"}
          value={newEntryName}
          onChange={(e) => setNewEntryName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              cancelRef.current = false;
              void commitCreate();
            }
            if (e.key === "Escape") cancelCreate();
          }}
          onBlur={() => {
            void commitCreate();
          }}
          inputRef={inlineRef}
          className={"h-6 flex-1 px-1 py-0 font-mono text-xs"}
          fullWidth
          size="small"
          slotProps={{ htmlInput: { "aria-label": creating?.kind === "dir" ? "folder-name" : "filename.py" } }}
          sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
        />
      </div>
    );
  }
  // ── Recursive tree renderer ───────────────────────────────────────────────
  function renderTree(nodes: TreeNode[], skill: string, depth: number): React.ReactNode {
    // depth+1: the skill root sits at 8px (px-2); its children indent one step
    // further in so the tree reads as nested under the skill folder.
    const baseIndent = 8 + (depth + 1) * 14;
    return nodes.map((node) => {
      if (node.type === "dir") {
        const key = `${skill}:${node.path}`;
        const open = expanded.has(key);
        return (
          <div key={node.path}>
            <Box
              role="treeitem"
              tabIndex={0}
              aria-label={node.name}
              aria-expanded={open}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
              className="group relative flex cursor-pointer select-none items-center gap-1 rounded py-0.5 pr-1 text-sm hover:bg-surface-secondary"
              style={{ paddingLeft: baseIndent }}
              onClick={() => toggleExpanded(key)}
            >
              <ChevronRightIcon className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
              {open ? (
                <FolderOpenIcon className="size-3.5 shrink-0 text-warning" />
              ) : (
                <FolderIcon className="size-3.5 shrink-0 text-warning" />
              )}
              <span className="min-w-0 flex-1 truncate" title={node.path}>
                {node.name}
              </span>
              {/* Absolute so a long name can never push the actions out of view */}
              <span className="absolute inset-y-0 right-1 hidden items-center gap-0.5 rounded bg-surface-secondary pl-1 group-hover:flex group-focus-within:flex max-sm:flex">
                <IconButton
                  className="size-5"
                  aria-label={"新建文件"}
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreate(skill, node.path, "file");
                  }}
                  size="small"
                >
                  <FilePlusIcon className="size-3 text-muted" />
                </IconButton>
                <IconButton
                  className="size-5"
                  aria-label={"新建文件夹"}
                  onClick={(e) => {
                    e.stopPropagation();
                    startCreate(skill, node.path, "dir");
                  }}
                  size="small"
                >
                  <FolderPlusIcon className="size-3 text-muted" />
                </IconButton>
                <IconButton
                  className="size-5"
                  aria-label={"删除文件夹"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete({ kind: "dir", skill, path: node.path });
                  }}
                  size="small"
                >
                  <Trash2Icon className="size-3 text-danger" />
                </IconButton>
              </span>
            </Box>
            {open && (
              <>
                {renderTree(node.children, skill, depth + 1)}
                {creating?.skill === skill && creating.inDir === node.path && inlineInputJSX(baseIndent + 14)}
              </>
            )}
          </div>
        );
      }
      // file node
      const isSelected = selected?.skill === skill && selected.path === node.path;
      return (
        <Box
          role="treeitem"
          tabIndex={0}
          aria-label={node.name}
          aria-selected={isSelected}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              event.currentTarget.click();
            }
          }}
          key={node.path}
          className={cn(
            "group relative flex cursor-pointer select-none items-center gap-1 rounded py-0.5 pr-1 text-sm",
            isSelected ? "bg-accent text-accent-foreground" : "hover:bg-surface-secondary",
          )}
          style={{ paddingLeft: baseIndent + 16 }}
          onClick={() => setSelected({ skill, path: node.path })}
        >
          <FileTextIcon className="size-3.5 shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs" title={node.path}>
            {node.name}
          </span>
          <span
            className={cn(
              "absolute inset-y-0 right-1 hidden items-center rounded pl-1 group-hover:flex group-focus-within:flex max-sm:flex",
              isSelected ? "bg-accent" : "bg-surface-secondary",
            )}
          >
            <IconButton
              className="size-5"
              aria-label={"删除文件"}
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete({ kind: "file", skill, path: node.path });
              }}
              size="small"
            >
              <Trash2Icon className="size-3 text-danger" />
            </IconButton>
          </span>
        </Box>
      );
    });
  }
  const selectedSkill = selected ? (skills.find((s) => s.name === selected.skill) ?? null) : null;
  return (
    <div data-content-padding="false" className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b px-4 py-2.5 lg:px-6">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-sm font-semibold leading-tight">Skill</h1>
          <p className="text-muted text-xs">技能库 · agentskills.io 规范 · 按 Agent 授权可见</p>
        </div>
        {/* 缺口清单：agent 点名调用、但库里没有的 skill —— 直接是该补什么的依据。 */}
        {missing.length > 0 && (
          <>
            <Button
              className="ml-auto"
              onClick={(event) => setMissingAnchor(event.currentTarget)}
              size="small"
              variant="outlined"
            >
              <AlertTriangleIcon className="size-3.5 text-warning" />
              {missing.length} 个未命中调用
            </Button>

            <Popover
              open={Boolean(missingAnchor)}
              anchorEl={missingAnchor}
              onClose={() => setMissingAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            >
              <Box className="w-80" sx={{ p: 2, maxWidth: "calc(100vw - 32px)", overflowY: "auto" }}>
                <p className="mb-2 text-xs text-muted">Agent 点名调用、但技能库里不存在的 skill。按被点名次数排序。</p>
                <div className="space-y-1">
                  {missing.map((m) => (
                    <div key={m.skill} className="flex items-center gap-2 text-sm">
                      <code className="min-w-0 flex-1 truncate font-mono text-xs" title={m.skill}>
                        {m.skill}
                      </code>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{m.calls} 次</span>
                      <span className="shrink-0 text-xs text-muted">{fmtTime(m.last_used)}</span>
                    </div>
                  ))}
                </div>
              </Box>
            </Popover>
          </>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* ── 左侧文件树 ── */}
        <div className="flex max-h-[40vh] w-full shrink-0 flex-col border-b md:max-h-none md:w-64 md:border-b-0 md:border-r">
          <div className="flex flex-col gap-2 border-b p-2">
            <Button
              className="w-full"
              onClick={() => {
                setViewTab("basic");
                setNewOpen(true);
              }}
              size="small"
              variant="outlined"
            >
              <PlusIcon className="size-3.5" />
              新建 Skill
            </Button>
            <input
              ref={uploadRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={onUploadPick}
            />
            <Button
              className="w-full"
              disabled={uploading}
              onClick={() => uploadRef.current?.click()}
              aria-label={"上传包含 SKILL.md 的 .zip 压缩包"}
              size="small"
              variant="outlined"
            >
              <UploadIcon className="size-3.5" />
              {uploading ? "上传中…" : "上传压缩包"}
            </Button>
          </div>
          {/* Radix viewport wraps children in a display:table div that grows with
content — force it to block so long names truncate instead of
widening the rows past the sidebar. */}
          <Box
            role="tree"
            aria-label="技能文件树"
            className="flex-1 [&>[data-slot=scroll-area-viewport]>div]:!block"
            data-slot="scroll-shadow"
            data-scrollbar="thin"
            sx={{ overflowY: "auto", overflowX: "hidden" }}
          >
            <div className="p-1">
              {skills.map((s) => {
                const isOpen = expanded.has(s.name);
                const tree = buildTree(s.files);
                const isSkillSelected = selected?.skill === s.name && selected.path === null;
                return (
                  <div key={s.name}>
                    {/* skill 根节点 */}
                    <Box
                      role="treeitem"
                      tabIndex={0}
                      aria-label={s.name}
                      aria-expanded={isOpen}
                      aria-selected={isSkillSelected}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          event.currentTarget.click();
                        }
                      }}
                      className={cn(
                        "group relative flex cursor-pointer select-none items-center gap-1 rounded px-2 py-1 text-sm",
                        isSkillSelected ? "bg-accent text-accent-foreground" : "hover:bg-surface-secondary",
                      )}
                      onClick={() => {
                        toggleExpanded(s.name);
                        setSelected({ skill: s.name, path: null });
                      }}
                    >
                      <ChevronRightIcon
                        className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")}
                      />
                      {isOpen ? (
                        <FolderOpenIcon className="size-3.5 shrink-0 text-accent" />
                      ) : (
                        <FolderIcon className="size-3.5 shrink-0 text-accent" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-semibold" title={s.name}>
                        {s.name}
                      </span>
                      {s.calls > 0 && (
                        <span
                          className="shrink-0 rounded bg-surface-secondary px-1 text-[10px] tabular-nums text-muted"
                          title={`被调用 ${s.calls} 次 · 最近 ${fmtTime(s.last_used)}`}
                        >
                          {s.calls}
                        </span>
                      )}
                      <span
                        className={cn(
                          "absolute inset-y-0 right-1 hidden items-center gap-0.5 rounded pl-1 group-hover:flex group-focus-within:flex max-sm:flex",
                          isSkillSelected ? "bg-accent" : "bg-surface-secondary",
                        )}
                      >
                        <IconButton
                          className="size-5"
                          aria-label={"新建文件"}
                          onClick={(e) => {
                            e.stopPropagation();
                            startCreate(s.name, "", "file");
                          }}
                          size="small"
                        >
                          <FilePlusIcon className="size-3 text-muted" />
                        </IconButton>
                        <IconButton
                          className="size-5"
                          aria-label={"新建文件夹"}
                          onClick={(e) => {
                            e.stopPropagation();
                            startCreate(s.name, "", "dir");
                          }}
                          size="small"
                        >
                          <FolderPlusIcon className="size-3 text-muted" />
                        </IconButton>
                        <IconButton
                          className="size-5"
                          aria-label={"删除 Skill"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDelete({ kind: "skill", skill: s.name });
                          }}
                          size="small"
                        >
                          <Trash2Icon className="size-3 text-danger" />
                        </IconButton>
                      </span>
                    </Box>

                    {/* 展开：递归文件树 */}
                    {isOpen && (
                      <>
                        {renderTree(tree, s.name, 0)}
                        {creating?.skill === s.name && creating.inDir === "" && inlineInputJSX(22)}
                      </>
                    )}
                  </div>
                );
              })}

              {skills.length === 0 && <p className="p-3 text-xs text-muted">暂无 Skill，点击「新建」开始</p>}
            </div>
          </Box>
        </div>

        {/* ── 右侧面板 ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4">
          {!selected && (
            <SkillsOverview
              skills={skills}
              missing={missing}
              onSelect={(name) => setSelected({ skill: name, path: null })}
            />
          )}

          {selected && selected.path === null && selectedSkill && (
            <div className="max-w-5xl space-y-5">
              <div>
                <h2 className="font-mono text-base font-semibold">{selectedSkill.name}</h2>
                {selectedSkill.description && <p className="mt-1 text-sm text-muted">{selectedSkill.description}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedSkill.license && (
                    <Chip
                      className="text-xs font-normal"
                      size="small"
                      variant="filled"
                      label={<>License: {selectedSkill.license}</>}
                    />
                  )}
                  {selectedSkill.compatibility && (
                    <Chip
                      className="text-xs font-normal"
                      size="small"
                      variant="filled"
                      label={<>{selectedSkill.compatibility}</>}
                    />
                  )}
                </div>
              </div>

              {/* 左右分栏：配置（MCP/可见性）在左为主，调用统计在右为辅。
lg 以下放不下时用 flex-row-reverse 回落到单列——统计因 DOM 顺序在前，
窄屏时自然落到配置上方（与改版前的上下顺序一致）。 */}
              <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
                {/* ── 右侧：调用统计 ── */}
                <div className="space-y-2 lg:w-80 lg:shrink-0">
                  <Box component="span" className="text-xs text-muted" sx={{ fontSize: "inherit" }}>
                    调用统计
                  </Box>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md border p-2">
                      <p className="text-lg font-semibold tabular-nums">{selectedSkill.calls}</p>
                      <p className="text-xs text-muted">总调用次数</p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-lg font-semibold tabular-nums">{selectedSkill.tasks}</p>
                      <p className="text-xs text-muted">覆盖任务数</p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="truncate text-sm font-medium" title={fmtTime(selectedSkill.last_used)}>
                        {fmtTime(selectedSkill.last_used)}
                      </p>
                      <p className="text-xs text-muted">最近调用</p>
                    </div>
                  </div>
                  {selectedSkill.usage_agents.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted">调用方：</span>
                      {selectedSkill.usage_agents.map((k) => (
                        <Chip key={k} className="text-xs font-normal" size="small" variant="filled" label={<>{k}</>} />
                      ))}
                    </div>
                  )}
                  {usageLoading ? (
                    <p className="text-xs text-muted">加载调用明细…</p>
                  ) : usageCalls.length > 0 ? (
                    <div className="rounded-md border">
                      <div className="border-b px-2 py-1 text-xs text-muted">最近 {usageCalls.length} 次调用</div>
                      <Box
                        className="max-h-56 overflow-y-auto"
                        data-scrollbar="thin"
                        data-slot="scroll-shadow"
                        sx={{ overflowY: "auto", overflowX: "hidden" }}
                      >
                        {usageCalls.map((c, i) => (
                          <div
                            key={`${c.ts}-${i}`}
                            className="flex items-center gap-2 border-b px-2 py-1 text-xs last:border-b-0"
                          >
                            <span className="tabular-nums text-muted">{fmtTime(c.ts)}</span>
                            <Chip
                              className="font-normal"
                              size="small"
                              variant="filled"
                              label={<>{c.agent_key || "—"}</>}
                            />
                            <span className="ml-auto text-muted">
                              {c.task_id > 0 ? `任务 #${c.task_id}` : c.session_id ? "对话会话" : "—"}
                            </span>
                          </div>
                        ))}
                      </Box>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">还没有调用记录。</p>
                  )}
                </div>

                {/* ── 左侧：关联 MCP + 可见性 ── */}
                <div className="space-y-5 lg:min-w-0 lg:flex-1">
                  <div className="space-y-2">
                    <Box component="span" className="text-xs text-muted" sx={{ fontSize: "inherit" }}>
                      关联 MCP
                      <span className="ml-1 font-normal">（加载 Skill 时才披露/解锁其工具）</span>
                    </Box>
                    {mcpOptions.length === 0 ? (
                      <p className="text-xs text-muted">暂无 MCP，可在「MCP」页添加。</p>
                    ) : (
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {mcpOptions.map((m) => (
                          <FormControlLabel
                            key={m.id}
                            control={
                              <Checkbox
                                checked={detailMcps.includes(m.name) === true}
                                onChange={(_event, checked) =>
                                  ((on) => toggleSkillMcp(selectedSkill.name, m.name, !!on))(checked)
                                }
                                size="small"
                                slotProps={{ input: { "aria-label": undefined } }}
                              />
                            }
                            label={
                              <>
                                <Box component="span" sx={{ fontSize: "inherit" }}>
                                  {m.name}
                                </Box>
                              </>
                            }
                            sx={{ m: 0, gap: 0.5, "& .MuiFormControlLabel-label": { fontSize: 14, minWidth: 0 } }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Box component="span" className="text-xs text-muted" sx={{ fontSize: "inherit" }}>
                      可见性（按 Agent 授权）
                    </Box>
                    <div className="space-y-2">
                      {agents.map((a) => (
                        <FormControlLabel
                          key={a.key}
                          control={
                            <Checkbox
                              checked={(visibility[selectedSkill.name] ?? []).includes(a.id) === true}
                              onChange={() => toggleVisibility(selectedSkill.name, a.id, a.name)}
                              size="small"
                              slotProps={{ input: { "aria-label": undefined } }}
                            />
                          }
                          label={
                            <>
                              <Box component="span" sx={{ fontSize: "inherit" }}>
                                {a.name}
                              </Box>
                            </>
                          }
                          sx={{ m: 0, gap: 0.5, "& .MuiFormControlLabel-label": { fontSize: 14, minWidth: 0 } }}
                        />
                      ))}
                      {agents.length === 0 && <span className="text-xs text-muted">（暂无 Agent）</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selected && selected.path !== null && (
            <div className="flex h-full flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-medium text-foreground">{selected.skill}</span>
                <span>/</span>
                <span className="font-mono">{selected.path}</span>
                <Button
                  className="ml-auto"
                  onClick={saveFile}
                  disabled={!dirty || saving}
                  size="small"
                  variant="contained"
                >
                  {saving ? "保存中…" : "保存"}
                </Button>
              </div>
              {fileLoading ? (
                <p className="text-xs text-muted">加载中…</p>
              ) : (
                <TextField
                  value={fileContent}
                  onChange={(e) => {
                    setFileContent(e.target.value);
                    setDirty(true);
                  }}
                  className={"flex-1 resize-none font-mono text-xs"}
                  multiline
                  minRows={3}
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { "aria-label": "文件内容" } }}
                  sx={{
                    minHeight: 240,
                    "& .MuiInputBase-root": { flex: 1, alignItems: "flex-start" },
                    "& textarea": {
                      fontFamily: "monospace",
                      fontSize: 12,
                      height: "100% !important",
                      overflow: "auto !important",
                    },
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 删除二次确认 ── */}

      <Dialog
        open={overwriteUpload !== null}
        onClose={() => setOverwriteUpload(null)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="skill-overwrite-title"
      >
        <DialogTitle id="skill-overwrite-title">覆盖同名 Skill？</DialogTitle>
        <DialogContent>{overwriteUpload?.message}。将用上传包覆盖同名 Skill。</DialogContent>
        <DialogActions>
          <Button onClick={() => setOverwriteUpload(null)}>取消</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (overwriteUpload) {
                const file = overwriteUpload.file;
                setOverwriteUpload(null);
                void uploadZip(file, true);
              }
            }}
          >
            覆盖
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!pendingDelete}
        onClose={() =>
          ((o) => {
            if (!o) setPendingDelete(null);
          })(false)
        }
        fullWidth
        maxWidth="sm"
        aria-labelledby="skill-delete-title"
        slotProps={{ paper: { role: "alertdialog" } }}
      >
        <DialogContent>
          <Box sx={{ py: 2, px: 2, pr: 5 }}>
            <Typography id="skill-delete-title" component="h2" variant="h6">
              {pendingDelete?.kind === "skill" && `删除 Skill「${pendingDelete.skill}」？`}
              {pendingDelete?.kind === "dir" && `删除文件夹「${pendingDelete.path}」？`}
              {pendingDelete?.kind === "file" && `删除文件「${pendingDelete.path}」？`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {pendingDelete?.kind === "skill"
                ? "将删除该 Skill 的全部文件、MCP 关联与可见性配置。此操作不可撤销。"
                : pendingDelete?.kind === "dir"
                  ? "将一并删除该文件夹下的所有文件。此操作不可撤销。"
                  : "此操作不可撤销。"}
            </Typography>
          </Box>
          <DialogActions>
            <Button
              disabled={deleting}
              onClick={() =>
                ((o) => {
                  if (!o) setPendingDelete(null);
                })(false)
              }
              size="small"
              variant="outlined"
            >
              取消
            </Button>
            <Button
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void runPendingDelete();
              }}
              size="small"
              variant="contained"
            >
              {deleting ? "删除中…" : "删除"}
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>

      {/* ── 新建 Skill 对话框 ── */}

      <Drawer
        anchor="right"
        open={newOpen}
        onClose={() => setNewOpen(false)}
        slotProps={{
          paper: {
            "aria-labelledby": "skill-create-title",
            sx: { width: { xs: "100vw", sm: "clamp(420px,45vw,760px)" }, maxWidth: "100vw", overflow: "hidden" },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative" }}>
          <IconButton
            aria-label="关闭"
            onClick={() => setNewOpen(false)}
            size="small"
            sx={{ position: "absolute", right: 12, top: 12, zIndex: 1 }}
          >
            <XIcon size={18} />
          </IconButton>
          <Box className="px-4 pt-4" sx={{ py: 2, px: 2, pr: 5 }}>
            <Typography id="skill-create-title" component="h2" variant="h6">
              新建 Skill
            </Typography>
          </Box>
          <Box className="flex min-h-0 flex-1 flex-col" sx={{ minWidth: 0 }}>
            <Tabs
              className="mx-4 mt-3 shrink-0 justify-start"
              value={viewTab}
              onChange={(_event, value: string) => setViewTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ minHeight: 40, flexShrink: 0, mb: 2, maxWidth: "100%" }}
            >
              <Tab
                value={"basic"}
                label={<>基本信息</>}
                id={"skill-tab-" + "basic"}
                aria-controls={"skill-panel-" + "basic"}
              />
              <Tab
                value={"mcp"}
                label={
                  <>
                    关联 MCP
                    {newMcps.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] leading-none text-accent-foreground">
                        {newMcps.length}
                      </span>
                    )}
                  </>
                }
                id={"skill-tab-" + "mcp"}
                aria-controls={"skill-panel-" + "mcp"}
              />
              <Tab
                value={"visibility"}
                label={
                  <>
                    可见性
                    {newVisibility.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] leading-none text-accent-foreground">
                        {newVisibility.length}
                      </span>
                    )}
                  </>
                }
                id={"skill-tab-" + "visibility"}
                aria-controls={"skill-panel-" + "visibility"}
              />
            </Tabs>

            {/* 基本信息 */}
            <>
              {viewTab === "basic" && (
                <Box
                  className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4 data-[state=inactive]:hidden"
                  role="tabpanel"
                  id={"skill-panel-" + "basic"}
                  aria-labelledby={"skill-tab-" + "basic"}
                >
                  <div className="grid gap-1.5">
                    <Box component="label" htmlFor="sk-name" sx={{ fontSize: "inherit" }}>
                      名称 <span className="text-danger">*</span>
                    </Box>
                    <TextField
                      id="sk-name"
                      placeholder="sqli-deepdive"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      fullWidth
                      size="small"
                      slotProps={{ htmlInput: { "aria-label": "名称" } }}
                    />
                    <p className="text-muted text-xs">小写字母 / 数字 / 连字符，1–64 字符</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Box component="label" htmlFor="sk-desc" sx={{ fontSize: "inherit" }}>
                      描述 <span className="text-danger">*</span>
                    </Box>
                    <TextField
                      id="sk-desc"
                      rows={2}
                      placeholder="这个 skill 做什么、何时使用。"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className={"resize-none"}
                      multiline
                      fullWidth
                      size="small"
                      slotProps={{ htmlInput: { "aria-label": "描述" } }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Box component="span" className="text-muted text-xs" sx={{ fontSize: "inherit" }}>
                        license
                      </Box>
                      <TextField
                        placeholder="MIT / Proprietary"
                        value={newLicense}
                        onChange={(e) => setNewLicense(e.target.value)}
                        fullWidth
                        size="small"
                        slotProps={{ htmlInput: { "aria-label": "license" } }}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Box component="span" className="text-muted text-xs" sx={{ fontSize: "inherit" }}>
                        compatibility
                      </Box>
                      <TextField
                        placeholder="需要 sqlmap、python3"
                        value={newCompat}
                        onChange={(e) => setNewCompat(e.target.value)}
                        fullWidth
                        size="small"
                        slotProps={{ htmlInput: { "aria-label": "compatibility" } }}
                      />
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                    <Box component="label" htmlFor="sk-inst" sx={{ fontSize: "inherit" }}>
                      正文 <span className="text-muted text-xs font-normal">（留空自动生成骨架）</span>
                    </Box>
                    <TextField
                      id="sk-inst"
                      placeholder={"## 执行方法\n\n1. 先探测错误\n2. 区分盲注类型\n\n脚本放 scripts/ 目录。"}
                      value={newInst}
                      onChange={(e) => setNewInst(e.target.value)}
                      className={"min-h-40 flex-1 resize-none font-mono text-sm leading-relaxed"}
                      multiline
                      minRows={3}
                      fullWidth
                      size="small"
                      slotProps={{ htmlInput: { "aria-label": "正文" } }}
                      sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
                    />
                  </div>
                </Box>
              )}
            </>

            {/* 关联 MCP */}
            <>
              {viewTab === "mcp" && (
                <Box
                  className="overflow-y-auto px-4 pb-4 pt-4 data-[state=inactive]:hidden"
                  role="tabpanel"
                  id={"skill-panel-" + "mcp"}
                  aria-labelledby={"skill-tab-" + "mcp"}
                >
                  <p className="mb-3 text-xs text-muted">加载 Skill 时才披露并解锁所选 MCP 的工具。</p>
                  {mcpOptions.length === 0 ? (
                    <p className="text-xs text-muted">暂无 MCP，可在「MCP」页添加。</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {mcpOptions.map((m) => (
                        <FormControlLabel
                          key={m.id}
                          control={
                            <Checkbox
                              checked={newMcps.includes(m.name) === true}
                              onChange={(_event, checked) =>
                                ((on) =>
                                  setNewMcps((cur) => (on ? [...cur, m.name] : cur.filter((n) => n !== m.name))))(
                                  checked,
                                )
                              }
                              size="small"
                              slotProps={{ input: { "aria-label": undefined } }}
                            />
                          }
                          label={
                            <>
                              <Box component="span" sx={{ fontSize: "inherit" }}>
                                {m.name}
                              </Box>
                            </>
                          }
                          sx={{ m: 0, gap: 0.5, "& .MuiFormControlLabel-label": { fontSize: 14, minWidth: 0 } }}
                        />
                      ))}
                    </div>
                  )}
                </Box>
              )}
            </>

            {/* 可见性 */}
            <>
              {viewTab === "visibility" && (
                <Box
                  className="overflow-y-auto px-4 pb-4 pt-4 data-[state=inactive]:hidden"
                  role="tabpanel"
                  id={"skill-panel-" + "visibility"}
                  aria-labelledby={"skill-tab-" + "visibility"}
                >
                  <p className="mb-3 text-xs text-muted">选中的 Agent 创建后即可见此 Skill。</p>
                  {agents.length === 0 ? (
                    <p className="text-xs text-muted">（暂无 Agent）</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {agents.map((a) => (
                        <FormControlLabel
                          key={a.key}
                          control={
                            <Checkbox
                              checked={newVisibility.includes(a.id) === true}
                              onChange={(_event, checked) =>
                                ((on) =>
                                  setNewVisibility((cur) => (on ? [...cur, a.id] : cur.filter((id) => id !== a.id))))(
                                  checked,
                                )
                              }
                              size="small"
                              slotProps={{ input: { "aria-label": undefined } }}
                            />
                          }
                          label={
                            <>
                              <Box component="span" sx={{ fontSize: "inherit" }}>
                                {a.name}
                              </Box>
                            </>
                          }
                          sx={{ m: 0, gap: 0.5, "& .MuiFormControlLabel-label": { fontSize: 14, minWidth: 0 } }}
                        />
                      ))}
                    </div>
                  )}
                </Box>
              )}
            </>
          </Box>

          <Box
            className="flex-row justify-end gap-2 border-t px-4 py-3"
            sx={{ display: "flex", gap: 1, flexShrink: 0 }}
          >
            <Button onClick={() => setNewOpen(false)} size="small" variant="outlined">
              取消
            </Button>
            <Button onClick={createNewSkill} disabled={creatingSkill} size="small" variant="contained">
              {creatingSkill ? "创建中…" : "创建"}
            </Button>
          </Box>
        </Box>
      </Drawer>
    </div>
  );
}
