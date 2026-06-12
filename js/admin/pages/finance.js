export // --- DEPOSIT AND WITHDRAWAL FINANCE AUDIT FUNCTIONS ---
async function loadDepositList() {
    if (!currentAdmin) return;
    
    const filterStatus = document.getElementById('deposit-status-filter').value;
    const phoneVal = document.getElementById('filter-deposit-phone')?.value.trim().toLowerCase() || '';
    const remittanceVal = document.getElementById('filter-deposit-remittance')?.value.trim().toLowerCase() || '';
    
    let url = '/finance/deposits?page=1&pageSize=100';
    if (filterStatus !== 'ALL') {
        url += `&status=${filterStatus}`;
    }
    
    try {
        // Pre-fetch users list to map userId to registration phone number
        let userPhoneMap = {};
        try {
            userPhoneMap = await window.adminState.getUserPhoneMap();
        } catch (e) {
            console.error('Failed to pre-fetch users for deposit phone mapping:', e);
        }

        const res = await apiFetch('GET', url, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            window.cachedDeposits = list;
            const bodyEl = document.getElementById('deposit-table-body');
            if (!bodyEl) return;
            
            // Apply local search filtering
            let filteredList = list;
            if (phoneVal !== '') {
                filteredList = filteredList.filter(d => {
                    const phone = userPhoneMap[String(d.userId)] || '';
                    return phone.toLowerCase().includes(phoneVal);
                });
            }
            if (remittanceVal !== '') {
                filteredList = filteredList.filter(d => {
                    const remittance = d.remittanceCode || '';
                    return remittance.toLowerCase().includes(remittanceVal);
                });
            }
            
            if (filteredList.length === 0) {
                bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的充值记录</td></tr>`;
                
                // Update pagination indicator
                const indicator = document.getElementById(`deposit-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            // Paginate the filtered list
            const paginatedList = paginateList(filteredList, 'deposit');
            
            bodyEl.innerHTML = paginatedList.map(d => {
                const date = d.createdAt ? new Date(parseInt(d.createdAt)).toLocaleString() : '--';
                const proofLink = d.paymentProof ? `<a href="javascript:void(0)" onclick="viewProofImage('${d.id}')" style="color: var(--primary); font-weight: 600; text-decoration: underline;">查看凭证 🔗</a>` : '无';
                
                let typeBadge = '';
                if (d.depositType === 'FIAT') {
                    typeBadge = `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.1); color: #3B82F6; font-weight: bold; display: inline-block;">💵 FIAT 法币</span>`;
                } else if (d.depositType === 'CRYPTO') {
                    typeBadge = `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold; display: inline-block;">🪙 CRYPTO 加密</span>`;
                } else {
                    typeBadge = `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.1); color: #94A3B8; font-weight: bold; display: inline-block;">${d.depositType || 'UNKNOWN'}</span>`;
                }

                let amountDetails = `<span style="font-weight: 700; color: var(--primary); font-size: 0.88rem;">${parseFloat(d.amount).toFixed(2)}</span>`;
                if (d.depositType === 'FIAT' && d.collectedAmount) {
                    amountDetails += `<br><span style="font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap;">实收: <b>${parseFloat(d.collectedAmount).toFixed(2)}</b> (汇率: ${parseFloat(d.collectionFxRate).toFixed(2)})</span>`;
                }

                let actionHtml = '';
                if (d.status === 'PENDING' || d.status === 'CONFIRMED') {
                    actionHtml = `
                        <div style="display: flex; gap: 6px; justify-content: center;">
                            <button class="action-btn btn-approve" style="padding: 4px 8px; font-size: 0.75rem;" onclick="handleDepositReview('${d.id}', 'credit')">入账</button>
                            <button class="action-btn btn-reject" style="padding: 4px 8px; font-size: 0.75rem;" onclick="handleDepositReview('${d.id}', 'reject')">拒绝</button>
                        </div>
                    `;
                } else {
                    actionHtml = `<span style="color: var(--text-muted); font-size: 0.75rem;">已归档</span>`;
                }
                
                const remittanceDisplay = d.remittanceCode ? (d.remittanceCode.length > 8 ? d.remittanceCode.substring(0, 8) + '...' : d.remittanceCode) : '--';
                const userPhone = userPhoneMap[String(d.userId)] || '--';
                
                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-primary);">${userPhone}</td>
                        <td>${typeBadge}</td>
                        <td>${amountDetails}</td>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${d.remittanceCode || ''}">${remittanceDisplay}</td>
                        <td>${proofLink}</td>
                        <td>
                            <span class="badge badge-${d.status}">
                                <span class="badge-status-dot"></span>
                                ${d.status}
                            </span>
                        </td>
                        <td style="color: var(--text-muted); font-size: 0.72rem;">${date}</td>
                        <td class="sticky-right" style="text-align: center;">${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        } else {
            showToast(res.errorMessage || '获取充值列表失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('获取充值列表网络异常！', true);
    }
}

async function handleDepositReview(id, action) {
    const actionLabel = action === 'credit' ? '确认入账并上账' : '拒绝并撤销该充值单';
    if (!confirm(`您确定要对充值单 ${id} 执行 [${actionLabel}] 操作吗？`)) return;
    
    showToast(`正在提交充值审计指令 [${action}]...`, false);
    try {
        const res = await apiFetch('POST', `/finance/deposits/${id}/${action}`, {}, true);
        if (res.code === 200) {
            showToast(`✓ 充值单 ${id} 处理成功：已完成${action === 'credit' ? '入账' : '驳回'}！`, false);
            loadDashboardStats();
            loadDepositList();
        } else {
            showToast(res.errorMessage || '充值审计操作失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('提交充值审计网络异常！', true);
    }
}

function viewProofImage(id) {
    const list = window.cachedDeposits || [];
    const deposit = list.find(d => String(d.id) === String(id));
    if (!deposit || !deposit.paymentProof) {
        showToast('⚠️ 找不到该笔充值的凭证图片！', true);
        return;
    }
    
    const modal = document.getElementById('proof-lightbox-modal');
    const img = document.getElementById('proof-lightbox-img');
    const errorEl = document.getElementById('proof-lightbox-error');
    if (modal && img) {
        let proofUrl = deposit.paymentProof;
        const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
        if (isLocalDev && (proofUrl.includes('storage.googleapis.com') || proofUrl.startsWith('http://') || proofUrl.startsWith('https://'))) {
            proofUrl = '/download-gcs?url=' + encodeURIComponent(proofUrl);
        }
        window.lastSelectedProofUrl = deposit.paymentProof;
        img.src = proofUrl;
        img.style.display = 'block';
        if (errorEl) errorEl.style.display = 'none';
        modal.style.display = 'flex';
        modal.classList.add('active');
    } else {
        showToast('⚠️ 凭证预览窗口未在页面中定义！', true);
    }
}

function handleProofImageError() {
    const img = document.getElementById('proof-lightbox-img');
    const errorEl = document.getElementById('proof-lightbox-error');
    const errorMsgEl = document.getElementById('proof-error-msg');
    
    if (img && errorEl) {
        img.style.display = 'none';
        errorEl.style.display = 'flex';
        
        const url = window.lastSelectedProofUrl || '';
        if (url.includes('matp-app.qchats.org') || url.endsWith('proof.png')) {
            if (errorMsgEl) {
                errorMsgEl.innerHTML = `⚠️ <b>该充值单为历史测试/模拟数据</b><br><span style="font-size: 0.78rem; font-weight: normal; color: var(--text-secondary); display: inline-block; margin-top: 5px;">由于原模拟域名 (<code>matp-app.qchats.org</code>) 的服务器已下线，该默认测试图片已失效，因此无法正常预览。</span>`;
            }
        } else {
            if (errorMsgEl) {
                errorMsgEl.innerHTML = `⚠️ <b>凭证图片加载失败 (404)</b><br><span style="font-size: 0.78rem; font-weight: normal; color: var(--text-secondary); display: inline-block; margin-top: 5px;">该凭证图片文件在服务器上不存在，或者网络访问超时。</span>`;
            }
        }
    }
}

function closeProofLightbox() {
    const modal = document.getElementById('proof-lightbox-modal');
    const img = document.getElementById('proof-lightbox-img');
    const errorEl = document.getElementById('proof-lightbox-error');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    if (img) {
        img.src = '';
    }
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

window.viewProofImage = viewProofImage;
window.handleProofImageError = handleProofImageError;
window.closeProofLightbox = closeProofLightbox;

async function loadWithdrawList() {
    if (!currentAdmin) return;
    
    const filterStatus = document.getElementById('withdraw-status-filter').value;
    const phoneVal = document.getElementById('filter-withdraw-phone')?.value.trim().toLowerCase() || '';
    const idVal = document.getElementById('filter-withdraw-id')?.value.trim().toLowerCase() || '';
    
    let url = '/finance/withdrawals?page=1&pageSize=100';
    if (filterStatus !== 'ALL') {
        url += `&status=${filterStatus}`;
    }
    
    try {
        // Pre-fetch users list to map userId to registration phone number
        let userPhoneMap = {};
        try {
            userPhoneMap = await window.adminState.getUserPhoneMap();
        } catch (e) {
            console.error('Failed to pre-fetch users for withdraw phone mapping:', e);
        }

        const res = await apiFetch('GET', url, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            const bodyEl = document.getElementById('withdraw-table-body');
            if (!bodyEl) return;
            
            // Apply local search filtering
            let filteredList = list;
            if (phoneVal !== '') {
                filteredList = filteredList.filter(w => {
                    const phone = userPhoneMap[String(w.userId)] || '';
                    return phone.toLowerCase().includes(phoneVal);
                });
            }
            if (idVal !== '') {
                filteredList = filteredList.filter(w => String(w.id).toLowerCase().includes(idVal));
            }
            
            if (filteredList.length === 0) {
                bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的提现记录</td></tr>`;
                
                // Update pagination indicator
                const indicator = document.getElementById(`withdraw-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            // Paginate the filtered list
            const paginatedList = paginateList(filteredList, 'withdraw');
            
            bodyEl.innerHTML = paginatedList.map(w => {
                const date = w.createdAt ? new Date(parseInt(w.createdAt)).toLocaleString() : '--';
                const userPhone = userPhoneMap[String(w.userId)] || '--';
                
                let channelName = '--';
                let targetAddress = '--';
                
                if (w.withdrawType === 'CRYPTO') {
                    const crypto = w.targetSnapshot?.crypto || {};
                    const network = crypto.network || w.targetSnapshot?.method?.name || 'TRC20';
                    const address = crypto.address || '--';
                    const memo = crypto.memo ? ` (Memo: ${crypto.memo})` : '';
                    channelName = `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: bold; display: inline-block;">🪙 CRYPTO [${network}]</span>`;
                    targetAddress = `
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-family: monospace; font-size: 0.8rem; color: var(--text-primary); font-weight: 600; word-break: break-all;">${address}${memo}</span>
                            <button class="action-btn btn-approve" style="padding: 2px 6px; font-size: 0.68rem; background: var(--primary); color: #FFF; border-radius: 4px; height: 20px; line-height: 1; width: fit-content; margin-top: 2px;" onclick="copyToClipboard('${address}', '接收地址已成功复制到剪贴板！')">📋 复制收款地址</button>
                        </div>
                    `;
                } else if (w.withdrawType === 'FIAT') {
                    const fiat = w.targetSnapshot?.fiat || {};
                    const methodName = w.targetSnapshot?.method?.name || 'FIAT';
                    const bank = fiat.bankName || fiat.label || '';
                    const name = fiat.accountName || '--';
                    const isUpi = !!fiat.upi;
                    const acc = fiat.upi || fiat.accountNumber || '--';
                    const labelText = isUpi ? 'UPI ID' : '银行账号';
                    channelName = `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.1); color: #3B82F6; font-weight: bold; display: inline-block;">💵 FIAT [${methodName}${bank ? ' - ' + bank : ''}]</span>`;
                    targetAddress = `<div style="font-size: 0.8rem; color: var(--text-primary); line-height: 1.4;">
                        <span>收款姓名: <b>${name}</b></span><br>
                        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 2px;">
                            <span>${labelText}: <span style="font-family: monospace; font-weight: 600; color: ${isUpi ? '#3B82F6' : 'var(--text-primary)'};">${acc}</span></span>
                            <button class="action-btn btn-approve" style="padding: 2px 6px; font-size: 0.68rem; background: var(--primary); color: #FFF; border-radius: 4px; height: 20px; line-height: 1; width: fit-content;" onclick="copyToClipboard('${acc}', '${labelText}已成功复制到剪贴板！')">📋 复制收款账号</button>
                        </div>
                    </div>`;
                } else {
                    channelName = `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.1); color: #94A3B8; font-weight: bold; display: inline-block;">UNKNOWN</span>`;
                    targetAddress = `<span style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">--</span>`;
                }

                let currencySymbol = '$';
                let currencyUnit = 'USDT';
                let displayAmt = parseFloat(w.amount || '0');
                let displayFee = parseFloat(w.fee || '0');
                let displayActual = parseFloat(w.actualAmount || w.amount || '0');

                const isNewRecord = w.createdAt && parseInt(w.createdAt) > 1779700000000;
                let rate = 83.00; // default exchange rate

                if (w.withdrawType === 'CRYPTO') {
                    currencySymbol = '$';
                    currencyUnit = 'USDT';
                    if (isNewRecord) {
                        displayAmt = displayAmt / rate;
                        displayFee = displayFee / rate;
                        displayActual = displayActual / rate;
                    }
                } else if (w.withdrawType === 'FIAT') {
                    currencySymbol = '\u20b9';
                    currencyUnit = 'INR';
                    if (!isNewRecord) {
                        displayAmt = displayAmt * rate;
                        displayFee = displayFee * rate;
                        displayActual = displayActual * rate;
                    }
                }

                let amountDetails = `<span style="font-weight: 700; color: #EF4444; font-size: 0.88rem;">${currencySymbol}${displayAmt.toFixed(2)} ${currencyUnit}</span>`;
                if (displayFee > 0) {
                    amountDetails += `<br><span style="font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap;">实到: <b>${currencySymbol}${displayActual.toFixed(2)}</b> (服务费: ${currencySymbol}${displayFee.toFixed(2)})</span>`;
                } else {
                    amountDetails += `<br><span style="font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap;">实到: <b>${currencySymbol}${displayAmt.toFixed(2)}</b> (免手续费)</span>`;
                }

                let actionHtml = '';
                if (w.status === 'PENDING') {
                    actionHtml = `
                        <div style="display: flex; gap: 6px; justify-content: center;">
                            <button class="action-btn btn-accept" style="padding: 4px 8px; font-size: 0.75rem;" onclick="handleWithdrawReview('${w.id}', 'accept')">受理</button>
                            <button class="action-btn btn-reject" style="padding: 4px 8px; font-size: 0.75rem;" onclick="handleWithdrawReview('${w.id}', 'reject')">拒绝</button>
                        </div>
                    `;
                } else if (w.status === 'ACCEPTED') {
                    actionHtml = `
                        <div style="display: flex; gap: 6px; justify-content: center;">
                            <button class="action-btn btn-approve" style="padding: 4px 8px; font-size: 0.75rem;" onclick="handleWithdrawReview('${w.id}', 'complete')">放款完成</button>
                            <button class="action-btn btn-reject" style="padding: 4px 8px; font-size: 0.75rem;" onclick="handleWithdrawReview('${w.id}', 'fail')">失败</button>
                        </div>
                    `;
                } else {
                    actionHtml = `<span style="color: var(--text-muted); font-size: 0.75rem;">已归档</span>`;
                }
                
                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.72rem;" title="${String(w.id || '')}">${String(w.id || '').substring(0, 8)}...</td>
                        <td style="font-weight: 600; color: var(--text-primary);">${userPhone}</td>
                        <td>${channelName}</td>
                        <td>${amountDetails}</td>
                        <td>${targetAddress}</td>
                        <td>
                            <span class="badge badge-${w.status}">
                                <span class="badge-status-dot"></span>
                                ${w.status}
                            </span>
                        </td>
                        <td style="color: var(--text-muted); font-size: 0.72rem;">${date}</td>
                        <td class="sticky-right" style="text-align: center;">${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        } else {
            showToast(res.errorMessage || '获取提现列表失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('获取提现列表网络异常！', true);
    }
}

async function handleWithdrawReview(id, action) {
    const dict = {
        'accept': '受理提现单（进入放款队列）',
        'complete': '确放款已到账（清算完成）',
        'reject': '拒绝提现申请（资金原路解冻）',
        'fail': '放款失败记账（资金退回）'
    };
    const actionLabel = dict[action] || action;
    if (!confirm(`您确定要对提现单 ${id} 执行 [${actionLabel}] 操作吗？`)) return;
    
    showToast(`正在提交提现审计指令 [${action}]...`, false);
    try {
        const res = await apiFetch('POST', `/finance/withdrawals/${id}/${action}`, {}, true);
        if (res.code === 200) {
            showToast(`✓ 提现单 ${id} 处理成功：已执行${actionLabel}！`, false);
            loadDashboardStats();
            loadWithdrawList();
        } else {
            showToast(res.errorMessage || '提现审计操作失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('提交提现审计网络异常！', true);
    }
}

let cachedPaymentChannels = [];

async function loadPaymentChannels() {
    const tableBody = document.getElementById('payment-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 50px 0;">🔄 正在拉取平台支付通道列表...</td></tr>`;
    
    try {
        const res = await apiFetch('GET', '/finance/payment-methods', null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            cachedPaymentChannels = list; // Cache for edit lookup
            if (list.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 50px 0;">🫙 平台暂无已配置的支付通道</td></tr>`;
                const indicator = document.getElementById(`payment-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            const paginatedList = paginateList(list, 'payment');
            tableBody.innerHTML = paginatedList.map(m => {
                const statusBadge = m.enabled 
                    ? `<span class="kyc-badge-status kyc-status-APPROVED" style="font-size:0.75rem; padding: 2px 8px; border-radius: 4px;">已启用</span>`
                    : `<span class="kyc-badge-status kyc-status-NONE" style="font-size:0.75rem; padding: 2px 8px; border-radius: 4px;">已禁用</span>`;
                
                const actionBtn = m.enabled
                    ? `<button class="action-btn btn-reject" onclick="togglePaymentChannelStatus('${m.id}', false)" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer;">禁用</button>`
                    : `<button class="action-btn btn-approve" onclick="togglePaymentChannelStatus('${m.id}', true)" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer;">启用</button>`;
                
                const configBtn = `<button class="action-btn btn-view" onclick="openReceivingConfigDrawer('${m.id}', '${m.name.replace(/'/g, "\\'")}', '${m.assetClass}')" style="padding: 4px 8px; font-size: 0.72rem; margin-left: 5px; cursor: pointer; background: rgba(91,81,249,0.08); color: var(--primary);">⚙️ 收款配置</button>`;
                
                const editBtn = `<button class="action-btn btn-view" onclick="openPaymentEditModal('${m.id}')" style="padding: 4px 8px; font-size: 0.72rem; margin-left: 5px; cursor: pointer; background: rgba(59, 130, 246, 0.08); color: var(--blue);">📝 编辑</button>`;

                const deleteBtn = `<button class="action-btn btn-reject" onclick="deletePaymentChannel('${m.id}')" style="padding: 4px 8px; font-size: 0.72rem; background: rgba(239, 68, 68, 0.08); color: var(--red); margin-left: 5px; cursor: pointer;">删除</button>`;
                
                const iconHtml = m.iconUrl 
                    ? `<img src="${m.iconUrl}" style="max-height: 24px; max-width: 24px; border-radius: 4px; object-fit: contain;" onerror="this.onerror=null; this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';">`
                    : `<span style="font-size:1.1rem;">💳</span>`;

                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.8rem;">${m.id}</td>
                        <td style="text-align: center; vertical-align: middle;">${iconHtml}</td>
                        <td style="font-weight: 600; color: var(--text-primary);">${m.name || '--'}</td>
                        <td>
                            <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.04); font-family: monospace; font-weight: 600;">
                                ${m.assetClass || '--'}
                            </span>
                        </td>
                        <td>
                            <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: ${m.bizType === 'DEPOSIT' ? 'rgba(16,185,129,0.08)' : 'rgba(91,81,249,0.08)'}; color: ${m.bizType === 'DEPOSIT' ? 'var(--green)' : 'var(--primary)'}; font-weight: 600;">
                                ${m.bizType || '--'}
                            </span>
                        </td>
                        <td style="font-size: 0.8rem; color: var(--text-secondary);">${m.channelType || '--'}</td>
                        <td style="font-size: 0.8rem; color: var(--text-secondary);">${m.actionType || '--'}</td>
                        <td style="font-weight: 600; text-align: center;">${m.orderIndex || 0}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <div style="display: flex; align-items: center;">
                                ${actionBtn}
                                ${configBtn}
                                ${editBtn}
                                ${deleteBtn}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--red); padding: 50px 0;">⚠️ 获取支付通道失败：${res.errorMessage || '错误'}</td></tr>`;
        }
    } catch (e) {
        console.error('Failed to load payment channels:', e);
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--red); padding: 50px 0;">⚠️ 发生网络异常，无法拉取支付通道列表！</td></tr>`;
    }
}

async function togglePaymentChannelStatus(channelId, enable) {
    showToast(enable ? '正在启用通道...' : '正在禁用通道...', false);
    try {
        const res = await apiFetch('POST', `/finance/payment-methods/${channelId}/update-status`, { enabled: enable }, true);
        if (res.code === 200) {
            showToast(enable ? '✓ 通道已成功启用！' : '✓ 通道已成功禁用！', false);
            loadPaymentChannels();
        } else {
            showToast(res.errorMessage || '修改通道状态失败！', true);
        }
    } catch (e) {
        console.error('Failed to update channel status:', e);
        showToast('修改通道状态网络异常！', true);
    }
}

async function deletePaymentChannel(channelId) {
    if (!confirm('⚠️ 您确定要永久删除该支付通道吗？删除后将无法恢复且影响用户充值端展示！')) return;
    showToast('正在删除通道...', false);
    try {
        const res = await apiFetch('POST', `/finance/payment-methods/${channelId}/delete`, {}, true);
        if (res.code === 200) {
            showToast('✓ 支付通道已成功删除！', false);
            loadPaymentChannels();
        } else {
            showToast(res.errorMessage || '删除通道失败！', true);
        }
    } catch (e) {
        console.error('Failed to delete channel:', e);
        showToast('删除通道网络异常！', true);
    }
}

function openPaymentAddModal() {
    document.getElementById('payment-add-name').value = '';
    document.getElementById('payment-add-orderIndex').value = '1';
    document.getElementById('payment-add-memo').value = '';
    document.getElementById('payment-add-iconUrl').value = '';
    
    // Set default selections
    document.getElementById('payment-add-assetClass').value = 'CRYPTO';
    document.getElementById('payment-add-bizType').value = 'DEPOSIT';
    document.getElementById('payment-add-channelType').value = 'PAYMENT_GATEWAY';
    document.getElementById('payment-add-paymentMethodType').value = 'CARD';
    document.getElementById('payment-add-receivingTargetType').value = 'CRYPTO';
    document.getElementById('payment-add-actionType').value = 'SHOW_ADDRESS';
    
    const preview = document.getElementById('payment-add-iconPreview');
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    const fileInput = document.getElementById('payment-add-iconFile');
    if (fileInput) fileInput.value = '';

    document.getElementById('payment-add-modal').classList.add('active');
}

function closePaymentAddModal() {
    document.getElementById('payment-add-modal').classList.remove('active');
}

async function submitNewPaymentChannel(event) {
    event.preventDefault();
    
    const name = document.getElementById('payment-add-name').value.trim();
    const orderIndex = parseInt(document.getElementById('payment-add-orderIndex').value || '1');
    const assetClass = document.getElementById('payment-add-assetClass').value;
    const bizType = document.getElementById('payment-add-bizType').value;
    const channelType = document.getElementById('payment-add-channelType').value;
    const paymentMethodType = document.getElementById('payment-add-paymentMethodType').value;
    const receivingTargetType = document.getElementById('payment-add-receivingTargetType').value;
    const actionType = document.getElementById('payment-add-actionType').value;
    const iconUrl = document.getElementById('payment-add-iconUrl').value.trim();
    const memo = document.getElementById('payment-add-memo').value.trim();
    
    if (!name) {
        showToast('通道名称不能为空！', true);
        return;
    }
    
    showToast('正在创建支付通道...', false);
    
    const body = {
        name: name,
        orderIndex: orderIndex,
        assetClass: assetClass,
        bizType: bizType,
        channelType: channelType,
        paymentMethodType: paymentMethodType,
        receivingTargetType: receivingTargetType,
        actionType: actionType,
        iconUrl: iconUrl,
        memo: memo,
        enabled: true,
        translations: [
            { localeTag: 'en', displayName: name, isDefault: true, description: memo },
            { localeTag: 'zh-Hans', displayName: name, isDefault: false, description: memo }
        ]
    };
    try {
        const res = await apiFetch('POST', '/finance/payment-methods', body, true);
        if (res.code === 200) {
            showToast('✓ 新支付通道已成功发布并激活！', false);
            closePaymentAddModal();
            loadPaymentChannels();
        } else {
            showToast(res.errorMessage || '发布支付通道失败！', true);
        }
    } catch (e) {
        console.error('Failed to submit new payment method:', e);
        showToast('发布支付通道网络异常！', true);
    }
}

function openPaymentEditModal(channelId) {
    const m = cachedPaymentChannels.find(item => String(item.id) === String(channelId));
    if (!m) {
        showToast('未找到通道配置数据！', true);
        return;
    }
    
    document.getElementById('payment-edit-id').value = m.id;
    document.getElementById('payment-edit-name').value = m.name || '';
    document.getElementById('payment-edit-orderIndex').value = m.orderIndex || 0;
    document.getElementById('payment-edit-assetClass').value = m.assetClass || 'CRYPTO';
    document.getElementById('payment-edit-bizType').value = m.bizType || 'DEPOSIT';
    document.getElementById('payment-edit-channelType').value = m.channelType || 'PAYMENT_GATEWAY';
    document.getElementById('payment-edit-paymentMethodType').value = m.paymentMethodType || 'CARD';
    document.getElementById('payment-edit-receivingTargetType').value = m.receivingTargetType || 'CRYPTO';
    document.getElementById('payment-edit-actionType').value = m.actionType || 'SHOW_ADDRESS';
    document.getElementById('payment-edit-iconUrl').value = m.iconUrl || '';
    document.getElementById('payment-edit-memo').value = m.memo || '';
    
    // Set preview
    const preview = document.getElementById('payment-edit-iconPreview');
    if (preview) {
        if (m.iconUrl) {
            preview.src = m.iconUrl;
            preview.style.display = 'block';
        } else {
            preview.src = '';
            preview.style.display = 'none';
        }
    }
    const fileInput = document.getElementById('payment-edit-iconFile');
    if (fileInput) fileInput.value = '';
    
    document.getElementById('payment-edit-modal').classList.add('active');
}

function closePaymentEditModal() {
    document.getElementById('payment-edit-modal').classList.remove('active');
}

async function submitEditPaymentChannel(event) {
    event.preventDefault();
    
    const id = document.getElementById('payment-edit-id').value;
    const name = document.getElementById('payment-edit-name').value.trim();
    const orderIndex = parseInt(document.getElementById('payment-edit-orderIndex').value || '1');
    const assetClass = document.getElementById('payment-edit-assetClass').value;
    const bizType = document.getElementById('payment-edit-bizType').value;
    const channelType = document.getElementById('payment-edit-channelType').value;
    const paymentMethodType = document.getElementById('payment-edit-paymentMethodType').value;
    const receivingTargetType = document.getElementById('payment-edit-receivingTargetType').value;
    const actionType = document.getElementById('payment-edit-actionType').value;
    const iconUrl = document.getElementById('payment-edit-iconUrl').value.trim();
    const memo = document.getElementById('payment-edit-memo').value.trim();
    
    if (!name) {
        showToast('通道名称不能为空！', true);
        return;
    }
    
    showToast('正在保存支付通道配置...', false);
    
    const body = {
        name: name,
        orderIndex: orderIndex,
        assetClass: assetClass,
        bizType: bizType,
        channelType: channelType,
        paymentMethodType: paymentMethodType,
        receivingTargetType: receivingTargetType,
        actionType: actionType,
        iconUrl: iconUrl,
        memo: memo,
        enabled: true,
        translations: [
            { localeTag: 'en', displayName: name, isDefault: true, description: memo },
            { localeTag: 'zh-Hans', displayName: name, isDefault: false, description: memo }
        ]
    };
    try {
        const res = await apiFetch('PUT', `/finance/payment-methods/${id}`, body, true);
        if (res.code === 200) {
            showToast('✓ 支付通道修改已成功保存！', false);
            closePaymentEditModal();
            loadPaymentChannels();
        } else {
            showToast(res.errorMessage || '保存支付通道修改失败！', true);
        }
    } catch (e) {
        console.error('Failed to submit edit payment method:', e);
        showToast('保存通道修改网络异常！', true);
    }
}

async function uploadPaymentChannelIcon(fileInputId, urlInputId, previewImgId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    showToast('⏳ 正在上传通道图标...', false);
    
    try {
        // 1. Get presigned upload URL
        const presignedRes = await apiFetch('POST', '/upload/presigned', {
            contentType: file.type || 'image/png',
            fileName: file.name || 'icon.png',
            type: 'payment'
        }, true);
        
        if (presignedRes.code !== 200) {
            throw new Error(presignedRes.errorMessage || '获取上传凭证失败');
        }
        
        const { uploadUrl, downloadUrl, path: storagePath } = presignedRes.result || presignedRes.data || {};
        if (!uploadUrl || !downloadUrl) {
            throw new Error('上传凭证解析异常');
        }
        
        // 2. Perform direct upload to storage, routing through GCS proxy on dev
        let finalPutUrl = uploadUrl;
        const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
        if (isLocalDev && !uploadUrl.includes('upload-local')) {
            finalPutUrl = '/upload-gcs?url=' + encodeURIComponent(uploadUrl);
        } else if (!isLocalDev) {
            if (uploadUrl.startsWith('https://storage.googleapis.com/')) {
                finalPutUrl = uploadUrl.replace('https://storage.googleapis.com/', '/upload-gcs/');
            }
        }
        
        const putRes = await fetch(finalPutUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type || 'image/png'
            },
            body: file
        });
        
        if (!putRes.ok) {
            throw new Error('文件写入直传存储失败');
        }
        
        // 3. Confirm upload
        const confirmRes = await apiFetch('POST', '/upload/confirm', {
            path: storagePath
        }, true);
        
        if (confirmRes.code !== 200) {
            throw new Error(confirmRes.errorMessage || '确认上传失败');
        }
        
        // 4. Update fields
        document.getElementById(urlInputId).value = downloadUrl;
        const preview = document.getElementById(previewImgId);
        if (preview) {
            preview.src = downloadUrl;
            preview.style.display = 'block';
        }
        
        showToast('✓ 图标上传成功！', false);
    } catch (e) {
        console.error('Icon upload failed:', e);
        showToast(`❌ 图标上传失败: ${e.message}`, true);
    }
}

export // --- RECEIVING CONFIG DRAWER CONTROLLERS ---
let currentRecChannelId = null;
let currentRecAssetClass = null;

async function openReceivingConfigDrawer(methodId, name, assetClass) {
    currentRecChannelId = methodId;
    currentRecAssetClass = assetClass;
    
    document.getElementById('rec-channel-id').value = methodId;
    document.getElementById('rec-channel-name').innerText = name;
    document.getElementById('rec-channel-class').innerText = assetClass;
    
    // Clear state inputs
    document.getElementById('rec-binding-id').value = '';
    document.getElementById('rec-target-id').value = '';
    document.getElementById('rec-asset-id').value = '';
    
    // Clear form inputs
    document.getElementById('rec-crypto-network').value = '';
    document.getElementById('rec-crypto-address').value = '';
    document.getElementById('rec-crypto-memo').value = '';
    document.getElementById('rec-fiat-bank').value = '';
    document.getElementById('rec-fiat-name').value = '';
    document.getElementById('rec-fiat-number').value = '';
    document.getElementById('rec-fiat-swift').value = '';
    document.getElementById('rec-fiat-iban').value = '';
    
    // Show loader, hide unbound/form boxes
    document.getElementById('rec-loader').style.display = 'block';
    document.getElementById('rec-unbound-box').style.display = 'none';
    document.getElementById('rec-form-box').style.display = 'none';
    
    // Slide drawer open
    document.getElementById('receiving-overlay').classList.add('active');
    document.getElementById('receiving-drawer').classList.add('active');
    
    try {
        // 1. Fetch all payment method assets to find bindings
        const bindingsRes = await apiFetch('GET', '/finance/payment-method-assets', null, true);
        if (bindingsRes.code === 200) {
            const list = bindingsRes.result || bindingsRes.data || [];
            // Find active binding for this channel ID
            const binding = list.find(b => String(b.methodId) === String(methodId) && b.enabled !== false);
            
            if (binding) {
                const targetId = binding.receivingTargetId;
                const assetId = binding.assetId;
                
                document.getElementById('rec-binding-id').value = binding.id;
                document.getElementById('rec-target-id').value = targetId;
                document.getElementById('rec-asset-id').value = assetId;
                
                // 2. Fetch target details from targets list to prevent path ID "Not Found" error
                if (assetClass === 'CRYPTO') {
                    const targetsRes = await apiFetch('GET', '/finance/platform-crypto-receiving-targets', null, true);
                    const targets = targetsRes.result || targetsRes.data || [];
                    const target = targets.find(t => String(t.id) === String(targetId));
                    
                    if (target) {
                        document.getElementById('rec-crypto-network').value = target.network || 'TRC20';
                        document.getElementById('rec-crypto-address').value = target.address || '';
                        document.getElementById('rec-crypto-memo').value = target.memo || '';
                        
                        // Show crypto fields, hide fiat fields
                        document.getElementById('rec-crypto-fields').style.display = 'flex';
                        document.getElementById('rec-fiat-fields').style.display = 'none';
                        
                        document.getElementById('rec-loader').style.display = 'none';
                        document.getElementById('rec-form-box').style.display = 'flex';
                    } else {
                        throw new Error("Crypto target not found in list");
                    }
                } else {
                    const targetsRes = await apiFetch('GET', '/finance/platform-fiat-receiving-targets', null, true);
                    const targets = targetsRes.result || targetsRes.data || [];
                    const target = targets.find(t => String(t.id) === String(targetId));
                    
                    if (target) {
                        document.getElementById('rec-fiat-bank').value = target.bankName || '';
                        document.getElementById('rec-fiat-name').value = target.accountName || '';
                        document.getElementById('rec-fiat-number').value = target.accountNumber || '';
                        document.getElementById('rec-fiat-swift').value = target.swiftCode || '';
                        document.getElementById('rec-fiat-iban').value = target.iban || '';
                        
                        // Show fiat fields, hide crypto fields
                        document.getElementById('rec-crypto-fields').style.display = 'none';
                        document.getElementById('rec-fiat-fields').style.display = 'flex';
                        
                        document.getElementById('rec-loader').style.display = 'none';
                        document.getElementById('rec-form-box').style.display = 'flex';
                    } else {
                        throw new Error("Fiat target not found in list");
                    }
                }
            } else {
                // No binding found!
                document.getElementById('rec-loader').style.display = 'none';
                document.getElementById('rec-unbound-box').style.display = 'block';
                
                // Save fallback assetIds
                const fallbackAssetId = assetClass === 'CRYPTO' ? '1183348576672026624' : '1126151490264633349';
                document.getElementById('rec-asset-id').value = fallbackAssetId;
            }
        } else {
            showToast('获取资产通道绑定列表失败：' + (bindingsRes.errorMessage || '错误'), true);
            closeReceivingDrawer();
        }
    } catch (e) {
        console.error('Failed to load receiving target config:', e);
        
        // Handle error gracefully by showing unbound box
        document.getElementById('rec-loader').style.display = 'none';
        document.getElementById('rec-unbound-box').style.display = 'block';
        const fallbackAssetId = assetClass === 'CRYPTO' ? '1183348576672026624' : '1126151490264633349';
        document.getElementById('rec-asset-id').value = fallbackAssetId;
    }
}

function closeReceivingDrawer() {
    document.getElementById('receiving-overlay').classList.remove('active');
    document.getElementById('receiving-drawer').classList.remove('active');
}

function createNewTargetAndBind() {
    document.getElementById('rec-unbound-box').style.display = 'none';
    
    if (currentRecAssetClass === 'CRYPTO') {
        document.getElementById('rec-crypto-fields').style.display = 'flex';
        document.getElementById('rec-fiat-fields').style.display = 'none';
    } else {
        document.getElementById('rec-crypto-fields').style.display = 'none';
        document.getElementById('rec-fiat-fields').style.display = 'flex';
    }
    
    document.getElementById('rec-form-box').style.display = 'flex';
}

async function saveReceivingTargetChanges() {
    const bindingId = document.getElementById('rec-binding-id').value;
    const targetId = document.getElementById('rec-target-id').value;
    const assetId = document.getElementById('rec-asset-id').value;
    const methodId = document.getElementById('rec-channel-id').value;
    
    showToast('正在保存收款账户配置...', false);
    
    try {
        let newTargetId = targetId;
        
        // 1. Create or Update the target record
        if (currentRecAssetClass === 'CRYPTO') {
            const address = document.getElementById('rec-crypto-address').value.trim();
            const network = document.getElementById('rec-crypto-network').value.trim();
            const memo = document.getElementById('rec-crypto-memo').value.trim();
            
            if (!address || !network) {
                showToast('收款地址和网络名称不能为空！', true);
                return;
            }
            
            const payload = {
                address: address,
                network: network,
                memo: memo,
                status: 'ACTIVE',
                assetId: parseInt(assetId)
            };
            let res;
            if (targetId) {
                payload.id = parseInt(targetId);
                res = await apiFetch('PUT', `/finance/platform-crypto-receiving-targets/${targetId}`, payload, true);
            } else {
                res = await apiFetch('POST', '/finance/platform-crypto-receiving-targets', payload, true);
            }
            if (res.code === 200) {
                const targetData = res.result || res.data;
                if (targetData && targetData.id) {
                    newTargetId = String(targetData.id);
                } else if (res.id) {
                    newTargetId = String(res.id);
                } else {
                    newTargetId = targetId || '';
                }
            } else {
                showToast('保存加密收款目标失败：' + (res.errorMessage || '错误'), true);
                return;
            }
        } else {
            const bankName = document.getElementById('rec-fiat-bank').value.trim();
            const accountName = document.getElementById('rec-fiat-name').value.trim();
            const accountNumber = document.getElementById('rec-fiat-number').value.trim();
            const swiftCode = document.getElementById('rec-fiat-swift').value.trim();
            const iban = document.getElementById('rec-fiat-iban').value.trim();
            
            if (!bankName || !accountName || !accountNumber) {
                showToast('银行名称、账户姓名和卡号不能为空！', true);
                return;
            }
            
            const payload = {
                bankName: bankName,
                accountName: accountName,
                accountNumber: accountNumber,
                swiftCode: swiftCode,
                iban: iban,
                regionCode: 'US',
                status: 'ACTIVE',
                assetId: parseInt(assetId)
            };
            let res;
            if (targetId) {
                payload.id = parseInt(targetId);
                res = await apiFetch('PUT', `/finance/platform-fiat-receiving-targets/${targetId}`, payload, true);
            } else {
                res = await apiFetch('POST', '/finance/platform-fiat-receiving-targets', payload, true);
            }
            if (res.code === 200) {
                const targetData = res.result || res.data;
                if (targetData && targetData.id) {
                    newTargetId = String(targetData.id);
                } else if (res.id) {
                    newTargetId = String(res.id);
                } else {
                    newTargetId = targetId || '';
                }
            } else {
                showToast('保存法币收款目标失败：' + (res.errorMessage || '错误'), true);
                return;
            }
        }
        
        // 2. Bind target if it was a new binding
        if (!bindingId && newTargetId) {
            const bindPayload = {
                methodId: parseInt(methodId),
                assetId: parseInt(assetId),
                receivingTargetId: parseInt(newTargetId),
                receivingTargetType: currentRecAssetClass,
                enabled: true
            };
            const bindRes = await apiFetch('POST', '/finance/payment-method-assets', bindPayload, true);
            if (bindRes.code !== 200) {
                showToast('绑定支付通道收款关系失败！', true);
                return;
            }
        }
        
        showToast('✓ 收款账户配置成功已实时生效！', false);
        closeReceivingDrawer();
        loadPaymentChannels();
        
    } catch (e) {
        console.error('Failed to save receiving target:', e);
        showToast('保存通道收款参数网络异常！', true);
    }
}

async function unbindAndDeleteReceivingTarget() {
    const bindingId = document.getElementById('rec-binding-id').value;
    const targetId = document.getElementById('rec-target-id').value;
    
    if (!bindingId) {
        showToast('当前通道未绑定任何收款配置。', true);
        return;
    }
    
    if (!confirm('⚠️ 警告：您确定要解除绑定并永久删除该通道的收款账号吗？删除后用户充值端将无法查阅到收款信息！')) {
        return;
    }
    
    showToast('正在解除绑定并永久删除...', false);
    
    try {
        // 1. Delete Binding Asset relation
        const delBindRes = await apiFetch('POST', `/finance/payment-method-assets/${bindingId}/delete`, {}, true);
        if (delBindRes.code === 200) {
            // 2. Delete Receiving Target itself
            const endpoint = currentRecAssetClass === 'CRYPTO' 
                ? `/finance/platform-crypto-receiving-targets/${targetId}/delete`
                : `/finance/platform-fiat-receiving-targets/${targetId}/delete`;
                
            await apiFetch('POST', endpoint, {}, true);
            
            showToast('✓ 该通道收款信息已成功解绑并永久删除！', false);
            closeReceivingDrawer();
            loadPaymentChannels();
        } else {
            showToast('解绑失败：' + (delBindRes.errorMessage || '错误'), true);
        }
    } catch (e) {
        console.error('Failed to unbind and delete:', e);
        showToast('解绑收款目标网络异常！', true);
    }
}


export // --- PLATFORM ASSET EXCHANGE RATES MANAGEMENT (汇率管理) ---
async function loadExchangeRatesList() {
    const tableBody = document.getElementById('rates-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-secondary);">🔄 正在调取全站结算汇率配置...</td></tr>`;
    
    try {
        const res = await apiFetch('GET', '/asset-exchange-rates?page=1&pageSize=100', null, true);
        if (res && res.code === 200) {
            const rates = res.result || res.data || [];
            exchangeRatesList = rates; // Cache globally
            
            if (rates.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 25px; color: var(--text-muted); font-size: 0.85rem;">📭 暂无任何结算汇率配置记录</td></tr>`;
                const indicator = document.getElementById(`rates-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            // Standard symbol mapping helper
            const symbolMap = {
                '1183348576672026624': 'USDT',
                '1126151490264633373': 'HKD',
                '1126151490264633349': 'USD',
                '1126151490264633358': 'EUR',
                '1183348576642666496': 'BTC',
                '1183348576630083584': 'ETH',
                '1126151490264633456': 'INR'
            };
            
            const paginatedList = paginateList(rates, 'rates');
            tableBody.innerHTML = paginatedList.map(r => {
                const baseName = symbolMap[String(r.baseAssetId || '')] || `Asset (${r.baseAssetId})`;
                const quoteName = symbolMap[String(r.quoteAssetId || '')] || `Asset (${r.quoteAssetId})`;
                
                const statusText = r.enabled ? '启用中' : '已禁用';
                const statusClass = r.enabled ? 'kyc-status-VERIFIED' : 'kyc-status-NONE';
                
                return `
                    <tr style="transition: background 0.2s;">
                        <td style="font-family: monospace; font-size: 0.72rem; color: var(--text-secondary);">${r.id}</td>
                        <td style="font-weight: 700; color: var(--text-primary);">${baseName} <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: normal; display: block; font-family: monospace; margin-top: 2px;">ID: ${r.baseAssetId}</span></td>
                        <td style="font-weight: 700; color: var(--text-primary);">${quoteName} <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: normal; display: block; font-family: monospace; margin-top: 2px;">ID: ${r.quoteAssetId}</span></td>
                        <td style="font-weight: 800; font-size: 0.95rem; color: var(--primary);">${parseFloat(r.rate).toFixed(4)}</td>
                        <td><span class="kyc-badge-status ${statusClass}" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px;">${statusText}</span></td>
                        <td style="max-width: 150px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; color: var(--text-secondary); font-size: 0.75rem;">${r.remark || '--'}</td>
                        <td>
                            <button class="action-btn btn-view" onclick="openRateEditModal('${r.id}')" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer; background: rgba(91,81,249,0.08); color: var(--primary);">✏️ 编辑</button>
                            <button class="action-btn btn-reject" onclick="deleteExchangeRate('${r.id}')" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer; margin-left: 5px; background: rgba(239,68,68,0.08); color: var(--red);">✕ 删除</button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--red); font-size: 0.85rem;">⚠️ 调取结算汇率失败：${res.errorMessage || '未知错误'}</td></tr>`;
        }
    } catch(e) {
        console.error('Failed to load exchange rates:', e);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--red); font-size: 0.85rem;">⚠️ 加载结算汇率发生网络异常！</td></tr>`;
    }
}

function openRateEditModal(rateId) {
    const modal = document.getElementById('rate-edit-modal');
    if (!modal) return;
    
    // Reset fields
    document.getElementById('rate-edit-id').value = '';
    document.getElementById('rate-edit-baseAssetId').value = '1183348576672026624';
    document.getElementById('rate-edit-baseAssetId-custom').value = '';
    document.getElementById('rate-edit-baseAssetId-custom').style.display = 'none';
    
    document.getElementById('rate-edit-quoteAssetId').value = '1126151490264633456';
    document.getElementById('rate-edit-quoteAssetId-custom').value = '';
    document.getElementById('rate-edit-quoteAssetId-custom').style.display = 'none';
    
    document.getElementById('rate-edit-rate').value = '';
    document.getElementById('rate-edit-enabled').value = 'true';
    document.getElementById('rate-edit-remark').value = '';
    
    if (rateId) {
        // Edit Mode
        document.getElementById('rate-modal-title').innerText = '🪙 编辑官方结算汇率';
        document.getElementById('rate-modal-submit-btn').innerText = '确认并修改结算汇率';
        
        const rateObj = exchangeRatesList.find(r => String(r.id || '') === String(rateId || ''));
        if (rateObj) {
            document.getElementById('rate-edit-id').value = rateObj.id;
            
            // Set base asset
            const baseSelect = document.getElementById('rate-edit-baseAssetId');
            const baseVal = String(rateObj.baseAssetId || '');
            let baseFound = false;
            for (let opt of baseSelect.options) {
                if (opt.value === baseVal) {
                    baseSelect.value = baseVal;
                    baseFound = true;
                    break;
                }
            }
            if (!baseFound) {
                baseSelect.value = 'CUSTOM';
                const customInput = document.getElementById('rate-edit-baseAssetId-custom');
                customInput.value = baseVal;
                customInput.style.display = 'block';
            }
            
            // Set quote asset
            const quoteSelect = document.getElementById('rate-edit-quoteAssetId');
            const quoteVal = String(rateObj.quoteAssetId || '');
            let quoteFound = false;
            for (let opt of quoteSelect.options) {
                if (opt.value === quoteVal) {
                    quoteSelect.value = quoteVal;
                    quoteFound = true;
                    break;
                }
            }
            if (!quoteFound) {
                quoteSelect.value = 'CUSTOM';
                const customInput = document.getElementById('rate-edit-quoteAssetId-custom');
                customInput.value = quoteVal;
                customInput.style.display = 'block';
            }
            
            document.getElementById('rate-edit-rate').value = rateObj.rate;
            document.getElementById('rate-edit-enabled').value = rateObj.enabled ? 'true' : 'false';
            document.getElementById('rate-edit-remark').value = rateObj.remark || '';
        }
    } else {
        // Create Mode
        document.getElementById('rate-modal-title').innerText = '🪙 新增官方结算汇率';
        document.getElementById('rate-modal-submit-btn').innerText = '发布并启用新结算汇率';
    }
    
    modal.classList.add('active');
}

function closeRateEditModal() {
    document.getElementById('rate-edit-modal').classList.remove('active');
}

function toggleCustomAssetId(type) {
    const select = document.getElementById(`rate-edit-${type}AssetId`);
    const customInput = document.getElementById(`rate-edit-${type}AssetId-custom`);
    if (select && customInput) {
        if (select.value === 'CUSTOM') {
            customInput.style.display = 'block';
            customInput.focus();
        } else {
            customInput.style.display = 'none';
            customInput.value = '';
        }
    }
}

async function submitRateChanges(event) {
    event.preventDefault();
    
    const rateId = document.getElementById('rate-edit-id').value;
    
    let baseAssetId = document.getElementById('rate-edit-baseAssetId').value;
    if (baseAssetId === 'CUSTOM') {
        baseAssetId = document.getElementById('rate-edit-baseAssetId-custom').value.trim();
    }
    
    let quoteAssetId = document.getElementById('rate-edit-quoteAssetId').value;
    if (quoteAssetId === 'CUSTOM') {
        quoteAssetId = document.getElementById('rate-edit-quoteAssetId-custom').value.trim();
    }
    
    const rate = parseFloat(document.getElementById('rate-edit-rate').value);
    const enabled = document.getElementById('rate-edit-enabled').value === 'true';
    const remark = document.getElementById('rate-edit-remark').value.trim();
    
    if (!baseAssetId || !/^\d+$/.test(baseAssetId)) {
        showToast('⚠️ 基准资产 ID 必须为有效的数字 Snowflake ID！', true);
        return;
    }
    if (!quoteAssetId || !/^\d+$/.test(quoteAssetId)) {
        showToast('⚠️ 目标资产 ID 必须为有效的数字 Snowflake ID！', true);
        return;
    }
    if (isNaN(rate) || rate <= 0) {
        showToast('⚠️ 兑换汇率必须为大于零的数字！', true);
        return;
    }
    
    const submitBtn = document.getElementById('rate-modal-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerText = '提交中...';
    
    try {
        // Stringify Snowflake BigInt properly without precision loss matching REST spec
        const payloadStr = `{"baseAssetId":${baseAssetId},"quoteAssetId":${quoteAssetId},"rate":${rate},"enabled":${enabled},"remark":"${remark}"}`;
        
        let res;
        if (rateId) {
            // Edit Mode - PUT /asset-exchange-rates/{id}
            res = await apiFetchWithRawBody('PUT', `/asset-exchange-rates/${rateId}`, payloadStr, true);
        } else {
            // Create Mode - POST /asset-exchange-rates
            res = await apiFetchWithRawBody('POST', '/asset-exchange-rates', payloadStr, true);
        }
        
        submitBtn.disabled = false;
        submitBtn.innerText = '确认并提交配置';
        
        if (res && res.code === 200) {
            showToast('✓ 平台资产清算结算汇率配置成功保存并已实时生效！', false);
            closeRateEditModal();
            loadExchangeRatesList();
        } else {
            showToast(res.errorMessage || '结算汇率配置失败！', true);
        }
    } catch(e) {
        submitBtn.disabled = false;
        submitBtn.innerText = '确认并提交配置';
        console.error('Failed to submit rate change:', e);
        showToast('网络清算请求超时！', true);
    }
}

async function deleteExchangeRate(rateId) {
    if (!confirm('⚠️ 警告：您确定要永久删除该资产结算汇率配置吗？这可能会影响全站该资产后续的自动充值汇兑代扣！')) return;
    
    showToast('正在永久物理擦除汇率配置...', false);
    
    try {
        // DELETE /asset-exchange-rates/{id} or POST /asset-exchange-rates/{id}/delete
        const res = await apiFetch('POST', `/asset-exchange-rates/${rateId}/delete`, {}, true);
        if (res && res.code === 200) {
            showToast('✓ 该资产结算汇率已成功从平台数据库中删除！', false);
            loadExchangeRatesList();
        } else {
            showToast(res.errorMessage || '删除汇率配置失败！', true);
        }
    } catch(e) {
        console.error('Failed to delete exchange rate:', e);
        showToast('网络删除请求异常！', true);
    }
}


export function resetDepositFilters() {
    const phone = document.getElementById('filter-deposit-phone');
    const remittance = document.getElementById('filter-deposit-remittance');
    const status = document.getElementById('deposit-status-filter');
    const size = document.getElementById('deposit-size-select');
    if (phone) phone.value = '';
    if (remittance) remittance.value = '';
    if (status) status.value = 'ALL';
    if (size) size.value = '10';
    window.adminPages.deposit.size = 10;
    window.adminPages.deposit.current = 1;
    loadDepositList();
    showToast('✓ 充值检索条件已重置', false);
}
window.resetDepositFilters = resetDepositFilters;

export function resetWithdrawFilters() {
    const phone = document.getElementById('filter-withdraw-phone');
    const id = document.getElementById('filter-withdraw-id');
    const status = document.getElementById('withdraw-status-filter');
    const size = document.getElementById('withdraw-size-select');
    if (phone) phone.value = '';
    if (id) id.value = '';
    if (status) status.value = 'ALL';
    if (size) size.value = '10';
    window.adminPages.withdraw.size = 10;
    window.adminPages.withdraw.current = 1;
    loadWithdrawList();
    showToast('✓ 提现检索条件已重置', false);
}
window.resetWithdrawFilters = resetWithdrawFilters;

export // --- MANUAL FUNDING & ACCOUNTING SUBJECTS ---
// ==========================================

async function loadManualFundingList() {
    showToast('\u6b63\u5728\u52a0\u8f7d\u540e\u53f0\u5b58\u63d0\u5355\u636e\u5217\u8868...', false);
    try {
        const uidVal = document.getElementById('filter-manual-uid').value.trim();
        const subjectIdVal = document.getElementById('filter-manual-subject').value;
        const typeVal = document.getElementById('filter-manual-type').value;
        const statusVal = document.getElementById('filter-manual-status').value;
        
        let queryParams = [];
        if (uidVal) queryParams.push(`userId=${uidVal}`);
        if (subjectIdVal !== 'ALL') queryParams.push(`subjectId=${subjectIdVal}`);
        if (typeVal !== 'ALL') queryParams.push(`type=${typeVal}`);
        if (statusVal !== 'ALL') queryParams.push(`status=${statusVal}`);
        
        const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
        const res = await apiFetch('GET', '/finance/manual-fund-orders' + queryString, null, true);
        if (res.code === 200) {
            let list = res.result || res.data || [];
            list.sort((a, b) => {
                const aId = BigInt(a.id || 0);
                const bId = BigInt(b.id || 0);
                return aId > bId ? -1 : (aId < bId ? 1 : 0);
            });
            
            const paginated = paginateList(list, 'manualFunding');
            const tbody = document.getElementById('manual-funding-table-body');
            if (!tbody) return;
            
            if (paginated.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px 0;">\u65e0\u6570\u636e</td></tr>`;
                return;
            }
            
            tbody.innerHTML = paginated.map(o => {
                const statusColor = o.status === 'PENDING' ? '#F59E0B' : (o.status === 'APPROVED' ? '#10B981' : '#EF4444');
                const statusName = o.status === 'PENDING' ? '\u5f85\u5ba1\u6838' : (o.status === 'APPROVED' ? '\u5df2\u901a\u8fc7' : '\u5df2\u62d2\u7edd');
                const typeColor = o.type === 'DEPOSIT' ? '#10B981' : '#EF4444';
                const typeName = o.type === 'DEPOSIT' ? '\u5145\u503c\u5165\u91d1' : '\u6263\u6b3e\u51fa\u91d1';
                
                let actionHtml = '';
                if (o.status === 'PENDING') {
                    actionHtml = `
                        <div style="display: flex; gap: 8px; justify-content: center;">
                            <button class="action-btn btn-approve" style="padding: 4px 8px; font-size: 0.72rem; border-radius: 4px; cursor: pointer;" onclick="handleManualFundingReview('${o.id}', true)">\u901a\u8fc7</button>
                            <button class="action-btn btn-reject" style="padding: 4px 8px; font-size: 0.72rem; border-radius: 4px; cursor: pointer;" onclick="handleManualFundingReview('${o.id}', false)">\u62d2\u7edd</button>
                        </div>
                    `;
                } else {
                    actionHtml = `<span style="font-size: 0.75rem; color: var(--text-secondary);">${o.auditorEmail || o.auditorId || '-'} (${o.auditRemark || '-'})</span>`;
                }
                
                return `
                    <tr>
                        <td><code>${o.id}</code></td>
                        <td>
                            <div style="font-weight: 600;">${o.userEmail || '-'}</div>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">UID: ${o.userId || '-'}</div>
                        </td>
                        <td style="color: ${typeColor}; font-weight: bold;">${typeName}</td>
                        <td style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${parseFloat(o.amount).toFixed(4)} USDT</td>
                        <td>
                            <div>${o.subjectName || '-'}</div>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">ID: ${o.subjectId || '-'}</div>
                        </td>
                        <td>${o.remark || '-'}</td>
                        <td><span class="status-badge" style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30;">${statusName}</span></td>
                        <td>
                            <div style="font-size: 0.75rem;">${o.applicantEmail || o.applicantId || '-'}</div>
                        </td>
                        <td style="font-size: 0.75rem; color: var(--text-secondary);">${o.createdAt ? new Date(o.createdAt).toLocaleString() : '-'}</td>
                        <td style="text-align: center;">${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        } else {
            showToast(res.errorMessage || '\u83b7\u53d6\u540e\u53f0\u5b58\u63d0\u6570\u636e\u5931\u8d25\uff01', true);
        }
    } catch (e) {
        console.error(e);
        showToast('\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\u6216\u63a5\u53e3\u5bc2\u5e38\uff01', true);
    }
}
window.loadManualFundingList = loadManualFundingList;

function resetManualFundingFilters() {
    const uid = document.getElementById('filter-manual-uid');
    const subject = document.getElementById('filter-manual-subject');
    const type = document.getElementById('filter-manual-type');
    const status = document.getElementById('filter-manual-status');
    if (uid) uid.value = '';
    if (subject) subject.value = 'ALL';
    if (type) type.value = 'ALL';
    if (status) status.value = 'ALL';
    window.adminPages.manualFunding.current = 1;
    loadManualFundingList();
}
window.resetManualFundingFilters = resetManualFundingFilters;

let cachedSubjects = [];

async function openManualFundingModal() {
    document.getElementById('manual-fund-add-amount').value = '';
    document.getElementById('manual-fund-add-remark').value = '';
    document.getElementById('manual-fund-add-type').value = 'DEPOSIT';
    
    document.getElementById('manual-fund-add-user').value = '';
    try {
        await window.adminState.getUsers();
    } catch (e) {
        console.error('Failed to pre-fetch users:', e);
    }
    
    try {
        const subRes = await apiFetch('GET', '/finance/manual-fund-subjects?enabled=true', null, true);
        if (subRes.code === 200) {
            cachedSubjects = subRes.result || subRes.data || [];
            filterSubjectsByScope();
        }
    } catch (e) {
        console.error(e);
    }
    
    const modal = document.getElementById('manual-funding-add-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}
window.openManualFundingModal = openManualFundingModal;

function closeManualFundingModal() {
    const modal = document.getElementById('manual-funding-add-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}
window.closeManualFundingModal = closeManualFundingModal;

function filterSubjectsByScope() {
    const activeType = document.getElementById('manual-fund-add-type').value;
    const select = document.getElementById('manual-fund-add-subject');
    if (!select) return;
    
    const filtered = cachedSubjects.filter(s => s.scope === 'BOTH' || s.scope === activeType);
    select.innerHTML = '<option value="">-- \u8bf7\u9009\u62e9\u79d1\u76ee --</option>' +
        filtered.map(s => `<option value="${s.id}">${s.name} (${s.code})</option>`).join('');
}
window.filterSubjectsByScope = filterSubjectsByScope;

async function submitManualFundingOrder(event) {
    if (event) event.preventDefault();
    
    const userVal = document.getElementById('manual-fund-add-user').value.trim();
    const type = document.getElementById('manual-fund-add-type').value;
    const subjectId = document.getElementById('manual-fund-add-subject').value;
    const amount = document.getElementById('manual-fund-add-amount').value;
    const remark = document.getElementById('manual-fund-add-remark').value;
    
    if (!userVal || !subjectId || !amount || !remark) {
        showToast('请完整填写所有必填字段！', true);
        return;
    }
    
    showToast('正在校验用户信息...', false);
    let userId = null;
    try {
        const users = await window.adminState.getUsers();
        if (users) {
            const matchedUser = users.find(u => 
                (u.phone && String(u.phone).trim() === userVal) || 
                (u.uid && String(u.uid).trim() === userVal)
            );
            if (matchedUser) {
                userId = matchedUser.id;
            }
        }
    } catch (e) {
        console.error('Failed to search user:', e);
    }
    
    if (!userId) {
        showToast('❌ 未找到匹配的交易员，请检查输入的手机号码或UID是否正确！', true);
        return;
    }
    
    showToast('正在提交手工资金调整申请...', false);
    try {
        const rawBodyStr = `{"amount":"${amount}","userId":${userId},"subjectId":${subjectId},"remark":${JSON.stringify(remark)}}`;
        const path = type === 'DEPOSIT' ? '/finance/manual-fund-orders/deposits' : '/finance/manual-fund-orders/withdrawals';
        
        const res = await apiFetchWithRawBody('POST', path, rawBodyStr, true);
        if (res.code === 200) {
            showToast('✓ 手工资金调整申请已成功提交并进入审计流！', false);
            closeManualFundingModal();
            loadManualFundingList();
        } else {
            showToast(res.errorMessage || '手工资金调整提交失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('网络连接失败或接口异常！', true);
    }
}
window.submitManualFundingOrder = submitManualFundingOrder;

async function handleManualFundingReview(id, approved) {
    let auditRemark = '';
    if (!approved) {
        const inputReason = prompt('\u8bf7\u8f93\u5165\u5ba1\u6838\u62d2\u7edd\u7684\u8be6\u7ec6\u7406\u7531\u5907\u6ce8\uff1a');
        if (inputReason === null) return;
        auditRemark = inputReason.trim();
    }
    
    showToast('\u6b63\u5728\u6267\u884c\u4eba\u5de5\u5b58\u63d0\u5ba1\u6838...', false);
    try {
        const path = `/finance/manual-fund-orders/${id}/${approved ? 'approve' : 'reject'}`;
        const rawBodyStr = `{"auditRemark":${JSON.stringify(auditRemark)}}`;
        const res = await apiFetchWithRawBody('POST', path, rawBodyStr, true);
        if (res.code === 200) {
            showToast('\u2713\u200b\u624b\u5de5\u5b58\u63d0\u5355\u636e\u5ba1\u6838\u64cd\u4f5c\u5df2\u6210\u529f\u5b8c\u6210\uff01', false);
            loadManualFundingList();
        } else {
            showToast(res.errorMessage || '\u5ba1\u6838\u64cd\u4f5c\u5931\u8d25\uff01', true);
        }
    } catch (e) {
        console.error(e);
        showToast('\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\u6216\u63a5\u53e3\u5bc2\u5e38\uff01', true);
    }
}
window.handleManualFundingReview = handleManualFundingReview;

async function loadManualSubjectsList() {
    showToast('\u6b63\u5728\u52a0\u8f7d\u4f1a\u8ba1\u79d1\u76ee\u5217\u8868...', false);
    try {
        const res = await apiFetch('GET', '/finance/manual-fund-subjects', null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
            
            const filterSelect = document.getElementById('filter-manual-subject');
            if (filterSelect) {
                const currentVal = filterSelect.value;
                filterSelect.innerHTML = '<option value="ALL">\u5168\u90e8\u79d1\u76ee</option>' +
                    list.filter(s => s.enabled).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                filterSelect.value = currentVal;
            }
            
            const paginated = paginateList(list, 'manualSubjects');
            const tbody = document.getElementById('manual-subjects-table-body');
            if (!tbody) return;
            
            if (paginated.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">\u65e0\u6570\u636e</td></tr>`;
                return;
            }
            
            tbody.innerHTML = paginated.map(s => {
                const statusColor = s.enabled ? '#10B981' : '#EF4444';
                const statusName = s.enabled ? '\u5df2\u542f\u7528' : '\u5df2\u7981\u7528';
                const statusActionText = s.enabled ? '\u7981\u7528' : '\u542f\u7528';
                
                let scopeName = '';
                if (s.scope === 'DEPOSIT') scopeName = '\u4ec5\u5145\u503c (DEPOSIT)';
                else if (s.scope === 'WITHDRAW') scopeName = '\u4ec5\u6263\u6b3e (WITHDRAW)';
                else scopeName = '\u5145\u63d0\u901a\u7528 (BOTH)';
                
                return `
                    <tr>
                        <td><code>${s.id}</code></td>
                        <td style="font-weight: bold; color: var(--text-primary);">${s.name}</td>
                        <td><code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${s.code}</code></td>
                        <td>${scopeName}</td>
                        <td><span class="status-badge" style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30;">${statusName}</span></td>
                        <td>${s.memo || '-'}</td>
                        <td style="text-align: center;">
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button class="action-btn" style="background: rgba(56, 189, 248, 0.1); color: #38BDF8; border: 1px solid rgba(56,189,248,0.2); padding: 2px 6px; font-size: 0.72rem; border-radius: 4px; cursor: pointer;" onclick="openSubjectModal('${s.id}')">\u7f16\u8f91</button>
                                <button class="action-btn" style="background: ${s.enabled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color: ${s.enabled ? '#EF4444' : '#10B981'}; border: 1px solid ${s.enabled ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}; padding: 2px 6px; font-size: 0.72rem; border-radius: 4px; cursor: pointer;" onclick="toggleSubjectStatus('${s.id}', ${!s.enabled})">${statusActionText}</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            showToast(res.errorMessage || '\u83b7\u53d6\u4f1a\u8ba1\u79d1\u76ee\u6570\u636e\u5931\u8d25\uff01', true);
        }
    } catch (e) {
        console.error(e);
        showToast('\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\u6216\u63a5\u53e3\u5bc2\u5e38\uff01', true);
    }
}
window.loadManualSubjectsList = loadManualSubjectsList;

function openSubjectAddModal() {
    openSubjectModal(null);
}
window.openSubjectAddModal = openSubjectAddModal;

async function openSubjectModal(id = null) {
    const titleEl = document.getElementById('manual-subject-title');
    const editIdEl = document.getElementById('manual-subject-edit-id');
    const nameEl = document.getElementById('manual-subject-name');
    const codeEl = document.getElementById('manual-subject-code');
    const scopeEl = document.getElementById('manual-subject-scope');
    const memoEl = document.getElementById('manual-subject-memo');
    
    if (id) {
        titleEl.innerText = '\u7f16\u8f91\u4f1a\u8ba1\u79d1\u76ee';
        editIdEl.value = id;
        
        showToast('\u6b63\u5728\u52a0\u8f7d\u79d1\u76ee\u8be6\u60c5...', false);
        try {
            const res = await apiFetch('GET', '/finance/manual-fund-subjects', null, true);
            if (res.code === 200) {
                const list = res.result || res.data || [];
                const matched = list.find(s => String(s.id) === String(id));
                if (matched) {
                    nameEl.value = matched.name || '';
                    codeEl.value = matched.code || '';
                    scopeEl.value = matched.scope || 'DEPOSIT';
                    memoEl.value = matched.memo || '';
                }
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        titleEl.innerText = '\u65b0\u589e\u4f1a\u8ba1\u79d1\u76ee';
        editIdEl.value = '';
        nameEl.value = '';
        codeEl.value = '';
        scopeEl.value = 'DEPOSIT';
        memoEl.value = '';
    }
    
    const modal = document.getElementById('manual-subject-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}
window.openSubjectModal = openSubjectModal;

function closeSubjectModal() {
    const modal = document.getElementById('manual-subject-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}
window.closeSubjectModal = closeSubjectModal;

async function submitSubjectForm(event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('manual-subject-edit-id').value;
    const name = document.getElementById('manual-subject-name').value.trim();
    const code = document.getElementById('manual-subject-code').value.trim().toUpperCase();
    const scope = document.getElementById('manual-subject-scope').value;
    const memo = document.getElementById('manual-subject-memo').value.trim();
    
    if (!name || !code) {
        showToast('\u540d\u79f0\u548c\u4ee3\u7801\u662f\u5fc5\u586b\u5b57\u6bb5\uff01', true);
        return;
    }
    
    showToast('\u6b63\u5728\u63d0\u4ea4\u5b58\u63d0\u79d1\u76ee\u914d\u7f6e...', false);
    try {
        const bodyObj = {
            name: name,
            code: code,
            scope: scope,
            memo: memo,
            enabled: true,
            priority: 1
        };
        
        let res;
        if (id) {
            res = await apiFetch('PUT', `/finance/manual-fund-subjects/${id}`, bodyObj, true);
        } else {
            res = await apiFetch('POST', '/finance/manual-fund-subjects', bodyObj, true);
        }
        
        if (res.code === 200) {
            showToast('\u2713\u200b\u4f1a\u8ba1\u79d1\u76ee\u914d\u7f6e\u5df2\u6210\u529f\u4fdd\u5b58\uff01', false);
            closeSubjectModal();
            loadManualSubjectsList();
        } else {
            showToast(res.errorMessage || '\u4fdd\u5b58\u79d1\u76ee\u5931\u8d25\uff01', true);
        }
    } catch (e) {
        console.error(e);
        showToast('\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\u6216\u63a5\u53e3\u5bc2\u5e38\uff01', true);
    }
}
window.submitSubjectForm = submitSubjectForm;

async function toggleSubjectStatus(id, enabled) {
    const action = enabled ? 'enable' : 'disable';
    showToast(enabled ? '\u6b63\u5728\u542f\u7528\u4f1a\u8ba1\u79d1\u76ee...' : '\u6b63\u5728\u7981\u7528\u4f1a\u8ba1\u79d1\u76ee...', false);
    try {
        const res = await apiFetch('POST', `/finance/manual-fund-subjects/${id}/${action}`, null, true);
        if (res.code === 200) {
            showToast('\u2713\u200b\u4f1a\u8ba1\u79d1\u76ee\u72b6\u6001\u5df2\u66f4\u65b0\uff01', false);
            loadManualSubjectsList();
        } else {
            showToast(res.errorMessage || '\u66f4\u65b0\u79d1\u76ee\u72b6\u605a\u5931\u8d25\uff01', true);
        }
    } catch (e) {
        console.error(e);
        showToast('\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\u6216\u63a5\u53e3\u5bc2\u5e38\uff01', true);
    }
}
window.toggleSubjectStatus = toggleSubjectStatus;

// Global window bindings for finance center functions
window.loadDepositList = loadDepositList;
window.handleDepositReview = handleDepositReview;
window.loadWithdrawList = loadWithdrawList;
window.handleWithdrawReview = handleWithdrawReview;
window.loadPaymentChannels = loadPaymentChannels;
window.togglePaymentChannelStatus = togglePaymentChannelStatus;
window.deletePaymentChannel = deletePaymentChannel;
window.openPaymentAddModal = openPaymentAddModal;
window.closePaymentAddModal = closePaymentAddModal;
window.submitNewPaymentChannel = submitNewPaymentChannel;
window.openPaymentEditModal = openPaymentEditModal;
window.closePaymentEditModal = closePaymentEditModal;
window.submitEditPaymentChannel = submitEditPaymentChannel;
window.uploadPaymentChannelIcon = uploadPaymentChannelIcon;
window.openReceivingConfigDrawer = openReceivingConfigDrawer;
window.closeReceivingDrawer = closeReceivingDrawer;
window.createNewTargetAndBind = createNewTargetAndBind;
window.saveReceivingTargetChanges = saveReceivingTargetChanges;
window.unbindAndDeleteReceivingTarget = unbindAndDeleteReceivingTarget;
window.loadExchangeRatesList = loadExchangeRatesList;
window.openRateEditModal = openRateEditModal;
window.closeRateEditModal = closeRateEditModal;
window.toggleCustomAssetId = toggleCustomAssetId;
window.submitRateChanges = submitRateChanges;
window.deleteExchangeRate = deleteExchangeRate;