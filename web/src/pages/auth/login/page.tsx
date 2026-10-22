"use client";

import { useEffect, useState } from "react";

import { AlertCircleIcon, FileCheck2Icon, FingerprintIcon, LogInIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_CONFIG } from "@/config/app-config";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { useRouter } from "@/lib/router-compat";

import { AuthChecking, type AuthPoint, AuthShell } from "../_components/auth-shell";

const POINTS: AuthPoint[] = [
  {
    icon: ShieldCheckIcon,
    title: "授权范围内测试",
    description: "只对已授权目标发起验证，范围与边界清晰可审计。",
  },
  {
    icon: FileCheck2Icon,
    title: "证据驱动",
    description: "每一次请求、响应与判定全程留证，结论可回溯。",
  },
  {
    icon: FingerprintIcon,
    title: "可复现的验证",
    description: "从发现到复现，证据链完整，避免无据结论。",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  // Set by auth.redirectToLogin() when an API call got a 401: the visitor did not
  // choose to log out, so say why the form is showing again.
  const [expired] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("expired") === "1",
  );

  useEffect(() => {
    // 已登录直接进主界面（静态导出下无 middleware 代劳这层跳转）。
    const token = auth.getToken();
    if (token) {
      // localStorage 可能仍有凭据但 cookie 已丢失。先同步，再发起全新请求，
      // 避免服务端守卫或路由缓存把跳转送回仍处于 checking 状态的登录页。
      auth.setToken(token);
      window.location.replace("/function/tasks");
      return;
    }
    api
      .authStatus()
      .then(({ initialized }) => {
        if (!initialized) router.replace("/setup");
      })
      .catch(() => setError("无法连接到后端服务"))
      .finally(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { token } = await api.login("Liora", password);
      auth.setToken(token);
      window.location.replace("/function/tasks");
    } catch {
      setError("用户名或密码错误");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <AuthChecking message="正在检查登录状态…" />;
  }

  return (
    <AuthShell
      points={POINTS}
      footnote={<p className="text-[11px] leading-5 text-muted-foreground">仅在授权范围内使用 · 所有操作全程留证</p>}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <LogInIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[18px] leading-7 font-semibold tracking-tight text-foreground">登录{APP_CONFIG.name}</h1>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {expired ? "登录状态已过期，请重新登录以继续。" : `欢迎回来，请输入密码以继续使用${APP_CONFIG.name}`}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="username">用户名</Label>
          <Input id="username" value="Liora" readOnly className="bg-muted text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            autoFocus
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        {error && (
          <p
            id="login-error"
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12px] leading-5 text-destructive"
          >
            <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{error}</span>
          </p>
        )}
        <Button type="submit" className="mt-1 w-full" disabled={loading || !password}>
          {loading ? "登录中..." : "登录"}
        </Button>
      </form>
    </AuthShell>
  );
}
