"use client";
import * as React from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import CircularProgress from "@mui/material/CircularProgress";

type ToastKind = "success" | "error" | "info" | "warning" | "loading";
type ToastOptions = { duration?: number; id?: string | number; description?: React.ReactNode };
type ToastEvent = ToastOptions & { id: string | number; kind: ToastKind; message: React.ReactNode };
let nextId = 1;
let events: ToastEvent[] = [];
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => events;
function publish(next: ToastEvent[]) { events = next; listeners.forEach((listener) => listener()); }
function emit(kind: ToastKind, message: React.ReactNode, options?: ToastOptions) {
  const event: ToastEvent = { ...options, id: options?.id ?? nextId++, kind, message };
  // A single MUI Snackbar is rendered below. Keep only the newest event so an
  // earlier success toast cannot sit in front of a later actionable error.
  publish([event]);
  return event.id;
}
function dismiss(id?: string | number) { publish(id === undefined ? [] : events.filter((event) => event.id !== id)); }
export const toast = {
  success: (message: React.ReactNode, options?: ToastOptions) => emit("success", message, options),
  error: (message: React.ReactNode, options?: ToastOptions) => emit("error", message, options),
  info: (message: React.ReactNode, options?: ToastOptions) => emit("info", message, options),
  warning: (message: React.ReactNode, options?: ToastOptions) => emit("warning", message, options),
  loading: (message: React.ReactNode, options?: ToastOptions) => emit("loading", message, options),
  dismiss,
};
export function Toaster() {
  const current = React.useSyncExternalStore(subscribe, snapshot, snapshot)[0];
  if (!current) return null;
  const close = () => dismiss(current.id);
  return <Snackbar key={current.id} open autoHideDuration={current.kind === "loading" || current.duration === Infinity ? null : current.duration ?? 4000}
    onClose={(_, reason) => { if (reason !== "clickaway") close(); }} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
    <Alert severity={current.kind === "loading" ? "info" : current.kind} role={current.kind === "error" ? "alert" : "status"}
      icon={current.kind === "loading" ? <CircularProgress color="inherit" size={20} /> : undefined}
      variant="filled" onClose={close} closeText="关闭通知" sx={{ minWidth: { xs: 0, sm: 280 }, maxWidth: "100%", overflowWrap: "anywhere" }}>
      {current.description ? <><AlertTitle>{current.message}</AlertTitle>{current.description}</> : current.message}
    </Alert>
  </Snackbar>;
}

