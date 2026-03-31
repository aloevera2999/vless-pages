/**
 * VLESS Proxy with Twitter/X Support
 * 增强版：支持主动 ProxyIP 模式
 * 
 * 关键改进：
 * 1. 所有流量优先通过 ProxyIP 出口（解决 Twitter/X 封禁 CF IP 问题）
 * 2. 支持环境变量配置 ProxyIP
 * 3. 失败时自动切换备用 ProxyIP
 */

// @ts-ignore
import { connect } from 'cloudflare:sockets';

// ==================== 配置区域 ====================

// UUID - 从环境变量读取，如未设置则使用默认值
const UUID = globalThis.UUID || '14694400-88b4-4c77-9072-adfb729652cd';

// 主动 ProxyIP 模式开关
// true: 所有流量都通过 ProxyIP 出口（推荐用于访问 Twitter/X）
// false: 仅在直连失败时使用 ProxyIP
const FORCE_PROXY_MODE = globalThis.FORCE_PROXY_MODE !== 'false'; // 默认开启

// ProxyIP 列表 - 从环境变量或使用默认列表
// 这些 IP 是 Cloudflare 的优选 IP，用于绕过服务封禁
// 已针对中国移动网络优化（测试日期：2026-03-31）
const proxyIPs = globalThis.PROXYIP 
    ? globalThis.PROXYIP.split(',').map(ip => ip.trim())
    : [
        // 中国移动网络优选 IP（按延迟排序）
        '162.159.201.100',   // 日本 - 51ms（最优，强烈推荐）
        '162.159.201.1',     // 日本 - 54ms（次优，稳定）
        '162.159.195.1',     // 香港 - 168ms（香港最优）
        '162.159.192.1',     // 香港 - 171ms（香港备用）
        '162.159.204.1',     // 新加坡 - 153ms（东南亚）
        // 备用 IP 段（CIDR 格式，随机选择）
        '162.159.192.0/24',  // 香港节点池
        '162.159.201.0/24',  // 日本节点池
        '104.16.100.0/24',   // Cloudflare CDN 备用
    ];

