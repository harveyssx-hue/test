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

        // 2. Fetch grouped tenant settings
        const groupedRes = await apiFetch('GET', `/tenants/${activeTenantId}/settings/grouped`, null, true);
        if (!groupedRes || groupedRes.code !== 200 || !groupedRes.data) {
            showToast('获取租户分组设置数据失败！', true);
            loader.innerText = '⚠️ 获取租户分组设置数据失败，请重试';
            return;
        }

        const groups = groupedRes.data;
        
        // Flatten into cachedTenantSettings to maintain backward compatibility
        cachedTenantSettings = [];
        groups.forEach(g => {
            if (g.items) {
                cachedTenantSettings.push(...g.items);
            }
        });

        const tbody = document.getElementById('tenant-settings-tbody');
        if (!tbody) return;

        let html = '';
        const groupIcons = {
            'finance': '💸',
            'otp': '🛡️',
            'quant': '🤖',
            'commons': '⚙️',
            'system': '🔧',
            'regex_pattern': '🧩'
        };

        groups.forEach(g => {
            const icon = groupIcons[g.group.toLowerCase()] || '⚙️';
            // Group header row
            html += `
                <tr style="background: rgba(91, 81, 249, 0.03); border-bottom: 1.5px solid var(--border-light); border-top: 1.5px solid var(--border-light);">
                    <td colspan="3" style="font-weight: 700; color: var(--primary); font-size: 0.85rem; padding: 10px 24px;">${icon} ${g.groupName || g.group} 参数 (${g.group})</td>
                </tr>
            `;

            (g.items || []).forEach(item => {
                let inputHtml = '';
                const valType = (item.valueType || 'STRING').toUpperCase();

                if (valType === 'BOOL' || valType === 'BOOLEAN') {
                    const selectTrue = item.value === 'true' ? 'selected' : '';
                    const selectFalse = item.value === 'false' ? 'selected' : '';
                    inputHtml = `
                        <select data-key="${item.key}" class="tenant-setting-input payment-add-select" style="width: 100%; max-width: 240px; height: 38px; padding: 0 10px; border-radius: 8px; border: 1.5px solid var(--border-light); background: rgba(255,255,255,0.6); outline: none;">
                            <option value="true" ${selectTrue}>开启 (True)</option>
                            <option value="false" ${selectFalse}>关闭 (False)</option>
                        </select>
                    `;
                } else if (valType === 'DECIMAL' || valType === 'INT' || valType === 'NUMBER') {
                    const step = valType === 'INT' ? '1' : 'any';
                    inputHtml = `
                        <input type="number" step="${step}" data-key="${item.key}" class="tenant-setting-input" required value="${item.value}" style="width: 100%; max-width: 240px; padding: 8px 12px; border: 1.5px solid var(--border-light); border-radius: 8px; background: rgba(255,255,255,0.6); outline: none;">
                    `;
                } else if (valType === 'JSON' || valType === 'TEXT' || item.value.length > 50 || item.key.includes('backtest')) {
                    inputHtml = `
                        <textarea data-key="${item.key}" class="tenant-setting-input" required style="width: 100%; max-width: 240px; height: 80px; padding: 8px 12px; border: 1.5px solid var(--border-light); border-radius: 8px; background: rgba(255,255,255,0.6); outline: none; font-family: monospace; font-size: 0.75rem; resize: vertical;">${item.value}</textarea>
                    `;
                } else {
                    inputHtml = `
                        <input type="text" data-key="${item.key}" class="tenant-setting-input" required value="${item.value}" style="width: 100%; max-width: 240px; padding: 8px 12px; border: 1.5px solid var(--border-light); border-radius: 8px; background: rgba(255,255,255,0.6); outline: none;">
                    `;
                }

                html += `
                    <tr style="border-bottom: 1.5px solid var(--border-light);">
                        <td>
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.82rem;">${item.description || item.key}</div>
                            <span style="font-size: 0.68rem; color: var(--text-secondary); font-family: monospace; display: block; margin-top: 2px;">${item.key}</span>
                        </td>
                        <td>
                            ${inputHtml}
                        </td>
                        <td style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">
                            ${item.description || '--'}
                        </td>
                    </tr>
                `;
            });
        });

        // Append Local App Download links section
        html += `
            <tr style="background: rgba(91, 81, 249, 0.03); border-bottom: 1px solid var(--border-light); border-top: 1px solid var(--border-light);">
                <td colspan="3" style="font-weight: 700; color: var(--primary); font-size: 0.85rem; padding: 10px 24px;">📲 APP 客户端下载配置 (LocalStorage Settings)</td>
            </tr>
            <tr>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 0.82rem;">安卓 APP 下载地址</div>
                    <span style="font-size: 0.68rem; color: var(--text-secondary); font-family: monospace; display: block; margin-top: 2px;">app_download_android</span>
                </td>
                <td>
                    <input type="text" id="input-app-download-android" placeholder="例如: https://matp-app.qchats.org/download/android.apk" style="width: 100%; max-width: 240px; padding: 8px 12px; border: 1.5px solid var(--border-light); border-radius: 8px; background: rgba(255,255,255,0.6); outline: none;">
                </td>
                <td style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">
                    用户端安卓平台点击下载 APP 按钮时的直接 apk 下载跳转链接。
                </td>
            </tr>
            <tr>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 0.82rem;">苹果 APP 下载地址</div>
                    <span style="font-size: 0.68rem; color: var(--text-secondary); font-family: monospace; display: block; margin-top: 2px;">app_download_ios</span>
                </td>
                <td>
                    <input type="text" id="input-app-download-ios" placeholder="例如: https://apps.apple.com/app/xxxx" style="width: 100%; max-width: 240px; padding: 8px 12px; border: 1.5px solid var(--border-light); border-radius: 8px; background: rgba(255,255,255,0.6); outline: none;">
                </td>
                <td style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4;">
                    用户端苹果 iOS 平台点击下载 APP 按钮时跳转的 App Store 分发链接。
                </td>
            </tr>
        `;

        tbody.innerHTML = html;

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

    showToast('正在安全提交并保存设置参数...', false);

    try {
        const updatedSettings = [];
        const inputEls = document.querySelectorAll('.tenant-setting-input');

        inputEls.forEach(inputEl => {
            const key = inputEl.getAttribute('data-key');
            if (!key) return;

            const setting = cachedTenantSettings.find(s => s.key === key);
            const newValue = inputEl.value.trim();

            if (setting) {
                if (String(setting.value).trim() !== newValue) {
                    const updatedObj = {
                        key: setting.key,
                        value: newValue,
                        valueType: setting.valueType,
                        enabled: setting.enabled !== undefined ? setting.enabled : true,
                        description: setting.description || ''
                    };
                    updatedSettings.push(updatedObj);
                }
            }
        });

        if (updatedSettings.length === 0) {
            if (localChanged) {
                showToast('✓ 租户系统设置保存成功！', false);
            } else {
                showToast('✓ 未检测到任何配置参数修改，无需保存。', false);
            }
            return;
        }

        const res = await apiFetch('POST', `/tenants/${activeTenantId}/settings/batch-upsert`, { items: updatedSettings }, true);
        
        if (res && res.code === 200) {
            showToast('✓ 租户系统设置保存成功，配置已实时生效！', false);
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
                tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">📭 暂无匹配的平台文档内容记录</td></tr>';
                return;
            }
            
            let html = '';
            dataList.forEach(doc => {
                const categoryText = doc.category === 'AGREEMENT' ? '协议条款' : (doc.category === 'HELP' ? '帮助中心' : '操作提示');
                const statusBadge = doc.enabled 
                    ? '<span class="badge badge-VERIFIED" style="background: rgba(16,185,129,0.1); color: #10B981;">已启用</span>'
                    : '<span class="badge badge-REJECTED" style="background: rgba(239,68,68,0.1); color: #EF4444;">已禁用</span>';
                
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

async function openPlatformContentsDrawer(id = null) {
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
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">📭 暂无 APP 版本记录</td></tr>';
                return;
            }
            
            let html = '';
            renderList.forEach(v => {
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


// ==========================================
// 📞 在线客服通道管理模块 (Support Channels Management Module)
// ==========================================
let cachedSupportChannelsList = [];

async function loadSupportChannelsList() {
    const tableBody = document.getElementById('support-channels-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">🔄 正在调取在线客服通道列表...</td></tr>';
    
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
                tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">📭 暂无在线客服配置通道</td></tr>';
                return;
            }
            
            let html = '';
            dataList.forEach(v => {
                const enabledBadge = v.enabled ? 
                    `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold;">启用</span>` : 
                    `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #EF4444; font-weight: bold;">禁用</span>`;
                
                let toolBadge = '';
                if (v.toolType === 'TELEGRAM') {
                    toolBadge = `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.1); color: #3B82F6; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">✈️ TELEGRAM</span>`;
                } else if (v.toolType === 'WHATSAPP') {
                    toolBadge = `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">💬 WHATSAPP</span>`;
                } else if (v.toolType === 'FACEBOOK') {
                    toolBadge = `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(29, 78, 216, 0.1); color: #1D4ED8; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">📘 FACEBOOK</span>`;
                } else if (v.toolType === 'WECHAT') {
                    toolBadge = `<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(4, 120, 87, 0.1); color: #047857; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">🟢 WECHAT</span>`;
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
                                <button class="action-btn btn-approve" onclick="openSupportChannelDrawer('${v.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px;">编辑</button>
                                <button class="action-btn btn-reject" onclick="deleteSupportChannel('${v.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.2);">删除</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } else {
            showToast(res.errorMessage || '加载客服通道列表失败！', true);
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #EF4444; padding: 40px 0;">❌ 加载失败: ${res.errorMessage || '未知接口错误'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        showToast('获取客服通道列表异常！', true);
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #EF4444; padding: 40px 0;">❌ 网络请求错误，请刷新重试！</td></tr>';
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
        title.innerText = '📝 编辑客服通道';
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
        title.innerText = '📝 新增客服通道';
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
    
    showToast('正在提交保存客服通道配置...', false);
    try {
        const res = await apiFetch(method, path, payload, true);
        if (res.code === 200) {
            showToast('✓ 客服通道配置保存成功！', false);
            closeSupportChannelDrawer();
            loadSupportChannelsList();
        } else {
            showToast(res.errorMessage || '保存客服通道失败', true);
        }
    } catch (e) {
        console.error(e);
        showToast('保存客服通道发生网络异常', true);
    }
}

async function deleteSupportChannel(id) {
    if (!confirm(`您确定要彻底删除该在线客服通道 (ID: ${id}) 吗？`)) return;
    
    showToast('正在执行删除客服通道...', false);
    try {
        const res = await apiFetch('POST', `/support-channels/${id}/delete`, {}, true);
        if (res.code === 200) {
            showToast('✓ 在线客服通道已成功删除！', false);
            loadSupportChannelsList();
        } else {
            showToast(res.errorMessage || '删除客服通道失败', true);
        }
    } catch (e) {
        console.error(e);
        showToast('删除客服通道网络异常', true);
    }
}

window.loadSupportChannelsList = loadSupportChannelsList;
window.openSupportChannelDrawer = openSupportChannelDrawer;
window.closeSupportChannelDrawer = closeSupportChannelDrawer;
window.handleToolTypeChange = handleToolTypeChange;
window.saveSupportChannelSubmit = saveSupportChannelSubmit;
window.deleteSupportChannel = deleteSupportChannel;

// ==========================================
// 🌐 SYSTEM LOCALE MANAGEMENT SECTION
// ==========================================
let cachedLocales = [];

export async function loadLocalesList() {
    const statusFilter = document.getElementById('locales-status-filter')?.value || '';
    const pageConf = window.adminPages.locales;
    const tbody = document.getElementById('locales-table-body');
    
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-secondary); padding: 20px 0;">⏳ 正在加载语言配置列表...</td></tr>';
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
            showToast(res.errorMessage || '拉取语言配置失败', true);
            if (tbody) tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #EF4444; padding: 20px 0;">❌ 加载失败: ${res.errorMessage}</td></tr>`;
        }
    } catch (e) {
        console.error("Load locales failed:", e);
        showToast('拉取语言配置网络异常', true);
        if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #EF4444; padding: 20px 0;">❌ 网络异常</td></tr>';
    }
}

function renderLocalesTable(list) {
    const tbody = document.getElementById('locales-table-body');
    if (!tbody) return;
    
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 30px 0;">ℹ️ 暂无符合条件的语言配置</td></tr>';
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
            `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1.5px solid rgba(16, 185, 129, 0.25); font-weight: bold;">默认</span>` : 
            `<span style="color: var(--text-muted); font-size: 0.72rem;">-</span>`;
            
        // Enabled badge
        const enabledBadge = item.enabled ? 
            `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1.5px solid rgba(16, 185, 129, 0.25);">已启用</span>` : 
            `<span class="badge" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1.5px solid rgba(239, 68, 68, 0.25);">已禁用</span>`;
            
        // Buttons
        const toggleBtnText = item.enabled ? '禁用' : '启用';
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
                        <button class="action-btn" style="background: rgba(91, 81, 249, 0.08); border: 1.5px solid var(--primary); color: var(--primary); padding: 2px 6px; font-size: 0.68rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="openLocaleModal('${item.id}')">编辑</button>
                        <button class="action-btn" style="background: ${toggleBtnBg}; border: 1.5px solid ${toggleBtnColor}; color: ${toggleBtnColor}; padding: 2px 6px; font-size: 0.68rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="toggleLocaleStatus('${item.id}', ${item.enabled})">${toggleBtnText}</button>
                        ${!item.isDefault ? `<button class="action-btn" style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10B981; color: #10B981; padding: 2px 6px; font-size: 0.68rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="setDefaultLocale('${item.id}', '${nameVal}')">设为默认</button>` : ''}
                        <button class="action-btn" style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid #EF4444; color: #EF4444; padding: 2px 6px; font-size: 0.68rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="deleteLocale('${item.id}', '${nameVal}')">删除</button>
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
        if (titleEl) titleEl.innerText = '📝 编辑语言配置';
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
                showToast(res.errorMessage || '获取语言详情失败', true);
            }
        } catch (e) {
            console.error(e);
            showToast('获取语言详情网络异常', true);
        }
    } else {
        if (titleEl) titleEl.innerText = '📝 新增语言配置';
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
        showToast('❌ 语言名称和语言代码为必填项！', true);
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
        submitBtn.innerText = '保存中...';
    }
    
    try {
        let res;
        if (id) {
            res = await apiFetch('PUT', `/locales/${id}`, reqBody, true);
        } else {
            res = await apiFetch('POST', '/locales', reqBody, true);
        }
        
        if (res.code === 200) {
            showToast(id ? '✓ 语言更新成功！' : '✓ 语言创建成功！', false);
            closeLocaleModal();
            loadLocalesList();
        } else {
            showToast(res.errorMessage || '保存失败', true);
        }
    } catch (e) {
        console.error(e);
        showToast('保存语言配置网络异常', true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = '保存';
        }
    }
}

export async function toggleLocaleStatus(id, currentlyEnabled) {
    const actionStr = currentlyEnabled ? '禁用' : '启用';
    const endpoint = `/locales/${id}/${currentlyEnabled ? 'disabled' : 'enabled'}`;
    
    showToast(`正在进行${actionStr}操作...`, false);
    try {
        const res = await apiFetch('POST', endpoint, {}, true);
        if (res.code === 200) {
            showToast(`✓ 语言已成功${actionStr}！`, false);
            loadLocalesList();
        } else {
            showToast(res.errorMessage || `${actionStr}操作失败`, true);
        }
    } catch (e) {
        console.error(e);
        showToast(`进行${actionStr}操作时网络异常`, true);
    }
}

export async function setDefaultLocale(id, name) {
    if (!confirm(`确定要将 [${name}] 设置为系统的默认展示语言吗？\n该操作将自动取消其它语言的默认标记。`)) {
        return;
    }
    
    showToast('正在设置默认语言...', false);
    try {
        const res = await apiFetch('POST', `/locales/${id}/set-default`, {}, true);
        if (res.code === 200) {
            showToast('✓ 默认语言设置成功！', false);
            loadLocalesList();
        } else {
            showToast(res.errorMessage || '默认语言设置失败', true);
        }
    } catch (e) {
        console.error(e);
        showToast('设置默认语言时遇到网络异常', true);
    }
}

export async function deleteLocale(id, name) {
    if (!confirm(`⚠️ 您确定要永久删除语言 [${name}] 吗？\n此操作不可撤销，已使用该语言的翻译内容可能无法显示。`)) {
        return;
    }
    
    showToast('正在删除语言配置...', false);
    try {
        const res = await apiFetch('POST', `/locales/${id}/delete`, {}, true);
        if (res.code === 200) {
            showToast('✓ 语言配置已成功删除！', false);
            loadLocalesList();
        } else {
            showToast(res.errorMessage || '删除语言配置失败', true);
        }
    } catch (e) {
        console.error(e);
        showToast('删除语言时遇到网络异常', true);
    }
}


// ==========================================
// 🐞 CLIENT ERROR REPORTING MODULE SECTION
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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 20px 0;">⏳ 正在检索错误上报流水...</td></tr>';
    }
    
    let path = `/error-reports?page=${pageConf.current}&pageSize=${pageConf.size}`;
    let resolvedUserId = userIdFilter;
    if (userIdFilter && !/^\d{15,}$/.test(userIdFilter)) {
        try {
            const allUsers = await window.adminState.getUsers();
            const matchedUser = allUsers.find(u => 
                String(u.id) === userIdFilter ||
                String(u.uid) === userIdFilter ||
                (u.username && u.username.toLowerCase() === userIdFilter.toLowerCase()) ||
                (u.phone && u.phone === userIdFilter) ||
                (u.email && u.email.toLowerCase() === userIdFilter.toLowerCase()) ||
                (u.nickname && u.nickname.toLowerCase() === userIdFilter.toLowerCase())
            );
            if (matchedUser) {
                resolvedUserId = String(matchedUser.id);
            }
        } catch (e) {
            console.error("Failed to resolve user ID for error reports:", e);
        }
    }
    if (resolvedUserId) path += `&userId=${resolvedUserId}`;
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
            showToast(res.errorMessage || '拉取错误记录失败', true);
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #EF4444; padding: 20px 0;">❌ 查询错误: ${res.errorMessage}</td></tr>`;
        }
    } catch (e) {
        console.error("Load error reports failed:", e);
        showToast('检索错误上报网络异常', true);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #EF4444; padding: 20px 0;">❌ 网络异常</td></tr>';
    }
}

