export // --- TENANT SYSTEM SETTINGS SECTION ---
let cachedTenantSettings = [];
let activeTenantId = '';

async function loadTenantSettings() {
    const form = document.getElementById('tenant-settings-form');
    const loader = document.getElementById('tenant-settings-loader');
    if (!form || !loader) return;

    form.style.display = 'none';
    loader.style.display = 'block';
    loader.innerHTML = `ðŸ”„ æ­£åœ¨è½½å…¥å¹³å°ç§Ÿæˆ·è®¾ç½®å‚æ•°...`;

    try {
        // 1. Fetch tenants list
        const tenantsRes = await apiFetch('GET', '/tenants', null, true);
        if (!tenantsRes || tenantsRes.code !== 200 || !tenantsRes.data || tenantsRes.data.length === 0) {
            showToast('èŽ·å–ç§Ÿæˆ·åˆ—è¡¨å¤±è´¥ï¼', true);
            loader.innerText = 'âš ï¸ èŽ·å–ç§Ÿæˆ·åˆ—è¡¨å¤±è´¥ï¼Œè¯·é‡è¯•';
            return;
        }

        activeTenantId = tenantsRes.data[0].id;
        document.getElementById('setting-tenant-id').innerText = activeTenantId;

        // 2. Fetch tenant settings
        const settingsRes = await apiFetch('GET', `/tenants/${activeTenantId}/settings`, null, true);
        if (!settingsRes || settingsRes.code !== 200 || !settingsRes.data) {
            showToast('èŽ·å–ç§Ÿæˆ·è®¾ç½®å¤±è´¥ï¼', true);
            loader.innerText = 'âš ï¸ èŽ·å–ç§Ÿæˆ·è®¾ç½®æ•°æ®å¤±è´¥ï¼Œè¯·é‡è¯•';
            return;
        }

        cachedTenantSettings = settingsRes.data;

        // 3. Map keys to form input fields
        const keyMap = {
            'finance.withdraw.untraded_deposit_fee_rate': 'input-untraded-deposit-fee-rate',
            'finance.withdraw.untraded_fee_rate': 'input-untraded-fee-rate',
            'finance.withdraw.min_amount': 'input-withdraw-min-amount',
            'finance.withdraw.max_amount': 'input-withdraw-max-amount',
            'otp.code_validity': 'input-otp-validity',
            'otp.daily_limit': 'input-otp-daily-limit',
            'otp.interval': 'input-otp-interval',
            'otp.max_retries': 'input-otp-max-retries',
            'commons.phone_regex': 'input-commons-phone-regex',
            'quant.min_invest_amount': 'input-quant-min-invest',
            'quant.max_invest_amount': 'input-quant-max-invest',
            'quant.brokerage.rate': 'input-quant-brokerage-rate',
            'quant.brokerage.min_amount': 'input-quant-brokerage-min',
            'quant.brokerage.max_amount': 'input-quant-brokerage-max',
            'quant.ai_computing_cost.rate': 'input-quant-computing-rate',
            'quant.ai_computing_cost.min_amount': 'input-quant-computing-min',
            'quant.ai_computing_cost.max_amount': 'input-quant-computing-max',
            'quant.exchange_fee.rate': 'input-quant-exchange-rate',
            'quant.exchange_fee.min_amount': 'input-quant-exchange-min',
            'quant.exchange_fee.max_amount': 'input-quant-exchange-max',
            'quant.commission_rate': 'input-quant-commission-rate',
            'quant.backtest_data': 'input-quant-backtest-data'
        };

        // Pre-populate input values
        for (const [key, inputId] of Object.entries(keyMap)) {
            const setting = cachedTenantSettings.find(s => s.key === key);
            const inputEl = document.getElementById(inputId);
            if (inputEl) {
                if (setting) {
                    inputEl.value = setting.value;
                } else {
                    inputEl.value = '';
                }
            }
        }

        // Cookie helpers for cross-subdomain sharing
        function getCookieDomain() {
            const host = window.location.hostname;
            const parts = host.split('.');
            if (parts.length >= 2) {
                if (host === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
                    return '';
                }
                return '.' + parts.slice(-2).join('.');
            }
            return '';
        }
        function getSharedCookie(name) {
            const matches = document.cookie.match(new RegExp(
                "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
            ));
            return matches ? decodeURIComponent(matches[1]) : '';
        }

        // Populate local app download links
        const androidInput = document.getElementById('input-app-download-android');
        const iosInput = document.getElementById('input-app-download-ios');
        if (androidInput) {
            androidInput.value = getSharedCookie('app_download_android') || localStorage.getItem('app_download_android') || '';
        }
        if (iosInput) {
            iosInput.value = getSharedCookie('app_download_ios') || localStorage.getItem('app_download_ios') || '';
        }

        loader.style.display = 'none';
        form.style.display = 'flex';

    } catch (e) {
        console.error('Failed to load tenant settings:', e);
        showToast('ç½‘ç»œè¯·æ±‚å¼‚å¸¸ï¼Œæ— æ³•åŠ è½½ç§Ÿæˆ·è®¾ç½®ï¼', true);
        loader.innerText = 'âš ï¸ ç½‘ç»œè¿žæŽ¥å¼‚å¸¸ï¼Œè¯·åˆ·æ–°é¡µé¢é‡è¯•';
    }
}

async function submitTenantSettings(event) {
    if (event) event.preventDefault();

    if (!activeTenantId || cachedTenantSettings.length === 0) {
        showToast('æœªæ‰¾åˆ°æœ‰æ•ˆç§Ÿæˆ·ä¿¡æ¯ï¼Œæ— æ³•ä¿å­˜ï¼', true);
        return;
    }

    // Cookie helper functions for saving
    function getCookieDomain() {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length >= 2) {
            if (host === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
                return '';
            }
            return '.' + parts.slice(-2).join('.');
        }
        return '';
    }
    function setSharedCookie(name, value) {
        const domain = getCookieDomain();
        const domainStr = domain ? `; domain=${domain}` : '';
        document.cookie = `${name}=${encodeURIComponent(value)}; path=/${domainStr}; max-age=${365 * 24 * 60 * 60}`;
    }

    // Save local app download links
    let localChanged = false;
    const androidInput = document.getElementById('input-app-download-android');
    const iosInput = document.getElementById('input-app-download-ios');
    if (androidInput) {
        const val = androidInput.value.trim();
        const oldVal = localStorage.getItem('app_download_android') || '';
        if (val !== oldVal) {
            localStorage.setItem('app_download_android', val);
            setSharedCookie('app_download_android', val);
            localChanged = true;
        }
    }
    if (iosInput) {
        const val = iosInput.value.trim();
        const oldVal = localStorage.getItem('app_download_ios') || '';
        if (val !== oldVal) {
            localStorage.setItem('app_download_ios', val);
            setSharedCookie('app_download_ios', val);
            localChanged = true;
        }
    }

    const keyMap = {
        'finance.withdraw.untraded_deposit_fee_rate': 'input-untraded-deposit-fee-rate',
        'finance.withdraw.untraded_fee_rate': 'input-untraded-fee-rate',
        'finance.withdraw.min_amount': 'input-withdraw-min-amount',
        'finance.withdraw.max_amount': 'input-withdraw-max-amount',
        'otp.code_validity': 'input-otp-validity',
        'otp.daily_limit': 'input-otp-daily-limit',
        'otp.interval': 'input-otp-interval',
        'otp.max_retries': 'input-otp-max-retries',
        'commons.phone_regex': 'input-commons-phone-regex',
        'quant.min_invest_amount': 'input-quant-min-invest',
        'quant.max_invest_amount': 'input-quant-max-invest',
        'quant.brokerage.rate': 'input-quant-brokerage-rate',
        'quant.brokerage.min_amount': 'input-quant-brokerage-min',
        'quant.brokerage.max_amount': 'input-quant-brokerage-max',
        'quant.ai_computing_cost.rate': 'input-quant-computing-rate',
        'quant.ai_computing_cost.min_amount': 'input-quant-computing-min',
        'quant.ai_computing_cost.max_amount': 'input-quant-computing-max',
        'quant.exchange_fee.rate': 'input-quant-exchange-rate',
        'quant.exchange_fee.min_amount': 'input-quant-exchange-min',
        'quant.exchange_fee.max_amount': 'input-quant-exchange-max',
        'quant.commission_rate': 'input-quant-commission-rate',
        'quant.backtest_data': 'input-quant-backtest-data'
    };

    showToast('æ­£åœ¨å®‰å…¨æäº¤å¹¶ä¿å­˜è®¾ç½®å‚æ•°...', false);

    try {
        const updatedSettings = [];
        const skippedKeys = [];

        for (const [key, inputId] of Object.entries(keyMap)) {
            const inputEl = document.getElementById(inputId);
            if (!inputEl) continue;

            let setting = cachedTenantSettings.find(s => s.key === key);
            const newValue = inputEl.value.trim();

            if (setting) {
                // ä»…åœ¨å€¼å‘ç”Ÿå®žé™…å˜åŒ–æ—¶æäº¤ï¼Œé™ä½Žè¯·æ±‚è·è½½å¹¶é¿å…ä¸å¿…è¦çš„æœåŠ¡ç«¯é‡ç½®
                if (String(setting.value).trim() !== newValue) {
                    const updatedObj = { ...setting, value: newValue };
                    updatedSettings.push(updatedObj);
                }
            } else {
                // å¦‚æžœåŽç«¯åˆå§‹é…ç½®åˆ—è¡¨é‡Œä¸å­˜åœ¨æ­¤ keyï¼Œè¯´æ˜Žå½“å‰ç³»ç»ŸåŽç«¯ç‰ˆæœ¬å°šæœªå®šä¹‰/ä¸æ”¯æŒè¯¥å‚æ•°ã€‚
                // å¼ºè¡Œæäº¤ä¼šè§¦å‘åŽç«¯çš„ 'unsupported sys setting key' (11001003) æ ¡éªŒé”™è¯¯ã€‚
                // é‡‡å–ç™½åå•é˜²å¾¡è¿‡æ»¤ï¼Œå¹¶æ‰“å°è­¦å‘Šï¼Œè®©æ”¯æŒçš„å‚æ•°èƒ½å¤Ÿé¡ºåˆ©ä¿å­˜ã€‚
                skippedKeys.push(key);
                console.warn(`[Tenant Settings] Key "${key}" (Element #${inputId}) is not defined/supported by the backend, skipped to prevent upsert failure.`);
            }
        }

        // å¦‚æžœæ²¡æœ‰æœ‰æ•ˆä¿®æ”¹
        if (updatedSettings.length === 0) {
            if (localChanged) {
                showToast('âœ“ ç§Ÿæˆ·ç³»ç»Ÿè®¾ç½®ä¿å­˜æˆåŠŸï¼', false);
            } else {
                if (skippedKeys.length > 0) {
                    showToast(`âš ï¸ ä¿å­˜è·³è¿‡ (ä¸æ”¯æŒçš„é”®: ${skippedKeys.join(', ')})ï¼Œæ— å…¶ä»–æœ‰æ•ˆå‚æ•°ä¿®æ”¹ã€‚`, true);
                } else {
                    showToast('âœ“ æœªæ£€æµ‹åˆ°ä»»ä½•é…ç½®å‚æ•°ä¿®æ”¹ï¼Œæ— éœ€ä¿å­˜ã€‚', false);
                }
            }
            return;
        }

        // å‘é€ batch-upsert
        const res = await apiFetch('POST', `/tenants/${activeTenantId}/settings/batch-upsert`, { items: updatedSettings }, true);
        
        if (res && res.code === 200) {
            let successMsg = 'âœ“ ç§Ÿæˆ·ç³»ç»Ÿè®¾ç½®ä¿å­˜æˆåŠŸï¼Œé…ç½®å·²å®žæ—¶ç”Ÿæ•ˆï¼';
            if (skippedKeys.length > 0) {
                successMsg += ` (å·²å¿½ç•¥ä¸æ”¯æŒçš„é”®: ${skippedKeys.join(', ')})`;
            }
            showToast(successMsg, false);
            loadTenantSettings();
        } else {
            console.error('Failed to batch upsert tenant settings:', res);
            showToast(res ? res.errorMessage || 'ä¿å­˜ç§Ÿæˆ·é…ç½®å¤±è´¥ï¼Œè¯·æ£€æŸ¥æŽ§åˆ¶å°é”™è¯¯ï¼' : 'ä¿å­˜ç§Ÿæˆ·é…ç½®å¤±è´¥ï¼', true);
        }

    } catch (e) {
        console.error('Failed to batch upsert tenant settings:', e);
        showToast('ä¿å­˜ç§Ÿæˆ·è®¾ç½®æ—¶å‘ç”Ÿç½‘ç»œå¼‚å¸¸ï¼', true);
    }
}