// 随机选择一个具体的 ProxyIP
function getRandomProxyIP() {
    const ipRange = proxyIPs[Math.floor(Math.random() * proxyIPs.length)];
    
    // 如果是 CIDR 格式，随机生成一个具体 IP
    if (ipRange.includes('/')) {
        const [baseIP, prefix] = ipRange.split('/');
        const prefixNum = parseInt(prefix);
        const parts = baseIP.split('.').map(Number);
        
        // 根据前缀长度计算可变部分
        const variableBits = 32 - prefixNum;
        const maxHosts = Math.pow(2, variableBits) - 1;
        const randomHost = Math.floor(Math.random() * maxHosts);
        
        // 转换为 IP 地址
        const ipNum = (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
        const resultIP = ipNum + randomHost;
        
        return [
            (resultIP >> 24) & 255,
            (resultIP >> 16) & 255,
            (resultIP >> 8) & 255,
            resultIP & 255
        ].join('.');
    }
    
    return ipRange;
}

// 当前使用的 ProxyIP（初始化时随机选择）
let currentProxyIP = getRandomProxyIP();

// 超时设置（毫秒）
const CONNECT_TIMEOUT = 10000;
const SOCKET_TIMEOUT = 30000;
const MAX_RETRIES = 3;  // 最大重试次数

// DNS 服务器（用于 DoH）
const dnsServers = [
    'https://1.1.1.1/dns-query',
    'https://8.8.8.8/dns-query',
    'https://9.9.9.9/dns-query'
];

// WebSocket 状态
const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;

// ==================== 主请求处理 ====================

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // 从环境变量更新配置
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
            service: 'VLESS Proxy - Twitter/X Enabled',
            version: '3.0',
            uuid: UUID,
            domain: url.hostname,
            proxy_mode: FORCE_PROXY_MODE ? 'force' : 'fallback',
            current_proxy_ip: currentProxyIP,
            timestamp: new Date().toISOString(),
            cf: {
                colo: request.cf?.colo,
                country: request.cf?.country
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    // 配置信息
    if (url.pathname === '/config') {
        const vlessLink = `vless://${UUID}@${url.hostname}:443?encryption=none&security=tls&sni=${url.hostname}&fp=randomized&type=ws&host=${url.hostname}&path=%2F%3Fed%3D2048#VLESS-Twitter`;
        
        return new Response(JSON.stringify({
            uuid: UUID,
            server: url.hostname,
            port: 443,
            encryption: 'none',
            security: 'tls',
            type: 'ws',
            host: url.hostname,
            path: '/?ed=2048',
            proxy_mode: FORCE_PROXY_MODE ? 'force' : 'fallback',
            current_proxy_ip: currentProxyIP,
            vless_link: vlessLink,
            note: '支持 Twitter/X 访问'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 切换 ProxyIP（用于调试）
    if (url.pathname === '/switch-proxy') {
        currentProxyIP = getRandomProxyIP();
        return new Response(JSON.stringify({
            new_proxy_ip: currentProxyIP,
            message: 'ProxyIP 已切换'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
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
        console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
    };
    
    const earlyDataHeader = request.headers.get('sec-websocket-protocol') || '';
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
                const writer = remoteSocketWrapper.value.writable.getWriter();
                await writer.write(chunk);
                writer.releaseLock();
                return;
            }
            
            const {
                hasError,
                message,
                portRemote = 443,
                addressRemote = '',
                rawDataIndex,
                vlessVersion = new Uint8Array([0, 0]),
                isUDP,
            } = processVlessHeader(chunk, UUID);
            
            address = addressRemote;
            portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp ' : 'tcp '}`;
            
            if (hasError) {
                log('VLESS header error:', message);
                webSocket.close(1008, message);
                return;
            }
            
            if (isUDP) {
                if (portRemote === 53) {
                    isDns = true;
                } else {
                    log('UDP proxy rejected - not DNS port');
                    webSocket.close(1008, 'UDP proxy only enabled for DNS');
                    return;
                }
            }
            
            const vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
            const rawClientData = chunk.slice(rawDataIndex);
            
            if (isDns) {
                const { write } = await handleUDPOutBound(webSocket, vlessResponseHeader, log);
                udpStreamWrite = write;
                udpStreamWrite(rawClientData);
                return;
            }
            
            await handleTCPOutBound(
                remoteSocketWrapper,
                addressRemote,
                portRemote,
                rawClientData,
                webSocket,
                vlessResponseHeader,
                log
            );
        },
        close() {
            log('readableWebSocketStream is closed');
        },
        abort(reason) {
            log('readableWebSocketStream is aborted', JSON.stringify(reason));
        },
    })).catch((err) => {
        log('readableWebSocketStream pipeTo error', err);
        webSocket.close(1011, 'Internal error');
    });
    
    return new Response(null, {
        status: 101,
        // @ts-ignore
        webSocket: client,
    });
}

// ==================== TCP 出站处理（核心改进） ====================

async function handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, webSocket, vlessResponseHeader, log) {
    let retryCount = 0;
    let lastError = null;
    
    // 带超时的连接函数
    async function connectWithTimeout(address, port, timeout = CONNECT_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Connection timeout to ${address}:${port}`));
            }, timeout);
            
            try {
                const tcpSocket = connect({
                    hostname: address,
                    port: port,
                });
                
                const socketTimeoutId = setTimeout(() => {
                    if (tcpSocket && !tcpSocket.closed) {
                        tcpSocket.close();
                    }
                }, SOCKET_TIMEOUT);
                
                tcpSocket.closed.then(() => {
                    clearTimeout(socketTimeoutId);
                }).catch(() => {
                    clearTimeout(socketTimeoutId);
                });
                
                clearTimeout(timeoutId);
                resolve(tcpSocket);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
    
    // 连接并写入数据
    async function connectAndWrite(address, port) {
        const tcpSocket = await connectWithTimeout(address, port);
        remoteSocket.value = tcpSocket;
        log(`Connected to ${address}:${port}`);
        
        const writer = tcpSocket.writable.getWriter();
        await writer.write(rawClientData);
        writer.releaseLock();
        
        return tcpSocket;
    }
    
    // 重试函数（切换 ProxyIP）
    async function retry() {
        retryCount++;
        currentProxyIP = getRandomProxyIP();
        log(`Retry #${retryCount} with new ProxyIP: ${currentProxyIP}`);
        
        try {
            const tcpSocket = await connectAndWrite(currentProxyIP, portRemote);
            remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, retryCount < MAX_RETRIES ? retry : null, log);
        } catch (error) {
            lastError = error;
            log(`Retry #${retryCount} failed: ${error.message}`);
            
            if (retryCount < MAX_RETRIES) {
                await retry();
            } else {
                log('All retries exhausted');
                safeCloseWebSocket(webSocket);
            }
        }
    }
    
    // 主连接逻辑
    try {
        if (FORCE_PROXY_MODE) {
            // 主动 ProxyIP 模式：所有流量都通过 ProxyIP
            log(`FORCE_PROXY_MODE enabled - using ProxyIP: ${currentProxyIP}`);
            const tcpSocket = await connectAndWrite(currentProxyIP, portRemote);
            remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, retry, log);
        } else {
            // 传统模式：先直连，失败后使用 ProxyIP
            try {
                log(`Direct connection to ${addressRemote}:${portRemote}`);
                const tcpSocket = await connectAndWrite(addressRemote, portRemote);
                remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, retry, log);
            } catch (directError) {
                log(`Direct connection failed: ${directError.message}, trying ProxyIP`);
                const tcpSocket = await connectAndWrite(currentProxyIP, portRemote);
                remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, retry, log);
            }
        }
    } catch (error) {
        log(`Connection failed: ${error.message}`);
        safeCloseWebSocket(webSocket);
    }
}

