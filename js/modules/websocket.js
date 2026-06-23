// WebSocket Connection and Business Push Messages Handler Module
import { state } from './state.js?v=2.2.0';
import { showToast } from './ui.js?v=2.2.0';

let subscribedSymbol = null;
window.subscribedTickers = window.subscribedTickers || new Set();

function connectMarketWS() {
    if (marketWsReconnectTimer) {
        clearTimeout(marketWsReconnectTimer);
        marketWsReconnectTimer = null;
    }
    
    // Dynamic Symbol Subscription Switching over existing connection
    if (marketWs && marketWs.readyState === WebSocket.OPEN) {
        if (subscribedSymbol !== activeSymbol) {
            const oldSym = subscribedSymbol;
            subscribedSymbol = activeSymbol;
            
            const unsubParams = [];
            if (oldSym) {
                unsubParams.push(`${oldSym}@trade`, `${oldSym}@kline_1m`, `${oldSym}@depth`);
                // Do not unsubscribe from index card tickers (BTC, ETH, SOL)
                if (oldSym !== 'btcusdt' && oldSym !== 'ethusdt' && oldSym !== 'solusdt') {
                    unsubParams.push(`${oldSym}@ticker`);
                }
            }
            
            const subParams = [
                `${activeSymbol}@trade`,
                `${activeSymbol}@kline_1m`,
                `${activeSymbol}@depth`,
                `${activeSymbol}@ticker`
            ];
            
            if (unsubParams.length > 0) {
                try {
                    marketWs.send(JSON.stringify({
                        method: "UNSUBSCRIBE",
                        params: unsubParams,
                        id: Date.now()
                    }));
                    if (oldSym && oldSym !== 'btcusdt' && oldSym !== 'ethusdt' && oldSym !== 'solusdt') {
                        window.subscribedTickers.delete(oldSym.toLowerCase());
                    }
                } catch(e) {
                    console.error('Error sending UNSUBSCRIBE via WS:', e);
                }
            }
            
            try {
                marketWs.send(JSON.stringify({
                    method: "SUBSCRIBE",
                    params: subParams,
                    id: Date.now() + 1
                }));
                window.subscribedTickers.add(activeSymbol.toLowerCase());
            } catch(e) {
                console.error('Error sending SUBSCRIBE via WS:', e);
            }
        }
        return;
    }
    
    if (marketWs && marketWs.readyState === WebSocket.CONNECTING) {
        return;
    }
    
    if (marketWs) {
        try { marketWs.close(); } catch(e){}
    }
    
    const ws = new WebSocket(CONFIG.MARKET_WS_URL);
    marketWs = ws;
    
    ws.onopen = () => {
        subscribedSymbol = activeSymbol; // Sync subscription record
        window.subscribedTickers.clear();
        const params = [];
        // Subscribe to active coin detail streams
        params.push(
            `${activeSymbol}@trade`,
            `${activeSymbol}@kline_1m`,
            `${activeSymbol}@depth`
        );
        
        // Always subscribe to BTC, ETH, and SOL tickers for home index cards
        params.push('btcusdt@ticker', 'ethusdt@ticker', 'solusdt@ticker');
        window.subscribedTickers.add('btcusdt');
        window.subscribedTickers.add('ethusdt');
        window.subscribedTickers.add('solusdt');
        
        // Subscribe to tickers for all recommended coins to keep listing alive
        if (recommendedInstruments.length > 0) {
            recommendedInstruments.forEach(inst => {
                const symLower = inst.symbol.toLowerCase();
                if (!params.includes(`${symLower}@ticker`)) {
                    params.push(`${symLower}@ticker`);
                    window.subscribedTickers.add(symLower);
                }
            });
        } else {
            const activeSymLower = activeSymbol.toLowerCase();
            if (!params.includes(`${activeSymLower}@ticker`)) {
                params.push(`${activeSymLower}@ticker`);
                window.subscribedTickers.add(activeSymLower);
            }
        }
        
        // SUBSCRIBE frame
        const msg = {
            method: "SUBSCRIBE",
            params: params,
            id: 1
        };
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    };
    
    ws.onmessage = (event) => {
        try {
            const frames = event.data.split('\n');
            for (const frame of frames) {
                const trimmed = frame.trim();
                if (!trimmed) continue;
                
                const payload = JSON.parse(trimmed);
                if (payload.result === null) continue;
                
                const stream = payload.stream;
                const data = payload.data;
                
                if (stream && stream.endsWith('@ticker')) {
                    renderMarketTicker(data);
                } else if (stream && stream.endsWith('@trade')) {
                    renderMarketTrade(data);
                } else if (stream && stream.endsWith('@kline_1m')) {
                    renderMarketKline(data);
                } else if (stream && stream.endsWith('@depth')) {
                    renderMarketDepth(data);
                }
            }
        } catch(e) {
            console.error('Error parsing market WS data frame:', e);
        }
    };
    
    ws.onclose = () => {
        const spreadEl = document.getElementById('ob-spread-price');
        if (spreadEl) {
            spreadEl.innerText = currentLocale === 'hi' ? 'नेटवर्क कनेक्ट किया जा रहा है...' : 'Connecting to network...';
        }
        if (marketWs === ws) {
            marketWs = null;
        }
        if (!marketWsReconnectTimer) {
            marketWsReconnectTimer = setTimeout(() => {
                marketWsReconnectTimer = null;
                connectMarketWS();
            }, 5000);
        }
    };
}

