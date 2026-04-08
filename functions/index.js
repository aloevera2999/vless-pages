/**
 * VLESS v4.3 - 诊断版
 * 
 * v4.2 问题诊断：
 * - WS 101 成功，但 connect(ProxyIP:443) 失败
 * - 收到无 reason 的 CLOSE frame（说明 webSocket.close(1011, errMsg) 也失败了）
 * - 怀疑：CF Workers 不允许连接到 CF 自身 IP 范围
 * 
 * v4.3 改进：
 * 1. 尝试直连目标域名（不走 ProxyIP）作为 fallback
 * 2. 更详细的错误信息（确保能传回客户端）
 * 3. 连接前先记录所有参数
 * 4. 添加 /diag 端点用于调试网络能力
 */

// @ts-ignore
import { connect } from 'cloudflare:sockets';

// ==================== 配置区域 ====================

const UUID = globalThis.UUID || '14694400-88b4-4c77-9072-adfb729652cd';
const FORCE_PROXY_MODE = globalThis.FORCE_PROXY_MODE !== 'false';

// ProxyIP 列表 - 使用非 CF IP 或已验证的 IP
const PROXY_IP_LIST = [
    '104.16.132.229',   // ChatGPT CF IP
    '162.159.201.100',  // 日本节点  
];

let currentProxyIP = PROXY_IP_LIST[0];

// 超时设置
const CONNECT_TIMEOUT = 10000;
const DATA_TIMEOUT = 20000;

// WebSocket 状态
const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;

// ==================== 主请求处理 ====================

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    if (env.UUID) globalThis.UUID = env.UUID;
    if (env.PROXYIP) globalThis.PROXYIP = env.PROXYIP;
    if (env.FORCE_PROXY_MODE !== undefined) globalThis.FORCE_PROXY_MODE = env.FORCE_PROXY_MODE;

    // 检查 WebSocket 升级
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
        return vlessOverWSHandler(request);
    }

    // 健康检查
    if (url.pathname === '/' || url.pathname === '/health') {
        return new Response(JSON.stringify({
            status: 'ok',
            service: 'VLESS Proxy v4.3',
            version: '4.3',
            fix: 'direct-connect fallback + better error reporting',
            uuid: UUID,
            domain: url.hostname,
            proxy_mode: FORCE_PROXY_MODE ? 'force' : 'fallback',
            current_proxy_ip: currentProxyIP,
            timestamp: new Date().toISOString(),
            cf: { colo: request.cf?.colo, country: request.cf?.country }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }
        });
    }

    // 网络诊断端点
    if (url.pathname === '/diag') {
        return await runDiagnostics(request);
    }

    return new Response('Not Found', { status: 404 });
}

// ==================== 网络诊断 ====================

async function runDiagnostics(request) {
    const results = {};
    
    // Test 1: 直连 chatgpt.com:443 (不经过 ProxyIP)
    try {
        const t1 = Date.now();
        const s1 = connect({ hostname: 'chatgpt.com', port: 443 });
        await Promise.race([s1.opened, timeout(CONNECT_TIMEOUT)]);
        results['direct_chatgpt_com'] = { ok: true, ms: Date.now() - t1 };
        s1.close();
    } catch(e) {
        results['direct_chatgpt_com'] = { ok: false, error: e.message };
    }

    // Test 2: 直连 www.google.com:443
    try {
        const t2 = Date.now();
        const s2 = connect({ hostname: 'www.google.com', port: 443 });
        await Promise.race([s2.opened, timeout(CONNECT_TIMEOUT)]);
        results['direct_google_com'] = { ok: true, ms: Date.now() - t2 };
        s2.close();
    } catch(e) {
        results['direct_google_com'] = { ok: false, error: e.message };
    }

    // Test 3: 通过 ProxyIP 连接 104.16.132.229:443
    try {
        const t3 = Date.now();
        const s3 = connect({ hostname: '104.16.132.229', port: 443 });
        await Promise.race([s3.opened, timeout(CONNECT_TIMEOUT)]);
        results['proxyip_104_16_132_229'] = { ok: true, ms: Date.now() - t3 };
        s3.close();
    } catch(e) {
        results['proxyip_104_16_132_229'] = { ok: false, error: e.message };
    }

    // Test 4: 通过 ProxyIP 连接 162.159.201.100:443
    try {
        const t4 = Date.now();
        const s4 = connect({ hostname: '162.159.201.100', port: 443 });
        await Promise.race([s4.opened, timeout(CONNECT_TIMEOUT)]);
        results['proxyip_162_159_201_100'] = { ok: true, ms: Date.now() - t4 };
        s4.close();
    } catch(e) {
        results['proxyip_162_159_201_100'] = { ok: false, error: e.message };
    }

    // Test 5: 连接 1.1.1.1:443 (Cloudflare DNS)
    try {
        const t5 = Date.now();
        const s5 = connect({ hostname: '1.1.1.1', port: 443 });
        await Promise.race([s5.opened, timeout(CONNECT_TIMEOUT)]);
        results['direct_1_1_1_1'] = { ok: true, ms: Date.now() - t5 };
        s5.close();
    } catch(e) {
        results['direct_1_1_1_1'] = { ok: false, error: e.message };
    }

    // Test 6: fetch API 测试
    try {
        const t6 = Date.now();
        const r = await fetch('https://chatgpt.com', { method: 'HEAD', redirect: 'manual' });
        results['fetch_chatgpt'] = { ok: true, status: r.status, ms: Date.now() - t6 };
    } catch(e) {
        results['fetch_chatgpt'] = { ok: false, error: e.message };
    }

    return new Response(JSON.stringify({
        version: '4.3',
        timestamp: new Date().toISOString(),
        cf: { colo: request.cf?.colo, country: request.cf?.country },
        tests: results
    }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}

function timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms));
}

