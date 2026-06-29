async function ensureRiskLevelsLoaded() {
    if (!window.cachedRiskLevels || window.cachedRiskLevels.length === 0) {
        try {
            const rlRes = await apiFetch('GET', '/users/risk-levels', null, true);
            if (rlRes.code === 200) {
                window.cachedRiskLevels = rlRes.result || rlRes.data || [];
            }
        } catch (e) {
            console.error("Failed to fetch risk levels:", e);
        }
    }
    return window.cachedRiskLevels || [];
}

async function getUserRiskMap() {
    try {
        const users = await window.adminState.getUsers();
        const map = {};
        users.forEach(u => {
            map[String(u.id)] = u.userRisk || null;
        });
        return map;
    } catch (e) {
        console.error("Failed to map user risk levels:", e);
        return {};
    }
}

function populateRiskLevelFilter(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const levels = window.cachedRiskLevels || [];
    const currentVal = select.value;
    select.innerHTML = '<option value="ALL">全部层级</option>';
    levels.forEach(l => {
        if (l.enabled) {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = `${l.name} (等级 ${l.level || 0})`;
            select.appendChild(opt);
        }
    });
    select.value = currentVal || 'ALL';
}

export // --- DEPOSIT AND WITHDRAWAL FINANCE AUDIT FUNCTIONS ---
async function loadDepositList() {
    if (!currentAdmin) return;
    
    await ensureRiskLevelsLoaded();
    populateRiskLevelFilter('filter-deposit-risk-level');
    const riskLevelFilter = document.getElementById('filter-deposit-risk-level')?.value || 'ALL';
    
    const filterStatus = document.getElementById('deposit-status-filter').value;
    const phoneVal = document.getElementById('filter-deposit-phone')?.value.trim().toLowerCase() || '';
    const remittanceVal = document.getElementById('filter-deposit-remittance')?.value.trim().toLowerCase() || '';
    const startDateVal = document.getElementById('filter-deposit-start-date')?.value || '';
    const endDateVal = document.getElementById('filter-deposit-end-date')?.value || '';
    
    const pageConf = window.adminPages.deposit;
    const sizeSelect = document.getElementById('deposit-size-select');
    if (sizeSelect) {
        sizeSelect.value = pageConf.size;
    }
    
    const isComplexFilter = (remittanceVal !== '' || startDateVal !== '' || endDateVal !== '' || riskLevelFilter !== 'ALL');
    
    try {
        let exchangeRate = 1.0;
        try {
            const rateRes = await apiFetch('GET', '/asset-exchange-rates?baseAssetId=1183348576672026624&quoteAssetId=1126151490264633456', null, true);
            if (rateRes && rateRes.code === 200) {
                const list = rateRes.result || rateRes.data || [];
                const activeRate = list.find(r => r.enabled);
                if (activeRate) {
                    exchangeRate = parseFloat(activeRate.rate) || 1.0;
                }
            }
        } catch (e) {
            console.error('Failed to fetch USDT rate in deposit audit:', e);
        }

        // Pre-fetch users list to map userId to registration phone number
        let userPhoneMap = {};
        let userRiskMap = {};
        try {
            userPhoneMap = await window.adminState.getUserPhoneMap();
            userRiskMap = await getUserRiskMap();
        } catch (e) {
            console.error('Failed to pre-fetch users for deposit mappings:', e);
        }

        let fetchUrl = '';
        if (isComplexFilter) {
            fetchUrl = '/finance/deposits?page=1&pageSize=1000';
            if (filterStatus !== 'ALL') {
                fetchUrl += `&status=${filterStatus}`;
            }
        } else {
            fetchUrl = `/finance/deposits?page=${pageConf.current}&pageSize=${pageConf.size}`;
            if (filterStatus !== 'ALL') {
                fetchUrl += `&status=${filterStatus}`;
            }
            if (phoneVal !== '') {
                const matchedUid = Object.keys(userPhoneMap).find(id => userPhoneMap[id].toLowerCase().includes(phoneVal));
                if (matchedUid) {
                    fetchUrl += `&userId=${matchedUid}`;
                } else {
                    // No user matches phone filter, display empty list immediately
                    const bodyEl = document.getElementById('deposit-table-body');
                    if (bodyEl) {
                        bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的充值记录</td></tr>`;
                    }
                    const indicator = document.getElementById(`deposit-page-indicator`);
                    if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                    return;
                }
            }
        }

        const res = await apiFetch('GET', fetchUrl, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            
            // Sort: PENDING (2) > CONFIRMED (1) > Others (0), then by createdAt descending
            list.sort((a, b) => {
                const getPriority = (status) => {
                    if (status === 'PENDING') return 2;
                    if (status === 'CONFIRMED') return 1;
                    return 0;
                };
                const pA = getPriority(a.status);
                const pB = getPriority(b.status);
                if (pA !== pB) return pB - pA;
                const timeA = parseInt(a.createdAt || 0);
                const timeB = parseInt(b.createdAt || 0);
                return timeB - timeA;
            });

            window.cachedDeposits = list;
            const bodyEl = document.getElementById('deposit-table-body');
            if (!bodyEl) return;
            
            let renderList = list;
            let pagingObj = null;
            
            if (isComplexFilter) {
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
                if (startDateVal !== '') {
                    const startMs = new Date(startDateVal + 'T00:00:00').getTime();
                    filteredList = filteredList.filter(d => parseInt(d.createdAt || 0) >= startMs);
                }
                if (endDateVal !== '') {
                    const endMs = new Date(endDateVal + 'T23:59:59').getTime();
                    filteredList = filteredList.filter(d => parseInt(d.createdAt || 0) <= endMs);
                }
                if (riskLevelFilter !== 'ALL') {
                    const targetLevelDef = window.cachedRiskLevels?.find(l => String(l.id) === String(riskLevelFilter));
                    const targetLevelNum = targetLevelDef ? (targetLevelDef.level || 0) : null;
                    filteredList = filteredList.filter(d => {
                        const r = userRiskMap[String(d.userId)];
                        if (!r) {
                            return targetLevelNum === 0;
                        }
                        return String(r.id) === String(riskLevelFilter) || (targetLevelNum !== null && (r.level || 0) === targetLevelNum);
                    });
                }
                
                if (filteredList.length === 0) {
                    bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的充值记录</td></tr>`;
                    const indicator = document.getElementById(`deposit-page-indicator`);
                    if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                    return;
                }
                
                pagingObj = {
                    page: pageConf.current,
                    pageSize: pageConf.size,
                    records: filteredList.length,
                    pages: Math.max(1, Math.ceil(filteredList.length / pageConf.size))
                };
                renderList = paginateList(filteredList, 'deposit');
            } else {
                pagingObj = res.paging || {
                    page: pageConf.current,
                    pageSize: pageConf.size,
                    records: list.length,
                    pages: 1
                };
                updateAdminPageIndicator('deposit', pagingObj);
            }
            
            bodyEl.innerHTML = renderList.map(d => {
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

                let recordRate = parseFloat(d.collectionFxRate || 0);
                let rate = recordRate > 0 ? recordRate : exchangeRate;
                let usdtAmt = parseFloat(d.amount || 0);
                
                let inrAmt = 0;
                if (d.depositType === 'FIAT' && d.collectedAmount) {
                    inrAmt = parseFloat(d.collectedAmount);
                } else {
                    inrAmt = usdtAmt * rate;
                }
                
                let amountDetails = `<span style="font-weight: 700; color: var(--primary); font-size: 0.88rem;">₹${inrAmt.toFixed(2)} INR</span>`;
                amountDetails += `<br><span style="font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap;">入账: <b>${usdtAmt.toFixed(2)} USDT</b> (汇率: ${rate.toFixed(2)})</span>`;

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
                const userRiskObj = userRiskMap[String(d.userId)] || { name: '未分组', level: 0 };
                const riskLevelName = userRiskObj.name || '未分组';
                const riskLevelBadge = `<br><span style="font-size: 0.68rem; color: #38BDF8; font-weight: 600;">${riskLevelName}</span>`;
                
                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-primary);">${userPhone}${riskLevelBadge}</td>
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

// viewProofImage, handleProofImageError, and closeProofLightbox fallback implementations in finance.js
export function viewProofImage(id) {
    if (window.viewProofImage && window.viewProofImage !== viewProofImage) {
        window.viewProofImage(id);
        return;
    }
    
    const lightbox = document.getElementById('proof-lightbox-modal');
    const lightboxImg = document.getElementById('proof-lightbox-img');
    const errorDiv = document.getElementById('proof-lightbox-error');
    
    if (!lightbox || !lightboxImg || !errorDiv) return;
    
    lightbox.style.display = 'flex';
    lightbox.classList.add('active');
    lightboxImg.style.display = 'none';
    errorDiv.style.display = 'none';
    lightboxImg.src = '';
    
    const list = window.cachedDeposits || [];
    const deposit = list.find(d => String(d.id) === String(id));
    const proofUrl = deposit ? deposit.paymentProof : '';
    window.lastSelectedProofUrl = proofUrl;
    
    if (!proofUrl) {
        lightboxImg.style.display = 'none';
        errorDiv.style.display = 'flex';
        if (typeof window.handleProofImageError === 'function') {
            window.handleProofImageError();
        }
        return;
    }
    
    let targetUrl = proofUrl;
    const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    if (isLocalDev && (targetUrl.includes('storage.googleapis.com') || targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        targetUrl = '/download-gcs?url=' + encodeURIComponent(targetUrl);
    }
    
    lightboxImg.src = targetUrl;
    lightboxImg.style.display = 'block';
}

export function closeProofLightbox() {
    if (window.closeProofLightbox && window.closeProofLightbox !== closeProofLightbox) {
        window.closeProofLightbox();
        return;
    }
    const lightbox = document.getElementById('proof-lightbox-modal');
    const lightboxImg = document.getElementById('proof-lightbox-img');
    const errorDiv = document.getElementById('proof-lightbox-error');
    if (lightbox) lightbox.style.display = 'none';
    if (lightboxImg) lightboxImg.src = '';
    if (errorDiv) errorDiv.style.display = 'none';
}

async function loadWithdrawList() {
    if (!currentAdmin) return;
    
    await ensureRiskLevelsLoaded();
    populateRiskLevelFilter('filter-withdraw-risk-level');
    const riskLevelFilter = document.getElementById('filter-withdraw-risk-level')?.value || 'ALL';
    
    const filterStatus = document.getElementById('withdraw-status-filter').value;
    const phoneVal = document.getElementById('filter-withdraw-phone')?.value.trim().toLowerCase() || '';
    const idVal = document.getElementById('filter-withdraw-id')?.value.trim().toLowerCase() || '';
    const startDateVal = document.getElementById('filter-withdraw-start-date')?.value || '';
    const endDateVal = document.getElementById('filter-withdraw-end-date')?.value || '';
    
    const pageConf = window.adminPages.withdraw;
    const sizeSelect = document.getElementById('withdraw-size-select');
    if (sizeSelect) {
        sizeSelect.value = pageConf.size;
    }
    
    const isComplexFilter = (idVal !== '' || startDateVal !== '' || endDateVal !== '' || riskLevelFilter !== 'ALL');
    
    try {
        let exchangeRate = 1.0;
        try {
            const rateRes = await apiFetch('GET', '/asset-exchange-rates?baseAssetId=1183348576672026624&quoteAssetId=1126151490264633456', null, true);
            if (rateRes && rateRes.code === 200) {
                const list = rateRes.result || rateRes.data || [];
                const activeRate = list.find(r => r.enabled);
                if (activeRate) {
                    exchangeRate = parseFloat(activeRate.rate) || 1.0;
                }
            }
        } catch (e) {
            console.error('Failed to fetch USDT rate in withdrawal audit:', e);
        }

        // Pre-fetch users list to map userId to registration phone number
        let userPhoneMap = {};
        let userRiskMap = {};
        try {
            userPhoneMap = await window.adminState.getUserPhoneMap();
            userRiskMap = await getUserRiskMap();
        } catch (e) {
            console.error('Failed to pre-fetch users for withdraw mappings:', e);
        }

        let fetchUrl = '';
        if (isComplexFilter) {
            fetchUrl = '/finance/withdrawals?page=1&pageSize=1000';
            if (filterStatus !== 'ALL') {
                fetchUrl += `&status=${filterStatus}`;
            }
        } else {
            fetchUrl = `/finance/withdrawals?page=${pageConf.current}&pageSize=${pageConf.size}`;
            if (filterStatus !== 'ALL') {
                fetchUrl += `&status=${filterStatus}`;
            }
            if (phoneVal !== '') {
                const matchedUid = Object.keys(userPhoneMap).find(id => userPhoneMap[id].toLowerCase().includes(phoneVal));
                if (matchedUid) {
                    fetchUrl += `&userId=${matchedUid}`;
                } else {
                    // No user matches phone filter, display empty list immediately
                    const bodyEl = document.getElementById('withdraw-table-body');
                    if (bodyEl) {
                        bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的提现记录</td></tr>`;
                    }
                    const indicator = document.getElementById(`withdraw-page-indicator`);
                    if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                    return;
                }
            }
        }

        const res = await apiFetch('GET', fetchUrl, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            
            // Sort: PENDING (2) > ACCEPTED (1) > Others (0), then by createdAt descending
            list.sort((a, b) => {
                const getPriority = (status) => {
                    if (status === 'PENDING') return 2;
                    if (status === 'ACCEPTED') return 1;
                    return 0;
                };
                const pA = getPriority(a.status);
                const pB = getPriority(b.status);
                if (pA !== pB) return pB - pA;
                const timeA = parseInt(a.createdAt || 0);
                const timeB = parseInt(b.createdAt || 0);
                return timeB - timeA;
            });

            const bodyEl = document.getElementById('withdraw-table-body');
            if (!bodyEl) return;
            
            let renderList = list;
            let pagingObj = null;
            
            if (isComplexFilter) {
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
                if (startDateVal !== '') {
                    const startMs = new Date(startDateVal + 'T00:00:00').getTime();
                    filteredList = filteredList.filter(w => parseInt(w.createdAt || 0) >= startMs);
                }
                if (endDateVal !== '') {
                    const endMs = new Date(endDateVal + 'T23:59:59').getTime();
                    filteredList = filteredList.filter(w => parseInt(w.createdAt || 0) <= endMs);
                }
                if (riskLevelFilter !== 'ALL') {
                    const targetLevelDef = window.cachedRiskLevels?.find(l => String(l.id) === String(riskLevelFilter));
                    const targetLevelNum = targetLevelDef ? (targetLevelDef.level || 0) : null;
                    filteredList = filteredList.filter(w => {
                        const r = userRiskMap[String(w.userId)];
                        if (!r) {
                            return targetLevelNum === 0;
                        }
                        return String(r.id) === String(riskLevelFilter) || (targetLevelNum !== null && (r.level || 0) === targetLevelNum);
                    });
                }
                
                if (filteredList.length === 0) {
                    bodyEl.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的提现记录</td></tr>`;
                    const indicator = document.getElementById(`withdraw-page-indicator`);
                    if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                    return;
                }
                
                pagingObj = {
                    page: pageConf.current,
                    pageSize: pageConf.size,
                    records: filteredList.length,
                    pages: Math.max(1, Math.ceil(filteredList.length / pageConf.size))
                };
                renderList = paginateList(filteredList, 'withdraw');
            } else {
                pagingObj = res.paging || {
                    page: pageConf.current,
                    pageSize: pageConf.size,
                    records: list.length,
                    pages: 1
                };
                updateAdminPageIndicator('withdraw', pagingObj);
            }
            
            bodyEl.innerHTML = renderList.map(w => {
                const date = w.createdAt ? new Date(parseInt(w.createdAt)).toLocaleString() : '--';
                const userPhone = userPhoneMap[String(w.userId)] || '--';
                const userRiskObj = userRiskMap[String(w.userId)] || { name: '未分组', level: 0 };
                const riskLevelName = userRiskObj.name || '未分组';
                const riskLevelBadge = `<br><span style="font-size: 0.68rem; color: #38BDF8; font-weight: 600;">${riskLevelName}</span>`;
                
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

                const isNewRecord = w.createdAt && parseInt(w.createdAt) > 1779700000000;
                let recordRate = parseFloat(w.fxRate || w.collectionFxRate || w.collectionRate || 0);
                let rate = recordRate > 0 ? recordRate : exchangeRate; // dynamic exchange rate fallback

                let inrAmt = 0;
                let inrFee = 0;
                let inrActual = 0;
                let usdtAmt = 0;
                let usdtFee = 0;
                let usdtActual = 0;

                if (isNewRecord) {
                    inrAmt = parseFloat(w.amount || '0');
                    inrFee = parseFloat(w.fee || '0');
                    inrActual = parseFloat(w.actualAmount || w.amount || '0');

                    usdtAmt = inrAmt / rate;
                    usdtFee = inrFee / rate;
                    usdtActual = inrActual / rate;
                } else {
                    usdtAmt = parseFloat(w.amount || '0');
                    usdtFee = parseFloat(w.fee || '0');
                    usdtActual = parseFloat(w.actualAmount || w.amount || '0');

                    inrAmt = usdtAmt * rate;
                    inrFee = usdtFee * rate;
                    inrActual = usdtActual * rate;
                }

                let amountDetails = `<span style="font-weight: 700; color: #EF4444; font-size: 0.88rem;">₹${inrAmt.toFixed(2)} INR</span>`;
                amountDetails += `<br><span style="font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap;">出账: <b>${usdtAmt.toFixed(2)} USDT</b> (汇率: ${rate.toFixed(2)})</span>`;
                
                if (inrFee > 0) {
                    amountDetails += `<br><span style="font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap;">实到: <b>₹${inrActual.toFixed(2)} INR</b> (服务费: ₹${inrFee.toFixed(2)})</span>`;
                } else {
                    amountDetails += `<br><span style="font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap;">实到: <b>₹${inrAmt.toFixed(2)} INR</b> (免手续费)</span>`;
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
                        <td style="font-weight: 600; color: var(--text-primary);">${userPhone}${riskLevelBadge}</td>
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
    if (!currentAdmin) return;
    await ensureAssetsLoaded();
    
    const tableBody = document.getElementById('payment-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 50px 0;">🔄 正在拉取平台支付通道列表...</td></tr>`;
    
    const pageConf = window.adminPages.payment;
    
    try {
        const res = await apiFetch('GET', `/finance/payment-methods?page=${pageConf.current}&pageSize=${pageConf.size}`, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            cachedPaymentChannels = list;
            if (list.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 50px 0;">🫙 平台暂无已配置的支付通道</td></tr>`;
                const indicator = document.getElementById(`payment-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            const pagingObj = res.paging || {
                page: pageConf.current,
                pageSize: pageConf.size,
                records: list.length,
                pages: 1
            };
            updateAdminPageIndicator('payment', pagingObj);
            
            tableBody.innerHTML = list.map(m => {
                const statusBadge = m.enabled 
                    ? `<span class="kyc-badge-status kyc-status-APPROVED" style="font-size:0.75rem; padding: 2px 8px; border-radius: 4px;">已启用</span>`
                    : `<span class="kyc-badge-status kyc-status-NONE" style="font-size:0.75rem; padding: 2px 8px; border-radius: 4px;">已禁用</span>`;
                
                const actionBtn = m.enabled
                    ? `<button class="action-btn btn-reject" onclick="togglePaymentChannelStatus('${m.id}', false)" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer;">禁用</button>`
                    : `<button class="action-btn btn-approve" onclick="togglePaymentChannelStatus('${m.id}', true)" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer;">启用</button>`;
                
                const editBtn = `<button class="action-btn btn-view" onclick="openPaymentEditModal('${m.id}')" style="padding: 4px 8px; font-size: 0.72rem; margin-left: 5px; cursor: pointer; background: rgba(59, 130, 246, 0.08); color: var(--blue);">📝 编辑</button>`;
  
                const deleteBtn = `<button class="action-btn btn-reject" onclick="deletePaymentChannel('${m.id}')" style="padding: 4px 8px; font-size: 0.72rem; background: rgba(239, 68, 68, 0.08); color: var(--red); margin-left: 5px; cursor: pointer;">删除</button>`;
                
                const bindBtn = `<button class="action-btn btn-view" onclick="openBindPaymentRiskLevelsModal('${m.id}')" style="padding: 4px 8px; font-size: 0.72rem; background: rgba(91, 81, 249, 0.08); color: var(--primary); margin-left: 5px; cursor: pointer;">🔗 绑定层级</button>`;
                
                let iconHtml = '';
                if (m.iconUrl && !m.iconUrl.includes('example.com')) {
                    iconHtml = `<img src="${m.iconUrl}" style="max-height: 24px; max-width: 24px; border-radius: 4px; object-fit: contain; vertical-align: middle;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><span style="display:none; font-size:1.15rem; vertical-align: middle;">${m.paymentMethodType === 'CRYPTO_WALLET' ? '🪙' : m.paymentMethodType === 'BANK_TRANSFER' ? '🏦' : '📱'}</span>`;
                } else {
                    iconHtml = `<span style="font-size:1.15rem; vertical-align: middle;">${m.paymentMethodType === 'CRYPTO_WALLET' ? '🪙' : m.paymentMethodType === 'BANK_TRANSFER' ? '🏦' : '📱'}</span>`;
                }
                
                // Format account details based on paymentMethodType
                let detailsHtml = '';
                if (m.paymentMethodType === 'CRYPTO_WALLET') {
                    detailsHtml = `
                        <div style="font-size: 0.75rem; line-height: 1.3;">
                            <b>网络:</b> <span style="font-family: monospace; color: var(--primary);">${m.network || '--'}</span><br>
                            <b>地址:</b> <span style="font-family: monospace; word-break: break-all;">${m.address || '--'}</span>
                            ${m.receivingMemo ? `<br><b>Memo:</b> <span style="font-family: monospace; color: #F59E0B;">${m.receivingMemo}</span>` : ''}
                        </div>
                    `;
                } else if (m.paymentMethodType === 'BANK_TRANSFER' || m.paymentMethodType === 'CARD') {
                    detailsHtml = `
                        <div style="font-size: 0.75rem; line-height: 1.3;">
                            <b>银行:</b> <span>${m.bankName || '--'}</span> (${m.branchName || '--'})<br>
                            <b>账户:</b> <span>${m.accountName || '--'}</span><br>
                            <b>开户人:</b> <span>${m.accountHolderName || '--'}</span><br>
                            <b>账号:</b> <span style="font-family: monospace; font-weight: 600;">${m.accountNumber || '--'}</span>
                            ${m.swiftCode ? `<br><b>SWIFT:</b> <span style="font-family: monospace;">${m.swiftCode}</span>` : ''}
                            ${m.iban ? `<br><b>IBAN:</b> <span style="font-family: monospace;">${m.iban}</span>` : ''}
                        </div>
                    `;
                } else if (m.paymentMethodType === 'UPI') {
                    detailsHtml = `
                        <div style="font-size: 0.75rem; line-height: 1.3;">
                            <b>UPI ID:</b> <span style="font-family: monospace; font-weight: 600; color: var(--primary);">${m.accountNumber || '--'}</span><br>
                            <b>姓名:</b> <span>${m.accountHolderName || '--'}</span>
                        </div>
                    `;
                } else {
                    detailsHtml = `
                        <div style="font-size: 0.75rem; line-height: 1.3;">
                            <b>账号:</b> <span style="font-family: monospace; font-weight: 600;">${m.accountNumber || '--'}</span><br>
                            <b>姓名:</b> <span>${m.accountHolderName || '--'}</span>
                        </div>
                    `;
                }
                
                // Show QR code indicator if exists
                if (m.qrCodeUrl) {
                    detailsHtml += `
                        <div style="margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 0.65rem; color: #10B981; font-weight: bold; background: rgba(16,185,129,0.08); padding: 1px 4px; border-radius: 3px;">🖼️ 附二维码</span>
                            <a href="${m.qrCodeUrl}" target="_blank" style="font-size: 0.65rem; color: var(--primary); text-decoration: underline;">查看</a>
                        </div>
                    `;
                }
                
                const assetSymbol = translateAsset(m.assetId);
                const limitText = `
                    <div style="font-size: 0.75rem; line-height: 1.3; font-family: 'Outfit';">
                        <b>Min:</b> ${m.minDepositAmount || 0} ${assetSymbol}<br>
                        <b>Max:</b> ${m.maxDepositAmount || 0} ${assetSymbol}
                    </div>
                `;

                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.72rem;">${m.id}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${iconHtml}
                                <div style="font-weight: 600; color: var(--text-primary);">${m.name || '--'}</div>
                            </div>
                        </td>
                        <td>
                            <div style="font-weight: bold; color: var(--primary); font-size: 0.72rem;">${m.paymentMethodType || '--'}</div>
                            <div style="font-size: 0.68rem; color: var(--text-secondary); font-family: monospace;">Asset: ${assetSymbol}</div>
                        </td>
                        <td>${detailsHtml}</td>
                        <td>${limitText}</td>
                        <td style="font-size: 0.75rem;">
                            <b>排序:</b> ${m.orderIndex || 0}<br>
                            <b>权重:</b> ${m.priority || 0}
                        </td>
                        <td>${statusBadge}</td>
                        <td>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
                                ${actionBtn}
                                ${editBtn}
                                ${deleteBtn}
                                ${bindBtn}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--red); padding: 50px 0;">⚠️ 获取支付通道失败：${res.errorMessage || '错误'}</td></tr>`;
        }
    } catch (e) {
        console.error('Failed to load payment channels:', e);
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--red); padding: 50px 0;">⚠️ 发生网络异常，无法拉取支付通道列表！</td></tr>`;
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

let cachedAssets = [];
async function ensureAssetsLoaded() {
    if (cachedAssets && cachedAssets.length > 0) return cachedAssets;
    try {
        const res = await apiFetch('GET', '/assets?page=1&pageSize=1000', null, true);
        if (res.code === 200) {
            cachedAssets = res.result || res.data || [];
        }
    } catch (e) {
        console.error("Failed to load assets:", e);
    }
    return cachedAssets;
}

function translateAsset(assetId) {
    const asset = cachedAssets.find(a => String(a.id) === String(assetId));
    if (asset) return asset.symbol;
    const symbolMap = {
        '1183348576672026624': 'USDT',
        '1183348576672026625': 'BTC',
        '1183348576642666496': 'BTC',
        '1183348576630083584': 'ETH',
        '1126151490264633349': 'USD',
        '1126151490264633456': 'INR',
        '1126151490264633373': 'HKD',
        '1126151490264633358': 'EUR'
    };
    return symbolMap[String(assetId)] || `Asset(${assetId})`;
}

export function togglePaymentTypeFields(prefix) {
    const type = document.getElementById(`payment-${prefix}-paymentMethodType`).value;
    const cryptoSec = document.getElementById(`payment-${prefix}-crypto-sec`);
    const bankSec = document.getElementById(`payment-${prefix}-bank-sec`);
    const walletSec = document.getElementById(`payment-${prefix}-wallet-sec`);
    const qrSec = document.getElementById(`payment-${prefix}-qrcode-container`);
    
    if (cryptoSec) cryptoSec.style.display = 'none';
    if (bankSec) bankSec.style.display = 'none';
    if (walletSec) walletSec.style.display = 'none';
    if (qrSec) qrSec.style.display = 'none';
    
    if (type === 'CRYPTO_WALLET') {
        if (cryptoSec) cryptoSec.style.display = 'flex';
        if (qrSec) qrSec.style.display = 'block';
    } else if (type === 'BANK_TRANSFER' || type === 'CARD') {
        if (bankSec) bankSec.style.display = 'flex';
    } else {
        // UPI / ALIPAY / WECHAT_PAY / PAYPAL, etc.
        if (walletSec) walletSec.style.display = 'flex';
        if (qrSec) qrSec.style.display = 'block';
    }
}

export async function openPaymentAddModal() {
    const modal = document.getElementById('payment-add-modal');
    if (!modal) return;
    
    // Populate assets dropdown
    const assets = await ensureAssetsLoaded();
    const assetSelect = document.getElementById('payment-add-assetId');
    if (assetSelect) {
        assetSelect.innerHTML = assets.map(a => `<option value="${a.id}">${a.symbol} (${a.name})</option>`).join('');
    }
    
    // Reset fields
    document.getElementById('payment-add-name').value = '';
    document.getElementById('payment-add-paymentMethodType').value = 'CRYPTO_WALLET';
    document.getElementById('payment-add-hintDescription').value = '';
    document.getElementById('payment-add-address').value = '';
    document.getElementById('payment-add-network').value = 'TRC20';
    document.getElementById('payment-add-receivingMemo').value = '';
    document.getElementById('payment-add-accountHolderName').value = '';
    document.getElementById('payment-add-accountName').value = '';
    document.getElementById('payment-add-accountNumber').value = '';
    document.getElementById('payment-add-bankName').value = '';
    document.getElementById('payment-add-branchName').value = '';
    document.getElementById('payment-add-swiftCode').value = '';
    document.getElementById('payment-add-iban').value = '';
    document.getElementById('payment-add-regionCode').value = 'HK';
    document.getElementById('payment-add-walletAccountNumber').value = '';
    document.getElementById('payment-add-walletAccountHolderName').value = '';
    document.getElementById('payment-add-qrCodeUrl').value = '';
    document.getElementById('payment-add-minDepositAmount').value = '10';
    document.getElementById('payment-add-maxDepositAmount').value = '10000';
    document.getElementById('payment-add-orderIndex').value = '10';
    document.getElementById('payment-add-priority').value = '100';
    document.getElementById('payment-add-qrCodeExpiredAt').value = '';
    document.getElementById('payment-add-presetDepositItems').value = '';
    document.getElementById('payment-add-iconUrl').value = '';
    document.getElementById('payment-add-helpContent').value = '';
    document.getElementById('payment-add-memo').value = '';
    
    const qrPreview = document.getElementById('payment-add-qrCodePreview');
    if (qrPreview) {
        qrPreview.src = '';
        qrPreview.style.display = 'none';
    }
    const iconPreview = document.getElementById('payment-add-iconPreview');
    if (iconPreview) {
        iconPreview.src = '';
        iconPreview.style.display = 'none';
    }
    
    togglePaymentTypeFields('add');
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

export function closePaymentAddModal() {
    const modal = document.getElementById('payment-add-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

export async function openPaymentEditModal(channelId) {
    const modal = document.getElementById('payment-edit-modal');
    if (!modal) return;
    
    const m = cachedPaymentChannels.find(item => String(item.id) === String(channelId));
    if (!m) {
        showToast('未找到通道配置数据！', true);
        return;
    }
    
    // Populate assets dropdown
    const assets = await ensureAssetsLoaded();
    const assetSelect = document.getElementById('payment-edit-assetId');
    if (assetSelect) {
        assetSelect.innerHTML = assets.map(a => `<option value="${a.id}">${a.symbol} (${a.name})</option>`).join('');
    }
    
    // Set values
    document.getElementById('payment-edit-id').value = m.id;
    document.getElementById('payment-edit-name').value = m.name || '';
    document.getElementById('payment-edit-assetId').value = m.assetId || '';
    document.getElementById('payment-edit-paymentMethodType').value = m.paymentMethodType || 'CRYPTO_WALLET';
    document.getElementById('payment-edit-hintDescription').value = m.hintDescription || '';
    document.getElementById('payment-edit-address').value = m.address || '';
    document.getElementById('payment-edit-network').value = m.network || '';
    document.getElementById('payment-edit-receivingMemo').value = m.receivingMemo || '';
    document.getElementById('payment-edit-accountHolderName').value = m.accountHolderName || '';
    document.getElementById('payment-edit-accountName').value = m.accountName || '';
    document.getElementById('payment-edit-accountNumber').value = m.accountNumber || '';
    document.getElementById('payment-edit-bankName').value = m.bankName || '';
    document.getElementById('payment-edit-branchName').value = m.branchName || '';
    document.getElementById('payment-edit-swiftCode').value = m.swiftCode || '';
    document.getElementById('payment-edit-iban').value = m.iban || '';
    document.getElementById('payment-edit-regionCode').value = m.regionCode || 'HK';
    document.getElementById('payment-edit-walletAccountNumber').value = m.accountNumber || '';
    document.getElementById('payment-edit-walletAccountHolderName').value = m.accountHolderName || '';
    document.getElementById('payment-edit-qrCodeUrl').value = m.qrCodeUrl || '';
    document.getElementById('payment-edit-minDepositAmount').value = m.minDepositAmount || '0';
    document.getElementById('payment-edit-maxDepositAmount').value = m.maxDepositAmount || '0';
    document.getElementById('payment-edit-orderIndex').value = m.orderIndex || '0';
    document.getElementById('payment-edit-priority').value = m.priority || '0';
    document.getElementById('payment-edit-qrCodeExpiredAt').value = m.qrCodeExpiredAt || '';
    document.getElementById('payment-edit-presetDepositItems').value = m.presetDepositItems ? m.presetDepositItems.join(',') : '';
    document.getElementById('payment-edit-iconUrl').value = m.iconUrl || '';
    document.getElementById('payment-edit-helpContent').value = m.helpContent || '';
    document.getElementById('payment-edit-memo').value = m.memo || '';
    
    // Set previews
    const qrPreview = document.getElementById('payment-edit-qrCodePreview');
    if (qrPreview) {
        if (m.qrCodeUrl) {
            qrPreview.src = m.qrCodeUrl;
            qrPreview.style.display = 'block';
        } else {
            qrPreview.src = '';
            qrPreview.style.display = 'none';
        }
    }
    const iconPreview = document.getElementById('payment-edit-iconPreview');
    if (iconPreview) {
        if (m.iconUrl) {
            iconPreview.src = m.iconUrl;
            iconPreview.style.display = 'block';
        } else {
            iconPreview.src = '';
            iconPreview.style.display = 'none';
        }
    }
    
    togglePaymentTypeFields('edit');
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

export function closePaymentEditModal() {
    const modal = document.getElementById('payment-edit-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function collectPaymentFormData(prefix) {
    const name = document.getElementById(`payment-${prefix}-name`).value.trim();
    const assetId = parseInt(document.getElementById(`payment-${prefix}-assetId`).value);
    const paymentMethodType = document.getElementById(`payment-${prefix}-paymentMethodType`).value;
    const hintDescription = document.getElementById(`payment-${prefix}-hintDescription`).value.trim();
    const minDepositAmount = parseFloat(document.getElementById(`payment-${prefix}-minDepositAmount`).value || '0');
    const maxDepositAmount = parseFloat(document.getElementById(`payment-${prefix}-maxDepositAmount`).value || '0');
    const orderIndex = parseInt(document.getElementById(`payment-${prefix}-orderIndex`).value || '0');
    const priority = parseInt(document.getElementById(`payment-${prefix}-priority`).value || '0');
    const qrCodeExpiredAt = document.getElementById(`payment-${prefix}-qrCodeExpiredAt`).value.trim();
    const presetDepositStr = document.getElementById(`payment-${prefix}-presetDepositItems`).value.trim();
    const iconUrl = document.getElementById(`payment-${prefix}-iconUrl`).value.trim();
    const helpContent = document.getElementById(`payment-${prefix}-helpContent`).value.trim();
    const memo = document.getElementById(`payment-${prefix}-memo`).value.trim();
    
    const body = {
        name: name,
        assetId: assetId,
        paymentMethodType: paymentMethodType,
        hintDescription: hintDescription,
        minDepositAmount: minDepositAmount,
        maxDepositAmount: maxDepositAmount,
        orderIndex: orderIndex,
        priority: priority,
        iconUrl: iconUrl,
        helpContent: helpContent,
        memo: memo,
        enabled: true,
        translations: [
            { localeTag: 'en', displayName: name, isDefault: true, description: hintDescription, helpContent: helpContent },
            { localeTag: 'zh-Hans', displayName: name, isDefault: false, description: hintDescription, helpContent: helpContent }
        ]
    };
    
    if (qrCodeExpiredAt) body.qrCodeExpiredAt = qrCodeExpiredAt;
    
    if (presetDepositStr) {
        body.presetDepositItems = presetDepositStr.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    // Set type-specific fields
    if (paymentMethodType === 'CRYPTO_WALLET') {
        body.address = document.getElementById(`payment-${prefix}-address`).value.trim();
        body.network = document.getElementById(`payment-${prefix}-network`).value.trim();
        body.receivingMemo = document.getElementById(`payment-${prefix}-receivingMemo`).value.trim();
        body.qrCodeUrl = document.getElementById(`payment-${prefix}-qrCodeUrl`).value.trim();
    } else if (paymentMethodType === 'BANK_TRANSFER' || paymentMethodType === 'CARD') {
        body.accountHolderName = document.getElementById(`payment-${prefix}-accountHolderName`).value.trim();
        body.accountName = document.getElementById(`payment-${prefix}-accountName`).value.trim();
        body.accountNumber = document.getElementById(`payment-${prefix}-accountNumber`).value.trim();
        body.bankName = document.getElementById(`payment-${prefix}-bankName`).value.trim();
        body.branchName = document.getElementById(`payment-${prefix}-branchName`).value.trim();
        body.swiftCode = document.getElementById(`payment-${prefix}-swiftCode`).value.trim();
        body.iban = document.getElementById(`payment-${prefix}-iban`).value.trim();
        body.regionCode = document.getElementById(`payment-${prefix}-regionCode`).value.trim();
    } else {
        // UPI / ALIPAY / WECHAT_PAY etc.
        body.accountNumber = document.getElementById(`payment-${prefix}-walletAccountNumber`).value.trim();
        body.accountHolderName = document.getElementById(`payment-${prefix}-walletAccountHolderName`).value.trim();
        body.qrCodeUrl = document.getElementById(`payment-${prefix}-qrCodeUrl`).value.trim();
    }
    
    return body;
}

async function submitNewPaymentChannel(event) {
    event.preventDefault();
    const body = collectPaymentFormData('add');
    
    showToast('正在创建支付通道...', false);
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

async function submitEditPaymentChannel(event) {
    event.preventDefault();
    const id = document.getElementById('payment-edit-id').value;
    const body = collectPaymentFormData('edit');
    
    showToast('正在保存支付通道配置...', false);
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

export async function openBindPaymentRiskLevelsModal(paymentMethodId) {
    const modal = document.getElementById('bind-payment-risk-levels-modal');
    if (!modal) return;
    
    document.getElementById('bind-payment-id').value = paymentMethodId;
    
    const container = document.getElementById('bind-risk-levels-checkbox-container');
    if (container) {
        container.innerHTML = '⏳ 正在加载层级信息...';
    }
    
    try {
        // Load available risk levels
        await ensureRiskLevelsLoaded();
        
        // Fetch current bindings
        const bindingsRes = await apiFetch('GET', `/finance/payment-methods/${paymentMethodId}/risk-level-bindings`, null, true);
        const boundIds = bindingsRes.code === 200 ? (bindingsRes.result || bindingsRes.data || []) : [];
        
        if (container) {
            if (!window.cachedRiskLevels || window.cachedRiskLevels.length === 0) {
                container.innerHTML = '⚠️ 系统未配置任何用户风控层级！';
                return;
            }
            
            container.innerHTML = window.cachedRiskLevels.map(rl => {
                const isChecked = boundIds.includes(rl.id) ? 'checked' : '';
                return `
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; cursor: pointer; color: var(--text-primary);">
                        <input type="checkbox" class="payment-bind-risk-checkbox" value="${rl.id}" ${isChecked}>
                        <span>${rl.name} (Level ${rl.level || 0})</span>
                    </label>
                `;
            }).join('');
        }
        
    } catch (e) {
        console.error("Failed to load payment risk level bindings:", e);
        if (container) container.innerHTML = '❌ 层级或绑定数据获取失败';
    }
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

export function closeBindPaymentRiskLevelsModal() {
    const modal = document.getElementById('bind-payment-risk-levels-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

export async function submitPaymentRiskLevelBindings(event) {
    if (event) event.preventDefault();
    const paymentMethodId = document.getElementById('bind-payment-id').value;
    
    const checkboxes = document.querySelectorAll('.payment-bind-risk-checkbox:checked');
    const riskLevelIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    showToast('正在保存风控可见层级设置...', false);
    try {
        const res = await apiFetch('PUT', `/finance/payment-methods/${paymentMethodId}/risk-level-bindings`, {
            riskLevelIds: riskLevelIds
        }, true);
        
        if (res.code === 200) {
            showToast('✓ 可见风控层级设置已更新！', false);
            closeBindPaymentRiskLevelsModal();
            loadPaymentChannels();
        } else {
            showToast(res.errorMessage || '可见风控层级修改失败！', true);
        }
    } catch (e) {
        console.error("Submit risk level bindings failed:", e);
        showToast('可见层级保存网络异常！', true);
    }
}

window.loadPaymentChannels = loadPaymentChannels;
window.togglePaymentChannelStatus = togglePaymentChannelStatus;
window.deletePaymentChannel = deletePaymentChannel;
window.togglePaymentTypeFields = togglePaymentTypeFields;
window.openPaymentAddModal = openPaymentAddModal;
window.closePaymentAddModal = closePaymentAddModal;
window.openPaymentEditModal = openPaymentEditModal;
window.closePaymentEditModal = closePaymentEditModal;
window.submitNewPaymentChannel = submitNewPaymentChannel;
window.submitEditPaymentChannel = submitEditPaymentChannel;
window.openBindPaymentRiskLevelsModal = openBindPaymentRiskLevelsModal;
window.closeBindPaymentRiskLevelsModal = closeBindPaymentRiskLevelsModal;
window.submitPaymentRiskLevelBindings = submitPaymentRiskLevelBindings;

// Deprecated sub-tabs and bindings logic removed.


export // --- PLATFORM ASSET EXCHANGE RATES MANAGEMENT (汇率管理) ---
async function loadExchangeRatesList() {
    const tableBody = document.getElementById('rates-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-secondary);">🔄 正在调取全站结算汇率配置...</td></tr>`;
    
    const pageConf = window.adminPages.rates;
    
    try {
        const res = await apiFetch('GET', `/asset-exchange-rates?page=${pageConf.current}&pageSize=${pageConf.size}`, null, true);
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
            
            const pagingObj = res.paging || {
                page: pageConf.current,
                pageSize: pageConf.size,
                records: rates.length,
                pages: 1
            };
            updateAdminPageIndicator('rates', pagingObj);
            
            tableBody.innerHTML = rates.map(r => {
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
        const payloadStr = `{"baseAssetId":${baseAssetId},"quoteAssetId":${quoteAssetId},"rate":${rate},"enabled":${enabled},"remark":${JSON.stringify(remark)}}`;
        
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
    const start = document.getElementById('filter-deposit-start-date');
    const end = document.getElementById('filter-deposit-end-date');
    const status = document.getElementById('deposit-status-filter');
    const size = document.getElementById('deposit-size-select');
    const riskLevel = document.getElementById('filter-deposit-risk-level');
    if (phone) phone.value = '';
    if (remittance) remittance.value = '';
    if (start) start.value = '';
    if (end) end.value = '';
    if (status) status.value = 'ALL';
    if (size) size.value = '10';
    if (riskLevel) riskLevel.value = 'ALL';
    window.adminPages.deposit.size = 10;
    window.adminPages.deposit.current = 1;
    loadDepositList();
    showToast('✓ 充值检索条件已重置', false);
}
window.resetDepositFilters = resetDepositFilters;

export function resetWithdrawFilters() {
    const phone = document.getElementById('filter-withdraw-phone');
    const id = document.getElementById('filter-withdraw-id');
    const start = document.getElementById('filter-withdraw-start-date');
    const end = document.getElementById('filter-withdraw-end-date');
    const status = document.getElementById('withdraw-status-filter');
    const size = document.getElementById('withdraw-size-select');
    const riskLevel = document.getElementById('filter-withdraw-risk-level');
    if (phone) phone.value = '';
    if (id) id.value = '';
    if (start) start.value = '';
    if (end) end.value = '';
    if (status) status.value = 'ALL';
    if (size) size.value = '10';
    if (riskLevel) riskLevel.value = 'ALL';
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
    
    await ensureRiskLevelsLoaded();
    populateRiskLevelFilter('filter-manual-risk-level');
    const riskLevelFilter = document.getElementById('filter-manual-risk-level')?.value || 'ALL';
    
    let exchangeRate = 1.0;
    try {
        const rateRes = await apiFetch('GET', '/asset-exchange-rates?baseAssetId=1183348576672026624&quoteAssetId=1126151490264633456', null, true);
        if (rateRes && rateRes.code === 200) {
            const list = rateRes.result || rateRes.data || [];
            const activeRate = list.find(r => r.enabled);
            if (activeRate) {
                exchangeRate = parseFloat(activeRate.rate) || 1.0;
                window.userUsdtToInrRate = exchangeRate;
            }
        }
    } catch (e) {
        console.error('Failed to fetch USDT rate in manual funding list:', e);
    }

    let userRiskMap = {};
    try {
        userRiskMap = await getUserRiskMap();
    } catch (e) {
        console.error('Failed to map user risk levels in manual funding:', e);
    }

    try {
        const uidVal = document.getElementById('filter-manual-uid').value.trim();
        const subjectIdVal = document.getElementById('filter-manual-subject').value;
        const typeVal = document.getElementById('filter-manual-type').value;
        const statusVal = document.getElementById('filter-manual-status').value;
        
        const pageConf = window.adminPages.manualFunding;
        
        const isComplexFilter = (riskLevelFilter !== 'ALL');
        
        let queryParams = [];
        if (uidVal) queryParams.push(`userId=${uidVal}`);
        if (subjectIdVal !== 'ALL') queryParams.push(`subjectId=${subjectIdVal}`);
        if (typeVal !== 'ALL') queryParams.push(`type=${typeVal}`);
        if (statusVal !== 'ALL') queryParams.push(`status=${statusVal}`);
        
        if (isComplexFilter) {
            queryParams.push(`page=1`);
            queryParams.push(`pageSize=1000`);
        } else {
            queryParams.push(`page=${pageConf.current}`);
            queryParams.push(`pageSize=${pageConf.size}`);
        }
        
        const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
        const res = await apiFetch('GET', '/finance/manual-fund-orders' + queryString, null, true);
        if (res.code === 200) {
            let list = res.result || res.data || [];
            list.sort((a, b) => {
                const aId = BigInt(a.id || 0);
                const bId = BigInt(b.id || 0);
                return aId > bId ? -1 : (aId < bId ? 1 : 0);
            });
            
            const tbody = document.getElementById('manual-funding-table-body');
            if (!tbody) return;
            
            let renderList = list;
            let pagingObj = null;
            
            if (isComplexFilter) {
                let filteredList = list;
                if (riskLevelFilter !== 'ALL') {
                    const targetLevelDef = window.cachedRiskLevels?.find(l => String(l.id) === String(riskLevelFilter));
                    const targetLevelNum = targetLevelDef ? (targetLevelDef.level || 0) : null;
                    filteredList = filteredList.filter(o => {
                        const r = userRiskMap[String(o.userId)];
                        if (!r) {
                            return targetLevelNum === 0;
                        }
                        return String(r.id) === String(riskLevelFilter) || (targetLevelNum !== null && (r.level || 0) === targetLevelNum);
                    });
                }
                
                if (filteredList.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的记录</td></tr>`;
                    const indicator = document.getElementById(`manualFunding-page-indicator`);
                    if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                    return;
                }
                
                pagingObj = {
                    page: pageConf.current,
                    pageSize: pageConf.size,
                    records: filteredList.length,
                    pages: Math.max(1, Math.ceil(filteredList.length / pageConf.size))
                };
                renderList = paginateList(filteredList, 'manualFunding');
            } else {
                if (list.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px 0;">\u65e0\u6570\u636e</td></tr>`;
                    const indicator = document.getElementById(`manualFunding-page-indicator`);
                    if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                    return;
                }
                
                pagingObj = res.paging || {
                    page: pageConf.current,
                    pageSize: pageConf.size,
                    records: list.length,
                    pages: 1
                };
                updateAdminPageIndicator('manualFunding', pagingObj);
            }
            
            tbody.innerHTML = renderList.map(o => {
                const statusColor = o.status === 'PENDING' ? '#F59E0B' : (o.status === 'APPROVED' ? '#10B981' : '#EF4444');
                const statusName = o.status === 'PENDING' ? '\u5f85\u5ba1\u6838' : (o.status === 'APPROVED' ? '\u5df2\u901a\u8fc7' : '\u5df2\u62d2\u7edd');
                const typeColor = o.type === 'DEPOSIT' ? '#10B981' : '#EF4444';
                const typeName = o.type === 'DEPOSIT' ? '\u5145\u503c\u5165\u91d1' : '\u6263\u6b3e\u51fa\u91d1';
                
                const rate = window.userUsdtToInrRate || exchangeRate || 1.0;
                const usdtAmt = parseFloat(o.amount || 0);
                const inrAmt = usdtAmt * rate;
                
                let amountDetails = `<span style="font-weight: 700; color: ${typeColor}; font-size: 0.88rem;">₹${inrAmt.toFixed(2)} INR</span>`;
                amountDetails += `<br><span style="font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap;">额度: <b>${usdtAmt.toFixed(4)} USDT</b> (汇率: ${rate.toFixed(2)})</span>`;

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
                
                const userRiskObj = userRiskMap[String(o.userId)] || { name: '未分组', level: 0 };
                const riskLevelName = userRiskObj.name || '未分组';
                const riskLevelBadge = `<br><span style="font-size: 0.68rem; color: #38BDF8; font-weight: 600;">${riskLevelName}</span>`;

                return `
                    <tr>
                        <td><code>${o.id}</code></td>
                        <td>
                            <div style="font-weight: 600;">${o.userEmail || '-'}</div>
                            <div style="font-size: 0.72rem; color: var(--text-muted);">UID: ${o.userId || '-'}${riskLevelBadge}</div>
                        </td>
                        <td style="color: ${typeColor}; font-weight: bold;">${typeName}</td>
                        <td>${amountDetails}</td>
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

function updateManualFundInrPreview() {
    const amountEl = document.getElementById('manual-fund-add-amount');
    const previewEl = document.getElementById('manual-fund-add-inr-preview');
    if (!amountEl || !previewEl) return;
    const val = parseFloat(amountEl.value) || 0;
    const rate = window.userUsdtToInrRate || 1.0;
    if (val > 0) {
        previewEl.innerText = `≈ ₹${(val * rate).toFixed(2)} INR`;
    } else {
        previewEl.innerText = '';
    }
}
window.updateManualFundInrPreview = updateManualFundInrPreview;

function resetManualFundingFilters() {
    const uid = document.getElementById('filter-manual-uid');
    const subject = document.getElementById('filter-manual-subject');
    const type = document.getElementById('filter-manual-type');
    const status = document.getElementById('filter-manual-status');
    const riskLevel = document.getElementById('filter-manual-risk-level');
    if (uid) uid.value = '';
    if (subject) subject.value = 'ALL';
    if (type) type.value = 'ALL';
    if (status) status.value = 'ALL';
    if (riskLevel) riskLevel.value = 'ALL';
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
    
    const previewEl = document.getElementById('manual-fund-add-inr-preview');
    if (previewEl) previewEl.innerText = '';
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
        const matchPhone = (phone1, phone2) => {
            if (!phone1 || !phone2) return false;
            const c1 = String(phone1).replace(/\D/g, '');
            const c2 = String(phone2).replace(/\D/g, '');
            if (c1 === c2) return true;
            if (c1.length >= 10 && c2.length >= 10) {
                return c1.slice(-10) === c2.slice(-10);
            }
            return false;
        };

        const users = await window.adminState.getUsers();
        if (users) {
            const matchedUser = users.find(u => 
                (u.phone && matchPhone(u.phone, userVal)) || 
                (u.uid && String(u.uid).trim() === userVal) ||
                (u.id && String(u.id).trim() === userVal)
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
    
    const pageConf = window.adminPages.manualSubjects;
    
    try {
        // Fetch all to populate the filter select dropdown
        try {
            const allRes = await apiFetch('GET', '/finance/manual-fund-subjects?page=1&pageSize=1000', null, true);
            if (allRes.code === 200) {
                const allList = allRes.result || allRes.data || [];
                const filterSelect = document.getElementById('filter-manual-subject');
                if (filterSelect) {
                    const currentVal = filterSelect.value;
                    filterSelect.innerHTML = '<option value="ALL">全部科目</option>' +
                        allList.filter(s => s.enabled).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                    filterSelect.value = currentVal;
                }
            }
        } catch (err) {
            console.error("Failed to load all manual subjects for filter dropdown:", err);
        }

        // Fetch paginated subjects for the table
        const res = await apiFetch('GET', `/finance/manual-fund-subjects?page=${pageConf.current}&pageSize=${pageConf.size}`, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
            
            const tbody = document.getElementById('manual-subjects-table-body');
            if (!tbody) return;
            
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">\u65e0\u6570\u636e</td></tr>`;
                const indicator = document.getElementById(`manualSubjects-page-indicator`);
                if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
                return;
            }
            
            const pagingObj = res.paging || {
                page: pageConf.current,
                pageSize: pageConf.size,
                records: list.length,
                pages: 1
            };
            updateAdminPageIndicator('manualSubjects', pagingObj);
            
            tbody.innerHTML = list.map(s => {
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
                        <td>${s.memo || '-'}</td>
                        <td><span class="status-badge" style="background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30;">${statusName}</span></td>
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
                    window.currentEditingSubject = matched;
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
        window.currentEditingSubject = null;
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
        const originalPriority = (window.currentEditingSubject && window.currentEditingSubject.priority !== undefined) ? window.currentEditingSubject.priority : 1;
        const originalEnabled = (window.currentEditingSubject && window.currentEditingSubject.enabled !== undefined) ? window.currentEditingSubject.enabled : true;
        
        const bodyObj = {
            name: name,
            code: code,
            scope: scope,
            memo: memo,
            enabled: originalEnabled,
            priority: originalPriority
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

export async function uploadPaymentChannelIcon(fileInputId, urlInputId, imgPreviewId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    const imgPreview = document.getElementById(imgPreviewId);
    const urlInput = document.getElementById(urlInputId);
    
    showToast('⏳ 正在上传通道图标/二维码...', false);
    try {
        const presignedRes = await apiFetch('POST', '/upload/presigned', {
            contentType: file.type || 'image/png',
            fileName: file.name || 'payment_icon.png',
            type: 'payment'
        }, true);
        
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
            throw new Error('上传二进制文件失败');
        }
        
        const confirmRes = await apiFetch('POST', '/upload/confirm', {
            path: storagePath
        }, true);
        
        if (confirmRes.code !== 200) {
            throw new Error(confirmRes.errorMessage || '确认上传失败');
        }
        
        // Success! Set inputs
        if (urlInput) urlInput.value = downloadUrl;
        if (imgPreview) {
            imgPreview.src = downloadUrl;
            imgPreview.style.display = 'block';
        }
        showToast('✓ 上传成功！', false);
    } catch (e) {
        console.error('Upload payment icon failed:', e);
        showToast('❌ 上传失败: ' + e.message, true);
    }
}

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
window.loadExchangeRatesList = loadExchangeRatesList;
window.openRateEditModal = openRateEditModal;
window.closeRateEditModal = closeRateEditModal;
window.toggleCustomAssetId = toggleCustomAssetId;
window.submitRateChanges = submitRateChanges;
window.deleteExchangeRate = deleteExchangeRate;