// --- RENDER MARKET DATA FEEDS ---
function renderMarketTicker(data) {
    if (!data || !data.symbol) return;
    const symUpper = data.symbol.toUpperCase();
    const lastPrice = parseFloat(data.closePrice || data.lastPrice || 0);
    const chgPercent = parseFloat(data.priceChangePercent || 0);
    const chgStr = `${chgPercent >= 0 ? '+' : ''}${chgPercent.toFixed(2)}%`;
    const chgClass = chgPercent >= 0 ? 'green' : 'red';
    
    // Update local data cache
    const inst = recommendedInstruments.find(i => i.symbol.toUpperCase() === symUpper);
    if (inst) {
        if (!inst.ticker) inst.ticker = {};
        inst.ticker.closePrice = data.closePrice || data.lastPrice;
        inst.ticker.priceChangePercent = data.priceChangePercent;
    }
    
    // 1. Update active metrics if this matches active selected symbol (only when detail view is active)
    if (isMarketDetailActive && data.symbol.toLowerCase() === activeSymbol) {
        if (window.renderMarketTickerData) {
            window.renderMarketTickerData(data);
        }
    }
    
    // 2. Update home tab index cards
    if (symUpper === 'BTCUSDT' || symUpper === 'ETHUSDT' || symUpper === 'SOLUSDT') {
        const idPrefix = symUpper === 'BTCUSDT' ? 'btc' : (symUpper === 'ETHUSDT' ? 'eth' : 'sol');
        
        const priceEl = getCachedElement(`idx-${idPrefix}-price`);
        if (priceEl) priceEl.innerText = lastPrice.toFixed(2);
        
        const chgEl = getCachedElement(`idx-${idPrefix}-change-badge`);
        if (chgEl) {
            chgEl.innerText = chgStr;
            chgEl.style.color = chgPercent >= 0 ? 'var(--green)' : 'var(--red)';
            chgEl.style.background = chgPercent >= 0 ? 'var(--green-light)' : 'var(--red-light)';
        }
        
        // Update duplicated market tab index cards
        const mPriceEl = getCachedElement(`m-idx-${idPrefix}-price`);
        if (mPriceEl) mPriceEl.innerText = lastPrice.toFixed(2);
        
        const mChgEl = getCachedElement(`m-idx-${idPrefix}-change-badge`);
        if (mChgEl) {
            mChgEl.innerText = chgStr;
            mChgEl.style.color = chgPercent >= 0 ? 'var(--green)' : 'var(--red)';
            mChgEl.style.background = chgPercent >= 0 ? 'var(--green-light)' : 'var(--red-light)';
        }
        
        // Push price to sparkline array history and redraw on canvas
        const pool = sparklinePools[symUpper];
        if (pool) {
            pool.push(lastPrice);
            if (pool.length > 15) pool.shift();
            drawIndexSparklineThrottled(`idx-${idPrefix}-canvas`, pool, chgPercent >= 0, 300);
            drawIndexSparklineThrottled(`m-idx-${idPrefix}-canvas`, pool, chgPercent >= 0, 300);
        }
    }
    
    // 3. Update Market List Row inline elements dynamically
    const rowPriceEl = getCachedElement(`row-price-${symUpper}`);
    const rowChgEl = getCachedElement(`row-change-${symUpper}`);
    if (rowPriceEl) {
        rowPriceEl.innerText = lastPrice.toFixed(symUpper === 'XRPUSDT' ? 4 : 2);
    }
    if (rowChgEl) {
        rowChgEl.innerText = chgStr;
        rowChgEl.className = `coin-row-change-badge ${chgClass}`;
    }
    
    // Push price to market list row sparkline history and update canvas
    const rowPool = sparklinePools[symUpper];
    if (rowPool) {
        if (symUpper !== 'BTCUSDT' && symUpper !== 'ETHUSDT' && symUpper !== 'SOLUSDT') {
            rowPool.push(lastPrice);
            if (rowPool.length > 15) rowPool.shift();
        }
        if (!isMarketDetailActive) {
            drawIndexSparklineThrottled(`row-canvas-${symUpper}`, rowPool, chgPercent >= 0, 300);
        }
    }
    
    // Update home trending list dynamically if defined
    if (typeof renderHomeTrending === 'function') {
        renderHomeTrending(currentTrendingType);
    }
}

