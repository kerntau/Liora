# 灵探 · Liora

灵探（英文名 Liora）是一款 AI 辅助自动化渗透测试平台，基于 [ARTEX](https://github.com/Autumn-27/ARTEX) 二次开发。沿用 Go、Next.js、PostgreSQL 和原项目的 AI Agent 调度架构，精简外围管理功能。

## 当前功能

- 自动化测试任务：模板、目标、运行控制、执行过程和操作约束。
- AI 配置与工具调用：模型、Agent、工具、Skills 和 MCP 配置。
- 结果查看：测试资产、探索链路、播报板、资产覆盖图、漏洞、证据与报告。
- 执行会话：主 Agent、Worker、旁路问答，以及漏洞复测和审批来源定位。
- 运行管理：拦截规则、审批记录、日志与 Token 用量统计。

主导航有 9 个入口。Agent、工具、Skills 和 MCP 配置位于“系统设置 → 高级设置”。

## 本地启动

需要 Go 1.26 或更高版本、Node.js、npm 和 PostgreSQL。参考 `config.example.json` 配置项目根目录的 `config.json`；也可通过 `ARTEX_PG_DSN` 指定连接。数据库迁移在后端启动时执行。

开发模式，分别启动两个终端：

```powershell
go run ./cmd/artex -addr 127.0.0.1:8787
```

```powershell
cd web
npm ci
$env:AUTOPENTEST_API = "http://127.0.0.1:8787"
npm run dev -- --hostname 127.0.0.1 --port 5173
```

访问 `http://127.0.0.1:5173`。首次使用设置管理员密码；已有账户继续使用原密码。固定登录账号保持为 `ARTEX`，用户菜单显示“管理员”。在“AI 配置”中配置模型后即可使用任务执行能力。

## 构建内嵌版本

在 PowerShell 中生成静态前端，再复制到空的 `server/webui/dist` 目录并编译：

```powershell
cd web
$env:NEXT_EXPORT = "1"
npm run build
cd ..
New-Item -ItemType Directory server/webui/dist -Force
Copy-Item web/out/* server/webui/dist -Recurse -Force
go build -tags embedui -o artex.exe ./cmd/artex
.\start.bat -addr 127.0.0.1:8787
```

访问 `http://127.0.0.1:8787`。重新打包时须清理旧的静态产物目录，避免旧页面残留。程序文件名、Go 模块路径、登录存储键与配置变量沿用原项目，以保持已有数据兼容。

## 清理范围与文档

通用聊天管理、独立流量列表、命令列表、LLM 录制管理、ScopeSentry 同步、工作空间文件管理、演示 Mock 与在线自更新已退出当前版本。对应代码和独立接口已清理，直接访问已删除路径返回 404。流量证据、执行记录、Token 统计和任务工作文件仍由核心模块使用。

- [项目精简说明](docs/毕业设计二次开发修改建议书.md)
- [死代码清理记录](docs/死代码清理记录.md)
- [原项目深度分析](docs/ARTEX项目深度分析.md)：记录清理前版本及原有问题。

原项目的来源、版权与适用许可继续保留。当前 Logo 使用项目根目录提供的 `logo.png`。
