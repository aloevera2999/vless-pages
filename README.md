# VLESS Proxy - Cloudflare Pages Functions

这是一个部署在 Cloudflare Pages Functions 上的 VLESS 代理服务。

## 项目结构

```
vless-pages-functions/
├── functions/
│   └── api/
│       └── [[path]].js      # 主函数文件，处理所有路径
├── public/                   # 静态文件目录（可选）
│   └── index.html           # 静态首页（可选）
├── wrangler.toml            # Cloudflare 配置文件
├── package.json             # 项目依赖配置
└── README.md                # 本文件
```

## 功能特性

- ✅ 健康检查端点
- ✅ WebSocket 连接支持
- ✅ VLESS 协议握手
- ✅ 配置信息查询
- ✅ 完全免费（Cloudflare Pages 免费额度）

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 本地运行

```bash
npm run dev
```

访问 http://localhost:8788 测试

### 3. 测试端点

```bash
# 健康检查
curl http://localhost:8788/

# 配置信息
curl http://localhost:8788/config

# 连接测试
curl http://localhost:8788/connect
```

## 部署到 Cloudflare Pages

### 方法一：通过 Git 自动部署（推荐）

#### 1. 推送到 GitHub

```bash
# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial VLESS Pages Functions"

# 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/vless-pages.git

# 推送到 GitHub
git push -u origin main
```

#### 2. 在 Cloudflare Dashboard 创建 Pages 项目

1. 访问 https://dash.cloudflare.com/
2. 进入 "Workers & Pages" > "Create application" > "Pages" > "Connect to Git"
3. 选择你的 GitHub 仓库
4. 配置构建设置：
   - **Framework preset**: None
   - **Build command**: `npm run build`（或留空）
   - **Build output directory**: `/`（或 `public`）
5. 点击 "Save and Deploy"

### 方法二：通过 Wrangler CLI 部署

```bash
# 登录 Cloudflare
npx wrangler login

# 部署到 Pages
npx wrangler pages deploy . --project-name=vless-lee-proxy
```

### 方法三：通过 API 部署（无需访问 Dashboard）

#### 1. 创建 Pages 项目

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/fdab361a70ab2c091dbbdf0bc3ff162f/pages/projects" \
  -H "X-Auth-Email: Jokerlee2020@gmail.com" \
  -H "X-Auth-Key: cfk_AxhrxExwHhBbqjPq25UI1IXWFnnVbwVd309hbQQ87c9ad3e1" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "vless-lee-proxy"
  }'
```

#### 2. 上传项目文件

由于 API 部署较复杂，建议使用方法一或方法二。

## 配置自定义域名

### 通过 Dashboard

1. 进入 Pages 项目设置
2. 点击 "Custom domains" > "Set up a custom domain"
3. 输入域名：`vless.lee-proxy.xyz`
4. 按照提示配置 DNS

### 通过 API

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/fdab361a70ab2c091dbbdf0bc3ff162f/pages/projects/vless-lee-proxy/domains" \
  -H "X-Auth-Email: Jokerlee2020@gmail.com" \
  -H "X-Auth-Key: cfk_AxhrxExwHhBbqjPq25UI1IXWFnnVbwVd309hbQQ87c9ad3e1" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "vless.lee-proxy.xyz"
  }'
```

## 客户端配置

### VLESS 链接

```
vless://14694400-88b4-4c77-9072-adfb729652cd@vless.lee-proxy.xyz:443?encryption=none&security=tls&sni=vless.lee-proxy.xyz&fp=randomized&type=ws&host=vless.lee-proxy.xyz&path=%2F%3Fed%3D2048#VLESS-Pages-Functions
```

### 客户端配置参数

- **服务器地址**: vless.lee-proxy.xyz
- **端口**: 443
- **UUID**: 14694400-88b4-4c77-9072-adfb729652cd
- **加密**: none
- **传输协议**: ws (WebSocket)
- **TLS**: 启用
- **Host**: vless.lee-proxy.xyz
- **Path**: /?ed=2048

## API 端点

### GET /
健康检查，返回服务状态

**响应示例**:
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

### GET /config
获取客户端配置信息

**响应示例**:
```json
{
  "uuid": "14694400-88b4-4c77-9072-adfb729652cd",
  "server": "vless.lee-proxy.xyz",
  "port": 443,
  "encryption": "none",
  "security": "tls",
  "type": "ws",
  "host": "vless.lee-proxy.xyz",
  "path": "/?ed=2048"
}
```

### GET /connect
VLESS 连接测试端点

### WebSocket 连接
`wss://vless.lee-proxy.xyz/connect`

## 故障排查

### 1. 检查部署状态

```bash
# 通过 API 检查项目状态
curl -X GET "https://api.cloudflare.com/client/v4/accounts/fdab361a70ab2c091dbbdf0bc3ff162f/pages/projects/vless-lee-proxy" \
  -H "X-Auth-Email: Jokerlee2020@gmail.com" \
  -H "X-Auth-Key: cfk_AxhrxExwHhBbqjPq25UI1IXWFnnVbwVd309hbQQ87c9ad3e1"
```

### 2. 检查域名绑定

```bash
curl -X GET "https://api.cloudflare.com/client/v4/accounts/fdab361a70ab2c091dbbdf0bc3ff162f/pages/projects/vless-lee-proxy/domains" \
  -H "X-Auth-Email: Jokerlee2020@gmail.com" \
  -H "X-Auth-Key: cfk_AxhrxExwHhBbqjPq25UI1IXWFnnVbwVd309hbQQ87c9ad3e1"
```

### 3. 查看实时日志

```bash
npx wrangler pages deployment tail --project-name=vless-lee-proxy
```

## 优势对比

| 特性 | Workers | Pages Functions |
|------|---------|-----------------|
| 免费额度 | 100k 请求/天 | 100k 请求/天 |
| 部署方式 | Dashboard/API | Git 自动部署 + Dashboard |
| 自定义域名 | 需要 Route 配置 | 直接绑定 |
| 稳定性 | 可能受限制 | 更稳定 |
| 日志查看 | 需要 Wrangler | Dashboard 可视化 |

## 注意事项

1. **DNS 污染**: 国内无法访问 `*.pages.dev` 域名，必须配置自定义域名
2. **科学上网**: 首次部署可能需要访问 Dashboard（建议通过 Git 自动部署）
3. **免费额度**: 每天有 100,000 次请求限制，超出后会被限制
4. **冷启动**: 长时间不访问会有冷启动延迟（通常 < 1秒）

## 下一步

1. 将项目推送到 GitHub
2. 在 Cloudflare 创建 Pages 项目
3. 绑定自定义域名 `vless.lee-proxy.xyz`
4. 测试连接
5. 配置 VLESS 客户端

---

**项目创建时间**: 2026-03-30  
**UUID**: 14694400-88b4-4c77-9072-adfb729652cd  
**域名**: vless.lee-proxy.xyz
