# GitHub 认证配置指南

## 问题说明
推送代码时需要 GitHub 认证，有两种方式：

---

## 方式一：使用 GitHub Personal Access Token（推荐）

### 步骤 1: 创建 Personal Access Token

1. 访问: https://github.com/settings/tokens/new

2. 填写 Token 信息：
   - **Note**: `VLESS Pages Push`
   - **Expiration**: `No expiration`（永不过期）
   - **Select scopes**: 勾选以下选项
     - ✅ `repo`（完整的仓库访问权限）

3. 点击 "Generate token"

4. ⚠️ **重要**: 复制生成的 token（格式：`ghp_xxxxxxxxxxxx`）
   - 这个 token 只会显示一次，请妥善保存

### 步骤 2: 使用 Token 推送

创建 token 后，你有两种推送方式：

#### 方式 A: 修改远程 URL（推荐）

```bash
cd /Users/lee/WorkBuddy/20260327095750/vless-pages-functions

# 修改远程 URL（替换 YOUR_TOKEN）
git remote set-url origin https://YOUR_TOKEN@github.com/aloevera2999/vless-pages.git

# 推送
git push -u origin main
```

#### 方式 B: 在推送时输入

```bash
cd /Users/lee/WorkBuddy/20260327095750/vless-pages-functions

# 推送时会提示输入用户名和密码
git push -u origin main
# Username: 输入 aloevera2999
# Password: 输入你的 Personal Access Token（不是 GitHub 密码）
```

---

## 方式二：使用 SSH 密钥

如果你已经配置了 SSH 密钥，可以使用 SSH URL：

```bash
cd /Users/lee/WorkBuddy/20260327095750/vless-pages-functions

# 修改为 SSH URL
git remote set-url origin git@github.com:aloevera2999/vless-pages.git

# 推送
git push -u origin main
```

---

## 方式三：使用 GitHub CLI（如果已安装）

```bash
# 安装 GitHub CLI（如果未安装）
brew install gh

# 登录
gh auth login

# 推送
cd /Users/lee/WorkBuddy/20260327095750/vless-pages-functions
git push -u origin main
```

---

## 推荐：创建 Token 后立即推送

创建 Personal Access Token 后，运行以下命令：

```bash
cd /Users/lee/WorkBuddy/20260327095750/vless-pages-functions

# 替换 YOUR_TOKEN 为你的 token
git remote set-url origin https://YOUR_TOKEN@github.com/aloevera2999/vless-pages.git

# 推送
git push -u origin main
```

---

## 验证推送成功

推送成功后，访问你的仓库：
https://github.com/aloevera2999/vless-pages

你应该能看到所有文件已经上传。

---

**下一步**: 推送成功后，就可以在 Cloudflare Pages 连接这个仓库了！
