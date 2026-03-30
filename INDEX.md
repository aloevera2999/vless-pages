# 项目文件索引

## 📁 核心文件

### 1. 函数代码
- **`functions/api/[[path]].js`** - 主函数文件，处理所有请求
  - 健康检查端点
  - WebSocket 连接处理
  - VLESS 协议握手
  - 配置查询

### 2. 静态文件
- **`public/index.html`** - 状态监控页面
  - 实时显示服务状态
  - 一键复制 VLESS 配置
  - 美观的 UI 界面

### 3. 配置文件
- **`package.json`** - Node.js 项目配置
- **`wrangler.toml`** - Cloudflare 配置
- **`.gitignore`** - Git 忽略规则

## 📚 文档文件

### 快速指南
- **`QUICKSTART.md`** - 快速开始（10 分钟部署）⭐ 推荐阅读
- **`README.md`** - 项目完整说明
- **`DEPLOYMENT.md`** - 详细部署指南（3 种方式）

### 故障排查
- **`../cloudflare-debug/contact_cloudflare_support.md`** - 联系支持指南
- **`../cloudflare-debug/alternative_solutions.md`** - 替代方案对比

## 🛠️ 工具脚本

### 自动化脚本
- **`deploy.sh`** - 自动部署脚本
  - Git 初始化
  - 创建 Pages 项目
  - 绑定域名
  - 多种部署选项

- **`test.sh`** - 本地测试脚本
  - 启动开发服务器
  - 测试所有端点

## 🚀 快速开始

### 最快方式（推荐）

```bash
# 1. 推送到 GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/vless-pages.git
git push -u origin main

# 2. 在 Cloudflare Dashboard 连接 GitHub 仓库
# 3. 绑定域名 vless.lee-proxy.xyz
# 4. 测试连接
curl https://vless.lee-proxy.xyz/
```

详细步骤请查看 `QUICKSTART.md`

## 📊 项目状态

- ✅ 项目结构完整
- ✅ 代码已测试
- ✅ 文档齐全
- ✅ 部署脚本就绪
- ⏳ 等待部署到 Cloudflare

## 🎯 下一步

1. 阅读 `QUICKSTART.md`
2. 推送代码到 GitHub
3. 在 Cloudflare Pages 部署
4. 绑定自定义域名
5. 测试 VLESS 连接

---

**创建时间**: 2026-03-30
**项目版本**: 1.0.0
**状态**: 准备部署
