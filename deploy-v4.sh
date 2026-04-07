#!/bin/bash
# ============================================================
# Node 3 (vless-lee-proxy) 一键部署脚本
# VLESS v4.0 - ChatGPT & Twitter/X 优化版
# ============================================================
# 使用方法:
#   1. 先获取 Cloudflare API Token:
#      https://dash.cloudflare.com/profile/api-tokens
#   2. 运行: bash deploy-v4.sh YOUR_TOKEN
#   3. 或设置环境变量后运行: export CF_TOKEN=xxx && bash deploy-v4.sh
# ============================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Cloudflare 配置
CF_ACCOUNT_ID="fdab361a70ab2c091dbbdf0bc3ff162f"
CF_PROJECT_NAME="vless-lee-proxy"

# 获取 Token（参数或环境变量）
CF_TOKEN="${1:-$CF_TOKEN}"

if [ -z "$CF_TOKEN" ]; then
    echo -e "${RED}❌ 错误: 未提供 Cloudflare API Token${NC}"
    echo ""
    echo "使用方法:"
    echo "  bash deploy-v4.sh YOUR_CLOUDFLARE_API_TOKEN"
    echo ""
    echo "或设置环境变量:"
    echo "  export CF_TOKEN=YOUR_TOKEN"
    echo "  bash deploy-v4.sh"
    echo ""
    echo "获取 Token: https://dash.cloudflare.com/profile/api-tokens"
    echo ""
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  VLESS v4.0 一键部署脚本${NC}"
echo -e "${BLUE}  ChatGPT & Twitter/X 优化版${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: 验证 Token
echo -e "${YELLOW}[1/5] 验证 Cloudflare API Token...${NC}"
TOKEN_CHECK=$(curl -s --max-time 15 https://api.cloudflare.com/client/v4/user/tokens/verify \
    -H "Authorization: Bearer $CF_TOKEN")

if echo "$TOKEN_CHECK" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Token 有效${NC}"
else
    ERROR_MSG=$(echo "$TOKEN_CHECK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errors',[{}])[0].get('message','未知错误'))" 2>/dev/null)
    echo -e "${RED}❌ Token 无效: ${ERROR_MSG}${NC}"
    exit 1
fi

# Step 2: 检查项目是否存在
echo -e "${YELLOW}[2/5] 检查 Pages 项目...${NC}"
PROJECT_CHECK=$(curl -s --max-time 15 \
    "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/$CF_PROJECT_NAME" \
    -H "Authorization: Bearer $CF_TOKEN")

if echo "$PROJECT_CHECK" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 项目 '$CF_PROJECT_NAME' 存在${NC}"
else
    echo -e "${RED}❌ 项目不存在${NC}"
    exit 1
fi

# Step 3: 创建部署（获取上传 URL）
echo -e "${YELLOW}[3/5] 创建新部署...${NC}"
DEPLOY_RESPONSE=$(curl -s --max-time 30 -X POST \
    "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/$CF_PROJECT_NAME/deployments" \
    -H "Authorization: Bearer $CF_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"branch":"main"}')

UPLOAD_URL=$(echo "$DEPLOY_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['url'] if d.get('result') else '')" 2>/dev/null)
DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['id'] if d.get('result') else '')" 2>/dev/null)

if [ -n "$UPLOAD_URL" ] && [ -n "$DEPLOY_ID" ]; then
    echo -e "${GREEN}✅ 部署已创建: ${DEPLOY_ID:0:12}...${NC}"
else
    echo -e "${RED}❌ 创建部署失败:${NC}"
    echo "$DEPLOY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DEPLOY_RESPONSE"
    exit 1
fi

# Step 4: 上传文件
echo -e "${YELLOW}[4/5] 上传文件到 Cloudflare Pages...${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 使用 curl 上传（multipart/form-data）
cd "$SCRIPT_DIR"

UPLOAD_RESULT=$(curl -s --max-time 120 -X PUT "$UPLOAD_URL" \
    --header "Content-Type: application/octet-stream" \
    --data-binary "@-")

echo -e "${GREEN}✅ 文件上传完成${NC}"

# Step 5: 等待部署完成并验证
echo -e "${YELLOW}[5/5] 等待部署完成...${NC}"

# 轮询检查部署状态
MAX_WAIT=120  # 最多等 2 分钟
WAITED=0
INTERVAL=10

while [ $WAITED -lt $MAX_WAIT ]; do
    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))
    
    STATUS_CHECK=$(curl -s --max-time 15 \
        "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/$CF_PROJECT_NAME/deployments/$DEPLOY_ID" \
        -H "Authorization: Bearer $CF_TOKEN")
    
    DEPLOY_STATUS=$(echo "$STATUS_CHECK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['status'] if d.get('result') else 'unknown')" 2>/dev/null)
    
    echo -n ". "
    
    if [ "$DEPLOY_STATUS" = "success" ] || [ "$DEPLOY_STATUS" = "active" ]; then
        break
    elif [ "$DEPLOY_STATUS" = "failure" ]; then
        echo -e "\n${RED}❌ 部署失败！${NC}"
        # 获取错误详情
        echo "$STATUS_CHECK" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('result', {})
print('错误信息:', r.get('error', 'Unknown'))
steps = r.get('steps', [])
for s in steps:
    if s.get('status') == 'failure':
        print(f'失败步骤: {s.get(\"name\")} - {s.get(\"message\", \"\")}')
" 2>/dev/null
        exit 1
    fi
done

echo ""
echo ""

# 最终验证
echo -e "${BLUE}=== 部署完成，验证中... ===${NC}"
sleep 5

HEALTH_CHECK=$(curl -s --max-time 15 https://node3.lee-proxy.xyz/health 2>&1)
VERSION=$(echo "$HEALTH_CHECK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version','unknown'))" 2>/dev/null)

if [ "$VERSION" = "4.0" ]; then
    echo -e "${GREEN}🎉 部署成功！Node 3 已升级到 VLESS v4.0${NC}"
    echo ""
    echo -e "${GREEN}版本信息:${NC}"
    echo "$HEALTH_CHECK" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_CHECK"
    echo ""
    echo -e "${BLUE}VLESS 链接:${NC}"
    echo "vless://14694400-88b4-4c77-9072-adfb729652cd@node3.lee-proxy.xyz:443?encryption=none&security=tls&sni=node3.lee-proxy.xyz&fp=randomized&type=ws&host=node3.lee-proxy.xyz&path=%2F%3Fed%3D2048#VLESS-v4-ChatGPT"
    echo ""
    echo -e "${YELLOW}⚠️ 客户端配置提醒:${NC}"
    echo "  - 必须禁用 UDP/QUIC (udp: false)"
    echo "  - 不要开启分片 Fragment"
    echo "  - 移动端需开启 HTTP 代理转发"
else
    echo -e "${YELLOW}⚠️ 版本检测: $VERSION (可能还在部署中)${NC}"
    echo -e "${YELLOW}请稍后手动验证: curl https://node3.lee-proxy.xyz/health${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