window.loadTenantSettings = loadTenantSettings;
window.submitTenantSettings = submitTenantSettings;

function copyToClipboard(text, msg = 'å·²å¤åˆ¶åˆ°å‰ªè´´æ¿') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`âœ“ ${msg}`);
    }).catch(err => {
        console.error('Failed to copy:', err);
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast(`âœ“ ${msg}`);
    });
}
window.copyToClipboard = copyToClipboard;


let cachedDailyReportData = [];

export async function loadDailyReport() {
    if (!currentAdmin) return;
    
    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput && endInput && (!startInput.value || !endInput.value)) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        startInput.value = `${year}-${month}-01`;
        endInput.value = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }
    
    showToast('\u6b63\u5728\u5b9e\u65f6\u540c\u6b65\u5e76\u591a\u7ef4\u5ea6\u8ba1\u7b97\u8fd0\u8425\u6570\u636e\u65e5\u62a5\u5386\u53f2\u8bb0\u5f55...', false);
    
    try {
        const [rawUsers, depositsRes, withdrawalsRes, ordersRes, rateRes, recRes] = await Promise.all([
            window.adminState.getUsers(),
            apiFetch('GET', '/finance/deposits?page=1&pageSize=5000', null, true),
            apiFetch('GET', '/finance/withdrawals?page=1&pageSize=5000', null, true),
            apiFetch('GET', '/trading/quant/orders', null, true),
            apiFetch('GET', '/asset-exchange-rates?baseAssetId=1183348576672026624&quoteAssetId=1126151490264633456', null, true),
            apiFetch('GET', '/instruments/recommended', null, true)
        ]);
        const usersRes = { code: 200, result: rawUsers };
        
        if (!rawUsers || depositsRes.code !== 200 || withdrawalsRes.code !== 200 || ordersRes.code !== 200) {
            showToast('\u26a0\ufe0f \u90e8\u5206\u65e5\u62a5\u6570\u636e\u6e90\u62c9\u53d6\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\uff01', true);
            return;
        }
        
        let exchangeRate = 1.0;
        let btcPrice = 1.0;
        let ethPrice = 1.0;
        
        if (rateRes && rateRes.code === 200) {
            const list = rateRes.result || rateRes.data || [];
            const activeRate = list.find(r => r.enabled);
            if (activeRate) {
                exchangeRate = parseFloat(activeRate.rate) || 1.0;
            }
        }
        if (recRes && recRes.code === 200) {
            const list = recRes.result || recRes.data || [];
            const btc = list.find(i => i.symbol.toUpperCase() === 'BTCUSDT');
            if (btc) btcPrice = parseFloat(btc.ticker?.closePrice || btc.ticker?.lastPrice || btc.price || 0.0) || 1.0;
            const eth = list.find(i => i.symbol.toUpperCase() === 'ETHUSDT');
            if (eth) ethPrice = parseFloat(eth.ticker?.closePrice || eth.ticker?.lastPrice || eth.price || 0.0) || 1.0;
        }

        const users = usersRes.result || usersRes.data || [];
        const deposits = depositsRes.result || depositsRes.data || [];
        const withdrawals = withdrawalsRes.result || withdrawalsRes.data || [];
        const orders = ordersRes.result || ordersRes.data || [];
        
        // 1. Calculate current asset statistics for the backward balance projections
        let currentTotalBalance = 0;
        let currentFrozenBalance = 0;
        
        users.forEach(u => {
            if (u.balances) {
                u.balances.forEach(b => {
                    const total = parseFloat(b.total || 0);
                    const frozen = parseFloat(b.frozen || 0);
                    
                    let rate = 1.0;
                    const isUsdt = (b.asset && b.asset.symbol === 'USDT') || String(b.assetId) === '1183348576672026624';
                    const isBtc = (b.asset && b.asset.symbol === 'BTC') || String(b.assetId) === '1183348576642666496';
                    const isEth = (b.asset && b.asset.symbol === 'ETH') || String(b.assetId) === '1183348576630083584';
                    
                    if (isUsdt) {
                        currentTotalBalance += total;
                        currentFrozenBalance += frozen;
                    } else if (isBtc) {
                        rate = btcPrice;
                        currentTotalBalance += total * rate;
                        currentFrozenBalance += frozen * rate;
                    } else if (isEth) {
                        rate = ethPrice;
                        currentTotalBalance += total * rate;
                        currentFrozenBalance += frozen * rate;
                    } else {
                        currentTotalBalance += total * rate;
                        currentFrozenBalance += frozen * rate;
                    }
                });
            }
        });
        
        // 2. Pre-process dates and group datasets by day string
        const getDayString = (ms) => {
            const dt = new Date(parseInt(ms));
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };
        
        const rate = exchangeRate;
        const getWithdrawUsdtAmount = (w) => {
            const isNewRecord = w.createdAt && parseInt(w.createdAt) > 1779700000000;
            return isNewRecord ? (parseFloat(w.amount || 0) / rate) : parseFloat(w.amount || 0);
        };
        
        // Map all transactions and logins by day
        const depositsByDay = {};
        deposits.forEach(d => {
            const isSuccess = d.status === 'CREDITED' || d.status === 'APPROVED' || d.status === 'SUCCESS' || d.status === 'COMPLETED';
            if (isSuccess && d.createdAt) {
                const dayStr = getDayString(d.createdAt);
                if (!depositsByDay[dayStr]) depositsByDay[dayStr] = [];
                depositsByDay[dayStr].push(d);
            }
        });
        
        const withdrawalsByDay = {};
        withdrawals.forEach(w => {
            const isSuccess = w.status === 'COMPLETED' || w.status === 'SUCCESS';
            if (isSuccess && w.createdAt) {
                const dayStr = getDayString(w.createdAt);
                if (!withdrawalsByDay[dayStr]) withdrawalsByDay[dayStr] = [];
                withdrawalsByDay[dayStr].push(w);
            }
        });
        
        const usersByDay = {};
        users.forEach(u => {
            if (u.createdAt) {
                const dayStr = getDayString(u.createdAt);
                if (!usersByDay[dayStr]) usersByDay[dayStr] = [];
                usersByDay[dayStr].push(u);
            }
        });
        
        const profitsByDay = {};
        orders.forEach(o => {
            if (o.status === 'COMPLETED' && o.updatedAt) {
                const dayStr = getDayString(o.updatedAt);
                if (!profitsByDay[dayStr]) profitsByDay[dayStr] = 0;
                profitsByDay[dayStr] += parseFloat(o.actualProfit || 0);
            }
        });
        
        // Find each user's absolute first deposit and first withdrawal date
        const userFirstDeposit = {};
        deposits.forEach(d => {
            const isSuccess = d.status === 'CREDITED' || d.status === 'APPROVED' || d.status === 'SUCCESS' || d.status === 'COMPLETED';
            if (isSuccess && d.createdAt) {
                const uId = String(d.userId);
                const time = parseInt(d.createdAt);
                if (!userFirstDeposit[uId] || time < userFirstDeposit[uId].createdAt) {
                    userFirstDeposit[uId] = d;
                }
            }
        });
        
        const userFirstWithdraw = {};
        withdrawals.forEach(w => {
            const isSuccess = w.status === 'COMPLETED' || w.status === 'SUCCESS';
            if (isSuccess && w.createdAt) {
                const uId = String(w.userId);
                const time = parseInt(w.createdAt);
                if (!userFirstWithdraw[uId] || time < userFirstWithdraw[uId].createdAt) {
                    userFirstWithdraw[uId] = w;
                }
            }
        });
        
        // 3. Generate date range in descending order
        const startStr = startInput.value;
        const endStr = endInput.value;
        const startDate = new Date(startStr + 'T00:00:00');
        const endDate = new Date(endStr + 'T23:59:59');
        
        const dateList = [];
        let curr = new Date(startDate.getTime());
        const todayLimit = new Date();
        todayLimit.setHours(23, 59, 59, 999);
        const limitDate = endDate < todayLimit ? endDate : todayLimit;
        
        while (curr <= limitDate) {
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            const d = String(curr.getDate()).padStart(2, '0');
            dateList.push(`${y}-${m}-${d}`);
            curr.setDate(curr.getDate() + 1);
        }
        
        // 4. Generate all daily timelines starting from today backwards to cover backwards projections
        const timelineDays = [];
        let tCurr = new Date();
        const minDateMs = startDate.getTime();
        while (tCurr.getTime() >= minDateMs - 86400000 * 5) {
            const y = tCurr.getFullYear();
            const m = String(tCurr.getMonth() + 1).padStart(2, '0');
            const d = String(tCurr.getDate()).padStart(2, '0');
            timelineDays.push(`${y}-${m}-${d}`);
            tCurr.setDate(tCurr.getDate() - 1);
        }
        
        const timelineBalances = {};
        let runningTotal = currentTotalBalance;
        
        timelineDays.forEach(day => {
            timelineBalances[day] = runningTotal;
            
            // netChange = deposit - withdraw + profit
            const dayDepList = depositsByDay[day] || [];
            const depSum = dayDepList.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
            
            const dayWdList = withdrawalsByDay[day] || [];
            const wdSum = dayWdList.reduce((sum, w) => sum + getWithdrawUsdtAmount(w), 0);
            
            const profitSum = profitsByDay[day] || 0;
            const netChange = depSum - wdSum + profitSum;
            runningTotal -= netChange;
            if (runningTotal < 0) runningTotal = 0;
        });
        
        // 5. Aggregate all metrics for the requested dates
        cachedDailyReportData = dateList.map(day => {
            const totalBalance = timelineBalances[day] !== undefined ? timelineBalances[day] : runningTotal;
            
            // Project sub-categories proportionally
            const ratio = currentTotalBalance > 0 ? (totalBalance / currentTotalBalance) : 0;
            const frozenBalance = currentFrozenBalance * ratio;
            
            // Calculate active wealth balance (active quant strategy assets)
            const dayEndMs = new Date(day + 'T23:59:59').getTime();
            let wealthBalance = 0;
            orders.forEach(o => {
                const createdMs = parseInt(o.createdAt || 0);
                const isCreatedBefore = createdMs <= dayEndMs;
                if (isCreatedBefore) {
                    if (o.status === 'ACTIVE') {
                        wealthBalance += parseFloat(o.investAmount || 0);
                    } else if (o.status === 'COMPLETED') {
                        const settledMs = parseInt(o.updatedAt || o.createdAt);
                        if (settledMs > dayEndMs) {
                            wealthBalance += parseFloat(o.investAmount || 0);
                        }
                    }
                }
            });
            
            let withdrawableBalance = totalBalance - frozenBalance - wealthBalance;
            if (withdrawableBalance < 0) {
                withdrawableBalance = Math.max(0, totalBalance - frozenBalance);
            }
            
            // Registered count
            const regUsers = usersByDay[day] || [];
            const regCount = regUsers.length;
            
            // Activity count (unique users with logins, deposits, withdrawals, or orders on that day)
            const activeUserIds = new Set();
            regUsers.forEach(u => activeUserIds.add(String(u.id)));
            
            const daySuccessDeposits = depositsByDay[day] || [];
            daySuccessDeposits.forEach(d => activeUserIds.add(String(d.userId)));
            
            const daySuccessWithdrawals = withdrawalsByDay[day] || [];
            daySuccessWithdrawals.forEach(w => activeUserIds.add(String(w.userId)));
            
            // Active orders check
            orders.forEach(o => {
                const createdMs = parseInt(o.createdAt || 0);
                const settledMs = parseInt(o.updatedAt || o.createdAt);
                if (createdMs <= dayEndMs && (o.status === 'ACTIVE' || settledMs > dayEndMs - 86400000)) {
                    activeUserIds.add(String(o.userId));
                }
            });
            
            // Use real-time active user metrics from the database (unique users with logins, deposits, withdrawals, or active orders)
            const activeCount = activeUserIds.size;
            
            // First Deposit calculation
            let firstDepositAmount = 0;
            let firstDepositCount = 0;
            Object.values(userFirstDeposit).forEach(d => {
                if (getDayString(d.createdAt) === day) {
                    firstDepositAmount += parseFloat(d.amount || 0);
                    firstDepositCount++;
                }
            });
            
            // First Withdrawal calculation
            let firstWithdrawAmount = 0;
            let firstWithdrawCount = 0;
            Object.values(userFirstWithdraw).forEach(w => {
                if (getDayString(w.createdAt) === day) {
                    firstWithdrawAmount += getWithdrawUsdtAmount(w);
                    firstWithdrawCount++;
                }
            });
            
            // Standard Deposit metrics
            const depositAmount = daySuccessDeposits.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
            const depositUserCount = new Set(daySuccessDeposits.map(d => String(d.userId))).size;
            const depositTxCount = daySuccessDeposits.length;
            
            // Standard Withdrawal metrics
            const withdrawAmount = daySuccessWithdrawals.reduce((sum, w) => sum + getWithdrawUsdtAmount(w), 0);
            const withdrawUserCount = new Set(daySuccessWithdrawals.map(w => String(w.userId))).size;
            const withdrawTxCount = daySuccessWithdrawals.length;
            
            return {
                date: day,
                totalBalance,
                frozenBalance,
                wealthBalance,
                withdrawableBalance,
                regCount,
                activeCount,
                firstDepositAmount,
                firstDepositCount,
                firstWithdrawAmount,
                firstWithdrawCount,
                depositAmount,
                depositUserCount,
                depositTxCount,
                withdrawAmount,
                withdrawUserCount,
                withdrawTxCount
            };
        });
        
        window.adminPages.dailyReport = window.adminPages.dailyReport || { current: 1, size: 50 };
        window.adminPages.dailyReport.current = 1;
        
        renderDailyReportTable();
        showToast('\u2713 \u4eca\u65e5\u8fd0\u8425\u6570\u636e\u65e5\u62a5\u5386\u53f2\u5df2\u5b9e\u65f6\u6c47\u603b\u5e76\u66f4\u65b0\uff01', false);
    } catch (e) {
        console.error(e);
        showToast('\u274c \u52a0\u8f7d\u65e5\u62a5\u6c47\u603b\u65f6\u53d1\u751f\u7f51\u7edc\u6216\u6570\u636e\u6d41\u89e3\u6790\u5f02\u5e38\uff01', true);
    }
}

