# 「理想的自己」— 开发约定

## 1. 项目一句话

用户完成 5 步自我画像后，与"五年后的自己"对话；合上笔记本生成洞察卡片，反复出现的模式沉淀成模式地图。产品核心不是聊天，而是**让无意识的重复变得可见**。

## 2. 三条铁律（动代码前必读）

1. **不存聊天原文。** 用户与 AI 的对话只留在浏览器 localStorage；后端只收匿名行为事件。隐私是产品底线。
2. **后端只用根目录 `_worker.js`。** 不要新建 `functions/` 目录（实测两次不被 Cloudflare 识别）。部署目录是 `app/`，`_worker.js` 必须在 `app/` 根部。
3. **改完必须部署并验证。** "文件改了"不等于"线上生效"；部署后必须跑验证清单。

## 3. 目录与命令

```
app/index.html       前端全部逻辑（约 5400 行，单文件）
app/_worker.js       后端全部逻辑（约 240 行）
docs/                产品文档、交接手册、决策记录
docs/adr/            架构决策
.github/workflows/   GitHub Actions 自动部署
```

```bash
npm install
npm run dev        # wrangler pages dev app --port 8788
npm run deploy     # 手动部署到 Cloudflare Pages
```

## 4. 技术栈

- 前端：单文件 HTML + CSS + 原生 JS，零构建；
- 后端：Cloudflare Pages `_worker.js` 高级模式，同域名 `/api/*`；
- 数据库：Supabase（项目 `bzwhzhvcwbaklpxneqli`），REST 调用；
- AI：DeepSeek `deepseek-chat`，`temperature 0.7`，`max_tokens 1000`；
- 密钥：只存在 Cloudflare 环境变量和本地 `.dev.vars`，绝不进前端/仓库。

## 5. 关键函数地图（按名字定位，不要只记行号）

| 模块 | 函数 |
|---|---|
| API | `initSession` / `trackEvent` / `chatWithAI` |
| 引导 | `showOnboarding` / `nextStep` / `selectAnimal` / `completeOnboarding` / `editProfile` |
| 对话 | `sendMessage` / `buildMemoryContext` / `recallFromHistory` / `startNewConversation` |
| 收尾 | `closeDiary` / `finalizeConversation` / `detectPatternWithAI` / `showInsightCard` |
| 留存 | `handlePostInsight` / `showRetentionFeedback` / `submitRetentionFeedback` |
| 模式 | `loadPatternList` / `openPatternDetail` / `generateAndCacheReflection` |
| 日记 | `loadDiaryList` / `viewConversation` / `handleDraftOnStartup` / `autoSaveCurrentConversation` |
| 画像 | `generateSystemPrompt` / `generateIdealStateDescription` / `generatePainPointSection` |

## 6. 埋点口径（19 个）

- 核心漏斗 13：`page_loaded`、`step3_complete`、`step4_complete`、`step5_complete`、`onboarding_complete`、`first_message_sent`、`message_sent`、`diary_closed`、`insight_card_shown`、`retention_feedback_shown`、`retention_feedback_submitted`、`pattern_map_opened`、`pattern_detail_viewed`
- 参与度 4：`ai_response_copied`、`history_viewed`、`page_shared`、`page_leave`
- 反馈与质量 2：`feedback_submitted`、`network_error`

命名：`名词_动词过去式`，参数 camelCase。旧事件名必须删干净，不要新旧并存。

**易错点：**

- `diary_closed` 的 `userTurns` 必须在 `clearCurrentConversation()` 之前取；
- `insight_card_shown` 有 4 种 `cardType`：`ideal_scene` / `ai_insight` / `highlight` / `encouragement`；
- `page_leave` 用 `sendBeacon` 或 `fetch keepalive`，并监听 `pagehide` / `visibilitychange`；
- `first_message_sent` 只在 AI 回复成功后报一次。

## 7. 隐私边界

| 可以上报 | 不可以上报 |
|---|---|
| 事件名、轮次、卡片类型、模式名 | 聊天原文 |
| 用户主动提交的 `feedbackContent` / `feedbackText` | 昵称、画像原文 |
| 页面停留时长 | 原始 IP / UA（历史已存，本轮不改） |

## 8. 部署验证（每次上线必跑）

1. `curl https://ideal-self-chat.pages.dev/api` 返回 JSON；
2. Dashboard 最新部署是 Production，Functions 能看到 `_worker.js`；
3. 电脑 + 手机（不挂代理）各发一条消息，能收到回复；
4. Supabase 查最近 15 分钟 events，事件名和参数正确；
5. 隐私 marker：聊天发一个唯一字符串，确认 `feedbacks` 无新增、`events` 无该字符串。

## 9. 当前已知缺口 / 技术债

- 历史 `feedbacks` 表仍含聊天原文（2026-11-21 决定保留，不再新增）；
- `sessions.source` 字段尚未建立，本轮继续用 `channel`；
- 单文件 `index.html` 约 5400 行，难测试、难合并；是否拆分见 `docs/adr/0001-single-file-zero-build.md`；
- 数据复盘挂起，见 README「数据复盘」；
- 现有 Pages 项目是 Direct Upload，不能后接 Git integration，部署走 GitHub Actions。

## 10. 工作约定

- 改代码前先按函数名搜索，确认调用关系；单文件很大，盲改必错；
- 交付物是可直接部署的 `app/` 文件夹，不是代码片段；
- 中文文案：第二人称、短句、不评判、不说教；
- 提交用中文，按功能分次；不要提交 `.dev.vars`、密钥、备份文件。
