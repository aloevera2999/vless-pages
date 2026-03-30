#!/bin/bash

# VLESS Pages Functions 部署脚本
# 用于初始化项目并部署到 Cloudflare Pages

set -e

echo "======================================"
echo "VLESS Pages Functions 部署脚本"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="vless-lee-proxy"
ACCOUNT_ID="fdab361a70ab2c091dbbdf0bc3ff162f"
EMAIL="Jokerlee2020@gmail.com"
API_KEY="cfk_AxhrxExwHhBbqjPq25UI1IXWFnnVbwVd309hbQQ87c9ad3e1"

echo -e "${YELLOW}步骤 1: 检查项目文件${NC}"
echo "--------------------------------------"

if [ ! -f "functions/api/[[path]].js" ]; then
    echo -e "${RED}错误: 找不到主函数文件${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 找不到 package.json${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 项目文件检查通过${NC}"
echo ""

echo -e "${YELLOW}步骤 2: 初始化 Git 仓库${NC}"
echo "--------------------------------------"

if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial VLESS Pages Functions deployment"
    echo -e "${GREEN}✓ Git 仓库初始化完成${NC}"
else
    echo -e "${GREEN}✓ Git 仓库已存在${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 3: 创建 Cloudflare Pages 项目${NC}"
echo "--------------------------------------"

# 检查项目是否已存在
PROJECT_EXISTS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME" \
  -H "X-Auth-Email: $EMAIL" \
  -H "X-Auth-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq -r '.success')

if [ "$PROJECT_EXISTS" = "true" ]; then
    echo -e "${GREEN}✓ Pages 项目已存在: $PROJECT_NAME${NC}"
else
    echo "创建新的 Pages 项目..."
    
    CREATE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects" \
      -H "X-Auth-Email: $EMAIL" \
      -H "X-Auth-Key: $API_KEY" \
      -H "Content-Type: application/json" \
      --data "{
        \"name\": \"$PROJECT_NAME\",
        \"production_branch\": \"main\"
      }")
    
    if echo "$CREATE_RESPONSE" | jq -e '.success == true' > /dev/null; then
        echo -e "${GREEN}✓ Pages 项目创建成功${NC}"
    else
        echo -e "${RED}✗ Pages 项目创建失败${NC}"
        echo "$CREATE_RESPONSE" | jq .
        exit 1
    fi
fi
echo ""

echo -e "${YELLOW}步骤 4: 配置自定义域名${NC}"
echo "--------------------------------------"

# 检查域名是否已绑定
DOMAIN_EXISTS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME/domains" \
  -H "X-Auth-Email: $EMAIL" \
  -H "X-Auth-Key: $API_KEY" \
  -H "Content-Type: application/json" | jq -r '.result[] | select(.name == "vless.lee-proxy.xyz") | .name')

if [ "$DOMAIN_EXISTS" = "vless.lee-proxy.xyz" ]; then
    echo -e "${GREEN}✓ 自定义域名已绑定: vless.lee-proxy.xyz${NC}"
else
    echo "绑定自定义域名..."
    
    DOMAIN_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME/domains" \
      -H "X-Auth-Email: $EMAIL" \
      -H "X-Auth-Key: $API_KEY" \
      -H "Content-Type: application/json" \
      --data '{
        "name": "vless.lee-proxy.xyz"
      }')
    
    if echo "$DOMAIN_RESPONSE" | jq -e '.success == true' > /dev/null; then
        echo -e "${GREEN}✓ 域名绑定成功${NC}"
        echo -e "${YELLOW}注意: 请确保 DNS 已正确解析到 Pages 项目${NC}"
    else
        echo -e "${RED}✗ 域名绑定失败${NC}"
        echo "$DOMAIN_RESPONSE" | jq .
    fi
fi
echo ""

echo -e "${YELLOW}步骤 5: 部署选项${NC}"
echo "--------------------------------------"
echo "请选择部署方式:"
echo ""
echo "1) 推送到 GitHub（推荐，支持自动部署）"
echo "2) 使用 Wrangler CLI 部署"
echo "3) 手动部署（生成部署包）"
echo ""

read -p "请输入选项 (1/2/3): " DEPLOY_OPTION

case $DEPLOY_OPTION in
    1)
        echo ""
        echo -e "${YELLOW}GitHub 部署步骤:${NC}"
        echo "1. 在 GitHub 创建新仓库: https://github.com/new"
        echo "   仓库名建议: vless-pages"
        echo "   设置为: Public"
        echo ""
        read -p "输入你的 GitHub 用户名: " GITHUB_USER
        
        git remote add origin "https://github.com/$GITHUB_USER/vless-pages.git"
        git branch -M main
        git push -u origin main
        
        echo ""
        echo -e "${GREEN}✓ 代码已推送到 GitHub${NC}"
        echo ""
        echo -e "${YELLOW}下一步操作:${NC}"
        echo "1. 访问 Cloudflare Dashboard: https://dash.cloudflare.com/"
        echo "2. 进入 Workers & Pages > Create application > Pages > Connect to Git"
        echo "3. 选择你的 GitHub 仓库"
        echo "4. Framework preset: None"
        echo "5. Build output directory: /"
        echo "6. 点击 Save and Deploy"
        ;;
    2)
        echo ""
        echo -e "${YELLOW}使用 Wrangler CLI 部署${NC}"
        echo "安装 Wrangler..."
        npm install
        
        echo ""
        echo "请运行以下命令登录并部署:"
        echo "  npx wrangler login"
        echo "  npx wrangler pages deploy . --project-name=$PROJECT_NAME"
        ;;
    3)
        echo ""
        echo -e "${YELLOW}生成部署包${NC}"
        DEPLOY_DIR="../vless-pages-deploy"
        mkdir -p "$DEPLOY_DIR"
        cp -r functions "$DEPLOY_DIR/"
        cp -r public "$DEPLOY_DIR/"
        cp package.json "$DEPLOY_DIR/"
        cp wrangler.toml "$DEPLOY_DIR/"
        cp README.md "$DEPLOY_DIR/"
        
        echo -e "${GREEN}✓ 部署包已生成: $DEPLOY_DIR${NC}"
        echo ""
        echo "你可以将此目录上传到 GitHub 或使用 Wrangler 部署"
        ;;
    *)
        echo -e "${RED}无效选项${NC}"
        exit 1
        ;;
esac

echo ""
echo "======================================"
echo -e "${GREEN}部署准备完成！${NC}"
echo "======================================"
echo ""
echo "配置信息:"
echo "  - 项目名: $PROJECT_NAME"
echo "  - 域名: vless.lee-proxy.xyz"
echo "  - UUID: 14694400-88b4-4c77-9072-adfb729652cd"
echo ""
echo "VLESS 链接:"
echo "  vless://14694400-88b4-4c77-9072-adfb729652cd@vless.lee-proxy.xyz:443?encryption=none&security=tls&sni=vless.lee-proxy.xyz&fp=randomized&type=ws&host=vless.lee-proxy.xyz&path=%2F%3Fed%3D2048#VLESS-Pages-Functions"
echo ""
