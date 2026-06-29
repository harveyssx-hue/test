// js/admin/app.js
window.isAdminPanel = true;
import { state } from './state.js';

// Cache buster for ESM pages and views
const ADMIN_APP_VERSION = Date.now();

// Global variables
window.currentAdmin = null;
window.activeTab = 'welcome';
window.bizWs = null;
window.exchangeRatesList = [];
window.userAccountCache = window.userAccountCache || {};
window.currentReferralUserId = null;
window.currentReferralUserNickname = '';
window.cachedSubjects = [];
window.adminReloadTimeout = null;
window.lastAdminReloadTime = 0;

// Expose state globally
window.adminState = state;

// Map tabs to their page sub-controllers and view titles
const tabConfig = {
    'welcome': {
        title: 'æŽ§åˆ¶ä¸­å¿ƒ',
        desc: 'æ¬¢è¿Žä½¿ç”¨ MATP CORE å®¡è®¡ç®¡ç†ç³»ç»Ÿ',
        controller: 'welcome',
        init: () => {}
    },
    'kyc': {
        title: 'KYC è®¤è¯å®¡æ ¸ä¸­å¿ƒ',
        desc: 'æŒ‰ç›‘ç®¡åˆè§„è¦æ±‚å®¡è®¡è®¤è¯å…¨ç«™äº¤æ˜“å‘˜èº«ä»½åŠæ‰§ç…§',
        controller: 'kyc',
        init: () => window.loadKycList()
    },
    'risk-levels': {
        title: 'ç”¨æˆ·é£ŽæŽ§å±‚çº§ç®¡ç†',
        desc: 'é…ç½®ä¸Žç®¡ç†å…¨ç«™äº¤æ˜“å‘˜çš„é£ŽæŽ§ç­‰çº§ã€é¢åº¦é™åˆ¶ã€æçŽ°å®¡æ‰¹è§„åˆ™åŠå¯ç”¨çŠ¶æ€',
        controller: 'users',
        init: () => window.loadRiskLevelsList()
    },
    'quant': {
        title: 'ðŸ‘¥ å…¨ç«™ AI é‡åŒ–è®¢å•åˆ—è¡¨',
        desc: 'å®¡æ ¸ä¸Žç®¡ç†å…¨ç«™äº¤æ˜“å‘˜çš„é‡åŒ–å§”æ‰˜è®¢å•ï¼Œæ‰¹å‡†å¯åŠ¨æˆ–æ‹’ç»æ’¤é”€',
        controller: 'quant',
        init: () => window.loadQuantMonitor()
    },
    'quant-settle': {
        title: 'âš¡ AI é‡åŒ–äº¤æ˜“ç»“ç®—ä¸­å¿ƒ',
        desc: 'å¯¹å·²è¢«æ‰¹å‡†è¿è¡Œä¸­ (ACTIVE) çš„é‡åŒ–å§”æ‰˜è®¢å•è¿›è¡Œå•ç‹¬ã€ç­–ç•¥æ‰¹é‡æˆ–å¤šé€‰æ‰¹é‡ä»·æ ¼æ“ç›˜ä¸Žç›ˆäºç»“ç®—',
        controller: 'quant',
        init: () => window.loadQuantSettleList()
    },
    'copytrading': {
        title: 'ðŸ‘‘ å¯¼å¸ˆå¸¦å•ä¸Žè·Ÿéšåˆè§„ä¸­å¿ƒ',
        desc: 'å®¡æ ¸ä¸Žç®¡ç†ç¤¾åŒºè¾¾äººçš„å¸¦å•èµ„è´¨ï¼Œå®¡è®¡å…¨ç«™è·Ÿå•ç»‘å®šæµæ°´å¹¶å¯¹æ´»åŠ¨æŒä»“å®žæ–½å³æ—¶é£Žé™©é£ŽæŽ§',
        controller: 'quant',
        init: async () => {
            await window.loadCopyTradingStats();
            await window.switchCopyTradingSubTab('leaders');
        }
    },
    'daily-report': {
        title: 'ðŸ“Š è¿è¥æ•°æ®æ—¥æŠ¥ä¸­å¿ƒ',
        desc: 'æŸ¥çœ‹ä¸Žåˆ†æžä»Šæ—¥å…¨ç«™æ ¸å¿ƒæ³¨å†Œå¢žé•¿ã€å……å€¼æçŽ°è´¢åŠ¡æŒ‡æ ‡ã€ä»¥åŠé‡åŒ–ç­–ç•¥æ“ç›˜çš„æ¸…ç®—æ”¶ç›Šæ—¥æŠ¥',
        controller: 'system',
        init: () => window.loadDailyReport()
    },
    'users': {
        title: 'äº¤æ˜“å‘˜è´¦æˆ·ä¸Žé’±åŒ…ç®¡ç†',
        desc: 'æŸ¥çœ‹ä¸Žç®¡ç†å…¨ç«™äº¤æ˜“å‘˜ä½™é¢èµ„äº§ï¼Œæµæ°´è®°å½•ä¸Žæ³¨å†Œå±¥åŽ†',
        controller: 'users',
        init: () => window.loadUsersList()
    },
    'deposit': {
        title: 'èµ„é‡‘å…¥é‡‘å……å€¼å®¡æ ¸ä¸­å¿ƒ',
        desc: 'æ ¸å¯¹å¹¶å®¡è®¡å…¨ç«™äº¤æ˜“å‘˜ä¸Šä¼ çš„ç½‘å…³ä»˜æ¬¾æˆªå›¾ã€å‡­è¯å•å·å¹¶ç¡®è®¤ä¸Šè´¦',
        controller: 'finance',
        init: () => window.loadDepositList()
    },
    'withdraw': {
        title: 'èµ„é‡‘å‡ºé‡‘æçŽ°å®¡æ ¸ä¸­å¿ƒ',
        desc: 'å¤„ç†å¹¶å®¡è®¡äº¤æ˜“å‘˜çš„ææ¬¾åœ°å€ã€å¯ç”¨é™é¢å¹¶ç¡®è®¤æœ€ç»ˆæ”¾æ¬¾æ¸…ç®—',
        controller: 'finance',
        init: () => window.loadWithdrawList()
    },
    'payment': {
        title: 'å¹³å°æ”¯ä»˜ä¸Žå‡ºå…¥é‡‘é€šé“ç®¡ç†',
        desc: 'ç®¡ç†å’Œé…ç½®äº¤æ˜“ç«¯æ˜¾ç¤ºçš„æ‰€æœ‰å……å€¼ï¼ˆCRYPTO/FIATï¼‰ä¸ŽæçŽ°æ–¹å¼ã€çŠ¶æ€å¯ç”¨ä¸Žç¦ç”¨',
        controller: 'finance',
        init: () => window.loadPaymentChannels()
    },
    'rates': {
        title: 'å¹³å°èµ„äº§ç»“ç®—æ±‡çŽ‡ç®¡ç†',
        desc: 'ç®¡ç†ä¸Žè°ƒæ•´å¹³å°å„ç§å‡ºå…¥è´¦èµ„äº§å…‘ INR æœ¬ä½å¸çš„ç»“ç®—æ±‡çŽ‡ï¼Œå®žæ—¶åº”ç”¨äºŽå……å€¼ç»“ç®—ä¸Žè®¡ä»·å±•ç¤º',
        controller: 'finance',
        init: () => window.loadExchangeRatesList()
    },
    'strategies': {
        title: 'å¹³å° AI é‡åŒ–ç­–ç•¥ç®¡ç†æŽ§åˆ¶ä¸­å¿ƒ',
        desc: 'ç®¡ç†å’Œé…ç½®äº¤æ˜“ç«¯æ˜¾ç¤ºçš„æ‰€æœ‰ AI é‡åŒ–è·Ÿå•ç­–ç•¥æ¨¡æ¿ï¼Œæ”¯æŒä¸­è‹±æ–‡åŒè¯­ç¿»è¯‘é…ç½®ã€å¯ç”¨ä¸Žç¦ç”¨',
        controller: 'quant',
        init: () => window.loadPlatformStrategies()
    },
    'tenant-settings': {
        title: 'å¹³å°ç³»ç»Ÿä¸Žç§Ÿæˆ·è®¾ç½®',
        desc: 'é…ç½®ä¸Žè°ƒæ•´ç§Ÿæˆ·çš„ç³»ç»Ÿå…¨å±€å‚æ•°ï¼ŒåŒ…æ‹¬æçŽ°æœªä½¿ç”¨èµ„é‡‘è´¹çŽ‡ã€OTPå®‰å…¨éªŒè¯ä¸Žé‡åŒ–ç»çºªè´¹çŽ‡ç­‰',
        controller: 'system',
        init: () => window.loadTenantSettings()
    },
    'manual-funding': {
        title: 'åŽå°èµ„é‡‘å­˜æç®¡ç†',
        desc: 'å®¡è®¡ä¸Žç®¡ç†å…¨ç«™äºŒçº§è¿è¥äººå‘˜æäº¤ç‰©ç†è´¦æˆ·çš„æ‰‹å·¥å……å€¼ä¸Žæ‰£æ¬¾ç”³è¯·',
        controller: 'finance',
        init: () => window.loadManualFundingList()
    },
    'manual-subjects': {
        title: 'å­˜æä¼šè®¡ç§‘ç›®ç®¡ç†',
        desc: 'ç®¡ç†å¹³å°æ‰‹å·¥èµ„é‡‘è°ƒæ•´æ‰€ä¾æ‰˜çš„ä¼šè®¡åˆ†ç±»ç§‘ç›®ã€é€‚ç”¨èŒƒå›´åŠå¯ç”¨çŠ¶æ€',
        controller: 'finance',
        init: () => window.loadManualSubjectsList()
    },
    'platform-contents': {
        title: 'å¹³å°æ–‡æ¡£ä¸Žåè®®ä¸­å¿ƒç®¡ç†',
        desc: 'ç®¡ç†ä¸Žç¼–è¾‘å‰å°å±•ç¤ºçš„æ‰€æœ‰æœåŠ¡æ¡æ¬¾åè®®ã€å¸®åŠ©å­¦é™¢ï¼ˆHELPï¼‰åŠè¿è¥æ“ä½œæç¤ºæ–‡æ¡£',
        controller: 'system',
        init: () => window.loadPlatformContentsList(1)
    },
    'instruments': {
        title: 'äº¤æ˜“å•†å“ä¸Žäº§å“ç®¡ç†ä¸­å¿ƒ',
        desc: 'é…ç½®ä¸Žè°ƒæ•´å…¨ç«™äº¤æ˜“ç»ˆç«¯ä¸Šæž¶çš„äº¤æ˜“äº§å“ã€ä¸Šæž¶çŠ¶æ€ã€æŽ¨èæƒé‡ã€æ ¸å¿ƒæ ‡ç­¾ä¸ŽåŸºç¡€å‚æ•°',
        controller: 'instruments',
        init: () => window.loadInstrumentsList()
    },
    'app-versions': {
        title: 'APP ç‰ˆæœ¬æ›´æ–°ç®¡ç†ä¸­å¿ƒ',
        desc: 'é…ç½®ä¸Žå‘å¸ƒ iOS å’Œ Android å®¢æˆ·ç«¯çš„æœ€æ–°å¯ç”¨ç‰ˆæœ¬ã€æœ€ä½Žç‰ˆæœ¬æŽ§åˆ¶ä»¥åŠå¼ºæ›´å‡çº§è®¾ç½®',
        controller: 'system',
        init: () => window.loadAppVersionsList()
    },
    'support-channels': {
        title: 'åœ¨çº¿å®¢æœé€šé“ç®¡ç†',
        desc: 'é…ç½®ä¸Žç®¡ç†ç”¨æˆ·å®¢æˆ·ç«¯å±•ç¤ºçš„åœ¨çº¿å®¢æœé€šé“ï¼Œä¾‹å¦‚ç»‘å®š WhatsApp, Telegram ç­‰',
        controller: 'system',
        init: () => window.loadSupportChannelsList()
    },
    'holidays': {
        title: 'å¹³å°äº¤æ˜“å‡æœŸç®¡ç†',
        desc: 'é…ç½®ä¸Žå‘å¸ƒå„äº¤æ˜“å¸‚åœºå‡æœŸå®‰æŽ’ï¼Œæ”¯æŒæ‰‹åŠ¨é…ç½®ã€åŒæ­¥å¤–éƒ¨æŽ¥å£ä»¥è‡ªåŠ¨åŒ–é£ŽæŽ§åŠä¼‘å¸‚æœºåˆ¶',
        controller: 'holidays',
        init: () => window.loadHolidaysList()
    },
    'locales': {
        title: 'ç³»ç»Ÿ Locale è¯­è¨€ç®¡ç†',
        desc: 'ç®¡ç†å’Œé…ç½®å‰ç«¯æ”¯æŒçš„å¤šè¯­è¨€æ ‡ç­¾ã€åç§°å±•ç¤ºã€å›¾æ ‡å›½æ——ï¼Œå¯ç”¨æˆ–ç¦ç”¨å›½é™…åŒ–è¯­ç§',
        controller: 'system',
        init: () => window.loadLocalesList()
    },
    'error-reports': {
        title: 'å®¢æˆ·ç«¯é”™è¯¯ä¸ŠæŠ¥è®°å½•',
        desc: 'åˆ†é¡µå¹¶ç­›é€‰æŸ¥çœ‹ APP å®¢æˆ·ç«¯ï¼ˆiOS/Androidï¼‰ä¸ŠæŠ¥çš„å´©æºƒåŠä¸šåŠ¡å¤„ç†é”™è¯¯ï¼ŒæŽ’æŸ¥å †æ ˆä¸Šä¸‹æ–‡',
        controller: 'system',
        init: () => window.loadErrorReportsList()
    }
};

