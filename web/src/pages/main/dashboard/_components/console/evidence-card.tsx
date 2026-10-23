"use client";

import * as React from "react";

import { DownloadIcon, FileSearchIcon, SearchIcon } from "lucide-react";

import { SectionCard } from "@/components/app/section-card";
import { HttpCodeBlock } from "@/components/http-code-block";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { fmtBytes, fmtTime } from "@/lib/format";
import Link from "@/lib/router-compat";
import type { Finding, Severity, Task, TrafficDetail, TrafficExchange } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * 共享状态表（lib/status.ts）尚未收录的后端状态：表格里不能直接露英文枚举。
 * 已收录的状态仍走 <StatusBadge>，这里只做兜底文案。
 */
const FALLBACK_STATUS_LABELS: Record<string, string> = {
  open: "待处理",
  retesting: "复测中",
};

// 状态码文字色:浅底 600 / 深底 400,蓝统一收敛为 sky(与 traffic-panel 同口径)。
function statusTone(code: number) {
  if (code >= 500) return "text-rose-600 dark:text-rose-400";
  if (code >= 400) return "text-amber-600 dark:text-amber-400";
  if (code >= 300) return "text-sky-600 dark:text-sky-400";
  if (code >= 200) return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}

function pathOf(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url;
  }
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function EmptyEvidence({ tab, onSwitch }: { tab: "traffic" | "findings"; onSwitch: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <FileSearchIcon className="size-6 text-muted-foreground/35" aria-hidden="true" />
      <p className="font-medium text-[13px] text-foreground">
        {tab === "traffic" ? "还没有请求记录" : "还没有发现证据"}
      </p>
      <p className="max-w-md text-muted-foreground text-xs">
        {tab === "traffic"
          ? "开启流量捕获后，Agent 的每一次请求都会实时写入这里，可回放原始报文。"
          : "测试产生确认发现后，漏洞名称、等级与证据会出现在这里。"}
      </p>
      <Button size="sm" variant="outline" className="mt-1" onClick={onSwitch}>
        {tab === "traffic" ? "查看发现证据" : "查看请求记录"}
      </Button>
    </div>
  );
}

