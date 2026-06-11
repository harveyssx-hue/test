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

function packStrategyStats(descText, yieldVal, winRateVal, followersVal) {
    descText = (descText || '').replace(/\[stats:[\d.-]*,[\d.-]*,[\d.-]*\]/, '').trim();
    return `${descText} [stats:${yieldVal || 0},${winRateVal || 0},${followersVal || 0}]`;
}

export async function submitBatchOrderReview() {
    const checkboxes = document.querySelectorAll('.order-select-checkbox:checked');
    if (checkboxes.length === 0) {
        showToast('❌ 请先勾选需要批量操作的待审核订单！', true);
        return;
    }
    
    if (!confirm(`⚠️ 您确定要批量 [批准启动] 这 ${checkboxes.length} 笔跟单订单吗？`)) {
        return;
    }
    
    const orderIds = Array.from(checkboxes).map(cb => cb.value);
    showToast(`正在批量提交 ${checkboxes.length} 笔订单的审核决议...`, false);
    
    try {
        const res = await apiFetch('POST', '/trading/quant/orders/batch-approve', { orderIds: orderIds }, true);
        
        if (res.code === 200) {
            showToast(`✓ 批量审核成功！已成功批量批准启动 ${orderIds.length} 笔订单。`, false);
            const masterCheckbox = document.getElementById('select-all-pending-orders-checkbox');
            if (masterCheckbox) masterCheckbox.checked = false;
            loadQuantMonitor();
            loadDashboardStats();
        } else {
            showToast(res.errorMessage || `批量审核提交失败！`, true);
        }
    } catch(e) {
        console.error(e);
        showToast('批量审核接口网络异常！', true);
    }
}
window.submitBatchOrderReview = submitBatchOrderReview;

export function toggleSelectAllPendingOrders(master) {
    const checkboxes = document.querySelectorAll('.order-select-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
    });
}
window.toggleSelectAllPendingOrders = toggleSelectAllPendingOrders;


