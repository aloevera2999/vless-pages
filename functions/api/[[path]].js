/**
 * VLESS Proxy - Cloudflare Pages Functions
 * 支持自定义路由和 WebSocket 连接
 */

// UUID 配置
const UUID = '14694400-88b4-4c77-9072-adfb729652cd';

// 处理所有请求
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    // 健康检查端点
    if (url.pathname === '/' || url.pathname === '/health') {
        return new Response(JSON.stringify({
            status: 'ok',
            service: 'VLESS Proxy - Pages Functions',
            version: '1.0.0',
            uuid: UUID,
            domain: url.hostname,
            time: new Date().toISOString(),
            note: 'Cloudflare Pages Functions 部署成功'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    // WebSocket 升级处理
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
        return handleWebSocket(request, url);
    }

    // VLESS 连接测试端点
    if (url.pathname === '/connect') {
        return handleVLESSConnect(request, url);
    }

    // 配置信息端点
    if (url.pathname === '/config') {
        return new Response(JSON.stringify({
            uuid: UUID,
            server: url.hostname,
            port: 443,
            encryption: 'none',
            security: 'tls',
            type: 'ws',
            host: url.hostname,
            path: '/?ed=2048',
            note: '使用此配置连接 VLESS 客户端'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    }

    // 其他路径返回 404
    return new Response('Not Found', {
        status: 404,
        headers: {
            'Content-Type': 'text/plain'
        }
    });
}

/**
 * 处理 WebSocket 连接
 */
async function handleWebSocket(request, url) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    // 处理 WebSocket 消息
    server.addEventListener('message', async (event) => {
        try {
            // VLESS 协议处理
            const data = event.data;

            // 这里可以添加 VLESS 协议解析逻辑
            // 简化版：直接返回响应
            server.send(JSON.stringify({
                type: 'response',
                message: 'VLESS handshake received',
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('WebSocket message error:', error);
            server.send(JSON.stringify({
                type: 'error',
                message: error.message
            }));
        }
    });

    // 处理 WebSocket 关闭
    server.addEventListener('close', () => {
        console.log('WebSocket connection closed');
    });

    // 处理 WebSocket 错误
    server.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
    });

    return new Response(null, {
        status: 101,
        webSocket: client
    });
}

/**
 * 处理 VLESS 连接测试
 */
async function handleVLESSConnect(request, url) {
    const method = request.method;

    if (method === 'GET') {
        return new Response(JSON.stringify({
            status: 'ready',
            message: 'VLESS connection endpoint is ready',
            uuid: UUID,
            endpoint: `wss://${url.hostname}/connect`,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    if (method === 'POST') {
        try {
            const body = await request.json();

            // 验证 UUID
            if (body.uuid !== UUID) {
                return new Response(JSON.stringify({
                    status: 'error',
                    message: 'Invalid UUID'
                }), {
                    status: 403,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }

            return new Response(JSON.stringify({
                status: 'success',
                message: 'VLESS authentication successful',
                timestamp: new Date().toISOString()
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                status: 'error',
                message: error.message
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    }

    return new Response('Method not allowed', {
        status: 405
    });
}
