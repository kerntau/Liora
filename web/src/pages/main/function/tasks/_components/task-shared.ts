import { type SortDirection } from "@/lib/sort-preference";
import type { ChatAttachment, DeleteTaskResult, Task, TaskStatus } from "@/lib/types";
export function fmtBytes(n: number): string {
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)} MB`;
  if (n >= 1 << 10) return `${(n / (1 << 10)).toFixed(1)} KB`;
  return `${n} B`;
}

export const UPLOAD_MARKER = "【上传文件（绝对路径）】";

export function appendUploads(desc: string, atts: ChatAttachment[]): string {
  const bullets = atts.map((a) => `- ${a.abs ?? a.path}（${fmtBytes(a.size)}）`).join("\n");
  if (desc.includes(UPLOAD_MARKER)) {
    return `${desc.replace(/\s*$/, "")}\n${bullets}\n`;
  }
  const head = desc.trim() ? `${desc.replace(/\s*$/, "")}\n\n` : "";
  return `${head}${UPLOAD_MARKER} worker 可用 Read/Bash 按路径打开：\n${bullets}\n`;
}

export const POLL_MS = 10000;

export function fmtTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}

export function fmtDuration(sec: number): string {
  if (sec <= 0) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function taskDuration(task: Task, nowSec: number): number {
  const start = task.created_unix ?? 0;
  if (!start) return 0;
  const end =
    task.status === "running"
      ? nowSec
      : task.completed_unix && task.completed_unix > 0
        ? task.completed_unix
        : (task.last_activity_unix ?? 0);
  return end > start ? end - start : 0;
}

export type DeleteCounts = Omit<DeleteTaskResult, "deleted" | "cleanup_warning">;

export function deleteDetails(result: DeleteCounts): string[] {
  const details: string[] = [];
  if (result.assets_deleted > 0) details.push(`删除资产 ${result.assets_deleted} 条`);
  if (result.assets_detached > 0) details.push(`解除共享资产关联 ${result.assets_detached} 条`);
  if (result.traffic_deleted > 0) details.push(`删除流量 ${result.traffic_deleted} 条`);
  if (result.files_deleted) details.push("删除任务文件");
  if (result.findings_deleted > 0) details.push(`删除漏洞 ${result.findings_deleted} 条`);
  if (result.llm_records_deleted > 0) details.push(`删除 LLM 请求/响应记录 ${result.llm_records_deleted} 条`);
  return details;
}

export function deleteSummary(result: DeleteTaskResult): string {
  const details = deleteDetails(result);
  return details.length > 0 ? `任务已删除（${details.join("，")}）` : "任务已删除";
}

export function fmtDateTime(unix?: number): string {
  if (!unix || unix <= 0) return "—";
  const d = new Date(unix * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const STATUS_OPTIONS: {
  value: TaskStatus;
  label: string;
}[] = [
  { value: "created", label: "已创建" },
  { value: "queued", label: "排队中" },
  { value: "running", label: "运行中" },
  { value: "paused", label: "已暂停" },
  { value: "done", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "timeout", label: "已超时" },
];

export const UNCATEGORIZED_VALUE = "uncategorized";

export const PAUSABLE_STATUSES = new Set<TaskStatus>(["created", "queued", "running"]);

export const ARCHIVABLE_STATUSES = new Set<TaskStatus>(["paused", "done", "failed", "timeout"]);

export function taskControlAction(status: TaskStatus): "pause" | "resume" | null {
  if (status === "paused") return "resume";
  if (PAUSABLE_STATUSES.has(status)) return "pause";
  return null;
}

export type TaskSortField = "id" | "created" | "duration" | "status";

export const TASK_SORT_FIELDS: readonly TaskSortField[] = ["id", "created", "duration", "status"];

export const TASK_SORT_PREFERENCE_KEY = "liora_task_list_sort";

export const TASK_FILTER_PREFERENCE_KEY = "liora_task_list_filters";

export const TASK_STATUS_RANK = new Map(STATUS_OPTIONS.map((option, index) => [option.value, index]));

export function taskIsPinned(task: Task): boolean {
  return task.pinned ?? Boolean(task.pinned_at);
}

export function compareTaskIDs(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function taskCreatedUnix(task: Task): number {
  if (task.created_unix) return task.created_unix;
  const parsed = Date.parse(task.created_at);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

export function compareTasks(
  left: Task,
  right: Task,
  field: TaskSortField,
  direction: SortDirection,
  nowSec: number,
): number {
  const leftPinned = taskIsPinned(left);
  const rightPinned = taskIsPinned(right);
  if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
  if (leftPinned && left.pinned_at !== right.pinned_at) {
    return (right.pinned_at ?? "").localeCompare(left.pinned_at ?? "");
  }

  let compared = 0;
  switch (field) {
    case "created":
      compared = taskCreatedUnix(left) - taskCreatedUnix(right);
      break;
    case "duration":
      compared = taskDuration(left, nowSec) - taskDuration(right, nowSec);
      break;
    case "status":
      compared = (TASK_STATUS_RANK.get(left.status) ?? 0) - (TASK_STATUS_RANK.get(right.status) ?? 0);
      break;
    default:
      compared = compareTaskIDs(left.id, right.id);
  }
  if (compared !== 0) return direction === "asc" ? compared : -compared;
  return -compareTaskIDs(left.id, right.id);
}
