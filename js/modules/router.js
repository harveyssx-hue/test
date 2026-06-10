// Native Zero-Dependency Hash Router Module
import { state } from './state.js?v=2.2.0';

const routes = {
    '#/home': { html: 'view-home.html', controller: 'initHomePage' },
    '#/market': { html: 'view-market.html', controller: 'initMarketPage' },
    '#/follow': { html: 'view-follow.html', controller: 'initFollowPage' },
    '#/assets': { html: 'view-assets.html', controller: 'initAssetsPage' },
    '#/profile': { html: 'view-profile.html', controller: 'initProfilePage' },
    '#/deposit': { html: 'view-deposit.html', controller: 'initDepositPage' },
    '#/withdraw': { html: 'view-withdraw.html', controller: 'initWithdrawPage' },
    '#/txrecords': { html: 'view-txrecords.html', controller: 'initTxRecordsPage' },
    '#/funddetails': { html: 'view-funddetails.html', controller: 'initFundDetailsPage' },
    '#/kyc': { html: 'view-kyc.html', controller: 'initKycPage' },
    '#/payment-account': { html: 'view-payment-account.html', controller: 'initPaymentAccountPage' },
    '#/invite': { html: 'view-invite.html', controller: 'initInvitePage' },
    '#/subordinates': { html: 'view-subordinates.html', controller: 'initSubordinatesPage' }
};

// Simple template cache to prevent repeated network fetches
const templateCache = {};

async function fetchTemplate(filename) {
    if (templateCache[filename]) {
        return templateCache[filename];
    }
    const response = await fetch(`/components/${filename}?v=${Date.now()}`);
    if (!response.ok) {
        throw new Error(`Failed to load component: ${filename}`);
    }
    const html = await response.text();
    templateCache[filename] = html;
    return html;
}

// Global page initialization routers
const pageControllers = {
    initHomePage() {
        if (window.checkAuthSession) window.checkAuthSession();
        if (window.initHomeProfitsRotator) window.initHomeProfitsRotator();
        if (window.renderHomeTrending) window.renderHomeTrending();
    },
    initMarketPage() {
        if (window.hideMarketDetail) window.hideMarketDetail();
        if (window.renderMarketList) window.renderMarketList();
    },
    initFollowPage() {
        if (window.renderStrategyLobby) window.renderStrategyLobby();
    },
    initAssetsPage() {
        if (window.loadUserAssets) window.loadUserAssets();
        if (window.loadQuantOrders) window.loadQuantOrders();
    },
    initProfilePage() {
        if (window.checkAuthSession) window.checkAuthSession();
        if (window.syncUserInfoFromServer) window.syncUserInfoFromServer();
        if (window.loadUserAssets) window.loadUserAssets();
        if (window.syncKycStatusFromServer) window.syncKycStatusFromServer();
        if (window.loadMyInvitees) window.loadMyInvitees();
    },
    async initDepositPage() {
        if (window.openDepositModal) await window.openDepositModal();
    },
    async initWithdrawPage() {
        if (window.openWithdrawModal) await window.openWithdrawModal();
    },
    initTxRecordsPage() {
        if (window.renderTxRecordsItems) window.renderTxRecordsItems();
    },
    initFundDetailsPage() {
        if (window.renderFundDetailsItems) window.renderFundDetailsItems();
    },
    async initKycPage() {
        if (window.openKycModal) await window.openKycModal();
    },
    async initPaymentAccountPage() {
        if (window.initPaymentAccountPage) await window.initPaymentAccountPage();
    },
    initInvitePage() {
        if (window.initInvitePage) window.initInvitePage();
    },
    initSubordinatesPage() {
        if (window.initSubordinatesPage) window.initSubordinatesPage();
    }
};

async function handleRouting() {
    // Proactively deactivate all active overlays, modals and drawers on tab navigation/routing
    const activeModals = document.querySelectorAll('.overlay.active, .order-drawer-overlay.active, .order-drawer-sheet.active, .new-success-modal-overlay.active, .modal.active');
    activeModals.forEach(m => m.classList.remove('active'));

    const hash = window.location.hash || '#/home';
    const tabId = hash.replace('#/', '');
    
    // Auth Check: Redirect guest users trying to access secure tabs
    if (!state.currentUser && tabId !== 'home') {
        const loginPromptMsg = state.currentLocale === 'hi' 
            ? '🔒 कृपया इस पृष्ठ तक पहुँचने के लिए पहले लॉग इन करें!' 
            : '🔒 Please log in first to access this page!';
            
        if (window.showToast) window.showToast(loginPromptMsg, true);
        window.location.hash = '#/home';
        if (window.openAuthModal) window.openAuthModal();
        return;
    }
    
    const route = routes[hash];
    if (!route) {
        window.location.hash = '#/home';
        return;
    }
    
    try {
        // 1. Fetch and load the HTML component
        const html = await fetchTemplate(route.html);
        const container = document.getElementById('app-content');
        if (container) {
            container.innerHTML = html;
            const firstChild = container.firstElementChild;
            if (firstChild && firstChild.classList.contains('view-tab-content')) {
                firstChild.classList.add('active');
            }
        }
        
        // 2. Set active state variable
        state.activeTab = tabId;
        
        // 3. Highlight corresponding bottom nav tab
        let highlightTabId = tabId;
        if (['deposit', 'withdraw', 'txrecords', 'funddetails', 'kyc', 'payment-account', 'invite', 'subordinates'].includes(tabId)) {
            highlightTabId = 'profile'; // secondary subpages highlight profile tab
        }
        
        const navButtons = document.querySelectorAll('.nav-tab');
        navButtons.forEach(b => b.classList.remove('active'));
        const activeNavBtn = document.getElementById(`btn-nav-${highlightTabId}`);
        if (activeNavBtn) {
            activeNavBtn.classList.add('active');
        }
        
        // 4. Run page controller logic
        const controllerFn = pageControllers[route.controller];
        if (controllerFn) {
            controllerFn();
        }
        
        // 5. Scroll to top
        window.scrollTo(0, 0);
        
        // 6. Apply translation to the newly loaded content
        if (window.applyTranslations) window.applyTranslations();
        
    } catch (err) {
        console.error('Routing error:', err);
    }
}

// Redirect switchTab to route changes
window.switchTab = function(tabId) {
    window.location.hash = `#/${tabId}`;
};

// Bind listeners
window.addEventListener('hashchange', handleRouting);
window.addEventListener('DOMContentLoaded', handleRouting);

export { handleRouting };