// ==================== VLESS WebSocket 处理 ====================

async function vlessOverWSHandler(request) {
    // @ts-ignore
    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);

    webSocket.accept();

    let address = '';
    let portWithRandomLog = '';
    const log = (info, event) => {
        console.log(`[v4.3] [${address}:${portWithRandomLog}] ${info}`, event || '');
    };

    const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
    log('WebSocket accepted, earlyData length:', earlyDataHeader.length);

    const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

    let remoteSocketWrapper = { value: null };
    let udpStreamWrite = null;
    let isDns = false;

    readableWebSocketStream.pipeTo(new WritableStream({
        async write(chunk, controller) {
            if (isDns && udpStreamWrite) {
                return udpStreamWrite(chunk);
            }
            if (remoteSocketWrapper.value) {
                try {
                    const writer = remoteSocketWrapper.value.writable.getWriter();
                    await writer.write(chunk);
                    writer.releaseLock();
                } catch(e) {
                    log('Write to remote error:', e.message);
                }
                return;
            }

            // 解析 VLESS 头
            const result = processVlessHeader(chunk, UUID);

            if (result.hasError) {
                log('VLESS header error:', result.message);
                sendClose(webSocket, 1008, result.message);
                return;
            }

            address = result.addressRemote;
            portWithRandomLog = `${result.portRemote}--${Math.random()} ${result.isUDP ? 'udp' : 'tcp'}`;
            
            log(`Target: ${address}:${result.portRemote} (type=${result.addressType}, UDP=${result.isUDP})`);

            if (result.isUDP) {
                if (result.portRemote === 53) {
                    isDns = true;
                    const { write } = await handleUDPOutBound(webSocket, new Uint8Array([0, 0]), log);
                    udpStreamWrite = write;
                    udpStreamWrite(result.rawClientData);
                } else {
                    sendClose(webSocket, 1008, 'UDP only for DNS');
                }
                return;
            }

            const vlessResponseHeader = new Uint8Array([result.vlessVersion[0], 0]);
            
            await handleTCPOutBound(
                remoteSocketWrapper,
                address,
                result.portRemote,
                result.rawClientData,
                webSocket,
                vlessResponseHeader,
                log
            );
        },
        close() {
            log('readableWebSocketStream closed');
        },
        abort(reason) {
            log('readableWebSocketStream aborted:', JSON.stringify(reason));
        },
    })).catch((err) => {
        log('pipeTo error:', err.stack || err);
        sendClose(webSocket, 1011, 'Internal error: ' + err.message);
    });

    return new Response(null, {
        status: 101,
        // @ts-ignore
        webSocket: client,
    });
}

// ==================== TCP 出站处理（v4.3 核心改进）====================