function renderErrorReportsTable(list) {
    const tbody = document.getElementById('error-reports-table-body');
    if (!tbody) return;
    
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">ℹ️ 暂无符合条件的客户端错误上报记录</td></tr>';
        return;
    }
    
    tbody.innerHTML = list.map(item => {
        const idStr = item.id ? String(item.id) : '--';
        const uidStr = item.userId ? String(item.userId) : '未登录用户';
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
                        <button class="action-btn" style="background: rgba(91, 81, 249, 0.08); border: 1.5px solid var(--primary); color: var(--primary); padding: 4px 10px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="openErrorReportDetail('${item.id}')">🔍 查看详情</button>
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
    document.getElementById('detail-error-uid').innerText = '⏳';
    document.getElementById('detail-error-page').innerText = '⏳';
    document.getElementById('detail-error-os').innerText = '⏳';
    document.getElementById('detail-error-device').innerText = '⏳';
    document.getElementById('detail-error-time').innerText = '⏳';
    document.getElementById('detail-error-message').innerText = '⏳';
    document.getElementById('detail-error-code').innerText = '⏳';
    document.getElementById('detail-error-stack').innerText = '正在从服务器查询详细错误堆栈...';
    document.getElementById('detail-error-extra').innerText = '{}';
    document.getElementById('detail-error-attachments').innerHTML = '无附件';
    
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    try {
        const res = await apiFetch('GET', `/error-reports/${id}`, null, true);
        if (res.code === 200) {
            const item = res.result || res.data || {};
            document.getElementById('detail-error-uid').innerText = item.userId ? String(item.userId) : '游客 (未登录)';
            document.getElementById('detail-error-page').innerText = item.page || '--';
            document.getElementById('detail-error-os').innerText = item.os ? `${item.os} (${item.osVersion || '--'})` : '--';
            document.getElementById('detail-error-device').innerText = `${item.deviceModel || '--'} [ID: ${item.deviceId || '--'}]`;
            document.getElementById('detail-error-time').innerText = item.createdAt ? new Date(parseInt(item.createdAt)).toLocaleString() : '--';
            document.getElementById('detail-error-message').innerText = item.message || '无消息';
            document.getElementById('detail-error-code').innerText = item.errorCode || '--';
            document.getElementById('detail-error-stack').innerText = item.stack || '（无堆栈跟踪信息）';
            
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
                    return `<a href="${absoluteUrl}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: underline; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;">📂 附件查看 (${relativeUrl.substring(relativeUrl.lastIndexOf('/') + 1)})</a>`;
                }).join('');
            } else {
                document.getElementById('detail-error-attachments').innerHTML = '<span style="color: var(--text-muted); font-size: 0.75rem;">无截图或日志附件</span>';
            }
        } else {
            document.getElementById('detail-error-stack').innerText = `⚠️ 错误上报拉取失败: ${res.errorMessage}`;
        }
    } catch (e) {
        console.error(e);
        document.getElementById('detail-error-stack').innerText = `❌ 请求错误上报接口遇到网络异常`;
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
