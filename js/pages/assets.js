// Assets Page View Controller
import { state } from '../modules/state.js?v=2.2.0';

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

async function loadUserAssets() {
    if (!currentUser) return;
    
    try {
        const acctsRes = await apiFetch('GET', '/finance/accounts', null, true);
        if (acctsRes.code === 200) {
            const accounts = acctsRes.result || acctsRes.data || [];
            if (accounts.length === 0) return;
            
            const mainAcct = accounts.find(a => a.accountType === 'MAIN') || accounts[0];
            if (mainAcct) {
                const balRes = await apiFetch('GET', `/finance/accounts/${mainAcct.id}/balances`, null, true);
                if (balRes.code === 200) {
                    const balances = balRes.result || balRes.data || [];
                    
                    // Aggregate live values into total USDT valuation
                    let totalVal = 0.00;
                    let hasUSDT = false;
                    
                    const usdtBal = balances.find(b => (b.asset && b.asset.symbol === 'USDT') || String(b.assetId) === '1183348576672026624');
                    if (usdtBal) {
                        userUsdtBalance = parseFloat(usdtBal.available) || 0.00;
                        totalVal += parseFloat(usdtBal.total) || 0.00;
                        hasUSDT = true;
                    }
                    
                    // Also aggregate INR balance as part of fiat support
                    const inrBal = balances.find(b => (b.asset && b.asset.symbol === 'INR') || String(b.assetId) === '1126151490264633456');
                    if (inrBal) {
                        const inrAvailable = parseFloat(inrBal.available) || 0.00;
                        const inrTotal = parseFloat(inrBal.total) || 0.00;
                        // Convert INR to USDT/USD (using the platform rate)
                        const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0;
                        if (!hasUSDT || userUsdtBalance === 0) {
                            userUsdtBalance = inrAvailable / usdtRate;
                        }
                        totalVal += inrTotal / usdtRate;
                    }
                    
                    const btcBal = balances.find(b => (b.asset && b.asset.symbol === 'BTC') || String(b.assetId) === '1183348576642666496');
                    if (btcBal) {
                        const btcInst = state.recommendedInstruments.find(i => i.symbol.toUpperCase() === 'BTCUSDT');
                        const btcPrice = btcInst ? parseFloat(btcInst.ticker?.closePrice || btcInst.ticker?.lastPrice || btcInst.price || 0.00) : 0.00;
                        totalVal += (parseFloat(btcBal.total) || 0.00) * btcPrice;
                    }
                    
                    const ethBal = balances.find(b => (b.asset && b.asset.symbol === 'ETH') || String(b.assetId) === '1183348576630083584');
                    if (ethBal) {
                        const ethInst = state.recommendedInstruments.find(i => i.symbol.toUpperCase() === 'ETHUSDT');
                        const ethPrice = ethInst ? parseFloat(ethInst.ticker?.closePrice || ethInst.ticker?.lastPrice || ethInst.price || 0.00) : 0.00;
                        totalVal += (parseFloat(ethBal.total) || 0.00) * ethPrice;
                    }
                    
                    // Cache values globally to support state-based currency toggles
                    window.cachedTotalVal = totalVal;
                    window.cachedUserUsdtBalance = userUsdtBalance;
                    
                    // Render valuation boards dynamically based on current currency toggle
                    updateTotalValDisplay();
                    
                    // Reverted home premium card sync
                }
            }
        }
    } catch(e) {
        console.error('Failed to load user assets:', e);
    }
}

