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
        title: '控制中心',
        desc: '欢迎使用 MATP CORE 审计管理系统',
        controller: 'welcome',
        init: () => {}
    },
    'kyc': {
        title: 'KYC 认证审核中心',
        desc: '按监管合规要求审计认证全站交易员身份及执照',
        controller: 'kyc',
        init: () => window.loadKycList()
    },
    'risk-levels': {
        title: '用户风控层级管理',
        desc: '配置与管理全站交易员的风控等级、额度限制、提现审批规则及启用状态',
        controller: 'users',
        init: () => window.loadRiskLevelsList()
    },
    'quant': {
        title: '👥 全站 AI 量化订单列表',
        desc: '审核与管理全站交易员的量化委托订单，批准启动或拒绝撤销',
        controller: 'quant',
        init: () => window.loadQuantMonitor()
    },
    'quant-settle': {
        title: '⚡ AI 量化交易结算中心',
        desc: '对已被批准运行中 (ACTIVE) 的量化委托订单进行单独、策略批量或多选批量价格操盘与盈亏结算',
        controller: 'quant',
        init: () => window.loadQuantSettleList()
    },
    'quant-daily-users': {
        title: '📊 用户订单日统计报表',
        desc: '多维度统计全站量化订单的日运行记录与量化指标，支持按用户UID及风控层级穿透检索',
        controller: 'quant',
        init: () => window.loadQuantDailyUsersList()
    },
    'copytrading': {
        title: '👑 导师带单与跟随合规中心',
        desc: '审核与管理社区达人的带单资质，审计全站跟单绑定流水并对活动持仓实施即时风险风控',
        controller: 'quant',
        init: async () => {
            await window.loadCopyTradingStats();
            await window.switchCopyTradingSubTab('leaders');
        }
    },
    'daily-report': {
        title: '📊 运营数据日报中心',
        desc: '查看与分析今日全站核心注册增长、充值提现财务指标、以及量化策略操盘的清算收益日报',
        controller: 'system',
        init: () => window.loadDailyReport()
    },
    'users': {
        title: '交易员账户与钱包管理',
        desc: '查看与管理全站交易员余额资产，流水记录与注册履历',
        controller: 'users',
        init: () => window.loadUsersList()
    },
    'deposit': {
        title: '资金入金充值审核中心',
        desc: '核对并审计全站交易员上传的网关付款截图、凭证单号并确认上账',
        controller: 'finance',
        init: () => window.loadDepositList()
    },
    'withdraw': {
        title: '资金出金提现审核中心',
        desc: '处理并审计交易员的提款地址、可用限额并确认最终放款清算',
        controller: 'finance',
        init: () => window.loadWithdrawList()
    },
    'payment': {
        title: '平台支付与出入金通道管理',
        desc: '管理和配置交易端显示的所有充值（CRYPTO/FIAT）与提现方式、状态启用与禁用',
        controller: 'finance',
        init: () => window.loadPaymentChannels()
    },
    'rates': {
        title: '平台资产结算汇率管理',
        desc: '管理与调整平台各种出入账资产兑 INR 本位币的结算汇率，实时应用于充值结算与计价展示',
        controller: 'finance',
        init: () => window.loadExchangeRatesList()
    },
    'strategies': {
        title: '平台 AI 量化策略管理控制中心',
        desc: '管理和配置交易端显示的所有 AI 量化跟单策略模板，支持中英文双语翻译配置、启用与禁用',
        controller: 'quant',
        init: () => window.loadPlatformStrategies()
    },
    'tenant-settings': {
        title: '平台系统与租户设置',
        desc: '配置与调整租户的系统全局参数，包括提现未使用资金费率、OTP安全验证与量化经纪费率等',
        controller: 'system',
        init: () => window.loadTenantSettings()
    },
    'manual-funding': {
        title: '后台资金存提管理',
        desc: '审计与管理全站二级运营人员提交物理账户的手工充值与扣款申请',
        controller: 'finance',
        init: () => window.loadManualFundingList()
    },
    'manual-subjects': {
        title: '存提会计科目管理',
        desc: '管理平台手工资金调整所依托的会计分类科目、适用范围及启用状态',
        controller: 'finance',
        init: () => window.loadManualSubjectsList()
    },
    'platform-contents': {
        title: '平台文档与协议中心管理',
        desc: '管理与编辑前台展示的所有服务条款协议、帮助学院（HELP）及运营操作提示文档',
        controller: 'system',
        init: () => window.loadPlatformContentsList(1)
    },
    'instruments': {
        title: '交易商品与产品管理中心',
        desc: '配置与调整全站交易终端上架的交易产品、上架状态、推荐权重、核心标签与基础参数',
        controller: 'instruments',
        init: () => window.loadInstrumentsList()
    },
    'app-versions': {
        title: 'APP 版本更新管理中心',
        desc: '配置与发布 iOS 和 Android 客户端的最新可用版本、最低版本控制以及强更升级设置',
        controller: 'system',
        init: () => window.loadAppVersionsList()
    },
    'support-channels': {
        title: '在线客服通道管理',
        desc: '配置与管理用户客户端展示的在线客服通道，例如绑定 WhatsApp, Telegram 等',
        controller: 'system',
        init: () => window.loadSupportChannelsList()
    },
    'holidays': {
        title: '平台交易假期管理',
        desc: '配置与发布各交易市场假期安排，支持手动配置、同步外部接口以自动化风控及休市机制',
        controller: 'holidays',
        init: () => window.loadHolidaysList()
    },
    'locales': {
        title: '系统 Locale 语言管理',
        desc: '管理和配置前端支持的多语言标签、名称展示、图标国旗，启用或禁用国际化语种',
        controller: 'system',
        init: () => window.loadLocalesList()
    },
    'error-reports': {
        title: '客户端错误上报记录',
        desc: '分页并筛选查看 APP 客户端（iOS/Android）上报的崩溃及业务处理错误，排查堆栈上下文',
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
                    <h3>❌ 模块加载失败</h3>
                    <p>${err.message}</p>
                    <button class="action-btn" onclick="switchAdminTab('${tab}')" style="margin-top: 15px;">重新尝试</button>
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
    quantDailyUsers: { current: 1, size: 10 },
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
        indicator.innerText = `第 ${pageConf.current} / ${totalPages} 页 (共 ${totalItems} 条)`;
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
        indicator.innerText = `第 ${pageConf.current} / ${totalPages} 页 (共 ${totalItems} 条)`;
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
    else if (typeof window.loadQuantDailyUsersList === 'function' && type === 'quantDailyUsers') window.loadQuantDailyUsersList();
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
    else if (typeof window.loadQuantDailyUsersList === 'function' && type === 'quantDailyUsers') window.loadQuantDailyUsersList();
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
            window.currentAdmin = { email: 'admin', nickname: '系统审计员' };
            localStorage.setItem('matp_admin_user_email', 'admin');
            localStorage.setItem('matp_admin_access_token', 'cookie_session');
            
            const profileBox = document.getElementById('admin-profile-box');
            if (profileBox) profileBox.style.display = 'flex';
            const nicknameEl = document.getElementById('admin-nickname');
            if (nicknameEl) nicknameEl.innerText = '系统审计员';
            
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
    showToast('已安全退出管理系统。', false);
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
            console.error('Failed to fetch ws ticket from server:', res.errorMessage || res.message || 'Empty ticket returned');
            setTimeout(listenToBizEvents, 6000);
            return;
        }
        
        const ticket = bizTicket.ticket;
        if (window.bizWs) {
            try { window.bizWs.close(); } catch(e){}
        }
        
        window.bizWs = new WebSocket(`${CONFIG.BIZ_WS_URL}?ticket=${ticket}`);
        
        window.bizWs.onopen = () => {
            console.log('📡 Real Admin Business WS connection established!');
        };
        
        window.bizWs.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                const eventType = payload.eventType || payload.type || payload.event || 'unknown.event';
                const moduleName = payload.module || payload.topic || payload.channel || 'system';
                const data = payload.data || payload.payload || payload.body || payload;
                
                console.log(`🛡️ [Admin Audit received (REAL)] Event: ${eventType}`, data);
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
                showToast('⚡ 数据已根据最新推送自动更新', false);
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
        'PASSPORT': '🛂 护照 (Passport)',
        'DRIVING_LICENSE': '🪪 驾照 (Driver License)',
        'IDENTITY_CARD': '💳 身份证 (National ID Card)'
    };
    return dict[type] || type || '--';
}
window.translateIdType = translateIdType;

export function copyToClipboard(text, msg = '复制成功！') {
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
            showToast('复制失败！', true);
        }
        document.body.removeChild(textarea);
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast(msg, false);
    }).catch(err => {
        showToast('复制失败！', true);
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
                errorMsgEl.innerHTML = `⚠️ <b>该充值单为历史测试/模拟数据</b><br><span style="font-size: 0.78rem; font-weight: normal; color: var(--text-secondary); display: inline-block; margin-top: 5px;">由于原模拟域名 (<code>matp-app.qchats.org</code>) 的服务器已下线，该默认测试图片已失效，因此无法正常预览。</span>`;
            }
        } else {
            if (errorMsgEl) {
                errorMsgEl.innerHTML = `⚠️ <b>凭证图片加载失败</b><br><span style="font-size: 0.78rem; font-weight: normal; color: var(--text-secondary); display: inline-block; margin-top: 5px;">该凭证图片文件在服务器上不存在，或者网络访问超时。</span>`;
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