function renderDailyReportTable() {
    const tbody = document.getElementById('daily-report-table-body');
    const summaryRow = document.getElementById('daily-report-summary-row');
    if (!tbody || !summaryRow) return;
    
    if (cachedDailyReportData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="17" style="text-align: center; color: var(--text-muted); padding: 40px 0;">\u5f53\u524d\u65e5\u671f\u8303\u56f4\u5185\u6ca1\u6709\u4ea4\u6613\u660e\u7ec6\u6216\u7528\u6237\u6ce8\u518c\u8bb0\u5f55</td></tr>`;
        summaryRow.innerHTML = '';
        const indicator = document.getElementById('daily-report-page-indicator');
        if (indicator) indicator.innerText = '\u7b2c 1 / 1 \u9875';
        const totalCount = document.getElementById('daily-report-total-count');
        if (totalCount) totalCount.innerText = '\u5171 1 \u9875 \u5171 0 \u6761';
        return;
    }
    
    // 1. Render paginated list
    const paginated = paginateList(cachedDailyReportData, 'dailyReport');
    
    tbody.innerHTML = paginated.map(r => {
        return `
            <tr>
                <td style="text-align: center; font-weight: 600;">${r.date}</td>
                <td style="text-align: right; font-family: monospace;">${r.totalBalance.toFixed(2)}</td>
                <td style="text-align: right; font-family: monospace; color: var(--text-secondary);">${r.frozenBalance.toFixed(2)}</td>
                <td style="text-align: right; font-family: monospace; color: var(--orange);">${r.wealthBalance.toFixed(2)}</td>
                <td style="text-align: right; font-family: monospace; color: var(--green); font-weight: 600;">${r.withdrawableBalance.toFixed(2)}</td>
                <td style="text-align: center; font-family: monospace;">${r.regCount}</td>
                <td style="text-align: center; font-family: monospace; font-weight: 500;">${r.activeCount}</td>
                <!-- First deposit -->
                <td style="text-align: right; font-family: monospace; color: var(--green);">${r.firstDepositAmount > 0 ? r.firstDepositAmount.toFixed(2) : '0'}</td>
                <td style="text-align: center; font-family: monospace;">${r.firstDepositCount}</td>
                <!-- First withdrawal -->
                <td style="text-align: right; font-family: monospace; color: var(--red);">${r.firstWithdrawAmount > 0 ? r.firstWithdrawAmount.toFixed(2) : '0'}</td>
                <td style="text-align: center; font-family: monospace;">${r.firstWithdrawCount}</td>
                <!-- Deposit -->
                <td style="text-align: right; font-family: monospace; color: var(--green); font-weight: 600;">${r.depositAmount > 0 ? r.depositAmount.toFixed(2) : '0'}</td>
                <td style="text-align: center; font-family: monospace;">${r.depositUserCount}</td>
                <td style="text-align: center; font-family: monospace;">${r.depositTxCount}</td>
                <!-- Withdrawal -->
                <td style="text-align: right; font-family: monospace; color: var(--red); font-weight: 600;">${r.withdrawAmount > 0 ? r.withdrawAmount.toFixed(2) : '0'}</td>
                <td style="text-align: center; font-family: monospace;">${r.withdrawUserCount}</td>
                <td style="text-align: center; font-family: monospace;">${r.withdrawTxCount}</td>
            </tr>
        `;
    }).join('');
    
    // 2. Render totals row for the entire dataset
    let sumTotalBalance = 0, sumFrozen = 0, sumWealth = 0, sumWithdrawable = 0;
    let sumReg = 0, sumActive = 0, sumFirstDepAmt = 0, sumFirstDepCount = 0, sumFirstWdAmt = 0, sumFirstWdCount = 0;
    let sumDepAmt = 0, sumDepUserCount = 0, sumDepTxCount = 0, sumWdAmt = 0, sumWdUserCount = 0, sumWdTxCount = 0;
    
    cachedDailyReportData.forEach(r => {
        sumTotalBalance += r.totalBalance;
        sumFrozen += r.frozenBalance;
        sumWealth += r.wealthBalance;
        sumWithdrawable += r.withdrawableBalance;
        sumReg += r.regCount;
        sumActive += r.activeCount;
        sumFirstDepAmt += r.firstDepositAmount;
        sumFirstDepCount += r.firstDepositCount;
        sumFirstWdAmt += r.firstWithdrawAmount;
        sumFirstWdCount += r.firstWithdrawCount;
        sumDepAmt += r.depositAmount;
        sumDepUserCount += r.depositUserCount;
        sumDepTxCount += r.depositTxCount;
        sumWdAmt += r.withdrawAmount;
        sumWdUserCount += r.withdrawUserCount;
        sumWdTxCount += r.withdrawTxCount;
    });
    
    summaryRow.innerHTML = `
        <td style="text-align: center; font-weight: 700; color: var(--primary);">\u7edf\u8ba1</td>
        <td style="text-align: right; font-family: monospace; font-weight: 700;">${sumTotalBalance.toFixed(2)}</td>
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: var(--text-secondary);">${sumFrozen.toFixed(2)}</td>
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: var(--orange);">${sumWealth.toFixed(2)}</td>
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: var(--green);">${sumWithdrawable.toFixed(2)}</td>
        <td style="text-align: center; font-family: monospace; font-weight: 700;">${sumReg}</td>
        <td style="text-align: center; font-family: monospace; font-weight: 700;">${sumActive}</td>
        <!-- First deposit -->
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: var(--green);">${sumFirstDepAmt.toFixed(2)}</td>
        <td style="text-align: center; font-family: monospace; font-weight: 700;">${sumFirstDepCount}</td>
        <!-- First withdrawal -->
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: var(--red);">${sumFirstWdAmt.toFixed(2)}</td>
        <td style="text-align: center; font-family: monospace; font-weight: 700;">${sumFirstWdCount}</td>
        <!-- Deposit -->
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: var(--green);">${sumDepAmt.toFixed(2)}</td>
        <td style="text-align: center; font-family: monospace; font-weight: 700;">${sumDepUserCount}</td>
        <td style="text-align: center; font-family: monospace; font-weight: 700;">${sumDepTxCount}</td>
        <!-- Withdrawal -->
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: var(--red);">${sumWdAmt.toFixed(2)}</td>
        <td style="text-align: center; font-family: monospace; font-weight: 700;">${sumWdUserCount}</td>
        <td style="text-align: center; font-family: monospace; font-weight: 700;">${sumWdTxCount}</td>
    `;
    
    // Update pagination bottom details
    const totalItems = cachedDailyReportData.length;
    const pageConf = window.adminPages.dailyReport;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageConf.size));
    
    const indicator = document.getElementById('daily-report-page-indicator');
    if (indicator) {
        indicator.innerText = `\u7b2c ${pageConf.current} / ${totalPages} \u9875`;
    }
    
    const totalCount = document.getElementById('daily-report-total-count');
    if (totalCount) {
        totalCount.innerText = `\u5171 ${totalPages} \u9875 \u5171 ${totalItems} \u6761`;
    }
}

function changeDailyReportPageSize(newSize) {
    window.adminPages.dailyReport.size = parseInt(newSize);
    window.adminPages.dailyReport.current = 1;
    renderDailyReportTable();
}

function changeDailyReportPage(delta) {
    const pageConf = window.adminPages.dailyReport;
    const totalItems = cachedDailyReportData.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageConf.size));
    
    pageConf.current += delta;
    if (pageConf.current > totalPages) pageConf.current = totalPages;
    if (pageConf.current < 1) pageConf.current = 1;
    
    renderDailyReportTable();
}

function exportDailyReport() {
    if (cachedDailyReportData.length === 0) {
        showToast('\u274c \u5f53\u524d\u65e5\u671f\u8303\u56f4\u5185\u6ca1\u6709\u4ea4\u6613\u660e\u7ec6\u6216\u7528\u6237\u6ce8\u518c\u8bb0\u5f55', true);
        return;
    }
    
    const headers = [
        '\u65e5\u671f', '\u603b\u4f59\u989d', '\u51bb\u7ed3', '\u7406\u8d22\u4f59\u989d', '\u53ef\u63d0\u91d1\u989d', '\u6ce8\u518c\u4eba\u6570', '\u6d3b\u8dc3\u4eba\u6570',
        '\u9996\u5145\u91d1\u989d', '\u9996\u5145\u4eba\u6570', '\u9996\u63d0\u91d1\u989d', '\u9996\u63d0\u4eba\u6570',
        '\u5145\u503c\u91d1\u989d', '\u5145\u503c\u4eba\u6570', '\u5145\u503c\u7b14\u6570', '\u63d0\u73b0\u91d1\u989d', '\u63d0\u73b0\u4eba\u6570', '\u63d0\u73b0\u7b14\u6570'
    ];
    
    let csvContent = '\ufeff';
    csvContent += headers.join(',') + '\n';
    
    cachedDailyReportData.forEach(row => {
        const line = [
            row.date,
            row.totalBalance.toFixed(2),
            row.frozenBalance.toFixed(2),
            row.wealthBalance.toFixed(2),
            row.withdrawableBalance.toFixed(2),
            row.regCount,
            row.activeCount,
            row.firstDepositAmount.toFixed(2),
            row.firstDepositCount,
            row.firstWithdrawAmount.toFixed(2),
            row.firstWithdrawCount,
            row.depositAmount.toFixed(2),
            row.depositUserCount,
            row.depositTxCount,
            row.withdrawAmount.toFixed(2),
            row.withdrawUserCount,
            row.withdrawTxCount
        ];
        csvContent += line.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `\u8fd0\u8425\u6570\u636e\u65e5\u62a5_${document.getElementById('report-start-date').value}_${document.getElementById('report-end-date').value}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('\u2713 \u8fd0\u8425\u6570\u636e\u65e5\u62a5\u5df2\u6210\u529f\u5bfc\u51fa CSV \u683c\u5f0f\u62a5\u8868\uff01', false);
}

window.loadDailyReport = loadDailyReport;
window.renderDailyReportTable = renderDailyReportTable;
window.changeDailyReportPageSize = changeDailyReportPageSize;
window.changeDailyReportPage = changeDailyReportPage;
window.exportDailyReport = exportDailyReport;

window.loadDailyReport = loadDailyReport;


export // --- PLATFORM CONTENTS MANAGEMENT ---
let platformContentsList = [];
let docCurrentPage = 1;
const docPageSize = 10;

async function loadPlatformContentsList(page = 1) {
    docCurrentPage = page;
    const tableBody = document.getElementById('platform-contents-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">ðŸ”„ æ­£åœ¨å®‰å…¨è°ƒå–å¹³å°å†…å®¹é¡µåˆ—è¡¨...</td></tr>';
    
    const category = document.getElementById('filter-doc-category').value;
    const lang = document.getElementById('filter-doc-lang').value;
    const keyword = document.getElementById('search-doc-keyword').value;
    
    let path = `/platform-contents?page=${page}&pageSize=${docPageSize}`;
    if (category) path += `&category=${category}`;
    if (lang) path += `&localeTag=${lang}`;
    if (keyword) path += `&keyword=${encodeURIComponent(keyword)}`;
    
    try {
        const res = await apiFetch('GET', path, null, true);
        const dataList = res.result || res.data;
        if (res.code === 200 && dataList) {
            platformContentsList = dataList;
            const paging = res.paging || { page: page, pages: 1, pageSize: docPageSize, records: dataList.length };
            const totalCount = paging.records !== undefined ? paging.records : dataList.length;
            const totalPages = paging.pages !== undefined ? paging.pages : Math.max(1, Math.ceil(totalCount / docPageSize));
            
            document.getElementById('doc-total-count').innerText = totalCount;
            document.getElementById('doc-current-page').innerText = page;
            document.getElementById('doc-total-pages').innerText = totalPages;
            
            // Enable/disable page buttons
            document.getElementById('btn-doc-prev').disabled = (page <= 1);
            document.getElementById('btn-doc-next').disabled = (page >= totalPages || dataList.length < docPageSize);
            
            if (dataList.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">ðŸ“­ æš‚æ— åŒ¹é…çš„å¹³å°æ–‡æ¡£å†…å®¹è®°å½•</td></tr>';
                return;
            }
            
            let html = '';
            dataList.forEach(doc => {
                const categoryText = doc.category === 'AGREEMENT' ? 'åè®®æ¡æ¬¾' : (doc.category === 'HELP' ? 'å¸®åŠ©ä¸­å¿ƒ' : 'æ“ä½œæç¤º');
                const statusBadge = doc.enabled 
                    ? '<span class="badge badge-VERIFIED" style="background: rgba(16,185,129,0.1); color: #10B981;">å·²å¯ç”¨</span>'
                    : '<span class="badge badge-REJECTED" style="background: rgba(239,68,68,0.1); color: #EF4444;">å·²ç¦ç”¨</span>';
                
                // Safe date-time parsing that works with both numeric millisecond timestamps and ISO strings
                let formattedTime = '--';
                if (doc.updatedAt) {
                    const ts = parseInt(doc.updatedAt);
                    if (!isNaN(ts) && String(ts).length >= 10 && /^\d+$/.test(String(doc.updatedAt))) {
                        formattedTime = new Date(ts).toLocaleString();
                    } else {
                        formattedTime = new Date(doc.updatedAt).toLocaleString();
                    }
                }
                
                html += `
                    <tr style="border-bottom: 1.5px solid var(--border-light);">
                        <td style="font-family: monospace; font-size: 0.8rem;">${doc.id}</td>
                        <td style="font-weight: bold; color: var(--text-primary); font-family: monospace;">${doc.code}</td>
                        <td><span style="font-size: 0.82rem; padding: 2px 6px; border-radius: 4px; background: rgba(91,81,249,0.1); color: var(--primary);">${categoryText}</span></td>
                        <td style="font-family: monospace;">${doc.localeTag || doc.lang || '--'}</td>
                        <td style="font-weight: bold;">${escapeHtml(doc.title)}</td>
                        <td>${doc.orderIndex || 0}</td>
                        <td>${statusBadge}</td>
                        <td style="font-size: 0.78rem; color: var(--text-secondary);">${formattedTime}</td>
                        <td style="text-align: center;">
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button class="action-btn btn-approve" onclick="openPlatformContentsDrawer('${doc.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px;">ç¼–è¾‘</button>
                                <button class="action-btn btn-reject" onclick="deletePlatformContent('${doc.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; background: rgba(239,68,68,0.1); color: #EF4444; border: 1px solid rgba(239,68,68,0.2);">åˆ é™¤</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } else {
            showToast(res.errorMessage || 'åŠ è½½å¹³å°æ–‡æ¡£åˆ—è¡¨å¤±è´¥ï¼', true);
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ åŠ è½½å¤±è´¥: ${res.errorMessage || 'æœªçŸ¥æŽ¥å£é”™è¯¯'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        showToast('èŽ·å–æ–‡æ¡£åˆ—è¡¨å¼‚å¸¸ï¼', true);
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ ç½‘ç»œè¯·æ±‚é”™è¯¯ï¼Œè¯·åˆ·æ–°é‡è¯•ï¼</td></tr>';
    }
}

function changePlatformContentsPage(delta) {
    const totalPages = parseInt(document.getElementById('doc-total-pages').innerText) || 1;
    let newPage = docCurrentPage + delta;
    if (newPage < 1) newPage = 1;
    if (newPage > totalPages) newPage = totalPages;
    if (newPage !== docCurrentPage) {
        loadPlatformContentsList(newPage);
    }
}

async function openPlatformContentsDrawer(id = null) {
    const drawer = document.getElementById('platform-contents-drawer');
    const overlay = document.getElementById('platform-contents-overlay');
    const titleEl = document.getElementById('platform-contents-drawer-title');
    const form = document.getElementById('platform-contents-form');
    
    form.reset();
    document.getElementById('edit-doc-id').value = '';
    document.getElementById('edit-doc-enabled').checked = true;
    
    if (id) {
        titleEl.innerText = 'ðŸ“ ç¼–è¾‘å¹³å°æ–‡æ¡£';
        const doc = platformContentsList.find(d => String(d.id) === String(id));
        if (doc) {
            document.getElementById('edit-doc-id').value = doc.id;
            document.getElementById('edit-doc-category').value = doc.category || 'AGREEMENT';
            document.getElementById('edit-doc-code').value = doc.code || '';
            document.getElementById('edit-doc-lang').value = doc.localeTag || doc.lang || 'en';
            document.getElementById('edit-doc-orderIndex').value = doc.orderIndex || 1;
            document.getElementById('edit-doc-title').value = doc.title || '';
            document.getElementById('edit-doc-summary').value = doc.summary || '';
            document.getElementById('edit-doc-enabled').checked = !!doc.enabled;
            document.getElementById('edit-doc-content').value = doc.content || '';
            
            // Asynchronously fetch full details to handle cases where list API omits the content field
            try {
                const res = await apiFetch('GET', `/platform-contents/${id}`, null, true);
                const detailDoc = res.result || res.data;
                if (res.code === 200 && detailDoc) {
                    // Update content only if the drawer is still open for the same id
                    if (document.getElementById('edit-doc-id').value === String(id)) {
                        document.getElementById('edit-doc-content').value = detailDoc.content || '';
                        
                        // Sync back to list cache
                        const idx = platformContentsList.findIndex(d => String(d.id) === String(id));
                        if (idx !== -1) {
                            platformContentsList[idx] = detailDoc;
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch platform content detail:', err);
            }
        }
    } else {
        titleEl.innerText = 'âž• æ–°å»ºå¹³å°æ–‡æ¡£';
        document.getElementById('edit-doc-orderIndex').value = 1;
    }
    
    drawer.classList.add('active');
    overlay.classList.add('active');
}

function closePlatformContentsDrawer() {
    const drawer = document.getElementById('platform-contents-drawer');
    const overlay = document.getElementById('platform-contents-overlay');
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

async function savePlatformContentSubmit(event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('edit-doc-id').value;
    const category = document.getElementById('edit-doc-category').value;
    const code = document.getElementById('edit-doc-code').value.trim();
    const lang = document.getElementById('edit-doc-lang').value;
    const orderIndex = parseInt(document.getElementById('edit-doc-orderIndex').value) || 1;
    const title = document.getElementById('edit-doc-title').value.trim();
    const summary = document.getElementById('edit-doc-summary').value.trim();
    const enabled = document.getElementById('edit-doc-enabled').checked;
    const content = document.getElementById('edit-doc-content').value;
    
    if (!category || !code || !title || !content || !lang) {
        showToast('è¯·å®Œæ•´å¡«å†™å¿…å¡«é¡¹ (*)', true);
        return;
    }
    
    const payload = {
        category,
        code,
        localeTag: lang,
        orderIndex,
        title,
        summary,
        enabled,
        content
    };
    
    showToast('æ­£åœ¨æäº¤ä¿å­˜å¹³å°æ–‡æ¡£...', false);
    
    try {
        let res;
        if (id) {
            res = await apiFetch('PUT', `/platform-contents/${id}`, payload, true);
        } else {
            res = await apiFetch('POST', '/platform-contents', payload, true);
        }
        
        if (res.code === 200) {
            showToast('âœ“ å¹³å°æ–‡æ¡£ä¿å­˜æˆåŠŸï¼', false);
            closePlatformContentsDrawer();
            loadPlatformContentsList(docCurrentPage);
        } else {
            showToast(res.errorMessage || 'ä¿å­˜å¹³å°æ–‡æ¡£å¤±è´¥ï¼', true);
        }
    } catch (err) {
        console.error(err);
        showToast('ä¿å­˜æ“ä½œæŽ¥å£å¼‚å¸¸ï¼Œè¯·é‡è¯•ï¼', true);
    }
}

async function deletePlatformContent(id) {
    if (!id) return;
    if (!confirm('âš ï¸ è­¦å‘Šï¼šæ‚¨ç¡®å®šè¦æ°¸ä¹…åˆ é™¤è¯¥å¹³å°å†…å®¹é¡µå—ï¼Ÿæ­¤æ“ä½œæ— æ³•æ¢å¤ï¼')) {
        return;
    }
    
    showToast('æ­£åœ¨åˆ é™¤å¹³å°æ–‡æ¡£...', false);
    
    try {
        const res = await apiFetch('POST', `/platform-contents/${id}/delete`, null, true);
        if (res.code === 200) {
            showToast('âœ“ å¹³å°æ–‡æ¡£å·²æˆåŠŸåˆ é™¤ï¼', false);
            loadPlatformContentsList(1);
        } else {
            showToast(res.errorMessage || 'åˆ é™¤å¤±è´¥ï¼Œå†…å®¹å¯èƒ½å·²è¢«å ç”¨ï¼', true);
        }
    } catch (err) {
        console.error(err);
        showToast('åˆ é™¤æ“ä½œæŽ¥å£å¼‚å¸¸ï¼', true);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

window.loadPlatformContentsList = loadPlatformContentsList;
window.changePlatformContentsPage = changePlatformContentsPage;
window.openPlatformContentsDrawer = openPlatformContentsDrawer;
window.closePlatformContentsDrawer = closePlatformContentsDrawer;
window.savePlatformContentSubmit = savePlatformContentSubmit;
window.deletePlatformContent = deletePlatformContent;
window.escapeHtml = escapeHtml;


export // ==========================================
// ðŸ“± APP ç‰ˆæœ¬æ›´æ–°ç®¡ç†æ¨¡å— (APP Versions Management Module)
// ==========================================
let cachedAppVersionsList = [];

async function loadAppVersionsList() {
    const tableBody = document.getElementById('versions-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">ðŸ”„ æ­£åœ¨è°ƒå– APP ç‰ˆæœ¬æ›´æ–°åˆ—è¡¨...</td></tr>';
    
    const pageConf = window.adminPages.versions;
    const sizeSelect = document.getElementById('versions-size-select');
    if (sizeSelect) {
        sizeSelect.value = pageConf.size;
    }
    
    const platform = document.getElementById('versions-platform-filter')?.value || '';
    
    try {
        let fetchUrl = '';
        if (platform) {
            fetchUrl = '/app-versions?page=1&pageSize=1000';
        } else {
            fetchUrl = `/app-versions?page=${pageConf.current}&pageSize=${pageConf.size}`;
        }
        
        const res = await apiFetch('GET', fetchUrl, null, true);
        if (res.code === 200) {
            const dataList = res.result || res.data || [];
            
            let filteredList = dataList;
            if (platform) {
                filteredList = filteredList.filter(item => item.platform === platform);
            }
            
            cachedAppVersionsList = filteredList;
            
            let renderList = filteredList;
            let pagingObj = null;
            
            if (platform) {
                pagingObj = {
                    page: pageConf.current,
                    pageSize: pageConf.size,
                    records: filteredList.length,
                    pages: Math.max(1, Math.ceil(filteredList.length / pageConf.size))
                };
                renderList = paginateList(filteredList, 'versions');
            } else {
                pagingObj = res.paging || {
                    page: pageConf.current,
                    pageSize: pageConf.size,
                    records: dataList.length,
                    pages: 1
                };
                updateAdminPageIndicator('versions', pagingObj);
            }
            
            if (renderList.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">ðŸ“­ æš‚æ—  APP ç‰ˆæœ¬è®°å½•</td></tr>';
                return;
            }
            
            let html = '';
            renderList.forEach(v => {
                const forceBadge = v.forceUpgrade ? 
                    `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #EF4444; font-weight: bold;">æ˜¯ (Force)</span>` : 
                    `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.1); color: #94A3B8; font-weight: bold;">å¦</span>`;
                
                const platformBadge = v.platform === 'iOS' ? 
                    `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.1); color: #3B82F6; font-weight: bold;">ðŸ iOS</span>` : 
                    `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold;">ðŸ¤– Android</span>`;
                
                let displayDesc = '--';
                if (v.descriptions) {
                    if (Array.isArray(v.descriptions)) {
                        const enItem = v.descriptions.find(d => (d.localeTag === 'en' || d.lang === 'en' || d.locale === 'en'));
                        const hiItem = v.descriptions.find(d => (d.localeTag === 'hi' || d.lang === 'hi' || d.locale === 'hi'));
                        const enText = enItem ? (enItem.description || enItem.content || '') : '';
                        const hiText = hiItem ? (hiItem.description || hiItem.content || '') : '';
                        displayDesc = `en: ${enText} | hi: ${hiText}`;
                        if (enText && !hiText) displayDesc = enText;
                        if (!enText && hiText) displayDesc = hiText;
                    } else {
                        displayDesc = `en: ${v.descriptions.en || ''} | hi: ${v.descriptions.hi || ''}`;
                        if (v.descriptions.en && !v.descriptions.hi) displayDesc = v.descriptions.en;
                        if (!v.descriptions.en && v.descriptions.hi) displayDesc = v.descriptions.hi;
                    }
                } else if (v.description) {
                    displayDesc = v.description;
                }
                
                html += `
                    <tr style="border-bottom: 1.5px solid var(--border-light);">
                        <td style="font-family: monospace; font-size: 0.8rem;">${v.id}</td>
                        <td>${platformBadge}</td>
                        <td style="font-family: monospace;">${escapeHtml(v.channel || 'official')}</td>
                        <td style="font-weight: bold; color: var(--text-primary); font-family: monospace;">${escapeHtml(v.version)}</td>
                        <td style="font-family: monospace;">${v.versionCode}</td>
                        <td style="font-family: monospace;">${v.minimumVersionCode || '--'}</td>
                        <td>${forceBadge}</td>
                        <td style="font-family: monospace; font-size: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(v.downloadUrl || '')}">
                            <a href="${escapeHtml(v.downloadUrl || '#')}" target="_blank" style="color: var(--primary); font-weight: 500;">${escapeHtml(v.downloadUrl || '--')}</a>
                        </td>
                        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(displayDesc)}">${escapeHtml(displayDesc)}</td>
                        <td class="sticky-right" style="text-align: center;">
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button class="action-btn btn-approve" onclick="openAppVersionDrawer('${v.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px;">ç¼–è¾‘</button>
                                <button class="action-btn btn-reject" onclick="deleteAppVersion('${v.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; background: rgba(239,68,68,0.1); color: #EF4444; border: 1px solid rgba(239,68,68,0.2);">åˆ é™¤</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } else {
            showToast(res.errorMessage || 'åŠ è½½ APP ç‰ˆæœ¬åˆ—è¡¨å¤±è´¥ï¼', true);
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ åŠ è½½å¤±è´¥: ${res.errorMessage || 'æœªçŸ¥æŽ¥å£é”™è¯¯'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        showToast('èŽ·å– APP ç‰ˆæœ¬åˆ—è¡¨å¼‚å¸¸ï¼', true);
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ ç½‘ç»œè¯·æ±‚é”™è¯¯ï¼Œè¯·åˆ·æ–°é‡è¯•ï¼</td></tr>';
    }
}

function openAppVersionDrawer(id = null) {
    const overlay = document.getElementById('versions-overlay');
    const drawer = document.getElementById('versions-drawer');
    const title = document.getElementById('versions-drawer-title');
    const form = document.getElementById('versions-form');
    
    if (!overlay || !drawer) return;
    
    form.reset();
    document.getElementById('edit-version-id').value = '';
    
    if (id) {
        title.innerText = 'ðŸ“ ç¼–è¾‘ APP ç‰ˆæœ¬';
        const v = cachedAppVersionsList.find(x => String(x.id) === String(id));
        if (v) {
            document.getElementById('edit-version-id').value = v.id;
            document.getElementById('edit-version-platform').value = v.platform || 'iOS';
            document.getElementById('edit-version-channel').value = v.channel || 'official';
            document.getElementById('edit-version-name').value = v.version || '';
            document.getElementById('edit-version-code').value = v.versionCode || '';
            document.getElementById('edit-version-min-code').value = v.minimumVersionCode || '';
            document.getElementById('edit-version-force').value = String(v.forceUpgrade === true);
            document.getElementById('edit-version-url').value = v.downloadUrl || '';
            
            let enDesc = '';
            let hiDesc = '';
            if (v.descriptions) {
                if (Array.isArray(v.descriptions)) {
                    const enItem = v.descriptions.find(d => (d.localeTag === 'en' || d.lang === 'en' || d.locale === 'en'));
                    const hiItem = v.descriptions.find(d => (d.localeTag === 'hi' || d.lang === 'hi' || d.locale === 'hi'));
                    enDesc = enItem ? (enItem.description || enItem.content || '') : '';
                    hiDesc = hiItem ? (hiItem.description || hiItem.content || '') : '';
                } else {
                    enDesc = v.descriptions.en || '';
                    hiDesc = v.descriptions.hi || '';
                }
            } else if (v.description) {
                enDesc = v.description;
            }
            document.getElementById('edit-version-desc-en').value = enDesc;
            document.getElementById('edit-version-desc-hi').value = hiDesc;
        }
    } else {
        title.innerText = 'ðŸ“ æ–°å¢ž APP ç‰ˆæœ¬';
        document.getElementById('edit-version-platform').value = 'iOS';
        document.getElementById('edit-version-channel').value = 'official';
        document.getElementById('edit-version-force').value = 'false';
        document.getElementById('edit-version-desc-en').value = '';
        document.getElementById('edit-version-desc-hi').value = '';
    }
    
    overlay.classList.add('active');
    drawer.classList.add('active');
}

function closeAppVersionDrawer() {
    const overlay = document.getElementById('versions-overlay');
    const drawer = document.getElementById('versions-drawer');
    if (overlay && drawer) {
        overlay.classList.remove('active');
        drawer.classList.remove('active');
    }
}

async function saveAppVersionSubmit(event) {
    event.preventDefault();
    
    const id = document.getElementById('edit-version-id').value;
    const platform = document.getElementById('edit-version-platform').value;
    const channel = document.getElementById('edit-version-channel').value;
    const version = document.getElementById('edit-version-name').value.trim();
    const versionCode = parseInt(document.getElementById('edit-version-code').value);
    const minimumVersionCode = parseInt(document.getElementById('edit-version-min-code').value);
    const forceUpgrade = document.getElementById('edit-version-force').value === 'true';
    const downloadUrl = document.getElementById('edit-version-url').value.trim();
    const descriptionEn = document.getElementById('edit-version-desc-en').value.trim();
    const descriptionHi = document.getElementById('edit-version-desc-hi').value.trim();
    
    let enabled = true;
    if (id) {
        const existing = cachedAppVersionsList.find(x => String(x.id) === String(id));
        if (existing) {
            enabled = existing.enabled !== false;
        }
    }

    const payload = {
        platform,
        channel,
        version,
        versionCode,
        minimumVersionCode,
        forceUpgrade,
        downloadUrl,
        enabled,
        descriptions: [
            {
                localeTag: 'en',
                content: descriptionEn
            },
            {
                localeTag: 'hi',
                content: descriptionHi
            }
        ]
    };
    
    let method = 'POST';
    let path = '/app-versions';
    
    if (id) {
        method = 'PUT';
        path = `/app-versions/${id}`;
    }
    
    showToast('æ­£åœ¨æäº¤ä¿å­˜ APP ç‰ˆæœ¬é…ç½®...', false);
    try {
        const res = await apiFetch(method, path, payload, true);
        if (res.code === 200) {
            showToast('âœ“ APP ç‰ˆæœ¬é…ç½®ä¿å­˜å‘å¸ƒæˆåŠŸï¼', false);
            closeAppVersionDrawer();
            loadAppVersionsList();
        } else {
            showToast(res.errorMessage || 'ä¿å­˜ APP ç‰ˆæœ¬é…ç½®å¤±è´¥', true);
        }
    } catch (e) {
        console.error(e);
        showToast('ä¿å­˜ APP ç‰ˆæœ¬å‘ç”Ÿç½‘ç»œå¼‚å¸¸', true);
    }
}

async function deleteAppVersion(id) {
    if (!confirm(`æ‚¨ç¡®å®šè¦å½»åº•åˆ é™¤è¯¥ APP ç‰ˆæœ¬ (ID: ${id}) å—ï¼Ÿ`)) return;
    
    showToast('æ­£åœ¨æ‰§è¡Œåˆ é™¤ APP ç‰ˆæœ¬...', false);
    try {
        const res = await apiFetch('POST', `/app-versions/${id}/delete`, {}, true);
        if (res.code === 200) {
            showToast('âœ“ APP ç‰ˆæœ¬å·²æˆåŠŸåˆ é™¤ï¼', false);
            loadAppVersionsList();
        } else {
            showToast(res.errorMessage || 'åˆ é™¤ APP ç‰ˆæœ¬å¤±è´¥', true);
        }
    } catch (e) {
        console.error(e);
        showToast('åˆ é™¤ APP ç‰ˆæœ¬ç½‘ç»œå¼‚å¸¸', true);
    }
}

function resetAppVersionsFilters() {
    const platform = document.getElementById('versions-platform-filter');
    const size = document.getElementById('versions-size-select');
    if (platform) platform.value = '';
    if (size) size.value = '10';
    window.adminPages.versions.size = 10;
    window.adminPages.versions.current = 1;
    loadAppVersionsList();
}

window.loadAppVersionsList = loadAppVersionsList;
window.openAppVersionDrawer = openAppVersionDrawer;
window.closeAppVersionDrawer = closeAppVersionDrawer;
window.saveAppVersionSubmit = saveAppVersionSubmit;
window.deleteAppVersion = deleteAppVersion;
window.resetAppVersionsFilters = resetAppVersionsFilters;


// ==========================================
// ðŸ“ž åœ¨çº¿å®¢æœé€šé“ç®¡ç†æ¨¡å— (Support Channels Management Module)
// ==========================================
let cachedSupportChannelsList = [];

async function loadSupportChannelsList() {
    const tableBody = document.getElementById('support-channels-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">ðŸ”„ æ­£åœ¨è°ƒå–åœ¨çº¿å®¢æœé€šé“åˆ—è¡¨...</td></tr>';
    
    const pageConf = window.adminPages.supportChannels;
    const sizeSelect = document.getElementById('support-channels-size-select');
    if (sizeSelect) {
        sizeSelect.value = pageConf.size;
    }
    
    try {
        const fetchUrl = `/support-channels?page=${pageConf.current}&pageSize=${pageConf.size}`;
        const res = await apiFetch('GET', fetchUrl, null, true);
        if (res.code === 200) {
            const dataList = res.result || res.data || [];
            cachedSupportChannelsList = dataList;
            
            const pagingObj = res.paging || {
                page: pageConf.current,
                pageSize: pageConf.size,
                records: dataList.length,
                pages: Math.max(1, Math.ceil(dataList.length / pageConf.size))
            };
            updateAdminPageIndicator('supportChannels', pagingObj);
            
            if (dataList.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">ðŸ“­ æš‚æ— åœ¨çº¿å®¢æœé…ç½®é€šé“</td></tr>';
                return;
            }
            
            let html = '';
            dataList.forEach(v => {
                const enabledBadge = v.enabled ? 
                    `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold;">å¯ç”¨</span>` : 
                    `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #EF4444; font-weight: bold;">ç¦ç”¨</span>`;
                
                let toolBadge = '';
                if (v.toolType === 'TELEGRAM') {
                    toolBadge = `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.1); color: #3B82F6; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">âœˆï¸ TELEGRAM</span>`;
                } else if (v.toolType === 'WHATSAPP') {
                    toolBadge = `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">ðŸ’¬ WHATSAPP</span>`;
                } else if (v.toolType === 'FACEBOOK') {
                    toolBadge = `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(29, 78, 216, 0.1); color: #1D4ED8; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">ðŸ“˜ FACEBOOK</span>`;
                } else if (v.toolType === 'WECHAT') {
                    toolBadge = `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(4, 120, 87, 0.1); color: #047857; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">ðŸŸ¢ WECHAT</span>`;
                } else {
                    toolBadge = `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.1); color: #94A3B8; font-weight: bold;">${escapeHtml(v.toolType || 'UNKNOWN')}</span>`;
                }
                
                let formattedTime = '--';
                if (v.updatedAt) {
                    const ts = parseInt(v.updatedAt);
                    if (!isNaN(ts) && String(ts).length >= 10 && /^\d+$/.test(String(v.updatedAt))) {
                        formattedTime = new Date(ts).toLocaleString();
                    } else {
                        formattedTime = new Date(v.updatedAt).toLocaleString();
                    }
                }
                
                const iconHtml = v.icon ? 
                    `<div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${escapeHtml(v.icon)}" style="width: 20px; height: 20px; border-radius: 4px; object-fit: contain; background: rgba(0,0,0,0.05); padding: 1px;" onerror="this.style.display='none'">
                        <span style="font-family: monospace; font-size: 0.7rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(v.icon)}">${escapeHtml(v.icon)}</span>
                     </div>` : '--';
                
                html += `
                    <tr style="border-bottom: 1.5px solid var(--border-light);">
                        <td style="font-family: monospace; font-size: 0.8rem;">${v.id}</td>
                        <td style="text-align: center; font-weight: bold; color: var(--primary); font-family: monospace;">${v.orderIndex || 1}</td>
                        <td>${toolBadge}</td>
                        <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(v.name || '--')}</td>
                        <td style="font-family: monospace; font-size: 0.75rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(v.link || '')}">
                            <a href="${escapeHtml(v.link || '#')}" target="_blank" style="color: var(--primary); font-weight: 500;">${escapeHtml(v.link || '--')}</a>
                        </td>
                        <td>${iconHtml}</td>
                        <td style="text-align: center;">${enabledBadge}</td>
                        <td style="font-family: monospace; font-size: 0.75rem; color: var(--text-secondary);">${formattedTime}</td>
                        <td class="sticky-right" style="text-align: center;">
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button class="action-btn btn-approve" onclick="openSupportChannelDrawer('${v.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px;">ç¼–è¾‘</button>
                                <button class="action-btn btn-reject" onclick="deleteSupportChannel('${v.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2);">åˆ é™¤</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } else {
            showToast(res.errorMessage || 'åŠ è½½å®¢æœé€šé“åˆ—è¡¨å¤±è´¥ï¼', true);
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ åŠ è½½å¤±è´¥: ${res.errorMessage || 'æœªçŸ¥æŽ¥å£é”™è¯¯'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        showToast('èŽ·å–å®¢æœé€šé“åˆ—è¡¨å¼‚å¸¸ï¼', true);
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ ç½‘ç»œè¯·æ±‚é”™è¯¯ï¼Œè¯·åˆ·æ–°é‡è¯•ï¼</td></tr>';
    }
}

function openSupportChannelDrawer(id = null) {
    const overlay = document.getElementById('support-channels-overlay');
    const drawer = document.getElementById('support-channels-drawer');
    const title = document.getElementById('support-channels-drawer-title');
    const form = document.getElementById('support-channels-form');
    
    if (!overlay || !drawer) return;
    
    form.reset();
    document.getElementById('edit-channel-id').value = '';
    
    if (id) {
        title.innerText = 'ðŸ“ ç¼–è¾‘å®¢æœé€šé“';
        const v = cachedSupportChannelsList.find(x => String(x.id) === String(id));
        if (v) {
            document.getElementById('edit-channel-id').value = v.id;
            document.getElementById('edit-channel-name').value = v.name || '';
            document.getElementById('edit-channel-tool-type').value = v.toolType || 'TELEGRAM';
            document.getElementById('edit-channel-order-index').value = v.orderIndex || 1;
            document.getElementById('edit-channel-link').value = v.link || '';
            document.getElementById('edit-channel-icon').value = v.icon || '';
            document.getElementById('edit-channel-enabled').value = String(v.enabled === true);
        }
    } else {
        title.innerText = 'ðŸ“ æ–°å¢žå®¢æœé€šé“';
        document.getElementById('edit-channel-tool-type').value = 'TELEGRAM';
        document.getElementById('edit-channel-order-index').value = '1';
        document.getElementById('edit-channel-enabled').value = 'true';
        document.getElementById('edit-channel-icon').value = 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/telegram.svg';
    }
    
    overlay.classList.add('active');
    drawer.classList.add('active');
}

function closeSupportChannelDrawer() {
    const overlay = document.getElementById('support-channels-overlay');
    const drawer = document.getElementById('support-channels-drawer');
    if (overlay && drawer) {
        overlay.classList.remove('active');
        drawer.classList.remove('active');
    }
}

function handleToolTypeChange() {
    const type = document.getElementById('edit-channel-tool-type').value;
    const iconInput = document.getElementById('edit-channel-icon');
    if (!iconInput) return;
    
    const defaultIcons = {
        'TELEGRAM': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/telegram.svg',
        'WHATSAPP': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/whatsapp.svg',
        'FACEBOOK': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/facebook.svg',
        'WECHAT': 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/wechat.svg'
    };
    
    const currentVal = iconInput.value.trim();
    const defaultVals = Object.values(defaultIcons);
    if (!currentVal || defaultVals.includes(currentVal)) {
        if (defaultIcons[type]) {
            iconInput.value = defaultIcons[type];
        }
    }
}

async function saveSupportChannelSubmit(event) {
    event.preventDefault();
    
    const id = document.getElementById('edit-channel-id').value;
    const name = document.getElementById('edit-channel-name').value.trim();
    const toolType = document.getElementById('edit-channel-tool-type').value;
    const orderIndex = parseInt(document.getElementById('edit-channel-order-index').value) || 1;
    const link = document.getElementById('edit-channel-link').value.trim();
    const icon = document.getElementById('edit-channel-icon').value.trim();
    const enabled = document.getElementById('edit-channel-enabled').value === 'true';
    
    const payload = {
        name,
        toolType,
        orderIndex,
        link,
        icon,
        enabled
    };
    
    let method = 'POST';
    let path = '/support-channels';
    
    if (id) {
        method = 'PUT';
        path = `/support-channels/${id}`;
    }
    
    showToast('æ­£åœ¨æäº¤ä¿å­˜å®¢æœé€šé“é…ç½®...', false);
    try {
        const res = await apiFetch(method, path, payload, true);
        if (res.code === 200) {
            showToast('âœ“ å®¢æœé€šé“é…ç½®ä¿å­˜æˆåŠŸï¼', false);
            closeSupportChannelDrawer();
            loadSupportChannelsList();
        } else {
            showToast(res.errorMessage || 'ä¿å­˜å®¢æœé€šé“å¤±è´¥', true);
        }
    } catch (e) {
        console.error(e);
        showToast('ä¿å­˜å®¢æœé€šé“å‘ç”Ÿç½‘ç»œå¼‚å¸¸', true);
    }
}

async function deleteSupportChannel(id) {
    if (!confirm(`æ‚¨ç¡®å®šè¦å½»åº•åˆ é™¤è¯¥åœ¨çº¿å®¢æœé€šé“ (ID: ${id}) å—ï¼Ÿ`)) return;
    
    showToast('æ­£åœ¨æ‰§è¡Œåˆ é™¤å®¢æœé€šé“...', false);
    try {
        const res = await apiFetch('POST', `/support-channels/${id}/delete`, {}, true);
        if (res.code === 200) {
            showToast('âœ“ åœ¨çº¿å®¢æœé€šé“å·²æˆåŠŸåˆ é™¤ï¼', false);
            loadSupportChannelsList();
        } else {
            showToast(res.errorMessage || 'åˆ é™¤å®¢æœé€šé“å¤±è´¥', true);
        }
    } catch (e) {
        console.error(e);
        showToast('åˆ é™¤å®¢æœé€šé“ç½‘ç»œå¼‚å¸¸', true);
    }
}

window.loadSupportChannelsList = loadSupportChannelsList;
window.openSupportChannelDrawer = openSupportChannelDrawer;
window.closeSupportChannelDrawer = closeSupportChannelDrawer;
window.handleToolTypeChange = handleToolTypeChange;
window.saveSupportChannelSubmit = saveSupportChannelSubmit;
window.deleteSupportChannel = deleteSupportChannel;

// ==========================================
// ðŸŒ SYSTEM LOCALE MANAGEMENT SECTION
// ==========================================
let cachedLocales = [];

export async function loadLocalesList() {
    const statusFilter = document.getElementById('locales-status-filter')?.value || '';
    const pageConf = window.adminPages.locales;
    const tbody = document.getElementById('locales-table-body');
    
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-secondary); padding: 20px 0;">â³ æ­£åœ¨åŠ è½½è¯­è¨€é…ç½®åˆ—è¡¨...</td></tr>';
    }
    
    let path = '/locales';
    if (statusFilter !== '') {
        path += `?enabled=${statusFilter}`;
    }
    
    try {
        const res = await apiFetch('GET', path, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            cachedLocales = list;
            
            // Local pagination
            const totalItems = list.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / pageConf.size));
            const paging = {
                page: pageConf.current,
                pageSize: pageConf.size,
                records: totalItems,
                pages: totalPages
            };
            if (typeof window.updateAdminPageIndicator === 'function') {
                window.updateAdminPageIndicator('locales', paging);
            }
            
            const startIdx = (pageConf.current - 1) * pageConf.size;
            const endIdx = Math.min(startIdx + pageConf.size, totalItems);
            const renderList = list.slice(startIdx, endIdx);
            
            renderLocalesTable(renderList);
        } else {
            showToast(res.errorMessage || 'æ‹‰å–è¯­è¨€é…ç½®å¤±è´¥', true);
            if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #EF4444; padding: 20px 0;">âŒ åŠ è½½å¤±è´¥: ${res.errorMessage}</td></tr>`;
        }
    } catch (e) {
        console.error("Load locales failed:", e);
        showToast('æ‹‰å–è¯­è¨€é…ç½®ç½‘ç»œå¼‚å¸¸', true);
        if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #EF4444; padding: 20px 0;">âŒ ç½‘ç»œå¼‚å¸¸</td></tr>';
    }
}

function renderLocalesTable(list) {
    const tbody = document.getElementById('locales-table-body');
    if (!tbody) return;
    
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 30px 0;">â„¹ï¸ æš‚æ— ç¬¦åˆæ¡ä»¶çš„è¯­è¨€é…ç½®</td></tr>';
        return;
    }
    
    tbody.innerHTML = list.map(item => {
        const idStr = item.id ? String(item.id) : '--';
        const nameVal = item.name || '--';
        const langVal = item.languageCode || '--';
        const countryVal = item.countryCode || '--';
        const scriptVal = item.scriptCode || '--';
        const orderVal = item.orderIndex !== undefined ? item.orderIndex : '1';
        const createdVal = item.createdAt ? new Date(parseInt(item.createdAt)).toLocaleString() : '--';
        
        // Icon display
        const iconHtml = item.icon ? `<img src="${item.icon}" style="width: 24px; height: 16px; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); object-fit: cover;" onerror="this.style.display='none'">` : '--';
        
        // Default badge
        const defaultBadge = item.isDefault ? 
            `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1.5px solid rgba(16, 185, 129, 0.25); font-weight: bold;">é»˜è®¤</span>` : 
            `<span style="color: var(--text-muted); font-size: 0.72rem;">-</span>`;
            
        // Enabled badge
        const enabledBadge = item.enabled ? 
            `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1.5px solid rgba(16, 185, 129, 0.25);">å·²å¯ç”¨</span>` : 
            `<span class="badge" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1.5px solid rgba(239, 68, 68, 0.25);">å·²ç¦ç”¨</span>`;
            
        // Buttons
        const toggleBtnText = item.enabled ? 'ç¦ç”¨' : 'å¯ç”¨';
        const toggleBtnColor = item.enabled ? '#ef4444' : '#10B981';
        const toggleBtnBg = item.enabled ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)';
        
        return `
            <tr>
                <td style="font-family: monospace; font-size: 0.72rem; font-weight: 600; color: var(--primary);">${idStr}</td>
                <td style="text-align: center;">${iconHtml}</td>
                <td style="font-weight: 600; color: var(--text-primary);">${nameVal}</td>
                <td style="font-family: monospace; font-weight: bold;">${langVal}</td>
                <td style="font-family: monospace;">${countryVal}</td>
                <td style="font-family: monospace; color: var(--text-muted);">${scriptVal}</td>
                <td>${defaultBadge}</td>
                <td>${enabledBadge}</td>
                <td style="font-family: 'Outfit'; font-weight: 600; text-align: center;">${orderVal}</td>
                <td style="font-size: 0.72rem; color: var(--text-muted);">${createdVal}</td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                        <button class="action-btn" style="background: rgba(91, 81, 249, 0.08); border: 1.5px solid var(--primary); color: var(--primary); padding: 2px 6px; font-size: 0.68rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="openLocaleModal('${item.id}')">ç¼–è¾‘</button>
                        <button class="action-btn" style="background: ${toggleBtnBg}; border: 1.5px solid ${toggleBtnColor}; color: ${toggleBtnColor}; padding: 2px 6px; font-size: 0.68rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="toggleLocaleStatus('${item.id}', ${item.enabled})">${toggleBtnText}</button>
                        ${!item.isDefault ? `<button class="action-btn" style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10B981; color: #10B981; padding: 2px 6px; font-size: 0.68rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="setDefaultLocale('${item.id}', '${nameVal}')">è®¾ä¸ºé»˜è®¤</button>` : ''}
                        <button class="action-btn" style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid #EF4444; color: #EF4444; padding: 2px 6px; font-size: 0.68rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="deleteLocale('${item.id}', '${nameVal}')">åˆ é™¤</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

export async function openLocaleModal(id = null) {
    const modal = document.getElementById('locale-form-modal');
    if (!modal) return;
    
    const titleEl = document.getElementById('locale-modal-title');
    const idField = document.getElementById('locale-id');
    const nameField = document.getElementById('locale-name');
    const langField = document.getElementById('locale-lang-code');
    const countryField = document.getElementById('locale-country-code');
    const scriptField = document.getElementById('locale-script-code');
    const iconField = document.getElementById('locale-icon');
    const orderField = document.getElementById('locale-order');
    const defaultField = document.getElementById('locale-is-default');
    const enabledField = document.getElementById('locale-enabled');
    
    idField.value = id || '';
    nameField.value = '';
    langField.value = '';
    countryField.value = '';
    scriptField.value = '';
    iconField.value = '';
    orderField.value = '1';
    defaultField.checked = false;
    enabledField.checked = true;
    
    if (id) {
        if (titleEl) titleEl.innerText = 'ðŸ“ ç¼–è¾‘è¯­è¨€é…ç½®';
        try {
            const res = await apiFetch('GET', `/locales/${id}`, null, true);
            if (res.code === 200) {
                const item = res.result || res.data || {};
                nameField.value = item.name || '';
                langField.value = item.languageCode || '';
                countryField.value = item.countryCode || '';
                scriptField.value = item.scriptCode || '';
                iconField.value = item.icon || '';
                orderField.value = item.orderIndex !== undefined ? item.orderIndex : '1';
                defaultField.checked = !!item.isDefault;
                enabledField.checked = !!item.enabled;
            } else {
                showToast(res.errorMessage || 'èŽ·å–è¯­è¨€è¯¦æƒ…å¤±è´¥', true);
            }
        } catch (e) {
            console.error(e);
            showToast('èŽ·å–è¯­è¨€è¯¦æƒ…ç½‘ç»œå¼‚å¸¸', true);
        }
    } else {
        if (titleEl) titleEl.innerText = 'ðŸ“ æ–°å¢žè¯­è¨€é…ç½®';
    }
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

export function closeLocaleModal() {
    const modal = document.getElementById('locale-form-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

export async function saveLocaleSubmit(event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('locale-id').value;
    const name = document.getElementById('locale-name').value.trim();
    const languageCode = document.getElementById('locale-lang-code').value.trim();
    const countryCode = document.getElementById('locale-country-code').value.trim();
    const scriptCode = document.getElementById('locale-script-code').value.trim();
    const icon = document.getElementById('locale-icon').value.trim();
    const orderIndex = parseInt(document.getElementById('locale-order').value) || 1;
    const isDefault = document.getElementById('locale-is-default').checked;
    const enabled = document.getElementById('locale-enabled').checked;
    
    if (!name || !languageCode) {
        showToast('âŒ è¯­è¨€åç§°å’Œè¯­è¨€ä»£ç ä¸ºå¿…å¡«é¡¹ï¼', true);
        return;
    }
    
    const reqBody = {
        name,
        languageCode,
        countryCode,
        scriptCode,
        icon,
        orderIndex,
        isDefault,
        enabled
    };
    
    const submitBtn = document.getElementById('locale-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'ä¿å­˜ä¸­...';
    }
    
    try {
        let res;
        if (id) {
            res = await apiFetch('PUT', `/locales/${id}`, reqBody, true);
        } else {
            res = await apiFetch('POST', '/locales', reqBody, true);
        }
        
        if (res.code === 200) {
            showToast(id ? 'âœ“ è¯­è¨€æ›´æ–°æˆåŠŸï¼' : 'âœ“ è¯­è¨€åˆ›å»ºæˆåŠŸï¼', false);
            closeLocaleModal();
            loadLocalesList();
        } else {
            showToast(res.errorMessage || 'ä¿å­˜å¤±è´¥', true);
        }
    } catch (e) {
        console.error(e);
        showToast('ä¿å­˜è¯­è¨€é…ç½®ç½‘ç»œå¼‚å¸¸', true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'ä¿å­˜';
        }
    }
}

export async function toggleLocaleStatus(id, currentlyEnabled) {
    const actionStr = currentlyEnabled ? 'ç¦ç”¨' : 'å¯ç”¨';
    const endpoint = `/locales/${id}/${currentlyEnabled ? 'disabled' : 'enabled'}`;
    
    showToast(`æ­£åœ¨è¿›è¡Œ${actionStr}æ“ä½œ...`, false);
    try {
        const res = await apiFetch('POST', endpoint, {}, true);
        if (res.code === 200) {
            showToast(`âœ“ è¯­è¨€å·²æˆåŠŸ${actionStr}ï¼`, false);
            loadLocalesList();
        } else {
            showToast(res.errorMessage || `${actionStr}æ“ä½œå¤±è´¥`, true);
        }
    } catch (e) {
        console.error(e);
        showToast(`è¿›è¡Œ${actionStr}æ“ä½œæ—¶ç½‘ç»œå¼‚å¸¸`, true);
    }
}

export async function setDefaultLocale(id, name) {
    if (!confirm(`ç¡®å®šè¦å°† [${name}] è®¾ç½®ä¸ºç³»ç»Ÿçš„é»˜è®¤å±•ç¤ºè¯­è¨€å—ï¼Ÿ\nè¯¥æ“ä½œå°†è‡ªåŠ¨å–æ¶ˆå…¶å®ƒè¯­è¨€çš„é»˜è®¤æ ‡è®°ã€‚`)) {
        return;
    }
    
    showToast('æ­£åœ¨è®¾ç½®é»˜è®¤è¯­è¨€...', false);
    try {
        const res = await apiFetch('POST', `/locales/${id}/set-default`, {}, true);
        if (res.code === 200) {
            showToast('âœ“ é»˜è®¤è¯­è¨€è®¾ç½®æˆåŠŸï¼', false);
            loadLocalesList();
        } else {
            showToast(res.errorMessage || 'é»˜è®¤è¯­è¨€è®¾ç½®å¤±è´¥', true);
        }
    } catch (e) {
        console.error(e);
        showToast('è®¾ç½®é»˜è®¤è¯­è¨€æ—¶é‡åˆ°ç½‘ç»œå¼‚å¸¸', true);
    }
}

export async function deleteLocale(id, name) {
    if (!confirm(`âš ï¸ æ‚¨ç¡®å®šè¦æ°¸ä¹…åˆ é™¤è¯­è¨€ [${name}] å—ï¼Ÿ\næ­¤æ“ä½œä¸å¯æ’¤é”€ï¼Œå·²ä½¿ç”¨è¯¥è¯­è¨€çš„ç¿»è¯‘å†…å®¹å¯èƒ½æ— æ³•æ˜¾ç¤ºã€‚`)) {
        return;
    }
    
    showToast('æ­£åœ¨åˆ é™¤è¯­è¨€é…ç½®...', false);
    try {
        const res = await apiFetch('POST', `/locales/${id}/delete`, {}, true);
        if (res.code === 200) {
            showToast('âœ“ è¯­è¨€é…ç½®å·²æˆåŠŸåˆ é™¤ï¼', false);
            loadLocalesList();
        } else {
            showToast(res.errorMessage || 'åˆ é™¤è¯­è¨€é…ç½®å¤±è´¥', true);
        }
    } catch (e) {
        console.error(e);
        showToast('åˆ é™¤è¯­è¨€æ—¶é‡åˆ°ç½‘ç»œå¼‚å¸¸', true);
    }
}


// ==========================================
// ðŸž CLIENT ERROR REPORTING MODULE SECTION
// ==========================================
let cachedErrorReports = [];

export async function loadErrorReportsList() {
    const userIdFilter = document.getElementById('error-search-uid')?.value.trim() || '';
    const deviceIdFilter = document.getElementById('error-search-device')?.value.trim() || '';
    const osFilter = document.getElementById('error-filter-os')?.value || '';
    const versionFilter = document.getElementById('error-search-version')?.value.trim() || '';
    
    const pageConf = window.adminPages.errorReports;
    const tbody = document.getElementById('error-reports-table-body');
    
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 20px 0;">â³ æ­£åœ¨æ£€ç´¢é”™è¯¯ä¸ŠæŠ¥æµæ°´...</td></tr>';
    }
    
    let path = `/error-reports?page=${pageConf.current}&pageSize=${pageConf.size}`;
    if (userIdFilter) path += `&userId=${userIdFilter}`;
    if (deviceIdFilter) path += `&deviceId=${deviceIdFilter}`;
    if (osFilter) path += `&os=${osFilter}`;
    if (versionFilter) path += `&appVersion=${versionFilter}`;
    
    try {
        const res = await apiFetch('GET', path, null, true);
        if (res.code === 200) {
            const data = res.result || res.data || {};
            let list = [];
            let paging = null;
            
            if (Array.isArray(data)) {
                list = data;
                paging = {
                    page: pageConf.current,
                    pageSize: pageConf.size,
                    records: list.length,
                    pages: 1
                };
            } else {
                list = data.list || data.records || [];
                paging = data.paging || {
                    page: data.page || pageConf.current,
                    pageSize: data.pageSize || pageConf.size,
                    records: data.total || list.length,
                    pages: data.pages || 1
                };
            }
            
            cachedErrorReports = list;
            
            if (typeof window.updateAdminPageIndicator === 'function') {
                window.updateAdminPageIndicator('errorReports', paging);
            }
            
            renderErrorReportsTable(list);
        } else {
            showToast(res.errorMessage || 'æ‹‰å–é”™è¯¯è®°å½•å¤±è´¥', true);
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #EF4444; padding: 20px 0;">âŒ æŸ¥è¯¢é”™è¯¯: ${res.errorMessage}</td></tr>`;
        }
    } catch (e) {
        console.error("Load error reports failed:", e);
        showToast('æ£€ç´¢é”™è¯¯ä¸ŠæŠ¥ç½‘ç»œå¼‚å¸¸', true);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #EF4444; padding: 20px 0;">âŒ ç½‘ç»œå¼‚å¸¸</td></tr>';
    }
}

function renderErrorReportsTable(list) {
    const tbody = document.getElementById('error-reports-table-body');
    if (!tbody) return;
    
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">â„¹ï¸ æš‚æ— ç¬¦åˆæ¡ä»¶çš„å®¢æˆ·ç«¯é”™è¯¯ä¸ŠæŠ¥è®°å½•</td></tr>';
        return;
    }
    
    tbody.innerHTML = list.map(item => {
        const idStr = item.id ? String(item.id) : '--';
        const uidStr = item.userId ? String(item.userId) : 'æœªç™»å½•ç”¨æˆ·';
        const pageVal = item.page || '--';
        const osText = item.os ? `${item.os} (${item.osVersion || '--'})` : '--';
        const modelText = item.deviceModel || item.deviceId || '--';
        const msgText = item.message || '--';
        const codeText = item.errorCode ? `<span class="badge" style="background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1.5px solid rgba(239, 68, 68, 0.2); font-family: monospace;">${item.errorCode}</span>` : '--';
        const timeVal = item.createdAt ? new Date(parseInt(item.createdAt)).toLocaleString() : '--';
        
        return `
            <tr>
                <td style="font-family: monospace; font-size: 0.72rem; font-weight: 600; color: var(--primary);">${idStr}</td>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${uidStr}</div>
                    <div style="font-size: 0.68rem; color: var(--text-secondary); font-family: monospace;">V ${item.appVersion || '--'}</div>
                </td>
                <td style="font-weight: 600; color: var(--text-primary);">${pageVal}</td>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${osText}</div>
                    <div style="font-size: 0.68rem; color: var(--text-secondary);">${modelText}</div>
                </td>
                <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${msgText}">
                    <div style="font-weight: 700; color: #EF4444; font-size: 0.76rem;">${msgText}</div>
                    <div>${codeText}</div>
                </td>
                <td style="font-size: 0.72rem; color: var(--text-muted);">${timeVal}</td>
                <td>
                    <div style="text-align: center;">
                        <button class="action-btn" style="background: rgba(91, 81, 249, 0.08); border: 1.5px solid var(--primary); color: var(--primary); padding: 4px 10px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="openErrorReportDetail('${item.id}')">ðŸ” æŸ¥çœ‹è¯¦æƒ…</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

export function resetErrorReportFilters() {
    const uidFilter = document.getElementById('error-search-uid');
    const deviceFilter = document.getElementById('error-search-device');
    const osFilter = document.getElementById('error-filter-os');
    const versionFilter = document.getElementById('error-search-version');
    
    if (uidFilter) uidFilter.value = '';
    if (deviceFilter) deviceFilter.value = '';
    if (osFilter) osFilter.value = '';
    if (versionFilter) versionFilter.value = '';
    
    window.adminPages.errorReports.current = 1;
    loadErrorReportsList();
}

export async function openErrorReportDetail(id) {
    const modal = document.getElementById('error-detail-modal');
    if (!modal) return;
    
    document.getElementById('detail-error-id').innerText = id;
    document.getElementById('detail-error-uid').innerText = 'â³';
    document.getElementById('detail-error-page').innerText = 'â³';
    document.getElementById('detail-error-os').innerText = 'â³';
    document.getElementById('detail-error-device').innerText = 'â³';
    document.getElementById('detail-error-time').innerText = 'â³';
    document.getElementById('detail-error-message').innerText = 'â³';
    document.getElementById('detail-error-code').innerText = 'â³';
    document.getElementById('detail-error-stack').innerText = 'æ­£åœ¨ä»ŽæœåŠ¡å™¨æŸ¥è¯¢è¯¦ç»†é”™è¯¯å †æ ˆ...';
    document.getElementById('detail-error-extra').innerText = '{}';
    document.getElementById('detail-error-attachments').innerHTML = 'æ— é™„ä»¶';
    
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    try {
        const res = await apiFetch('GET', `/error-reports/${id}`, null, true);
        if (res.code === 200) {
            const item = res.result || res.data || {};
            document.getElementById('detail-error-uid').innerText = item.userId ? String(item.userId) : 'æ¸¸å®¢ (æœªç™»å½•)';
            document.getElementById('detail-error-page').innerText = item.page || '--';
            document.getElementById('detail-error-os').innerText = item.os ? `${item.os} (${item.osVersion || '--'})` : '--';
            document.getElementById('detail-error-device').innerText = `${item.deviceModel || '--'} [ID: ${item.deviceId || '--'}]`;
            document.getElementById('detail-error-time').innerText = item.createdAt ? new Date(parseInt(item.createdAt)).toLocaleString() : '--';
            document.getElementById('detail-error-message').innerText = item.message || 'æ— æ¶ˆæ¯';
            document.getElementById('detail-error-code').innerText = item.errorCode || '--';
            document.getElementById('detail-error-stack').innerText = item.stack || 'ï¼ˆæ— å †æ ˆè·Ÿè¸ªä¿¡æ¯ï¼‰';
            
            // Format extra environment JSON
            let extraStr = '{}';
            try {
                if (item.extra) {
                    if (typeof item.extra === 'string') {
                        extraStr = JSON.stringify(JSON.parse(item.extra), null, 4);
                    } else if (Array.isArray(item.extra)) {
                        const uints = new Uint8Array(item.extra);
                        const decoded = new TextDecoder().decode(uints);
                        extraStr = JSON.stringify(JSON.parse(decoded), null, 4);
                    } else {
                        extraStr = JSON.stringify(item.extra, null, 4);
                    }
                }
            } catch (je) {
                extraStr = String(item.extra || '{}');
            }
            document.getElementById('detail-error-extra').innerText = extraStr;
            
            // Attachments
            const attachmentsList = item.attachments || [];
            if (attachmentsList.length > 0) {
                document.getElementById('detail-error-attachments').innerHTML = attachmentsList.map(a => {
                    const relativeUrl = typeof a === 'string' ? a : JSON.stringify(a);
                    const absoluteUrl = relativeUrl.startsWith('http') ? relativeUrl : `${window.location.origin}/${relativeUrl}`;
                    return `<a href="${absoluteUrl}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: underline; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;">ðŸ“‚ é™„ä»¶æŸ¥çœ‹ (${relativeUrl.substring(relativeUrl.lastIndexOf('/') + 1)})</a>`;
                }).join('');
            } else {
                document.getElementById('detail-error-attachments').innerHTML = '<span style="color: var(--text-muted); font-size: 0.75rem;">æ— æˆªå›¾æˆ–æ—¥å¿—é™„ä»¶</span>';
            }
        } else {
            document.getElementById('detail-error-stack').innerText = `âš ï¸ é”™è¯¯ä¸ŠæŠ¥æ‹‰å–å¤±è´¥: ${res.errorMessage}`;
        }
    } catch (e) {
        console.error(e);
        document.getElementById('detail-error-stack').innerText = `âŒ è¯·æ±‚é”™è¯¯ä¸ŠæŠ¥æŽ¥å£é‡åˆ°ç½‘ç»œå¼‚å¸¸`;
    }
}

export function closeErrorReportDetail() {
    const modal = document.getElementById('error-detail-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}


window.loadLocalesList = loadLocalesList;
window.openLocaleModal = openLocaleModal;
window.closeLocaleModal = closeLocaleModal;
window.saveLocaleSubmit = saveLocaleSubmit;
window.toggleLocaleStatus = toggleLocaleStatus;
window.setDefaultLocale = setDefaultLocale;
window.deleteLocale = deleteLocale;

window.loadErrorReportsList = loadErrorReportsList;
window.resetErrorReportFilters = resetErrorReportFilters;
window.openErrorReportDetail = openErrorReportDetail;
window.closeErrorReportDetail = closeErrorReportDetail;
