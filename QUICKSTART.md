# 🚀 快速开始 - VLESS Pages Functions

## 最快部署方案（10 分钟完成）

### 前提条件
- ✅ 已有 Cloudflare 账户
- ✅ 已有 GitHub 账户
- ✅ 域名 `lee-proxy.xyz` 已托管在 Cloudflare

---

## 第一步：推送代码到 GitHub（2 分钟）

### 1.1 创建 GitHub 仓库

访问 https://github.com/new，创建新仓库：
- Repository name: `vless-pages`
- Visibility: **Public**
- 点击 "Create repository"

### 1.2 推送代码

在终端运行（替换 `YOUR_USERNAME` 为你的 GitHub 用户名）：

```bash
cd /Users/lee/WorkBuddy/20260327095750/vless-pages-functions

git init
git add .
git commit -m "Initial VLESS Pages Functions"
git remote add origin https://github.com/YOUR_USERNAME/vless-pages.git
git branch -M main
git push -u origin main
```

---

## 第二步：连接 Cloudflare Pages（5 分钟）

### 2.1 访问 Cloudflare Dashboard

⚠️ 需要科学上网

访问: https://dash.cloudflare.com/

### 2.2 创建 Pages 项目

1. 点击左侧 "Workers & Pages"
2. 点击 "Create application"
3. 选择 "Pages" 标签
4. 点击 "Connect to Git"
5. 授权 GitHub 并选择 `vless-pages` 仓库
6. 配置构建：
   - **Project name**: `vless-lee-proxy`
   - **Framework preset**: None
   - **Build command**: 留空
   - **Build output directory**: `/`
7. 点击 "Save and Deploy"

---

## 第三步：绑定域名（3 分钟）

### 3.1 添加自定义域名

1. 部署完成后，进入项目页面
2. 点击 "Custom domains"
3. 点击 "Set up a custom domain"
4. 输入: `vless.lee-proxy.xyz`
5. 点击 "Activate domain"

### 3.2 等待 DNS 生效

通常 1-2 分钟即可生效，最长等待 5 分钟。

---

## 第四步：测试连接（1 分钟）

### 4.1 测试健康检查

```bash
curl https://vless.lee-proxy.xyz/
```

预期输出：
```json
{
  "status": "ok",
  "service": "VLESS Proxy - Pages Functions",
  "version": "1.0.0"
}
```

### 4.2 测试配置端点

```bash
curl https://vless.lee-proxy.xyz/config
```

---

## 第五步：配置客户端（1 分钟）

### VLESS 链接（直接导入客户端）

```
vless://14694400-88b4-4c77-9072-adfb729652cd@vless.lee-proxy.xyz:443?encryption=none&security=tls&sni=vless.lee-proxy.xyz&fp=randomized&type=ws&host=vless.lee-proxy.xyz&path=%2F%3Fed%3D2048#VLESS-Pages-Functions
```

### 手动配置参数

| 参数 | 值 |
|------|------|
| 服务器 | vless.lee-proxy.xyz |
| 端口 | 443 |
| UUID | 14694400-88b4-4c77-9072-adfb729652cd |
| 加密 | none |
| 传输 | ws |
| TLS | 启用 |
| Host | vless.lee-proxy.xyz |
| Path | /?ed=2048 |

---

## 🎉 完成！

现在你可以：
1. 在客户端导入 VLESS 链接
2. 启动代理连接
3. 访问 Google 等外网服务

---

## 故障排查

### 问题 1: GitHub 授权失败
- 解决: 在 GitHub Settings > Applications 中撤销 Cloudflare Pages 的授权，重新授权

### 问题 2: 构建失败
- 解决: 检查 Build output directory 是否设置为 `/`

### 问题 3: 域名绑定失败
- 解决: 确保 `lee-proxy.xyz` 的 NS 已指向 Cloudflare

### 问题 4: 连接失败
- 解决: 查看 Cloudflare Pages 日志，运行：
  ```bash
  npx wrangler pages deployment tail --project-name=vless-lee-proxy
  ```

---

## 需要帮助？

如果遇到问题，可以：
1. 查看详细部署指南: `DEPLOYMENT.md`
2. 运行诊断脚本: `./test.sh`
3. 联系我进行故障排查

---

**预计完成时间**: 10-12 分钟  
**成功率**: 95%+
