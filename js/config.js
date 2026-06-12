// MATP Global Configuration Settings
// This file connects directly to the production backend servers.

const CONFIG = {
    // Production API Base URLs (Dynamic local proxy mapping with protocol fallback)
    APP_API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? window.location.origin : 'https://aimatp.harveyssx.workers.dev',
    ADMIN_API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? window.location.origin : 'https://matp-admin.qchats.org',
    MARKET_WS_URL: 'wss://matp-wss.qchats.org/ws/v1/market',
    BIZ_WS_URL: 'wss://matp-biz-wss.qchats.org/ws/v1/biz',
    
    // Application configurations
    APP_VERSION: '1.0.0',
    DEFAULT_LOCALE: 'en',
    
    // Constant for offline simulation toggle. Disabled for production security.
    USE_MOCK: false,
    
    // Withdrawal fee rate configured in the backend
    WITHDRAW_FEE_RATE: 0.20,

    // Fallback minimum withdrawal amounts if bootstrap-config API fails
    MIN_WITHDRAW_USDT: 10,
    MIN_WITHDRAW_INR: 100
};

// Bind CONFIG globally
window.CONFIG = CONFIG;
// Empty placeholder Broadcast Channel for compatibility, actual real-time is handled via WS
window.bizChannel = new BroadcastChannel('matp_biz_events');