function renderMarketTrade(data) {
    if (!data || !data.symbol) return;
    if (data.symbol.toLowerCase() !== activeSymbol) return;
    
    const listEl = getCachedElement('trades-ticker-list');
    if (!listEl) return;
    
    const row = document.createElement('div');
    row.className = 'trade-row trade-row-anim';
    
    const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sideClass = data.side === 1 ? 'green' : 'red';
    
    row.innerHTML = `
        <span class="${sideClass}">${parseFloat(data.price).toFixed(activeSymbol === 'xrpusdt' ? 4 : 2)}</span>
        <span class="text-right" style="color: var(--text-secondary); font-size: 0.6rem;">${time}</span>
    `;
    
    listEl.insertBefore(row, listEl.firstChild);
    if (listEl.children.length > 6) {
        listEl.removeChild(listEl.lastChild);
    }
    
    // Update chart tick candle
    updateChartRealtime(data.price, data.timestamp);
}

function renderMarketKline(data) {
    if (!data || !data.symbol) return;
    if (data.symbol.toLowerCase() !== activeSymbol) return;
    updateChartRealtime(data.close, data.timestamp);
}

// Throttled Order Book Rendering Engine (conforms to 250ms visual updates)
let lastDepthRenderTime = 0;
let pendingDepthData = null;
let depthRenderTimeout = null;

function renderMarketDepth(data) {
    if (!data || !data.asks || !data.bids) return;
    if (data.symbol.toLowerCase() !== activeSymbol) return;
    
    pendingDepthData = data;
    const now = Date.now();
    const elapsed = now - lastDepthRenderTime;
    
    if (elapsed >= 250) {
        executeRenderMarketDepth(pendingDepthData);
        lastDepthRenderTime = now;
        if (depthRenderTimeout) {
            clearTimeout(depthRenderTimeout);
            depthRenderTimeout = null;
        }
    } else {
        if (!depthRenderTimeout) {
            depthRenderTimeout = setTimeout(() => {
                if (pendingDepthData) {
                    executeRenderMarketDepth(pendingDepthData);
                    lastDepthRenderTime = Date.now();
                }
                depthRenderTimeout = null;
            }, 250 - elapsed);
        }
    }
}

