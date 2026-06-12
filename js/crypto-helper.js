// Lexical stable stringify and HMAC-SHA256 signature helpers using modern native Web Crypto API
// Conforms strictly to SIGN-SPEC-1.0 for production security authentication.

function getLocalizedError(key) {
    const locale = window.currentLocale || localStorage.getItem('ait_app_locale') || localStorage.getItem('matp_lang') || 'en';
    const dict = {
        'rate_limit': {
            'en': '⚠️ Too many requests, please try again later.',
            'hi': '⚠️ बहुत अधिक अनुरोध, कृपया बाद में पुनः प्रयास करें।'
        },
        'network_cors': {
            'en': '⚠️ Network connection failed or blocked by CORS! If you are using a local development environment, please [completely close all opened Chrome browser windows], and then double-click [start_chrome_no_cors.bat] to bypass CORS restrictions.',
            'hi': '⚠️ नेटवर्क कनेक्शन विफल या CORS द्वारा अवरुद्ध! यदि आप स्थानीय विकास परिवेश का उपयोग कर रहे हैं, तो कृपया [सभी खुले हुए Chrome ब्राउज़र विंडो को पूरी तरह से बंद करें], और फिर CORS प्रतिबंधों को बायपास करने के लिए [start_chrome_no_cors.bat] पर double-click करें।'
        },
        'network_failed': {
            'en': 'Network connection failed',
            'hi': 'नेटवर्क कनेक्शन विफल'
        }
    };
    return (dict[key] && dict[key][locale]) ? dict[key][locale] : (dict[key] ? dict[key]['en'] : key);
}

/**
 * Lexicographical stable stringify for JSON bodies according to SIGN-SPEC-1.0.
 * Rules:
 * 1. Fields are sorted alphabetically by key ASCII.
 * 2. No extra spaces around colons, commas, braces.
 * 3. No trailing commas, no newlines.
 * 4. Empty objects/arrays are handled, but empty body is "".
 */
