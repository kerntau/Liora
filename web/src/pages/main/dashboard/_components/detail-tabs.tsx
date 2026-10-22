"use client";

import type { ComponentProps, ReactNode } from "react";

import { ActivityIcon, BugIcon, GaugeIcon, ListChecksIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Finding, LLMProfile, Settings, Stats, Task, TrafficExchange } from "@/lib/types";

import { AssetPanel } from "./asset-panel";
import { EvidenceCard } from "./console/evidence-card";
import { BudgetCard, CoverageCard } from "./console/rail-cards";
import type { TaskCoverage } from "./console/use-task-console";
import { FindingPanel } from "./finding-panel";
import { PollStatusCard } from "./poll-status-card";
import { StatCards } from "./stat-cards";
import { SystemStatusPanel } from "./system-status-panel";
import { ActiveTasksCard } from "./task-panel";
import { TokenCharts } from "./token-charts";
import { TrafficPanel } from "./traffic-panel";
import type { DisplayedTokens } from "./use-token-stats";

type SourceState = "pending" | "ok" | "error";

/** Tab 标签上的轻量计数：与标签拉开 2px，圆形淡底，不撑高 Tab 栏。 */
function TabCount({ children }: { children: ReactNode }) {
  return (
    <span className="ml-0.5 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] leading-none font-medium text-muted-foreground tabular-nums">
      {children}
    </span>
  );
}

export interface DashboardDetailTabsProps {
  // 任务
  tasks: Task[];
  tasksReady: boolean;
  tasksByStatus: Record<string, number>;
  selectedId: string;
  onSelect: (id: string) => void;
  // 发现
  findings: Finding[];
  scopedFindings: Finding[];
  findingsBySev: { critical: number; high: number; medium: number; low: number };
  fastReady: boolean;
  // 资产 / 流量 / 系统
  assetCounts: Record<string, number>;
  totalAssets: number;
  slowReady: boolean;
  traffic: TrafficExchange[];
  stats: Stats | null;
  settings: Settings | null;
  activeProfile: LLMProfile | undefined;
  // 任务上下文（覆盖度 / 资源）
  coverage: TaskCoverage | null;
  coveragePct: number | null;
  tokens: DisplayedTokens;
  // Token 图表
  tokenCharts: ComponentProps<typeof TokenCharts>;
  // 轮询健康度
  sources: Record<string, SourceState>;
  failedPanels: Record<string, string[]>;
}

/**
 * 首屏之下的明细区：所有次要面板按主题收进四个标签页，横向多列排布，
 * 不再纵向平铺。所有面板、数据与交互（筛选、CSV 导出、请求详情弹窗、
 * Token 数据源切换等）原样保留，只是换了一个容器。
 */
export function DashboardDetailTabs({
  tasks,
  tasksReady,
  tasksByStatus,
  selectedId,
  onSelect,
  findings,
  scopedFindings,
  findingsBySev,
  fastReady,
  assetCounts,
  totalAssets,
  slowReady,
  traffic,
  stats,
  settings,
  activeProfile,
  coverage,
  coveragePct,
  tokens,
  tokenCharts,
  sources,
  failedPanels,
}: DashboardDetailTabsProps) {
  return (
    <section aria-label="指挥台明细" className="mx-auto w-full max-w-screen-2xl min-w-0">
      <Tabs defaultValue="tasks" className="min-w-0">
        <TabsList className="h-9 w-fit max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="tasks" className="gap-2 px-3">
            <ListChecksIcon aria-hidden="true" />
            任务与用量
            <TabCount>{tasks.length}</TabCount>
          </TabsTrigger>
          <TabsTrigger value="findings" className="gap-2 px-3">
            <BugIcon aria-hidden="true" />
            发现与资产
            <TabCount>{findings.length}</TabCount>
          </TabsTrigger>
          <TabsTrigger value="traffic" className="gap-2 px-3">
            <ActivityIcon aria-hidden="true" />
            流量
            <TabCount>{traffic.length}</TabCount>
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2 px-3">
            <GaugeIcon aria-hidden="true" />
            系统状态
          </TabsTrigger>
        </TabsList>

        {/* 任务与用量：活跃任务 + Token 图表（双列），覆盖度与资源消耗并排收尾 */}
        <TabsContent value="tasks" className="mt-4 flex flex-col gap-4">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:items-start">
            <ActiveTasksCard tasks={tasks} tasksReady={tasksReady} selectedId={selectedId} onSelect={onSelect} />
            <TokenCharts {...tokenCharts} />
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
            <CoverageCard coverage={coverage} fallbackPct={coveragePct} />
            <BudgetCard tokens={tokens} taskCount={tokens.taskCount} />
          </div>
        </TabsContent>

        {/* 发现与资产：最近发现（宽）+ 资产分布（窄） */}
        <TabsContent value="findings" className="mt-4">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:items-start">
            <FindingPanel findings={findings} fastReady={fastReady} />
            <AssetPanel assetCounts={assetCounts} totalAssets={totalAssets} />
          </div>
        </TabsContent>

        {/* 流量：实时证据（含搜索/筛选/CSV 导出/报文弹窗）+ 状态码分布 */}
        <TabsContent value="traffic" className="mt-4">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
            <EvidenceCard traffic={traffic} findings={scopedFindings} tasks={tasks} />
            <TrafficPanel traffic={traffic} />
          </div>
        </TabsContent>

        {/* 系统状态：五张统计卡 + 系统状态/数据源健康度 */}
        <TabsContent value="system" className="mt-4 flex flex-col gap-4">
          <StatCards
            tasksReady={tasksReady}
            tasksTotal={tasks.length}
            tasksByStatus={tasksByStatus}
            fastReady={fastReady}
            findingsTotal={findings.length}
            findingsBySev={findingsBySev}
            slowReady={slowReady}
            totalAssets={totalAssets}
            trafficCount={traffic.length}
            trafficCapture={settings?.traffic_capture}
            tokens={tokens}
          />
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
            <SystemStatusPanel stats={stats} settings={settings} activeProfile={activeProfile} />
            <PollStatusCard sources={sources} failedPanels={failedPanels} />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
