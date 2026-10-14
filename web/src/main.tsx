import { createRoot } from "react-dom/client";

import { Toaster } from "@/components/toaster";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";
import { AppThemeProvider } from "@/theme";

import { AppRouter } from "./router";
import "./styles/globals.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing application root");
createRoot(container).render(
  <PreferencesStoreProvider>
    <AppThemeProvider>
      <AppRouter />
      <Toaster />
    </AppThemeProvider>
  </PreferencesStoreProvider>,
);
