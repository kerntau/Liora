import { createRoot } from "react-dom/client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";
import { AppThemeProvider } from "@/theme";

import { AppRouter } from "./router";
import "./styles/globals.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing application root");
createRoot(container).render(
  <PreferencesStoreProvider
    themeMode={PREFERENCE_DEFAULTS.theme_mode}
    themePreset={PREFERENCE_DEFAULTS.theme_preset}
    font={PREFERENCE_DEFAULTS.font}
    contentLayout={PREFERENCE_DEFAULTS.content_layout}
    navbarStyle={PREFERENCE_DEFAULTS.navbar_style}
  >
    <AppThemeProvider>
      <TooltipProvider>
        <AppRouter />
        <Toaster />
      </TooltipProvider>
    </AppThemeProvider>
  </PreferencesStoreProvider>,
);
