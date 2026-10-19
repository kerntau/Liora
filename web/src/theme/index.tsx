import { useMemo, type ReactNode } from "react";
import GlobalStyles from "@mui/material/GlobalStyles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { createTheme, StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

// Keep the existing CSS tokens as the single source of truth. Presets and font
// changes then reach both Material UI components and the specialized graph/chat UI.
function buildTheme(mode: "light" | "dark", reducedMotion: boolean) {
  return createTheme({
    cssVariables: { nativeColor: true },
    palette: {
      mode,
      primary: {
        main: "var(--primary)", light: "var(--primary)", dark: "var(--primary)",
        contrastText: "var(--primary-foreground)",
      },
      secondary: {
        main: "var(--secondary)", light: "var(--secondary)", dark: "var(--secondary)",
        contrastText: "var(--secondary-foreground)",
      },
      error: {
        main: "var(--destructive)", light: "var(--destructive)", dark: "var(--destructive)",
        contrastText: "var(--background)",
      },
      background: { default: "var(--background)", paper: "var(--card)" },
      text: { primary: "var(--foreground)", secondary: "var(--muted-foreground)" },
      divider: "var(--border)",
    },
    typography: {
      fontFamily: "var(--font-sans), system-ui, sans-serif",
      fontSize: 14,
      button: { textTransform: "none", fontWeight: 500, letterSpacing: "normal" },
    },
    // Match the existing Tailwind breakpoints so desktop/mobile settings agree.
    breakpoints: { values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 } },
    zIndex: { appBar: 40, drawer: 50, modal: 50, snackbar: 80, tooltip: 60 },
    ...(reducedMotion ? { transitions: {
      duration: { shortest: 0, shorter: 0, short: 0, standard: 0, complex: 0, enteringScreen: 0, leavingScreen: 0 },
      getAutoHeightDuration: () => 0,
    } } : {}),
    components: {
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { minWidth: 0, lineHeight: "inherit" } },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiCardContent: { styleOverrides: { root: { padding: 0, "&:last-child": { paddingBottom: 0 } } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: 0, fontSize: "inherit", lineHeight: "inherit", color: "inherit", padding: 0 },
          head: { fontWeight: 500 },
        },
      },
      MuiFormLabel: { styleOverrides: { root: { color: "inherit", "&.Mui-focused": { color: "inherit" } } } },
    },
  });
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const mode = usePreferencesStore((state) => state.resolvedThemeMode);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const theme = useMemo(() => buildTheme(mode, reducedMotion), [mode, reducedMotion]);
  return (
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
