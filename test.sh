#!/bin/bash

# 本地测试脚本 - 用于在部署前测试 Pages Functions

echo "======================================"
echo "VLESS Pages Functions 本地测试"
echo "======================================"
echo ""

# 检查 Node.js 和 npm
if ! command -v node &> /dev/null; then
    echo "错误: 未安装 Node.js"
    echo "请访问 https://nodejs.org/ 安装 Node.js"
    exit 1
fi

echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
    echo ""
fi

echo "启动本地开发服务器..."
echo ""
echo "测试端点:"
echo "  - http://localhost:8788/"
echo "  - http://localhost:8788/config"
echo "  - http://localhost:8788/connect"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

npm run dev