export function EvidenceCard({
  traffic,
  findings,
  tasks,
}: {
  traffic: TrafficExchange[];
  findings: Finding[];
  tasks: Task[];
}) {
  const [tab, setTab] = React.useState<"traffic" | "findings">("traffic");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [exchangeId, setExchangeId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<TrafficDetail | null>(null);
  const [detailError, setDetailError] = React.useState("");

  React.useEffect(() => {
    if (traffic.length === 0 && findings.length > 0) setTab("findings");
  }, [traffic.length, findings.length]);

  React.useEffect(() => {
    if (!exchangeId) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let live = true;
    setDetail(null);
    setDetailError("");
    api
      .trafficExchange(exchangeId)
      .then((value) => live && setDetail(value))
      .catch((error: Error) => live && setDetailError(error.message));
    return () => {
      live = false;
    };
  }, [exchangeId]);

  const taskNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) map.set(String(task.id), task.name || task.description || `任务 #${task.id}`);
    return map;
  }, [tasks]);

  const filteredTraffic = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return traffic.filter((row) => {
      if (filter !== "all") {
        const bucket = `${Math.floor(row.status / 100)}xx`;
        if (bucket !== filter) return false;
      }
      if (!keyword) return true;
      return `${row.method} ${row.url} ${row.host} ${row.status}`.toLowerCase().includes(keyword);
    });
  }, [traffic, query, filter]);

  const filteredFindings = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return findings
      .filter((row) => {
        if (filter !== "all" && row.severity !== filter) return false;
        if (!keyword) return true;
        return `${row.name ?? ""} ${row.vulnclass} ${row.summary} ${row.task_description ?? ""}`
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => {
        const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        return severity !== 0 ? severity : Date.parse(b.ts) - Date.parse(a.ts);
      });
  }, [findings, query, filter]);

  const exportCurrent = () => {
    if (tab === "traffic") {
      downloadCsv(
        `liora-traffic-${Date.now()}.csv`,
        ["时间", "方法", "地址", "状态码", "响应大小", "主机"],
        filteredTraffic.map((row) => [row.ts, row.method, row.url, String(row.status), String(row.resp_len), row.host]),
      );
      return;
    }
    downloadCsv(
      `liora-findings-${Date.now()}.csv`,
      ["时间", "等级", "漏洞", "任务", "状态", "摘要"],
      filteredFindings.map((row) => [
        row.ts,
        row.severity,
        row.name || row.vulnclass,
        taskNames.get(String(row.task_id)) ?? "",
        row.status,
        row.summary,
      ]),
    );
  };

  const changeTab = (value: string) => {
    setTab(value as "traffic" | "findings");
    setFilter("all");
    setQuery("");
  };

  return (
    <SectionCard
      icon={FileSearchIcon}
      title="实时证据与请求记录"
      className="min-w-0"
      headerClassName="flex-col gap-3 xl:flex-row xl:items-start"
      description="每一次请求与确认发现都保留可追溯的证据"
      actions={
        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
          <div className="relative w-full min-w-0 sm:w-48 sm:flex-none">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === "traffic" ? "搜索请求、路径或主机…" : "搜索漏洞、任务或摘要…"}
              aria-label="搜索证据"
              className="h-8 w-full bg-card pl-8 text-xs"
            />
          </div>
          <Select value={tab} onValueChange={changeTab}>
            <SelectTrigger size="sm" className="h-8 w-28 shrink-0 bg-card" aria-label="证据类型">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="findings">发现证据</SelectItem>
              <SelectItem value="traffic">请求记录</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger size="sm" className="h-8 w-32 shrink-0 bg-card" aria-label="筛选证据">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">全部状态</SelectItem>
              {tab === "traffic" ? (
                <>
                  <SelectItem value="2xx">2xx 成功</SelectItem>
                  <SelectItem value="3xx">3xx 跳转</SelectItem>
                  <SelectItem value="4xx">4xx 客户端错误</SelectItem>
                  <SelectItem value="5xx">5xx 服务端错误</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="critical">严重</SelectItem>
                  <SelectItem value="high">高危</SelectItem>
                  <SelectItem value="medium">中危</SelectItem>
                  <SelectItem value="low">低危</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="shrink-0" onClick={exportCurrent}>
            <DownloadIcon data-icon="inline-start" />
            导出证据
          </Button>
        </div>
      }
    >
      <div className="min-w-0">
        {tab === "traffic" &&
          (filteredTraffic.length === 0 ? (
            <EmptyEvidence tab="traffic" onSwitch={() => changeTab("findings")} />
          ) : (
            <div className="overflow-hidden rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">时间</TableHead>
                    <TableHead className="w-16">方法</TableHead>
                    <TableHead>请求路径</TableHead>
                    <TableHead className="w-20 text-center">状态码</TableHead>
                    <TableHead className="w-20 text-right">响应大小</TableHead>
                    <TableHead className="w-36">所属模块</TableHead>
                    <TableHead className="w-24">验证状态</TableHead>
                    <TableHead className="w-20 text-right">证据</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTraffic.slice(0, 50).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-muted-foreground text-xs">
                        {fmtTime(row.ts, "seconds")}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-primary text-xs">{row.method}</span>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <span className="block truncate font-mono text-[12px] text-foreground/85" title={row.url}>
                          {pathOf(row.url)}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn("text-center font-mono font-semibold text-[12px]", statusTone(row.status))}
                      >
                        {row.status}
                      </TableCell>
                      <TableCell className="text-right text-[12px] text-muted-foreground tabular-nums">
                        {fmtBytes(row.resp_len)}
                      </TableCell>
                      <TableCell className="truncate text-[12px] text-muted-foreground">{row.host}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-success text-xs">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                          已记录
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-primary"
                          onClick={() => setExchangeId(row.id)}
                        >
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}

        {tab === "findings" &&
          (filteredFindings.length === 0 ? (
            <EmptyEvidence tab="findings" onSwitch={() => changeTab("traffic")} />
          ) : (
            <div className="overflow-hidden rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">时间</TableHead>
                    <TableHead className="w-20">等级</TableHead>
                    <TableHead>漏洞名称</TableHead>
                    <TableHead className="w-40">所属任务</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-24">验证状态</TableHead>
                    <TableHead className="w-20 text-right">证据</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFindings.slice(0, 50).map((row) => {
                    const verified = ["confirmed", "fixed", "resolved"].includes(row.status);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-muted-foreground text-xs">
                          {fmtTime(row.ts, "seconds")}
                        </TableCell>
                        <TableCell>
                          <StatusBadge domain="severity" value={row.severity} dot />
                        </TableCell>
                        <TableCell className="max-w-[360px]">
                          <Link
                            prefetch={false}
                            href={`/function/findings/detail?id=${encodeURIComponent(row.id)}`}
                            className="block truncate font-medium text-[13px] text-foreground hover:text-primary hover:underline"
                            title={row.name || row.vulnclass}
                          >
                            {row.name || row.vulnclass}
                          </Link>
                          <span className="block truncate text-[11px] text-muted-foreground">{row.vulnclass}</span>
                        </TableCell>
                        <TableCell className="truncate text-[12px] text-muted-foreground">
                          {taskNames.get(String(row.task_id)) ?? row.task_description ?? "—"}
                        </TableCell>
                        <TableCell>
                          {FALLBACK_STATUS_LABELS[row.status] ? (
                            <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full border border-border/60 bg-muted/50 px-2 font-semibold text-[11px] text-muted-foreground">
                              {FALLBACK_STATUS_LABELS[row.status]}
                            </span>
                          ) : (
                            <StatusBadge domain="finding" value={row.status} />
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs",
                              verified ? "text-success" : "text-warning",
                            )}
                          >
                            <span
                              className={cn("size-1.5 rounded-full", verified ? "bg-success" : "bg-warning")}
                              aria-hidden="true"
                            />
                            {verified ? "已验证" : "待验证"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="xs" variant="ghost" className="text-primary">
                            <Link prefetch={false} href={`/function/findings/detail?id=${encodeURIComponent(row.id)}`}>
                              查看
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
      </div>

      <Dialog open={exchangeId !== null} onOpenChange={(open) => !open && setExchangeId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>请求证据</DialogTitle>
            <DialogDescription>原始请求与响应报文，用于复核测试行为。</DialogDescription>
          </DialogHeader>
          {detailError ? (
            <p className="text-destructive text-sm">{detailError}</p>
          ) : !detail ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <Tabs defaultValue="request">
              <TabsList>
                <TabsTrigger value="request">请求</TabsTrigger>
                <TabsTrigger value="response">响应</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="mt-3">
                <HttpCodeBlock raw={detail.req} />
              </TabsContent>
              <TabsContent value="response" className="mt-3">
                <HttpCodeBlock raw={detail.resp} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