function stableStringify(obj) {
    if (obj === null) return 'null';
    if (obj === undefined) return '';
    if (typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(item => item === null ? 'null' : stableStringify(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const parts = keys.map(key => {
        const val = obj[key];
        return JSON.stringify(key) + ':' + (val === null ? 'null' : stableStringify(val));
    });
    return '{' + parts.join(',') + '}';
}

/**
 * Helper to convert Base64 string to Uint8Array.
 * Falls back safely to TextEncoder UTF-8 if decoding fails.
 */
function base64ToUint8Array(base64Str) {
    try {
        const binaryString = atob(base64Str);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        return new TextEncoder().encode(base64Str);
    }
}

/**
 * Natively compute HMAC-SHA256 hex string using browser Web Crypto API.
 */
async function hmacSha256(keyStr, messageStr) {
    const encoder = new TextEncoder();
    const keyData = base64ToUint8Array(keyStr);
    const messageData = encoder.encode(messageStr);
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    
    // Convert to lowercase hex string
    return Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generate standard signature payload following APP Signature Specification.
 * Payload = METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + BODY
 */
async function signRequest(method, path, timestamp, bodyJsonStr, sessionKey) {
    const payload = method.toUpperCase() + '\n' + path + '\n' + timestamp + '\n' + bodyJsonStr;
    return await hmacSha256(sessionKey, payload);
}

// --- Client-Side Rate Limiting Protection Guard (Section 3.1 API Spec) ---
const requestTimestamps = [];
const tradePlaceTimestamps = [];
const tradeCancelTimestamps = [];

function checkRateLimit(path) {
    const now = Date.now();
    
    // Clean old records
    // 1. Global: 10 seconds rolling window
    while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 10000) {
        requestTimestamps.shift();
    }
    // 2. Place Order: 1 second rolling window
    while (tradePlaceTimestamps.length > 0 && now - tradePlaceTimestamps[0] > 1000) {
        tradePlaceTimestamps.shift();
    }
    // 3. Cancel Order: 1 second rolling window
    while (tradeCancelTimestamps.length > 0 && now - tradeCancelTimestamps[0] > 1000) {
        tradeCancelTimestamps.shift();
    }
    
    // Normalize path by removing query string parameters
    const cleanPath = path.split('?')[0];
    
    // Path routing checks
    const isPlaceOrder = cleanPath.endsWith('/trading/quant/orders') && !cleanPath.includes('/cancel');
    const isCancelOrder = cleanPath.includes('/trading/quant/orders') && cleanPath.includes('/cancel');
    
    if (isPlaceOrder) {
        if (tradePlaceTimestamps.length >= 20) {
            console.warn('Place Order client rate limit triggered (20 req / s)');
            return false;
        }
        tradePlaceTimestamps.push(now);
    }
    
    if (isCancelOrder) {
        if (tradeCancelTimestamps.length >= 20) {
            console.warn('Cancel Order client rate limit triggered (20 req / s)');
            return false;
        }
        tradeCancelTimestamps.push(now);
    }
    
    // Global IP / UID Guard: 100 req / 10s. Keep a safety margin of 90 req / 10s.
    if (requestTimestamps.length >= 90) {
        console.warn('Global client rate limit triggered (90 req / 10s)');
        return false;
    }
    
    requestTimestamps.push(now);
    return true;
}

/**
 * Unified API Fetch Client that supports transparent automatic request signing.
 * Features production-grade disaster recovery parser for non-JSON responses to completely avoid frontend screen crashes.
 */
async function apiFetch(method, path, body = null, requireAuth = true) {
    method = method.toUpperCase();
    const timestamp = Date.now().toString();
    
    // Natively generate and persist unique device UUID following SIGN-SPEC-1.0 to bypass risk controls
    let deviceId = localStorage.getItem('matp_device_id');
    if (!deviceId) {
        deviceId = 'dev_' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('matp_device_id', deviceId);
    }
    
    // Normalize path with `/api/v1` prefix
    let realPath = path.startsWith('/api/v1') ? path : '/api/v1' + path;
    
    // Add trailing slash only to specific admin endpoints that require it (users, kyc, tenants, risk-levels)
    const pathsWithTrailingSlash = [
        '/api/v1/users',
        '/api/v1/users/kyc',
        '/api/v1/tenants',
        '/api/v1/users/risk-levels'
    ];
    let [pathPart, queryPart] = realPath.split('?');
    if (pathsWithTrailingSlash.includes(pathPart) && !pathPart.endsWith('/')) {
        pathPart += '/';
    }
    realPath = queryPart ? `${pathPart}?${queryPart}` : pathPart;

    // Client-side rate-limiting check conforming to 3.1
    if (!checkRateLimit(realPath)) {
        return {
            code: 429,
            errorMessage: getLocalizedError('rate_limit')
        };
    }
    
    // Stable serialization of body: empty objects/arrays evaluate to "" for signatures (per 3-API调用规范.md)
    let bodyStr = '';
    if (body !== null && (typeof body !== 'object' || Object.keys(body).length > 0)) {
        bodyStr = stableStringify(body);
    }
    
    // Intelligent environment routing: detect admin page context or admin routes
    let baseUrl = CONFIG.APP_API_BASE;
    const isAdminRequest = window.isAdminPanel === true || window.location.pathname.includes('admin') || realPath.startsWith('/api/v1/admin') || realPath.includes('audit') || realPath.includes('approve') || realPath.includes('reject');
    const isCommonEndpoint = realPath.includes('/common/');
    const isAdminPageContext = window.isAdminPanel === true || window.location.pathname.includes('admin');
    const routeToAdmin = (isAdminPageContext || isAdminRequest) && !isCommonEndpoint;
    if (routeToAdmin) {
        baseUrl = CONFIG.ADMIN_API_BASE;
    }
    
    // Retrieve Auth Credentials
    const accessToken = localStorage.getItem('matp_access_token');
    const sessionKey = localStorage.getItem('matp_session_key');
    
    const headers = {
        'Content-Type': 'application/json',
        'X-App-Version': CONFIG.APP_VERSION,
        'X-Device-Id': deviceId,
        'X-Timestamp': timestamp,
        'X-Locale': CONFIG.DEFAULT_LOCALE
    };
    
    // Admin API endpoints are strictly cookie-based and must not carry User App Bearer Tokens
    if (requireAuth && accessToken && !routeToAdmin) {
        headers['X-Token'] = `Bearer ${accessToken}`;
        if (sessionKey) {
            // Apply HMAC signature strictly conforming to SIGN-SPEC-1.0: exclude QueryString from path
            const signaturePath = realPath.split('?')[0];
            const signature = await signRequest(method, signaturePath, timestamp, bodyStr, sessionKey);
            headers['X-Signature'] = signature;
        }
    }
    
    try {
        const finalPath = routeToAdmin ? '/admin-proxy' + realPath : realPath;
        const response = await fetch(baseUrl + finalPath, {
            method: method,
            headers: headers,
            credentials: routeToAdmin ? 'include' : 'same-origin',
            cache: 'no-store',
            body: method !== 'GET' && method !== 'DELETE' && body !== null ? bodyStr : undefined
        });
        
        // Disaster-recovery safe parser for non-JSON or HTTP error responses
        const text = await response.text();
        
        // Check for 401 unauthorized session expiration
        if (response.status === 401) {
            if (localStorage.getItem('matp_access_token')) {
                localStorage.removeItem('matp_access_token');
                localStorage.removeItem('matp_session_key');
                localStorage.removeItem('matp_user_uid');
                localStorage.removeItem('matp_user_nickname');
                localStorage.removeItem('matp_user_email');
                localStorage.removeItem('matp_user_kyc');
                setTimeout(() => {
                    if (window.checkAuthSession) window.checkAuthSession();
                }, 100);
            }
        }
        
        try {
            const parsed = JSON.parse(text);
            if (parsed.code === 401) {
                if (localStorage.getItem('matp_access_token')) {
                    localStorage.removeItem('matp_access_token');
                    localStorage.removeItem('matp_session_key');
                    localStorage.removeItem('matp_user_uid');
                    localStorage.removeItem('matp_user_nickname');
                    localStorage.removeItem('matp_user_email');
                    localStorage.removeItem('matp_user_kyc');
                    setTimeout(() => {
                        if (window.checkAuthSession) window.checkAuthSession();
                    }, 100);
                }
            }
            return parsed;
        } catch(e) {
            console.error('API response is not a valid JSON string:', text);
            return {
                code: response.status,
                errorMessage: text || `Server responded with status code: ${response.status}`
            };
        }
    } catch(e) {
        console.error('Network request failed or endpoint unreachable:', e);
        return {
            code: 500,
            errorMessage: getLocalizedError('network_cors')
        };
    }
}

/**
 * Like apiFetch but returns raw response text string instead of parsed JSON.
 * Use when you need to handle BigInt IDs (>2^53) without precision loss.
 */
async function apiFetchRaw(method, path, body = null, requireAuth = true) {
    method = method.toUpperCase();
    const timestamp = Date.now().toString();
    
    let deviceId = localStorage.getItem('matp_device_id');
    if (!deviceId) {
        deviceId = 'dev_' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('matp_device_id', deviceId);
    }
    
    let realPath = path.startsWith('/api/v1') ? path : '/api/v1' + path;
    
    // Add trailing slash only to specific admin endpoints that require it (users, kyc, tenants, risk-levels)
    const pathsWithTrailingSlash = [
        '/api/v1/users',
        '/api/v1/users/kyc',
        '/api/v1/tenants',
        '/api/v1/users/risk-levels'
    ];
    let [pathPart, queryPart] = realPath.split('?');
    if (pathsWithTrailingSlash.includes(pathPart) && !pathPart.endsWith('/')) {
        pathPart += '/';
    }
    realPath = queryPart ? `${pathPart}?${queryPart}` : pathPart;

    // Client-side rate-limiting check conforming to 3.1
    if (!checkRateLimit(realPath)) {
        return JSON.stringify({
            code: 429,
            errorMessage: getLocalizedError('rate_limit')
        });
    }
    // Stable serialization of body: empty objects/arrays evaluate to "" for signatures (per 3-API调用规范.md)
    let bodyStr = '';
    if (body !== null && (typeof body !== 'object' || Object.keys(body).length > 0)) {
        bodyStr = stableStringify(body);
    }
    
    let baseUrl = CONFIG.APP_API_BASE;
    const isAdminRequest = window.isAdminPanel === true || window.location.pathname.includes('admin') || realPath.startsWith('/api/v1/admin') || realPath.includes('audit') || realPath.includes('approve') || realPath.includes('reject');
    const isCommonEndpoint = realPath.includes('/common/');
    const isAdminPageContext = window.isAdminPanel === true || window.location.pathname.includes('admin');
    const routeToAdmin = (isAdminPageContext || isAdminRequest) && !isCommonEndpoint;
    if (routeToAdmin) {
        baseUrl = CONFIG.ADMIN_API_BASE;
    }
    
    const accessToken = localStorage.getItem('matp_access_token');
    const sessionKey = localStorage.getItem('matp_session_key');
    
    const headers = {
        'Content-Type': 'application/json',
        'X-App-Version': CONFIG.APP_VERSION,
        'X-Device-Id': deviceId,
        'X-Timestamp': timestamp,
        'X-Locale': CONFIG.DEFAULT_LOCALE
    };
    
    if (requireAuth && accessToken && !routeToAdmin) {
        headers['X-Token'] = `Bearer ${accessToken}`;
        if (sessionKey) {
            // Apply HMAC signature strictly conforming to SIGN-SPEC-1.0: exclude QueryString from path
            const signaturePath = realPath.split('?')[0];
            const signature = await signRequest(method, signaturePath, timestamp, bodyStr, sessionKey);
            headers['X-Signature'] = signature;
        }
    }
    
    try {
        const finalPath = routeToAdmin ? '/admin-proxy' + realPath : realPath;
        const response = await fetch(baseUrl + finalPath, {
            method: method,
            headers: headers,
            credentials: routeToAdmin ? 'include' : 'same-origin',
            cache: 'no-store',
            body: method !== 'GET' && method !== 'DELETE' && body !== null ? bodyStr : undefined
        });
        return await response.text();
    } catch(e) {
        console.error('apiFetchRaw failed:', e);
        return JSON.stringify({ code: 500, errorMessage: getLocalizedError('network_failed') });
    }
}

/**
 * Like apiFetch but sends a pre-built raw JSON string body, bypassing stableStringify.
 * Use when body contains BigInt values (e.g., paymentMethodAssetId) that must not go through JSON number parsing.
 */
async function apiFetchWithRawBody(method, path, rawBodyStr, requireAuth = true) {
    method = method.toUpperCase();
    const timestamp = Date.now().toString();
    
    let deviceId = localStorage.getItem('matp_device_id');
    if (!deviceId) {
        deviceId = 'dev_' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('matp_device_id', deviceId);
    }
    
    let realPath = path.startsWith('/api/v1') ? path : '/api/v1' + path;
    
    // Add trailing slash only to specific admin endpoints that require it (users, kyc, tenants, risk-levels)
    const pathsWithTrailingSlash = [
        '/api/v1/users',
        '/api/v1/users/kyc',
        '/api/v1/tenants',
        '/api/v1/users/risk-levels'
    ];
    let [pathPart, queryPart] = realPath.split('?');
    if (pathsWithTrailingSlash.includes(pathPart) && !pathPart.endsWith('/')) {
        pathPart += '/';
    }
    realPath = queryPart ? `${pathPart}?${queryPart}` : pathPart;

    // Client-side rate-limiting check conforming to 3.1
    if (!checkRateLimit(realPath)) {
        return {
            code: 429,
            errorMessage: getLocalizedError('rate_limit')
        };
    }
    
    let baseUrl = CONFIG.APP_API_BASE;
    const isAdminRequest = window.isAdminPanel === true || window.location.pathname.includes('admin') || realPath.startsWith('/api/v1/admin') || realPath.includes('audit') || realPath.includes('approve') || realPath.includes('reject');
    const isCommonEndpoint = realPath.includes('/common/');
    const isAdminPageContext = window.isAdminPanel === true || window.location.pathname.includes('admin');
    const routeToAdmin = (isAdminPageContext || isAdminRequest) && !isCommonEndpoint;
    if (routeToAdmin) {
        baseUrl = CONFIG.ADMIN_API_BASE;
    }
    
    const accessToken = localStorage.getItem('matp_access_token');
    const sessionKey = localStorage.getItem('matp_session_key');
    
    const headers = {
        'Content-Type': 'application/json',
        'X-App-Version': CONFIG.APP_VERSION,
        'X-Device-Id': deviceId,
        'X-Timestamp': timestamp,
        'X-Locale': CONFIG.DEFAULT_LOCALE
    };
    
    if (requireAuth && accessToken && !routeToAdmin) {
        headers['X-Token'] = `Bearer ${accessToken}`;
        if (sessionKey) {
            // Apply HMAC signature strictly conforming to SIGN-SPEC-1.0: exclude QueryString from path
            const signaturePath = realPath.split('?')[0];
            const signature = await signRequest(method, signaturePath, timestamp, rawBodyStr, sessionKey);
            headers['X-Signature'] = signature;
        }
    }
    
    try {
        const finalPath = routeToAdmin ? '/admin-proxy' + realPath : realPath;
        const response = await fetch(baseUrl + finalPath, {
            method: method,
            headers: headers,
            credentials: routeToAdmin ? 'include' : 'same-origin',
            cache: 'no-store',
            body: rawBodyStr
        });
        
        const text = await response.text();
        
        if (response.status === 401) {
            if (localStorage.getItem('matp_access_token')) {
                ['matp_access_token','matp_session_key','matp_user_uid','matp_user_nickname','matp_user_email','matp_user_kyc'].forEach(k => localStorage.removeItem(k));
                setTimeout(() => { if (window.checkAuthSession) window.checkAuthSession(); }, 100);
            }
        }
        
        try {
            return JSON.parse(text);
        } catch(e) {
            return { code: response.status, errorMessage: text || `HTTP ${response.status}` };
        }
    } catch(e) {
        console.error('apiFetchWithRawBody failed:', e);
        return { code: 500, errorMessage: getLocalizedError('network_failed') };
    }
}

// Attach signature helpers to window for easy debugging and custom extensions
window.stableStringify = stableStringify;
window.hmacSha256 = hmacSha256;
window.apiFetch = apiFetch;
window.apiFetchRaw = apiFetchRaw;
window.apiFetchWithRawBody = apiFetchWithRawBody;
