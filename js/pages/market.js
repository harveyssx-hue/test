// Market Page View Controller
import { state } from '../modules/state.js?v=2.2.0';

let marketIntervals = null;
async function loadMarketIntervals() {
    try {
        const res = await apiFetch('GET', '/market/intervals', null, false);
        if (res && res.code === 200) {
            marketIntervals = res.result || res.data;
        }
    } catch (e) {
        console.warn('Failed to load market intervals:', e);
    }
    if (!marketIntervals) {
        marketIntervals = {
            stock: ["1m", "5m", "15m", "30m", "1h", "1d", "1w", "1M"],
            crypto: ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]
        };
    }
}

function getIntervalSeconds(interval) {
    if (!interval) return 60;
    const unit = interval.slice(-1);
    const val = parseInt(interval.slice(0, -1), 10) || 1;
    if (unit === 'm') return val * 60;
    if (unit === 'h') return val * 3600;
    if (unit === 'd') return val * 86400;
    if (unit === 'w') return val * 604800;
    if (unit === 'M') return val * 2592000;
    return 60;
}

function shortenCompanyName(name) {
    if (!name) return '';
    let clean = name.trim();
    // Only filter out legal structure suffixes (case-insensitive)
    clean = clean.replace(/\b(ltd|limited|co|co\.|corp|corporation|inc|incorporated|plc)\b/ig, '');
    // Clean up trailing spaces, commas, dots, dashes
    clean = clean.replace(/[\s,\.\-]+$/, '').trim();
    return clean;
}

// Expose key functions to window immediately to avoid timing issues with inline event handlers
window.switchActiveSymbol = switchActiveSymbol;
window.loadRecommendedInstruments = loadRecommendedInstruments;
window.renderRecommendedIndexCards = renderRecommendedIndexCards;
window.loadWatchlist = loadWatchlist;
window.updateWatchlistUI = updateWatchlistUI;
window.toggleWatchlist = toggleWatchlist;
window.openWatchlistModal = openWatchlistModal;
window.closeWatchlistModal = closeWatchlistModal;
window.showMarketDetail = showMarketDetail;
window.hideMarketDetail = hideMarketDetail;
window.handleInlineWatchlistToggle = handleInlineWatchlistToggle;
window.openSearchModal = openSearchModal;
window.closeSearchModal = closeSearchModal;
window.handleSearchInputChange = handleSearchInputChange;
window.renderSearchResults = renderSearchResults;
window.drawIndexSparkline = drawIndexSparkline;
window.drawIndexSparklineThrottled = drawIndexSparklineThrottled;
window.switchMarketCategory = switchMarketCategory;
window.renderMarketList = renderMarketList;
window.getCachedElement = getCachedElement;
window.updateChartRealtime = updateChartRealtime;

const getCoinFallbackSvg = (symbol, size = 32) => {
    const cleanSym = symbol.toUpperCase().replace('USDT', '');
    const coinColors = { BTC: '#F7931A', ETH: '#627EEA', SOL: '#14F195', XRP: '#23292F', USDT: '#26A17B' };
    const coinColor = encodeURIComponent(coinColors[cleanSym] || '#1A3EC1');
    const half = size / 2;
    const yPos = half + (size * 0.14);
    const fontSize = Math.floor(size * 0.34);
    const text = cleanSym.substring(0, 2);
    return `data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22${size}%22 height=%22${size}%22><circle cx=%22${half}%22 cy=%22${half}%22 r=%22${half}%22 fill=%22${coinColor}%22/><text x=%22${half}%22 y=%22${yPos}%22 font-size=%22${fontSize}%22 font-weight=%22800%22 fill=%22white%22 text-anchor=%22middle%22 font-family=%22system-ui, sans-serif%22>${text}</text></svg>`;
};
window.getCoinFallbackSvg = getCoinFallbackSvg;

// Stock rankings cache and state
let stockGainers = [];
let stockLosers = [];
let stockTurnover = [];
let loadingStockRankings = false;

const domElementCache = {};

function getCachedElement(id) {
    const cached = domElementCache[id];
    if (!cached || !cached.isConnected) {
        domElementCache[id] = document.getElementById(id);
    }
    return domElementCache[id];
}

function switchActiveSymbol(symbol) {
    // Prohibit non-logged-in guest users from accessing market details
    if (!currentUser) {
        let loginPromptMsg = currentLocale === 'hi'
            ? "🔒 कृपया इस पृष्ठ तक पहुँचने के लिए पहले लॉग इन करें!"
            : "🔒 Please log in first to access this page!";
        showToast(loginPromptMsg, true);
        
        openAuthModal();
        
        // Ensure home tab remains visually highlighted in bottom nav
        const navButtons = document.querySelectorAll('.nav-tab');
        navButtons.forEach(b => b.classList.remove('active'));
        const homeNavBtn = document.getElementById('btn-nav-home');
        if (homeNavBtn) homeNavBtn.classList.add('active');
        
        return;
    }

    activeSymbol = symbol.toLowerCase();
    
    if (window.location.hash !== '#/market') {
        window.pendingMarketDetailSymbol = activeSymbol;
        window.location.hash = '#/market';
        return;
    }
    
    // Unconditionally activate Market tab view without resetting to list view
    const views = document.querySelectorAll('.view-tab-content');
    views.forEach(v => v.classList.remove('active'));
    const navButtons = document.querySelectorAll('.nav-tab');
    navButtons.forEach(b => b.classList.remove('active'));
    
    const targetView = document.getElementById('view-market');
    if (targetView) {
        targetView.classList.add('active');
        activeTab = 'market';
        window.scrollTo(0, 0);
    }
    const activeNavBtn = document.getElementById('btn-nav-market');
    if (activeNavBtn) activeNavBtn.classList.add('active');
    
    // Directly slide into that symbol's detail page
    showMarketDetail(symbol);
}

// Throttled Canvas drawing timer pool to restrict high frequency redraw layouts
const lastCanvasDrawTimes = {};
function drawIndexSparklineThrottled(canvasId, dataArr, isUp, throttleMs = 300) {
    const now = Date.now();
    const lastDraw = lastCanvasDrawTimes[canvasId] || 0;
    if (now - lastDraw < throttleMs) {
        return;
    }
    lastCanvasDrawTimes[canvasId] = now;
    drawIndexSparkline(canvasId, dataArr, isUp);
}