function executeRenderMarketDepth(data) {
    if (!data || !data.asks || !data.bids) return;
    const asksEl = getCachedElement('ob-asks-list');
    const bidsEl = getCachedElement('ob-bids-list');
    if (!asksEl || !bidsEl) return;
    
    const asks = typeof data.asks === 'string' ? JSON.parse(data.asks) : data.asks;
    const bids = typeof data.bids === 'string' ? JSON.parse(data.bids) : data.bids;
    
    if (!Array.isArray(asks) || !Array.isArray(bids)) return;
    
    const getPrice = (item) => parseFloat(Array.isArray(item) ? item[0] : (item.price || 0));
    const getQty = (item) => parseFloat(Array.isArray(item) ? item[1] : (item.qty || item.quantity || 0));

    const sortedAsks = asks.slice(0, 5).sort((a,b) => getPrice(b) - getPrice(a));
    const sortedBids = bids.slice(0, 5).sort((a,b) => getPrice(b) - getPrice(a));
    
    const ask0Price = asks.length > 0 ? getPrice(asks[0]) : 0;
    const bid0Price = bids.length > 0 ? getPrice(bids[0]) : 0;
    
    let midPriceVal = NaN;
    if (ask0Price > 0 && bid0Price > 0) {
        midPriceVal = (ask0Price + bid0Price) / 2;
    } else if (ask0Price > 0) {
        midPriceVal = ask0Price;
    } else if (bid0Price > 0) {
        midPriceVal = bid0Price;
    }
    
    const midPrice = isNaN(midPriceVal) ? '--' : midPriceVal.toFixed(activeSymbol === 'xrpusdt' ? 4 : 2);
    
    const spreadEl = getCachedElement('ob-spread-price');
    if (spreadEl) spreadEl.innerText = midPrice;
    
    // Calculate maximum quantity to scale the depth bars appropriately
    const maxQty = Math.max(...sortedAsks.map(getQty), ...sortedBids.map(getQty)) || 1.0;
    
    asksEl.innerHTML = sortedAsks.map(ask => {
        const price = getPrice(ask);
        const qty = getQty(ask);
        const pct = Math.min(100, ((isNaN(qty) ? 0 : qty) / maxQty) * 100).toFixed(0);
        return `
            <div class="ob-row">
                <span class="price">${isNaN(price) ? '--' : price.toFixed(activeSymbol === 'xrpusdt' ? 4 : 2)}</span>
                <span class="text-right">${isNaN(qty) ? '--' : qty.toFixed(3)}</span>
                <div class="bar" style="width: ${pct}%"></div>
            </div>
        `;
    }).join('');
    
    bidsEl.innerHTML = sortedBids.map(bid => {
        const price = getPrice(bid);
        const qty = getQty(bid);
        const pct = Math.min(100, ((isNaN(qty) ? 0 : qty) / maxQty) * 100).toFixed(0);
        return `
            <div class="ob-row">
                <span class="price">${isNaN(price) ? '--' : price.toFixed(activeSymbol === 'xrpusdt' ? 4 : 2)}</span>
                <span class="text-right">${isNaN(qty) ? '--' : qty.toFixed(3)}</span>
                <div class="bar" style="width: ${pct}%"></div>
            </div>
        `;
    }).join('');
}

function renderMarketTradesSnapshot(trades) {
    const listEl = getCachedElement('trades-ticker-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    const sortedTrades = [...trades].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
    listEl.innerHTML = sortedTrades.map(t => {
        const time = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const sideClass = t.side === 1 ? 'green' : 'red';
        const priceStr = parseFloat(t.price).toFixed(activeSymbol === 'xrpusdt' ? 4 : 2);
        return `
            <div class="trade-row">
                <span class="${sideClass}">${priceStr}</span>
                <span class="text-right" style="color: var(--text-secondary); font-size: 0.6rem;">${time}</span>
            </div>
        `;
    }).join('');
}


// --- REAL-TIME BUSINESS NETWORKING WEBSOCKET ---
let bizWsReconnectTimer = null;
async function listenToBizEvents() {
    if (!currentUser) {
        if (bizWs) {
            try { bizWs.close(); } catch(e){}
            bizWs = null;
        }
        if (bizWsReconnectTimer) {
            clearTimeout(bizWsReconnectTimer);
            bizWsReconnectTimer = null;
        }
        return;
    }
    
    if (isConnectingBizWs) return;
    // Prevent duplicate reconnect if already connected or connecting
    if (bizWs && (bizWs.readyState === WebSocket.CONNECTING || bizWs.readyState === WebSocket.OPEN)) {
        return;
    }
    
    isConnectingBizWs = true;
    try {
        const ticketRes = await apiFetch('POST', '/auth/ws-ticket', null, true);
        const ticketData = ticketRes.result || ticketRes.data;
        if (ticketRes.code !== 200 || !ticketData || !ticketData.ticket) {
            if (!bizWsReconnectTimer) {
                bizWsReconnectTimer = setTimeout(() => { bizWsReconnectTimer = null; listenToBizEvents(); }, 15000);
            }
            return;
        }
        
        if (bizWs) {
            try { bizWs.close(); } catch(e){}
        }
        
        bizWs = new WebSocket(`${CONFIG.BIZ_WS_URL}?ticket=${ticketData.ticket}`);
        
        bizWs.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                const { eventType, data } = payload;
                // 避开大整数精度丢失导致的 String 不相等，改用宽松的前缀匹配（大整数前15位完全一致即可视为同一用户）
                if (currentUser && data && data.userId && currentUser.uid) {
                    const s1 = data.userId.toString().substring(0, 15);
                    const s2 = currentUser.uid.toString().substring(0, 15);
                    if (s1 !== s2) return;
                }
                
                if (eventType === 'identity.kyc.status-changed.v1') {
                    handleKycStatusChangeWS(data);
                } else if (eventType === 'finance.account.changed.v1') {
                    handleAccountChangeWS(data);
                } else if (eventType === 'trading.quant.order.status-changed.v1') {
                    handleQuantOrderStatusChangeWS(data);
                }
            } catch(e) {
                console.error('Error parsing biz WS event:', e);
            }
        };
        
        bizWs.onclose = () => {
            bizWs = null;
            if (currentUser && !bizWsReconnectTimer) {
                bizWsReconnectTimer = setTimeout(() => { bizWsReconnectTimer = null; listenToBizEvents(); }, 10000);
            }
        };
        
    } catch(e) {
        if (!bizWsReconnectTimer) {
            bizWsReconnectTimer = setTimeout(() => { bizWsReconnectTimer = null; listenToBizEvents(); }, 15000);
        }
    } finally {
        isConnectingBizWs = false;
    }
}