// Sidebar collapse/expand
export function toggleMenuGroup(groupName, forceState) {
    const itemsEl = document.getElementById(`group-${groupName}-items`);
    const titleEl = document.getElementById(`group-${groupName}-title`);
    if (!itemsEl || !titleEl) return;
    
    const isCollapsed = forceState !== undefined ? !forceState : itemsEl.style.display !== 'none';
    if (isCollapsed) {
        itemsEl.style.display = 'none';
        titleEl.classList.add('collapsed');
    } else {
        itemsEl.style.display = 'block';
        titleEl.classList.remove('collapsed');
    }
}
window.toggleMenuGroup = toggleMenuGroup;

export function initializeSidebarGroups() {
    const activeItem = document.querySelector('.sidebar-menu .menu-item.active');
    const activeGroup = activeItem ? activeItem.closest('.menu-group-items') : null;
    const allGroups = document.querySelectorAll('.menu-group-items');
    
    allGroups.forEach(g => {
        const groupId = g.id.replace('group-', '').replace('-items', '');
        if (g === activeGroup || (!activeItem && groupId === 'control')) {
            toggleMenuGroup(groupId, true);
        } else {
            toggleMenuGroup(groupId, false);
        }
    });
}
window.initializeSidebarGroups = initializeSidebarGroups;

