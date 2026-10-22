"use client";

import { useEffect, useState } from "react";

import { AlertCircleIcon, KeyRoundIcon, LockKeyholeIcon, ShieldCheckIcon } from "lucide-react";

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
    icon: KeyRoundIcon,
    title: "一次性初始化",
    description: "设置完成后该入口不再出现，之后从登录页进入控制台。",
  },
  {
    icon: ShieldCheckIcon,
    title: "至少 8 位",
    description: "建议混合大小写、数字与符号，避免复用其他系统的密码。",
  },
  {
    icon: LockKeyholeIcon,
    title: "仅保存在本机",
    description: "密码写入本地部署的数据库，不向外部服务同步。",
  },
];

export default function SetupPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api
      .authStatus()
      .then(({ initialized }) => {
        if (initialized) router.replace("/login");
      })
      .catch(() => setError("无法连接到后端服务"))
      .finally(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    if (password.length < 8) {
      setError("密码长度至少 8 位");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token } = await api.initPassword(password);
      auth.setToken(token);
      router.replace("/function/tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "初始化失败");
    } finally {
      setLoading(false);
    }
  }

  // Match the login page: an explicit status beats a blank screen while the
  // one-time initialization check is in flight.
  if (checking) {
    return <AuthChecking message="正在检查初始化状态…" />;
  }

  return (
    <AuthShell
      points={POINTS}
      footnote={<p className="text-[11px] leading-5 text-muted-foreground">首次使用 · 设置后自动登录并进入控制台</p>}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <KeyRoundIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] leading-7 font-semibold tracking-tight text-foreground">初始化密码</h1>
            <span className="app-chip h-5 border-primary/20 bg-primary/10 px-2 text-[11px] text-primary">
              首次初始化
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            首次使用{APP_CONFIG.name}，请为账户设置一个登录密码（至少 8 位）
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">新密码</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位"
            autoFocus
            autoComplete="new-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "setup-error" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">确认密码</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再次输入密码"
            autoComplete="new-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "setup-error" : undefined}
          />
        </div>
        {error && (
          <p
            id="setup-error"
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12px] leading-5 text-destructive"
          >
            <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{error}</span>
          </p>
        )}
        <Button type="submit" className="mt-1 w-full" disabled={loading || !password || !confirm}>
          {loading ? "保存中..." : "设置密码并登录"}
        </Button>
      </form>
    </AuthShell>
  );
}