// --- Dynamic Canvas Sparkline Renderer for indices ---
function drawIndexSparkline(canvasId, dataArr, isUp) {
    const canvas = getCachedElement(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    if (!dataArr || dataArr.length < 2) return;
    
    const min = Math.min(...dataArr);
    const max = Math.max(...dataArr);
    const range = max - min || 1;
    
    ctx.beginPath();
    for (let i = 0; i < dataArr.length; i++) {
        const x = (i / (dataArr.length - 1)) * w;
        const y = h - ((dataArr[i] - min) / range) * (h * 0.7) - (h * 0.15);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.strokeStyle = isUp ? '#10B981' : '#EF4444';
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Draw subtle gradient fill underneath sparkline
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isUp ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
}

// --- LIGHTWEIGHT CHARTS INTEGRATION (Light Theme Skin) ---
// --- LIGHTWEIGHT CHARTS INTEGRATION (Light Theme Skin) ---
async function initChart() {
    const container = document.getElementById('kline-chart');
    if (!container) return;
    
    container.innerHTML = '';
    
    currentChart = LightweightCharts.createChart(container, {
        localization: {
            locale: 'en-US'
        },
        layout: {
            background: { type: 'solid', color: '#ffffff' }, // Elegant pure white chart background
            textColor: '#64748b', // Slate 500 text
            fontSize: 10,
        },
        grid: {
            vertLines: { color: '#f1f5f9' }, // Light gray grids
            horzLines: { color: '#f1f5f9' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: { color: '#5B51F9', width: 1.5, style: LightweightCharts.LineStyle.Solid, labelBackgroundColor: '#5B51F9' },
            horzLine: { color: '#5B51F9', width: 1.5, style: LightweightCharts.LineStyle.Solid, labelBackgroundColor: '#5B51F9' },
        },
        timeScale: {
            borderColor: '#e2e8f0',
            timeVisible: true,
            secondsVisible: false,
        },
        rightPriceScale: {
            borderColor: '#e2e8f0',
        }
    });

    candleSeries = currentChart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
    });

    // Try fetching real history from online API first
    let inst = recommendedInstruments.find(i => i.symbol.toLowerCase() === activeSymbol);
    if (!inst) {
        const cleanSymbol = activeSymbol.toUpperCase();
        const isStockSymbol = cleanSymbol.endsWith('.IN') || !cleanSymbol.endsWith('USDT');
        const defaultExchangeId = recommendedInstruments.length > 0 
            ? (recommendedInstruments.find(r => (r.assetClass === 'STOCK' || r.symbol.toUpperCase().endsWith('.IN')) === isStockSymbol)?.exchangeId || recommendedInstruments[0].exchangeId)
            : (isStockSymbol ? '1211226463185936384' : '1183071278383239173');
        inst = {
            symbol: cleanSymbol,
            exchangeId: defaultExchangeId,
            assetClass: isStockSymbol ? 'STOCK' : 'CRYPTO'
        };
    }
    if (inst && inst.exchangeId) {
        try {
            const res = await apiFetch('GET', `/market/klines?exchangeId=${inst.exchangeId}&symbol=${inst.symbol.toUpperCase()}&interval=${activeInterval}&limit=80`, null, false);
            const klines = res ? (res.result || res.data || []) : [];
            if (klines.length > 0) {
                const chartData = klines.map(k => ({
                    time: Math.floor(k.timestamp / 1000),
                    open: parseFloat(k.open),
                    high: parseFloat(k.high),
                    low: parseFloat(k.low),
                    close: parseFloat(k.close)
                })).sort((a, b) => a.time - b.time);
                
                // Remove duplicate time entries if any, as lightweight-charts throws error on duplicate time keys
                const uniqueChartData = [];
                const seenTimes = new Set();
                for (const d of chartData) {
                    if (!seenTimes.has(d.time)) {
                        seenTimes.add(d.time);
                        uniqueChartData.push(d);
                    }
                }
                candleSeries.setData(uniqueChartData);
                if (uniqueChartData.length > 0) {
                    const lastBar = uniqueChartData[uniqueChartData.length - 1];
                    lastBarTime = lastBar.time;
                    currentBar = { ...lastBar };
                }
                return;
            }
        } catch (e) {
            console.warn('Failed to load real klines history, falling back to simulation:', e);
        }
    }

    // Enterprise-grade placeholder: if API fails or returns no data, clear the chart container and show a proper status message
    const chartContainer = document.getElementById('kline-chart');
    if (chartContainer) {
        chartContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 0.8rem; gap: 8px; padding: 20px;">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <span data-i18n="market_chart_no_data">Historical chart data is temporarily unavailable</span>
            </div>
        `;
    }
    currentChart = null;
    candleSeries = null;
}

function relayoutTradingChart() {
    if (!currentChart) return;
    const el = document.getElementById('kline-chart');
    if (el) {
        currentChart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    }
}

// Update chart dynamically from real-time WebSocket ticks
let lastBarTime = 0;
let currentBar = null;

function updateChartRealtime(price, timestamp) {
    if (!candleSeries) return;
    try {
        const timeSec = Math.floor(timestamp / 1000);
        const intervalSec = getIntervalSeconds(activeInterval);
        const intervalBlock = Math.floor(timeSec / intervalSec) * intervalSec;
        const p = parseFloat(price);
        
        if (intervalBlock < lastBarTime) return; // Prevent crashes due to client lag
        
        if (currentBar && currentBar.time === intervalBlock) {
            currentBar.high = Math.max(currentBar.high, p);
            currentBar.low = Math.min(currentBar.low, p);
            currentBar.close = p;
        } else {
            currentBar = {
                time: intervalBlock,
                open: currentBar ? currentBar.close : p,
                high: p,
                low: p,
                close: p
            };
        }
        
        candleSeries.update(currentBar);
        lastBarTime = Math.max(lastBarTime, intervalBlock);
    } catch(e) {
        console.warn('TV lightweight charts update skipped safely:', e);
    }
}

function createCardHtml(inst, prefix) {
    const symUpper = inst.symbol.toUpperCase();
    const symLower = inst.symbol.toLowerCase();
    const ticker = inst.ticker || {};
    
    const priceVal = parseFloat(ticker.closePrice || 0);
    const priceStr = priceVal ? priceVal.toFixed(symLower === 'xrpusdt' ? 4 : 2) : '--';
    
    const chgPercent = parseFloat(ticker.priceChangePercent || 0);
    const chgStr = `${chgPercent >= 0 ? '+' : ''}${chgPercent.toFixed(2)}%`;
    const chgColor = chgPercent >= 0 ? 'var(--green)' : 'var(--red)';
    const chgBg = chgPercent >= 0 ? 'var(--green-light)' : 'var(--red-light)';
    
    const cleanSym = inst.symbol.toUpperCase().replace('.IN', '').replace('USDT', '');
    const isStock = inst.assetClass === 'STOCK' || !inst.symbol.toUpperCase().endsWith('USDT');
    const quoteHtml = isStock ? '' : '<span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 600;">/USDT</span>';
    
    return `
        <div class="ticker-card" onclick="switchActiveSymbol('${inst.symbol}')" style="flex: 0 0 145px; background: #FFF; border-radius: 20px; padding: 14px 12px 0; box-shadow: var(--shadow); border: 1.5px solid var(--border-light); cursor: pointer; transition: var(--transition); display: flex; flex-direction: column; overflow: hidden; position: relative; height: 110px;">
            <span style="font-size: 0.72rem; font-weight: 800; color: var(--text-primary); text-align: left;">${cleanSym}${quoteHtml}</span>
            <div style="display: flex; align-items: baseline; justify-content: flex-start; gap: 6px; margin-top: 6px;">
                <span id="${prefix}price-${symLower}" style="font-size: 1.05rem; font-weight: 850; color: ${chgColor}; font-family: 'Outfit';">${priceStr}</span>
                <span id="${prefix}change-${symLower}" style="font-size: 0.62rem; font-weight: 750; color: ${chgColor}; background: ${chgBg}; padding: 1px 5px; border-radius: 6px; font-family: 'Outfit'; display: flex; align-items: center; gap: 1px;">${chgStr}</span>
            </div>
            <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 35px;">
                <canvas class="sparkline-canvas" id="${prefix}canvas-${symLower}" width="145" height="35" style="width: 100%; height: 100%; display: block;"></canvas>
            </div>
        </div>
    `;
}

function renderRecommendedIndexCards() {
    const homeSlider = document.getElementById('home-ticker-slider');
    const marketSlider = document.getElementById('market-ticker-slider');
    
    if (!homeSlider && !marketSlider) return;
    if (!recommendedInstruments || recommendedInstruments.length === 0) return;
    
    const htmlHome = recommendedInstruments.map(inst => createCardHtml(inst, 'idx-')).join('');
    const htmlMarket = recommendedInstruments.map(inst => createCardHtml(inst, 'm-idx-')).join('');
    
    if (homeSlider) {
        homeSlider.innerHTML = htmlHome;
    }
    if (marketSlider) {
        marketSlider.innerHTML = htmlMarket;
    }
    
    // Draw initial sparklines
    recommendedInstruments.forEach(inst => {
        const symUpper = inst.symbol.toUpperCase();
        const symLower = inst.symbol.toLowerCase();
        const pool = sparklinePools[symUpper];
        const ticker = inst.ticker || {};
        const chgPercent = parseFloat(ticker.priceChangePercent || 0);
        
        if (pool && window.drawIndexSparkline) {
            if (homeSlider) {
                window.drawIndexSparkline(`idx-canvas-${symLower}`, pool, chgPercent >= 0);
            }
            if (marketSlider) {
                window.drawIndexSparkline(`m-idx-canvas-${symLower}`, pool, chgPercent >= 0);
            }
        }
    });
}
window.renderRecommendedIndexCards = renderRecommendedIndexCards;

async function loadRecommendedInstruments() {
    if (!marketIntervals) {
        await loadMarketIntervals();
    }
    let success = false;
    try {
        const res = await apiFetch('GET', '/instruments/recommended', null, false);
        if (res.code === 200) {
            recommendedInstruments = res.result || res.data || [];
            if (recommendedInstruments.length > 0) {
                success = true;
            }
        }
    } catch(e) {
        console.error('Failed to load recommended instruments:', e);
    }
    
    if (!success) {
        recommendedInstruments = [];
    }
    
    // Initialize sparkline pools for recommended coins with a flat baseline of the current price (no fake price generation)
    recommendedInstruments.forEach(inst => {
        const symUpper = inst.symbol.toUpperCase();
        if (!sparklinePools[symUpper]) {
            const base = parseFloat(inst.ticker?.closePrice) || 1.0;
            sparklinePools[symUpper] = Array.from({length: 12}, () => base);
        }
    });
    
    // Render dynamic index cards
    renderRecommendedIndexCards();
    
    // Subscribe to recommended instruments on WS
    if (window.subscribeNewInstruments && recommendedInstruments.length > 0) {
        window.subscribeNewInstruments(recommendedInstruments);
    }
    
    // Render market list!
    renderMarketList();
    
    // If current activeSymbol is not in the recommended list, switch to the first recommended symbol
    const hasActive = recommendedInstruments.some(inst => inst.symbol.toLowerCase() === activeSymbol);
    if (!hasActive && recommendedInstruments.length > 0) {
        activeSymbol = recommendedInstruments[0].symbol.toLowerCase();
    }
    
    // Check watchlist status
    updateWatchlistUI();
    
    // Initialize home trending list
    if (typeof renderHomeTrending === 'function') {
        renderHomeTrending('gainers');
    }
}

function renderMarketList() {
    const container = document.getElementById('market-list-container');
    if (!container) return;
    
    if (loadingStockRankings) {
        container.innerHTML = `<div class="loading-state-mini">${t('loading_market_list')}</div>`;
        return;
    }
    
    if (recommendedInstruments.length === 0) {
        container.innerHTML = `<div class="loading-state-mini">${t('market_no_symbols')}</div>`;
        return;
    }
    
    // Filter and sort recommendedInstruments based on currentMarketCategory
    let list = [...recommendedInstruments];
    if (currentMarketCategory === 'watchlist') {
        list = list.filter(inst => watchlist.some(w => w.instrumentId.toString() === inst.id.toString()));
    } else if (currentMarketCategory === 'cap') {
        // Sort by approximate market cap (BTC > ETH > BNB > XRP > ASTER)
        const capOrder = { 'btcusdt': 1, 'ethusdt': 2, 'bnbusdt': 3, 'xrpusdt': 4, 'asterusdt': 5 };
        list.sort((a, b) => {
            const aVal = capOrder[a.symbol.toLowerCase()] || 99;
            const bVal = capOrder[b.symbol.toLowerCase()] || 99;
            return aVal - bVal;
        });
    } else if (currentMarketCategory === 'volume') {
        // Sort by quote volume proxy (BTC > ETH > BNB > XRP > ASTER)
        const volOrder = { 'btcusdt': 1, 'ethusdt': 2, 'xrpusdt': 3, 'bnbusdt': 4, 'asterusdt': 5 };
        list.sort((a, b) => {
            const aVal = volOrder[a.symbol.toLowerCase()] || 99;
            const bVal = volOrder[b.symbol.toLowerCase()] || 99;
            return aVal - bVal;
        });
    } else if (currentMarketCategory === 'stock-gainers') {
        list = stockGainers.filter(inst => {
            const chg = parseFloat(inst.ticker?.priceChangePercent) || 0;
            return chg > 0;
        }).sort((a, b) => {
            const aChg = parseFloat(a.ticker?.priceChangePercent) || 0;
            const bChg = parseFloat(b.ticker?.priceChangePercent) || 0;
            return bChg - aChg;
        });
    } else if (currentMarketCategory === 'stock-losers') {
        list = stockLosers.filter(inst => {
            const chg = parseFloat(inst.ticker?.priceChangePercent) || 0;
            return chg < 0;
        }).sort((a, b) => {
            const aChg = parseFloat(a.ticker?.priceChangePercent) || 0;
            const bChg = parseFloat(b.ticker?.priceChangePercent) || 0;
            return aChg - bChg;
        });
    } else if (currentMarketCategory === 'stock-turnover') {
        list = [...stockTurnover];
    } else {
        // 'sector': default order from API
    }
    
    if (list.length === 0) {
        if (currentMarketCategory === 'watchlist') {
            container.innerHTML = `<div class="loading-state-mini" style="padding: 30px 15px; color: var(--text-muted); font-size: 0.8rem; font-weight: 600;">${t('watchlist_empty')}</div>`;
        } else {
            container.innerHTML = `<div class="loading-state-mini" style="padding: 30px 15px; color: var(--text-muted); font-size: 0.8rem; font-weight: 600;">${t('market_no_symbols')}</div>`;
        }
        return;
    }
    
    container.innerHTML = `
        <div class="market-list-header">
            <span>${t('market_col_name')}</span>
            <span style="text-align: center; margin-left: 15px;">${t('market_col_trend')}</span>
            <span style="text-align: right;">${t('market_col_price')}</span>
        </div>
        ${list.map(inst => {
            const symUpper = inst.symbol.toUpperCase();
            const ticker = inst.ticker || {};
            
            const hasPrice = ticker.closePrice !== undefined && ticker.closePrice !== null;
            const priceVal = hasPrice ? parseFloat(ticker.closePrice) : null;
            const priceStr = priceVal !== null && !isNaN(priceVal) ? priceVal.toFixed(inst.symbol.toLowerCase() === 'xrpusdt' ? 4 : 2) : '--';
            
            const hasChg = ticker.priceChangePercent !== undefined && ticker.priceChangePercent !== null;
            const chgPercent = hasChg ? parseFloat(ticker.priceChangePercent) : null;
            const chgStr = chgPercent !== null && !isNaN(chgPercent) ? `${chgPercent >= 0 ? '+' : ''}${chgPercent.toFixed(2)}%` : '--';
            const chgClass = chgPercent === null || isNaN(chgPercent) ? 'gray' : (chgPercent >= 0 ? 'green' : 'red');
            
            const isWatched = watchlist.some(w => w.instrumentId.toString() === inst.id.toString());
            const starChar = isWatched ? '\u2605' : '\u2606';
            const starColor = isWatched ? '#F59E0B' : 'var(--text-muted)';
            
            const cleanSym = inst.symbol.toUpperCase().replace('.IN', '').replace('USDT', '');
            const fallbackSvg = getCoinFallbackSvg(inst.symbol, 32);
            
            const isStock = inst.assetClass === 'STOCK' || !inst.symbol.toUpperCase().endsWith('USDT');
            const quoteSymbolHtml = isStock ? '' : '<span class="quote-symbol">/USDT</span>';
            
            return `
                <div class="market-coin-row" onclick="showMarketDetail('${inst.symbol}')">
                    <div class="coin-left-col">
                        <img class="coin-row-logo" src="${inst.logo || ''}" onerror="this.onerror=null; this.src='${fallbackSvg}'" alt="${cleanSym}" />
                        <div class="coin-row-meta">
                            <div class="coin-row-symbol">
                                ${cleanSym}${quoteSymbolHtml}
                            </div>
                            <span class="coin-row-name">${shortenCompanyName(inst.name) || cleanSym}</span>
                        </div>
                    </div>
                    
                    <div class="coin-sparkline-col">
                        <canvas class="coin-sparkline-canvas" id="row-canvas-${symUpper}" width="70" height="24"></canvas>
                    </div>
                    
                    <div class="coin-right-col">
                        <span class="coin-row-price" id="row-price-${symUpper}">${priceStr}</span>
                        <div style="display: flex; align-items: center;">
                            <span class="coin-row-change-badge ${chgClass}" id="row-change-${symUpper}">${chgStr}</span>
                            <button class="coin-row-watchlist-btn" id="row-star-${symUpper}" style="color: ${starColor}" onclick="handleInlineWatchlistToggle(event, '${inst.symbol}')">${starChar}</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('')}
    `;
    
    // Draw all sparklines
    list.forEach(inst => {
        const symUpper = inst.symbol.toUpperCase();
        const pool = sparklinePools[symUpper];
        const chg = parseFloat(inst.ticker?.priceChangePercent || 0);
        if (pool) {
            drawIndexSparkline(`row-canvas-${symUpper}`, pool, chg >= 0);
        }
    });
}

function switchMarketCategory(cat) {
    currentMarketCategory = cat;
    
    const categories = ['watchlist', 'sector', 'cap', 'volume', 'stock-gainers', 'stock-losers', 'stock-turnover'];
    categories.forEach(c => {
        const btn = document.getElementById(`m-cat-${c}`);
        if (btn) {
            if (c === cat) {
                btn.classList.add('active');
                btn.style.color = 'var(--primary)';
                btn.style.fontWeight = '800';
            } else {
                btn.classList.remove('active');
                btn.style.color = 'var(--text-muted)';
                btn.style.fontWeight = '600';
            }
        }
    });
    
    if (cat.startsWith('stock-')) {
        loadStockRankings(cat);
    } else {
        loadingStockRankings = false;
        renderMarketList();
    }
}

async function loadStockRankings(type) {
    loadingStockRankings = true;
    renderMarketList();
    
    let path = '';
    if (type === 'stock-gainers') {
        path = '/market/stock-rankings/gainers';
    } else if (type === 'stock-losers') {
        path = '/market/stock-rankings/losers';
    } else if (type === 'stock-turnover') {
        path = '/market/stock-rankings/turnover';
    }
    
    try {
        const res = await apiFetch('GET', path, null, false);
        let data = res ? (res.result || res.data || []) : [];
        if (!Array.isArray(data)) {
            data = [];
        }
        
        if (type === 'stock-gainers') {
            stockGainers = data.filter(inst => {
                const chg = parseFloat(inst.ticker?.priceChangePercent) || 0;
                return chg > 0;
            }).sort((a, b) => {
                const aChg = parseFloat(a.ticker?.priceChangePercent) || 0;
                const bChg = parseFloat(b.ticker?.priceChangePercent) || 0;
                return bChg - aChg;
            });
        } else if (type === 'stock-losers') {
            stockLosers = data.filter(inst => {
                const chg = parseFloat(inst.ticker?.priceChangePercent) || 0;
                return chg < 0;
            }).sort((a, b) => {
                const aChg = parseFloat(a.ticker?.priceChangePercent) || 0;
                const bChg = parseFloat(b.ticker?.priceChangePercent) || 0;
                return aChg - bChg;
            });
        } else if (type === 'stock-turnover') {
            stockTurnover = data;
        }
        
        // Add loaded instruments to recommendedInstruments if missing
        data.forEach(inst => {
            if (inst && inst.id && inst.symbol) {
                if (!recommendedInstruments.some(r => r.id && r.id.toString() === inst.id.toString())) {
                    recommendedInstruments.push(inst);
                }
                
                // Initialize sparkline pools for stock symbols with a flat baseline of the current price (no fake price generation)
                const symUpper = inst.symbol.toUpperCase();
                if (!sparklinePools[symUpper]) {
                    const base = parseFloat(inst.ticker?.closePrice) || 1.0;
                    sparklinePools[symUpper] = Array.from({length: 12}, () => base);
                }
            }
        });
        
        // Dynamic subscription update for new tickers
        if (window.subscribeNewInstruments) {
            window.subscribeNewInstruments(data);
        }
    } catch (e) {
        console.error(`Failed to load stock rankings for ${type}:`, e);
    } finally {
        loadingStockRankings = false;
        renderMarketList();
    }
}

function renderMarketTickerData(tickerData) {
    if (!tickerData) return;
    
    const lastPrice = parseFloat(tickerData.closePrice || tickerData.lastPrice || 0);
    const chgPercent = parseFloat(tickerData.priceChangePercent || 0);
    const highVal = parseFloat(tickerData.highPrice || tickerData.high || 0);
    const lowVal = parseFloat(tickerData.lowPrice || tickerData.low || 0);
    
    const decimals = activeSymbol === 'xrpusdt' ? 4 : 2;
    
    const priceEl = document.getElementById('market-last-price');
    if (priceEl && !isNaN(lastPrice) && lastPrice > 0) {
        priceEl.innerText = lastPrice.toFixed(decimals);
    }
    
    const changeEl = document.getElementById('market-price-change');
    if (changeEl && !isNaN(chgPercent)) {
        const chgStr = `${chgPercent >= 0 ? '+' : ''}${chgPercent.toFixed(2)}%`;
        changeEl.innerText = chgStr;
        changeEl.className = 'm-change-pct ' + (chgPercent >= 0 ? 'green' : 'red');
    }
    
    const highEl = document.getElementById('market-high');
    if (highEl && !isNaN(highVal) && highVal > 0) {
        highEl.innerText = highVal.toFixed(decimals);
    }
    
    const lowEl = document.getElementById('market-low');
    if (lowEl && !isNaN(lowVal) && lowVal > 0) {
        lowEl.innerText = lowVal.toFixed(decimals);
    }
}
window.renderMarketTickerData = renderMarketTickerData;

function showMarketDetail(symbol) {
    activeSymbol = symbol.toLowerCase();
    isMarketDetailActive = true;
    activeInterval = '1m'; // Default interval on detail view open
    
    // Instantly clear out old symbol elements to prevent visual sticking
    const priceEl = document.getElementById('market-last-price');
    if (priceEl) priceEl.innerText = '--';
    const changeEl = document.getElementById('market-price-change');
    if (changeEl) {
        changeEl.innerText = '--';
        changeEl.className = 'm-change-pct';
    }
    const highEl = document.getElementById('market-high');
    if (highEl) highEl.innerText = '--';
    const lowEl = document.getElementById('market-low');
    if (lowEl) lowEl.innerText = '--';
    
    const spreadEl = document.getElementById('ob-spread-price');
    if (spreadEl) spreadEl.innerText = '--';
    
    const asksEl = document.getElementById('ob-asks-list');
    if (asksEl) asksEl.innerHTML = '<div style="text-align: center; padding: 15px; color: var(--text-muted); font-size: 0.75rem;">Loading...</div>';
    const bidsEl = document.getElementById('ob-bids-list');
    if (bidsEl) bidsEl.innerHTML = '<div style="text-align: center; padding: 15px; color: var(--text-muted); font-size: 0.75rem;">Loading...</div>';
    
    const tradesEl = document.getElementById('trades-ticker-list');
    if (tradesEl) tradesEl.innerHTML = '<div style="text-align: center; padding: 15px; color: var(--text-muted); font-size: 0.75rem;">Loading...</div>';

    const listView = document.getElementById('market-list-view');
    const detailView = document.getElementById('market-detail-view');
    if (listView) listView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';
    
    let inst = recommendedInstruments.find(i => i.symbol.toLowerCase() === activeSymbol);
    if (!inst) {
        // Fallback for custom/non-recommended symbols like SOLUSDT so that all details and snapshots still load
        const cleanSymbol = symbol.toUpperCase();
        const isStockSymbol = cleanSymbol.endsWith('.IN') || !cleanSymbol.endsWith('USDT');
        const defaultExchangeId = recommendedInstruments.length > 0 
            ? (recommendedInstruments.find(r => (r.assetClass === 'STOCK' || r.symbol.toUpperCase().endsWith('.IN')) === isStockSymbol)?.exchangeId || recommendedInstruments[0].exchangeId)
            : (isStockSymbol ? '1211226463185936384' : '1183071278383239173');
            
        inst = {
            symbol: cleanSymbol,
            logo: getCoinFallbackSvg(cleanSymbol, 20),
            exchangeId: defaultExchangeId,
            assetClass: isStockSymbol ? 'STOCK' : 'CRYPTO',
            name: cleanSymbol.replace('.IN', '').replace('USDT', ''),
            ticker: {}
        };
        // Add it to recommendedInstruments so it is cached and doesn't get lost, and stays in the list of streams
        recommendedInstruments.push(inst);
    }
    
    // Instantly render cached ticker data if present
    if (inst.ticker) {
        renderMarketTickerData(inst.ticker);
    }
    
    const logoEl = document.getElementById('detail-coin-logo');
    const symbolEl = document.getElementById('detail-coin-symbol');
    if (inst) {
        if (logoEl) {
            logoEl.onerror = () => {
                logoEl.onerror = null;
                logoEl.src = getCoinFallbackSvg(inst.symbol, 20);
            };
            logoEl.src = inst.logo || '';
            logoEl.style.display = 'inline-block';
        }
        if (symbolEl) {
            const isStock = inst.assetClass === 'STOCK' || !inst.symbol.toUpperCase().endsWith('USDT');
            const cleanSym = inst.symbol.toUpperCase().replace('.IN', '').replace('USDT', '');
            symbolEl.innerText = isStock ? cleanSym : cleanSym + ' / USDT';
        }
        
        // Fetch initial Ticker snapshot from HTTP API
        if (inst.exchangeId) {
            apiFetch('GET', `/market/ticker?exchangeId=${inst.exchangeId}&symbol=${inst.symbol.toUpperCase()}`, null, false)
                .then(tickerRes => {
                    if (tickerRes && (tickerRes.code === 200 || tickerRes.lastPrice || tickerRes.closePrice)) {
                        const tickerData = tickerRes.result || tickerRes.data || tickerRes;
                        
                        // Update cache in recommendedInstruments
                        const cacheInst = recommendedInstruments.find(i => i.symbol.toLowerCase() === inst.symbol.toLowerCase());
                        if (cacheInst) {
                            cacheInst.ticker = {
                                ...cacheInst.ticker,
                                closePrice: tickerData.closePrice || tickerData.lastPrice,
                                priceChangePercent: tickerData.priceChangePercent,
                                highPrice: tickerData.highPrice || tickerData.high,
                                lowPrice: tickerData.lowPrice || tickerData.low
                            };
                        }
                        
                        // Render if this is still the active symbol
                        if (window.renderMarketTickerData && activeSymbol === inst.symbol.toLowerCase()) {
                            window.renderMarketTickerData(tickerData);
                        }
                    }
                })
                .catch(e => console.warn('Failed to load initial market ticker snapshot:', e));

            // Fetch initial Order Book snapshot from HTTP API
            apiFetch('GET', `/market/depth?exchangeId=${inst.exchangeId}&symbol=${inst.symbol.toUpperCase()}`, null, false)
                .then(depthRes => {
                    if (depthRes && (depthRes.code === 200 || depthRes.asks)) {
                        const depthData = depthRes.result || depthRes.data || depthRes;
                        if (window.executeRenderMarketDepth && activeSymbol === inst.symbol.toLowerCase()) {
                            window.executeRenderMarketDepth(depthData);
                        }
                    }
                })
                .catch(e => console.warn('Failed to load initial market depth snapshot:', e));

            // Fetch initial Recent Trades snapshot from HTTP API
            apiFetch('GET', `/market/trades?exchangeId=${inst.exchangeId}&symbol=${inst.symbol.toUpperCase()}&limit=10`, null, false)
                .then(tradesRes => {
                    if (tradesRes && (tradesRes.code === 200 || Array.isArray(tradesRes))) {
                        const tradesData = tradesRes.result || tradesRes.data || tradesRes;
                        if (Array.isArray(tradesData) && window.renderMarketTradesSnapshot && activeSymbol === inst.symbol.toLowerCase()) {
                            window.renderMarketTradesSnapshot(tradesData);
                        }
                    }
                })
                .catch(e => console.warn('Failed to load initial market trades snapshot:', e));
        }
    }
    
    updateWatchlistUI();
    renderChartIntervalSelector(inst);
    initChart();
    connectMarketWS();
    setTimeout(relayoutTradingChart, 150);
}

function renderChartIntervalSelector(inst) {
    const selectorEl = document.getElementById('chart-interval-selector');
    if (!selectorEl) return;
    
    const isStock = inst && (inst.assetClass === 'STOCK' || (inst.symbol && !inst.symbol.toUpperCase().endsWith('USDT')));
    const category = isStock ? 'stock' : 'crypto';
    const intervals = (marketIntervals && marketIntervals[category]) || (isStock ? ["1m", "5m", "15m", "30m", "1h", "1d", "1w", "1M"] : ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]);
    
    if (!intervals.includes(activeInterval)) {
        activeInterval = intervals[0] || '1m';
    }
    
    selectorEl.innerHTML = intervals.map(interval => {
        const activeClass = interval === activeInterval ? 'active' : '';
        return `<button class="chart-interval-btn ${activeClass}" onclick="switchChartInterval('${interval}')">${interval}</button>`;
    }).join('');
    
    updateChartTitleText();
}

function updateChartTitleText() {
    const titleEl = document.querySelector('.chart-title');
    if (titleEl) {
        const intervalStr = activeInterval.toUpperCase();
        titleEl.innerText = `${intervalStr} ${t('market_chart_title')}`;
    }
}

window.switchChartInterval = async function(interval) {
    if (activeInterval === interval) return;
    activeInterval = interval;
    
    const btns = document.querySelectorAll('.chart-interval-btn');
    btns.forEach(btn => {
        if (btn.innerText === interval) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    updateChartTitleText();
    await initChart();
    if (window.connectMarketWS) {
        window.connectMarketWS();
    }
};

function hideMarketDetail() {
    isMarketDetailActive = false;
    
    const listView = document.getElementById('market-list-view');
    const detailView = document.getElementById('market-detail-view');
    if (listView) listView.style.display = 'block';
    if (detailView) detailView.style.display = 'none';
    
    // Redraw all sparklines after list container becomes visible
    setTimeout(() => {
        recommendedInstruments.forEach(inst => {
            const symUpper = inst.symbol.toUpperCase();
            const pool = sparklinePools[symUpper];
            const chg = parseFloat(inst.ticker?.priceChangePercent || 0);
            if (pool) {
                drawIndexSparkline(`row-canvas-${symUpper}`, pool, chg >= 0);
            }
        });
    }, 50);
}

async function handleInlineWatchlistToggle(event, symbol) {
    event.stopPropagation(); // Stop row click navigation!
    
    if (!currentUser) {
        openAuthModal();
        return;
    }
    
    const inst = recommendedInstruments.find(i => i.symbol.toLowerCase() === symbol.toLowerCase());
    if (!inst) return;
    
    const isWatched = watchlist.some(w => w.instrumentId.toString() === inst.id.toString());
    const path = isWatched ? '/watchlists/remove' : '/watchlists/add';
    const bodyStr = `{"instrumentId":${inst.id}}`;
    
    let toastMsg = "";
    if (isWatched) {
        toastMsg = currentLocale === 'hi' ? "पसंदीदा से हटाया जा रहा है..." : "Removing from favorites...";
    } else {
        toastMsg = currentLocale === 'hi' ? "पसंदीदा में जोड़ा जा रहा है..." : "Adding to favorites...";
    }
    showToast(toastMsg, false);
    
    try {
        const res = await apiFetchWithRawBody('POST', path, bodyStr, true);
        if (res.code === 200) {
            let successMsg = "";
            if (isWatched) {
                successMsg = currentLocale === 'hi' ? "✓ पसंदीदा से सफलतापूर्वक हटाया गया!" : "✓ Successfully removed from favorites!";
            } else {
                successMsg = currentLocale === 'hi' ? "🎉 पसंदीदा में सफलतापूर्वक जोड़ा गया!" : "🎉 Successfully added to favorites!";
            }
            showToast(successMsg, false);
            
            // Reload watchlist
            const listRes = await apiFetch('GET', '/watchlists/list', null, true);
            if (listRes.code === 200) {
                watchlist = listRes.result || listRes.data || [];
                renderMarketList();
                updateWatchlistUI();
            }
        } else {
            let failMsg = currentLocale === 'hi' ? "ऑपरेशन विफल" : "Operation failed";
            showToast(res.errorMessage || failMsg, true);
        }
    } catch(e) {
        let errText = currentLocale === 'hi' ? "नेटवर्क अपवाद!" : "Network exception!";
        showToast(errText, true);
    }
}

async function loadWatchlist() {
    if (!currentUser) return;
    try {
        const res = await apiFetch('GET', '/watchlists/list', null, true);
        if (res.code === 200) {
            watchlist = res.result || res.data || [];
            updateWatchlistUI();
            
            // Re-render market list to sync star icons
            if (!isMarketDetailActive) {
                renderMarketList();
            }
        }
    } catch(e) {
        console.error('Failed to load watchlist:', e);
    }
}

function updateWatchlistUI() {
    const btn = document.getElementById('market-watchlist-btn');
    if (!btn) return;
    
    // Find if current activeSymbol is in watchlist
    const currentInst = recommendedInstruments.find(inst => inst.symbol.toLowerCase() === activeSymbol);
    if (!currentInst) return;
    
    const isWatched = watchlist.some(w => w.instrumentId.toString() === currentInst.id.toString());
    btn.innerText = isWatched ? '\u2605' : '\u2606';
    btn.style.color = isWatched ? '#F59E0B' : 'var(--text-muted)'; // Star color gold
}

async function toggleWatchlist() {
    if (!currentUser) {
        openAuthModal();
        return;
    }
    
    const currentInst = recommendedInstruments.find(inst => inst.symbol.toLowerCase() === activeSymbol);
    if (!currentInst) return;
    
    const isWatched = watchlist.some(w => w.instrumentId.toString() === currentInst.id.toString());
    const path = isWatched ? '/watchlists/remove' : '/watchlists/add';
    const bodyStr = `{"instrumentId":${currentInst.id}}`;
    
    let toastMsg = "";
    if (isWatched) {
        toastMsg = currentLocale === 'hi' ? "पसंदीदा से हटाया जा रहा है..." : "Removing from favorites...";
    } else {
        toastMsg = currentLocale === 'hi' ? "पसंदीदा में जोड़ा जा रहा है..." : "Adding to favorites...";
    }
    showToast(toastMsg, false);
    
    try {
        const res = await apiFetchWithRawBody('POST', path, bodyStr, true);
        if (res.code === 200) {
            let successMsg = "";
            if (isWatched) {
                successMsg = currentLocale === 'hi' ? "✓ पसंदीदा से सफलतापूर्वक हटाया गया!" : "✓ Successfully removed from favorites!";
            } else {
                successMsg = currentLocale === 'hi' ? "🎉 पसंदीदा में सफलतापूर्वक जोड़ा गया!" : "🎉 Successfully added to favorites!";
            }
            showToast(successMsg, false);
            await loadWatchlist();
        } else {
            let failMsg = currentLocale === 'hi' ? "ऑपरेशन विफल" : "Operation failed";
            showToast(res.errorMessage || failMsg, true);
        }
    } catch(e) {
        let errText = currentLocale === 'hi' ? "नेटवर्क अपवाद!" : "Network exception!";
        showToast(errText, true);
    }
}

async function openWatchlistModal() {
    await ensureModalLoaded('watchlist-modal');
    if (!currentUser) {
        openAuthModal();
        return;
    }
    const modal = document.getElementById('watchlist-modal');
    if (modal) modal.classList.add('active');
    renderWatchlistModalItems();
}

function closeWatchlistModal() {
    const modal = document.getElementById('watchlist-modal');
    if (modal) modal.classList.remove('active');
}

function renderWatchlistModalItems() {
    const container = document.getElementById('watchlist-items-list');
    if (!container) return;
    
    if (watchlist.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:0.8rem;">${t('watchlist_empty')}</div>`;
        return;
    }
    
    container.innerHTML = watchlist.map(w => {
        const inst = w.instrument || recommendedInstruments.find(i => i.id.toString() === w.instrumentId.toString());
        if (!inst) return '';
        
        const rawChg = w.ticker?.priceChangePercent || inst.ticker?.priceChangePercent;
        const changePercent = rawChg !== undefined && rawChg !== null ? parseFloat(rawChg) : null;
        const chgStr = changePercent !== null && !isNaN(changePercent) ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '--';
        const chgClass = changePercent === null || isNaN(changePercent) ? 'gray' : (changePercent >= 0 ? 'green' : 'red');
        
        const rawPrice = w.ticker?.closePrice || inst.ticker?.closePrice;
        const priceVal = rawPrice !== undefined && rawPrice !== null ? parseFloat(rawPrice) : null;
        const priceStr = priceVal !== null && !isNaN(priceVal) ? priceVal.toFixed(inst.symbol.toLowerCase() === 'xrpusdt' ? 4 : 2) : '--';
        
        const fallbackSvg = getCoinFallbackSvg(inst.symbol, 28);
        const isStock = inst.assetClass === 'STOCK' || !inst.symbol.toUpperCase().endsWith('USDT');
        const currencySymbol = isStock ? '₹' : '$';
        const assetClassLabel = isStock ? (currentLocale === 'hi' ? 'स्टॉक एसेट' : 'Stock Asset') : (currentLocale === 'hi' ? 'क्रिप्टो एसेट' : 'Crypto Asset');
        return `
            <div class="notify-row" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 12px 10px; border-bottom: 1px solid var(--border-light);" onclick="switchActiveSymbol('${inst.symbol}'); closeWatchlistModal(); switchTab('market');">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${inst.logo || ''}" onerror="this.onerror=null; this.src='${fallbackSvg}'" style="width: 28px; height: 28px; border-radius: 50%;" />
                    <div>
                        <h4 style="margin: 0; font-size: 0.9rem; color: var(--text-primary); font-weight: 600;">${inst.symbol}</h4>
                        <span style="font-size: 0.7rem; color: var(--text-secondary);">${inst.name || assetClassLabel}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${currencySymbol}${priceStr}</div>
                    <span class="${chgClass}" style="font-size: 0.75rem; font-weight: 600;">${chgStr}</span>
                </div>
            </div>
        `;
    }).join('');
}

window.loadRecommendedInstruments = loadRecommendedInstruments;
window.loadWatchlist = loadWatchlist;
window.updateWatchlistUI = updateWatchlistUI;
window.toggleWatchlist = toggleWatchlist;
window.openWatchlistModal = openWatchlistModal;
window.closeWatchlistModal = closeWatchlistModal;

// --- TRANSACTION RECORDS SUB-PAGE ACTIONS (交易记录页面控制与分类渲染) ---
async function openSearchModal() {
    await ensureModalLoaded('search-modal');
    const modal = document.getElementById('search-modal');
    if (!modal) return;
    modal.classList.add('active');
    
    const input = document.getElementById('search-query-input');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 150);
    }
    
    renderSearchResults('', true);
}

function closeSearchModal() {
    const modal = document.getElementById('search-modal');
    if (modal) modal.classList.remove('active');
}

function handleSearchInputChange() {
    const input = document.getElementById('search-query-input');
    if (!input) return;
    const query = input.value.trim();
    renderSearchResults(query, false);
}

function renderSearchResults(query, isHotDefault) {
    const container = document.getElementById('search-results-list');
    if (!container) return;
    
    let matchedStrategies = [];
    let matchedInstruments = [];
    
    if (isHotDefault || query === '') {
        matchedStrategies = strategyModels.slice(0, 2);
        matchedInstruments = recommendedInstruments.slice(0, 2);
    } else {
        const qLower = query.toLowerCase();
        matchedStrategies = strategyModels.filter(m => {
            const name = t(m.name).toLowerCase();
            const subName = (m.subName || '').toLowerCase();
            const badge = (m.badge || '').toLowerCase();
            return name.includes(qLower) || subName.includes(qLower) || badge.includes(qLower);
        });
        
        matchedInstruments = recommendedInstruments.filter(inst => {
            const sym = inst.symbol.toLowerCase();
            return sym.includes(qLower);
        });
    }
    
    if (matchedStrategies.length === 0 && matchedInstruments.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 10px; color: var(--text-muted); font-size: 0.85rem;">
                ${t('search_no_results')}
            </div>
        `;
        return;
    }
    
    let html = '';
    
    if (isHotDefault || query === '') {
        html += `<div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; margin-bottom: 10px; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">${t('search_hot_title')}</div>`;
    }
    
    if (matchedStrategies.length > 0) {
        if (!isHotDefault && query !== '') {
            html += `<div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; margin: 15px 0 8px 0; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">${t('search_strategy_section')} (${matchedStrategies.length})</div>`;
        }
        matchedStrategies.forEach(m => {
            const displayName = t(m.name);
            const badgeName = m.badge || 'PRO';
            const yieldVal = m.monthRate || '0.00%';
            const winRate = m.winRate || '0.00%';
            
            const strategyEmojis = {
                'MLP': '🤖',
                'LSTM': '🧠',
                'TRANSFORMER': '⚡',
                'XGBOOST': '📈'
            };
            const typeKey = (m.badge || '').toUpperCase();
            const emoji = strategyEmojis[typeKey] || '🤖';
            
            html += `
                <div class="notify-row" style="padding: 10px; margin-bottom: 8px; border-radius: 10px; background: rgba(255,255,255,0.6); border: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onclick="closeSearchModal(); window.pendingFollowModelId = '${m.id}'; switchTab('follow');">
                    <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(91,81,249,0.06); display: flex; align-items: center; justify-content: center; font-size: 1rem;">
                            ${emoji}
                        </div>
                        <div>
                            <h4 style="margin: 0; font-size: 0.8rem; color: var(--text-primary); font-weight: 700;">${displayName}</h4>
                            <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600;">${badgeName} | Win Rate: ${winRate}</span>
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                        <span class="green" style="font-weight: 800; font-size: 0.85rem;">+${yieldVal}</span>
                        <span style="font-size: 0.6rem; color: var(--primary); text-decoration: underline; white-space: nowrap; font-weight: 700;">${t('search_click_to_follow')} ›</span>
                    </div>
                </div>
            `;
        });
    }
    
    if (matchedInstruments.length > 0) {
        if (!isHotDefault && query !== '') {
            html += `<div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; margin: 15px 0 8px 0; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">${t('search_market_section')} (${matchedInstruments.length})</div>`;
        }
        matchedInstruments.forEach(inst => {
            const symUpper = inst.symbol.toUpperCase();
            const ticker = inst.ticker || {};
            const price = parseFloat(ticker.closePrice || 0);
            const chgPercent = parseFloat(ticker.priceChangePercent || 0);
            const chgStr = `${chgPercent >= 0 ? '+' : ''}${chgPercent.toFixed(2)}%`;
            const chgClass = chgPercent >= 0 ? 'green' : 'red';
            
            const isStock = inst.assetClass === 'STOCK' || !inst.symbol.toUpperCase().endsWith('USDT');
            const currencySymbol = isStock ? '₹' : '$';
            const assetClassLabel = isStock ? (currentLocale === 'hi' ? 'लाइव स्टॉक एसेट' : 'Live Stock Asset') : (currentLocale === 'hi' ? 'लाइव क्रिप्टो एसेट' : 'Live Crypto Asset');
            const iconChar = isStock ? '₹' : '$';
            
            html += `
                <div class="notify-row" style="padding: 10px; margin-bottom: 8px; border-radius: 10px; background: rgba(255,255,255,0.6); border: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onclick="closeSearchModal(); switchActiveSymbol('${inst.symbol}'); switchTab('market');">
                    <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(16, 185, 129, 0.06); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 700; color: var(--primary);">
                            ${iconChar}
                        </div>
                        <div>
                            <h4 style="margin: 0; font-size: 0.8rem; color: var(--text-primary); font-weight: 700;">${symUpper}</h4>
                            <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600;">${assetClassLabel}</span>
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                        <span class="${chgClass}" style="font-weight: 800; font-size: 0.85rem;">${currencySymbol}${price.toFixed(2)} (${chgStr})</span>
                        <span style="font-size: 0.6rem; color: var(--text-secondary); text-decoration: underline; white-space: nowrap; font-weight: 600;">${t('search_click_to_trade')} ›</span>
                    </div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
}

window.openSearchModal = openSearchModal;
window.closeSearchModal = closeSearchModal;
window.handleSearchInputChange = handleSearchInputChange;
window.renderSearchResults = renderSearchResults;




// --- DUAL-CURRENCY DYNAMIC STATE ACTIONS & EYE TOGGLES ---
// window assignments relocated to top of file

let chartResizeTimeout = null;
window.addEventListener('resize', () => {
    if (!currentChart) return;
    if (chartResizeTimeout) clearTimeout(chartResizeTimeout);
    chartResizeTimeout = setTimeout(() => {
        relayoutTradingChart();
    }, 100);
});