export function toggleSidebar(forceState) {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;
    
    const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('open');
    if (isOpen) {
        sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('visible');
    } else {
        sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('visible');
    }
}
window.toggleSidebar = toggleSidebar;

// Router: Switch Tab with Skeleton and Dynamic Loading
export async function switchAdminTab(tab, btnEl) {
    if (!tabConfig[tab]) return;
    window.activeTab = tab;
    
    // Update sidebar active classes
    if (btnEl) {
        const items = document.querySelectorAll('.sidebar-menu .menu-item');
        items.forEach(item => item.classList.remove('active'));
        btnEl.classList.add('active');
        
        // Auto-expand group
        const activeGroup = btnEl.closest('.menu-group-items');
        if (activeGroup) {
            const groupId = activeGroup.id.replace('group-', '').replace('-items', '');
            toggleMenuGroup(groupId, true);
        }
    }
    
    // Responsive sidebar closing
    if (window.innerWidth <= 1024) {
        toggleSidebar(false);
    }
    
    // Set headers
    const viewTitle = document.getElementById('view-active-title');
    const viewDesc = document.getElementById('view-active-desc');
    if (viewTitle) viewTitle.innerText = tabConfig[tab].title;
    if (viewDesc) viewDesc.innerText = tabConfig[tab].desc;
    
    // Inject Skeleton Loader
    const adminBody = document.querySelector('.admin-body');
    if (adminBody) {
        adminBody.innerHTML = `
            <div class="skeleton-loader skeleton-wave" style="padding: 24px; display: flex; flex-direction: column; gap: 20px; width: 100%;">
                <div class="skeleton-card" style="height: 120px; width: 100%; border-radius: 12px;"></div>
                <div class="skeleton-line" style="height: 30px; width: 40%;"></div>
                <div class="skeleton-line" style="height: 200px; width: 100%;"></div>
            </div>
        `;
    }
    
    try {
        // Fetch view HTML with cache buster
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const response = await fetch(`${basePath}components/admin/view-${tab}.html?v=${ADMIN_APP_VERSION}`);
        if (!response.ok) throw new Error(`Failed to load view components for ${tab}`);
        const html = await response.text();
        
        // Insert HTML and transition
        if (adminBody) {
            adminBody.innerHTML = html;
            const tabContent = adminBody.querySelector('.view-tab-content');
            if (tabContent && !tabContent.classList.contains('active')) {
                tabContent.classList.add('active');
            }
        }
        
        // Load sub-controller with cache buster
        const ctrl = tabConfig[tab].controller;
        const moduleUrl = `${window.location.origin}${basePath}js/admin/pages/${ctrl}.js?v=${ADMIN_APP_VERSION}`;
        const importModule = new Function('s', 'return import(s)');
        const module = await importModule(moduleUrl);
        
        // Expose exported methods to window so inline event handlers work
        for (const [key, val] of Object.entries(module)) {
            if (typeof val === 'function' || key.endsWith('List') || key === 'currentReferralUserId') {
                window[key] = val;
            }
        }
        
        // Invoke init
        await tabConfig[tab].init();
        
    } catch (err) {
        console.error(`Error loading tab ${tab}:`, err);
        if (adminBody) {
            adminBody.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
                    <h3>âŒ æ¨¡å—åŠ è½½å¤±è´¥</h3>
                    <p>${err.message}</p>
                    <button class="action-btn" onclick="switchAdminTab('${tab}')" style="margin-top: 15px;">é‡æ–°å°è¯•</button>
                </div>
            `;
        }
    }
}
window.switchAdminTab = switchAdminTab;

// Pagination core logic
window.adminPages = {
    kyc: { current: 1, size: 10 },
    riskLevels: { current: 1, size: 10 },
    quant: { current: 1, size: 10 },
    users: { current: 1, size: 10 },
    deposit: { current: 1, size: 10 },
    withdraw: { current: 1, size: 10 },
    leaders: { current: 1, size: 10 },
    relations: { current: 1, size: 10 },
    orders: { current: 1, size: 10 },
    payment: { current: 1, size: 10 },
    crypto: { current: 1, size: 10 },
    fiat: { current: 1, size: 10 },
    bindings: { current: 1, size: 10 },
    rates: { current: 1, size: 10 },
    strategies: { current: 1, size: 10 },
    quantSettle: { current: 1, size: 10 },
    manualFunding: { current: 1, size: 10 },
    manualSubjects: { current: 1, size: 10 },
    instruments: { current: 1, size: 10 },
    versions: { current: 1, size: 10 },
    supportChannels: { current: 1, size: 10 },
    dailyReport: { current: 1, size: 50 },
    holidays: { current: 1, size: 10 },
    locales: { current: 1, size: 20 },
    errorReports: { current: 1, size: 10 }
};

export function paginateList(list, type) {
    const pageConf = window.adminPages[type];
    const totalItems = list.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageConf.size));
    pageConf.pages = totalPages; // Store totalPages for boundary checks
    if (pageConf.current > totalPages) pageConf.current = totalPages;
    if (pageConf.current < 1) pageConf.current = 1;
    const start = (pageConf.current - 1) * pageConf.size;
    const paginated = list.slice(start, start + pageConf.size);
    const indicator = document.getElementById(`${type}-page-indicator`);
    if (indicator) {
        indicator.innerText = `ç¬¬ ${pageConf.current} / ${totalPages} é¡µ (å…± ${totalItems} æ¡)`;
    }
    return paginated;
}
window.paginateList = paginateList;

export function updateAdminPageIndicator(type, paging) {
    const pageConf = window.adminPages[type];
    const totalItems = paging.records !== undefined ? paging.records : 0;
    const totalPages = paging.pages !== undefined ? paging.pages : 1;
    pageConf.pages = totalPages; // Store totalPages for boundary checks
    pageConf.current = paging.page || pageConf.current;
    
    const indicator = document.getElementById(`${type}-page-indicator`);
    if (indicator) {
        indicator.innerText = `ç¬¬ ${pageConf.current} / ${totalPages} é¡µ (å…± ${totalItems} æ¡)`;
    }
}
window.updateAdminPageIndicator = updateAdminPageIndicator;

export function changeAdminPage(type, delta) {
    const pageConf = window.adminPages[type];
    const newPage = pageConf.current + delta;
    const maxPage = pageConf.pages || 1;
    
    if (newPage < 1 || newPage > maxPage) {
        return; // Prevent out-of-bounds requests
    }
    
    pageConf.current = newPage;
    if (typeof window.loadKycList === 'function' && type === 'kyc') window.loadKycList();
    else if (typeof window.loadRiskLevelsList === 'function' && type === 'riskLevels') window.loadRiskLevelsList();
    else if (typeof window.loadQuantMonitor === 'function' && type === 'quant') window.loadQuantMonitor();
    else if (typeof window.loadUsersList === 'function' && type === 'users') window.loadUsersList();
    else if (typeof window.loadDepositList === 'function' && type === 'deposit') window.loadDepositList();
    else if (typeof window.loadWithdrawList === 'function' && type === 'withdraw') window.loadWithdrawList();
    else if (typeof window.loadCopyTradingLeaders === 'function' && type === 'leaders') window.loadCopyTradingLeaders();
    else if (typeof window.loadCopyTradingRelations === 'function' && type === 'relations') window.loadCopyTradingRelations();
    else if (typeof window.loadCopyTradingOrders === 'function' && type === 'orders') window.loadCopyTradingOrders();
    else if (typeof window.loadPaymentChannels === 'function' && type === 'payment') window.loadPaymentChannels();
    else if (typeof window.loadCryptoTargetsList === 'function' && type === 'crypto') window.loadCryptoTargetsList();
    else if (typeof window.loadFiatTargetsList === 'function' && type === 'fiat') window.loadFiatTargetsList();
    else if (typeof window.loadBindingsList === 'function' && type === 'bindings') window.loadBindingsList();
    else if (typeof window.loadExchangeRatesList === 'function' && type === 'rates') window.loadExchangeRatesList();
    else if (typeof window.loadPlatformStrategies === 'function' && type === 'strategies') window.loadPlatformStrategies();
    else if (typeof window.loadQuantSettleList === 'function' && type === 'quantSettle') window.loadQuantSettleList();
    else if (typeof window.loadManualFundingList === 'function' && type === 'manualFunding') window.loadManualFundingList();
    else if (typeof window.loadManualSubjectsList === 'function' && type === 'manualSubjects') window.loadManualSubjectsList();
    else if (typeof window.loadInstrumentsList === 'function' && type === 'instruments') window.loadInstrumentsList();
    else if (typeof window.loadAppVersionsList === 'function' && type === 'versions') window.loadAppVersionsList();
    else if (typeof window.loadSupportChannelsList === 'function' && type === 'supportChannels') window.loadSupportChannelsList();
    else if (typeof window.loadHolidaysList === 'function' && type === 'holidays') window.loadHolidaysList();
    else if (typeof window.loadLocalesList === 'function' && type === 'locales') window.loadLocalesList();
    else if (typeof window.loadErrorReportsList === 'function' && type === 'errorReports') window.loadErrorReportsList();
}
window.changeAdminPage = changeAdminPage;

export function changeAdminPageSize(type, newSize) {
    window.adminPages[type].size = parseInt(newSize);
    window.adminPages[type].current = 1;
    if (typeof window.loadKycList === 'function' && type === 'kyc') window.loadKycList();
    else if (typeof window.loadRiskLevelsList === 'function' && type === 'riskLevels') window.loadRiskLevelsList();
    else if (typeof window.loadQuantMonitor === 'function' && type === 'quant') window.loadQuantMonitor();
    else if (typeof window.loadUsersList === 'function' && type === 'users') window.loadUsersList();
    else if (typeof window.loadDepositList === 'function' && type === 'deposit') window.loadDepositList();
    else if (typeof window.loadWithdrawList === 'function' && type === 'withdraw') window.loadWithdrawList();
    else if (typeof window.loadCopyTradingLeaders === 'function' && type === 'leaders') window.loadCopyTradingLeaders();
    else if (typeof window.loadCopyTradingRelations === 'function' && type === 'relations') window.loadCopyTradingRelations();
    else if (typeof window.loadCopyTradingOrders === 'function' && type === 'orders') window.loadCopyTradingOrders();
    else if (typeof window.loadPaymentChannels === 'function' && type === 'payment') window.loadPaymentChannels();
    else if (typeof window.loadCryptoTargetsList === 'function' && type === 'crypto') window.loadCryptoTargetsList();
    else if (typeof window.loadFiatTargetsList === 'function' && type === 'fiat') window.loadFiatTargetsList();
    else if (typeof window.loadBindingsList === 'function' && type === 'bindings') window.loadBindingsList();
    else if (typeof window.loadExchangeRatesList === 'function' && type === 'rates') window.loadExchangeRatesList();
    else if (typeof window.loadPlatformStrategies === 'function' && type === 'strategies') window.loadPlatformStrategies();
    else if (typeof window.loadQuantSettleList === 'function' && type === 'quantSettle') window.loadQuantSettleList();
    else if (typeof window.loadManualFundingList === 'function' && type === 'manualFunding') window.loadManualFundingList();
    else if (typeof window.loadManualSubjectsList === 'function' && type === 'manualSubjects') window.loadManualSubjectsList();
    else if (typeof window.loadInstrumentsList === 'function' && type === 'instruments') window.loadInstrumentsList();
    else if (typeof window.loadAppVersionsList === 'function' && type === 'versions') window.loadAppVersionsList();
    else if (typeof window.loadSupportChannelsList === 'function' && type === 'supportChannels') window.loadSupportChannelsList();
    else if (typeof window.loadHolidaysList === 'function' && type === 'holidays') window.loadHolidaysList();
    else if (typeof window.loadLocalesList === 'function' && type === 'locales') window.loadLocalesList();
    else if (typeof window.loadErrorReportsList === 'function' && type === 'errorReports') window.loadErrorReportsList();
}
window.changeAdminPageSize = changeAdminPageSize;

// Core shared functions
export async function checkAdminSession() {
    try {
        const res = await window.apiFetch('GET', '/auth/status', null, false);
        if (res.code === 200 && res.data && res.data.isLogon) {
            window.currentAdmin = { email: 'admin', nickname: 'ç³»ç»Ÿå®¡è®¡å‘˜' };
            localStorage.setItem('matp_admin_user_email', 'admin');
            localStorage.setItem('matp_admin_access_token', 'cookie_session');
            
            const profileBox = document.getElementById('admin-profile-box');
            if (profileBox) profileBox.style.display = 'flex';
            const nicknameEl = document.getElementById('admin-nickname');
            if (nicknameEl) nicknameEl.innerText = 'ç³»ç»Ÿå®¡è®¡å‘˜';
            
            // Switch to initial tab (welcome)
            await switchAdminTab('welcome', document.querySelector('.sidebar-menu .menu-item.active'));
            
            listenToBizEvents();
        } else {
            window.currentAdmin = null;
            localStorage.removeItem('matp_admin_logged_in');
            localStorage.removeItem('matp_admin_access_token');
            localStorage.removeItem('matp_admin_user_email');
            const profileBox = document.getElementById('admin-profile-box');
            if (profileBox) profileBox.style.display = 'none';
            window.location.href = 'admin_login.html';
        }
    } catch (e) {
        console.error("Error checking admin session status:", e);
        window.currentAdmin = null;
        const profileBox = document.getElementById('admin-profile-box');
        if (profileBox) profileBox.style.display = 'none';
        window.location.href = 'admin_login.html';
    }
}
window.checkAdminSession = checkAdminSession;

export async function handleLogout() {
    try {
        await window.apiFetch('POST', '/auth/logout', null, false);
    } catch(e) {}
    localStorage.removeItem('matp_admin_logged_in');
    localStorage.removeItem('matp_admin_access_token');
    localStorage.removeItem('matp_admin_session_key');
    localStorage.removeItem('matp_admin_user_uid');
    localStorage.removeItem('matp_admin_user_email');
    
    await checkAdminSession();
    showToast('å·²å®‰å…¨é€€å‡ºç®¡ç†ç³»ç»Ÿã€‚', false);
}
window.handleLogout = handleLogout;

export async function listenToBizEvents() {
    if (!window.currentAdmin) {
        if (window.bizWs) {
            try { window.bizWs.close(); } catch(e){}
            window.bizWs = null;
        }
        return;
    }
    
    try {
        const res = await window.apiFetch('POST', '/auth/ws-ticket', null, true);
        const bizTicket = res.result || res.data;
        if (res.code !== 200 || !bizTicket || !bizTicket.ticket) {
            console.error('Failed to fetch ws ticket from server');
            setTimeout(listenToBizEvents, 6000);
            return;
        }
        
        const ticket = bizTicket.ticket;
        if (window.bizWs) {
            try { window.bizWs.close(); } catch(e){}
        }
        
        window.bizWs = new WebSocket(`${CONFIG.BIZ_WS_URL}?ticket=${ticket}`);
        
        window.bizWs.onopen = () => {
            console.log('ðŸ“¡ Real Admin Business WS connection established!');
        };
        
        window.bizWs.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                const eventType = payload.eventType || payload.type || payload.event || 'unknown.event';
                const moduleName = payload.module || payload.topic || payload.channel || 'system';
                const data = payload.data || payload.payload || payload.body || payload;
                
                console.log(`ðŸ›¡ï¸ [Admin Audit received (REAL)] Event: ${eventType}`, data);
                dispatchAdminEvent(eventType, moduleName, data);
            } catch(e) {
                console.error('Error parsing real admin WS event:', e);
            }
        };
        
        window.bizWs.onclose = () => {
            console.warn('Real Admin WS connection closed. Reconnecting in 6s...');
            setTimeout(listenToBizEvents, 6000);
        };
        
        window.bizWs.onerror = (err) => {
            console.error('Real Admin WS error:', err);
        };
        
    } catch(e) {
        console.error('Failed to establish real admin WS:', e);
        setTimeout(listenToBizEvents, 6000);
    }
}
window.listenToBizEvents = listenToBizEvents;

export function triggerAdminDashboardReloadDebounced() {
    if (window.adminReloadTimeout) {
        clearTimeout(window.adminReloadTimeout);
    }
    const now = Date.now();
    const delay = Math.max(0, 3000 - (now - window.lastAdminReloadTime));
    
    window.adminReloadTimeout = setTimeout(async () => {
        window.lastAdminReloadTime = Date.now();
        const currentTab = window.activeTab;
        if (tabConfig[currentTab]) {
            try {
                await tabConfig[currentTab].init();
                showToast('âš¡ æ•°æ®å·²æ ¹æ®æœ€æ–°æŽ¨é€è‡ªåŠ¨æ›´æ–°', false);
            } catch (e) {
                console.error("Failed to automatically reload active view:", e);
            }
        }
    }, delay);
}
window.triggerAdminDashboardReloadDebounced = triggerAdminDashboardReloadDebounced;

export function dispatchAdminEvent(eventType, moduleName, data) {
    appendLiveAuditRow(eventType, moduleName, data);
    
    const autoReloadEvents = [
        'deposit.created', 'deposit.approved', 'deposit.rejected',
        'withdrawal.created', 'withdrawal.approved', 'withdrawal.rejected',
        'kyc.submitted', 'kyc.approved', 'kyc.rejected',
        'order.created', 'order.settled', 'order.cancelled',
        'identity.kyc.status-changed.v1',
        'finance.account.changed.v1',
        'trading.quant.order.status-changed.v1'
    ];
    
    const eventTypeStr = String(eventType || '');
    // Support exact matches as well as substring matching for robust real-time updates
    const isReloadEvent = autoReloadEvents.includes(eventTypeStr) ||
                          eventTypeStr.includes('status-changed') ||
                          eventTypeStr.includes('account.changed');
    
    if (isReloadEvent) {
        triggerAdminDashboardReloadDebounced();
    }
}
window.dispatchAdminEvent = dispatchAdminEvent;

export function appendLiveAuditRow(eventType, moduleName, data) {
    const tbody = document.getElementById('live-audit-table-body');
    if (!tbody) return;
    
    const nowStr = new Date().toLocaleTimeString();
    const row = document.createElement('tr');
    
    let badgeClass = 'badge-pending';
    if (eventType.includes('approved') || eventType.includes('settled') || eventType.includes('success')) {
        badgeClass = 'badge-approve';
    } else if (eventType.includes('rejected') || eventType.includes('failed') || eventType.includes('error')) {
        badgeClass = 'badge-reject';
    }
    
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
    
    row.innerHTML = `
        <td style="font-family: monospace; font-weight: bold; color: var(--primary);">${nowStr}</td>
        <td><span class="badge ${badgeClass}">${eventType}</span></td>
        <td style="font-weight: 600; color: var(--text-primary);">${moduleName}</td>
        <td style="font-family: monospace; font-size: 0.75rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title='${dataStr}'>${dataStr}</td>
    `;
    
    tbody.insertBefore(row, tbody.firstChild);
    if (tbody.children.length > 30) {
        tbody.removeChild(tbody.lastChild);
    }
}
window.appendLiveAuditRow = appendLiveAuditRow;

export function showToast(msg, isErr = false) {
    const toast = document.getElementById('alert-toast');
    if (!toast) return;
    
    toast.innerText = msg;
    toast.style.background = isErr ? 'rgba(239, 68, 68, 0.95)' : 'rgba(91, 81, 249, 0.95)';
    toast.classList.add('active');
    if (isErr) {
        toast.classList.add('err');
    } else {
        toast.classList.remove('err');
    }
    
    setTimeout(() => {
        toast.classList.remove('active');
        toast.classList.remove('err');
    }, 4000);
}
window.showToast = showToast;

export function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

export function translateIdType(type) {
    const dict = {
        'PASSPORT': 'ðŸ›‚ æŠ¤ç…§ (Passport)',
        'DRIVING_LICENSE': 'ðŸªª é©¾ç…§ (Driver License)',
        'IDENTITY_CARD': 'ðŸ’³ èº«ä»½è¯ (National ID Card)'
    };
    return dict[type] || type || '--';
}
window.translateIdType = translateIdType;

export function copyToClipboard(text, msg = 'å¤åˆ¶æˆåŠŸï¼') {
    if (!navigator.clipboard) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast(msg, false);
        } catch (err) {
            showToast('å¤åˆ¶å¤±è´¥ï¼', true);
        }
        document.body.removeChild(textarea);
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast(msg, false);
    }).catch(err => {
        showToast('å¤åˆ¶å¤±è´¥ï¼', true);
    });
}
window.copyToClipboard = copyToClipboard;

export async function viewProofImage(id) {
    const lightbox = document.getElementById('proof-lightbox-modal');
    const lightboxImg = document.getElementById('proof-lightbox-img');
    const errorDiv = document.getElementById('proof-lightbox-error');
    
    if (!lightbox || !lightboxImg || !errorDiv) return;
    
    // Revoke previous Object URL if any to prevent memory leaks
    if (window.currentProofObjectURL) {
        try {
            URL.revokeObjectURL(window.currentProofObjectURL);
        } catch(e) {}
        window.currentProofObjectURL = null;
    }
    
    lightbox.style.display = 'flex';
    lightbox.classList.add('active');
    lightboxImg.style.display = 'none';
    errorDiv.style.display = 'none';
    
    lightboxImg.src = '';
    
    const list = window.cachedDeposits || [];
    const deposit = list.find(d => String(d.id) === String(id));
    const proofUrl = deposit ? deposit.paymentProof : '';
    window.lastSelectedProofUrl = proofUrl;
    
    if (!proofUrl) {
        lightboxImg.style.display = 'none';
        errorDiv.style.display = 'flex';
        handleProofImageError();
        return;
    }
    
    let targetUrl = proofUrl;
    const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    if (isLocalDev && (targetUrl.includes('storage.googleapis.com') || targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        targetUrl = '/download-gcs?url=' + encodeURIComponent(targetUrl);
    }
    
    lightboxImg.src = targetUrl;
    lightboxImg.style.display = 'block';
}
window.viewProofImage = viewProofImage;

export function handleProofImageError() {
    const img = document.getElementById('proof-lightbox-img');
    const errorEl = document.getElementById('proof-lightbox-error');
    const errorMsgEl = document.getElementById('proof-error-msg');
    
    if (img && errorEl) {
        img.style.display = 'none';
        errorEl.style.display = 'flex';
        
        const url = window.lastSelectedProofUrl || '';
        if (url.includes('matp-app.qchats.org') || url.endsWith('proof.png')) {
            if (errorMsgEl) {
                errorMsgEl.innerHTML = `âš ï¸ <b>è¯¥å……å€¼å•ä¸ºåŽ†å²æµ‹è¯•/æ¨¡æ‹Ÿæ•°æ®</b><br><span style="font-size: 0.78rem; font-weight: normal; color: var(--text-secondary); display: inline-block; margin-top: 5px;">ç”±äºŽåŽŸæ¨¡æ‹ŸåŸŸå (<code>matp-app.qchats.org</code>) çš„æœåŠ¡å™¨å·²ä¸‹çº¿ï¼Œè¯¥é»˜è®¤æµ‹è¯•å›¾ç‰‡å·²å¤±æ•ˆï¼Œå› æ­¤æ— æ³•æ­£å¸¸é¢„è§ˆã€‚</span>`;
            }
        } else {
            if (errorMsgEl) {
                errorMsgEl.innerHTML = `âš ï¸ <b>å‡­è¯å›¾ç‰‡åŠ è½½å¤±è´¥</b><br><span style="font-size: 0.78rem; font-weight: normal; color: var(--text-secondary); display: inline-block; margin-top: 5px;">è¯¥å‡­è¯å›¾ç‰‡æ–‡ä»¶åœ¨æœåŠ¡å™¨ä¸Šä¸å­˜åœ¨ï¼Œæˆ–è€…ç½‘ç»œè®¿é—®è¶…æ—¶ã€‚</span>`;
            }
        }
    }
}
window.handleProofImageError = handleProofImageError;

export function closeProofLightbox() {
    const lightbox = document.getElementById('proof-lightbox-modal');
    const lightboxImg = document.getElementById('proof-lightbox-img');
    const errorDiv = document.getElementById('proof-lightbox-error');
    if (window.currentProofObjectURL) {
        try {
            URL.revokeObjectURL(window.currentProofObjectURL);
        } catch(e) {}
        window.currentProofObjectURL = null;
    }
    if (lightbox) {
        lightbox.style.display = 'none';
        lightbox.classList.remove('active');
    }
    if (lightboxImg) lightboxImg.src = '';
    if (errorDiv) errorDiv.style.display = 'none';
}
window.closeProofLightbox = closeProofLightbox;

// Stub for legacy dashboard stats reload calls
window.loadDashboardStats = async () => {};

// Initial start
document.addEventListener('DOMContentLoaded', () => {
    checkAdminSession();
    initializeSidebarGroups();
});
