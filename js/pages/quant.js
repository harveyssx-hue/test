// Quant AI Trading Page View Controller
import { state } from '../modules/state.js?v=2.2.0';

function unpackStrategyStats(descText) {
    const res = {
        description: descText || '',
        yield: undefined,
        winRate: undefined,
        followers: undefined
    };
    if (!descText) return res;
    const match = descText.match(/\[stats:([\d.-]*),([\d.-]*),([\d.-]*)\]/);
    if (match) {
        res.yield = parseFloat(match[1]) || 0;
        res.winRate = parseFloat(match[2]) || 0;
        res.followers = parseInt(match[3]) || 0;
        res.description = descText.replace(match[0], '').trim();
    }
    return res;
}

function getStrategyFallbackEmoji(name) {
    name = (name || '').toUpperCase();
    if (name.includes('MLP') || name.includes('NEURAL')) return '🤖';
    if (name.includes('GRID') || name.includes('ARBITRAGE')) return '🐂';
    if (name.includes('TRANSFORMER') || name.includes('TREND')) return '🚀';
    if (name.includes('XGBOOST') || name.includes('MOMENTUM') || name.includes('EAGLE')) return '🦅';
    return '🧠';
}

function generateDeterministicCurve(strategyId) {
    let seed = 0;
    const str = String(strategyId || 'seed');
    for (let i = 0; i < str.length; i++) {
        seed = (seed * 31 + str.charCodeAt(i)) & 0xFFFFFFFF;
    }
    function random() {
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
        return seed / 0x7FFFFFFF;
    }
    const points = [];
    let currentVal = 10 + random() * 10;
    points.push(currentVal);
    const length = 12 + Math.floor(random() * 4);
    for (let i = 1; i < length; i++) {
        const change = (random() - 0.33) * 5;
        currentVal = Math.max(2, currentVal + change);
        points.push(currentVal);
    }
    return points;
}

function getStrategyDisplayName(m) {
    if (!m) return '';
    if (m.translations && m.translations.length > 0) {
        const trans = m.translations.find(t => t.localeTag === currentLocale);
        if (trans && trans.displayName) {
            return trans.displayName;
        }
        const fallback = m.translations.find(t => t.localeTag === 'en') || m.translations[0];
        if (fallback && fallback.displayName) {
            return fallback.displayName;
        }
    }
    if (m.displayName) {
        if (m.displayName.includes(' / ')) {
            const parts = m.displayName.split(' / ');
            return currentLocale === 'hi' ? parts[1].trim() : parts[0].trim();
        }
        return m.displayName;
    }
    return t(m.name);
}

function getStrategyTypeLabel(m, defaultVal) {
    if (!m) return defaultVal;
    if (m.translations && m.translations.length > 0) {
        const trans = m.translations.find(t => t.localeTag === currentLocale);
        if (trans && trans.typeLabel) {
            return trans.typeLabel;
        }
        const fallback = m.translations.find(t => t.localeTag === 'en') || m.translations[0];
        if (fallback && fallback.typeLabel) {
            return fallback.typeLabel;
        }
    }
    return m.typeLabel ? t(m.typeLabel) : defaultVal;
}

function getStrategyDescription(m, defaultVal) {
    if (!m) return defaultVal;
    if (m.translations && m.translations.length > 0) {
        const trans = m.translations.find(t => t.localeTag === currentLocale);
        if (trans && trans.description) {
            return trans.description;
        }
        const fallback = m.translations.find(t => t.localeTag === 'en') || m.translations[0];
        if (fallback && fallback.description) {
            return fallback.description;
        }
    }
    return m.description ? t(m.description) : defaultVal;
}

