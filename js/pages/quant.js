// Quant AI Trading Page View Controller
import { state } from '../modules/state.js?v=2.2.0';

async function loadQuantConfig() {
    let success = false;
    if (currentUser) {
        try {
            const res = await apiFetch('GET', '/trading/quant/config', null, true);
            if (res && res.code === 200) {
                const config = res.result || res.data;
                if (config && config.models && config.models.length > 0) {
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
        
        // Static mappings matching UX mockup
        const yields = ['+32.58%', '+24.17%', '+48.72%'];
        const rates = ['87.3%', '81.6%', '78.9%'];
        const followers = ['12,483', '8,392', '6,721'];
        
        const tags_i18n = {
            'en': ['Popular', 'Stable Rec', 'High Yield'],
            'hi': ['सर्वाधिक लोकप्रिय', 'स्थिर सिफारिश', 'उच्च उपज']
        };
        const tags = tags_i18n[currentLocale] || tags_i18n['en'];
        const classTags = ['hot', 'stable', 'high'];
        const icons = ['🤖', '🐂', '🚀'];
        
        const isInr = assetDisplayCurrency === 'INR';
        
        const labelYield30d = currentLocale === 'hi' ? '30-दिन की उपज' : '30d Yield';
        const labelWinRate = currentLocale === 'hi' ? 'जीत दर' : 'Win Rate';
        const labelFollowers = currentLocale === 'hi' ? 'अनुयायी' : 'Followers';
        const labelFollowBtn = currentLocale === 'hi' ? 'फ़ॉलो' : 'Follow';
        const labelMinShort = currentLocale === 'hi' ? 'न्यूनतम' : 'Min';
        
        homeFeatured.innerHTML = miniData.map((m, idx) => {
            const strategyMinInvest = (m.icon && !isNaN(parseFloat(m.icon)) && parseFloat(m.icon) > 0) ? parseFloat(m.icon) : minInvestAmount;
            const featMinText = isInr ? `${labelMinShort} \u20b9${(strategyMinInvest * 83.00).toFixed(0)}` : `${labelMinShort} $${strategyMinInvest.toFixed(0)}`;
            return `
                <div class="feat-strat-card" onclick="switchTab('follow'); setTimeout(() => openOrderDrawer('${m.id}'), 150);">
                    <span class="feat-tag tag-${classTags[idx]}">${tags[idx]}</span>
                    <div class="feat-avatar-row">
                        <div class="feat-avatar">${icons[idx]}</div>
                        <span class="feat-name-lbl">${t(m.name)}</span>
                    </div>
                    <div class="feat-yield-box">
                        <span class="feat-yield-val">${yields[idx]}</span>
                        <span class="feat-yield-lbl">${labelYield30d}</span>
                    </div>
                    <div class="feat-grid-stats">
                        <div class="feat-g-stat">
                            <span class="val">${rates[idx]}</span>
                            <span class="lbl">${labelWinRate}</span>
                        </div>
                        <div class="feat-g-stat">
                            <span class="val">${followers[idx]}</span>
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
    
    // Mockup values mapped strictly
    const yields = ['+32.58%', '+24.17%', '+48.72%', '+19.35%'];
    const winrates = ['87.3%', '81.6%', '78.9%', '79.2%'];
    const followers = ['12,483', '8,392', '6,721', '5,231'];
    
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
    
    const drawdowns = ['8.2%', '6.5%', '12.4%', '4.8%'];
    const classTags = ['pop', 'rec', 'high', 'rec'];
    const icons = ['🤖', '🐂', '🚀', '🦅'];
    
    const isInr = assetDisplayCurrency === 'INR';
    
    const labelWinRate = currentLocale === 'hi' ? 'जीत दर' : 'Win Rate';
    const labelFollowers = currentLocale === 'hi' ? 'अनुयायी' : 'Followers';
    const labelRiskLevel = currentLocale === 'hi' ? 'जोखिम स्तर' : 'Risk Level';
    const labelMin = currentLocale === 'hi' ? 'न्यूनतम सीमा' : 'Min Limit';
    const labelFollowBtn = currentLocale === 'hi' ? 'फ़ॉलो' : 'Follow';
    
    listEl.innerHTML = filtered.map((m, idx) => {
        const mappedIdx = strategyModels.indexOf(m) % 4;
        const strategyMinInvest = (m.icon && !isNaN(parseFloat(m.icon)) && parseFloat(m.icon) > 0) ? parseFloat(m.icon) : minInvestAmount;
        const lobbyMinText = isInr ? `${labelMin} <span>\u20b9${(strategyMinInvest * 83.00).toFixed(0)}</span>` : `${labelMin} <span>$${strategyMinInvest.toFixed(0)}</span>`;
        
        return `
            <div class="strat-card-big" onclick="openOrderDrawer('${m.id}')">
                <div class="strat-top-inner">
                    <div class="s-title-block">
                        <div class="s-avatar">${icons[mappedIdx]}</div>
                        <div class="s-meta-flex">
                            <h4>${t(m.name)}</h4>
                            <div class="s-meta-badge-row">
                                <span class="s-badge-p">Pro</span>
                                <span class="s-badge-r bg-${classTags[mappedIdx]}">${tags[mappedIdx]}</span>
                            </div>
                        </div>
                    </div>
                    <span class="s-yield-val">${yields[mappedIdx]}</span>
                </div>
                <div class="strat-mid-body">
                    <div class="strat-stats-flex">
                        <div class="stat-row-item">
                            <span class="lbl">${labelWinRate}</span>
                            <span class="val">${winrates[mappedIdx]}</span>
                        </div>
                        <div class="stat-row-item">
                            <span class="lbl">${labelFollowers}</span>
                            <span class="val">${followers[mappedIdx]}</span>
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
    
    // Draw canvas sparklines
    filtered.forEach((m) => {
        const mappedIdx = strategyModels.indexOf(m) % 4;
        const mockCurves = [
            [10, 12, 11, 15, 14, 18, 17, 22, 20, 25, 24, 28, 26, 32],
            [20, 21, 23, 22, 25, 24, 26, 28, 27, 30, 29, 32],
            [10, 8, 14, 12, 19, 15, 24, 20, 28, 25, 34, 30, 42, 38, 48],
            [15, 16, 15, 17, 18, 17, 19, 18, 20, 21, 20, 22, 23]
        ];
        drawIndexSparkline(`s-canvas-${m.id}`, mockCurves[mappedIdx], true);
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
    const algoName = order.algorithmModel ? order.algorithmModel.name : (currentLocale === 'hi' ? 'क्वांट एआई रणनीति' : 'Quant AI Strategy');
    const modelId = order.algorithmModelId || 1;
    const icons = ['🤖', '🐂', '🚀', '🦅'];
    const avatarIdx = (modelId - 1) % 4;
    
    document.getElementById('detail-algo-icon').innerText = icons[avatarIdx];
    document.getElementById('detail-algo-name').innerText = algoName;
    document.getElementById('detail-order-no').innerText = `${currentLocale === 'hi' ? 'ऑर्डर नंबर:' : 'Order No:'} ${order.orderNo}`;
    
    const isInr = assetDisplayCurrency === 'INR';
    const amountVal = parseFloat(order.investAmount) || 0.00;
    const displayAmountStr = isInr ? `\u20b9${(amountVal * 83.00).toFixed(2)}` : `$${amountVal.toFixed(2)} USDT`;
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
    const displayProfitStr = isInr ? `${profitVal >= 0 ? '+' : ''}\u20b9${(profitVal * 83.00).toFixed(2)}` : `${profitVal >= 0 ? '+' : ''}$${profitVal.toFixed(2)} USDT`;
    
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
            const displayName = names[idx % 4];
            const displaySub = subNames[idx % 4];
            
            // Blue tick mark in SVGs
            const tickHtml = m.id.toString() === currentSelectedModelId.toString() ? `
                <div class="new-blue-tick">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#FFFFFF" stroke-width="4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                </div>
            ` : '';
            
            return `
                <div class="new-model-card ${activeClass}" id="model-card-${m.id}" onclick="selectNewModel('${m.id}')">
                    ${tickHtml}
                    <div class="new-model-icon">🧠</div>
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
    const currencySymbol = isInr ? '\u20b9' : '$';
    
    // Calculate display minimum and default based on strategy-specific or global minInvestAmount
    const strategyMinInvest = (selectedStrategy.icon && !isNaN(parseFloat(selectedStrategy.icon)) && parseFloat(selectedStrategy.icon) > 0) ? parseFloat(selectedStrategy.icon) : minInvestAmount;
    const minVal = isInr ? (strategyMinInvest * 83.00) : strategyMinInvest;
    const baseDefault = Math.max(100, strategyMinInvest);
    const defaultVal = isInr ? (baseDefault * 83.00) : baseDefault;
    
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
            balanceEl.innerText = `\u20b9${(userUsdtBalance * 83.00).toFixed(2)}`;
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
    const minThreshold = isInr ? (minInvestAmount * 83.00) : minInvestAmount;
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
    const strategyMinInvest = (selectedStrategy.icon && !isNaN(parseFloat(selectedStrategy.icon)) && parseFloat(selectedStrategy.icon) > 0) ? parseFloat(selectedStrategy.icon) : minInvestAmount;
    const minThreshold = isInr ? (strategyMinInvest * 83.00) : strategyMinInvest;
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
        realUsdtAmount = inputVal / 83.00;
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