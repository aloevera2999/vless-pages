/**
 * VLESS v4.2 - 修复版
 * 
 * 核心问题诊断：
 * WS 升级 101 成功，但 Worker 内部 connect(ProxyIP) 后无数据返回
 * 
 * 可能原因：
 * 1. connect() 没有等待 socket.opened 就开始写/读
 * 2. ProxyIP 连接后 TLS 握手需要 secureTransport: "on"
 * 3. socket closed 事件被错误触发
 * 
 * 修复方案：
 * - 添加 await tcpSocket.opened 等待连接建立
 * - 添加详细错误日志
 * - 添加连接状态跟踪
 */

// @ts-ignore
import { connect } from 'cloudflare:sockets';

// ==================== 配置区域 ====================

const UUID = globalThis.UUID || '14694400-88b4-4c77-9072-adfb729652cd';
const FORCE_PROXY_MODE = globalThis.FORCE_PROXY_MODE !== 'false';

// ProxyIP 列表 - 使用经过验证的 IP
const PROXY_IP_LIST = [
    '104.16.132.229',   // ChatGPT CF IP (已验证)
    '104.16.133.229',   // ChatGPT CF IP 备用
    '162.159.201.100',  // 日本节点
    '162.159.200.100',  // 日本备用
];

let currentProxyIP = PROXY_IP_LIST[0]; // 默认使用第一个

// 超时设置
const CONNECT_TIMEOUT = 8000;
const DATA_TIMEOUT = 15000;

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
            service: 'VLESS Proxy v4.2',
            version: '4.2',
            fix: 'await socket.opened + detailed error logging',
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

    // 配置信息
    if (url.pathname === '/config') {
        return new Response(JSON.stringify({ version: '4.2' }), { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
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
        console.log(`[v4.2] [${address}:${portWithRandomLog}] ${info}`, event || '');
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
                webSocket.close(1008, result.message);
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
                    webSocket.close(1008, 'UDP only for DNS');
                }
                return;
            }

            const vlessResponseHeader = new Uint8Array([result.vlessVersion[0], 0]);
            
            // 核心：处理 TCP 出站连接
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
        try { webSocket.close(1011, 'Internal error'); } catch(e) {}
    });

    return new Response(null, {
        status: 101,
        // @ts-ignore
        webSocket: client,
    });
}

// ==================== TCP 出站处理（v4.2 核心修复）====================

async function handleTCPOutBound(remoteSocketWrapper, addressRemote, portRemote, rawClientData, webSocket, vlessResponseHeader, log) {
    const startTime = Date.now();
    
    // 选择目标地址
    let targetAddress;
    if (FORCE_PROXY_MODE) {
        targetAddress = currentProxyIP;
        log(`FORCE_PROXY_MODE: using ProxyIP ${targetAddress} for ${addressRemote}`);
    } else {
        targetAddress = addressRemote;
        log(`Direct mode: connecting to ${addressRemote}`);
    }

    let tcpSocket = null;
    
    try {
        log(`Step 1: connect(${targetAddress}:${portRemote})...`);
        
        // 创建 TCP 连接
        // 注意：Cloudflare Workers 的 connect() 不支持 serverName 参数
        // SocketOptions 只有 secureTransport 和 allowHalfOpen
        tcpSocket = connect({
            hostname: targetAddress,
            port: portRemote,
        });

        log(`Step 2: socket created, waiting for opened...`);
        
        // ★ 关键修复：等待连接真正建立！
        const openResult = await Promise.race([
            tcpSocket.opened,
            new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), CONNECT_TIMEOUT))
        ]);
        
        const connectTime = Date.now() - startTime;
        log(`Step 3: Connection established in ${connectTime}ms! remoteAddress=${openResult.remoteAddress}`);

        remoteSocketWrapper.value = tcpSocket;

        // 写入客户端数据
        log(`Step 4: Writing ${rawClientData.length} bytes to remote...`);
        const writer = tcpSocket.writable.getWriter();
        await writer.write(rawClientData);
        writer.releaseLock();
        log(`Step 5: Data written OK`);

        // 设置读取超时
        const dataTimeoutId = setTimeout(() => {
            log(`WARNING: No data received within ${DATA_TIMEOUT}ms, closing`);
            safeCloseWebSocket(webSocket);
        }, DATA_TIMEOUT);

        // 开始将远程数据转发回 WebSocket
        log(`Step 6: Starting pipeTo from remote to WS...`);
        
        await tcpSocket.readable.pipeTo(
            new WritableStream({
                start() {
                    clearTimeout(dataTimeoutId);
                    log('pipeTo started, data timeout cleared');
                },
                async write(chunk) {
                    const elapsed = Date.now() - startTime;
                    log(`Received ${chunk.length} bytes from remote (${elapsed}ms total)`);
                    
                    if (webSocket.readyState !== WS_READY_STATE_OPEN) {
                        log('WARNING: WebSocket not open, discarding chunk');
                        return;
                    }
                    
                    try {
                        // 发送 VLESS 响应头 + 数据
                        if (vlessResponseHeader) {
                            webSocket.send(await new Blob([vlessResponseHeader, chunk]).arrayBuffer());
                            log('Sent with VLESS response header');
                        } else {
                            webSocket.send(chunk);
                        }
                    } catch(e) {
                        log('Error sending to WS:', e.message);
                    }
                },
                close() {
                    const elapsed = Date.now() - startTime;
                    log(`remote readable closed after ${elapsed}ms`);
                    safeCloseWebSocket(webSocket);
                },
                abort(reason) {
                    log(`remote readable aborted:`, reason);
                    safeCloseWebSocket(webSocket);
                },
            })
        ).catch((error) => {
            log(`pipeTo error:`, error.stack || error);
            safeCloseWebSocket(webSocket);
        });

    } catch(error) {
        const elapsed = Date.now() - startTime;
        log(`ERROR in handleTCPOutBound after ${elapsed}ms:`, error.message, error.stack);
        
        if (tcpSocket) {
            try { tcpSocket.close(); } catch(e) {}
        }
        
        safeCloseWebSocket(webSocket);
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
                i += 2 + len;
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
