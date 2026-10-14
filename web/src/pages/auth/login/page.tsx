
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
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

  if (checking) return <Stack role="status" sx={{ minHeight: "100dvh", alignItems: "center", justifyContent: "center", color: "text.secondary" }} spacing={2}><CircularProgress size={28} /><Typography variant="caption">正在初始化 Liora…</Typography></Stack>;

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", bgcolor: "background.default", color: "text.primary" }}>

      {/* 左侧：品牌与核心能力矩阵展示区 */}
      <Box sx={{ display: { xs: "none", lg: "flex" }, width: "50%", flexDirection: "column", justifyContent: "space-between", borderRight: 1, borderColor: "divider", bgcolor: "background.paper", p: { lg: 6, xl: 8 } }}>
        {/* 顶部品牌 */}
        <Stack direction="row" sx={{ alignItems: "center" }} spacing={1.75}>
          <Box sx={{ width: 44, height: 44, display: "grid", placeItems: "center", border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "action.hover" }}>
            <Box sx={{ display: "grid", placeItems: "center" }}>
              <img
                src={APP_CONFIG.logoIcon || APP_CONFIG.logo}
                alt="Liora"
                className="size-6 object-contain"
              />
            </Box>
          </Box>
          <Box>
            <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
              <Typography variant="h6" color="text.primary">
                {APP_CONFIG.name}
              </Typography>
              <Typography variant="caption" sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1, py: 0.25, color: "text.secondary" }}>
                v2.2
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              AI 辅助自动化渗透测试平台
            </Typography>
          </Box>
        </Stack>

        {/* 中间：核心理念与特性矩阵 */}
        <Box sx={{ my: "auto", maxWidth: 560 }}>
          <Stack spacing={2.5}>
            <Stack direction="row" sx={{ alignItems: "center", color: "primary.main" }} spacing={1}>
              <Sparkles size={16} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>智能驱动 · 自主规划 · 安全受控</Typography>
            </Stack>
            <Typography variant="h2" sx={{ fontSize: { lg: "2.25rem", xl: "2.75rem" } }}>
              赋能下一代自动化
              <br />
              <Box component="span" color="primary.main">
                智能渗透与安全推演
              </Box>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              集成大模型自主智能体调度、多阶段探测决策链、自适应流量拦截防护与自动化漏洞证据存证。
            </Typography>
          </Stack>

          <Stack spacing={1.25} sx={{ mt: 5 }}>
            <Feature icon={<Cpu size={18} />} title="多 Agent 自主协同架构" text="主 Agent 决策规划、Worker 精准执行，支持旁路实时协同与漏洞复测。" />
            <Feature icon={<Shield size={18} />} title="全流程主动安全护栏" text="内置操作拦截规则与实时审批通道，杜绝高危非目标破坏行为。" />
            <Feature icon={<Layers size={18} />} title="完整证据链与资产拓扑" text="从资产侦察、攻击面探索到报告生成，全生命周期可视化审计追溯。" />
          </Stack>
        </Box>

        {/* 底部系统状态 */}
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", borderTop: 1, borderColor: "divider", pt: 3 }}>
          <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "success.main" }} />
            <Typography variant="caption" color="text.secondary">
              SYSTEM ENGINE ONLINE
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            LOCAL EMBEDDED NODE
          </Typography>
        </Stack>
      </Box>

      {/* 右侧：登录控制台表单区 */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 3, sm: 5 } }}>
        <Box sx={{ width: "100%", maxWidth: 440 }}>
          {/* 移动端/窄屏下的 Logo 顶标 */}
          <Stack sx={{ display: { xs: "flex", lg: "none" }, alignItems: "center", textAlign: "center", mb: 3 }} spacing={1.5}>
            <Box sx={{ width: 48, height: 48, display: "grid", placeItems: "center", border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "action.hover" }}>
              <Box sx={{ display: "grid", placeItems: "center" }}>
                <img
                  src={APP_CONFIG.logoIcon || APP_CONFIG.logo}
                  alt="Liora"
                  className="size-7 object-contain"
                />
              </Box>
            </Box>
            <Typography variant="h5">
              {APP_CONFIG.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              AI 辅助自动化渗透测试平台
            </Typography>
          </Stack>

          {/* 表单外壳卡片 */}
          <Card variant="outlined" sx={{ p: { xs: 3, sm: 4 }, bgcolor: "background.paper" }}>

            <Stack spacing={0.75} sx={{ mb: 3.5 }}>
              <Typography variant="h5">
                控制台登录
              </Typography>
              <Typography variant="body2" color="text.secondary">
                请输入管理员密码以接入灵探管控中枢
              </Typography>
            </Stack>

            <Stack component="form" onSubmit={handleSubmit} spacing={2.25}>
              {/* 固定用户名 */}
              <Box>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>用户账号</Typography>
                  <Typography variant="caption" color="primary.main" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Shield size={13} />
                    内置系统管理员
                  </Typography>
                </Stack>
                <TextField fullWidth value="Liora" disabled slotProps={{ input: { startAdornment: <InputAdornment position="start"><User size={17} /></InputAdornment>, endAdornment: <InputAdornment position="end"><Lock size={15} /></InputAdornment> } }} />
              </Box>

              {/* 密码输入框 */}
              <TextField
                fullWidth
                label="访问密码"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入控制台密码"
                    autoFocus
                    autoComplete="current-password"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Lock size={17} /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton edge="end" size="small" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</IconButton></InputAdornment> } }}
              />

              {/* 错误提示 */}
              {error && (
                <Alert severity="error" icon={<AlertCircle size={18} />}>{error}</Alert>
              )}

              {/* 提交按钮 */}
              <Button
                fullWidth
                variant="contained"
                size="large"
                type="submit"
                disabled={loading || !password.trim()}
              >
                {loading ? (
                  <>
                    <CircularProgress size={18} color="inherit" />
                    <span>身份校验中…</span>
                  </>
                ) : (
                  <>
                    <span>进入控制台</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </Stack>

            <Divider sx={{ mt: 3, mb: 1.5 }} />
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", display: "block" }}>
                灵探渗透测试受控环境 · 仅限授权安全审计使用
            </Typography>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <Stack direction="row" spacing={1.75} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "action.hover" }}>
    <Box sx={{ display: "grid", placeItems: "center", width: 36, height: 36, flexShrink: 0, borderRadius: 1.5, color: "primary.main", bgcolor: "action.selected" }}>{icon}</Box>
    <Box><Typography variant="body2" sx={{ fontWeight: 650 }}>{title}</Typography><Typography variant="caption" color="text.secondary">{text}</Typography></Box>
  </Stack>;
}