function handleKycStatusChangeWS(data) {
    if (!currentUser || !data) return;
    currentUser.kycStatus = data.toStatus;
    localStorage.setItem('matp_user_kyc', data.toStatus);
    
    if (window.syncKycUI) {
        window.syncKycUI(data.toStatus);
    }
    
    if (data.toStatus === 'VERIFIED') {
        showToast(currentLocale === 'hi' ? '🎉 बधाई हो! आपका केवाईसी सत्यापन सफलतापूर्वक स्वीकृत हो गया है!' : '🎉 Congratulations! Your KYC verification has been successfully approved!', false);
    }
}

// Fixed function binding to window
function handleAccountChangeWS() {
    if (window.loadUserAssets) {
        window.loadUserAssets();
    }
}

function handleQuantOrderStatusChangeWS(data) {
    if (!data) return;
    if (window.loadQuantOrders) {
        window.loadQuantOrders();
    }
    if (data.toStatus === 'ACTIVE') {
        showToast(currentLocale === 'hi' ? `🤖 एॉर्डर [${data.orderNo.substring(0, 8)}] तैनात किया गया!` : `🤖 AI Order [${data.orderNo.substring(0, 8)}] deployed successfully!`, false);
    } else if (data.toStatus === 'COMPLETED') {
        const profit = parseFloat(data.actualProfit) || 0;
        const icon = profit >= 0 ? (currentLocale === 'hi' ? '📈 लाभ' : '📈 Profit') : (currentLocale === 'hi' ? '📉 हानि' : '📉 Loss');
        const profitStr = profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`;
        showToast(currentLocale === 'hi' ? `🏁 एॉर्डर [${data.orderNo.substring(0, 8)}] व्यवस्थित! ${icon} ${profitStr} USDT` : `🏁 AI Order [${data.orderNo.substring(0, 8)}] settled! ${icon} ${profitStr} USDT`, profit < 0);
    }
}


// --- USER SESSION AUTH MANAGEMENT ---

window.connectMarketWS = connectMarketWS;
window.listenToBizEvents = listenToBizEvents;
window.executeRenderMarketDepth = executeRenderMarketDepth;
window.renderMarketTradesSnapshot = renderMarketTradesSnapshot;

function subscribeNewInstruments(instruments) {
    if (!marketWs || marketWs.readyState !== WebSocket.OPEN) return;
    
    const newParams = [];
    instruments.forEach(inst => {
        const symLower = inst.symbol.toLowerCase();
        if (!window.subscribedTickers.has(symLower)) {
            newParams.push(`${symLower}@ticker`);
            window.subscribedTickers.add(symLower);
        }
    });
    
    if (newParams.length > 0) {
        try {
            marketWs.send(JSON.stringify({
                method: "SUBSCRIBE",
                params: newParams,
                id: Date.now()
            }));
        } catch(e) {
            console.error('Error sending SUBSCRIBE for new tickers via WS:', e);
        }
    }
}
window.subscribeNewInstruments = subscribeNewInstruments;

export { connectMarketWS, listenToBizEvents };