// MATP User Trading Client - Module Orchestrator Entry Point (ES Module)

// 1. Import Shared State and Router
import { state } from './modules/state.js?v=2.2.0';
import { ensureModalLoaded } from './modules/ui.js?v=2.2.0';
import { t, changeAppLanguage, applyTranslations } from './modules/i18n.js?v=2.2.0';
import { connectMarketWS, listenToBizEvents } from './modules/websocket.js?v=2.2.0';

// 2. Import Page View Controllers to register their window handlers
import './pages/auth.js?v=2.2.0';
import './pages/home.js?v=2.2.0';
import './pages/market.js?v=2.2.0';
import './pages/quant.js?v=2.2.0';
import './pages/assets.js?v=2.2.0';
import './pages/profile.js?v=2.2.0';
import './pages/kyc.js?v=2.2.0';
import './pages/finance.js?v=2.2.0';

// 3. Import Hash Router (this should load last to catch hash and render first view)
import { handleRouting } from './modules/router.js?v=2.2.0';

// 4. Initial Global Clock Setup
if (window.initSimulatedTime) {
    setInterval(window.initSimulatedTime, 1000);
    window.initSimulatedTime();
}

// 5. App Startup Initializations
if (window.checkAuthSession) {
    window.checkAuthSession();
}

// Boot up WebSockets
if (window.connectMarketWS) {
    window.connectMarketWS();
}

if (window.currentUser && window.listenToBizEvents) {
    window.listenToBizEvents();
}

// Fire initial routing check
handleRouting();

console.log("MATP Frontend Single-Page Application initialized successfully.");
