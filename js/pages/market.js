// Market Page View Controller
import { state } from '../modules/state.js?v=2.2.0';

// Expose key functions to window immediately to avoid timing issues with inline event handlers
window.switchActiveSymbol = switchActiveSymbol;
window.loadRecommendedInstruments = loadRecommendedInstruments;
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
function initChart() {
    const container = document.getElementById('kline-chart');
    if (!container) return;
    
    container.innerHTML = '';
    
    currentChart = LightweightCharts.createChart(container, {
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

    // Load initial visual data block
    const data = [];
    let time = Math.floor(Date.now() / 1000) - 80 * 60;
    let basePrice = activeSymbol === 'btcusdt' ? 65000.00 : (activeSymbol === 'ethusdt' ? 3200.00 : (activeSymbol === 'solusdt' ? 145.00 : 0.52));
    
    for (let i = 0; i < 80; i++) {
        const change = (Math.random() - 0.49) * (basePrice * 0.002);
        const open = basePrice;
        const close = basePrice + change;
        const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
        const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
        
        data.push({
            time: time,
            open: parseFloat(open.toFixed(4)),
            high: parseFloat(high.toFixed(4)),
            low: parseFloat(low.toFixed(4)),
            close: parseFloat(close.toFixed(4))
        });
        
        basePrice = close;
        time += 60;
    }
    
    candleSeries.setData(data);
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
        const minuteBlock = Math.floor(timeSec / 60) * 60;
        const p = parseFloat(price);
        
        if (minuteBlock < lastBarTime) return; // Prevent crashes due to client lag
        
        if (currentBar && currentBar.time === minuteBlock) {
            currentBar.high = Math.max(currentBar.high, p);
            currentBar.low = Math.min(currentBar.low, p);
            currentBar.close = p;
        } else {
            currentBar = {
                time: minuteBlock,
                open: currentBar ? currentBar.close : p,
                high: p,
                low: p,
                close: p
            };
        }
        
        candleSeries.update(currentBar);
        lastBarTime = Math.max(lastBarTime, minuteBlock);
    } catch(e) {
        console.warn('TV lightweight charts update skipped safely:', e);
    }
}

async function loadRecommendedInstruments() {
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
    
    // Initialize sparkline pools for recommended coins
    recommendedInstruments.forEach(inst => {
        const symUpper = inst.symbol.toUpperCase();
        if (!sparklinePools[symUpper]) {
            const base = parseFloat(inst.ticker?.closePrice) || 1.0;
            sparklinePools[symUpper] = Array.from({length: 12}, () => base + (Math.random() - 0.5) * base * 0.005);
        }
    });
    
    // Render market list!
    renderMarketList();
    
    // If current activeSymbol is not in the recommended list, switch to the first recommended symbol
    const hasActive = recommendedInstruments.some(inst => inst.symbol.toLowerCase() === activeSymbol);
    if (!hasActive && recommendedInstruments.length > 0) {
        activeSymbol = recommendedInstruments[0].symbol.toLowerCase();
    }
    
    // Check watchlist status
    updateWatchlistUI();
    
    // Update home page static ticker elements immediately to eliminate initial loading delay
    recommendedInstruments.forEach(inst => {
        const symUpper = inst.symbol.toUpperCase();
        if (symUpper === 'BTCUSDT' || symUpper === 'ETHUSDT' || symUpper === 'SOLUSDT') {
            const idPrefix = symUpper === 'BTCUSDT' ? 'btc' : (symUpper === 'ETHUSDT' ? 'eth' : 'sol');
            const ticker = inst.ticker || {};
            const lastPrice = parseFloat(ticker.closePrice);
            const chgPercent = parseFloat(ticker.priceChangePercent || 0);
            
            if (!isNaN(lastPrice)) {
                const priceEl = document.getElementById(`idx-${idPrefix}-price`);
                if (priceEl) priceEl.innerText = lastPrice.toFixed(2);
                
                const mPriceEl = document.getElementById(`m-idx-${idPrefix}-price`);
                if (mPriceEl) mPriceEl.innerText = lastPrice.toFixed(2);
            }
            
            if (ticker.priceChangePercent !== undefined) {
                const chgStr = `${chgPercent >= 0 ? '+' : ''}${chgPercent.toFixed(2)}%`;
                
                const chgEl = document.getElementById(`idx-${idPrefix}-change-badge`);
                if (chgEl) {
                    chgEl.innerText = chgStr;
                    chgEl.style.color = chgPercent >= 0 ? 'var(--green)' : 'var(--red)';
                    chgEl.style.background = chgPercent >= 0 ? 'var(--green-light)' : 'var(--red-light)';
                }
                
                const mChgEl = document.getElementById(`m-idx-${idPrefix}-change-badge`);
                if (mChgEl) {
                    mChgEl.innerText = chgStr;
                    mChgEl.style.color = chgPercent >= 0 ? 'var(--green)' : 'var(--red)';
                    mChgEl.style.background = chgPercent >= 0 ? 'var(--green-light)' : 'var(--red-light)';
                }
            }
        }
    });
    
    // Initialize home trending list
    if (typeof renderHomeTrending === 'function') {
        renderHomeTrending('gainers');
    }
}

function renderMarketList() {
    const container = document.getElementById('market-list-container');
    if (!container) return;
    
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
            
            const cleanSym = inst.symbol.toUpperCase().replace('USDT', '');
            const fallbackSvg = getCoinFallbackSvg(inst.symbol, 32);
            
            return `
                <div class="market-coin-row" onclick="showMarketDetail('${inst.symbol}')">
                    <div class="coin-left-col">
                        <img class="coin-row-logo" src="${inst.logo || ''}" onerror="this.onerror=null; this.src='${fallbackSvg}'" alt="${cleanSym}" />
                        <div class="coin-row-meta">
                            <div class="coin-row-symbol">
                                ${cleanSym}<span class="quote-symbol">/USDT</span>
                            </div>
                            <span class="coin-row-name">${inst.name || cleanSym}</span>
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
    
    const categories = ['watchlist', 'sector', 'cap', 'volume'];
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
    
    renderMarketList();
}

function showMarketDetail(symbol) {
    activeSymbol = symbol.toLowerCase();
    isMarketDetailActive = true;
    
    const listView = document.getElementById('market-list-view');
    const detailView = document.getElementById('market-detail-view');
    if (listView) listView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';
    
    const inst = recommendedInstruments.find(i => i.symbol.toLowerCase() === activeSymbol);
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
            symbolEl.innerText = inst.symbol.replace('USDT', '') + ' / USDT';
        }
    }
    
    updateWatchlistUI();
    initChart();
    connectMarketWS();
    setTimeout(relayoutTradingChart, 150);
}

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
        return `
            <div class="notify-row" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 12px 10px; border-bottom: 1px solid var(--border-light);" onclick="switchActiveSymbol('${inst.symbol}'); closeWatchlistModal(); switchTab('market');">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${inst.logo || ''}" onerror="this.onerror=null; this.src='${fallbackSvg}'" style="width: 28px; height: 28px; border-radius: 50%;" />
                    <div>
                        <h4 style="margin: 0; font-size: 0.9rem; color: var(--text-primary); font-weight: 600;">${inst.symbol}</h4>
                        <span style="font-size: 0.7rem; color: var(--text-secondary);">${inst.name || 'Crypto Asset'}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">$${priceStr}</div>
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
                <div class="notify-row" style="padding: 10px; margin-bottom: 8px; border-radius: 10px; background: rgba(255,255,255,0.6); border: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onclick="closeSearchModal(); switchTab('follow'); setTimeout(() => openOrderDrawer('${m.id}'), 150);">
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
            
            html += `
                <div class="notify-row" style="padding: 10px; margin-bottom: 8px; border-radius: 10px; background: rgba(255,255,255,0.6); border: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onclick="closeSearchModal(); switchActiveSymbol('${inst.symbol}'); switchTab('market');">
                    <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(16, 185, 129, 0.06); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 700; color: var(--primary);">
                            $
                        </div>
                        <div>
                            <h4 style="margin: 0; font-size: 0.8rem; color: var(--text-primary); font-weight: 700;">${symUpper}</h4>
                            <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600;">Live Trading Asset</span>
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                        <span class="${chgClass}" style="font-weight: 800; font-size: 0.85rem;">$${price.toFixed(2)} (${chgStr})</span>
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