// ==================== WebSocket 流处理 ====================

function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
    let readableStreamCancel = false;
    const stream = new ReadableStream({
        start(controller) {
            webSocketServer.addEventListener('message', (event) => {
                if (readableStreamCancel) return;
                controller.enqueue(event.data);
            });
            
            webSocketServer.addEventListener('close', () => {
                safeCloseWebSocket(webSocketServer);
                if (!readableStreamCancel) {
                    controller.close();
                }
            });
            
            webSocketServer.addEventListener('error', (err) => {
                controller.error(err);
            });
            
            const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
            if (error) {
                controller.error(error);
            } else if (earlyData) {
                controller.enqueue(earlyData);
            }
        },
        pull(controller) {},
        cancel(reason) {
            if (readableStreamCancel) return;
            log(`ReadableStream was canceled, due to ${reason}`);
            readableStreamCancel = true;
            safeCloseWebSocket(webSocketServer);
        }
    });
    return stream;
}

// ==================== VLESS 协议处理 ====================

function processVlessHeader(vlessBuffer, userID) {
    if (vlessBuffer.byteLength < 24) {
        return { hasError: true, message: 'invalid data' };
    }
    
    const version = new Uint8Array(vlessBuffer.slice(0, 1));
    let isValidUser = false;
    let isUDP = false;
    
    if (stringify(new Uint8Array(vlessBuffer.slice(1, 17))) === userID) {
        isValidUser = true;
    }
    
    if (!isValidUser) {
        return { hasError: true, message: 'invalid user' };
    }
    
    const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
    const command = new Uint8Array(vlessBuffer.slice(18 + optLength, 18 + optLength + 1))[0];
    
    if (command === 1) {
        // TCP
    } else if (command === 2) {
        isUDP = true;
    } else {
        return { hasError: true, message: `command ${command} is not support` };
    }
    
    const portIndex = 18 + optLength + 1;
    const portBuffer = vlessBuffer.slice(portIndex, portIndex + 2);
    const portRemote = new DataView(portBuffer).getUint16(0);
    
    let addressIndex = portIndex + 2;
    const addressBuffer = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1));
    const addressType = addressBuffer[0];
    
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
            const dataView = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
            const ipv6 = [];
            for (let i = 0; i < 8; i++) {
                ipv6.push(dataView.getUint16(i * 2).toString(16));
            }
            addressValue = ipv6.join(':');
            break;
        default:
            return { hasError: true, message: `invalid addressType ${addressType}` };
    }
    
    if (!addressValue) {
        return { hasError: true, message: `addressValue is empty` };
    }
    
    return {
        hasError: false,
        addressRemote: addressValue,
        addressType,
        portRemote,
        rawDataIndex: addressValueIndex + addressLength,
        vlessVersion: version,
        isUDP,
    };
}

