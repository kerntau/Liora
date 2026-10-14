
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Shield,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Cpu,
  Layers,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api
      .authStatus()
      .then(({ initialized }) => {
        if (!initialized) {
          navigate("/setup", { replace: true });
        }
      })
      .catch(() => setError("无法连接到后端服务，请检查后端运行状态"))
      .finally(() => setChecking(false));
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { token } = await api.login("Liora", password);
      auth.setToken(token);
      navigate("/function/tasks", { replace: true });
    } catch {
      setError("密码错误或身份验证失败，请重新输入");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div
        role="status"
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0f1724] text-slate-400"
      >
        <div className="relative size-10">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
        </div>
        <span className="text-xs tracking-wider font-mono text-slate-500">
          INITIALIZING LIORA SYSTEM…
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh w-full overflow-hidden bg-[#0f1724] text-slate-200">

      {/* 左侧：品牌与核心能力矩阵展示区 */}
      <div className="relative hidden w-1/2 flex-col justify-between border-r border-slate-800 bg-[#111b2b] p-12 lg:flex xl:p-16">
        {/* 顶部品牌 */}
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-lg border border-slate-700 bg-[#172338]">
            <div className="flex size-full items-center justify-center rounded-lg">
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
              <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                v2.2
              </span>
            </div>
            <p className="text-xs text-slate-400">
              AI 辅助自动化渗透测试平台
            </p>
          </div>
        </div>

        {/* 中间：核心理念与特性矩阵 */}
        <div className="my-auto space-y-8 max-w-lg">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
              <Sparkles className="size-3.5" />
              <span>智能驱动 · 自主规划 · 安全受控</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white xl:text-4xl">
              赋能下一代自动化
              <br />
              <span className="text-blue-400">
                智能渗透与安全推演
              </span>
            </h1>
            <p className="text-sm leading-relaxed text-slate-400">
              集成大模型自主智能体调度、多阶段探测决策链、自适应流量拦截防护与自动化漏洞证据存证。
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-start gap-3.5 rounded-lg border border-slate-800 bg-[#172338] p-4 transition-colors hover:border-slate-700">
              <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-2 text-blue-400">
                <Cpu className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-200">
                  多 Agent 自主协同架构
                </div>
                <div className="text-[11px] leading-normal text-slate-400">
                  主 Agent 决策规划、Worker 精准执行，支持旁路实时协同与漏洞复测。
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-lg border border-slate-800 bg-[#172338] p-4 transition-colors hover:border-slate-700">
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400">
                <Shield className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-200">
                  全流程主动安全护栏
                </div>
                <div className="text-[11px] leading-normal text-slate-400">
                  内置操作拦截规则与实时审批通道，杜绝高危非目标破坏行为。
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-lg border border-slate-800 bg-[#172338] p-4 transition-colors hover:border-slate-700">
              <div className="rounded-md border border-indigo-500/20 bg-indigo-500/10 p-2 text-indigo-400">
                <Layers className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-200">
                  完整证据链与资产拓扑
                </div>
                <div className="text-[11px] leading-normal text-slate-400">
                  从资产侦察、攻击面探索到报告生成，全生命周期可视化审计追溯。
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部系统状态 */}
        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-6">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-emerald-500">
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              SYSTEM ENGINE ONLINE
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            LOCAL EMBEDDED NODE
          </div>
        </div>
      </div>

      {/* 右侧：登录控制台表单区 */}
      <div className="relative flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-7">
          {/* 移动端/窄屏下的 Logo 顶标 */}
          <div className="flex flex-col items-center text-center lg:hidden space-y-2">
            <div className="flex size-12 items-center justify-center rounded-lg border border-slate-700 bg-[#172338]">
              <div className="flex size-full items-center justify-center rounded-lg">
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
            <p className="text-xs text-slate-400">
              AI 辅助自动化渗透测试平台
            </p>
          </div>

          {/* 表单外壳卡片 */}
          <div className="relative rounded-xl border border-slate-700 bg-[#172338] p-7 shadow-xl shadow-black/20 sm:p-8">

            <div className="space-y-1.5 pb-6">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                控制台登录
              </h2>
              <p className="text-xs text-slate-400">
                请输入管理员密码以接入灵探管控中枢
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 固定用户名 */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>用户账号</span>
                  <span className="flex items-center gap-1 text-[11px] font-mono text-blue-400/90">
                    <Shield className="size-3" />
                    内置系统管理员
                  </span>
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <User className="size-4" />
                  </div>
                  <input
                    type="text"
                    readOnly
                    value="Liora"
                    className="w-full rounded-lg border border-slate-700 bg-[#101927] py-2.5 pl-10 pr-4 font-mono text-sm font-semibold text-slate-200 outline-none select-none cursor-not-allowed transition-colors"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 text-xs">
                    <Lock className="size-3.5" />
                  </div>
                </div>
              </div>

              {/* 密码输入框 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  访问密码
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Lock className="size-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入控制台密码"
                    autoFocus
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-600 bg-[#101927] py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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

              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-in fade-in duration-200">
                  <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="group relative flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-950/30 transition-colors hover:bg-blue-500 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="size-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>身份校验中…</span>
                  </>
                ) : (
                  <>
                    <span>进入控制台</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
              <p className="text-[11px] text-slate-500">
                灵探渗透测试受控环境 · 仅限授权安全审计使用
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

