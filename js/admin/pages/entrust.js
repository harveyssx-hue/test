// js/admin/pages/entrust.js
window.adminPages = window.adminPages || {};
window.adminPages.entrust = window.adminPages.entrust || { current: 1, size: 10, totalPages: 1 };

// Helper to calculate timezone offset and parse local datetime inputs
function getTimestampInTimezone(dateTimeStr, timeZone) {
    if (!dateTimeStr) return 0;
    const parts = dateTimeStr.split(/[-TH:]/);
    if (parts.length < 5) return 0;
    
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    const hour = parseInt(parts[3]);
    const minute = parseInt(parts[4]);
    
    const localUtc = Date.UTC(year, month - 1, day, hour, minute);
    
    try {
        const dummyDate = new Date(localUtc);
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        });
        const formattedParts = formatter.formatToParts(dummyDate);
        
        let tzYear = year, tzMonth = month - 1, tzDay = day, tzHour = hour, tzMinute = minute, tzSecond = 0;
        let isPM = false;
        
        formattedParts.forEach(p => {
            if (p.type === 'year') tzYear = parseInt(p.value);
            else if (p.type === 'month') tzMonth = parseInt(p.value) - 1;
            else if (p.type === 'day') tzDay = parseInt(p.value);
            else if (p.type === 'hour') tzHour = parseInt(p.value);
            else if (p.type === 'minute') tzMinute = parseInt(p.value);
            else if (p.type === 'second') tzSecond = parseInt(p.value);
            else if (p.type === 'dayPeriod') {
                const val = p.value.toUpperCase();
                if (val.includes('PM')) {
                    isPM = true;
                }
            }
        });
        
        if (isPM && tzHour < 12) {
            tzHour += 12;
        } else if (!isPM && tzHour === 12) {
            tzHour = 0;
        }
        
        const tzDateUtc = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond);
        const offset = tzDateUtc - dummyDate.getTime();
        
        return localUtc - offset;
    } catch (e) {
        console.error("Timezone offset calculation failed, fallback to local parsing:", e);
        return new Date(dateTimeStr).getTime();
    }
}

function getCurrentTimeInTimezone(timeZone, offsetMinutes = 0) {
    try {
        const now = new Date();
        if (offsetMinutes !== 0) {
            now.setMinutes(now.getMinutes() + offsetMinutes);
        }
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const parts = formatter.formatToParts(now);
        let year, month, day, hour, minute;
        parts.forEach(p => {
            if (p.type === 'year') year = p.value;
            else if (p.type === 'month') month = p.value;
            else if (p.type === 'day') day = p.value;
            else if (p.type === 'hour') {
                let val = parseInt(p.value);
                if (val === 24) val = 0;
                hour = String(val).padStart(2, '0');
            }
            else if (p.type === 'minute') minute = p.value;
        });
        return `${year}-${month}-${day}T${hour}:${minute}`;
    } catch (e) {
        console.error("Failed to format current time in timezone:", e);
        const now = new Date();
        if (offsetMinutes !== 0) {
            now.setMinutes(now.getMinutes() + offsetMinutes);
        }
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
    }
}

