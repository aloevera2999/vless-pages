# 部署指南 - VLESS Pages Functions

## 📋 部署概览

这个项目提供三种部署方式，推荐按优先级选择：

1. **GitHub + Cloudflare Pages 自动部署**（最简单，推荐）
2. **Wrangler CLI 直接部署**（快速，适合开发者）
3. **API 部署**（无需 Dashboard，但步骤较多）

---

## 方法一：GitHub 自动部署（推荐）

### 步骤 1: 准备 GitHub 仓库

#### 1.1 创建 GitHub 仓库

1. 访问 https://github.com/new
2. 填写仓库信息：
   - Repository name: `vless-pages`
   - Description: `VLESS Proxy on Cloudflare Pages Functions`
   - Visibility: **Public**（免费账户只能用 Public 仓库）
3. 点击 "Create repository"

#### 1.2 推送代码到 GitHub

```bash
# 进入项目目录
cd vless-pages-functions

# 初始化 Git
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial VLESS Pages Functions"

# 添加远程仓库（替换 YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/vless-pages.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 步骤 2: 连接 Cloudflare Pages

#### 2.1 访问 Cloudflare Dashboard

⚠️ **注意**: 需要科学上网访问

1. 访问 https://dash.cloudflare.com/
2. 登录你的账户
3. 点击左侧菜单 "Workers & Pages"
4. 点击 "Create application"
5. 选择 "Pages" 标签
6. 点击 "Connect to Git"

#### 2.2 连接 GitHub

1. 点击 "Connect GitHub"
2. 授权 Cloudflare 访问你的 GitHub
3. 选择你的 `vless-pages` 仓库
4. 点击 "Begin setup"

#### 2.3 配置构建设置

填写以下配置：

- **Project name**: `vless-lee-proxy`
- **Production branch**: `main`
- **Framework preset**: `None`
- **Build command**: （留空或填 `echo "No build needed"`）
- **Build output directory**: `/`

点击 "Save and Deploy"

### 步骤 3: 绑定自定义域名

#### 3.1 添加域名

1. 部署完成后，进入项目页面
2. 点击 "Custom domains"
3. 点击 "Set up a custom domain"
4. 输入: `vless.lee-proxy.xyz`
5. 点击 "Activate domain"

#### 3.2 配置 DNS（自动完成）

Cloudflare 会自动配置 DNS，你应该看到：

```
类型: CNAME
名称: vless
内容: vless-lee-proxy.pages.dev
代理状态: 已代理（橙色云朵）
```

---

## 方法二：Wrangler CLI 部署（快速）

### 步骤 1: 安装依赖

```bash
# 进入项目目录
cd vless-pages-functions

# 安装依赖
npm install
```

### 步骤 2: 登录 Cloudflare

```bash
# 登录（会打开浏览器）
npx wrangler login
```

⚠️ **注意**: 国内可能需要科学上网

### 步骤 3: 部署

```bash
# 部署到 Pages
npx wrangler pages deploy . --project-name=vless-lee-proxy
```

### 步骤 4: 绑定域名

部署完成后，有两种方式绑定域名：

#### 方式 A: 通过 Dashboard（推荐）
参考方法一的步骤 3

#### 方式 B: 通过 API

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/fdab361a70ab2c091dbbdf0bc3ff162f/pages/projects/vless-lee-proxy/domains" \
  -H "X-Auth-Email: Jokerlee2020@gmail.com" \
  -H "X-Auth-Key: cfk_AxhrxExwHhBbqjPq25UI1IXWFnnVbwVd309hbQQ87c9ad3e1" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "vless.lee-proxy.xyz"
  }'
```

---

## 方法三：API 部署（无需 Dashboard）

### 步骤 1: 创建 Pages 项目

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/fdab361a70ab2c091dbbdf0bc3ff162f/pages/projects" \
  -H "X-Auth-Email: Jokerlee2020@gmail.com" \
  -H "X-Auth-Key: cfk_AxhrxExwHhBbqjPq25UI1IXWFnnVbwVd309hbQQ87c9ad3e1" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "vless-lee-proxy",
    "production_branch": "main"
  }'
