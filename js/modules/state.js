// Centralized App State Management
// Leverages ES6 getters/setters to map global variables to a single state store.

const state = {
    currentUser: null,
    activeSymbol: 'btcusdt',
    marketWs: null,
    bizWs: null,
    isConnectingBizWs: false,
    currentMarketCategory: 'sector',
    currentChart: null,
    candleSeries: null,
    recommendedInstruments: [],
    watchlist: [],
    rotatorInterval: null,
    rotatorScrollPos: 0,
    strategyModels: [],
    activeOrders: [],
    selectedStrategy: null,
    selectedQuickAmountVal: 500,
    isCustomAmountMode: false,
    userUsdtBalance: 0.0,
    isAssetValueVisible: localStorage.getItem('matp_asset_value_visible') !== 'false',
    assetPollInterval: null,
    assetDisplayCurrency: localStorage.getItem('matp_asset_display_currency') || 'USDT',
    currentSelectedChannelIdx: 0,
    activeTab: 'home',
    activeAssetFilter: 'ACTIVE',
    activeStrategyFilter: 'ALL',
    isMarketDetailActive: false,
    currentLocale: localStorage.getItem('ait_app_locale') || 'en',
    marketWsReconnectTimer: null,
    currentTrendingType: 'gainers',
    activeInterval: '1m',
    homeTrendingClass: 'crypto',
    
    // Constant exchange rates
    PLATFORM_EXCHANGE_RATES: {},
    
    // Index sparkline memory pools
    sparklinePools: {
        'BTCUSDT': [65000, 65020, 65010, 65050, 65040, 65080, 65060, 65090, 65110, 65080, 65120, 65100],
        'ETHUSDT': [3250, 3255, 3252, 3260, 3258, 3265, 3262, 3270, 3268, 3275, 3272, 3280],
        'SOLUSDT': [145.2, 145.5, 145.3, 145.8, 145.6, 146.1, 145.9, 146.4, 146.2, 146.8, 146.5, 147.0],
        'XRPUSDT': [0.52, 0.522, 0.521, 0.525, 0.523, 0.528, 0.526, 0.530, 0.528, 0.532, 0.531, 0.535]
    }
};

// Bind to window.state
window.state = state;

// Map properties to window so functions can reference them directly as variables
const globalVars = [
    'currentUser', 'activeSymbol', 'marketWs', 'bizWs', 'isConnectingBizWs',
    'currentMarketCategory', 'currentChart', 'candleSeries', 'recommendedInstruments',
    'watchlist', 'rotatorInterval', 'rotatorScrollPos', 'strategyModels', 
    'activeOrders', 'selectedStrategy', 'selectedQuickAmountVal', 'isCustomAmountMode', 
    'userUsdtBalance', 'isAssetValueVisible', 'assetPollInterval', 'assetDisplayCurrency', 'currentSelectedChannelIdx', 
    'activeTab', 'activeAssetFilter', 'activeStrategyFilter', 'isMarketDetailActive',
    'currentLocale', 'PLATFORM_EXCHANGE_RATES', 'sparklinePools',
    'marketWsReconnectTimer', 'currentTrendingType', 'activeInterval', 'homeTrendingClass'
];

globalVars.forEach(name => {
    Object.defineProperty(window, name, {
        get() { return window.state[name]; },
        set(v) { window.state[name] = v; },
        configurable: true
    });
});

export { state };
