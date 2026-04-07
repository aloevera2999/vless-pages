# Node 3 部署指南 - VLESS v4.0 (ChatGPT 优化版)

## 📋 当前状态

| 项目 | 状态 |
|------|------|
| GitHub 代码 | ✅ 已推送 v4.0 (Commit: `2dffa75ff6`) |
| Cloudflare Pages 部署 | ❌ 待部署（Token 过期，需要重新认证） |
| 当前运行版本 | v2.0（旧版） |

## 🆕 v4.0 新特性

### ChatGPT / OpenAI 访问优化
- **智能目标识别**：自动检测 chatgpt.com、openai.com、api.openai.com 等域名
- **美国节点优选**：针对 OpenAI 服务使用美国区域 IP 池
- **NAT64 套壳**：解决 Cloudflare 内部回环限制
- **多 IP 池自动切换**：失败时快速切换到其他 IP

### Twitter/X 访问保持
- **日本/新加坡节点**：继续使用低延迟亚洲节点
- **Force ProxyIP 模式**：所有流量通过代理出口

### 支持的站点
```
chatgpt.com      → 美国 IP 池 (104.16.x.x, 162.159.128.x)
openai.com       → 美国 IP 池
api.openai.com   → 美国 IP 池  
twitter.com      → 日本 IP 池 (162.159.201.x)
x.com            → 日本 IP 池
twimg.com        → 日本/新加坡 IP 池
```

---

## 🚀 部署方式（选择一种）

### 方式一：Cloudflare Dashboard 手动部署（推荐，最简单）

1. 打开 https://dash.cloudflare.com
2. 左侧菜单选择 **Workers & Pages**
3. 点击项目 **vless-lee-proxy**
4. 点击右上角 **Settings** → **Builds & Deployments**
5. 找到 **Retry deployment** 或 **Create deployment** 按钮
6. 选择 **main** 分支，点击部署
7. 等待 3-5 分钟完成部署

### 方式二：使用 Wrangler CLI（需要新 Token）

```bash
# 1. 获取新的 API Token
#    登录 Cloudflare Dashboard → My Profile → API Tokens
#    创建 Token，权限：Cloudflare Pages:Edit

# 2. 设置环境变量
export CLOUDFLARE_API_TOKEN="你的新Token"

# 3. 进入项目目录
cd /Users/lee/WorkBuddy/20260327095750/vless-pages-functions

# 4. 部署
npx wrangler pages deploy . --project-name=vless-lee-proxy
```

### 方式三：更新 API Token 后自动化部署

如果你能提供新的 Cloudflare API Token，我可以直接帮你完成部署。

**获取 Token 步骤：**
1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 **Create Token**
3. 使用 **Create Custom Token** 模板：
   - Name: `VLESS Deploy`
   - Permissions:
     - Account > Cloudflare Pages > Edit
     - Zone > DNS > Edit
   - Resources: Include all accounts
4. 复制生成的 Token 给我

### 方式四：GitHub Actions 自动部署（一劳永逸）

我已经在项目中创建了 `.github/workflows/deploy.yml` 工作流。

**设置步骤：**

1. 在 GitHub 仓库添加 Secrets：
   ```
   仓库 Settings → Secrets and variables → Actions → New repository secret
   
   名称: CLOUDFLARE_API_TOKEN
   值: 你的新 Cloudflare API Token
   
   名称: CLOUDFLARE_ACCOUNT_ID  
   值: fdab361a70ab2c091dbbdf0bc3ff162f
   ```

2. 之后每次 push 到 main 分支会自动部署

3. 也可以手动触发：仓库 Actions 页面 → Deploy workflow → Run workflow

---

## ✅ 验证部署成功

部署完成后，运行以下命令验证：

```bash
# 检查版本
curl https://node3.lee-proxy.xyz/health

# 预期返回：
{
  "status": "ok",
  "service": "VLESS Proxy v4.0 - ChatGPT & Twitter Optimized",
  "version": "4.0",
  ...
}

# 测试 ChatGPT 连通性
curl "https://node3.lee-proxy.xyz/test-site?site=chatgpt.com"
```

## 🔧 客户端配置

### VLESS 链接
```
vless://14694400-88b4-4c77-9072-adfb729652cd@node3.lee-proxy.xyz:443?encryption=none&security=tls&sni=node3.lee-proxy.xyz&fp=randomized&type=ws&host=node3.lee-proxy.xyz&path=%2F%3Fed%3D2048#VLESS-v4-ChatGPT
```

### YAML 配置（Clash/Stash）
```yaml
- name: "Node3-ChatGPT"
  type: vless
  server: node3.lee-proxy.xyz
  port: 443
  uuid: 14694400-88b4-4c77-9072-adfb729652cd
  network: ws
  tls: true
  udp: false  # ⚠️ 必须禁用 UDP
  ws-opts:
    path: "/?ed=2048"
    headers:
      Host: node3.lee-proxy.xyz
```

### ⚠️ 重要提示
1. **禁用 UDP/QUIC**：访问 ChatGPT 和 Twitter 都必须关闭 UDP
2. **不要开启分片 Fragment**：ChatGPT 对分片敏感
3. **移动端需开启 HTTP 代理转发**：确保 App 层应用走代理

---

## 📊 故障排除

| 问题 | 解决方法 |
|------|----------|
| 版本仍是 v2.0 | 需要等待或手动触发部署 |
| `/health` 返回 404 | 说明旧代码还在运行，需要重新部署 |
| ChatGPT 无法访问 | 检查是否已部署 v4.0 + 关闭 UDP |
| Twitter 不稳定 | 尝试 `/switch-proxy` 切换 IP |

---

*创建时间：2026-04-07*
*v4.0 版本，支持 ChatGPT 和 Twitter/X*