async function loadQuantConfig() {
    let success = false;
    if (currentUser) {
        try {
            const res = await apiFetch('GET', '/trading/quant/config', null, true);
            if (res && res.code === 200) {
                const config = res.result || res.data;
                if (config && config.models && config.models.length > 0) {
                    config.models.forEach(m => {
                        const stats = unpackStrategyStats(m.description);
                        m.yield = stats.yield;
                        m.winRate = stats.winRate;
                        m.followers = stats.followers;
                        m.description = stats.description;
                    });
                    strategyModels = config.models;
                    success = true;
                }
                if (config && config.minInvestAmount) {
                    minInvestAmount = parseFloat(config.minInvestAmount) || 90.0;
                }
            }
        } catch(e) {
            console.warn('API config fetch warning, using premium default strategies fallback:', e);
        }
    }
    
    // Fallback: If not logged in, or server returned unauthorized/error, load our premium design fallback strategies using real production keys!
    if (!success) {
        strategyModels = [];
    }
    
    // 1. Populate featured list in Home tab
    const homeFeatured = document.getElementById('home-featured-strategies');
    if (homeFeatured) {
        const miniData = strategyModels.slice(0, 3);
        
        const tags_i18n = {
            'en': ['Popular', 'Stable Rec', 'High Yield'],
            'hi': ['सर्वाधिक लोकप्रिय', 'स्थिर सिफारिश', 'उच्च उपज']
        };
        const tags = tags_i18n[currentLocale] || tags_i18n['en'];
        const classTags = ['hot', 'stable', 'high'];
        
        const isInr = assetDisplayCurrency === 'INR';
        const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0;
        
        const labelYield30d = currentLocale === 'hi' ? '30-दिन की उपज' : '30d Yield';
        const labelWinRate = currentLocale === 'hi' ? 'जीत दर' : 'Win Rate';
        const labelFollowers = currentLocale === 'hi' ? 'अनुयायी' : 'Followers';
        const labelFollowBtn = currentLocale === 'hi' ? 'फ़ॉलो' : 'Follow';
        const labelMinShort = currentLocale === 'hi' ? 'न्यूनतम' : 'Min';
        
        homeFeatured.innerHTML = miniData.map((m, idx) => {
            const isIconRealUrl = m.icon && (m.icon.startsWith('http') || m.icon.startsWith('/'));
            let strategyMinInvest = minInvestAmount;
            let avatarHtml = `<div class="feat-avatar">${getStrategyFallbackEmoji(m.name)}</div>`;
            
            if (isIconRealUrl) {
                avatarHtml = `<img src="${m.icon}" style="width: 24px; height: 24px; border-radius: 6px; object-fit: cover; margin-right: 6px; border: 1px solid rgba(255,255,255,0.1);">`;
                const minVal = parseFloat(m.minInvestAmount || m.minAmount);
                if (minVal > 0) strategyMinInvest = minVal;
            } else {
                const parsedVal = parseFloat(m.icon);
                if (m.icon && !isNaN(parsedVal) && parsedVal > 0) {
                    strategyMinInvest = parsedVal;
                }
                if (m.iconUrl) {
                    avatarHtml = `<img src="${m.iconUrl}" style="width: 24px; height: 24px; border-radius: 6px; object-fit: cover; margin-right: 6px;">`;
                }
            }
            
            const featMinText = isInr ? `${labelMinShort} \u20b9${(strategyMinInvest * usdtRate).toFixed(0)}` : `${labelMinShort} $${strategyMinInvest.toFixed(0)}`;
            return `
                <div class="feat-strat-card" onclick="window.pendingFollowModelId = '${m.id}'; switchTab('follow');">
                    <span class="feat-tag tag-${classTags[idx]}">${tags[idx]}</span>
                    <div class="feat-avatar-row">
                        ${avatarHtml}
                        <span class="feat-name-lbl">${getStrategyDisplayName(m)}</span>
                    </div>
                    <div class="feat-yield-box">
                        <span class="feat-yield-val">${m.yield !== undefined ? (m.yield >= 0 ? '+' : '') + parseFloat(m.yield).toFixed(2) + '%' : '--'}</span>
                        <span class="feat-yield-lbl">${labelYield30d}</span>
                    </div>
                    <div class="feat-grid-stats">
                        <div class="feat-g-stat">
                            <span class="val">${m.winRate !== undefined ? parseFloat(m.winRate).toFixed(1) + '%' : '--'}</span>
                            <span class="lbl">${labelWinRate}</span>
                        </div>
                        <div class="feat-g-stat">
                            <span class="val">${m.followers !== undefined ? parseInt(m.followers).toLocaleString() : '--'}</span>
                            <span class="lbl">${labelFollowers}</span>
                        </div>
                    </div>
                    <div class="feat-footer">
                        <span class="feat-min-lbl">${featMinText}</span>
                        <button class="feat-follow-btn">${labelFollowBtn}</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // 2. Render big Strategy Lobby
    renderStrategyLobby();
}

function renderStrategyLobby() {
    const listEl = document.getElementById('strategy-list-box');
    if (!listEl) return;
    
    let filtered = strategyModels;
    if (activeStrategyFilter === 'STABLE') {
        filtered = strategyModels.filter((m, idx) => idx % 2 === 1); // Alternating for stable filter
    } else if (activeStrategyFilter === 'HIGH') {
        filtered = strategyModels.filter((m, idx) => idx === 2); // Momentum is High risk
    } else if (activeStrategyFilter === 'SHORT') {
        filtered = strategyModels.filter((m, idx) => idx === 3); // Eagle Eye short-term
    }
    
    if (filtered.length === 0) {
        const noStrategyText = currentLocale === 'hi' ? 'कोई मिलान वाली रणनीति नहीं मिली' : 'No matching strategies found';
        listEl.innerHTML = `<div class="loading-state-mini">${noStrategyText}</div>`;
        return;
    }
    
    // Read directly from backend data model
    
    const risks_i18n = {
        'en': ['Medium', 'Stable', 'Aggressive', 'Stable'],
        'hi': ['मध्यम', 'स्थिर', 'आक्रामक', 'स्थिर']
    };
    const tags_i18n = {
        'en': ['Popular', 'Stable Rec', 'High Yield', 'Stable Growth'],
        'hi': ['सर्वाधिक लोकप्रिय', 'स्थिर सिफारिश', 'उच्च उपज', 'स्थिर विकास']
    };
    const risks = risks_i18n[currentLocale] || risks_i18n['en'];
    const tags = tags_i18n[currentLocale] || tags_i18n['en'];
    
    const classTags = ['pop', 'rec', 'high', 'rec'];
    
    const isInr = assetDisplayCurrency === 'INR';
    const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0;
    
    const labelWinRate = currentLocale === 'hi' ? 'जीत दर' : 'Win Rate';
    const labelFollowers = currentLocale === 'hi' ? 'अनुयायी' : 'Followers';
    const labelRiskLevel = currentLocale === 'hi' ? 'जोखिम स्तर' : 'Risk Level';
    const labelMin = currentLocale === 'hi' ? 'न्यूनतम सीमा' : 'Min Limit';
    const labelFollowBtn = currentLocale === 'hi' ? 'फ़ॉलो' : 'Follow';
    
    listEl.innerHTML = filtered.map((m, idx) => {
        const mappedIdx = strategyModels.indexOf(m) % 4;
        
        const isIconRealUrl = m.icon && (m.icon.startsWith('http') || m.icon.startsWith('/'));
        let strategyMinInvest = minInvestAmount;
        let avatarHtml = `<div class="s-avatar">${getStrategyFallbackEmoji(m.name)}</div>`;
        
        if (isIconRealUrl) {
            avatarHtml = `<img src="${m.icon}" style="width: 38px; height: 38px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.15);">`;
            const minVal = parseFloat(m.minInvestAmount || m.minAmount);
            if (minVal > 0) strategyMinInvest = minVal;
        } else {
            const parsedVal = parseFloat(m.icon);
            if (m.icon && !isNaN(parsedVal) && parsedVal > 0) {
                strategyMinInvest = parsedVal;
            }
            if (m.iconUrl) {
                avatarHtml = `<img src="${m.iconUrl}" style="width: 38px; height: 38px; border-radius: 8px; object-fit: cover;">`;
            }
        }
        
        const lobbyMinText = isInr ? `${labelMin} <span>\u20b9${(strategyMinInvest * usdtRate).toFixed(0)}</span>` : `${labelMin} <span>$${strategyMinInvest.toFixed(0)}</span>`;
        
        return `
            <div class="strat-card-big" onclick="openOrderDrawer('${m.id}')">
                <div class="strat-top-inner">
                    <div class="s-title-block">
                        ${avatarHtml}
                        <div class="s-meta-flex">
                            <h4>${getStrategyDisplayName(m)}</h4>
                            <div class="s-meta-badge-row">
                                <span class="s-badge-p">Pro</span>
                                <span class="s-badge-r bg-${classTags[mappedIdx]}">${getStrategyTypeLabel(m, tags[mappedIdx])}</span>
                            </div>
                        </div>
                    </div>
                    <span class="s-yield-val">${m.yield !== undefined ? (m.yield >= 0 ? '+' : '') + parseFloat(m.yield).toFixed(2) + '%' : '--'}</span>
                </div>
                <div class="strat-mid-body">
                    <div class="strat-stats-flex">
                        <div class="stat-row-item">
                            <span class="lbl">${labelWinRate}</span>
                            <span class="val">${m.winRate !== undefined ? parseFloat(m.winRate).toFixed(1) + '%' : '--'}</span>
                        </div>
                        <div class="stat-row-item">
                            <span class="lbl">${labelFollowers}</span>
                            <span class="val">${m.followers !== undefined ? parseInt(m.followers).toLocaleString() : '--'}</span>
                        </div>
                        <div class="stat-row-item">
                            <span class="lbl">${labelRiskLevel}</span>
                            <span class="val">${risks[mappedIdx]}</span>
                        </div>
                    </div>
                    <!-- Sparkline drawn on canvas -->
                    <canvas class="s-sparkline-canvas-big" id="s-canvas-${m.id}" width="100" height="34"></canvas>
                </div>
                <div class="strat-footer-panel">
                    <span class="s-min-amount">${lobbyMinText}</span>
                    <button class="s-follow-solid-btn">${labelFollowBtn}</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Draw canvas sparklines dynamically
    filtered.forEach((m) => {
        const curve = generateDeterministicCurve(m.id);
        drawIndexSparkline(`s-canvas-${m.id}`, curve, true);
    });
}

function filterStrategyList(category, btnEl) {
    const tabs = btnEl.parentNode.children;
    for (let t of tabs) t.classList.remove('active');
    btnEl.classList.add('active');
    
    activeStrategyFilter = category;
    renderStrategyLobby();
}


// --- USER RUNNING QUANT ORDERS SYNCRONIZER ---
function openOrderDetailsDrawer(orderId) {
    const order = activeOrders.find(o => o.id.toString() === orderId.toString());
    if (!order) return;
    
    // Find buy/sell trades
    const buyTrade = order.trades ? order.trades.find(t => t.tradeType === 'BUY') : null;
    const sellTrade = order.trades ? order.trades.find(t => t.tradeType === 'SELL') : null;
    
    // Set text elements
    const algoName = order.algorithmModel ? getStrategyDisplayName(order.algorithmModel) : (currentLocale === 'hi' ? 'क्वांट एआई रणनीति' : 'Quant AI Strategy');
    const modelId = order.algorithmModelId || 1;
    const icons = ['🤖', '🐂', '🚀', '🦅'];
    const avatarIdx = (modelId - 1) % 4;
    
    document.getElementById('detail-algo-icon').innerText = icons[avatarIdx];
    document.getElementById('detail-algo-name').innerText = algoName;
    document.getElementById('detail-order-no').innerText = `${currentLocale === 'hi' ? 'ऑर्डर नंबर:' : 'Order No:'} ${order.orderNo}`;
    
    const isInr = assetDisplayCurrency === 'INR';
    const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0;
    const amountVal = parseFloat(order.investAmount) || 0.00;
    const displayAmountStr = isInr ? `\u20b9${(amountVal * usdtRate).toFixed(2)}` : `$${amountVal.toFixed(2)} USDT`;
    document.getElementById('detail-invest-amount').innerText = displayAmountStr;
    
    // Status badge
    const statusEl = document.getElementById('detail-order-status');
    statusEl.innerText = order.status || 'COMPLETED';
    statusEl.className = `badge badge-${order.status || 'COMPLETED'}`;
    
    // Stop loss
    const stopLossPercent = `${Math.round((parseFloat(order.stopLossRate) || 0.1) * 100)}%`;
    document.getElementById('detail-stop-loss').innerText = stopLossPercent;
    
    // Order time
    const orderTimeStr = order.createdAt ? new Date(parseInt(order.createdAt)).toLocaleString() : '--';
    document.getElementById('detail-order-time').innerText = orderTimeStr;
    
    // Trade details
    const buyPriceVal = buyTrade ? parseFloat(buyTrade.price) : null;
    const sellPriceVal = sellTrade ? parseFloat(sellTrade.price) : null;
    
    document.getElementById('detail-buy-price').innerText = buyPriceVal ? `${buyPriceVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT` : '--';
    document.getElementById('detail-sell-price').innerText = sellPriceVal ? `${sellPriceVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT` : '--';
    
    // Profit and Rate
    const profitVal = parseFloat(order.actualProfit) || 0.00;
    const displayProfitStr = isInr ? `${profitVal >= 0 ? '+' : ''}\u20b9${(profitVal * usdtRate).toFixed(2)}` : `${profitVal >= 0 ? '+' : ''}$${profitVal.toFixed(2)} USDT`;
    
    const profitEl = document.getElementById('detail-profit-amount');
    profitEl.innerText = displayProfitStr;
    profitEl.className = profitVal >= 0 ? 'val color-green' : 'val color-red';
    
    const rateVal = (profitVal / amountVal * 100) || 0.00;
    const displayRateStr = `${rateVal >= 0 ? '+' : ''}${rateVal.toFixed(2)}%`;
    const rateEl = document.getElementById('detail-profit-rate');
    rateEl.innerText = displayRateStr;
    rateEl.className = rateVal >= 0 ? 'val color-green' : 'val color-red';
    
    // Slide up details drawer
    document.getElementById('order-details-overlay').classList.add('active');
    document.getElementById('order-details-drawer-sheet').classList.add('active');
}
window.openOrderDetailsDrawer = openOrderDetailsDrawer;

function closeOrderDetailsDrawer() {
    document.getElementById('order-details-overlay').classList.remove('active');
    document.getElementById('order-details-drawer-sheet').classList.remove('active');
}
window.closeOrderDetailsDrawer = closeOrderDetailsDrawer;


// --- TRANSACTION DRAWER ACTIONS (滑入式下单抽屉逻辑) ---
let currentSelectedModelId = null;
let currentRiskLevel = 'MEDIUM'; // 'LOW', 'MEDIUM', 'HIGH'
let currentStopLossRate = 0.1; // float 0.0 - 1.0 (corresponds to 10%)
let minInvestAmount = 90.0; // Dynamic minimum from config (default 90 USDT)

function getStrategyMinInvestAmount(strategy) {
    if (!strategy) return minInvestAmount;
    const minVal = parseFloat(strategy.minInvestAmount || strategy.minAmount);
    if (minVal > 0) return minVal;
    const parsedVal = parseFloat(strategy.icon);
    if (strategy.icon && !isNaN(parsedVal) && parsedVal > 0) {
        return parsedVal;
    }
    return minInvestAmount;
}

function openOrderDrawer(modelId) {
    if (!currentUser) { openAuthModal(); return; }
    const strategy = strategyModels.find(m => m.id.toString() === modelId.toString());
    if (!strategy) return;
    
    selectedStrategy = strategy;
    currentSelectedModelId = strategy.id;
    
    // Reset defaults
    currentRiskLevel = 'MEDIUM';
    currentStopLossRate = 0.1;
    
    const agreeCheckbox = document.getElementById('new-agreement-checkbox');
    if (agreeCheckbox) agreeCheckbox.checked = false;
    
    // Render scrolling models horizontally
    const modelsContainer = document.getElementById('new-models-list');
    if (modelsContainer) {
        const names = ['MLP', 'LSTM/GRU', 'Transformer', 'XGBoost'];
        const subNames_i18n = {
            'en': ['Multilayer Perceptron', 'LSTM/GRU Recurrent Net', 'Self-Attention Transformer', 'Extreme Gradient Boosting'],
            'hi': ['मल्टी-लेयर परसेप्ट्रॉन मॉडल', 'लॉग शॉर्ट-टर्म मेमोरी नेटवर्क', 'सेल्फ-अटेंशन मैकेनिज्म मॉडल', 'एक्सट्रीम ग्रेडिएंट बूस्टिंग मॉडल']
        };
        const subNames = subNames_i18n[currentLocale] || subNames_i18n['en'];
        
        modelsContainer.innerHTML = strategyModels.map((m, idx) => {
            const activeClass = m.id.toString() === currentSelectedModelId.toString() ? 'active' : '';
            const displayName = getStrategyDisplayName(m) || names[idx % 4];
            const displaySub = getStrategyDescription(m, subNames[idx % 4]);
            
            // Blue tick mark in SVGs
            const tickHtml = m.id.toString() === currentSelectedModelId.toString() ? `
                <div class="new-blue-tick">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#FFFFFF" stroke-width="4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                </div>
            ` : '';
            
            const isIconRealUrl = m.icon && (m.icon.startsWith('http') || m.icon.startsWith('/'));
            const finalIconHtml = isIconRealUrl 
                ? `<div class="new-model-icon" style="background:none;"><img src="${m.icon}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(255,255,255,0.08);"></div>`
                : (m.iconUrl 
                    ? `<div class="new-model-icon" style="background:none;"><img src="${m.iconUrl}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover;"></div>`
                    : `<div class="new-model-icon">${getStrategyFallbackEmoji(m.name)}</div>`);
            
            return `
                <div class="new-model-card ${activeClass}" id="model-card-${m.id}" onclick="selectNewModel('${m.id}')">
                    ${tickHtml}
                    ${finalIconHtml}
                    <h4>${displayName}</h4>
                    <p>${displaySub}</p>
                </div>
            `;
        }).join('');
    }
    
    // Update Risk Level UI
    selectNewRiskLevel('MEDIUM');
    
    // Draw 11-Dot Stop Loss track
    renderStopLossDots(1); // Default to the 2nd dot (index 1), which is 10%
    
    // Retrieve latest available balance for display
    refreshBalanceInOrder();
    
    // Update Purchase Amount values and inputs
    const isInr = assetDisplayCurrency === 'INR';
    const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0;
    const currencySymbol = isInr ? '\u20b9' : '$';
    
    // Calculate display minimum and default based on strategy-specific or global minInvestAmount
    const strategyMinInvest = getStrategyMinInvestAmount(selectedStrategy);
    const minVal = isInr ? (strategyMinInvest * usdtRate) : strategyMinInvest;
    const baseDefault = Math.max(100, strategyMinInvest);
    const defaultVal = isInr ? (baseDefault * usdtRate) : baseDefault;
    
    const minTextLabel = {
        'en': 'Min Limit',
        'hi': 'न्यूनतम सीमा'
    };
    const minText = isInr 
        ? `${minTextLabel[currentLocale] || 'Min Limit'}: \u20b9${minVal.toFixed(0)}` 
        : `${minTextLabel[currentLocale] || 'Min Limit'}: $${minVal.toFixed(0)}`;
    
    const labelPurchase = currentLocale === 'hi' ? 'खरीद राशि' : 'Purchase Amount';
    
    document.getElementById('new-amount-currency-symbol').innerText = currencySymbol;
    document.getElementById('new-amount-min-lbl').innerText = `${labelPurchase} (${minText})`;
    document.getElementById('new-purchase-amount-input').value = defaultVal;
    
    // Set Agree button state
    recalcAgreeButtonState();
    
    // Slide up page
    document.getElementById('order-drawer-overlay').classList.add('active');
    document.getElementById('order-drawer-sheet').classList.add('active');
}

function closeOrderDrawer() {
    document.getElementById('order-drawer-overlay').classList.remove('active');
    document.getElementById('order-drawer-sheet').classList.remove('active');
}

function selectNewModel(modelId) {
    const strategy = strategyModels.find(m => m.id.toString() === modelId.toString());
    if (!strategy) return;
    
    selectedStrategy = strategy;
    currentSelectedModelId = strategy.id;
    
    // Refresh model card elements active states
    strategyModels.forEach(m => {
        const card = document.getElementById(`model-card-${m.id}`);
        if (card) {
            if (m.id.toString() === currentSelectedModelId.toString()) {
                card.classList.add('active');
                // Ensure tick is present
                if (!card.querySelector('.new-blue-tick')) {
                    card.insertAdjacentHTML('beforeend', `
                        <div class="new-blue-tick">
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#FFFFFF" stroke-width="4">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                        </div>
                    `);
                }
            } else {
                card.classList.remove('active');
                const tick = card.querySelector('.new-blue-tick');
                if (tick) tick.remove();
            }
        }
    });
}

function selectNewRiskLevel(level) {
    currentRiskLevel = level;
    
    const levels = ['LOW', 'MEDIUM', 'HIGH'];
    levels.forEach(l => {
        const btn = document.getElementById(`risk-item-${l}`);
        if (btn) {
            if (l === level) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

function renderStopLossDots(activeIndex) {
    const container = document.getElementById('new-stoploss-dots-group');
    if (!container) return;
    
    let dotsHtml = '';
    for (let i = 0; i <= 10; i++) {
        const activeClass = i === activeIndex ? 'active' : '';
        dotsHtml += `<span class="new-stoploss-dot ${activeClass}" onclick="selectNewStopLoss(${i})"></span>`;
    }
    container.innerHTML = dotsHtml;
    
    // Update progress bar width
    const progressPercent = activeIndex * 10;
    const progressEl = document.getElementById('new-stoploss-progress-bar');
    if (progressEl) {
        progressEl.style.width = `${progressPercent}%`;
    }
    
    // Update rate float
    currentStopLossRate = activeIndex * 0.1;
}

function selectNewStopLoss(index) {
    renderStopLossDots(index);
}

async function refreshBalanceInOrder(event) {
    if (event) event.stopPropagation();
    
    const refreshBtn = document.querySelector('.new-balance-refresh-btn');
    if (refreshBtn) refreshBtn.classList.add('spinning');
    
    try {
        await loadUserAssets(); // refresh global balances
    } catch(e) {
        console.error(e);
    }
    
    if (refreshBtn) refreshBtn.classList.remove('spinning');
    
    const balanceEl = document.getElementById('new-avail-balance');
    if (balanceEl) {
        if (assetDisplayCurrency === 'INR') {
            const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0;
            balanceEl.innerText = `\u20b9${(userUsdtBalance * usdtRate).toFixed(2)}`;
        } else {
            balanceEl.innerText = `$${userUsdtBalance.toFixed(2)} USDT`;
        }
    }
}

function recalcAgreeButtonState() {
    const agreeCheckbox = document.getElementById('new-agreement-checkbox');
    const isChecked = agreeCheckbox ? agreeCheckbox.checked : false;
    const submitBtn = document.getElementById('new-submit-btn');
    const inputEl = document.getElementById('new-purchase-amount-input');
    const amountVal = inputEl ? parseFloat(inputEl.value) : 0;
    
    // Minimum threshold check
    const isInr = assetDisplayCurrency === 'INR';
    const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0;
    const strategyMinInvest = getStrategyMinInvestAmount(selectedStrategy);
    const minThreshold = isInr ? (strategyMinInvest * usdtRate) : strategyMinInvest;
    const isAmountValid = amountVal >= minThreshold;
    
    if (submitBtn) {
        if (isChecked && isAmountValid) {
            submitBtn.classList.remove('disabled');
            submitBtn.disabled = false;
        } else {
            submitBtn.classList.add('disabled');
            submitBtn.disabled = true;
        }
    }
}

async function submitQuantFollowOrderNew() {
    if (!currentUser) {
        closeOrderDrawer();
        openAuthModal();
        const guestMsg = currentLocale === 'en' 
            ? '🔒 Please log in first to deploy strategy!' 
            : (currentLocale === 'hi' ? '🔒 रणनीति तैनात करने के लिए कृपया पहले लॉग इन करें!' : '🔒 Please log in to your trading account to deploy strategy!');
        showToast(guestMsg, true);
        return;
    }
    
    const inputEl = document.getElementById('new-purchase-amount-input');
    const inputVal = inputEl ? parseFloat(inputEl.value) : 0;
    
    // Minimum threshold
    const isInr = assetDisplayCurrency === 'INR';
    const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']);
    
    if (isInr && !usdtRate) {
        showToast(currentLocale === 'hi' ? 'सुरक्षित रूप से रीयल-टाइम विनिमय दर सिंक की जा रही है, कृपया पुनः प्रयास करें!' : 'Syncing real-time exchange rates, please try again in a moment!', true);
        if (window.syncExchangeRates) window.syncExchangeRates();
        return;
    }
    
    const strategyMinInvest = getStrategyMinInvestAmount(selectedStrategy);
    const minThreshold = isInr ? (strategyMinInvest * usdtRate) : strategyMinInvest;
    if (isNaN(inputVal) || inputVal < minThreshold) {
        const errorMsg = isInr 
            ? (currentLocale === 'hi' ? `न्यूनतम निवेश राशि \u20b9${minThreshold.toFixed(0)} है!` : `The minimum investment amount is \u20b9${minThreshold.toFixed(0)}!`)
            : (currentLocale === 'hi' ? `न्यूनतम investment amount is $${minThreshold.toFixed(0)}!` : `The minimum investment amount is $${minThreshold.toFixed(0)}!`);
        showToast(errorMsg, true);
        return;
    }
    
    // Calculate actual USDT value
    let realUsdtAmount = inputVal;
    if (isInr) {
        realUsdtAmount = inputVal / usdtRate;
    }
    
    // Balance check in USDT
    if (realUsdtAmount > userUsdtBalance) {
        const balMsg = currentLocale === 'en' 
            ? 'Insufficient balance! Please go to "Profile" to deposit funds.' 
            : (currentLocale === 'hi' ? 'अपर्याप्त शेष राशि! कृपया फंड जमा करने के लिए "प्रोफ़ाइल" पर जाएं।' : 'Insufficient balance! Please go to "Profile" panel to deposit.');
        showToast(balMsg, true);
        return;
    }
    
    // Loading indicator
    const btn = document.getElementById('new-submit-btn');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('disabled');
        btn.innerText = currentLocale === 'hi' ? 'तैनात किया जा रहा है...' : 'Deploying...';
    }
    
    try {
        const bodyStr = `{"agreementConfirmed":true,"algorithmModelId":${currentSelectedModelId},"investAmount":${parseFloat(realUsdtAmount.toFixed(4))},"riskLevel":"${currentRiskLevel}","stopLossRate":${parseFloat(currentStopLossRate.toFixed(1))}}`;
        
        const res = await apiFetchWithRawBody('POST', '/trading/quant/orders', bodyStr, true);
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('disabled');
            btn.innerText = currentLocale === 'hi' ? 'समीक्षा करें' : 'Review by order';
        }
        
        if (res.code === 200) {
            closeOrderDrawer();
            
            // Populating Success Modal fields
            const order = res.result || res.data || {};
            const orderNo = order.orderNo || `Q${Date.now()}${Math.floor(Math.random() * 1000)}`;
            const stopLossPercent = `${Math.round(currentStopLossRate * 100)}%`;
            const orderTimeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
            
            let displayAmountStr = `$${realUsdtAmount.toFixed(2)} USDT`;
            if (assetDisplayCurrency === 'INR') {
                displayAmountStr = `\u20b9${inputVal.toFixed(2)}`;
            }
            
            document.getElementById('success-order-id').innerText = orderNo;
            document.getElementById('success-order-amount').innerText = displayAmountStr;
            document.getElementById('success-order-stoploss').innerText = stopLossPercent;
            document.getElementById('success-order-time').innerText = orderTimeStr;
            
            // Open Success Modal overlay
            document.getElementById('order-success-modal').classList.add('active');
            
            // Background reload portfolio and assets
            setTimeout(() => {
                loadQuantOrders();
                loadUserAssets();
            }, 300);
        } else {
            const failMsg = currentLocale === 'hi' ? 'रणनीति तैनाती विफल रही!' : 'Strategy deployment failed!';
            showToast(res.errorMessage || failMsg, true);
        }
    } catch(e) {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('disabled');
            btn.innerText = currentLocale === 'hi' ? 'समीक्षा करें' : 'Review by order';
        }
        const netErrorMsg = currentLocale === 'hi' ? 'नेटवर्क कनेक्शन टूट गया!' : 'Network connection lost!';
        showToast(netErrorMsg, true);
    }
}

function closeSuccessAndShowOrders() {
    document.getElementById('order-success-modal').classList.remove('active');
    switchTab('assets');
}

function closeSuccessAndGoHome() {
    document.getElementById('order-success-modal').classList.remove('active');
    switchTab('home');
}

async function stopQuantOrder(orderId) {
    const liquidatingMsg = currentLocale === 'en'
        ? 'Submitting redemption request to asset gateway, liquidating assets...'
        : (currentLocale === 'hi' ? 'परिसंपत्ति गेटवे को मोचन अनुरोध सबमिट किया जा रहा है, संपत्तियों का परिसमापन हो रहा है...' : 'Submitting redemption request to asset gateway, liquidating assets...');
    showToast(liquidatingMsg, false);
    
    try {
        const res = await apiFetch('POST', `/trading/quant/orders/${orderId}/cancel`, {}, true);
        if (res.code === 200) {
            const successMsg = currentLocale === 'en'
                ? '🏁 Close follow order and redemption submitted successfully! Funds returned to balance.'
                : (currentLocale === 'hi' ? '🏁 फ़ॉलो ऑर्डर बंद करने और मोचन का अनुरोध सफलतापूर्वक सबमिट किया गया! फंड शेष राशि में वापस आ गए।' : '🏁 Follow order closed and redemption request submitted successfully! Funds returned to balance.');
            showToast(successMsg, false);
            loadQuantOrders();
            loadUserAssets();
        } else {
            const failMsg = currentLocale === 'hi' ? 'समाप्ति विफल रही!' : 'Termination failed!';
            showToast(res.errorMessage || failMsg, true);
        }
    } catch(e) {
        const netErr = currentLocale === 'hi' ? 'नेटवर्क अपवाद!' : 'Network exception!';
        showToast(netErr, true);
    }
}


// --- FORM SUBMISSIONS MODALS (登录，KYC) ---

window.loadQuantConfig = loadQuantConfig;
window.renderStrategyLobby = renderStrategyLobby;
window.filterStrategyList = filterStrategyList;
window.openOrderDetailsDrawer = openOrderDetailsDrawer;
window.closeOrderDetailsDrawer = closeOrderDetailsDrawer;
window.openOrderDrawer = openOrderDrawer;
window.closeOrderDrawer = closeOrderDrawer;
window.selectNewModel = selectNewModel;
window.selectNewRiskLevel = selectNewRiskLevel;
window.selectNewStopLoss = selectNewStopLoss;
window.refreshBalanceInOrder = refreshBalanceInOrder;
window.recalcAgreeButtonState = recalcAgreeButtonState;
window.submitQuantFollowOrderNew = submitQuantFollowOrderNew;
window.closeSuccessAndShowOrders = closeSuccessAndShowOrders;
window.closeSuccessAndGoHome = closeSuccessAndGoHome;
window.stopQuantOrder = stopQuantOrder;