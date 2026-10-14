import { useMemo, type ReactNode } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

const fontStack = 'var(--font-geist), "DM Sans", Inter, system-ui, sans-serif';

function buildTheme(mode: "light" | "dark") {
  const dark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? "#7aa2f7" : "#246bce", light: "#5b91e8", dark: "#174f9f" },
      secondary: { main: dark ? "#8b9bb4" : "#63738a" },
      background: {
        default: dark ? "#101722" : "#f5f7fa",
        paper: dark ? "#192332" : "#ffffff",
      },
      divider: dark ? "rgba(151, 169, 192, 0.16)" : "rgba(34, 53, 79, 0.12)",
      text: {
        primary: dark ? "#e6edf6" : "#1b2738",
        secondary: dark ? "#9cabc0" : "#63738a",
      },
      success: { main: dark ? "#47b881" : "#16845b" },
      warning: { main: dark ? "#e5a642" : "#a76508" },
      error: { main: dark ? "#ed7474" : "#c83e4d" },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: fontStack,
      h1: { fontWeight: 700, letterSpacing: "-0.035em" },
      h2: { fontWeight: 700, letterSpacing: "-0.03em" },
      h3: { fontWeight: 650, letterSpacing: "-0.025em" },
      h4: { fontWeight: 650, letterSpacing: "-0.02em" },
      h5: { fontWeight: 600, letterSpacing: "-0.015em" },
      h6: { fontWeight: 600 },
      button: { fontWeight: 600, textTransform: "none" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { minHeight: "100vh", backgroundColor: dark ? "#101722" : "#f5f7fa" },
          "#root": { minHeight: "100vh" },
          "*": { boxSizing: "border-box" },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: 36, borderRadius: 8, paddingInline: 14 },
          contained: { boxShadow: "none" },
        },
      },
      MuiPaper: {
        styleOverrides: {
          rounded: { borderRadius: 12 },
          elevation1: { boxShadow: dark ? "0 2px 12px rgba(0,0,0,.18)" : "0 2px 12px rgba(24,39,61,.05)" },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiDialog: {
        styleOverrides: { paper: { border: `1px solid ${dark ? "rgba(151,169,192,.16)" : "rgba(34,53,79,.10)"}` } },
      },
    },
  });
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const mode = usePreferencesStore((state) => state.resolvedThemeMode);
  const theme = useMemo(() => buildTheme(mode), [mode]);
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