async function handleTCPOutBound(remoteSocketWrapper, addressRemote, portRemote, rawClientData, webSocket, vlessResponseHeader, log) {
    const startTime = Date.now();
    
    // ★ v4.3 核心改进：尝试多种连接方式
    const connectMethods = [
        {
            name: 'direct',
            desc: `直连 ${addressRemote}:${portRemote}`,
            fn: () => connect({ hostname: addressRemote, port: portRemote })
        },
        ...(FORCE_PROXY_MODE ? [{
            name: 'proxyip',
            desc: `ProxyIP ${currentProxyIP}:${portRemote}`,
            fn: () => connect({ hostname: currentProxyIP, port: portRemote })
        }] : [])
    ];

    let lastError = null;
    let tcpSocket = null;

    for (const method of connectMethods) {
        try {
            log(`[${method.name}] 尝试 ${method.desc}...`);
            
            tcpSocket = method.fn();

            // 等待连接建立
            const openResult = await Promise.race([
                tcpSocket.opened,
                new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), CONNECT_TIMEOUT))
            ]);
            
            const connectTime = Date.now() - startTime;
            log(`[${method.name}] ✓ 连接成功! (${connectTime}ms) remoteAddress=${openResult.remoteAddress}`);

            // 连接成功，开始数据转发
            remoteSocketWrapper.value = tcpSocket;

            // 写入客户端数据
            log(`[${method.name}] 写入 ${rawClientData.length} bytes...`);
            const writer = tcpSocket.writable.getWriter();
            await writer.write(rawClientData);
            writer.releaseLock();
            log(`[${method.name}] 数据写入完成`);

            // 开始将远程数据转发回 WebSocket
            await tcpSocket.readable.pipeTo(
                new WritableStream({
                    async write(chunk) {
                        const elapsed = Date.now() - startTime;
                        log(`[${method.name}] 收到 ${chunk.length} bytes (${elapsed}ms)`);
                        
                        if (webSocket.readyState !== WS_READY_STATE_OPEN) {
                            log(`[${method.name}] WS 已关闭，丢弃数据`);
                            return;
                        }
                        
                        try {
                            if (vlessResponseHeader) {
                                webSocket.send(await new Blob([vlessResponseHeader, chunk]).arrayBuffer());
                            } else {
                                webSocket.send(chunk);
                            }
                        } catch(e) {
                            log(`[${method.name}] 发送到 WS 错误:`, e.message);
                        }
                    },
                    close() {
                        const elapsed = Date.now() - startTime;
                        log(`[${method.name}] 远程关闭 (${elapsed}ms)`);
                        safeCloseWebSocket(webSocket);
                    },
                    abort(reason) {
                        log(`[${method.name}] 远程中止:`, reason);
                        safeCloseWebSocket(webSocket);
                    },
                })
            ).catch((error) => {
                log(`[${method.name}] pipeTo 错误:`, error.message || error);
                safeCloseWebSocket(webSocket);
            });

            // 正常返回（pipeTo 完成或出错都会在上面的 catch 中处理）
            return;

        } catch(error) {
            lastError = error;
            const elapsed = Date.now() - startTime;
            log(`[${method.name}] ✗ 失败 (${elapsed}ms): ${error.message}`);

            if (tcpSocket) {
                try { tcpSocket.close(); } catch(e) {}
                tcpSocket = null;
            }
        }
    }

    // 所有方式都失败
    const errMsg = `ALL_FAILED: ${connectMethods.map(m => m.name).join(',')} | last=${lastError?.message || 'unknown'} (${Date.now()-startTime}ms)`;
    log(`FATAL: ${errMsg}`);
    
    sendClose(webSocket, 1011, errMsg);
}

// ==================== 安全的 Close 函数 ====================

function sendClose(ws, code, reason) {
    try {
        // 确保 reason 长度不超过 WebSocket 协议限制 (125 bytes)
        const reasonStr = typeof reason === 'string' ? reason : String(reason || '');
        const truncatedReason = reasonStr.length > 125 ? reasonStr.substring(0, 125) : reasonStr;
        
        if (ws.readyState === WS_READY_STATE_OPEN) {
            ws.close(code, truncatedReason);
            return true;
        }
        // 如果不是 open 状态，尝试强制关闭
        try { ws.close(); } catch(e2) {}
        return false;
    } catch(e) {
        // close 本身失败了
        try { ws.close(); } catch(e2) {}
        return false;
    }
}

// ==================== VLESS 协议处理 ====================

