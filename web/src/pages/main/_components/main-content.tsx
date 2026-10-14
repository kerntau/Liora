import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { useLocation } from "react-router";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { useCurrentUser } from "@/hooks/use-current-user";
import { api } from "@/lib/api";
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
      <Stack component="header" direction="row" sx={{ minHeight: 56, alignItems: "center", justifyContent: "space-between", px: { xs: 2, lg: 3 }, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
            <SidebarTrigger className="-ml-1"/>
            <Divider orientation="vertical" flexItem sx={{ height: 20, alignSelf: "center" }} />
            <SearchDialog />
          </Stack>
          <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
            {version && <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", xl: "inline" } }}>版本 · {version}</Typography>}
            <LayoutControls />
            <ThemeSwitcher />
            <AccountSwitcher users={[currentUser]}/>
          </Stack>
        <Link
          to="/function/tasks"
          aria-label={APP_CONFIG.name}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md px-2 py-1 transition-opacity hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
        >
          {/* biome-ignore lint/performance/noImgElement: The logo path is configured at runtime and already used by the sidebar. */}
          <img src={APP_CONFIG.logo} alt={APP_CONFIG.name} width={523} height={144} className="h-8 w-auto max-w-[30vw] object-contain" />
        </Link>
      </Stack>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
        {children}
      </div>
    </>);
}
