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
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, Shield } from "lucide-react";
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

  useEffect(() => { api.authStatus().then(({ initialized }) => { if (initialized) navigate("/login", { replace: true }); }).catch(() => setError("无法连接到后端服务，请检查后端运行状态")).finally(() => setChecking(false)); }, [navigate]);
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError("两次输入的密码不一致"); return; }
    if (password.length < 8) { setError("密码长度至少需达到 8 位"); return; }
    setLoading(true); setError("");
    try { const { token } = await api.initPassword(password); auth.setToken(token); navigate("/function/tasks", { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : "初始化失败"); }
    finally { setLoading(false); }
  }
  if (checking) return <Stack role="status" sx={{ minHeight: "100dvh", alignItems: "center", justifyContent: "center", color: "text.secondary" }} spacing={2}><CircularProgress size={28} /><Typography variant="caption">正在检查系统初始化状态…</Typography></Stack>;
  return <Box sx={{ minHeight: "100dvh", display: "flex", bgcolor: "background.default", color: "text.primary" }}>
    <Box sx={{ display: { xs: "none", lg: "flex" }, width: "50%", flexDirection: "column", justifyContent: "space-between", borderRight: 1, borderColor: "divider", bgcolor: "background.paper", p: { lg: 6, xl: 8 } }}>
      <Stack direction="row" sx={{ alignItems: "center" }} spacing={1.75}>
        <Box sx={{ width: 44, height: 44, display: "grid", placeItems: "center", border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "action.hover" }}><img src={APP_CONFIG.logoIcon || APP_CONFIG.logo} alt="Liora" width={25} height={25} /></Box>
        <Box><Typography variant="h6">{APP_CONFIG.name}</Typography><Typography variant="caption" color="text.secondary">AI 辅助自动化渗透测试平台</Typography></Box>
      </Stack>
      <Box sx={{ my: "auto", maxWidth: 560 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" sx={{ alignItems: "center", color: "primary.main" }} spacing={1}><KeyRound size={16} /><Typography variant="caption" sx={{ fontWeight: 600 }}>初次部署 · 安全凭据初始化</Typography></Stack>
          <Typography variant="h2" sx={{ fontSize: { lg: "2.25rem", xl: "2.75rem" } }}>构建坚不可摧的<br /><Box component="span" color="primary.main">智能渗透管控中枢</Box></Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>系统当前为全新部署状态，请设置专属管理员根凭据以启动全套自主 Agent 渗透引擎。</Typography>
        </Stack>
        <Stack direction="row" spacing={1.75} sx={{ mt: 5, p: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "action.hover" }}><Box sx={{ display: "grid", placeItems: "center", width: 36, height: 36, flexShrink: 0, borderRadius: 1.5, color: "primary.main", bgcolor: "action.selected" }}><Shield size={18} /></Box><Box><Typography variant="body2" sx={{ fontWeight: 650 }}>管理员账号固定为 Liora</Typography><Typography variant="caption" color="text.secondary">初始密码设置后将保存至本地加密数据库并签发会话凭证。</Typography></Box></Stack>
      </Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", borderTop: 1, borderColor: "divider", pt: 3 }}><Typography variant="caption" color="text.secondary">STATUS: PENDING INITIALIZATION</Typography><Typography variant="caption" color="text.secondary">LOCAL EMBEDDED NODE</Typography></Stack>
    </Box>
    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 3, sm: 5 } }}>
      <Box sx={{ width: "100%", maxWidth: 440 }}>
        <Stack sx={{ display: { xs: "flex", lg: "none" }, alignItems: "center", textAlign: "center", mb: 3 }} spacing={1.5}><img src={APP_CONFIG.logoIcon || APP_CONFIG.logo} alt="Liora" width={48} height={48} /><Typography variant="h5">{APP_CONFIG.name}</Typography></Stack>
        <Card variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={0.75} sx={{ mb: 3.5 }}><Typography variant="h5">初始化管理员密码</Typography><Typography variant="body2" color="text.secondary">首次使用请为管理员账号（Liora）设置安全密码（至少 8 位）</Typography></Stack>
          <Stack component="form" onSubmit={handleSubmit} spacing={2.25}>
            <TextField fullWidth label="设置新密码" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入至少 8 位密码" autoFocus autoComplete="new-password" slotProps={{ input: { startAdornment: <InputAdornment position="start"><Lock size={17} /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton edge="end" size="small" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</IconButton></InputAdornment> } }} />
            <TextField fullWidth label="确认新密码" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="再次输入新密码" autoComplete="new-password" slotProps={{ input: { startAdornment: <InputAdornment position="start"><Lock size={17} /></InputAdornment> } }} />
            {error && <Alert severity="error" icon={<AlertCircle size={18} />}>{error}</Alert>}
            <Button fullWidth variant="contained" size="large" type="submit" disabled={loading || !password || !confirm}>{loading ? <><CircularProgress size={18} color="inherit" />设置中…</> : <>完成设置并进入控制台</>}</Button>
          </Stack>
          <Divider sx={{ mt: 3, mb: 1.5 }} /><Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", display: "block" }}>密码仅用于本地管理员认证</Typography>
        </Card>
      </Box>
    </Box>
  </Box>;
}