export async function loadQuantMonitor() {
    if (!currentAdmin) return;
    
    try {
        const res = await apiFetch('GET', '/trading/quant/orders', null, true);
        
        if (res.code === 200) {
            const orders = res.result || res.data || [];
            window.cachedQuantOrders = orders;
            
            // Reset master checkbox
            const masterCheckbox = document.getElementById('select-all-pending-orders-checkbox');
            if (masterCheckbox) masterCheckbox.checked = false;
            
            // Dynamically update Active Quant AI counts and Total investments on screen!
            const activeCount = orders.filter(o => o.status === 'ACTIVE').length;
            const statActiveQuantEl = document.getElementById('stat-active-quant');
            if (statActiveQuantEl) statActiveQuantEl.innerText = activeCount;
            
            let valuation = 0;
            orders.forEach(o => {
                valuation += parseFloat(o.investAmount) || 0;
            });
            const statTotalValuationEl = document.getElementById('stat-total-valuation');
            if (statTotalValuationEl) statTotalValuationEl.innerText = '$' + valuation.toLocaleString([], { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            
            // Extract filter values
            const statusVal = document.getElementById('filter-quant-status')?.value || 'ALL';
            const uidVal = document.getElementById('filter-quant-uid')?.value.trim().toLowerCase() || '';
            const orderNoVal = document.getElementById('filter-quant-orderNo')?.value.trim().toLowerCase() || '';
            
            // Apply filtering logic
            let filteredOrders = orders;
            if (statusVal !== 'ALL') {
                filteredOrders = filteredOrders.filter(o => o.status === statusVal);
            }
            if (uidVal !== '') {
                filteredOrders = filteredOrders.filter(o => String(o.userId).toLowerCase().includes(uidVal));
            }
            if (orderNoVal !== '') {
                filteredOrders = filteredOrders.filter(o => String(o.orderNo).toLowerCase().includes(orderNoVal));
            }
            
            const tbody = document.getElementById('quant-monitor-table-body');
            if (!tbody) return;
            
            if (filteredOrders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--text-muted); padding: 30px 0;">全站暂无符合筛选条件的跟单委托订单</td></tr>`;
                
                // Reset summary statistics to zero
                document.getElementById('quant-total-buy-amount').innerText = '0.00 USDT';
                document.getElementById('quant-total-principal-amount').innerText = '0.00 USDT';
                document.getElementById('quant-total-coupon-amount').innerText = '0.00 USDT';
                
                // Update pagination indicator
                const indicator = document.getElementById(`quant-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            // Calculate filtered sums for the table footer statistics (computed over ALL filtered items)
            let sumBuyAmount = 0;
            filteredOrders.forEach(o => {
                sumBuyAmount += parseFloat(o.investAmount || 0);
            });
            document.getElementById('quant-total-buy-amount').innerText = sumBuyAmount.toFixed(2) + ' USDT';
            document.getElementById('quant-total-principal-amount').innerText = sumBuyAmount.toFixed(2) + ' USDT';
            document.getElementById('quant-total-coupon-amount').innerText = '0.00 USDT';
            
            // Paginate the filtered list
            const paginatedOrders = paginateList(filteredOrders, 'quant');
            
            tbody.innerHTML = paginatedOrders.map(o => {
                const profit = parseFloat(o.actualProfit || '0');
                const algoName = o.algorithmModel ? (o.algorithmModel.displayName || o.algorithmModel.name) : '神经网络高频量化';
                
                // Formulate dates and session
                const dateObj = o.createdAt ? new Date(parseInt(o.createdAt)) : null;
                const dateOnly = dateObj ? dateObj.toLocaleDateString([], {year: 'numeric', month: '2-digit', day: '2-digit'}) : '--';
                const hourSession = dateObj ? dateObj.getHours() : '14';
                
                // Create elegant membership UID cell block
                const userAccount = '133' + String(o.userId || '').substring(0, 4) + '1300';
                const userUidStr = String(o.userId || '').substring(0, 8);
                
                // Risk-based position ratio and commission mockup
                const positionRatio = o.riskLevel === 'High' ? '0.9' : (o.riskLevel === 'Medium' ? '0.7' : '0.5');
                const commissionRate = o.riskLevel === 'High' ? '3 <br> 0.15' : '2 <br> 0.10';
                
                const formattedFullTime = dateObj ? dateObj.toLocaleString([], {hour12: false}) : '--';
                
                // Create solid status blocks to match the screenshot
                let statusCellHtml = '';
                if (o.status === 'PENDING') {
                    statusCellHtml = `<div style="background: rgba(245, 158, 11, 0.12); color: #D97706; font-weight: 700; font-size: 0.72rem; padding: 6px 12px; border-radius: 4px; text-align: center; border: 1.5px solid rgba(245, 158, 11, 0.25);">未审核</div>`;
                } else if (o.status === 'ACTIVE') {
                    statusCellHtml = `<div style="background: rgba(16, 185, 129, 0.12); color: #059669; font-weight: 700; font-size: 0.72rem; padding: 6px 12px; border-radius: 4px; text-align: center; border: 1.5px solid rgba(16, 185, 129, 0.25);">运行中</div>`;
                } else if (o.status === 'COMPLETED') {
                    statusCellHtml = `<div style="background: rgba(59, 130, 246, 0.12); color: #2563EB; font-weight: 700; font-size: 0.72rem; padding: 6px 12px; border-radius: 4px; text-align: center; border: 1.5px solid rgba(59, 130, 246, 0.25);">已结算</div>`;
                } else {
                    statusCellHtml = `<div style="background: rgba(107, 114, 128, 0.12); color: #6B7280; font-weight: 700; font-size: 0.72rem; padding: 6px 12px; border-radius: 4px; text-align: center; border: 1.5px solid rgba(107, 114, 128, 0.25);">已取消</div>`;
                }
                
                let checkboxHtml = '';
                if (o.status === 'PENDING') {
                    checkboxHtml = `<input type="checkbox" class="order-select-checkbox" value="${o.id}">`;
                } else {
                    checkboxHtml = `<input type="checkbox" disabled style="opacity: 0.3;">`;
                }
                
                let actionHtml = '';
                if (o.status === 'PENDING') {
                    actionHtml = `
                        <div style="display: flex; gap: 4px; justify-content: center;">
                            <button class="action-btn" style="background: #28A745; color: #FFF; border: none; padding: 4px 8px; font-size: 0.7rem; border-radius: 4px; font-weight: 600; cursor: pointer; height: 26px; line-height: 1;" onclick="handleQuantReviewSubmit('${o.id}', 'approve')">通过</button>
                        </div>
                    `;
                } else if (o.status === 'ACTIVE') {
                    actionHtml = `
                        <div style="display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap;">
                            <button class="action-btn btn-approve" style="background: rgba(91, 81, 249, 0.08); border: 1.5px solid var(--primary); color: var(--primary); padding: 4px 8px; font-size: 0.7rem; white-space: nowrap; cursor: pointer; height: 26px; line-height: 1;" onclick="switchAdminTab('quant-settle', document.getElementById('quant-settle-menu-btn'))">⚡ 结算中心</button>
                            <button class="action-btn btn-reject" style="padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px; line-height: 1; white-space: nowrap;" onclick="handleSingleQuantSettle('${o.id}')">⚡ 一键结算</button>
                        </div>
                    `;
                } else {
                    actionHtml = `<span style="color: var(--text-muted); font-size: 0.72rem;">清算结束</span>`;
                }
                
                return `
                    <tr>
                        <td style="text-align: center;">${checkboxHtml}</td>
                        <td style="font-size: 0.75rem; white-space: nowrap;">
                            <div>${dateOnly}</div>
                            <div style="font-weight: 700; color: var(--primary); font-size: 0.68rem; text-align: center; margin-top: 2px;">${hourSession}</div>
                        </td>
                        <td>
                            <div style="font-weight: 600;">${userAccount}</div>
                            <div style="color: var(--primary); font-size: 0.72rem; font-weight: 600; font-family: monospace;">${userUidStr}</div>
                            <div style="color: var(--text-muted); font-size: 0.68rem;">正式</div>
                        </td>
                        <td>
                            <div style="font-weight: 600; color: var(--text-primary);">每日跟单</div>
                            <div style="color: var(--text-muted); font-size: 0.7rem;">${algoName}</div>
                        </td>
                        <td style="font-weight: 700; font-family: monospace;">${parseFloat(o.investAmount).toFixed(2)}</td>
                        <td style="font-weight: 600; font-family: monospace; color: var(--green);">${parseFloat(o.investAmount).toFixed(2)}</td>
                        <td style="color: var(--text-muted); font-family: monospace;">0.00</td>
                        <td style="font-weight: 600; text-align: center; font-family: monospace;">${positionRatio}</td>
                        <td style="text-align: center; font-family: monospace;">1</td>
                        <td>
                            <div style="font-family: monospace; font-size: 0.72rem; font-weight: 600;">${o.orderNo}</div>
                            <div style="color: var(--text-muted); font-size: 0.68rem; margin-top: 2px;">${formattedFullTime}</div>
                            ${(o.status === 'ACTIVE' || o.status === 'COMPLETED') && o.price && o.quantity ? `<div style="color: var(--primary); font-size: 0.68rem; margin-top: 3px; font-weight: 600;">📈 买入: ${parseFloat(o.price).toFixed(2)} / ${parseFloat(o.quantity).toFixed(4)}</div>` : ''}
                        </td>
                        <td style="font-size: 0.72rem; line-height: 1.3; font-weight: 600;">${commissionRate}</td>
                        <td style="text-align: center;">${statusCellHtml}</td>
                        <td style="text-align: center;">${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        } else {
            showToast(res.errorMessage || '获取策略列表失败！', true);
        }
    } catch(e) {
        console.error(e);
        showToast('获取量化跟单订单列表网络异常！', true);
    }
}

// Reset filters back to default values
function resetQuantFilters() {
    const statusFilter = document.getElementById('filter-quant-status');
    const orderNoFilter = document.getElementById('filter-quant-orderNo');
    const uidFilter = document.getElementById('filter-quant-uid');
    
    if (statusFilter) statusFilter.value = 'ALL';
    if (orderNoFilter) orderNoFilter.value = '';
    if (uidFilter) uidFilter.value = '';
    
    window.adminPages.quant.current = 1;
    loadQuantMonitor();
    showToast('✓ 检索过滤器已重置为默认值', false);
}

// Automatic review approval logic for all pending orders
async function submitAllOrderReview() {
    const pendingOrders = window.cachedQuantOrders ? window.cachedQuantOrders.filter(o => o.status === 'PENDING') : [];
    if (pendingOrders.length === 0) {
        showToast('❌ 当前无可审核的待处理跟单订单！', true);
        return;
    }
    if (!confirm(`⚠️ 您确定要一键批准通过全站所有共 ${pendingOrders.length} 笔待审核跟单订单吗？`)) {
        return;
    }
    const orderIds = pendingOrders.map(o => o.id);
    showToast(`正在一键批量审核 ${orderIds.length} 笔订单...`, false);
    try {
        const res = await apiFetch('POST', '/trading/quant/orders/batch-approve', { orderIds: orderIds }, true);
        if (res.code === 200) {
            showToast(`✓ 已成功一键批准 ${orderIds.length} 笔跟单委托启动！`, false);
            loadQuantMonitor();
            loadDashboardStats();
        } else {
            showToast(res.errorMessage || '一键批量审核失败！', true);
        }
    } catch(e) {
        console.error(e);
        showToast('一键批量审核发送网络异常！', true);
    }
}


async function handleQuantReviewSubmit(orderId, action) {
    if (action !== 'approve') return;
    
    if (!confirm(`⚠️ 您确定要对该未审核订单执行 [批准通过启动] 操作吗？`)) {
        return;
    }
    
    showToast(`正在提交策略审核决议 [批准]...`, false);
    
    try {
        const res = await apiFetch('POST', `/trading/quant/orders/${orderId}/approve`, {}, true);
        if (res.code === 200) {
            showToast(`💼 策略审核处理成功：策略已批准启动 ✓`, false);
            loadQuantMonitor();
            loadDashboardStats();
        } else {
            showToast(res.errorMessage || '策略审核操作失败！', true);
        }
    } catch(e) {
        showToast('策略审核提交网络异常！', true);
    }
}

window.userAccountCache = window.userAccountCache || {};
async function fetchUserUsdtBalance(userId) {
    try {
        let accountIds = window.userAccountCache[userId];
        if (!accountIds) {
            const acctRes = await apiFetch('GET', `/finance/accounts/${userId}`, null, true);
            const accounts = acctRes.result || acctRes.data || [];
            accountIds = accounts.map(a => a.id).filter(id => id);
            window.userAccountCache[userId] = accountIds;
        }
        if (accountIds && accountIds.length > 0) {
            const balanceMap = {};
            for (const accountId of accountIds) {
                const balRes = await apiFetch('GET', `/finance/accounts/${accountId}/balances`, null, true);
                const balances = balRes.result || balRes.data || [];
                for (const b of balances) {
                    const symbol = b.asset?.symbol || (String(b.assetId) === '1183348576672026624' ? 'USDT' : (String(b.assetId) === '1126151490264633456' ? 'INR' : ''));
                    if (symbol) {
                        const total = parseFloat(b.total) || 0;
                        balanceMap[symbol] = (balanceMap[symbol] || 0) + total;
                    }
                }
            }
            
            const balanceStrings = [];
            let hasNonZero = false;
            const sortedSymbols = Object.keys(balanceMap).sort((a, b) => {
                if (a === 'USDT') return -1;
                if (b === 'USDT') return 1;
                return a.localeCompare(b);
            });
            for (const symbol of sortedSymbols) {
                const total = balanceMap[symbol];
                if (total > 0) {
                    balanceStrings.push(`${total.toFixed(2)} ${symbol}`);
                    hasNonZero = true;
                }
            }
            if (hasNonZero) {
                return balanceStrings.join('<br>');
            }
            
            if (balanceMap['USDT'] !== undefined) {
                return '0.00 USDT';
            } else if (sortedSymbols.length > 0) {
                return `0.00 ${sortedSymbols[0]}`;
            }
        }
    } catch (e) {
        console.error(`Failed to fetch balances for user ${userId}:`, e);
    }
    return '0.00 USDT';
}


export // --- QUANT STRATEGIES MANAGEMENT Logic (平台量化策略模板控制中心 CRUD) ---
let cachedStrategiesList = [];

async function loadPlatformStrategies() {
    const container = document.getElementById('strategies-table-body');
    if (!container) return;
    
    container.innerHTML = `<tr><td colspan="13" style="text-align: center; color: #64748B; padding: 24px;">🔄 正在安全调取平台量化策略模型列表...</td></tr>`;
    
    try {
        const res = await apiFetch('GET', '/trading/quant/algorithm-models', null, true);
        if (res && res.code === 200) {
            const list = res.result || res.data || [];
            
            list.forEach(m => {
                let foundStats = null;
                if (m.translations) {
                    m.translations.forEach(t => {
                        const stats = unpackStrategyStats(t.description);
                        t.description = stats.description;
                        if (stats.yield !== undefined) {
                            foundStats = stats;
                        }
                    });
                }
                if (foundStats) {
                    m.yield = foundStats.yield;
                    m.winRate = foundStats.winRate;
                    m.followers = foundStats.followers;
                }
            });
            
            cachedStrategiesList = list;
            
            console.log('Original strategies list from API (processed):', JSON.stringify(list));
            // Show debug tips in title
            const titleEl = document.querySelector('.data-panel-title');
            if (titleEl && !document.getElementById('debug-api-raw-info') && list.length > 0) {
                const debugBtn = document.createElement('span');
                debugBtn.id = 'debug-api-raw-info';
                debugBtn.style = 'font-size: 0.65rem; background: rgba(16,185,129,0.1); color: #10B981; padding: 2px 6px; border-radius: 4px; cursor: pointer; margin-left: 8px; font-weight: 700;';
                debugBtn.innerText = '🔍 查看接口原始字段';
                debugBtn.onclick = () => {
                    alert('接口返回的原始数据属性包含：\n' + Object.keys(list[0]).join(', ') + '\n\n完整JSON数据请在浏览器控制台(Console)查看。');
                };
                titleEl.appendChild(debugBtn);
            }
            
            if (list.length === 0) {
                container.innerHTML = `<tr><td colspan="13" style="text-align: center; color: #94A3B8; padding: 24px;">📭 平台目前尚未录入任何 AI 量化策略模板</td></tr>`;
                const indicator = document.getElementById(`strategies-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            // Sort by orderIndex
            list.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
            
            const paginatedList = paginateList(list, 'strategies');
            container.innerHTML = paginatedList.map(m => {
                const badgeClass = m.enabled ? 'kyc-badge-status kyc-status-VERIFIED' : 'kyc-badge-status kyc-status-PENDING';
                const badgeText = m.enabled ? '启用中' : '已禁用';
                const statusActionText = m.enabled ? '禁用' : '启用';
                const statusActionBtnClass = m.enabled ? 'btn-reject' : 'btn-approve';
                
                // Extract translations
                const hiTrans = m.translations ? m.translations.find(t => t.localeTag === 'hi') : null;
                const enTrans = m.translations ? m.translations.find(t => t.localeTag === 'en') : null;
                
                let hiName = hiTrans ? hiTrans.displayName : '--';
                let enName = enTrans ? enTrans.displayName : '--';
                
                if (!enName && !hiName && m.displayName) {
                    if (m.displayName.includes(' / ')) {
                        const parts = m.displayName.split(' / ');
                        enName = parts[0].trim();
                        hiName = parts[1].trim();
                    } else {
                        enName = m.displayName;
                        hiName = m.displayName;
                    }
                }
                
                const hiType = hiTrans ? hiTrans.typeLabel : '--';
                const enType = enTrans ? enTrans.typeLabel : '--';
                const hiDesc = hiTrans ? hiTrans.description : '--';
                const enDesc = enTrans ? enTrans.description : '--';
                
                const isIconRealUrl = m.icon && (m.icon.startsWith('http') || m.icon.startsWith('/'));
                let iconHtml = '';
                let minAmountText = '';
                
                if (isIconRealUrl) {
                    iconHtml = `<img src="${m.icon}" style="width: 28px; height: 28px; border-radius: 6px; object-fit: cover; display: block; margin: 0 auto; border: 1px solid rgba(0,0,0,0.08);">`;
                    const minAmountVal = parseFloat(m.minInvestAmount || m.minAmount);
                    minAmountText = minAmountVal ? '$' + minAmountVal.toFixed(2) : '<span style="color: #94A3B8; font-weight: 500;">全局默认</span>';
                } else {
                    const iconsList = ['🤖', '🐂', '🚀', '🦅'];
                    const mappedIdx = list.indexOf(m) % 4;
                    const iconChar = iconsList[mappedIdx];
                    const rawIconUrl = m.iconUrl || '';
                    iconHtml = rawIconUrl ? `<img src="${rawIconUrl}" style="width: 28px; height: 28px; border-radius: 6px; object-fit: cover; display: block; margin: 0 auto;">` : `<span style="font-size: 1.2rem; display: block; text-align: center;">${iconChar}</span>`;
                    minAmountText = parseFloat(m.icon) ? '$' + parseFloat(m.icon).toFixed(2) : '<span style="color: #94A3B8; font-weight: 500;">全局默认</span>';
                }
                
                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.8rem; font-weight: 600; color: #64748B;">${m.id}</td>
                        <td style="text-align: center;">${iconHtml}</td>
                        <td style="font-weight: 700; color: var(--text-primary);">${m.name}</td>
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span>🇺🇸</span>
                                    <span style="font-weight: 600; color: #0F172A;">${enName}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem;">
                                    <span>🇮🇳</span>
                                    <span style="font-weight: 600; color: #64748B;">${hiName}</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem;">
                                <div>🇮🇳 <span class="vip-tag" style="background: rgba(91,81,249,0.06); color: var(--primary); padding: 2px 6px;">${hiType}</span></div>
                                <div>🇺🇸 <span class="vip-tag" style="background: rgba(100,116,139,0.06); color: #64748B; padding: 2px 6px;">${enType}</span></div>
                            </div>
                        </td>
                        <td style="max-width: 250px;">
                            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; color: #64748B; line-height: 1.4;">
                                <div style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-bottom: 2px;" title="${hiDesc}">🇮🇳 ${hiDesc}</div>
                                <div style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${enDesc}">🇺🇸 ${enDesc}</div>
                            </div>
                        </td>
                        <td style="text-align: center; font-weight: 700; color: #10B981;">${m.yield !== undefined ? parseFloat(m.yield).toFixed(2) + '%' : '--'}</td>
                        <td style="text-align: center; font-weight: 700; color: var(--primary);">${m.winRate !== undefined ? parseFloat(m.winRate).toFixed(1) + '%' : '--'}</td>
                        <td style="text-align: center; font-weight: 700; color: #64748B;">${m.followers !== undefined ? parseInt(m.followers).toLocaleString() : '--'}</td>
                        <td style="text-align: center; font-weight: 700; color: var(--primary);">${m.orderIndex}</td>
                        <td style="text-align: center; font-weight: 700; color: #0F172A;">${minAmountText}</td>
                        <td>
                            <span class="${badgeClass}">${badgeText}</span>
                        </td>
                        <td>
                            <div class="row-actions-flex" style="display: flex; gap: 6px;">
                                <button class="action-btn ${statusActionBtnClass}" onclick="toggleStrategyStatus('${m.id}', ${m.enabled})">${statusActionText}</button>
                                <button class="action-btn" style="background: #F1F5F9; color: #0F172A;" onclick="openStrategyEditModal('${m.id}')">编辑</button>
                                <button class="action-btn btn-reject" onclick="deleteStrategy('${m.id}')">删除</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
            
        } else {
            container.innerHTML = `<tr><td colspan="13" style="text-align: center; color: #EF4444; padding: 24px;">⚠️ 调取数据失败: ${res.errorMessage || '未知错误'}</td></tr>`;
        }
    } catch(e) {
        console.error('Failed to load strategies:', e);
        container.innerHTML = `<tr><td colspan="13" style="text-align: center; color: #EF4444; padding: 24px;">⚠️ 网络请求异常！</td></tr>`;
    }
}

async function toggleStrategyStatus(strategyId, currentEnabled) {
    const actionPath = currentEnabled ? 'disabled' : 'enabled';
    const actionLabel = currentEnabled ? '禁用' : '启用';
    
    try {
        const res = await apiFetch('POST', `/trading/quant/algorithm-models/${strategyId}/${actionPath}`, {}, true);
        if (res && res.code === 200) {
            showToast(`✓ 策略模型已成功${actionLabel}！`, false);
            loadPlatformStrategies();
        } else {
            showToast(res.errorMessage || `配置${actionLabel}失败！`, true);
        }
    } catch(e) {
        console.error(`Failed to toggle strategy status:`, e);
        showToast('网络请求异常！', true);
    }
}

async function deleteStrategy(strategyId) {
    if (!confirm('🚨 警告：删除该策略模板将导致前端用户无法跟随并部署该量化策略！您确定要永久物理擦除该模型吗？')) return;
    
    try {
        const res = await apiFetch('POST', `/trading/quant/algorithm-models/${strategyId}/delete`, {}, true);
        if (res && res.code === 200) {
            showToast('✓ 策略模板已成功从系统数据库中安全擦除！', false);
            loadPlatformStrategies();
        } else {
            showToast(res.errorMessage || '删除策略失败！', true);
        }
    } catch(e) {
        console.error('Failed to delete strategy:', e);
        showToast('网络删除请求异常！', true);
    }
}

function triggerStrategyUpload() {
    const fileInput = document.getElementById('strategy-edit-file');
    if (fileInput) fileInput.click();
}

function handleStrategyFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('⚠️ 请选择有效的图片文件！', true);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max_size = 128;
            if (width > height) {
                if (width > max_size) {
                    height *= max_size / width;
                    width = max_size;
                }
            } else {
                if (height > max_size) {
                    width *= max_size / height;
                    height = max_size;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(async function(blob) {
                if (!blob) {
                    showToast('⚠️ 图片压缩处理失败！', true);
                    return;
                }
                
                showToast('⏳ 正在上传策略图标...', false);
                try {
                    const presignedRes = await apiFetch('POST', '/upload/presigned', {
                        contentType: 'image/png',
                        fileName: 'strategy_icon.png',
                        type: 'strategy'
                    }, true);
                    
                    if (presignedRes.code === 401 || presignedRes.errorMessage === 'Invalid Token') {
                        throw new Error('未检测到有效的登录会话，请重新登录管理后台！');
                    }
                    
                    if (presignedRes.code !== 200) {
                        throw new Error(presignedRes.errorMessage || '获取上传授权失败');
                    }
                    
                    const { uploadUrl, downloadUrl, path: storagePath } = presignedRes.result || presignedRes.data || {};
                    if (!uploadUrl || !downloadUrl) {
                        throw new Error('授权数据解析异常');
                    }
                    
                    let finalPutUrl = uploadUrl;
                    const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
                    if (isLocalDev && !uploadUrl.includes('upload-local')) {
                        finalPutUrl = '/upload-gcs?url=' + encodeURIComponent(uploadUrl);
                    }
                    
                    const putRes = await fetch(finalPutUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'image/png'
                        },
                        body: blob
                    });
                    
                    if (!putRes.ok) {
                        throw new Error('上传二进制文件失败');
                    }
                    
                    const confirmRes = await apiFetch('POST', '/upload/confirm', {
                        path: storagePath
                    }, true);
                    
                    if (confirmRes.code !== 200) {
                        throw new Error(confirmRes.errorMessage || '确认上传失败');
                    }
                    
                    document.getElementById('strategy-edit-icon-url').value = downloadUrl;
                    const previewImg = document.getElementById('strategy-icon-preview-img');
                    const previewContainer = document.getElementById('strategy-icon-preview-container');
                    if (previewImg) previewImg.src = downloadUrl;
                    if (previewContainer) previewContainer.style.display = 'flex';
                    
                    showToast('✓ 策略图标上传并预览成功！', false);
                } catch (err) {
                    console.error('Strategy upload error:', err);
                    showToast('⚠️ 策略图片上传失败: ' + (err.message || err), true);
                }
            }, 'image/png');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

window.triggerStrategyUpload = triggerStrategyUpload;
window.handleStrategyFileSelect = handleStrategyFileSelect;

function openStrategyEditModal(strategyId) {
    const modal = document.getElementById('strategy-edit-modal');
    if (!modal) return;
    
    // Clear and reset form fields
    document.getElementById('strategy-edit-id').value = '';
    document.getElementById('strategy-edit-name').value = '';
    document.getElementById('strategy-edit-orderIndex').value = '1';
    document.getElementById('strategy-edit-enabled').value = 'true';
    document.getElementById('strategy-edit-min-amount').value = '';
    document.getElementById('strategy-edit-icon-url').value = '';
    document.getElementById('strategy-edit-yield').value = '';
    document.getElementById('strategy-edit-winrate').value = '';
    document.getElementById('strategy-edit-followers').value = '';
    
    const previewContainer = document.getElementById('strategy-icon-preview-container');
    const previewImg = document.getElementById('strategy-icon-preview-img');
    if (previewContainer) previewContainer.style.display = 'none';
    if (previewImg) previewImg.removeAttribute('src');
    
    // hi translation
    document.getElementById('strategy-trans-id-hi').value = '';
    document.getElementById('strategy-trans-displayName-hi').value = '';
    document.getElementById('strategy-trans-typeLabel-hi').value = '';
    document.getElementById('strategy-trans-description-hi').value = '';
    
    // en translation
    document.getElementById('strategy-trans-id-en').value = '';
    document.getElementById('strategy-trans-displayName-en').value = '';
    document.getElementById('strategy-trans-typeLabel-en').value = '';
    document.getElementById('strategy-trans-description-en').value = '';
    
    if (strategyId) {
        // Edit Mode
        document.getElementById('strategy-modal-title').innerText = '✏️ 编辑 AI 量化策略';
        
        const m = cachedStrategiesList.find(item => String(item.id || '') === String(strategyId || ''));
        if (m) {
            document.getElementById('strategy-edit-id').value = m.id;
            document.getElementById('strategy-edit-name').value = m.name || '';
            document.getElementById('strategy-edit-orderIndex').value = m.orderIndex || '1';
            document.getElementById('strategy-edit-enabled').value = m.enabled ? 'true' : 'false';
            document.getElementById('strategy-edit-yield').value = m.yield !== undefined ? m.yield : '';
            document.getElementById('strategy-edit-winrate').value = m.winRate !== undefined ? m.winRate : '';
            document.getElementById('strategy-edit-followers').value = m.followers !== undefined ? m.followers : '';
            
            // Icon & Min Amount Parsing
            const isIconRealUrl = m.icon && (m.icon.startsWith('http') || m.icon.startsWith('/'));
            if (isIconRealUrl) {
                document.getElementById('strategy-edit-icon-url').value = m.icon;
                if (previewImg) previewImg.src = m.icon;
                if (previewContainer) previewContainer.style.display = 'flex';
                document.getElementById('strategy-edit-min-amount').value = m.minInvestAmount || m.minAmount || '';
            } else {
                document.getElementById('strategy-edit-min-amount').value = m.icon || '';
                document.getElementById('strategy-edit-icon-url').value = m.iconUrl || '';
            }
            
            // Translations
            const hiTrans = m.translations ? m.translations.find(t => t.localeTag === 'hi') : null;
            const enTrans = m.translations ? m.translations.find(t => t.localeTag === 'en') : null;
            
            let hiName = hiTrans ? hiTrans.displayName : '';
            let enName = enTrans ? enTrans.displayName : '';
            
            if (!enName && !hiName && m.displayName) {
                if (m.displayName.includes(' / ')) {
                    const parts = m.displayName.split(' / ');
                    enName = parts[0].trim();
                    hiName = parts[1].trim();
                } else {
                    enName = m.displayName;
                    hiName = m.displayName;
                }
            }
            
            document.getElementById('strategy-trans-id-hi').value = hiTrans ? (hiTrans.id || '') : '';
            document.getElementById('strategy-trans-displayName-hi').value = hiName;
            document.getElementById('strategy-trans-typeLabel-hi').value = hiTrans ? (hiTrans.typeLabel || '') : '';
            document.getElementById('strategy-trans-description-hi').value = hiTrans ? (hiTrans.description || '') : '';
            
            document.getElementById('strategy-trans-id-en').value = enTrans ? (enTrans.id || '') : '';
            document.getElementById('strategy-trans-displayName-en').value = enName;
            document.getElementById('strategy-trans-typeLabel-en').value = enTrans ? (enTrans.typeLabel || '') : '';
            document.getElementById('strategy-trans-description-en').value = enTrans ? (enTrans.description || '') : '';
        }
    } else {
        // Create Mode
        document.getElementById('strategy-modal-title').innerText = '📈 新建 AI 量化策略模板';
    }
    
    modal.classList.add('active');
}

function closeStrategyEditModal() {
    const modal = document.getElementById('strategy-edit-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function submitStrategyChanges(event) {
    event.preventDefault();
    
    const strategyId = document.getElementById('strategy-edit-id').value;
    const name = document.getElementById('strategy-edit-name').value;
    const orderIndex = parseInt(document.getElementById('strategy-edit-orderIndex').value) || 1;
    const enabled = document.getElementById('strategy-edit-enabled').value === 'true';
    
    const minAmount = document.getElementById('strategy-edit-min-amount').value;
    const iconUrl = document.getElementById('strategy-edit-icon-url').value.trim();
    
    const yieldVal = parseFloat(document.getElementById('strategy-edit-yield').value) || 0;
    const winRateVal = parseFloat(document.getElementById('strategy-edit-winrate').value) || 0;
    const followersVal = parseInt(document.getElementById('strategy-edit-followers').value) || 0;
    
    // hi translation values
    const transIdHi = document.getElementById('strategy-trans-id-hi').value;
    const displayNameHi = document.getElementById('strategy-trans-displayName-hi').value;
    const typeLabelHi = document.getElementById('strategy-trans-typeLabel-hi').value;
    const descriptionHi = document.getElementById('strategy-trans-description-hi').value;
    
    // en translation values
    const transIdEn = document.getElementById('strategy-trans-id-en').value;
    const displayNameEn = document.getElementById('strategy-trans-displayName-en').value;
    const typeLabelEn = document.getElementById('strategy-trans-typeLabel-en').value;
    const descriptionEn = document.getElementById('strategy-trans-description-en').value;
    
    const translations = [];
    
    const descriptionHiPacked = packStrategyStats(descriptionHi, yieldVal, winRateVal, followersVal);
    const descriptionEnPacked = packStrategyStats(descriptionEn, yieldVal, winRateVal, followersVal);
    
    // Push hi
    const hiObj = {
        localeTag: 'hi',
        displayName: displayNameHi,
        typeLabel: typeLabelHi,
        description: descriptionHiPacked,
        isDefault: false
    };
    if (transIdHi) hiObj.id = transIdHi;
    if (strategyId) hiObj.modelId = strategyId;
    translations.push(hiObj);
    
    // Push en
    const enObj = {
        localeTag: 'en',
        displayName: displayNameEn,
        typeLabel: typeLabelEn,
        description: descriptionEnPacked,
        isDefault: true
    };
    if (transIdEn) enObj.id = transIdEn;
    if (strategyId) enObj.modelId = strategyId;
    translations.push(enObj);
    
    const payload = {
        name: name,
        displayName: `${displayNameEn} / ${displayNameHi}`,
        orderIndex: orderIndex,
        enabled: enabled,
        icon: iconUrl || minAmount || '', // 优先存放真实的图片URL，降级后备存起投金额
        minInvestAmount: minAmount || '',
        minAmount: minAmount || '',
        yield: yieldVal,
        winRate: winRateVal,
        followers: followersVal,
        translations: translations
    };
    
    try {
        let res;
        if (strategyId) {
            // Edit POST
            res = await apiFetch('POST', `/trading/quant/algorithm-models/${strategyId}`, payload, true);
        } else {
            // Create POST
            res = await apiFetch('POST', `/trading/quant/algorithm-models`, payload, true);
        }
        
        if (res && res.code === 200) {
            showToast('✓ 平台 AI 量化策略配置成功并同步生效！', false);
            closeStrategyEditModal();
            loadPlatformStrategies();
        } else {
            showToast(res.errorMessage || '保存策略配置失败！', true);
        }
    } catch(e) {
        console.error('Failed to save strategy changes:', e);
        showToast('网络提交请求异常！', true);
    }
}

// Bind newly created functions globally to window
window.loadPlatformStrategies = loadPlatformStrategies;
window.toggleStrategyStatus = toggleStrategyStatus;
window.deleteStrategy = deleteStrategy;
window.openStrategyEditModal = openStrategyEditModal;
window.closeStrategyEditModal = closeStrategyEditModal;
window.submitStrategyChanges = submitStrategyChanges;
window.triggerStrategyUpload = triggerStrategyUpload;
window.handleStrategyFileSelect = handleStrategyFileSelect;


export // --- AI QUANT MANUAL TRADING CONTROL PANEL (Phase 19 Integration) ---
function openQuantControlModal(orderId, defaultAction) {
    const modal = document.getElementById('quant-control-modal');
    if (!modal) return;
    
    const action = defaultAction || 'buy';
    document.getElementById('qctrl-order-id').value = orderId;
    
    const actionSelect = document.getElementById('qctrl-action');
    if (actionSelect) {
        actionSelect.value = action;
        actionSelect.disabled = false; // Allow manual action selection
    }
    
    document.getElementById('qctrl-price').value = '';
    
    // 获取订单信息并设置初始数量
    const order = (window.cachedQuantOrders || []).find(o => String(o.id) === String(orderId)) 
                 || (activeSettleOrders || []).find(o => String(o.id) === String(orderId));
    
    const qtyInput = document.getElementById('qctrl-qty');
    if (order) {
        qtyInput.value = parseFloat(order.tradeQuantity || order.quantity || 0).toFixed(4);
    } else {
        qtyInput.value = '';
    }
    
    document.getElementById('qctrl-rate-computing').value = '';
    document.getElementById('qctrl-rate-brokerage').value = '';
    
    toggleQctrlActionFields();
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closeQuantControlModal() {
    const modal = document.getElementById('quant-control-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function recalculateQctrlQuantity() {
    const orderId = document.getElementById('qctrl-order-id').value;
    const action = document.getElementById('qctrl-action').value;
    const priceInput = document.getElementById('qctrl-price');
    const qtyInput = document.getElementById('qctrl-qty');
    
    if (!orderId) return;
    
    const order = (window.cachedQuantOrders || []).find(o => String(o.id) === String(orderId)) 
                 || (activeSettleOrders || []).find(o => String(o.id) === String(orderId));
                 
    if (!order) return;
    
    if (action === 'buy') {
        const price = parseFloat(priceInput.value);
        const investAmount = parseFloat(order.investAmount || 0);
        if (!isNaN(price) && price > 0 && investAmount > 0) {
            // 本金直接全部买入，买入数量 = 本金 / 价格
            const calculatedQty = investAmount / price;
            qtyInput.value = calculatedQty.toFixed(4);
        } else {
            qtyInput.value = '';
        }
    } else {
        // 卖出数量直接固定为持仓数量
        qtyInput.value = parseFloat(order.tradeQuantity || 0).toFixed(4);
    }
}
window.recalculateQctrlQuantity = recalculateQctrlQuantity;

function toggleQctrlActionFields() {
    const action = document.getElementById('qctrl-action').value;
    const priceLabel = document.getElementById('qctrl-price-label');
    const qtyLabel = document.getElementById('qctrl-qty-label');
    const submitBtn = document.getElementById('qctrl-submit-btn');
    
    if (action === 'buy') {
        priceLabel.innerText = '买入价格 (Buy Price)';
        qtyLabel.innerText = '买入数量 (Buy Quantity) [自动计算]';
        submitBtn.innerText = '发送物理【买入】撮合指令';
    } else {
        priceLabel.innerText = '卖出价格 (Sell Price)';
        qtyLabel.innerText = '卖出数量 (Sell Quantity) [持仓全部卖出]';
        submitBtn.innerText = '发送物理【卖出】撮合指令';
    }
    
    // 动态重算数量
    recalculateQctrlQuantity();
}
window.toggleQctrlActionFields = toggleQctrlActionFields;

async function submitQuantControl(event) {
    event.preventDefault();
    
    const orderId = document.getElementById('qctrl-order-id').value;
    const action = document.getElementById('qctrl-action').value;
    const instrumentId = document.getElementById('qctrl-instrument').value;
    const price = parseFloat(document.getElementById('qctrl-price').value);
    const quantity = parseFloat(document.getElementById('qctrl-qty').value);
    
    const rateComputingStr = document.getElementById('qctrl-rate-computing').value;
    const rateBrokerageStr = document.getElementById('qctrl-rate-brokerage').value;
    
    if (isNaN(price) || price <= 0 || isNaN(quantity) || quantity <= 0) {
        showToast('⚠️ 请输入有效的价格与数量！', true);
        return;
    }
    
    const submitBtn = document.getElementById('qctrl-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerText = '正在发送撮合指令...';
    
    const payload = {
        orderId: orderId,
        instrumentId: instrumentId,
        price: price,
        quantity: quantity
    };
    
    if (rateComputingStr.trim() !== '') {
        payload.aiComputingCostRate = parseFloat(rateComputingStr);
    }
    if (rateBrokerageStr.trim() !== '') {
        payload.brokerageRate = parseFloat(rateBrokerageStr);
    }
    
    try {
        const url = action === 'buy' ? '/trading/quant/trades/buy' : '/trading/quant/trades/sell';
        const res = await apiFetch('POST', url, payload, true);
        if (res.code === 200) {
            showToast(`✓ AI量化物理【${action === 'buy' ? '买入' : '卖出'}】撮合操盘成功！价格: ${price.toFixed(2)}, 数量: ${quantity.toFixed(4)}。已实时结算盈亏。`, false);
            
            // Reload lists dynamically from the backend to faithfully represent data
            closeQuantControlModal();
            loadDashboardStats();
            if (activeTab === 'quant') loadQuantMonitor();
            if (activeTab === 'quant-settle') {
                // Fetch the list again to reload correct trades dynamically
                loadQuantSettleList();
            }
        } else {
            showToast(res.errorMessage || '操盘指令被后端拒绝', true);
        }
    } catch (e) {
        console.error(e);
        showToast('操盘指令发送网络异常！', true);
    } finally {
        submitBtn.disabled = false;
        const actionSelect = document.getElementById('qctrl-action');
        if (actionSelect) actionSelect.disabled = false; // Re-enable select
        toggleQctrlActionFields();
    }
}

window.openQuantControlModal = openQuantControlModal;
window.closeQuantControlModal = closeQuantControlModal;
window.toggleQctrlActionFields = toggleQctrlActionFields;
window.submitQuantControl = submitQuantControl;

export // --- FOLLOW ORDERS SETTLEMENT (跟单结算 - Phase 22 Integration) ---
let activeSettleOrders = []; // store in-memory for checkbox and selection operations!

async function loadQuantSettleList() {
    if (!currentAdmin) return;
    
    const res = await apiFetch('GET', '/trading/quant/orders', null, true);
    
    if (res.code === 200) {
        const orders = res.result || res.data || [];
        
        // Only keep ACTIVE orders
        const activeOrders = orders.filter(o => o.status === 'ACTIVE');
        
        showToast('正在实时同步跟单交易明细...', false);
        try {
            await Promise.all(activeOrders.map(async (order) => {
                const tradesRes = await apiFetch('GET', `/trading/quant/orders/${order.id}/trades`, null, true);
                if (tradesRes.code === 200) {
                    const trades = tradesRes.result || tradesRes.data || [];
                    // Sort trades chronologically (oldest to newest)
                    trades.sort((a, b) => a.createdAt - b.createdAt);
                    order.trades = trades;
                    
                    if (trades.length === 0) {
                        order.price = null;
                        order.tradeQuantity = 0;
                        order.sellPrice = null;
                        order.actualProfit = 0;
                    } else {
                        const lastTrade = trades[trades.length - 1];
                        if (lastTrade.tradeType === 'BUY') {
                            order.price = parseFloat(lastTrade.price);
                            order.tradeQuantity = parseFloat(lastTrade.quantity);
                            order.sellPrice = null;
                            order.actualProfit = 0;
                        } else {
                            // Find the last BUY price before this SELL trade
                            let lastBuyPrice = null;
                            for (let i = trades.length - 1; i >= 0; i--) {
                                if (trades[i].tradeType === 'BUY') {
                                    lastBuyPrice = parseFloat(trades[i].price);
                                    break;
                                }
                            }
                            order.price = lastBuyPrice;
                            order.tradeQuantity = parseFloat(lastTrade.quantity);
                            order.sellPrice = parseFloat(lastTrade.price);
                            order.actualProfit = parseFloat(lastTrade.profit || 0);
                        }
                    }
                } else {
                    order.trades = [];
                }
            }));
            
            activeSettleOrders = activeOrders;
            renderActiveSettleListHtml();
        } catch(err) {
            console.error('Error fetching trades traces:', err);
            showToast('获取成交明细异常！', true);
            activeSettleOrders = activeOrders;
            renderActiveSettleListHtml();
        }
    } else {
        showToast(res.errorMessage || '获取结算跟单列表失败！', true);
    }
}

function renderActiveSettleListHtml() {
    const selectAllCheckbox = document.getElementById('select-all-settle-orders');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    
    const tbody = document.getElementById('quant-settle-table-body');
    if (!tbody) return;
    
    if (activeSettleOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px 0;">当前没有运行中 (ACTIVE) 的跟单委托订单需要结算</td></tr>`;
        const indicator = document.getElementById(`quantSettle-page-indicator`);
        if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
        return;
    }
    
    const paginatedList = paginateList(activeSettleOrders, 'quantSettle');
    tbody.innerHTML = paginatedList.map(o => {
        const profit = parseFloat(o.actualProfit || '0');
        const algoName = o.algorithmModel ? (o.algorithmModel.displayName || o.algorithmModel.name) : '神经网络高频量化';
        const date = o.createdAt ? new Date(parseInt(o.createdAt)).toLocaleString() : '--';
        
        let instrumentName = 'BTC/USDT';
        if (o.instrumentId) {
            if (String(o.instrumentId) === '1126151490264633457') instrumentName = 'ETH/USDT';
            else if (String(o.instrumentId) === '1126151490264633458') instrumentName = 'SOL/USDT';
        }
        
        const checkboxHtml = `<input type="checkbox" class="order-settle-checkbox" value="${o.id}">`;
        const statusBadge = `<span style="background: rgba(59, 130, 246, 0.12); color: #3b82f6; border: 1.5px solid rgba(59, 130, 246, 0.25); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; margin-left: 6px; white-space: nowrap;">进行中</span>`;
        const actionBtnHtml = `
            <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                <button class="action-btn" style="background: rgba(91, 81, 249, 0.08); border: 1.5px solid var(--primary); color: var(--primary); padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px; line-height: 1;" onclick="openQuantControlModal('${o.id}')">⚙️ 操盘设置</button>
                <button class="action-btn btn-reject" style="padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px; line-height: 1;" onclick="handleSingleQuantSettle('${o.id}')">⚡ 强制结算</button>
            </div>
        `;
        
        return `
            <tr>
                <td style="text-align: center;">${checkboxHtml}</td>
                <td>${String(o.userId || '').substring(0, 12)}...</td>
                <td>
                    <div style="display: flex; align-items: center; flex-wrap: nowrap;">
                        <span class="badge badge-ACTIVE">${algoName}</span>
                        ${statusBadge}
                    </div>
                </td>
                <td style="font-family: monospace; font-size: 0.72rem;">${o.orderNo}</td>
                <td style="font-weight: 600;">${parseFloat(o.investAmount).toFixed(2)} USDT</td>
                <td>
                    <div>${instrumentName}</div>
                    ${o.price ? `<div style="color: var(--text-muted); font-size: 0.68rem; margin-top: 3px; font-weight: 500; white-space: nowrap;">开仓价: <b style="color: var(--primary);">${parseFloat(o.price).toFixed(2)}</b></div>` : ''}
                    ${o.sellPrice ? `<div style="color: var(--text-muted); font-size: 0.68rem; margin-top: 3px; font-weight: 500; white-space: nowrap;">平仓价: <b style="color: #ef4444;">${parseFloat(o.sellPrice).toFixed(2)}</b></div>` : ''}
                </td>
                <td style="font-weight: 500;">${parseFloat(o.tradeQuantity || '0').toFixed(4)}</td>
                <td class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}" style="font-weight: 600;">
                    ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} USDT
                </td>
                <td style="color: var(--text-muted); font-size: 0.75rem;">${date}</td>
                <td style="text-align: center;">${actionBtnHtml}</td>
            </tr>
        `;
    }).join('');
}

window.renderActiveSettleListHtml = renderActiveSettleListHtml;

function toggleSelectAllSettleOrders(master) {
    const checkboxes = document.querySelectorAll('.order-settle-checkbox');
    checkboxes.forEach(cb => {
        if (!cb.disabled) {
            cb.checked = master.checked;
        }
    });
}

async function submitSelectedBatchSettle(action) {
    const checkboxes = document.querySelectorAll('.order-settle-checkbox:checked');
    if (checkboxes.length === 0) {
        showToast('❌ 请先勾选需要批量操作的跟单订单！', true);
        return;
    }
    
    const priceInput = document.getElementById('selected-settle-price').value;
    const qtyInput = document.getElementById('selected-settle-qty').value;
    
    if (!priceInput || !qtyInput) {
        showToast('❌ 请输入批量操作均价与成交数量！', true);
        return;
    }
    
    const price = parseFloat(priceInput);
    const qty = parseFloat(qtyInput);
    
    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
        showToast('❌ 价格与数量必须大于 0！', true);
        return;
    }
    
    const isSell = action === 'sell';
    const actionStr = isSell ? '批量卖出' : '批量买入';
    
    if (!confirm(`⚠️ 您确定要对已勾选的 ${checkboxes.length} 笔跟单订单执行 [${actionStr}] 操作吗？`)) {
        return;
    }
    
    // Construct the payload array with robust active orders filtering
    const requests = [];
    checkboxes.forEach(cb => {
        const orderIdStr = cb.value;
        const orderObj = activeSettleOrders.find(o => String(o.id) === String(orderIdStr));
        
        if (orderObj && orderObj.status === 'ACTIVE') {
            const instrumentId = orderObj.instrumentId ? orderObj.instrumentId : "1126151490264633456";
            requests.push({
                orderId: orderIdStr,
                instrumentId: instrumentId,
                price: price,
                quantity: qty
            });
        }
    });
    
    if (requests.length === 0) {
        showToast('❌ 所勾选的订单无有效活动仓位可操作！', true);
        return;
    }
    
    showToast(`正在提交 ${requests.length} 笔订单的批量操盘指令...`, false);
    
    try {
        const endpoint = isSell ? '/trading/quant/trades/batch-sell' : '/trading/quant/trades/batch-buy';
        const res = await apiFetch('POST', endpoint, requests, true);
        
        if (res.code === 200) {
            showToast(`✓ 已成功执行 ${requests.length} 笔跟单的 [${actionStr}] 批量操盘！`, false);
            document.getElementById('selected-settle-price').value = '';
            document.getElementById('selected-settle-qty').value = '';
            loadQuantSettleList();
            loadDashboardStats();
        } else {
            showToast(res.errorMessage || `批量操作执行失败！`, true);
        }
    } catch(e) {
        console.error(e);
        showToast('批量操盘发送网络异常！', true);
    }
}

async function submitStrategyBatchSettle() {
    const strategyModel = document.getElementById('batch-settle-strategy').value;
    const action = document.getElementById('batch-settle-action').value;
    
    const priceInput = document.getElementById('batch-settle-price').value;
    const qtyInput = document.getElementById('batch-settle-qty').value;
    
    if (!priceInput || !qtyInput) {
        showToast('❌ 请输入结算均价与成交数量！', true);
        return;
    }
    
    const price = parseFloat(priceInput);
    const qty = parseFloat(qtyInput);
    
    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
        showToast('❌ 价格与数量必须大于 0！', true);
        return;
    }
    
    let targetOrders = [];
    if (strategyModel === 'ALL') {
        targetOrders = activeSettleOrders.filter(o => o.status === 'ACTIVE');
    } else {
        targetOrders = activeSettleOrders.filter(o => {
            const algoName = o.algorithmModel ? o.algorithmModel.name.toUpperCase() : '';
            return o.status === 'ACTIVE' && algoName.includes(strategyModel);
        });
    }
    
    if (targetOrders.length === 0) {
        showToast(`❌ 当前没有符合条件且处于运行中的跟单仓位！`, true);
        return;
    }
    
    const actionStr = action === 'sell' ? '批量卖出' : '批量买入';
    if (!confirm(`⚠️ 您确定要对 [${strategyModel}] 策略下的所有共 ${targetOrders.length} 笔运行中跟单执行 [${actionStr}] 操作吗？`)) {
        return;
    }
    
    const requests = targetOrders.map(o => {
        const instrumentId = o.instrumentId ? o.instrumentId : "1126151490264633456";
        return {
            orderId: o.id,
            instrumentId: instrumentId,
            price: price,
            quantity: qty
        };
    });
    
    showToast(`正在提交 [${strategyModel}] 策略 ${targetOrders.length} 笔订单 of 批量操盘指令...`, false);
    
    try {
        const endpoint = action === 'sell' ? '/trading/quant/trades/batch-sell' : '/trading/quant/trades/batch-buy';
        const res = await apiFetch('POST', endpoint, requests, true);
        
        if (res.code === 200) {
            showToast(`✓ 已成功对 [${strategyModel}] 策略 of ${targetOrders.length} 笔跟单执行 [${actionStr}] 批量操盘！`, false);
            document.getElementById('batch-settle-price').value = '';
            document.getElementById('batch-settle-qty').value = '';
            loadQuantSettleList();
            loadDashboardStats();
        } else {
            showToast(res.errorMessage || `策略批量操作执行失败！`, true);
        }
    } catch(e) {
        console.error(e);
        showToast('策略批量操盘发送网络异常！', true);
    }
}

// Bind to window to allow calling from HTML
window.loadQuantSettleList = loadQuantSettleList;
window.toggleSelectAllSettleOrders = toggleSelectAllSettleOrders;
window.submitSelectedBatchSettle = submitSelectedBatchSettle;
window.submitStrategyBatchSettle = submitStrategyBatchSettle;
window.loadQuantMonitor = loadQuantMonitor;
window.resetQuantFilters = resetQuantFilters;
window.submitAllOrderReview = submitAllOrderReview;

// SECTION 11: DAILY OPERATIONAL REPORT - BACKEND DATA AGGREGATION & RENDERING
let cachedDailyReportData = [];


export // 👑 社区合约带单与跟随合规中心 (Copy Trading Admin Module)
// ==========================================

let copyTradingActiveSubTab = 'leaders';

function switchCopyTradingSubTab(subTab) {
    copyTradingActiveSubTab = subTab;
    const leadersPanel = document.getElementById('copytrading-leaders-panel');
    const relationsPanel = document.getElementById('copytrading-relations-panel');
    const ordersPanel = document.getElementById('copytrading-orders-panel');
    const leadersBtn = document.getElementById('copytrading-leaders-tab-btn');
    const relationsBtn = document.getElementById('copytrading-relations-tab-btn');
    const ordersBtn = document.getElementById('copytrading-orders-tab-btn');
    const leadersPaging = document.getElementById('copytrading-leaders-page-indicator-box');
    const relationsPaging = document.getElementById('copytrading-relations-page-indicator-box');
    const ordersPaging = document.getElementById('copytrading-orders-page-indicator-box');

    // Default style reset
    [leadersBtn, relationsBtn, ordersBtn].forEach(btn => {
        if (btn) {
            btn.style.background = 'rgba(255,255,255,0.05)';
            btn.style.color = 'var(--text-secondary)';
            btn.style.border = '1.5px solid var(--border-light)';
        }
    });

    // Hide all panels
    if (leadersPanel) leadersPanel.style.display = 'none';
    if (relationsPanel) relationsPanel.style.display = 'none';
    if (ordersPanel) ordersPanel.style.display = 'none';

    // Hide all page indicators
    if (leadersPaging) leadersPaging.style.display = 'none';
    if (relationsPaging) relationsPaging.style.display = 'none';
    if (ordersPaging) ordersPaging.style.display = 'none';

    if (subTab === 'leaders') {
        if (leadersPanel) leadersPanel.style.display = 'block';
        if (leadersBtn) {
            leadersBtn.style.background = 'var(--primary)';
            leadersBtn.style.color = '#FFF';
            leadersBtn.style.border = 'none';
        }
        if (leadersPaging) leadersPaging.style.display = 'flex';
        loadCopyTradingLeaders();
    } else if (subTab === 'relations') {
        if (relationsPanel) relationsPanel.style.display = 'block';
        if (relationsBtn) {
            relationsBtn.style.background = 'var(--primary)';
            relationsBtn.style.color = '#FFF';
            relationsBtn.style.border = 'none';
        }
        if (relationsPaging) relationsPaging.style.display = 'flex';
        loadCopyTradingRelations();
    } else {
        if (ordersPanel) ordersPanel.style.display = 'block';
        if (ordersBtn) {
            ordersBtn.style.background = 'var(--primary)';
            ordersBtn.style.color = '#FFF';
            ordersBtn.style.border = 'none';
        }
        if (ordersPaging) ordersPaging.style.display = 'flex';
        loadCopyTradingOrders();
    }
}
window.switchCopyTradingSubTab = switchCopyTradingSubTab;

async function loadCopyTradingLeaders() {
    if (!currentAdmin) return;
    
    const filterUid = document.getElementById('filter-leaders-uid')?.value.trim().toLowerCase() || '';
    const filterNickname = document.getElementById('filter-leaders-nickname')?.value.trim().toLowerCase() || '';
    const filterStatus = document.getElementById('filter-leaders-status')?.value || 'ALL';
    
    let url = '/copy-trading/leaders?page=1&pageSize=500';
    if (filterStatus !== 'ALL') {
        url += `&status=${filterStatus}`;
    }
    
    try {
        const res = await apiFetch('GET', url, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            window.cachedLeaders = list;
            const bodyEl = document.getElementById('copytrading-leaders-table-body');
            if (!bodyEl) return;
            
            // Local hybrid search filter
            let filteredList = list;
            if (filterUid !== '') {
                filteredList = filteredList.filter(l => String(l.userId).toLowerCase().includes(filterUid));
            }
            if (filterNickname !== '') {
                filteredList = filteredList.filter(l => String(l.name || '').toLowerCase().includes(filterNickname) || String(l.title || '').toLowerCase().includes(filterNickname));
            }
            if (filterStatus !== 'ALL') {
                filteredList = filteredList.filter(l => String(l.status) === filterStatus);
            }
            
            if (filteredList.length === 0) {
                bodyEl.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的带单导师记录</td></tr>`;
                const indicator = document.getElementById(`leaders-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            // Client side paginated slice
            const paginatedList = paginateList(filteredList, 'leaders');
            
            bodyEl.innerHTML = paginatedList.map(l => {
                const yieldColor = l.yield > 0 ? 'var(--green)' : (l.yield < 0 ? 'var(--red)' : 'var(--text-secondary)');
                const yieldText = l.yield ? `<span style="color: ${yieldColor}; font-weight: bold;">${parseFloat(l.yield).toFixed(2)}%</span>` : '--';
                
                let riskBadge = '';
                if (l.riskLevel === 'LOW') {
                    riskBadge = `<span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold;">低风险</span>`;
                } else if (l.riskLevel === 'MEDIUM') {
                    riskBadge = `<span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.1); color: #F59E0B; font-weight: bold;">中风险</span>`;
                } else if (l.riskLevel === 'HIGH') {
                    riskBadge = `<span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #EF4444; font-weight: bold;">高风险</span>`;
                } else {
                    riskBadge = `<span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.1); color: #94A3B8; font-weight: bold;">${l.riskLevel || '未知'}</span>`;
                }

                const profitShareStr = l.profitShareRatio ? (parseFloat(l.profitShareRatio) * 100).toFixed(0) + '%' : '0%';

                let statusClass = 'PENDING';
                if (l.status === 'ENABLED') statusClass = 'APPROVED';
                else if (l.status === 'DISABLED') statusClass = 'REJECTED';
                else if (l.status === 'SUSPENDED') statusClass = 'PENDING';

                const statusBadge = `
                    <span class="badge badge-${statusClass}">
                        <span class="badge-status-dot"></span>
                        ${l.status}
                    </span>
                `;

                let actionHtml = `
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center; flex-wrap: wrap;">
                        <button class="action-btn" style="background: rgba(91, 81, 249, 0.1); border: 1px solid var(--primary); color: var(--primary); padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px;" onclick="syncLeaderStats('${l.userId}')">同步数据</button>
                        <button class="action-btn" style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10B981; color: #10B981; padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px;" onclick="viewLeaderPositions('${l.userId}')">📊 实时持仓</button>
                        <button class="action-btn" style="background: rgba(245, 158, 11, 0.1); border: 1px solid #F59E0B; color: #F59E0B; padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px;" onclick="toggleLeaderStatus('${l.userId}')">${l.status === 'ENABLED' ? '禁用' : '启用'}</button>
                `;

                if (l.status === 'SUSPENDED' || l.status === 'DISABLED' || l.status === 'PENDING') {
                    actionHtml += `
                        <button class="action-btn btn-approve" style="padding: 4px 8px; font-size: 0.7rem; height: 26px; line-height: 1;" onclick="handleLeaderAudit('${l.userId}', true)">准入</button>
                        <button class="action-btn btn-reject" style="padding: 4px 8px; font-size: 0.7rem; height: 26px; line-height: 1;" onclick="handleLeaderAudit('${l.userId}', false)">驳回</button>
                    `;
                }
                
                actionHtml += `</div>`;

                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.75rem;" title="${l.userId}">${l.userId}</td>
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="font-weight: 600; color: var(--text-primary);">${l.name || '--'}</span>
                                <span style="font-size: 0.65rem; color: var(--text-muted);">${l.bio || '暂无个人简介'}</span>
                            </div>
                        </td>
                        <td>
                            <div style="font-size: 0.72rem; color: var(--text-secondary);">
                                <b>${parseFloat(l.minFollowAmount || 0).toFixed(0)}</b> ~ <b>${parseFloat(l.maxFollowAmount || 0).toFixed(0)}</b> USDT
                            </div>
                        </td>
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="font-weight: 700; color: var(--primary); font-size: 0.82rem;">${l.followersCount || 0} 人</span>
                                <span style="font-size: 0.65rem; color: var(--text-secondary);">收益率: ${yieldText}</span>
                            </div>
                        </td>
                        <td><span style="font-weight: 600; color: var(--text-primary);">${profitShareStr}</span></td>
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <div>${riskBadge} <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 500;">${l.tags || ''}</span></div>
                                <div style="margin-top: 2px;">${statusBadge}</div>
                            </div>
                        </td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        } else {
            showToast(res.errorMessage || '获取导师列表失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ 网络握手或接口返回异常！', true);
    }
}
window.loadCopyTradingLeaders = loadCopyTradingLeaders;

function resetLeadersFilters() {
    const uid = document.getElementById('filter-leaders-uid');
    const nickname = document.getElementById('filter-leaders-nickname');
    const status = document.getElementById('filter-leaders-status');
    if (uid) uid.value = '';
    if (nickname) nickname.value = '';
    if (status) status.value = 'ALL';
    window.adminPages.leaders.current = 1;
    loadCopyTradingLeaders();
    showToast('✓ 导师检索条件已重置', false);
}
window.resetLeadersFilters = resetLeadersFilters;

async function loadCopyTradingRelations() {
    if (!currentAdmin) return;
    
    const filterFollower = document.getElementById('filter-relations-follower')?.value.trim().toLowerCase() || '';
    const filterLeader = document.getElementById('filter-relations-leader')?.value.trim().toLowerCase() || '';
    
    let url = '/copy-trading/relations?page=1&pageSize=500';
    try {
        const res = await apiFetch('GET', url, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            window.cachedRelations = list;
            const bodyEl = document.getElementById('copytrading-relations-table-body');
            if (!bodyEl) return;
            
            // Local hybrid filter
            let filteredList = list;
            if (filterFollower !== '') {
                filteredList = filteredList.filter(r => String(r.followerId).toLowerCase().includes(filterFollower));
            }
            if (filterLeader !== '') {
                filteredList = filteredList.filter(r => String(r.leaderId).toLowerCase().includes(filterLeader));
            }
            
            if (filteredList.length === 0) {
                bodyEl.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的跟随绑定记录</td></tr>`;
                const indicator = document.getElementById(`relations-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            const paginatedList = paginateList(filteredList, 'relations');
            
            bodyEl.innerHTML = paginatedList.map(r => {
                const date = r.createdAt ? new Date(parseInt(r.createdAt)).toLocaleString() : '--';
                
                let statusClass = 'PENDING';
                if (r.status === 'ACTIVE') statusClass = 'APPROVED';
                else if (r.status === 'PAUSED') statusClass = 'PENDING';
                else if (r.status === 'TERMINATED') statusClass = 'REJECTED';

                const statusBadge = `
                    <span class="badge badge-${statusClass}">
                        <span class="badge-status-dot"></span>
                        ${r.status}
                    </span>
                `;

                const followerDisplay = r.followerNickname ? `${r.followerNickname} (${r.followerId})` : r.followerId;
                const leaderDisplay = r.leaderNickname ? `${r.leaderNickname} (${r.leaderId})` : r.leaderId;

                let followDetailsStr = '';
                if (r.followType === 'FIXED') {
                    followDetailsStr = `<span style="font-weight: 600; color: var(--text-primary);">固定单笔: <b>${parseFloat(r.fixedAmount || 0).toFixed(2)}</b> USDT</span>`;
                } else {
                    followDetailsStr = `<span style="font-weight: 600; color: var(--text-primary);">按比例: <b>${(parseFloat(r.ratio || 0) * 100).toFixed(0)}%</b></span>`;
                }
                followDetailsStr += `<br><span style="font-size: 0.65rem; color: var(--text-secondary);">跟单总额: <b>${parseFloat(r.followAmount || 0).toFixed(2)}</b> USDT</span>`;

                const pnlVal = parseFloat(r.totalPnl || 0);
                const pnlColor = pnlVal > 0 ? 'var(--green)' : (pnlVal < 0 ? 'var(--red)' : 'var(--text-secondary)');
                const pnlText = `<span style="color: ${pnlColor}; font-weight: bold; font-family: 'Outfit';">${pnlVal > 0 ? '+' : ''}${pnlVal.toFixed(2)} USDT</span>`;

                let actionHtml = '';
                if (r.status !== 'TERMINATED') {
                    actionHtml = `
                        <div style="display: flex; gap: 6px; justify-content: center;">
                            <button class="action-btn" style="background: rgba(91, 81, 249, 0.1); border: 1px solid var(--primary); color: var(--primary); padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px;" onclick="handleFollowRelation('${r.id}', 'pause')">暂停跟随</button>
                            <button class="action-btn" style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10B981; color: #10B981; padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px;" onclick="handleFollowRelation('${r.id}', 'resume')">恢复跟随</button>
                            <button class="action-btn btn-reject" style="padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px;" onclick="handleFollowRelation('${r.id}', 'terminate')">终结绑定</button>
                        </div>
                    `;
                } else {
                    actionHtml = `<span style="color: var(--text-muted); font-size: 0.75rem;">跟随关系已完全冻结解除</span>`;
                }

                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${r.id}">${String(r.id || '').substring(0, 8)}...</td>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${r.followerId}">${followerDisplay}</td>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${r.leaderId}">${leaderDisplay}</td>
                        <td>
                            <div style="font-size: 0.72rem;">
                                ${followDetailsStr}
                            </div>
                        </td>
                        <td style="font-size: 0.72rem; color: var(--text-secondary);">${date}</td>
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <div>${statusBadge}</div>
                                <div style="font-size: 0.65rem; color: var(--text-secondary);">累计盈亏: ${pnlText}</div>
                            </div>
                        </td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        } else {
            showToast(res.errorMessage || '获取跟随关系列表失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ 网络或跟随数据流同步失败！', true);
    }
}
window.loadCopyTradingRelations = loadCopyTradingRelations;

function resetRelationsFilters() {
    const follower = document.getElementById('filter-relations-follower');
    const leader = document.getElementById('filter-relations-leader');
    if (follower) follower.value = '';
    if (leader) leader.value = '';
    window.adminPages.relations.current = 1;
    loadCopyTradingRelations();
    showToast('✓ 跟随关系检索条件已重置', false);
}
window.resetRelationsFilters = resetRelationsFilters;

async function handleLeaderAudit(leaderId, approved) {
    const actionText = approved ? '批准通过该导师的社区带单资质申请吗？' : '驳回并拒绝该导师的带单资质申请吗？';
    if (!confirm(`确认要${actionText}`)) return;
    
    const path = `/copy-trading/leaders/${leaderId}/${approved ? 'approve' : 'reject'}`;
    try {
        const res = await apiFetch('POST', path, {}, true);
        if (res.code === 200) {
            showToast(`✓ 导师带单申请已成功${approved ? '审核准入' : '驳回拒绝'}！`, false);
            loadCopyTradingLeaders();
        } else {
            showToast(res.errorMessage || '操作失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ 触发核心审核通信失败！', true);
    }
}
window.handleLeaderAudit = handleLeaderAudit;

async function toggleLeaderStatus(leaderId) {
    if (!confirm('确认要切换该导师的带单状态（启用/禁用）吗？')) return;
    
    try {
        const res = await apiFetch('POST', `/copy-trading/leaders/${leaderId}/toggle-status`, {}, true);
        if (res.code === 200) {
            showToast('✓ 导师带单资质启用/禁用状态已实时更新！', false);
            loadCopyTradingLeaders();
        } else {
            showToast(res.errorMessage || '切换状态失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ 切换导师可用性指令发送失败！', true);
    }
}
window.toggleLeaderStatus = toggleLeaderStatus;

async function syncLeaderStats(leaderId) {
    showToast('⏳ 正在触发全网智能指标同步计算...', false);
    try {
        const res = await apiFetch('POST', `/copy-trading/leaders/${leaderId}/sync-stats`, {}, true);
        if (res.code === 200) {
            showToast('✓ 该导师的累计收益率与跟随者数据已重新校准热刷新！', false);
            loadCopyTradingLeaders();
        } else {
            showToast(res.errorMessage || '同步失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ 统计服务热计算连接中断！', true);
    }
}
window.syncLeaderStats = syncLeaderStats;

async function handleFollowRelation(relationId, action) {
    let actionChinese = '';
    if (action === 'pause') actionChinese = '暂停跟单关系吗？暂停后持仓将不再联动同步。';
    else if (action === 'resume') actionChinese = '恢复该笔被暂停的跟单绑定关系吗？';
    else if (action === 'terminate') actionChinese = '强制永久切断并解绑该笔跟随关系吗？此操作不可逆！';
    
    if (!confirm(`确认要${actionChinese}`)) return;

    let body = {};
    if (action === 'pause') {
        const reason = prompt('请输入暂停跟单原因:');
        if (reason === null) return;
        body = reason || '管理员风控暂停';
    } else if (action === 'terminate') {
        const reason = prompt('请输入解绑跟随关系原因:');
        if (reason === null) return;
        body = reason || '管理员一键风控强制解绑';
    }

    try {
        const res = await apiFetch('POST', `/copy-trading/relations/${relationId}/${action}`, body, true);
        if (res.code === 200) {
            showToast(`✓ 跟随绑定状态已被管理员强制${action === 'pause' ? '暂停' : (action === 'resume' ? '恢复' : '解绑终止')}！`, false);
            loadCopyTradingRelations();
        } else {
            showToast(res.errorMessage || '操作失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ 指令下发失败，与关系风控中心通信中断！', true);
    }
}
window.handleFollowRelation = handleFollowRelation;

function translateInstrument(id) {
    const dict = {
        '1126151490264633456': 'BTC/USDT',
        '1126151490264633457': 'ETH/USDT',
        '1126151490264633458': 'SOL/USDT'
    };
    return dict[String(id || '')] || id;
}

async function viewLeaderPositions(userId) {
    const modal = document.getElementById('leader-positions-modal');
    if (!modal) return;
    
    document.getElementById('lpos-leader-name-title').innerText = userId;
    const bodyEl = document.getElementById('leader-positions-table-body');
    if (bodyEl) {
        bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">⏳ 正在读取导师活动持仓...</td></tr>`;
    }
    
    modal.style.display = 'flex';
    
    try {
        const res = await apiFetch('GET', `/copy-trading/leaders/${userId}/positions`, null, true);
        if (res.code === 200 && bodyEl) {
            const list = res.result || res.data || [];
            if (list.length === 0) {
                bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">该导师当前无活动持仓</td></tr>`;
                return;
            }
            bodyEl.innerHTML = list.map(pos => {
                const sideBadge = pos.side === 'BUY' 
                    ? `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold;">📈 多头 Long</span>` 
                    : `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #EF4444; font-weight: bold;">📉 空头 Short</span>`;
                
                const pnlVal = parseFloat(pos.unrealizedPnl || 0);
                const pnlColor = pnlVal > 0 ? 'var(--green)' : (pnlVal < 0 ? 'var(--red)' : 'var(--text-secondary)');
                const pnlText = `<span style="color: ${pnlColor}; font-weight: bold; font-family: 'Outfit';">${pnlVal > 0 ? '+' : ''}${pnlVal.toFixed(4)} USDT</span>`;

                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${pos.id}">${String(pos.id || '').substring(0, 8)}...</td>
                        <td><span style="font-weight: 600; color: var(--text-primary);">${translateInstrument(pos.instrumentId)}</span></td>
                        <td>${sideBadge}</td>
                        <td><span style="font-weight: 600;">${parseFloat(pos.quantity).toFixed(4)}</span></td>
                        <td><span style="font-family: 'Outfit'; font-size: 0.75rem;">${parseFloat(pos.openPrice).toFixed(2)}</span></td>
                        <td><span style="font-family: 'Outfit'; font-size: 0.75rem;">${parseFloat(pos.currentPrice || pos.openPrice).toFixed(2)}</span></td>
                        <td>${pnlText}</td>
                        <td>
                            <button class="action-btn btn-reject" style="padding: 4px 8px; font-size: 0.7rem; font-weight: 600;" onclick="forceClosePosition('${pos.id}', '${userId}')">⚡ 强制平仓</button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else if (bodyEl) {
            bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--red); padding: 30px 0;">❌ 读取失败: ${res.errorMessage || '接口报错'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        if (bodyEl) {
            bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--red); padding: 30px 0;">❌ 网络或清算服务器连接错误</td></tr>`;
        }
    }
}
window.viewLeaderPositions = viewLeaderPositions;

function closeLeaderPositionsModal() {
    const modal = document.getElementById('leader-positions-modal');
    if (modal) modal.style.display = 'none';
}
window.closeLeaderPositionsModal = closeLeaderPositionsModal;

async function forceClosePosition(positionId, userId) {
    const priceStr = prompt('请输入强制平仓执行价格 (USDT):');
    if (priceStr === null) return;
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
        showToast('❌ 请输入合法的平仓价格！', true);
        return;
    }
    
    if (!confirm(`确认要以 ${price} USDT 价格强制平仓该笔订单 (${positionId}) 吗？系统将自动触发跟随者仓位联动平仓并以该价格结算！`)) {
        return;
    }
    
    try {
        const body = { closePrice: price };
        const res = await apiFetch('POST', `/copy-trading/positions/${positionId}/close`, body, true);
        if (res.code === 200) {
            showToast('✓ 强制平仓撮合指令已成功下达并完成结算！', false);
            viewLeaderPositions(userId);
        } else {
            showToast(res.errorMessage || '强制平仓失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ 网络或清仓撮合通信故障！', true);
    }
}
window.forceClosePosition = forceClosePosition;

async function loadCopyTradingStats() {
    try {
        const res = await apiFetch('GET', '/copy-trading/statistics', null, true);
        if (res.code === 200) {
            const data = res.result || res.data || {};
            
            const leadersEl = document.getElementById('ct-stats-leaders');
            const relationsEl = document.getElementById('ct-stats-relations');
            const volumeEl = document.getElementById('ct-stats-volume');
            const profitShareEl = document.getElementById('ct-stats-profitshare');
            
            if (leadersEl) {
                leadersEl.innerText = `${data.totalLeaders || 0} / ${data.activeLeaders || 0}`;
            }
            if (relationsEl) {
                relationsEl.innerText = `${data.totalRelations || 0} / ${data.activeRelations || 0}`;
            }
            if (volumeEl) {
                volumeEl.innerText = data.totalVolume ? parseFloat(data.totalVolume).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
            }
            if (profitShareEl) {
                profitShareEl.innerText = data.totalProfitSharing ? parseFloat(data.totalProfitSharing).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
            }
        }
    } catch (e) {
        console.error('[CopyTrading] Failed to load statistics:', e);
    }
}
window.loadCopyTradingStats = loadCopyTradingStats;


export // --- LEADER ORDERS & FOLLOWERS AUDITING CENTER ---
async function loadCopyTradingOrders() {
    if (!currentAdmin) return;
    
    const filterLeader = document.getElementById('filter-orders-leader')?.value.trim().toLowerCase() || '';
    const filterSymbol = document.getElementById('filter-orders-symbol')?.value.trim().toLowerCase() || '';
    const filterStatus = document.getElementById('filter-orders-status')?.value || 'ALL';
    
    let url = '/copy-trading/leader-orders?page=1&pageSize=500';
    try {
        const res = await apiFetch('GET', url, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            window.cachedLeaderOrders = list;
            const bodyEl = document.getElementById('copytrading-orders-table-body');
            if (!bodyEl) return;
            
            // Local hybrid search filter
            let filteredList = list;
            if (filterLeader !== '') {
                filteredList = filteredList.filter(o => String(o.leaderId || '').toLowerCase().includes(filterLeader));
            }
            if (filterSymbol !== '') {
                filteredList = filteredList.filter(o => String(o.instrumentSymbol || '').toLowerCase().includes(filterSymbol) || String(translateInstrument(o.instrumentId)).toLowerCase().includes(filterSymbol));
            }
            if (filterStatus !== 'ALL') {
                filteredList = filteredList.filter(o => String(o.status || '') === filterStatus);
            }
            
            if (filteredList.length === 0) {
                bodyEl.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的导师带单历史订单</td></tr>`;
                const indicator = document.getElementById(`orders-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            const paginatedList = paginateList(filteredList, 'orders');
            
            bodyEl.innerHTML = paginatedList.map(o => {
                const date = o.createdAt ? new Date(parseInt(o.createdAt)).toLocaleString() : '--';
                
                const sideBadge = o.side === 'BUY' 
                    ? `<span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold;">📈 多 BUY</span>` 
                    : `<span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #EF4444; font-weight: bold;">📉 空 SELL</span>`;
                
                let statusClass = 'PENDING';
                if (o.status === 'COMPLETED') statusClass = 'APPROVED';
                else if (o.status === 'FAILED') statusClass = 'REJECTED';
                else if (o.status === 'CANCELLED') statusClass = 'REJECTED';
                else if (o.status === 'EXECUTING') statusClass = 'PENDING';
                
                const statusBadge = `
                    <span class="badge badge-${statusClass}">
                        <span class="badge-status-dot"></span>
                        ${o.status || 'UNKNOWN'}
                    </span>
                `;
                
                const followersOverview = `
                    <div style="font-size: 0.72rem; line-height: 1.4;">
                        共 <b style="color: var(--primary);">${o.totalFollowers || 0}</b> 人 
                        (成功 <span style="color: var(--green); font-weight: 600;">${o.successCount || 0}</span> 
                        / 失败 <span style="color: var(--red); font-weight: 600;">${o.failedCount || 0}</span>)
                    </div>
                `;
                
                const totalVol = o.totalVolume ? parseFloat(o.totalVolume).toFixed(2) : '0.00';
                const qtyText = o.quantity ? parseFloat(o.quantity).toFixed(4) : '--';
                const priceText = o.price ? parseFloat(o.price).toFixed(2) : '--';
                
                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${String(o.id || '')}">${String(o.id || '')}</td>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${String(o.leaderId || '')}">${String(o.leaderId || '')}</td>
                        <td>
                            <div style="font-weight: 600; color: var(--text-primary);">${o.instrumentSymbol || translateInstrument(o.instrumentId)}</div>
                            <div style="font-size: 0.65rem; color: var(--text-secondary);">${o.orderType || 'MARKET'}</div>
                        </td>
                        <td>
                            <div style="margin-bottom: 2px;">${sideBadge}</div>
                            <div style="font-family: monospace; font-size: 0.72rem; font-weight: 500;">${priceText} USDT</div>
                        </td>
                        <td style="font-family: monospace; font-size: 0.75rem; font-weight: 600;">${qtyText}</td>
                        <td>${followersOverview}</td>
                        <td style="font-family: 'Outfit'; font-size: 0.75rem; font-weight: bold; color: var(--primary);">${totalVol}</td>
                        <td>
                            <div style="font-size: 0.68rem; color: var(--text-secondary); margin-bottom: 3px;">${date}</div>
                            <div>${statusBadge}</div>
                        </td>
                        <td>
                            <button class="action-btn" style="background: rgba(91, 81, 249, 0.1); border: 1px solid var(--primary); color: var(--primary); padding: 4px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; height: 26px;" onclick="viewLeaderOrderFollowers('${String(o.id || '')}')">👥 跟随明细</button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            showToast(res.errorMessage || '获取导师带单历史订单失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ 网络或数据同步历史订单失败！', true);
    }
}
window.loadCopyTradingOrders = loadCopyTradingOrders;

function resetOrdersFilters() {
    const leader = document.getElementById('filter-orders-leader');
    const symbol = document.getElementById('filter-orders-symbol');
    const status = document.getElementById('filter-orders-status');
    if (leader) leader.value = '';
    if (symbol) symbol.value = '';
    if (status) status.value = 'ALL';
    window.adminPages.orders.current = 1;
    loadCopyTradingOrders();
    showToast('✓ 订单检索条件已重置', false);
}
window.resetOrdersFilters = resetOrdersFilters;

async function viewLeaderOrderFollowers(orderId) {
    const modal = document.getElementById('leader-order-followers-modal');
    if (!modal) return;
    
    document.getElementById('lorder-followers-id-title').innerText = orderId;
    const bodyEl = document.getElementById('leader-order-followers-table-body');
    if (bodyEl) {
        bodyEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px 0;">⏳ 正在读取主订单跟随明细...</td></tr>`;
    }
    
    modal.style.display = 'flex';
    
    try {
        const res = await apiFetch('GET', `/copy-trading/leader-orders/${orderId}/followers`, null, true);
        if (res.code === 200 && bodyEl) {
            const list = res.result || res.data || [];
            if (list.length === 0) {
                bodyEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px 0;">该笔带单订单当前无任何粉丝跟随扣款明细</td></tr>`;
                return;
            }
            bodyEl.innerHTML = list.map(f => {
                let badgeColor = 'rgba(148, 163, 184, 0.1)';
                let badgeTextColor = '#94A3B8';
                
                const status = String(f.copyStatus || '').toUpperCase();
                if (status === 'SUCCESS' || status === 'FILLED') {
                    badgeColor = 'rgba(16, 185, 129, 0.1)';
                    badgeTextColor = '#10B981';
                } else if (status === 'PENDING') {
                    badgeColor = 'rgba(139, 92, 246, 0.1)';
                    badgeTextColor = '#8B5CF6';
                } else if (status === 'INSUFFICIENT_BALANCE' || status === 'SLIPPAGE_EXCEEDED' || status === 'PARTIAL_FILLED') {
                    badgeColor = 'rgba(245, 158, 11, 0.1)';
                    badgeTextColor = '#F59E0B';
                } else if (status === 'RISK_LIMIT' || status === 'ORDER_FAILED' || status === 'CANCELLED') {
                    badgeColor = 'rgba(239, 68, 68, 0.1)';
                    badgeTextColor = '#EF4444';
                }
                
                const statusBadge = `<span style="font-size: 0.7rem; padding: 3px 8px; border-radius: 4px; background: ${badgeColor}; color: ${badgeTextColor}; font-weight: bold; border: 1px solid ${badgeTextColor}33;">${f.copyStatus || 'UNKNOWN'}</span>`;
                
                const allocatedAmount = f.allocatedAmount ? parseFloat(f.allocatedAmount).toFixed(2) : '0.00';
                const allocatedQty = f.allocatedQty ? parseFloat(f.allocatedQty).toFixed(4) : '0.0000';
                
                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${String(f.relationId || '')}">${String(f.relationId || '').substring(0, 8)}...</td>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${String(f.followerId || '')}">${String(f.followerId || '')}</td>
                        <td style="font-family: 'Outfit'; font-size: 0.75rem; font-weight: bold; color: var(--primary);">${allocatedAmount} USDT</td>
                        <td style="font-family: monospace; font-size: 0.75rem; font-weight: 600;">${allocatedQty}</td>
                        <td>
                            <div style="font-size: 0.65rem; color: var(--text-secondary);">主订单: ${String(f.leaderOrderId || '')}</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted);">子订单: ${String(f.followerOrderId || '')}</div>
                        </td>
                        <td style="text-align: center;">
                            <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                                <div>${statusBadge}</div>
                                <div style="font-size: 0.65rem; color: var(--text-secondary);">${f.copyStatusText || ''}</div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else if (bodyEl) {
            bodyEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--red); padding: 30px 0;">❌ 读取失败: ${res.errorMessage || '接口报错'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        if (bodyEl) {
            bodyEl.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--red); padding: 30px 0;">❌ 网络或数据通信故障</td></tr>`;
        }
    }
}
window.viewLeaderOrderFollowers = viewLeaderOrderFollowers;

function closeLeaderOrderFollowersModal() {
    const modal = document.getElementById('leader-order-followers-modal');
    if (modal) modal.style.display = 'none';
}
window.closeLeaderOrderFollowersModal = closeLeaderOrderFollowersModal;


export // --- SINGLE QUANT ORDER MANUAL CLOSE & SETTLEMENT ---
async function handleSingleQuantSettle(orderId) {
    if (!currentAdmin) return;

    const order = (window.cachedQuantOrders || []).find(o => String(o.id) === String(orderId)) 
                 || (activeSettleOrders || []).find(o => String(o.id) === String(orderId));
                 
    if (!order) {
        showToast('❌ 未找到该笔跟单订单数据！', true);
        return;
    }
    
    // Attempt to resolve quantity
    let defaultQty = parseFloat(order.tradeQuantity || order.quantity || 0);
    if (defaultQty <= 0) {
        try {
            const tradesRes = await apiFetch('GET', `/trading/quant/orders/${orderId}/trades`, null, true);
            if (tradesRes.code === 200) {
                const trades = tradesRes.result || tradesRes.data || [];
                if (trades.length > 0) {
                    const lastTrade = trades[trades.length - 1];
                    defaultQty = parseFloat(lastTrade.quantity || 0);
                }
            }
        } catch(e) {
            console.error(e);
        }
    }
    
    if (defaultQty <= 0) {
        const qtyStr = prompt('该订单尚未建立初始持仓或持仓量为0，请输入要强制平仓结算的交易数量 (Quantity):', '0.0010');
        if (qtyStr === null) return;
        defaultQty = parseFloat(qtyStr);
        if (isNaN(defaultQty) || defaultQty <= 0) {
            showToast('❌ 数量必须大于0！', true);
            return;
        }
    }
    
    const priceStr = prompt(`请输入该笔量化订单 (用户 UID: ${order.userId}) 的手动平仓结算价格 (USDT):`);
    if (priceStr === null) return;
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
        showToast('❌ 请输入合法的平仓结算价格！', true);
        return;
    }
    
    if (!confirm(`⚠️ 您确定要以 ${price} USDT 的平仓价格、${defaultQty.toFixed(4)} 的平仓数量对该笔跟单订单执行 [强制平仓结算] 吗？系统将直接以该价格完成盈余清算，资金实时热转入用户余额，此操作不可撤回！`)) {
        return;
    }
    
    const instrumentId = order.instrumentId || '1126151490264633456';
    const payload = {
        orderId: orderId,
        instrumentId: instrumentId,
        price: price,
        quantity: defaultQty
    };
    
    showToast('⏳ 正在提交人工强平结算撮合指令...', false);
    
    try {
        const res = await apiFetch('POST', '/trading/quant/trades/sell', payload, true);
        if (res.code === 200) {
            showToast(`✓ 人工强平结算成功！价格: ${price.toFixed(2)}, 数量: ${defaultQty.toFixed(4)}。本息与分红已实时到账。`, false);
            loadDashboardStats();
            if (activeTab === 'quant') loadQuantMonitor();
            if (activeTab === 'quant-settle') loadQuantSettleList();
        } else {
            showToast(res.errorMessage || '强制平仓结算操作被后端拒绝！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('❌ 强制结算指令下达网络异常！', true);
    }
}
window.handleSingleQuantSettle = handleSingleQuantSettle;