function processVlessHeader(vlessBuffer, userID) {
    if (vlessBuffer.byteLength < 24) {
        return { hasError: true, message: 'invalid data' };
    }
    
    const version = new Uint8Array(vlessBuffer.slice(0, 1));
    
    if (stringify(new Uint8Array(vlessBuffer.slice(1, 17))) !== userID) {
        return { hasError: true, message: 'invalid user' };
    }
    
    const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
    const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
    const isUDP = command === 2;
    
    if (command !== 1 && !isUDP) {
        return { hasError: true, message: `command ${command} not supported` };
    }
    
    const portIndex = 18 + optLength + 1;
    const portRemote = new DataView(vlessBuffer.slice(portIndex, portIndex + 2)).getUint16(0);
    
    let addressIndex = portIndex + 2;
    const addressType = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1))[0];
    
    let addressLength = 0;
    let addressValueIndex = addressIndex + 1;
    let addressValue = '';
    
    switch (addressType) {
        case 1:
            addressLength = 4;
            addressValue = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
            break;
        case 2:
            addressLength = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            break;
        case 3:
            addressLength = 16;
            const dv = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            const ipv6 = [];
            for (let i = 0; i < 8; i++) ipv6.push(dv.getUint16(i*2).toString(16));
            addressValue = ipv6.join(':');
            break;
        default:
            return { hasError: true, message: `invalid addressType ${addressType}` };
    }
    
    if (!addressValue) return { hasError: true, message: 'addressValue empty' };
    
    return {
        hasError: false,
        addressRemote: addressValue,
        addressType,
        portRemote,
        rawDataIndex: addressValueIndex + addressLength,
        vlessVersion: version,
        isUDP,
        rawClientData: vlessBuffer.slice(addressValueIndex + addressLength),
    };
}

// ==================== 工具函数 ====================

function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
    let cancelled = false;
    const stream = new ReadableStream({
        start(controller) {
            webSocketServer.addEventListener('message', (event) => {
                if (!cancelled) controller.enqueue(event.data);
            });
            webSocketServer.addEventListener('close', () => {
                safeCloseWebSocket(webSocketServer);
                if (!cancelled) controller.close();
            });
            webSocketServer.addEventListener('error', (err) => controller.error(err));
            
            const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
            if (error) controller.error(error);
            else if (earlyData) controller.enqueue(earlyData);
        },
        cancel(reason) {
            if (cancelled) return;
            log(`ReadableStream cancelled: ${reason}`);
            cancelled = true;
            safeCloseWebSocket(webSocketServer);
        }
    });
    return stream;
}

async function handleUDPOutBound(webSocket, vlessResponseHeader, log) {
    const transform = new TransformStream({
        transform(chunk, controller) {
            for (let i = 0; i < chunk.byteLength;) {
                const len = new DataView(chunk.slice(i, i+2)).getUint16(0);
                controller.enqueue(chunk.slice(i+2, i+2+len));
                i += len + 2;
            }
        }
    });

    transform.readable.pipeTo(new WritableStream({
        async write(chunk) {
            for (const dns of ['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query']) {
                try {
                    const r = await fetch(dns, { method: 'POST', headers: {'content-type': 'application/dns-message'}, body: chunk });
                    if (r.ok) {
                        const d = await r.arrayBuffer();
                        const sz = new Uint8Array([(d.byteLength>>8)&0xff, d.byteLength&0xff]);
                        if (webSocket.readyState === WS_READY_STATE_OPEN)
                            webSocket.send(await new Blob([vlessResponseHeader, sz, d]).arrayBuffer());
                        return;
                    }
                } catch(e) { log('DNS fail:', dns, e.message); }
            }
        }
    })).catch(e => log('DNS error:', e));

    const w = transform.writable.getWriter();
    return { write(c) { w.write(c); } };
}

function base64ToArrayBuffer(b64) {
    if (!b64) return { error: null };
    try {
        const cleaned = b64.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(cleaned);
        return { earlyData: Uint8Array.from(decoded, c => c.charCodeAt(0)).buffer, error: null };
    } catch(e) { return { error: e }; }
}

function safeCloseWebSocket(socket) {
    try {
        if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING)
            socket.close();
    } catch(e) {}
}

function isValidUUID(uuid) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

const byteToHex = Array.from({length:256}, (_,i) => (i+256).toString(16).slice(1));
function unsafeStringify(arr, offset=0) {
    return byteToHex.map((h,i) => h(arr[offset+i])).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5').toLowerCase();
}
function stringify(arr, offset=0) {
    const uuid = unsafeStringify(arr, offset);
    if (!isValidUUID(uuid)) throw TypeError("Invalid UUID");
    return uuid;
}
