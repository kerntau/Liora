import IconButton from "@mui/material/IconButton";
import { Monitor, Moon, Sun } from "lucide-react";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
const THEME_CYCLE = ["light", "dark", "system"] as const;
export function ThemeSwitcher() {
    const themeMode = usePreferencesStore((s) => s.themeMode);
    const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
    const cycleTheme = () => {
        const currentIndex = THEME_CYCLE.indexOf(themeMode);
        const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
        setThemeMode(nextTheme);
        void persistPreference("theme_mode", nextTheme);
    };
    return (<IconButton size="small" onClick={cycleTheme} aria-label={`当前色彩模式: ${themeMode}，点击切换`}>
      {/* SYSTEM */}
      <Monitor className="hidden size-4 [html[data-theme-mode=system]_&]:block"/>

      {/* DARK (resolved) */}
      <Sun className="hidden size-4 dark:block [html[data-theme-mode=system]_&]:hidden"/>

      {/* LIGHT (resolved) */}
      <Moon className="block size-4 dark:hidden [html[data-theme-mode=system]_&]:hidden"/>
    </IconButton>);
}
