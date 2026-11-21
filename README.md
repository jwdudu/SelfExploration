# 理想的自己

一个 AI 陪伴式自我对话产品：完成 5 步自我画像后，与"五年后的自己"对话；每次合上笔记本生成洞察卡片，反复出现的模式沉淀成模式地图。

- 线上地址：<https://ideal-self-chat.pages.dev>
- 健康检查：<https://ideal-self-chat.pages.dev/api>

## 架构

```
浏览器（手机 / 电脑）
  │  index.html：全部前端逻辑，对话/画像/模式只存 localStorage
  │
  ├─ POST /api/session/init   → 建会话
  ├─ POST /api/event          → 上报匿名行为事件
  └─ POST /api/chat           → 调 AI，拿回复
        │
Cloudflare Pages 项目 ideal-self-chat
  ├─ app/index.html           → 静态页面
  └─ app/_worker.js           → 同域名后端（Pages 高级模式）
        ├─ Supabase REST      → sessions / events / feedbacks
        └─ DeepSeek API       → deepseek-chat
```

**关键约束：** `_worker.js` 必须在部署目录根部；不要新建 `functions/` 目录（实测两次不被识别）。部署目录是 `app/`，不是仓库根目录。

## 隐私边界

| 数据 | 是否离开设备 | 说明 |
|---|---|---|
| 与 AI 的聊天原文 | ❌ 不落库 | 只存浏览器 localStorage；调用 AI 时本轮消息会发给模型服务商 |
| 画像 / 昵称 / 痛点 | ❌ 不落库 | 只在本地，用于生成提示词 |
| 匿名行为事件 | ✅ 上报 | events 表，如 `diary_closed`、`card_count` 等 |
| 用户主动提交的反馈 | ✅ 上报 | 用户点"发送"后提交，属于授权数据 |

> ⚠️ 历史遗留：Supabase 的 `feedbacks` 表里仍保留产品早期写入的聊天原文（按 2026-11-21 的决定保留，不再新增）。对外不要承诺"从未存储过聊天内容"。

## 目录

```
app/                      部署包（只放 index.html + _worker.js）
docs/                     产品文档、交接手册、决策记录
docs/adr/                 架构决策记录
.github/workflows/        GitHub Actions 自动部署
```

## 本地开发

```bash
npm install
npm run dev          # http://127.0.0.1:8788
curl http://127.0.0.1:8788/api
```

### 为什么直接双击 index.html 会报 `Failed to fetch`？

`API_BASE = ""` 表示请求同域名的 `/api/*`。用 `file://` 打开时，请求会变成 `file:///api/chat`，本地没有这个接口，浏览器必然报错。**必须同时启动后端**：

- 本地：`npm run dev`（wrangler 会同时运行页面和 `_worker.js`）；
- 线上：直接打开 <https://ideal-self-chat.pages.dev>。

### 两种本地模式

1. **Mock 模式（无需密钥）**：把 `.dev.vars.example` 复制为 `.dev.vars`，设置 `MOCK_MODE="1"`。可完整走 onboarding、聊天、合上笔记本、洞察卡片、模式地图，终端会打印每个埋点。
2. **真实模式**：在 `.dev.vars` 填入真实密钥，设置 `MOCK_MODE="0"`。需要本机能访问 Supabase 和 DeepSeek。

`.dev.vars` 已被 git 忽略，**绝不能提交**。

## 环境变量

在 Cloudflare Pages 项目 → Settings → Variables and secrets → Production 配置：

| 名称 | 用途 | 加密 |
|---|---|---|
| `SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `SUPABASE_SERVICE_KEY` | service_role key | ✅ |
| `AI_API_KEY` | DeepSeek key | ✅ |

生产环境不要设置 `MOCK_MODE`。

## 部署

### 自动部署（推荐）

推送到 GitHub `main` 分支 → GitHub Actions 自动执行 `wrangler pages deploy app` → 线上更新。

需要在 GitHub 仓库 Settings → Secrets and variables → Actions 配置：

- `CLOUDFLARE_API_TOKEN`：Cloudflare API Token，权限 `Account → Cloudflare Pages → Edit`
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账号 ID

> 现有 Pages 项目是 Direct Upload 创建的。Cloudflare 官方明确：Direct Upload 项目**不能**之后切换成 Git integration，所以这里用 Actions 部署到现有项目，保住已验证可用的域名。

### 手动部署（兜底）

Cloudflare 后台 → Pages 项目 → Create deployment → 上传 `app/` 文件夹内容 → Deploy。只上传 `index.html` 和 `_worker.js`。

### 验证

```bash
curl https://ideal-self-chat.pages.dev/api
# 期望：{"code":0,"message":"服务运行正常","data":null}
```

- Dashboard 最新部署应标记为 **Production**，否则主域名不更新；
- Functions 标签应能看到 `_worker.js`；
- 手机蜂窝网络、不挂代理能正常收发消息。

## 回滚

- 线上：Cloudflare → Pages → Deployments → 选上一个正常版本 → Rollback；
- 代码：`git revert <commit>` 后推送；
- Dashboard 回滚不回滚环境变量和数据库数据。

## 双远程

沿用同工作区「日常记账」项目的习惯：

```bash
git remote add origin https://github.com/jwdudu/ideal-self-chat.git
git remote add gitee  git@gitee.com:jwdudu/ideal-self-chat.git
git push origin main && git push gitee main
```

> 只有 GitHub 的 push 会触发自动部署；Gitee 仅作备份。

## 常见故障

| 现象 | 根因 | 处理 |
|---|---|---|
| `Failed to fetch` | 直接 `file://` 打开，或后端未启动 | 用 `npm run dev` 或线上域名 |
| `/api` 返回 HTML | 部署目录写错，`_worker.js` 不在根部 | 确认部署的是 `app/` |
| 埋点没数据 | `sessionId` 为空 / 环境变量缺失 | 看 `/api/session/init` 返回，查 localStorage |
| 改了代码线上没变 | 没部署，或部署成了 Preview | 看 Actions 结果和 Dashboard 部署标记 |
| AI 一直转圈 | DeepSeek 额度/限流 | 查 Cloudflare 日志和 DeepSeek 余额 |

## 数据复盘（Backlog）

展览期是小范围试点，数据量小。等修复版跑一段时间后再复盘，使用 `docs/理想的自己-项目交接与迭代手册.md` 第 5.5 节的漏斗 SQL；分析时按部署时间截断，不要把旧事件名和新事件名相加。