async function loadQuantOrders() {
    if (!currentUser) {
        const loginWarningText = currentLocale === 'en' 
            ? '🔒 Please log in first to view your real assets & follows' 
            : (currentLocale === 'hi' ? '🔒 कृपया अपनी वास्तविक संपत्ति और फ़ॉलो देखने के लिए पहले लॉग इन करें' : '🔒 Please log in to view your real assets and follow records');
        const secureLoginBtnText = currentLocale === 'hi' ? 'सुरक्षित लॉगिन' : 'Secure Login';
        const container = document.getElementById('assets-orders-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px 10px; color:var(--text-muted); font-size:0.8rem;">
                    ${loginWarningText}
                    <button class="auth-btn" style="margin-top:15px; width:150px; display:inline-block;" onclick="openAuthModal()">${secureLoginBtnText}</button>
                </div>
            `;
        }
        return;
    }
    
    try {
        const res = await apiFetch('GET', '/trading/quant/orders?page=1&pageSize=1000', null, true);
        if (res.code === 200) {
            const orders = res.result || res.data || [];
            
            // Fetch trades trace for active/completed orders to display their actual final profits
            await Promise.all(orders.map(async (order) => {
                // Fetch trades to get correct profit
                try {
                    const tradesRes = await apiFetch('GET', `/trading/quant/orders/${order.id}/trades`, null, true);
                    if (tradesRes.code === 200) {
                        const trades = tradesRes.result || tradesRes.data || [];
                        trades.sort((a, b) => a.createdAt - b.createdAt);
                        order.trades = trades; // Cache trades list on order!
                        if (trades.length > 0) {
                            const lastTrade = trades[trades.length - 1];
                            if (lastTrade.tradeType === 'SELL') {
                                order.actualProfit = parseFloat(lastTrade.profit || 0);
                            }
                        }
                    }
                } catch(tradeErr) {
                    console.error('Failed to load trades for user order:', tradeErr);
                }
            }));
            
            // Delete simulated adjustments variables
            window.totalSettledRefund = 0.00;
            window.totalSettledProfit = 0.00;
            
            activeOrders = orders;
            
            // Update active status counter row counts
            const runningCount = orders.filter(o => o.status === 'ACTIVE').length;
            const completedCount = orders.filter(o => o.status === 'COMPLETED').length;
            const stoppedCount = orders.filter(o => o.status === 'CANCELLED' || o.status === 'REJECTED').length;
            
            const cntActive = document.getElementById('assets-cnt-active');
            if (cntActive) cntActive.innerText = runningCount;
            const cntHistory = document.getElementById('assets-cnt-history');
            if (cntHistory) cntHistory.innerText = completedCount;
            const cntStopped = document.getElementById('assets-cnt-stopped');
            if (cntStopped) cntStopped.innerText = stoppedCount;
            
            // Calculate total values
            let investSum = 0.00;
            let profitSum = 0.00;
            
            orders.forEach(o => {
                investSum += parseFloat(o.investAmount) || 0.00;
                profitSum += parseFloat(o.actualProfit) || 0.00;
            });
            
            // Cache values globally to support state-based currency toggles
            window.cachedInvestSum = investSum;
            window.cachedProfitSum = profitSum;
            
            // Render investment and profit dynamically based on current currency toggle
            updateQuantOrdersDisplay();
            
            // Render active positions tab list
            renderPortfolioOrdersList();
        }
    } catch(e) {
        console.error('Failed to load portfolio orders:', e);
    }
}

function renderPortfolioOrdersList() {
    const container = document.getElementById('assets-orders-container');
    if (!container) return;
    
    let filtered = [];
    if (activeAssetFilter === 'ACTIVE') {
        filtered = activeOrders.filter(o => o.status === 'ACTIVE');
    } else if (activeAssetFilter === 'HISTORY') {
        filtered = activeOrders.filter(o => o.status === 'COMPLETED');
    } else {
        filtered = activeOrders.filter(o => o.status === 'CANCELLED' || o.status === 'REJECTED');
    }
    
    if (filtered.length === 0) {
        const emptyMsg = currentLocale === 'en'
            ? '🤖 No matching follows found'
            : (currentLocale === 'hi' ? '🤖 कोई मिलान वाले फ़ॉलो नहीं मिले' : '🤖 No matching quantitative follow orders');
        container.innerHTML = `
            <div style="text-align:center; padding:50px 10px; color:var(--text-muted); font-size:0.8rem;">
                ${emptyMsg}
            </div>
        `;
        return;
    }
    
    const icons = ['🤖', '🐂', '🚀', '🦅'];
    
    const labelOrderNo = currentLocale === 'hi' ? 'ऑर्डर नंबर' : 'Order No';
    const labelTotalInvest = currentLocale === 'hi' ? 'कुल निवेश राशि' : 'Total Invested';
    const labelDetails = currentLocale === 'hi' ? 'विवरण' : 'Details';
    const quantAiStr = currentLocale === 'hi' ? 'क्वांट एआई रणनीति' : 'Quant AI Strategy';
    
    const isInr = assetDisplayCurrency === 'INR';
    const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0;

    container.innerHTML = filtered.map(o => {
        const profit = parseFloat(o.actualProfit) || 0.00;
        const profitClass = profit >= 0 ? 'green' : 'red';
        const displayProfitVal = isInr ? (profit * usdtRate) : profit;
        const profitStr = isInr ? `${profit >= 0 ? '+' : ''}\u20b9${displayProfitVal.toFixed(2)}` : `${profit >= 0 ? '+' : ''}$${displayProfitVal.toFixed(2)}`;
        
        const rate = (profit / parseFloat(o.investAmount) * 100) || 0.00;
        const rateStr = `${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%`;
        
        const algoName = o.algorithmModel ? getStrategyDisplayName(o.algorithmModel) : quantAiStr;
        const modelId = o.algorithmModelId || 1;
        
        const investVal = parseFloat(o.investAmount) || 0.00;
        const displayInvestStr = isInr ? `\u20b9${(investVal * usdtRate).toFixed(2)}` : `$${investVal.toFixed(2)} USDT`;

        return `
            <div class="portfolio-order-card">
                <div class="p-card-top">
                    <div class="p-card-meta">
                        <h4>${algoName}</h4>
                        <span>${labelOrderNo}: ${o.orderNo.substring(0, 12)}...</span>
                    </div>
                    <div class="p-card-price-chg">
                        <span class="profit ${profitClass}">${profitStr}</span>
                        <span class="pct ${profitClass}">${rateStr}</span>
                    </div>
                </div>
                
                <div class="p-card-grid-details">
                    <div class="p-detail-col">
                        <span class="lbl">${labelTotalInvest}</span>
                        <span class="val">${displayInvestStr}</span>
                    </div>
                    <!-- Small Canvas sparkline -->
                    <canvas class="p-sparkline-canvas" id="pos-canvas-${o.id}" width="90" height="22"></canvas>
                </div>
                
                <div class="p-card-actions">
                    <button class="p-btn-action-outline" onclick="openOrderDetailsDrawer('${o.id}')">${labelDetails}</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Draw running position curves
    filtered.forEach(o => {
        const curve = [10, 11.2, 10.8, 12.1, 11.9, 13.2, 12.8, 14.5];
        const profit = parseFloat(o.actualProfit) || 0.00;
        drawIndexSparkline(`pos-canvas-${o.id}`, curve, profit >= 0);
    });
}

function filterAssetOrdersTab(filter, btnEl) {
    const tabs = btnEl.parentNode.children;
    for (let t of tabs) t.classList.remove('active');
    btnEl.classList.add('active');
    
    activeAssetFilter = filter;
    renderPortfolioOrdersList();
}

function openTxRecordsModal() {
    if (!currentUser) { openAuthModal(); return; }
    switchTab('txrecords');
}

function closeTxRecordsModal() {
    switchTab('profile');
}

async function renderTxRecordsItems() {
    const container = document.getElementById('txrecords-items-list');
    if (!container) return;
    
    container.innerHTML = `<div style="text-align: center; padding: 25px; color: var(--text-secondary); font-size: 0.8rem;">${t('tx_loading')}</div>`;
    
    try {
        const [depRes, witRes] = await Promise.all([
            apiFetch('GET', '/finance/deposits', null, true),
            apiFetch('GET', '/finance/withdrawals', null, true)
        ]);
        
        let list = [];
        
        if (depRes && depRes.code === 200) {
            const deposits = depRes.result || depRes.data || [];
            deposits.forEach(d => {
                let typeText = d.depositType === 'FIAT' ? t('tx_type_fiat_dep') : t('tx_type_crypto_dep');
                list.push({
                    id: d.id,
                    type: 'DEPOSIT',
                    depositType: d.depositType,
                    typeText: typeText,
                    amount: parseFloat(d.amount),
                    symbol: 'USDT', // Always show credited currency USDT in header
                    fiatSymbol: d.asset?.symbol || 'INR',
                    status: d.status,
                    createdAt: d.createdAt,
                    remittanceCode: d.remittanceCode || '--',
                    fxRate: d.collectionFxRate || '1.00',
                    fiatAmount: d.collectedAmount || '0.00',
                    proofUrl: d.paymentProof || ''
                });
            });
        }
        
        if (witRes && witRes.code === 200) {
            const withdrawals = witRes.result || witRes.data || [];
            withdrawals.forEach(w => {
                let displayAmount = parseFloat(w.amount || 0);
                let displaySymbol = 'USDT';
                
                const isNewRecord = w.createdAt && parseInt(w.createdAt) > 1779700000000;
                let recordRate = parseFloat(w.fxRate || w.collectionFxRate || w.collectionRate || 0);
                let rate = recordRate > 0 ? recordRate : ((state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0);
                
                if (w.withdrawType === 'CRYPTO') {
                    if (isNewRecord) {
                        displayAmount = displayAmount / rate;
                    }
                    displaySymbol = 'USDT';
                } else if (w.withdrawType === 'FIAT') {
                    if (!isNewRecord) {
                        displayAmount = displayAmount * rate;
                    }
                    displaySymbol = w.asset?.symbol || 'INR';
                }
                
                list.push({
                    id: w.id,
                    type: 'WITHDRAW',
                    withdrawType: w.withdrawType,
                    typeText: t('tx_type_withdraw'),
                    amount: displayAmount,
                    symbol: displaySymbol,
                    status: w.status,
                    createdAt: w.createdAt,
                    targetSnapshot: w.targetSnapshot || '',
                    fxRate: recordRate,
                    rawAmount: parseFloat(w.amount || 0),
                    fee: parseFloat(w.fee || 0),
                    actualAmount: parseFloat(w.actualAmount || w.amount || 0),
                    isNewRecord: isNewRecord
                });
            });
        }
        
        // Sort by createdAt descending
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        window.cachedTxRecords = list;
        applyTxRecordsFilter();
        
    } catch (e) {
        console.error('Failed to load transaction records:', e);
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: #EF4444; font-size: 0.8rem;">${t('tx_err_network')}</div>`;
    }
}

let currentTxRecordsFilter = 'ALL';
function filterTxRecords(category) {
    currentTxRecordsFilter = category;
    
    // Update active tab visual
    const tabs = document.querySelectorAll('#view-txrecords .category-tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('onclick').includes(`'${category}'`)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    applyTxRecordsFilter();
}

function applyTxRecordsFilter() {
    const container = document.getElementById('txrecords-items-list');
    if (!container || !window.cachedTxRecords) return;
    
    let filteredList = window.cachedTxRecords;
    if (currentTxRecordsFilter === 'DEPOSIT') {
        filteredList = window.cachedTxRecords.filter(item => item.type === 'DEPOSIT');
    } else if (currentTxRecordsFilter === 'WITHDRAW') {
        filteredList = window.cachedTxRecords.filter(item => item.type === 'WITHDRAW');
    }
    
    if (filteredList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 10px; color: var(--text-muted); font-size: 0.8rem;">
                ${t('tx_empty')}
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredList.map(item => {
        const dateStr = item.createdAt ? new Date(parseInt(item.createdAt)).toLocaleString() : '--';
        const isDep = item.type === 'DEPOSIT';
        const signText = isDep ? '+' : '-';
        const amtClass = isDep ? 'green' : 'red';
        
        // Format status badge
        let statusText = t('status_pending');
        let statusClass = 'kyc-status-PENDING';
        
        const s = item.status ? item.status.toUpperCase() : 'PENDING';
        if (s === 'CREDITED' || s === 'COMPLETED' || s === 'SUCCESS') {
            statusText = t('status_success');
            statusClass = 'kyc-status-VERIFIED';
        } else if (s === 'REJECTED' || s === 'FAILED') {
            statusText = t('status_rejected');
            statusClass = 'kyc-status-REFUSED';
        } else if (s === 'CANCELED' || s === 'CANCELLED') {
            statusText = t('status_cancelled');
            statusClass = 'kyc-status-REFUSED';
        } else if (s === 'PROCESSING' || s === 'ACCEPTED') {
            statusText = t('status_processing');
            statusClass = 'kyc-status-PENDING';
        }
        
        // Toggleable Detail Section
        let detailHtml = '';
        if (isDep) {
            let fiatDetail = '';
            if (item.depositType === 'FIAT') {
                const fiatSym = item.fiatSymbol || 'INR';
                const rateVal = parseFloat(item.fxRate) || 1.00;
                const paidAmt = parseFloat(item.fiatAmount) || 0.00;
                const rateText = currentLocale === 'hi' ? 'विनिमय दर' : 'Rate';
                const paidText = currentLocale === 'hi' ? 'भुगतान राशि' : 'Paid Amount';
                fiatDetail = `<div>${paidText}: <span style="font-weight: 600; color: var(--text-primary);">${paidAmt.toFixed(2)} ${fiatSym}</span> (${rateText}: 1 USDT ≈ ${rateVal.toFixed(2)} ${fiatSym})</div>`;
            }
            detailHtml = `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(0,0,0,0.06); font-size: 0.72rem; color: var(--text-secondary); line-height: 1.5; text-align: left;">
                    ${fiatDetail}
                    <div>${t('tx_detail_code')}: <span style="font-family: monospace; font-weight: 600; color: var(--text-primary);">${item.remittanceCode}</span></div>
                    ${item.proofUrl ? `<div>${t('tx_detail_proof')}: <a href="${item.proofUrl}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: underline;">${t('tx_detail_preview')}</a></div>` : ''}
                </div>
            `;
        } else {
            const targetText = parseWithdrawTarget(item.targetSnapshot);
            const rate = item.fxRate > 0 ? item.fxRate : ((state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0);
            const feeVal = item.fee || 0;
            const actualVal = item.actualAmount || item.rawAmount || 0;
            
            let displayFee = feeVal;
            let displayActual = actualVal;
            
            if (item.withdrawType === 'CRYPTO') {
                if (item.isNewRecord) {
                    displayFee = feeVal / rate;
                    displayActual = displayActual / rate;
                }
            } else if (item.withdrawType === 'FIAT') {
                if (!item.isNewRecord) {
                    displayFee = feeVal * rate;
                    displayActual = displayActual * rate;
                }
            }
            
            const feeText = currentLocale === 'hi' ? 'सेवा शुल्क' : 'Service Fee';
            const receivedText = currentLocale === 'hi' ? 'वास्तविक आगमन' : 'Actual Received';
            const rateTextLabel = currentLocale === 'hi' ? 'दर' : 'Exchange Rate';
            
            let rateInfo = '';
            if (item.withdrawType === 'CRYPTO' && item.isNewRecord) {
                rateInfo = ` <span style="color: var(--text-muted); font-size: 0.65rem;">(${rateTextLabel}: 1 USDT ≈ ${rate.toFixed(2)} INR)</span>`;
            }
            
            detailHtml = `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(0,0,0,0.06); font-size: 0.72rem; color: var(--text-secondary); line-height: 1.5; text-align: left;">
                    <div>${t('tx_detail_channel')}: <span style="font-family: monospace; font-weight: 600; color: var(--text-primary);">${targetText}</span></div>
                    <div>${feeText}: <span style="font-weight: 600; color: var(--text-primary);">${displayFee.toFixed(2)} ${item.symbol}</span></div>
                    <div>${receivedText}: <span style="font-weight: 600; color: var(--green);">${displayActual.toFixed(2)} ${item.symbol}</span>${rateInfo}</div>
                </div>
            `;
        }
        
        const iconChar = isDep ? '📥' : '📤';
        const iconBg = isDep ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
        
        return `
            <div class="notify-row" style="padding: 12px; margin-bottom: 10px; border-radius: 10px; background: #FFF; border: 1px solid var(--border-light); box-shadow: 0 2px 6px rgba(0,0,0,0.01); display: flex; flex-direction: column; transition: all 0.2s;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center; font-size: 1rem;">
                            ${iconChar}
                        </div>
                        <div style="text-align: left;">
                            <h4 style="margin: 0; font-size: 0.85rem; color: var(--text-primary); font-weight: 700;">${item.typeText}</h4>
                            <span style="font-size: 0.65rem; color: var(--text-secondary);">${dateStr}</span>
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        <span class="${amtClass}" style="font-weight: 800; font-size: 0.95rem;">${signText}${item.amount.toFixed(2)} ${item.symbol}</span>
                        <span class="kyc-badge-status ${statusClass}" style="font-size: 0.62rem; padding: 2px 6px; border-radius: 4px; display: inline-block;">${statusText}</span>
                    </div>
                </div>
                ${detailHtml}
            </div>
        `;
    }).join('');
}

function openFundDetailsModal() {
    if (!currentUser) { openAuthModal(); return; }
    switchTab('funddetails');
}

function closeFundDetailsModal() {
    switchTab('profile');
}

async function renderFundDetailsItems() {
    const container = document.getElementById('funddetails-items-list');
    if (!container) return;
    
    container.innerHTML = `<div style="text-align: center; padding: 25px; color: var(--text-secondary); font-size: 0.8rem;">${t('fund_loading')}</div>`;
    
    try {
        const [res, depositsRes] = await Promise.all([
            apiFetch('GET', '/finance/ledgers?page=1&pageSize=1000', null, true),
            apiFetch('GET', '/finance/deposits', null, true).catch(() => null)
        ]);
        
        if (res && res.code === 200) {
            const ledgers = res.result || res.data || [];
            
            // Build map of deposits for precise lookup
            const depositMap = new Map();
            if (depositsRes && depositsRes.code === 200) {
                const deposits = depositsRes.result || depositsRes.data || [];
                deposits.forEach(d => {
                    if (d.id) {
                        depositMap.set(d.id.toString(), d);
                    }
                });
            }
            
            // De-duplicate duplicate withdrawal ledgers (by bizId)
            const seenWithdrawBizIds = new Set();
            const deduplicatedLedgers = [];
            
            ledgers.forEach(l => {
                if (l.bizType === 'WITHDRAW_CRYPTO' || l.bizType === 'WITHDRAW_FIAT') {
                    if (l.bizId) {
                        const bizIdStr = l.bizId.toString();
                        if (seenWithdrawBizIds.has(bizIdStr)) {
                            // Duplicate withdrawal ledger log, skip rendering
                            return;
                        }
                        seenWithdrawBizIds.add(bizIdStr);
                    }
                }
                deduplicatedLedgers.push(l);
            });
            
            window.cachedFundDetails = {
                ledgers: deduplicatedLedgers,
                depositMap: depositMap
            };
            
            applyFundDetailsFilter();
            
        } else {
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: #EF4444; font-size: 0.8rem;">${t('fund_err_fail')}${res.errorMessage || 'Error'}</div>`;
        }
    } catch(e) {
        console.error('Failed to load ledgers:', e);
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: #EF4444; font-size: 0.8rem;">${t('fund_err_network')}</div>`;
    }
}

let currentFundDetailsFilter = 'ALL';
function filterFundDetails(category) {
    currentFundDetailsFilter = category;
    
    // Update active tab visual
    const tabs = document.querySelectorAll('#view-funddetails .category-tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('onclick').includes(`'${category}'`)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    applyFundDetailsFilter();
}

function applyFundDetailsFilter() {
    const container = document.getElementById('funddetails-items-list');
    if (!container || !window.cachedFundDetails) return;
    
    const { ledgers, depositMap } = window.cachedFundDetails;
    
    let filteredList = ledgers;
    if (currentFundDetailsFilter === 'DEPOSIT') {
        filteredList = ledgers.filter(l => l.bizType === 'DEPOSIT_CRYPTO' || l.bizType === 'DEPOSIT_FIAT');
    } else if (currentFundDetailsFilter === 'WITHDRAW') {
        filteredList = ledgers.filter(l => l.bizType === 'WITHDRAW_CRYPTO' || l.bizType === 'WITHDRAW_FIAT');
    } else if (currentFundDetailsFilter === 'STRATEGY') {
        filteredList = ledgers.filter(l => l.bizType === 'AI_QUANT' || l.bizType === 'AI_QUANT_PROFIT' || l.bizType === 'AI_QUANT_REFUND' || l.bizType === 'COPY_TRADE_FEE');
    }
    
    if (filteredList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 10px; color: var(--text-muted); font-size: 0.8rem;">
                ${t('fund_empty')}
            </div>
        `;
        return;
    }
    
    const bizTypeMap = {
        'DEPOSIT_CRYPTO': t('fund_biz_dep_crypto'),
        'DEPOSIT_FIAT': t('fund_biz_dep_fiat'),
        'WITHDRAW_CRYPTO': t('fund_biz_wd_crypto'),
        'WITHDRAW_FIAT': t('fund_biz_wd_fiat'),
        'AI_QUANT': t('fund_biz_quant'),
        'AI_QUANT_PROFIT': t('fund_biz_quant_profit'),
        'AI_QUANT_REFUND': t('fund_biz_quant_refund'),
        'COPY_TRADE_FEE': t('fund_biz_copy_fee'),
        'TRANSFER': t('fund_biz_transfer')
    };
    
    const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']) || 1.0;
    
    container.innerHTML = filteredList.map(l => {
        const dateStr = l.createdAt ? new Date(parseInt(l.createdAt)).toLocaleString() : '--';
        const isAdd = l.direction === 'IN' || l.actionType === 'ADD';
        const signText = isAdd ? '+' : '-';
        const amtClass = isAdd ? 'green' : 'red';
        
        const desc = bizTypeMap[l.bizType] || l.bizType || t('fund_biz_settlement');
        const symbol = l.asset?.symbol || 'USDT';
        
        const iconChar = isAdd ? '💵' : '💸';
        const iconBg = isAdd ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)';
        
        // Determine original transaction amount and currency for deposits/withdrawals to solve Rupee confusion
        let originalInfoHtml = '';
        if (l.bizType === 'DEPOSIT_CRYPTO' || l.bizType === 'DEPOSIT_FIAT') {
            // Try exact lookup from deposit map first
            const depositObj = l.bizId ? depositMap.get(l.bizId.toString()) : null;
            if (depositObj) {
                if (depositObj.depositType === 'FIAT') {
                    const origAmt = parseFloat(depositObj.collectedAmount || 0);
                    const origSym = depositObj.asset?.symbol || 'INR';
                    originalInfoHtml = `<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; margin-top: 1px;">(≈ ${signText}${origAmt.toFixed(2)} ${origSym})</div>`;
                }
            } else if (l.bizType === 'DEPOSIT_FIAT') {
                // Fallback: intelligent approximation using platform exchange rates
                const rawAmt = parseFloat(l.changeAmount);
                const approxInr = rawAmt * usdtRate;
                originalInfoHtml = `<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; margin-top: 1px;">(approx. ${signText}${approxInr.toFixed(2)} INR)</div>`;
            }
        } else if (l.bizType === 'WITHDRAW_FIAT') {
            const rawAmt = parseFloat(l.changeAmount);
            const approxInr = rawAmt * usdtRate;
            originalInfoHtml = `<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; margin-top: 1px;">(approx. ${signText}${approxInr.toFixed(2)} INR)</div>`;
        }
        
        return `
            <div class="notify-row" style="padding: 12px; margin-bottom: 10px; border-radius: 10px; background: #FFF; border: 1px solid var(--border-light); box-shadow: 0 2px 6px rgba(0,0,0,0.01); display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center; font-size: 1rem;">
                        ${iconChar}
                    </div>
                    <div style="text-align: left;">
                        <h4 style="margin: 0; font-size: 0.85rem; color: var(--text-primary); font-weight: 700;">${desc}</h4>
                        <span style="font-size: 0.65rem; color: var(--text-secondary);">${dateStr}</span>
                        <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 3px;">${t('fund_lbl_id')}: <span style="font-family: monospace;">${l.id}</span></div>
                    </div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                    <span class="${amtClass}" style="font-weight: 800; font-size: 0.95rem;">${signText}${parseFloat(l.changeAmount).toFixed(2)} ${symbol}</span>
                    ${originalInfoHtml}
                    <span style="font-size: 0.68rem; color: var(--text-secondary); white-space: nowrap; margin-top: 2px;">${t('fund_lbl_bal')}: <b>${parseFloat(l.totalAfter).toFixed(2)}</b> ${symbol}</span>
                </div>
            </div>
        `;
    }).join('');
}

function updateTotalValDisplay() {
    const totalVal = window.cachedTotalVal || 0.00;
    const userUsdtBalance = window.cachedUserUsdtBalance || 0.00;
    
    const elHomeLabel = document.getElementById('profile-total-label');
    const elHomeVal = document.getElementById('profile-total-valuation');
    const elHomeSub = document.getElementById('profile-total-valuation-sub');
    
    const elAvailVal = document.getElementById('profile-available-valuation');
    const elAvailSub = document.getElementById('profile-available-valuation-sub');
    
    const elTotalSymbol = document.getElementById('card-total-symbol');
    const elAvailSymbol = document.getElementById('card-avail-symbol');
    
    const currencySymbol = assetDisplayCurrency === 'INR' ? '₹' : '$';
    if (elTotalSymbol) elTotalSymbol.innerText = currencySymbol;
    if (elAvailSymbol) elAvailSymbol.innerText = currencySymbol;
    
    const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']);
    
    if (assetDisplayCurrency === 'INR') {
        if (!usdtRate) {
            if (elHomeLabel) elHomeLabel.innerText = currentLocale === 'hi' ? 'कुल संपत्ति (INR)' : 'Total Assets (INR)';
            if (isAssetValueVisible) {
                if (elHomeVal) elHomeVal.innerText = '...';
                if (elHomeSub) elHomeSub.innerText = `≈ ${totalVal.toFixed(2)} USDT`;
                if (elAvailVal) elAvailVal.innerText = '...';
                if (elAvailSub) elAvailSub.innerText = `≈ ${userUsdtBalance.toFixed(2)} USDT`;
            } else {
                if (elHomeVal) elHomeVal.innerText = '****';
                if (elHomeSub) elHomeSub.innerText = '≈ **** USDT';
                if (elAvailVal) elAvailVal.innerText = '****';
                if (elAvailSub) elAvailSub.innerText = '≈ **** USDT';
            }
            if (window.syncExchangeRates) {
                window.syncExchangeRates().then(() => updateTotalValDisplay());
            }
        } else {
            const inrVal = totalVal * usdtRate;
            const inrSub = totalVal;
            
            if (elHomeLabel) elHomeLabel.innerText = currentLocale === 'hi' ? 'कुल संपत्ति (INR)' : 'Total Assets (INR)';
            if (isAssetValueVisible) {
                if (elHomeVal) elHomeVal.innerText = inrVal.toFixed(2);
                if (elHomeSub) elHomeSub.innerText = `≈ ${inrSub.toFixed(2)} USDT`;
                if (elAvailVal) elAvailVal.innerText = (userUsdtBalance * usdtRate).toFixed(2);
                if (elAvailSub) elAvailSub.innerText = `≈ ${userUsdtBalance.toFixed(2)} USDT`;
            } else {
                if (elHomeVal) elHomeVal.innerText = '****';
                if (elHomeSub) elHomeSub.innerText = '≈ **** USDT';
                if (elAvailVal) elAvailVal.innerText = '****';
                if (elAvailSub) elAvailSub.innerText = '≈ **** USDT';
            }
        }
    } else {
        const usdtVal = totalVal;
        const usdtSub = usdtRate ? totalVal * usdtRate : null;
        
        if (elHomeLabel) elHomeLabel.innerText = currentLocale === 'hi' ? 'कुल संपत्ति (USDT)' : 'Total Assets (USDT)';
        if (isAssetValueVisible) {
            if (elHomeVal) elHomeVal.innerText = usdtVal.toFixed(2);
            if (elHomeSub) elHomeSub.innerText = usdtSub !== null ? `≈ ${usdtSub.toFixed(2)} INR` : `≈ ... INR`;
            if (elAvailVal) elAvailVal.innerText = userUsdtBalance.toFixed(2);
            if (elAvailSub) elAvailSub.innerText = usdtRate ? `≈ ${(userUsdtBalance * usdtRate).toFixed(2)} INR` : `≈ ... INR`;
        } else {
            if (elHomeVal) elHomeVal.innerText = '****';
            if (elHomeSub) elHomeSub.innerText = '≈ **** INR';
            if (elAvailVal) elAvailVal.innerText = '****';
            if (elAvailSub) elAvailSub.innerText = '≈ **** INR';
        }
        if (!usdtRate && window.syncExchangeRates) {
            window.syncExchangeRates().then(() => updateTotalValDisplay());
        }
    }
    
    // Also update all instances of #profile-total-valuation just in case
    const elProf = document.querySelectorAll('#profile-total-valuation');
    elProf.forEach(el => {
        if (el !== elHomeVal) {
            if (isAssetValueVisible) {
                if (assetDisplayCurrency === 'INR') {
                    el.innerText = usdtRate ? (totalVal * usdtRate).toFixed(2) : '...';
                } else {
                    el.innerText = totalVal.toFixed(2);
                }
            } else {
                el.innerText = '****';
            }
        }
    });
    
    // Update all instances of #profile-available-valuation just in case
    const elAvails = document.querySelectorAll('#profile-available-valuation');
    elAvails.forEach(el => {
        if (el !== elAvailVal) {
            if (isAssetValueVisible) {
                if (assetDisplayCurrency === 'INR') {
                    el.innerText = usdtRate ? (userUsdtBalance * usdtRate).toFixed(2) : '...';
                } else {
                    el.innerText = userUsdtBalance.toFixed(2);
                }
            } else {
                el.innerText = '****';
            }
        }
    });
    
    const elDrawer = document.getElementById('drawer-user-balance');
    if (elDrawer) {
        if (isAssetValueVisible) {
            elDrawer.innerText = userUsdtBalance.toFixed(2) + ' USDT';
        } else {
            elDrawer.innerText = '**** USDT';
        }
    }
    
    if (window.updateEyeIcons) {
        window.updateEyeIcons();
    }
}

function updateQuantOrdersDisplay() {
    const investSum = window.cachedInvestSum || 0.00;
    const profitSum = window.cachedProfitSum || 0.00;
    
    const elInvestLabel = document.getElementById('asset-total-invest-label');
    const elInvestVal = document.getElementById('asset-total-invest');
    const elInvestSub = document.getElementById('asset-total-invest-sub');
    
    const elProfitLabel = document.getElementById('asset-total-profit-label');
    const elProfitVal = document.getElementById('asset-total-profit');
    const elProfitSub = document.getElementById('asset-total-profit-sub');
    
    const profitSign = profitSum >= 0 ? '+' : '';
    const profitClass = profitSum >= 0 ? 'inner-val-profit green' : 'inner-val-profit red';
    
    const usdtRate = (state.PLATFORM_EXCHANGE_RATES && state.PLATFORM_EXCHANGE_RATES['USDT']);
    
    if (assetDisplayCurrency === 'INR') {
        if (!usdtRate) {
            if (elInvestLabel) elInvestLabel.innerText = currentLocale === 'hi' ? 'कुल निवेश राशि (INR)' : 'Total Invested (INR)';
            if (elInvestVal) elInvestVal.innerText = '...';
            if (elInvestSub) elInvestSub.innerText = `≈ ${investSum.toFixed(2)} USDT`;
            
            if (elProfitLabel) elProfitLabel.innerText = currentLocale === 'hi' ? 'कुल लाभ (INR)' : 'Total Earnings (INR)';
            if (elProfitVal) {
                elProfitVal.innerText = '...';
                elProfitVal.className = profitClass;
            }
            if (elProfitSub) elProfitSub.innerText = `≈ ${profitSign}${profitSum.toFixed(2)} USDT`;
            
            if (window.syncExchangeRates) {
                window.syncExchangeRates().then(() => updateQuantOrdersDisplay());
            }
            return;
        }
        const investInr = investSum * usdtRate;
        const profitInr = profitSum * usdtRate;
        
        if (elInvestLabel) elInvestLabel.innerText = currentLocale === 'hi' ? 'कुल निवेश राशि (INR)' : 'Total Invested (INR)';
        if (elInvestVal) elInvestVal.innerText = investInr.toFixed(2);
        if (elInvestSub) elInvestSub.innerText = `≈ ${investSum.toFixed(2)} USDT`;
        
        if (elProfitLabel) elProfitLabel.innerText = currentLocale === 'hi' ? 'कुल लाभ (INR)' : 'Total Earnings (INR)';
        if (elProfitVal) {
            elProfitVal.innerText = `${profitSign}${profitInr.toFixed(2)}`;
            elProfitVal.className = profitClass;
        }
        if (elProfitSub) elProfitSub.innerText = `≈ ${profitSign}${profitSum.toFixed(2)} USDT`;
    } else {
        if (elInvestLabel) elInvestLabel.innerText = currentLocale === 'hi' ? 'कुल निवेश राशि (USDT)' : 'Total Invested (USDT)';
        if (elInvestVal) elInvestVal.innerText = investSum.toFixed(2);
        if (elInvestSub) elInvestSub.innerText = usdtRate ? `≈ ${(investSum * usdtRate).toFixed(2)} INR` : `≈ ... INR`;
        
        if (elProfitLabel) elProfitLabel.innerText = currentLocale === 'hi' ? 'कुल लाभ (USDT)' : 'Total Earnings (USDT)';
        if (elProfitVal) {
            elProfitVal.innerText = `${profitSign}$${profitSum.toFixed(2)}`;
            elProfitVal.className = profitClass;
        }
        if (elProfitSub) elProfitSub.innerText = usdtRate ? `≈ ${profitSign}${(profitSum * usdtRate).toFixed(2)} INR` : `≈ ${profitSign}... INR`;
        
        if (!usdtRate && window.syncExchangeRates) {
            window.syncExchangeRates().then(() => updateQuantOrdersDisplay());
        }
    }
}

function toggleAssetCurrencyDisplay() {
    assetDisplayCurrency = assetDisplayCurrency === 'USDT' ? 'INR' : 'USDT';
    localStorage.setItem('matp_asset_display_currency', assetDisplayCurrency);
    
    showToast(`${t('currency_switch_success')}${assetDisplayCurrency === 'USDT' ? t('currency_usdt_desc') : t('currency_inr_desc')}`, false);
    
    // Refresh both displays instantly
    updateTotalValDisplay();
    updateQuantOrdersDisplay();
    if (window.renderPortfolioOrdersList) {
        window.renderPortfolioOrdersList();
    }
}

function toggleAssetVisibility(event) {
    if (event) event.stopPropagation();
    isAssetValueVisible = !isAssetValueVisible;
    localStorage.setItem('matp_asset_value_visible', isAssetValueVisible);
    
    updateTotalValDisplay();
}

function parseWithdrawTarget(snapshot) {
    if (!snapshot) return '--';
    try {
        const obj = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
        if (obj.upi) return `UPI: ${obj.upi}`;
        if (obj.bankName) return `${obj.bankName} (${obj.accountNumber ? obj.accountNumber.substring(Math.max(0, obj.accountNumber.length - 4)) : ''})`;
        if (obj.address) return `TRC20: ${obj.address.substring(0, 6)}...${obj.address.substring(Math.max(0, obj.address.length - 4))}`;
        return obj.address || obj.accountNumber || obj.upi || '--';
    } catch(e) {
        return snapshot;
    }
}

// --- GLOBAL WINDOW BINDINGS ---
window.loadUserAssets = loadUserAssets;
window.loadQuantOrders = loadQuantOrders;
window.filterAssetOrdersTab = filterAssetOrdersTab;
window.openTxRecordsModal = openTxRecordsModal;
window.closeTxRecordsModal = closeTxRecordsModal;
window.renderTxRecordsItems = renderTxRecordsItems;
window.filterTxRecords = filterTxRecords;
window.openFundDetailsModal = openFundDetailsModal;
window.closeFundDetailsModal = closeFundDetailsModal;
window.renderFundDetailsItems = renderFundDetailsItems;
window.filterFundDetails = filterFundDetails;
window.updateTotalValDisplay = updateTotalValDisplay;
window.updateQuantOrdersDisplay = updateQuantOrdersDisplay;
window.toggleAssetCurrencyDisplay = toggleAssetCurrencyDisplay;
window.toggleAssetVisibility = toggleAssetVisibility;
