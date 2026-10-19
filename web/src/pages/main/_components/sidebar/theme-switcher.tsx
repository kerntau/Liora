"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

const THEME_CYCLE = ["light", "dark", "system"] as const;

export function ThemeSwitcher() {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const themeLabels = { light: "浅色", dark: "深色", system: "跟随系统" };
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(themeMode) + 1) % THEME_CYCLE.length];

  const cycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(themeMode);
    const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];

    setThemeMode(nextTheme);
    void persistPreference("theme_mode", nextTheme);
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      className="max-sm:size-11"
      onClick={cycleTheme}
      aria-label={`当前主题：${themeLabels[themeMode]}，切换为${themeLabels[nextTheme]}`}
      title={`当前主题：${themeLabels[themeMode]}，切换为${themeLabels[nextTheme]}`}
    >
      {themeMode === "system" ? (
        <Monitor aria-hidden="true" />
      ) : themeMode === "dark" ? (
        <Moon aria-hidden="true" />
      ) : (
        <Sun aria-hidden="true" />
      )}
    </Button>
  );
}
