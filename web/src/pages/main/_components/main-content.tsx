import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { useLocation } from "react-router";
import { Separator } from "@heroui/react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { useCurrentUser } from "@/hooks/use-current-user";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./sidebar/account-switcher";
import { LayoutControls } from "./sidebar/layout-controls";
import { SearchDialog } from "./sidebar/search-dialog";
import { ThemeSwitcher } from "./sidebar/theme-switcher";
// 任务详情页保持原样：它自带头部/Tabs 与内边距，这里不再叠加全局头部和 padding。
function isFullBleed(pathname: string) {
    const p = (() => {
        try {
            return decodeURIComponent(pathname);
        }
        catch {
            return pathname;
        }
    })();
    // Normalize trailing slashes before distinguishing list and detail routes.
    const normalized = p.replace(/\/+$/, "");
    return normalized.startsWith("/function/tasks/");
}
export function MainContent({ children }: {
    children: ReactNode;
}) {
    const currentUser = useCurrentUser();
    const { pathname: pathname } = useLocation();
    const [version, setVersion] = useState("");
    useEffect(() => {
        api
            .health()
            .then((h) => setVersion((h.version ?? "").replace(/^v(?=\d)/, "")))
            .catch(() => setVersion(""));
    }, []);
    if (isFullBleed(pathname)) {
        return <>{children}</>;
    }
    return (<>
      <header className={cn("relative flex h-12 shrink-0 items-center gap-2 border-border border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12", "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-surface/80 [html[data-navbar-style=sticky]_&]:backdrop-blur-md")}>
        <div className="flex w-full items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-1 lg:gap-2">
            <SidebarTrigger className="-ml-1"/>
            <Separator orientation="vertical" className="mx-2 h-4 self-center"/>
            <SearchDialog />
          </div>
          <div className="flex items-center gap-2">
            {version && <span className="hidden xl:inline font-medium text-muted text-xs tabular-nums">版本 · {version}</span>}
            <LayoutControls />
            <ThemeSwitcher />
            <AccountSwitcher users={[currentUser]}/>
          </div>
        </div>
        <Link
          to="/function/tasks"
          aria-label={APP_CONFIG.name}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md px-2 py-1 transition-opacity hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
        >
          {/* biome-ignore lint/performance/noImgElement: The logo path is configured at runtime and already used by the sidebar. */}
          <img src={APP_CONFIG.logo} alt={APP_CONFIG.name} width={523} height={144} className="h-8 w-auto max-w-[30vw] object-contain" />
        </Link>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
        {children}
      </div>
    </>);
}
