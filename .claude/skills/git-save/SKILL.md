---
name: git-save
description: This skill should be used when the user asks to "存档", "提交", "保存到git", "推送到远程", "推送到gitee", "推送到github", "git存档", "git保存", "commit", "push", or wants to save the current work as a git commit and push it to the remote servers. 教 Claude 把当前改动提交,并推送到 gitee 和 github 两个远程仓库。
---

# Git 存档并推送(git-save)

## 用途

把当前项目的改动:①提交(存档)到 git;②推送到远程仓库(当前项目是 gitee + github 两个,分别对应 `gitee` 和 `origin`)。

## 步骤

### 第 1 步:确认仓库和改动

- 在当前项目目录(有 `.git` 的地方)执行 `git status`,看有哪些改动(新增/修改/删除)。
- 执行 `git remote -v` 看远程仓库有哪些(当前项目:`gitee` + `origin`=github)。
- 如果 `git status` 是干净的(没有改动),直接告诉用户「没有需要保存的改动」,不用提交。

### 第 2 步:写提交说明

- 先问用户「这次改了什么」,用一句话概括(例如「新增小游戏」「修复统计页」)。
- 用户说「随便 / 你看着写」时,根据 `git diff --stat` 的改动文件自己总结一句。
- 提交说明要求:简洁、动词开头,如 `新增XX功能`、`修复XX问题`、`调整XX`。

### 第 3 步:询问是否更新版本号(可选)

提交前,问用户一句:「这次要不要**一起更新版本号**?」(有的功能想留个新版本号,有的只是小改、不想动版本号)

- 用户说「**不更新**」→ 跳过本步,直接进入第 4 步提交。
- 用户说「**更新**」→ 解释版本号三段各自的含义,让用户选(或直接说一个数字):

| 改哪一段 | 什么时候用 | 例子 |
|---|---|---|
| 修订号(最后一段) | 修小 bug、小调整 | 0.3.0 → 0.3.1 |
| 次版本号(中间) | 加了新功能 | 0.3.0 → 0.4.0 |
| 主版本号(最前) | 大改动、不兼容旧版 | 0.3.0 → 1.0.0 |

- 确定后改 `package.json` 里的 `version` 字段(只改这一处;打包安装包会自动用这个版本号),并把它一起提交。

### 第 4 步:提交

```bash
git add -A
git commit -m "提交说明"
```

### 第 5 步:推送到所有远程仓库

当前项目有两个远程,逐个推送:

```bash
git push gitee main
git push origin main
```

- 分支名用 `git branch --show-current` 得到(当前是 `main`),不要写死。
- 只要有一个远程就推一个;没有的跳过。

### 第 6 步:推送被拒绝怎么办(重要)

如果推送报错,通常是 `non-fast-forward` 或提示「要先 pull」——原因一般是**本地历史被改写过**(比如之前用 `amend` 合并过提交),和远程对不上了。

- **只有自己用这个仓库时**:先跟用户说一句「本地和远程历史分叉了,需要用强制推送覆盖远程,可以吗?」,用户同意后再执行:

```bash
git push gitee main --force-with-lease
git push origin main --force-with-lease
```

- `--force-with-lease` 是「带保险的强制推送」:只在远程没被别人改过时才覆盖,比裸 `--force` 安全。
- **如果仓库还有别人用**:不要强制推送,改为 `git pull` 合并后再推。

## 注意

- 提交前先 `git status` 看清楚改了什么,不要把 build 产物、`node_modules` 等提交进去——项目里一般有 `.gitignore` 挡住,若没有就提醒用户补一个。
- 推送到 github(`origin`,HTTPS 地址)时可能要求输入账号/密码(或走凭据管理器);gitee 走 SSH 地址。
- 两个远程都要推,不要只推一个就收工。