// 1. Query Entrusted Orders List
export async function loadEntrustOrdersList() {
    const tbody = document.getElementById('entrust-orders-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 30px 0;">🔄 正在加载委托交易订单...</td></tr>`;

    // Fetch filters
    const id = document.getElementById('filter-entrust-id').value.trim();
    const userId = document.getElementById('filter-entrust-uid').value.trim();
    const orderNo = document.getElementById('filter-entrust-orderNo').value.trim();
    const instrumentSymbol = document.getElementById('filter-entrust-symbol').value.trim();
    const status = document.getElementById('filter-entrust-status').value;
    const startDateStr = document.getElementById('filter-entrust-start-date').value;
    const endDateStr = document.getElementById('filter-entrust-end-date').value;

    let startTime = '';
    let endTime = '';
    if (startDateStr) {
        startTime = new Date(startDateStr + 'T00:00:00').getTime();
    }
    if (endDateStr) {
        endTime = new Date(endDateStr + 'T23:59:59').getTime();
    }

    // Build URL query parameters
    let url = `/trading/entrust/orders?page=${window.adminPages.entrust.current}&pageSize=${window.adminPages.entrust.size}`;
    if (id) url += `&id=${id}`;
    if (userId) url += `&userId=${userId}`;
    if (orderNo) url += `&orderNo=${encodeURIComponent(orderNo)}`;
    if (instrumentSymbol) url += `&instrumentSymbol=${encodeURIComponent(instrumentSymbol)}`;
    if (status !== 'ALL') url += `&status=${status}`;
    if (startTime) url += `&startTime=${startTime}`;
    if (endTime) url += `&endTime=${endTime}`;

    try {
        const res = await apiFetch('GET', url, null, true);
        if (res && res.code === 200) {
            const list = res.data || res.result || [];
            const paging = res.paging || {};
            
            // Update pagination values
            window.adminPages.entrust.totalPages = paging.pages || 1;
            updateAdminPageIndicator('entrust', paging.page || 1, paging.pages || 1, paging.records || 0);

            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 30px 0;">全站暂无符合筛选条件的委托交易订单</td></tr>`;
                return;
            }

            tbody.innerHTML = list.map(o => {
                let statusBadge = '';
                if (o.status === 'PENDING') {
                    statusBadge = `<span class="badge badge-pending">待执行</span>`;
                } else if (o.status === 'COMPLETED') {
                    statusBadge = `<span class="badge badge-success">已完成</span>`;
                } else if (o.status === 'REJECTED') {
                    statusBadge = `<span class="badge badge-rejected">已驳回</span>`;
                } else {
                    statusBadge = `<span class="badge badge-muted">${o.status}</span>`;
                }

                const createTime = o.createdAt ? new Date(parseInt(o.createdAt)).toLocaleString() : '--';
                const settleTime = o.settledAt ? new Date(parseInt(o.settledAt)).toLocaleString() : (o.rejectedAt ? `已驳回: ${new Date(parseInt(o.rejectedAt)).toLocaleString()}` : '--');

                // Generate actions
                let actionsHtml = `<button class="action-btn btn-detail" onclick="openEntrustDetailModal('${o.id}')" style="background: var(--primary); color: #FFF; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; border: none; cursor: pointer; margin-right: 4px;">👁️ 详情</button>`;
                
                if (o.status === 'PENDING') {
                    if (o.executable) {
                        actionsHtml += `<button class="action-btn" onclick="openEntrustExecuteModal('${o.id}', '${o.orderNo}', '${o.investAmount}', '${o.assetClass}', '${o.exchangeTimezone}', '${o.createdAt}')" style="background: var(--green); color: #FFF; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; border: none; cursor: pointer; margin-right: 4px;">▶ 执行</button>`;
                    }
                    actionsHtml += `<button class="action-btn" onclick="openEntrustRejectModal('${o.id}')" style="background: var(--red); color: #FFF; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; border: none; cursor: pointer;">驳回</button>`;
                } else if (o.status === 'COMPLETED') {
                    actionsHtml += `<button class="action-btn" onclick="openEntrustTradesModal('${o.id}')" style="background: #0EA5E9; color: #FFF; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; border: none; cursor: pointer;">成交记录</button>`;
                }

                const fee = parseFloat(o.feeAmount || 0);
                const investAmt = parseFloat(o.investAmount || 0);
                const estBuyFee = parseFloat(o.estimatedBuyFee || 0);

                return `
                    <tr>
                        <td><strong style="font-family: monospace; font-size: 0.78rem;">${o.id}</strong></td>
                        <td>
                            <div>👤 UID: <strong>${o.userId}</strong></div>
                        </td>
                        <td>
                            <div style="font-weight: 700;">${o.instrumentName}</div>
                            <div style="font-size: 0.68rem; color: var(--text-muted); font-family: monospace;">${o.instrumentCode} [${o.assetClass}]</div>
                        </td>
                        <td><span style="font-family: monospace; font-size: 0.72rem;">${o.orderNo}</span></td>
                        <td><code style="font-size: 0.7rem; font-weight: 600; background: rgba(91,81,249,0.06); padding: 2px 4px; border-radius: 4px; color: var(--primary);">${o.riskLevel || 'DEFAULT'}</code></td>
                        <td>
                            <div style="font-weight: 700; color: var(--text-primary);">${investAmt.toFixed(2)} USDT</div>
                            <div style="font-size: 0.68rem; color: var(--text-muted);">预估规费: ${estBuyFee.toFixed(2)} USDT</div>
                        </td>
                        <td>
                            <div style="font-weight: 700; color: var(--text-primary);">${fee > 0 ? `${fee.toFixed(2)} USDT` : '--'}</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted);">${fee > 0 ? `买:${parseFloat(o.actualBuyFee || 0).toFixed(2)} 卖:${parseFloat(o.actualSellFee || 0).toFixed(2)}` : ''}</div>
                        </td>
                        <td>
                            <div style="color: ${parseFloat(o.actualProfit || 0) >= 0 ? 'var(--green)' : 'var(--red)'}; font-weight: 700;">
                                ${o.status === 'COMPLETED' ? `${parseFloat(o.actualProfit || 0).toFixed(2)} USDT` : '--'}
                            </div>
                            <div style="font-size: 0.65rem; color: var(--text-muted);">${o.status === 'COMPLETED' ? `毛利:${parseFloat(o.investmentProfit || 0).toFixed(2)}` : ''}</div>
                        </td>
                        <td style="font-size: 0.68rem; color: var(--text-secondary); line-height: 1.4;">
                            <div>起: ${createTime}</div>
                            <div>结: ${settleTime}</div>
                        </td>
                        <td style="text-align: center;">${statusBadge}</td>
                        <td class="sticky-right" style="text-align: center;">${actionsHtml}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--red); padding: 30px 0;">❌ 加载订单失败: ${res ? res.errorMessage : '未知错误'}</td></tr>`;
        }
    } catch (e) {
        console.error("Failed to load entrust orders list:", e);
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--red); padding: 30px 0;">❌ 与服务器通信中断，加载失败</td></tr>`;
    }
}
window.loadEntrustOrdersList = loadEntrustOrdersList;

export function resetEntrustFilters() {
    document.getElementById('filter-entrust-id').value = '';
    document.getElementById('filter-entrust-uid').value = '';
    document.getElementById('filter-entrust-orderNo').value = '';
    document.getElementById('filter-entrust-symbol').value = '';
    document.getElementById('filter-entrust-status').value = 'PENDING';
    document.getElementById('filter-entrust-start-date').value = '';
    document.getElementById('filter-entrust-end-date').value = '';
    window.adminPages.entrust.current = 1;
    loadEntrustOrdersList();
}
window.resetEntrustFilters = resetEntrustFilters;

// 2. Open Order Details Modal
export async function openEntrustDetailModal(orderId) {
    const modal = document.getElementById('entrust-detail-modal');
    if (!modal) return;

    try {
        const res = await apiFetch('GET', `/trading/entrust/orders/${orderId}`, null, true);
        if (res && res.code === 200 && res.data) {
            const d = res.data;
            const container = modal.querySelector('.modal-content-payment');
            
            // Simple string template replacement helper to render details inside the modal
            let html = container.innerHTML;
            
            // Build dynamic detail elements
            let statusBadge = '';
            if (d.status === 'PENDING') statusBadge = `<span class="badge badge-pending">待执行 (PENDING)</span>`;
            else if (d.status === 'COMPLETED') statusBadge = `<span class="badge badge-success">已完成 (COMPLETED)</span>`;
            else if (d.status === 'REJECTED') statusBadge = `<span class="badge badge-rejected">已驳回 (REJECTED)</span>`;
            
            const createTime = d.createdAt ? new Date(parseInt(d.createdAt)).toLocaleString() : '--';
            const rejectedTime = d.rejectedAt ? new Date(parseInt(d.rejectedAt)).toLocaleString() : '--';
            const settledTime = d.settledAt ? new Date(parseInt(d.settledAt)).toLocaleString() : '--';

            // Build dynamic detail panel content
            let detailsPanel = `
                <button class="drawer-close-btn" onclick="closeEntrustDetailModal()" style="position: absolute; top: 20px; right: 20px; font-size: 1.2rem; background: transparent; border: none; color: var(--text-secondary); cursor: pointer;">✕</button>
                <div class="modal-header-admin" style="margin-bottom: 18px; border-bottom: 1.5px solid var(--border-light); padding-bottom: 12px;">
                    <h2 style="font-size: 1.25rem; display: flex; align-items: center; gap: 8px; color: var(--primary); font-weight: bold; margin: 0;">📋 委托交易订单详情</h2>
                    <p style="font-size: 0.75rem; color: #64748B; margin-top: 4px; font-weight: 500;">查看该委托委托订单的完整参数、资产分配及清算结算明细数据</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.8rem; color: var(--text-primary); line-height: 1.6;">
                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-light); border-radius: 8px; padding: 12px;">
                        <div style="font-weight: 700; color: var(--primary); margin-bottom: 8px; font-size: 0.82rem; border-bottom: 1px solid var(--border-light); padding-bottom: 4px;">基本参数</div>
                        <div>🆔 订单 ID: <strong style="font-family: monospace;">${d.id}</strong></div>
                        <div>👤 用户 UID: <strong>${d.userId}</strong></div>
                        <div>📄 订单编号: <strong style="font-family: monospace;">${d.orderNo}</strong></div>
                        <div>🛡️ 风险等级: <strong>${d.riskLevel || '--'}</strong></div>
                        <div>⚡ 当前可执行: <strong style="color: ${d.executable ? 'var(--green)' : 'var(--red)'};">${d.executable ? '是 (YES)' : '否 (NO)'}</strong></div>
                    </div>
                    
                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-light); border-radius: 8px; padding: 12px;">
                        <div style="font-weight: 700; color: var(--primary); margin-bottom: 8px; font-size: 0.82rem; border-bottom: 1px solid var(--border-light); padding-bottom: 4px;">商品市场信息</div>
                        <div>交易商品: <strong>${d.instrumentName} (${d.instrumentCode})</strong></div>
                        <div>资产类别: <code>${d.assetClass}</code></div>
                        <div>交易所: <strong>${d.exchangeCode || '--'}</strong> (ID: ${d.exchangeId})</div>
                        <div>市场时区: <code>${d.exchangeTimezone || '--'}</code></div>
                    </div>

                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-light); border-radius: 8px; padding: 12px;">
                        <div style="font-weight: 700; color: var(--primary); margin-bottom: 8px; font-size: 0.82rem; border-bottom: 1px solid var(--border-light); padding-bottom: 4px;">投资与费用快照</div>
                        <div>💰 投资本金: <strong>${parseFloat(d.investAmount || 0).toFixed(2)} USDT</strong></div>
                        <div>🛑 止损率 (StopLoss): <strong>${parseFloat(d.stopLossRate || 0) * 100}%</strong></div>
                        <div>🏷️ 预估买入费用: <strong>${parseFloat(d.estimatedBuyFee || 0).toFixed(2)} USDT</strong></div>
                    </div>

                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-light); border-radius: 8px; padding: 12px;">
                        <div style="font-weight: 700; color: var(--primary); margin-bottom: 8px; font-size: 0.82rem; border-bottom: 1px solid var(--border-light); padding-bottom: 4px;">最终清算核算</div>
                        <div>买入成交手续费: <strong>${parseFloat(d.actualBuyFee || 0).toFixed(2)} USDT</strong></div>
                        <div>卖出成交手续费: <strong>${parseFloat(d.actualSellFee || 0).toFixed(2)} USDT</strong></div>
                        <div>服务总费用 (Fee): <strong>${parseFloat(d.feeAmount || 0).toFixed(2)} USDT</strong></div>
                        <div>物理投资毛利: <strong style="color: ${parseFloat(d.investmentProfit || 0) >= 0 ? 'var(--green)' : 'var(--red)'};">${parseFloat(d.investmentProfit || 0).toFixed(2)} USDT</strong></div>
                        <div>实际净收益 (Net): <strong style="color: ${parseFloat(d.actualProfit || 0) >= 0 ? 'var(--green)' : 'var(--red)'}; font-size: 0.85rem;">${parseFloat(d.actualProfit || 0).toFixed(2)} USDT</strong></div>
                    </div>
                    
                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-light); border-radius: 8px; padding: 12px; grid-column: 1 / -1;">
                        <div style="font-weight: 700; color: var(--primary); margin-bottom: 8px; font-size: 0.82rem; border-bottom: 1px solid var(--border-light); padding-bottom: 4px;">时间流水记录</div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
                            <div>🕒 提交时间: <span>${createTime}</span></div>
                            <div>🕒 驳回时间: <span>${rejectedTime}</span></div>
                            <div>🕒 结算完成: <span>${settledTime}</span></div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; border-top: 1.5px solid var(--border-light); padding-top: 15px;">
                    <span style="align-self: center; margin-right: auto; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">状态: ${statusBadge}</span>
                    <button class="action-btn" onclick="closeEntrustDetailModal()" style="background: #E2E8F0; color: #475569; font-size: 0.75rem; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;">关闭详情</button>
            `;

            if (d.status === 'PENDING') {
                if (d.executable) {
                    detailsPanel += `
                        <button class="action-btn" onclick="closeEntrustDetailModal(); openEntrustExecuteModal('${d.id}', '${d.orderNo}', '${d.investAmount}', '${d.assetClass}', '${d.exchangeTimezone}', '${d.createdAt}')" style="background: var(--green); color: #FFF; font-size: 0.75rem; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;">▶ 去执行</button>
                    `;
                }
                detailsPanel += `
                    <button class="action-btn" onclick="closeEntrustDetailModal(); openEntrustRejectModal('${d.id}')" style="background: var(--red); color: #FFF; font-size: 0.75rem; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;">驳回订单</button>
                `;
            } else if (d.status === 'COMPLETED') {
                detailsPanel += `
                    <button class="action-btn" onclick="closeEntrustDetailModal(); openEntrustTradesModal('${d.id}')" style="background: #0EA5E9; color: #FFF; font-size: 0.75rem; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;">查看成交记录</button>
                `;
            }

            detailsPanel += `</div>`;
            container.innerHTML = detailsPanel;
            
            modal.style.display = 'flex';
            modal.classList.add('active');
        } else {
            showToast('获取订单详情失败: ' + (res ? res.errorMessage : '未知错误'), true);
        }
    } catch (e) {
        console.error("Failed to load entrust order detail:", e);
        showToast('❌ 与服务器通信失败', true);
    }
}
window.openEntrustDetailModal = openEntrustDetailModal;

export function closeEntrustDetailModal() {
    const modal = document.getElementById('entrust-detail-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}
window.closeEntrustDetailModal = closeEntrustDetailModal;

// 3. Open Execute Order Modal
export function openEntrustExecuteModal(orderId, orderNo, investAmount, assetClass, exchangeTimezone, createdAt) {
    const modal = document.getElementById('entrust-execute-modal');
    if (!modal) return;

    // Reset execute form
    const form = document.getElementById('entrust-execute-form');
    if (form) form.reset();

    // Populate hidden & header details
    document.getElementById('eexec-order-id').value = orderId;
    document.getElementById('eexec-timezone').value = exchangeTimezone || 'UTC';
    document.getElementById('eexec-order-created-at').value = createdAt || '';
    
    document.getElementById('eexec-orderNo-text').innerText = orderNo;
    document.getElementById('eexec-asset-text').innerText = assetClass || '--';
    document.getElementById('eexec-amount-text').innerText = `${parseFloat(investAmount || 0).toFixed(2)} USDT`;

    // Populate default times based on exchange timezone
    const tz = exchangeTimezone || 'Asia/Kolkata';
    const nowStr = getCurrentTimeInTimezone(tz);
    const tenMinLaterStr = getCurrentTimeInTimezone(tz, 10);
    
    document.getElementById('eexec-buy-time').value = nowStr;
    document.getElementById('eexec-sell-time').value = tenMinLaterStr;

    modal.style.display = 'flex';
    modal.classList.add('active');
}
window.openEntrustExecuteModal = openEntrustExecuteModal;

export function closeEntrustExecuteModal() {
    const modal = document.getElementById('entrust-execute-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}
window.closeEntrustExecuteModal = closeEntrustExecuteModal;

// 4. Submit Order Execution
export async function submitEntrustExecute(event) {
    if (event) event.preventDefault();

    const orderId = document.getElementById('eexec-order-id').value;
    const timezone = document.getElementById('eexec-timezone').value;
    const createdAtMs = parseInt(document.getElementById('eexec-order-created-at').value || 0);

    const buyAmount = document.getElementById('eexec-buy-amount').value.trim();
    const buyTimeStr = document.getElementById('eexec-buy-time').value;
    const buyBrokerageRate = document.getElementById('eexec-buy-brokerage').value.trim();
    const buyExchangeFeeRate = document.getElementById('eexec-buy-exchange').value.trim();

    const sellAmount = document.getElementById('eexec-sell-amount').value.trim();
    const sellTimeStr = document.getElementById('eexec-sell-time').value;
    const sellBrokerageRate = document.getElementById('eexec-sell-brokerage').value.trim();
    const sellExchangeFeeRate = document.getElementById('eexec-sell-exchange').value.trim();

    // Basic frontend validations
    if (!orderId || !buyAmount || !buyTimeStr || !sellAmount || !sellTimeStr) {
        showToast('❌ 请完整填写买入及卖出必填成交参数！', true);
        return;
    }

    const buyVal = parseFloat(buyAmount);
    const sellVal = parseFloat(sellAmount);

    if (isNaN(buyVal) || buyVal <= 0 || isNaN(sellVal) || sellVal <= 0) {
        showToast('❌ 成交金额必须为大于 0 的有效数值！', true);
        return;
    }

    // Convert date string inputs to Unix seconds timestamps in exchange timezone
    const buyExecutedAt = Math.floor(getTimestampInTimezone(buyTimeStr, timezone) / 1000);
    const sellExecutedAt = Math.floor(getTimestampInTimezone(sellTimeStr, timezone) / 1000);

    if (!buyExecutedAt || !sellExecutedAt) {
        showToast('❌ 执行时间格式不正确！', true);
        return;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (buyExecutedAt > nowSec || sellExecutedAt > nowSec) {
        showToast('❌ 买卖成交时间不能晚于当前时间！', true);
        return;
    }

    const createdAtSec = Math.floor(createdAtMs / 1000);
    if (createdAtSec > 0 && buyExecutedAt <= createdAtSec) {
        showToast('❌ 买入成交时间必须晚于订单创建时间！', true);
        return;
    }

    if (sellExecutedAt <= buyExecutedAt) {
        showToast('❌ 卖出执行时间必须晚于买入执行时间！', true);
        return;
    }

    // Build execution payload
    const payload = {
        buyAmount: buyAmount,
        buyExecutedAt: buyExecutedAt,
        sellAmount: sellAmount,
        sellExecutedAt: sellExecutedAt
    };

    if (buyBrokerageRate !== '') payload.buyBrokerageRate = buyBrokerageRate;
    if (buyExchangeFeeRate !== '') payload.buyExchangeFeeRate = buyExchangeFeeRate;
    if (sellBrokerageRate !== '') payload.sellBrokerageRate = sellBrokerageRate;
    if (sellExchangeFeeRate !== '') payload.sellExchangeFeeRate = sellExchangeFeeRate;

    try {
        const res = await apiFetch('POST', `/trading/entrust/orders/${orderId}/execute`, payload, true);
        if (res && res.code === 200) {
            showToast('✓ 委托订单成功执行成交，清算收益入账完成！', false);
            closeEntrustExecuteModal();
            loadEntrustOrdersList();
        } else {
            const errCode = res ? res.code : '';
            let errorMsg = res ? res.errorMessage : '未知接口错误';
            if (errCode === 11001008) {
                errorMsg = '当前订单状态已变化，请刷新后重试！';
            }
            showToast(`❌ 执行失败: ${errorMsg}`, true);
        }
    } catch (e) {
        console.error("Entrust execution submission error:", e);
        showToast('❌ 与服务器通信失败，无法执行订单', true);
    }
}
window.submitEntrustExecute = submitEntrustExecute;

// 5. Open and Submit Reject Order Modal
export function openEntrustRejectModal(orderId) {
    if (!confirm(`您确定要驳回委托订单 ID: ${orderId} 吗？驳回后下单冻结的资金将自动解冻并返还给用户！`)) {
        return;
    }
    submitEntrustReject(orderId);
}
window.openEntrustRejectModal = openEntrustRejectModal;

export async function submitEntrustReject(orderId) {
    try {
        const res = await apiFetch('POST', `/trading/entrust/orders/${orderId}/reject`, null, true);
        if (res && res.code === 200) {
            showToast('✓ 订单驳回成功，冻结本金和预估费用已全额解冻！', false);
            loadEntrustOrdersList();
        } else {
            const errCode = res ? res.code : '';
            let errorMsg = res ? res.errorMessage : '未知接口错误';
            if (errCode === 11001008) {
                errorMsg = '当前订单状态已变化，请刷新后重试！';
            }
            showToast(`❌ 驳回失败: ${errorMsg}`, true);
        }
    } catch (e) {
        console.error("Entrust rejection error:", e);
        showToast('❌ 与服务器通信失败，无法驳回订单', true);
    }
}
window.submitEntrustReject = submitEntrustReject;

// 6. Open Order Trades List Modal
export async function openEntrustTradesModal(orderId) {
    const modal = document.getElementById('entrust-trades-modal');
    if (!modal) return;

    const tbody = document.getElementById('entrust-trades-tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px 0;">🔄 正在查询成交流水...</td></tr>`;
    }

    try {
        const res = await apiFetch('GET', `/trading/entrust/orders/${orderId}/trades`, null, true);
        if (res && res.code === 200 && tbody) {
            const list = res.data || res.result || [];
            
            // Sort trades ascending by executedAt
            list.sort((a, b) => parseInt(a.executedAt || 0) - parseInt(b.executedAt || 0));

            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px 0;">该委托交易订单暂未生成任何成交记录</td></tr>`;
            } else {
                tbody.innerHTML = list.map(t => {
                    const execTime = t.executedAt ? new Date(t.executedAt * 1000).toLocaleString() : '--';
                    const typeLabel = t.tradeType === 'BUY' ? 
                        `<span style="color: var(--green); font-weight: bold; background: rgba(16,185,129,0.1); padding: 2px 6px; border-radius: 4px;">🟢 买入 (BUY)</span>` : 
                        `<span style="color: var(--red); font-weight: bold; background: rgba(239,68,68,0.1); padding: 2px 6px; border-radius: 4px;">🔴 卖出 (SELL)</span>`;
                    
                    return `
                        <tr>
                            <td><strong style="font-family: monospace; font-size: 0.78rem;">${t.id}</strong></td>
                            <td>${typeLabel}</td>
                            <td>
                                <div style="font-weight: 700;">${t.instrumentName}</div>
                                <div style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${t.instrumentCode} @ ${t.exchangeCode}</div>
                            </td>
                            <td><strong style="font-size: 0.8rem; color: var(--text-primary);">${parseFloat(t.amount || 0).toFixed(2)} USDT</strong></td>
                            <td><strong>${parseFloat(t.feeAmount || 0).toFixed(2)} USDT</strong></td>
                            <td><code style="font-family: monospace;">${t.operatorId || '--'}</code></td>
                            <td style="font-size: 0.72rem; color: var(--text-secondary);">${execTime}</td>
                        </tr>
                    `;
                }).join('');
            }
            modal.style.display = 'flex';
            modal.classList.add('active');
        } else {
            showToast('获取成交流水失败: ' + (res ? res.errorMessage : '未知错误'), true);
        }
    } catch (e) {
        console.error("Failed to load entrust trades list:", e);
        showToast('❌ 与服务器通信失败', true);
    }
}
window.openEntrustTradesModal = openEntrustTradesModal;

export function closeEntrustTradesModal() {
    const modal = document.getElementById('entrust-trades-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}
window.closeEntrustTradesModal = closeEntrustTradesModal;