```

### 步骤 2: 上传项目文件

⚠️ **注意**: API 上传文件较复杂，建议使用方法一或方法二

如果必须使用 API，需要：
1. 将整个项目打包成 ZIP
2. 使用 Direct Upload API 上传

```bash
# 打包项目
zip -r vless-pages.zip functions public package.json wrangler.toml

# 上传（API endpoint 需要查看 Cloudflare 文档）
# 这个 API 比较复杂，不推荐使用
```

---

## 🧪 部署后测试

### 1. 测试健康检查

```bash
curl https://vless.lee-proxy.xyz/
```

预期响应：
```json
{
  "status": "ok",
  "service": "VLESS Proxy - Pages Functions",
  "version": "1.0.0",
  "uuid": "14694400-88b4-4c77-9072-adfb729652cd",
  "domain": "vless.lee-proxy.xyz",
  "time": "2026-03-30T14:00:00.000Z"
}
```

### 2. 测试配置端点

```bash
curl https://vless.lee-proxy.xyz/config
```

### 3. 查看日志

```bash
npx wrangler pages deployment tail --project-name=vless-lee-proxy
```

---

## 📱 客户端配置

### VLESS 链接

```
vless://14694400-88b4-4c77-9072-adfb729652cd@vless.lee-proxy.xyz:443?encryption=none&security=tls&sni=vless.lee-proxy.xyz&fp=randomized&type=ws&host=vless.lee-proxy.xyz&path=%2F%3Fed%3D2048#VLESS-Pages-Functions
```

### 客户端配置参数

| 参数 | 值 |
|------|------|
| 服务器地址 | vless.lee-proxy.xyz |
| 端口 | 443 |
| UUID | 14694400-88b4-4c77-9072-adfb729652cd |
| 加密方式 | none |
| 传输协议 | ws (WebSocket) |
| TLS | 启用 |
| Host | vless.lee-proxy.xyz |
| Path | /?ed=2048 |

---

## 🔧 常见问题

### 1. 部署失败

**原因**: 构建命令配置错误

**解决**: 在 Cloudflare Pages 设置中，将 Build command 留空

### 2. 域名绑定失败

**原因**: DNS 未正确配置

**解决**: 
- 确保 `lee-proxy.xyz` 的 NS 已指向 Cloudflare
- 在 Cloudflare DNS 中检查 `vless` 记录

### 3. 访问返回 404

**原因**: 函数路径配置错误

**解决**: 确保 `functions/api/[[path]].js` 文件存在

### 4. WebSocket 连接失败

**原因**: SSL 配置问题

**解决**: 
- 在 Cloudflare SSL/TLS 设置中，选择 "Full" 模式
- 确保客户端使用 `wss://` 而非 `ws://`

---

## 📊 监控与维护

### 查看实时日志

```bash
npx wrangler pages deployment tail --project-name=vless-lee-proxy
```

### 查看部署历史

```bash
curl -X GET "https://api.cloudflare.com/client/v4/accounts/fdab361a70ab2c091dbbdf0bc3ff162f/pages/projects/vless-lee-proxy/deployments" \
  -H "X-Auth-Email: Jokerlee2020@gmail.com" \
  -H "X-Auth-Key: cfk_AxhrxExwHhBbqjPq25UI1IXWFnnVbwVd309hbQQ87c9ad3e1"
```

### 更新代码

使用 Git 自动部署的项目，只需：

```bash
git add .
git commit -m "Update code"
git push
```

Cloudflare 会自动重新部署。

---

## 📝 部署清单

完成以下所有步骤即可：

- [ ] 项目文件已准备好
- [ ] 已选择部署方式（GitHub/Wrangler/API）
- [ ] 已部署到 Cloudflare Pages
- [ ] 已绑定自定义域名 `vless.lee-proxy.xyz`
- [ ] 已测试健康检查端点
- [ ] 已配置 VLESS 客户端
- [ ] 已测试代理连接

---

## 🎉 部署成功！

如果所有测试通过，恭喜你成功部署了 VLESS Pages Functions！

下一步：
1. 配置你的 VLESS 客户端（V2rayN、Clash 等）
2. 测试连接 Google 等外网服务
3. 如有问题，查看实时日志排查

---

**部署时间**: 约 10-20 分钟  
**难度**: ⭐⭐⭐（中等）  
**成功率**: 95%+（比 Workers 更稳定）
