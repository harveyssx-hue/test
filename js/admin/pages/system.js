export // --- TENANT SYSTEM SETTINGS SECTION ---
let cachedTenantSettings = [];
let activeTenantId = '';

async function loadTenantSettings() {
    const form = document.getElementById('tenant-settings-form');
    const loader = document.getElementById('tenant-settings-loader');
    if (!form || !loader) return;

    form.style.display = 'none';
    loader.style.display = 'block';
    loader.innerHTML = `🔄 正在载入平台租户设置参数...`;

    try {
        // 1. Fetch tenants list
        const tenantsRes = await apiFetch('GET', '/tenants', null, true);
        if (!tenantsRes || tenantsRes.code !== 200 || !tenantsRes.data || tenantsRes.data.length === 0) {
            showToast('获取租户列表失败！', true);
            loader.innerText = '⚠️ 获取租户列表失败，请重试';
            return;
        }

        activeTenantId = tenantsRes.data[0].id;
        document.getElementById('setting-tenant-id').innerText = activeTenantId;

        // 2. Fetch tenant settings
        const settingsRes = await apiFetch('GET', `/tenants/${activeTenantId}/settings`, null, true);
        if (!settingsRes || settingsRes.code !== 200 || !settingsRes.data) {
            showToast('获取租户设置失败！', true);
            loader.innerText = '⚠️ 获取租户设置数据失败，请重试';
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
        showToast('网络请求异常，无法加载租户设置！', true);
        loader.innerText = '⚠️ 网络连接异常，请刷新页面重试';
    }
}

async function submitTenantSettings(event) {
    if (event) event.preventDefault();

    if (!activeTenantId || cachedTenantSettings.length === 0) {
        showToast('未找到有效租户信息，无法保存！', true);
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

    showToast('正在安全提交并保存设置参数...', false);

    try {
        const updatedSettings = [];
        const skippedKeys = [];

        for (const [key, inputId] of Object.entries(keyMap)) {
            const inputEl = document.getElementById(inputId);
            if (!inputEl) continue;

            let setting = cachedTenantSettings.find(s => s.key === key);
            const newValue = inputEl.value.trim();

            if (setting) {
                // 仅在值发生实际变化时提交，降低请求荷载并避免不必要的服务端重置
                if (String(setting.value).trim() !== newValue) {
                    const updatedObj = { ...setting, value: newValue };
                    updatedSettings.push(updatedObj);
                }
            } else {
                // 如果后端初始配置列表里不存在此 key，说明当前系统后端版本尚未定义/不支持该参数。
                // 强行提交会触发后端的 'unsupported sys setting key' (11001003) 校验错误。
                // 采取白名单防御过滤，并打印警告，让支持的参数能够顺利保存。
                skippedKeys.push(key);
                console.warn(`[Tenant Settings] Key "${key}" (Element #${inputId}) is not defined/supported by the backend, skipped to prevent upsert failure.`);
            }
        }

        // 如果没有有效修改
        if (updatedSettings.length === 0) {
            if (localChanged) {
                showToast('✓ 租户系统设置保存成功！', false);
            } else {
                if (skippedKeys.length > 0) {
                    showToast(`⚠️ 保存跳过 (不支持的键: ${skippedKeys.join(', ')})，无其他有效参数修改。`, true);
                } else {
                    showToast('✓ 未检测到任何配置参数修改，无需保存。', false);
                }
            }
            return;
        }

        // 发送 batch-upsert
        const res = await apiFetch('POST', `/tenants/${activeTenantId}/settings/batch-upsert`, { items: updatedSettings }, true);
        
        if (res && res.code === 200) {
            let successMsg = '✓ 租户系统设置保存成功，配置已实时生效！';
            if (skippedKeys.length > 0) {
                successMsg += ` (已忽略不支持的键: ${skippedKeys.join(', ')})`;
            }
            showToast(successMsg, false);
            loadTenantSettings();
        } else {
            console.error('Failed to batch upsert tenant settings:', res);
            showToast(res ? res.errorMessage || '保存租户配置失败，请检查控制台错误！' : '保存租户配置失败！', true);
        }

    } catch (e) {
        console.error('Failed to batch upsert tenant settings:', e);
        showToast('保存租户设置时发生网络异常！', true);
    }
}

window.loadTenantSettings = loadTenantSettings;
window.submitTenantSettings = submitTenantSettings;

function copyToClipboard(text, msg = '已复制到剪贴板') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`✓ ${msg}`);
    }).catch(err => {
        console.error('Failed to copy:', err);
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast(`✓ ${msg}`);
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
        const [rawUsers, depositsRes, withdrawalsRes, ordersRes] = await Promise.all([
            window.adminState.getUsers(),
            apiFetch('GET', '/finance/deposits?page=1&pageSize=5000', null, true),
            apiFetch('GET', '/finance/withdrawals?page=1&pageSize=5000', null, true),
            apiFetch('GET', '/trading/quant/orders', null, true)
        ]);
        const usersRes = { code: 200, result: rawUsers };
        
        if (!rawUsers || depositsRes.code !== 200 || withdrawalsRes.code !== 200 || ordersRes.code !== 200) {
            showToast('\u26a0\ufe0f \u90e8\u5206\u65e5\u62a5\u6570\u636e\u6e90\u62c9\u53d6\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\uff01', true);
            return;
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
                        rate = 68000.0;
                        currentTotalBalance += total * rate;
                        currentFrozenBalance += frozen * rate;
                    } else if (isEth) {
                        rate = 3500.0;
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
        
        const rate = 83.00;
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
    
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">🔄 正在安全调取平台内容页列表...</td></tr>';
    
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
            const totalCount = res.total || dataList.length;
            const totalPages = Math.ceil(totalCount / docPageSize) || 1;
            
            document.getElementById('doc-total-count').innerText = totalCount;
            document.getElementById('doc-current-page').innerText = page;
            document.getElementById('doc-total-pages').innerText = totalPages;
            
            // Enable/disable page buttons
            document.getElementById('btn-doc-prev').disabled = (page <= 1);
            document.getElementById('btn-doc-next').disabled = (page >= totalPages || dataList.length < docPageSize);
            
            if (dataList.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">📭 暂无匹配的平台文档内容记录</td></tr>';
                return;
            }
            
            let html = '';
            dataList.forEach(doc => {
                const categoryText = doc.category === 'AGREEMENT' ? '协议条款' : (doc.category === 'HELP' ? '帮助中心' : '操作提示');
                const statusBadge = doc.enabled 
                    ? '<span class="badge badge-VERIFIED" style="background: rgba(16,185,129,0.1); color: #10B981;">已启用</span>'
                    : '<span class="badge badge-REJECTED" style="background: rgba(239,68,68,0.1); color: #EF4444;">已禁用</span>';
                
                const formattedTime = doc.updatedAt ? new Date(parseInt(doc.updatedAt)).toLocaleString() : '--';
                
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
                                <button class="action-btn btn-approve" onclick="openPlatformContentsDrawer('${doc.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px;">编辑</button>
                                <button class="action-btn btn-reject" onclick="deletePlatformContent('${doc.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; background: rgba(239,68,68,0.1); color: #EF4444; border: 1px solid rgba(239,68,68,0.2);">删除</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } else {
            showToast(res.errorMessage || '加载平台文档列表失败！', true);
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #EF4444; padding: 40px 0;">❌ 加载失败: ${res.errorMessage || '未知接口错误'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        showToast('获取文档列表异常！', true);
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #EF4444; padding: 40px 0;">❌ 网络请求错误，请刷新重试！</td></tr>';
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

function openPlatformContentsDrawer(id = null) {
    const drawer = document.getElementById('platform-contents-drawer');
    const overlay = document.getElementById('platform-contents-overlay');
    const titleEl = document.getElementById('platform-contents-drawer-title');
    const form = document.getElementById('platform-contents-form');
    
    form.reset();
    document.getElementById('edit-doc-id').value = '';
    document.getElementById('edit-doc-enabled').checked = true;
    
    if (id) {
        titleEl.innerText = '📝 编辑平台文档';
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
        }
    } else {
        titleEl.innerText = '➕ 新建平台文档';
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
        showToast('请完整填写必填项 (*)', true);
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
    
    showToast('正在提交保存平台文档...', false);
    
    try {
        let res;
        if (id) {
            res = await apiFetch('PUT', `/platform-contents/${id}`, payload, true);
        } else {
            res = await apiFetch('POST', '/platform-contents', payload, true);
        }
        
        if (res.code === 200) {
            showToast('✓ 平台文档保存成功！', false);
            closePlatformContentsDrawer();
            loadPlatformContentsList(docCurrentPage);
        } else {
            showToast(res.errorMessage || '保存平台文档失败！', true);
        }
    } catch (err) {
        console.error(err);
        showToast('保存操作接口异常，请重试！', true);
    }
}

async function deletePlatformContent(id) {
    if (!id) return;
    if (!confirm('⚠️ 警告：您确定要永久删除该平台内容页吗？此操作无法恢复！')) {
        return;
    }
    
    showToast('正在删除平台文档...', false);
    
    try {
        const res = await apiFetch('POST', `/platform-contents/${id}/delete`, null, true);
        if (res.code === 200) {
            showToast('✓ 平台文档已成功删除！', false);
            loadPlatformContentsList(1);
        } else {
            showToast(res.errorMessage || '删除失败，内容可能已被占用！', true);
        }
    } catch (err) {
        console.error(err);
        showToast('删除操作接口异常！', true);
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
// 📱 APP 版本更新管理模块 (APP Versions Management Module)
// ==========================================
let cachedAppVersionsList = [];

async function loadAppVersionsList() {
    const tableBody = document.getElementById('versions-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">🔄 正在调取 APP 版本更新列表...</td></tr>';
    
    try {
        const res = await apiFetch('GET', '/app-versions', null, true);
        const dataList = res.result || res.data || [];
        if (res.code === 200) {
            // Apply filtering locally
            const platform = document.getElementById('versions-platform-filter')?.value || '';
            
            let filteredList = dataList;
            if (platform) {
                filteredList = filteredList.filter(item => item.platform === platform);
            }
            
            cachedAppVersionsList = filteredList;
            
            const paginated = paginateList(filteredList, 'versions');
            
            if (paginated.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">📭 暂无 APP 版本记录</td></tr>';
                return;
            }
            
            let html = '';
            paginated.forEach(v => {
                const forceBadge = v.forceUpgrade ? 
                    `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #EF4444; font-weight: bold;">是 (Force)</span>` : 
                    `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.1); color: #94A3B8; font-weight: bold;">否</span>`;
                
                const platformBadge = v.platform === 'iOS' ? 
                    `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.1); color: #3B82F6; font-weight: bold;">🍏 iOS</span>` : 
                    `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold;">🤖 Android</span>`;
                
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
                                <button class="action-btn btn-approve" onclick="openAppVersionDrawer('${v.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px;">编辑</button>
                                <button class="action-btn btn-reject" onclick="deleteAppVersion('${v.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; background: rgba(239,68,68,0.1); color: #EF4444; border: 1px solid rgba(239,68,68,0.2);">删除</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } else {
            showToast(res.errorMessage || '加载 APP 版本列表失败！', true);
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #EF4444; padding: 40px 0;">❌ 加载失败: ${res.errorMessage || '未知接口错误'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        showToast('获取 APP 版本列表异常！', true);
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #EF4444; padding: 40px 0;">❌ 网络请求错误，请刷新重试！</td></tr>';
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
        title.innerText = '📝 编辑 APP 版本';
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
        title.innerText = '📝 新增 APP 版本';
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
    
    showToast('正在提交保存 APP 版本配置...', false);
    try {
        const res = await apiFetch(method, path, payload, true);
        if (res.code === 200) {
            showToast('✓ APP 版本配置保存发布成功！', false);
            closeAppVersionDrawer();
            loadAppVersionsList();
        } else {
            showToast(res.errorMessage || '保存 APP 版本配置失败', true);
        }
    } catch (e) {
        console.error(e);
        showToast('保存 APP 版本发生网络异常', true);
    }
}

async function deleteAppVersion(id) {
    if (!confirm(`您确定要彻底删除该 APP 版本 (ID: ${id}) 吗？`)) return;
    
    showToast('正在执行删除 APP 版本...', false);
    try {
        const res = await apiFetch('POST', `/app-versions/${id}/delete`, {}, true);
        if (res.code === 200) {
            showToast('✓ APP 版本已成功删除！', false);
            loadAppVersionsList();
        } else {
            showToast(res.errorMessage || '删除 APP 版本失败', true);
        }
    } catch (e) {
        console.error(e);
        showToast('删除 APP 版本网络异常', true);
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