// ==================== Socket 转发 ====================

async function remoteSocketToWS(remoteSocket, webSocket, vlessResponseHeader, retry, log) {
    let vlessHeader = vlessResponseHeader;
    let hasIncomingData = false;
    
    await remoteSocket.readable.pipeTo(
        new WritableStream({
            start() {},
            async write(chunk, controller) {
                hasIncomingData = true;
                if (webSocket.readyState !== WS_READY_STATE_OPEN) {
                    controller.error('webSocket.readyState is not open');
                }
                if (vlessHeader) {
                    webSocket.send(await new Blob([vlessHeader, chunk]).arrayBuffer());
                    vlessHeader = null;
                } else {
                    webSocket.send(chunk);
                }
            },
            close() {
                log(`remoteConnection.readable is closed with hasIncomingData: ${hasIncomingData}`);
            },
            abort(reason) {
                log(`remoteConnection.readable abort`, reason);
            },
        })
    ).catch((error) => {
        log(`remoteSocketToWS exception`, error.stack || error);
        safeCloseWebSocket(webSocket);
    });
    
    if (hasIncomingData === false && retry) {
        log(`No incoming data, starting retry`);
        retry();
    }
}

// ==================== UDP/DNS 处理 ====================

async function handleUDPOutBound(webSocket, vlessResponseHeader, log) {
    let isVlessHeaderSent = false;
    const transformStream = new TransformStream({
        start(controller) {},
        transform(chunk, controller) {
            for (let index = 0; index < chunk.byteLength;) {
                const lengthBuffer = chunk.slice(index, index + 2);
                const udpPacketLength = new DataView(lengthBuffer).getUint16(0);
                const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + udpPacketLength));
                index = index + 2 + udpPacketLength;
                controller.enqueue(udpData);
            }
        },
        flush(controller) {}
    });
    
    transformStream.readable.pipeTo(new WritableStream({
        async write(chunk) {
            for (const dnsServer of dnsServers) {
                try {
                    const resp = await fetch(dnsServer, {
                        method: 'POST',
                        headers: { 'content-type': 'application/dns-message' },
                        body: chunk,
                    });
                    
                    if (resp.ok) {
                        const dnsQueryResult = await resp.arrayBuffer();
                        const udpSize = dnsQueryResult.byteLength;
                        const udpSizeBuffer = new Uint8Array([(udpSize >> 8) & 0xff, udpSize & 0xff]);
                        
                        if (webSocket.readyState === WS_READY_STATE_OPEN) {
                            if (isVlessHeaderSent) {
                                webSocket.send(await new Blob([udpSizeBuffer, dnsQueryResult]).arrayBuffer());
                            } else {
                                webSocket.send(await new Blob([vlessResponseHeader, udpSizeBuffer, dnsQueryResult]).arrayBuffer());
                                isVlessHeaderSent = true;
                            }
                        }
                        return;
                    }
                } catch (error) {
                    log(`DNS server ${dnsServer} failed: ${error.message}`);
                }
            }
        }
    })).catch((error) => {
        log('DNS UDP error: ' + error);
    });
    
    const writer = transformStream.writable.getWriter();
    return {
        write(chunk) {
            writer.write(chunk);
        }
    };
}

// ==================== 工具函数 ====================

function base64ToArrayBuffer(base64Str) {
    if (!base64Str) return { error: null };
    try {
        base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
        const decode = atob(base64Str);
        const arryBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
        return { earlyData: arryBuffer.buffer, error: null };
    } catch (error) {
        return { error };
    }
}

function safeCloseWebSocket(socket) {
    try {
        if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
            socket.close();
        }
    } catch (error) {
        console.error('safeCloseWebSocket error', error);
    }
}

function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

// UUID 字符串转换
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 256).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

function stringify(arr, offset = 0) {
    const uuid = unsafeStringify(arr, offset);
    if (!isValidUUID(uuid)) {
        throw TypeError("Stringified UUID is invalid");
    }
    return uuid;
}
