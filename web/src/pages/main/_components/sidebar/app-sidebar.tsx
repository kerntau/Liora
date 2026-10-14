import { Link } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, } from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { useCurrentUser } from "@/hooks/use-current-user";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const currentUser = useCurrentUser();
    const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(useShallow((s) => ({
        sidebarVariant: s.sidebarVariant,
        sidebarCollapsible: s.sidebarCollapsible,
        isSynced: s.isSynced,
    })));
    const variant = isSynced ? sidebarVariant : props.variant;
    const collapsible = isSynced ? sidebarCollapsible : props.collapsible;
    return (<Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={APP_CONFIG.name}>
              <Link to="/function/tasks" aria-label={APP_CONFIG.name}>
                <img src={APP_CONFIG.logo} alt={APP_CONFIG.name} width={523} height={144} className="h-8 w-auto max-w-full shrink-0 object-contain group-data-[collapsible=icon]:hidden"/>
                <img src={APP_CONFIG.logoIcon} alt="" width={256} height={256} className="hidden size-8 shrink-0 object-contain group-data-[collapsible=icon]:block"/>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarItems}/>
        {/* <NavDocuments items={data.documents} /> */}
        {/* <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser}/>
      </SidebarFooter>
    </Sidebar>);
}
