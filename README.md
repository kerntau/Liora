# Liora · 灵探

Liora（中文名：灵探）是一款 AI 辅助自动化渗透测试平台，使用 **Go、SQLite、React 19 和 Rsbuild**。前端通过 React Router 导航，生产版本直接内嵌在 Go 程序中，无需 Node.js 运行时。

## 当前功能

- 自动化测试任务：模板、目标、运行控制、执行过程和操作约束。
- AI 配置与工具调用：模型、Agent、工具、Skills 和 MCP 配置。
- 结果查看：测试资产、探索链路、播报板、资产覆盖图、漏洞、证据与报告。
- 执行会话：主 Agent、Worker、旁路问答，以及漏洞复测和审批来源定位。
- 运行管理：拦截规则、审批记录、日志与 Token 用量统计。

主导航有 9 个入口。Agent、工具、Skills 和 MCP 配置位于“系统设置 → 高级设置”。

## 本地开发

需要 Go 1.26.3+、Node.js 22.12+ 和 npm。后端默认创建 `data/liora.db`，无需 PostgreSQL。可在 `config.json` 的 `database.path` 或环境变量 `LIORA_SQLITE_PATH` 中指定数据库文件。

Windows 可以在项目根目录一键启动前后端（也可直接双击 `dev.bat`）：

```powershell
.\dev.bat
```

启动后访问 `http://127.0.0.1:5173`。首次运行会安装缺失的前端依赖；按 `Ctrl+C` 停止本次启动的服务。日志保存在 `.runtime.local/dev`。已启动的服务会继续复用。

分别启动两个终端：

```powershell
go run ./cmd/liora -addr 127.0.0.1:8787
```

```powershell
cd web
npm ci
$env:LIORA_API = "http://127.0.0.1:8787"
npm run dev
```

访问 `http://127.0.0.1:5173`。账号固定为 **Liora**，首次使用设置管理员密码。已有数据库继续使用原密码；旧登录状态不会迁移，需要重新登录。在“AI 配置”中配置模型后即可使用任务执行能力。

开发代理将 `/api`（含 SSE 实时事件）转发到 `LIORA_API`。生产版本使用同源 API，无需开放额外的 SSE 端口。确需独立 SSE 服务时，在构建前设置 `PUBLIC_LIORA_SSE_BASE`。前端环境变量示例见 `web/.env.example`；仅 `PUBLIC_LIORA_*` 会暴露给浏览器。

## 构建内嵌版本

```powershell
cd web
npm ci
npm run build:embed
cd ..
go build -tags embedui -o liora.exe ./cmd/liora
.\start.bat -addr 127.0.0.1:8787
```

访问 `http://127.0.0.1:8787`。`build:embed` 会构建 `web/dist`，清理并同步生成资源到 `server/webui/dist`，避免旧页面残留。Linux/macOS 使用 `./build.sh` 和 `./start.sh`；交叉编译和打包参数统一使用 `LIORA_*`，详见 `build.sh`。

前端入口、路由与页面分别位于 `web/src/main.tsx`、`web/src/router.tsx` 和 `web/src/pages`。`web/src/routes.json` 是 React Router 与 Go 内嵌服务器共用的路由清单：新增页面需注册路由并更新清单。详情 URL 和查询参数保持不变；未知页面、已移除路径和缺失资源返回 404。

`npm start` 用于本地预览前端构建，仍需启动 Go API；正式部署推荐内嵌程序。使用其他静态服务器时，仅为路由清单中的页面配置入口回退，并把 `/api` 转发到 Go。

## 配置与数据

| 配置 | 用途 |
| --- | --- |
| `LIORA_CONFIG` | 指定配置文件 |
| `LIORA_SQLITE_PATH` | SQLite 业务数据库路径 |
| `LIORA_SKILL_DIR` | Skills 目录 |
| `LIORA_LLM_PROVIDER` / `LIORA_LLM_MODEL` | 默认模型供应商与模型 |
| `LIORA_LLM_BASE_URL` / `LIORA_LLM_PROXY` | 模型接口地址与代理 |
| `LIORA_LLM_STREAM` | 默认流式调用开关 |
| `LIORA_BTW_MAX_OUTPUT_TOKENS` | 旁路问答输出上限 |
| `-data` | 任务数据目录 |
| `-key-dir` | JWT 签名密钥目录，默认在可执行文件旁 |

旧品牌的环境变量、账号别名、Cookie 与浏览器偏好键不再读取。业务数据库、历史对话、报告、证据及密码哈希不做批量替换。模型供应商的标准变量 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY` 保持不变。Go 程序不会自动加载 `.env`，本地运行请显式设置环境变量或配置文件。

忘记密码时，在 Bash 中运行 `./reset-password.sh`；Docker 部署使用 `./reset-password.sh --docker`。脚本读取两次隐藏输入，经标准输入调用 `liora -reset-password`，仅修改已有 SQLite 数据库的管理员密码，不会创建空数据库。Windows 可使用 Git Bash；也可直接向 `liora.exe -reset-password` 的标准输入提供新密码。

## Docker 与发布

Dockerfile 使用预编译 Linux 程序：

```bash
LIORA_TARGET_OS=linux LIORA_TARGET_ARCH=amd64 LIORA_OUTPUT=dist/amd64/liora ./build.sh
docker compose up --build -d
```

Compose 默认构建 `liora:local`，通过 `LIORA_IMAGE` 可指定镜像。业务数据库挂载 `./data`，JWT 密钥通过独立 `liora_auth` 卷持久化；现有本地密码随 `data/liora.db` 保留，切换部署后重新登录即可。备份时同时保存业务数据与签名密钥。

CI 构建前端和多平台 Liora 发布包。仅当仓库变量 `LIORA_IMAGE` 配置了目标镜像地址时才推送 Docker 镜像，并使用 `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` secrets 登录。

## 验证

```powershell
go test ./...
cd web
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
cd ..
go test -tags embedui ./server
```

浏览器回归同时覆盖 Rsbuild 开发代理和 Go 内嵌部署，使用临时数据库、独立端口 15173/18787，不接触业务数据。失败时保留 trace；页面截图位于 `web/test-results`。

## 项目来源与历史资料

本项目基于 [ARTEX](https://github.com/Autumn-27/ARTEX) 二次开发，保留原项目来源、版权与适用许可；`CHANGELOG.md` 与标记为历史的验证资料记录当时实现，不代表当前技术栈。字体使用 Geist，字体文件及原始授权位于 `web/src/assets/fonts`。当前 Logo 沿用项目提供的 Liora 素材。

通用聊天管理、独立流量列表、命令列表、LLM 录制管理、ScopeSentry 同步、工作空间文件管理、演示 Mock 与在线自更新已退出当前版本。流量证据、执行记录、Token 统计和任务工作文件仍由核心模块使用。

- [项目精简说明](docs/毕业设计二次开发修改建议书.md)
- [死代码清理记录](docs/死代码清理记录.md)
- [原项目深度分析](docs/ARTEX项目深度分析.md)：历史版本资料。
