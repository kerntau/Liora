import { Button, Label, ListBox, Popover, Select, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Settings } from "lucide-react";
import { type FontKey, fontOptions } from "@/lib/fonts/registry";
import type { ContentLayout, NavbarStyle, SidebarCollapsible, SidebarVariant } from "@/lib/preferences/layout";
import { applyContentLayout, applyFont, applyNavbarStyle, applySidebarCollapsible, applySidebarVariant, } from "@/lib/preferences/layout-utils";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import type { ThemeMode } from "@/lib/preferences/theme";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
export function LayoutControls() {
    const themeMode = usePreferencesStore((s) => s.themeMode);
    const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
    const contentLayout = usePreferencesStore((s) => s.contentLayout);
    const setContentLayout = usePreferencesStore((s) => s.setContentLayout);
    const navbarStyle = usePreferencesStore((s) => s.navbarStyle);
    const setNavbarStyle = usePreferencesStore((s) => s.setNavbarStyle);
    const variant = usePreferencesStore((s) => s.sidebarVariant);
    const setSidebarVariant = usePreferencesStore((s) => s.setSidebarVariant);
    const collapsible = usePreferencesStore((s) => s.sidebarCollapsible);
    const setSidebarCollapsible = usePreferencesStore((s) => s.setSidebarCollapsible);
    const font = usePreferencesStore((s) => s.font);
    const setFont = usePreferencesStore((s) => s.setFont);
    const onThemeModeChange = (mode: ThemeMode) => {
        if (!mode)
            return;
        setThemeMode(mode);
        void persistPreference("theme_mode", mode);
    };
    const onContentLayoutChange = (layout: ContentLayout) => {
        if (!layout)
            return;
        applyContentLayout(layout);
        setContentLayout(layout);
        void persistPreference("content_layout", layout);
    };
    const onNavbarStyleChange = (style: NavbarStyle) => {
        if (!style)
            return;
        applyNavbarStyle(style);
        setNavbarStyle(style);
        void persistPreference("navbar_style", style);
    };
    const onSidebarStyleChange = (value: SidebarVariant) => {
        if (!value)
            return;
        setSidebarVariant(value);
        applySidebarVariant(value);
        void persistPreference("sidebar_variant", value);
    };
    const onSidebarCollapseModeChange = (value: SidebarCollapsible) => {
        if (!value)
            return;
        setSidebarCollapsible(value);
        applySidebarCollapsible(value);
        void persistPreference("sidebar_collapsible", value);
    };
    const onFontChange = (value: FontKey) => {
        if (!value)
            return;
        applyFont(value);
        setFont(value);
        void persistPreference("font", value);
    };
    const handleRestore = () => {
        onThemeModeChange(PREFERENCE_DEFAULTS.theme_mode);
        onContentLayoutChange(PREFERENCE_DEFAULTS.content_layout);
        onNavbarStyleChange(PREFERENCE_DEFAULTS.navbar_style);
        onSidebarStyleChange(PREFERENCE_DEFAULTS.sidebar_variant);
        onSidebarCollapseModeChange(PREFERENCE_DEFAULTS.sidebar_collapsible);
        onFontChange(PREFERENCE_DEFAULTS.font);
    };
    return (<Popover>
      
        <Button size="sm" isIconOnly aria-label="界面偏好" variant={"ghost"}>
          <Settings className="size-4"/>
        </Button>
      
      <Popover.Content className="w-80 p-4">
        <Popover.Dialog className="outline-none">
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <h4 className="font-medium text-sm leading-none text-foreground">界面偏好</h4>
              <p className="text-muted text-xs">自定义控制台布局与显示偏好。</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="font-medium text-xs text-foreground">字体</Label>
                <Select selectedKey={font} className="w-full text-xs" aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((key) => key && onFontChange(String(key) as FontKey))(String(key));
        }}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {fontOptions.map((opt) => (<ListBox.Item key={opt.key} id={opt.key} textValue={opt.label}>
                          {opt.label}
                        </ListBox.Item>))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-xs text-foreground">色彩模式</Label>
                <ToggleButtonGroup size="sm" selectionMode="single" selectedKeys={new Set([themeMode])} onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            if (first)
                onThemeModeChange(String(first) as ThemeMode);
        }} className="w-full grid grid-cols-3 gap-1">
                  <ToggleButton id="light" size="sm" className="text-xs justify-center">
                    浅色
                  </ToggleButton>
                  <ToggleButton id="dark" size="sm" className="text-xs justify-center">
                    深色
                  </ToggleButton>
                  <ToggleButton id="system" size="sm" className="text-xs justify-center">
                    系统
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-xs text-foreground">版心宽度</Label>
                <ToggleButtonGroup size="sm" selectionMode="single" selectedKeys={new Set([contentLayout])} onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            if (first)
                onContentLayoutChange(String(first) as ContentLayout);
        }} className="w-full grid grid-cols-2 gap-1">
                  <ToggleButton id="centered" size="sm" className="text-xs justify-center">
                    居中版心
                  </ToggleButton>
                  <ToggleButton id="full-width" size="sm" className="text-xs justify-center">
                    全宽铺满
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-xs text-foreground">顶栏行为</Label>
                <ToggleButtonGroup size="sm" selectionMode="single" selectedKeys={new Set([navbarStyle])} onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            if (first)
                onNavbarStyleChange(String(first) as NavbarStyle);
        }} className="w-full grid grid-cols-2 gap-1">
                  <ToggleButton id="sticky" size="sm" className="text-xs justify-center">
                    顶部吸顶
                  </ToggleButton>
                  <ToggleButton id="scroll" size="sm" className="text-xs justify-center">
                    随页滚动
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-xs text-foreground">侧栏样式</Label>
                <ToggleButtonGroup size="sm" selectionMode="single" selectedKeys={new Set([variant])} onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            if (first)
                onSidebarStyleChange(String(first) as SidebarVariant);
        }} className="w-full grid grid-cols-3 gap-1">
                  <ToggleButton id="inset" size="sm" className="text-xs justify-center">
                    内嵌
                  </ToggleButton>
                  <ToggleButton id="sidebar" size="sm" className="text-xs justify-center">
                    经典
                  </ToggleButton>
                  <ToggleButton id="floating" size="sm" className="text-xs justify-center">
                    悬浮
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>

              <div className="space-y-1">
                <Label className="font-medium text-xs text-foreground">侧栏折叠模式</Label>
                <ToggleButtonGroup size="sm" selectionMode="single" selectedKeys={new Set([collapsible])} onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            if (first)
                onSidebarCollapseModeChange(String(first) as SidebarCollapsible);
        }} className="w-full grid grid-cols-2 gap-1">
                  <ToggleButton id="icon" size="sm" className="text-xs justify-center">
                    仅图标
                  </ToggleButton>
                  <ToggleButton id="offcanvas" size="sm" className="text-xs justify-center">
                    抽屉折叠
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>

              <Button type="button" size="sm" className="w-full text-xs mt-1" onPress={handleRestore} variant={"outline"}>
                恢复默认设置
              </Button>
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>);
}
