
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Shield,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Cpu,
  Layers,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

export default function SetupPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api
      .authStatus()
      .then(({ initialized }) => {
        if (initialized) {
          navigate("/login", { replace: true });
        }
      })
      .catch(() => setError("无法连接到后端服务，请检查后端运行状态"))
      .finally(() => setChecking(false));
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    if (password.length < 8) {
      setError("密码长度至少需达到 8 位");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token } = await api.initPassword(password);
      auth.setToken(token);
      navigate("/function/tasks", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "初始化失败");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div
        role="status"
        className="flex min-h-dvh flex-col items-center justify-center bg-[#090d16] text-slate-400 gap-3"
      >
        <div className="relative size-10">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
        </div>
        <span className="text-xs tracking-wider font-mono text-slate-500">
          CHECKING SYSTEM INITIALIZATION…
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh w-full overflow-hidden bg-[#070a11] text-slate-200">
      {/* 背景动态氛围光与网格背景 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 size-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 size-[450px] rounded-full bg-indigo-600/10 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* 左侧：品牌展示区 */}
      <div className="relative hidden w-1/2 flex-col justify-between border-r border-slate-800/80 bg-gradient-to-b from-slate-950/60 via-slate-900/30 to-slate-950/80 p-12 lg:flex xl:p-16">
        <div className="flex items-center gap-3.5">
          <div className="relative flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/20">
            <div className="flex size-full items-center justify-center rounded-[10px] bg-slate-950">
              <img
                src={APP_CONFIG.logoIcon || APP_CONFIG.logo}
                alt="Liora"
                className="size-6 object-contain"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">
                {APP_CONFIG.name}
              </span>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
                v2.2
              </span>
            </div>
            <p className="text-xs text-slate-400">
              AI 辅助自动化渗透测试平台
            </p>
          </div>
        </div>

        <div className="my-auto space-y-8 max-w-lg">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1 text-xs text-blue-300">
              <KeyRound className="size-3.5 text-blue-400" />
              <span>初次部署 · 安全凭据初始化</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white xl:text-4xl">
              构建坚不可摧的
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
                智能渗透管控中枢
              </span>
            </h1>
            <p className="text-sm leading-relaxed text-slate-400">
              系统当前为全新部署状态，请设置专属管理员根凭据以启动全套自主 Agent 渗透引擎。
            </p>
          </div>

          <div className="grid gap-3.5">
            <div className="flex items-start gap-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 backdrop-blur-sm">
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
                <Shield className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-200">
                  管理员账号固定为 Liora
                </div>
                <div className="text-[11px] leading-normal text-slate-400">
                  初始密码设置后将自动保存至本地加密数据库并签发会话凭证。
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-6">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">
              STATUS: PENDING INITIALIZATION
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            LOCAL EMBEDDED NODE
          </div>
        </div>
      </div>

      {/* 右侧：初始化密码表单区 */}
      <div className="relative flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-7">
          <div className="flex flex-col items-center text-center lg:hidden space-y-2">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/20">
              <div className="flex size-full items-center justify-center rounded-[10px] bg-slate-950">
                <img
                  src={APP_CONFIG.logoIcon || APP_CONFIG.logo}
                  alt="Liora"
                  className="size-7 object-contain"
                />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {APP_CONFIG.name}
            </h2>
          </div>

          <div className="relative rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

            <div className="space-y-1.5 pb-6">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                初始化管理员密码
              </h2>
              <p className="text-xs text-slate-400">
                首次使用请为管理员账号（Liora）设置安全密码（至少 8 位）
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  设置新密码
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Lock className="size-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入至少 8 位密码"
                    autoFocus
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/90 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  确认新密码
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Lock className="size-4" />
                  </div>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="再次输入新密码"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/90 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-in fade-in duration-200">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="size-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>设置中…</span>
                  </>
                ) : (
                  <>
                    <span>完成设置并进入控制台</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

