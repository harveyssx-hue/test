export async function fetchUserUsdtBalance(userId) {
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
            
            const usdtVal = balanceMap['USDT'] || 0;
            const inrVal = balanceMap['INR'] || 0;
            const rate = window.userUsdtToInrRate || 1.0;
            const totalInr = inrVal + usdtVal * rate;
            
            if (totalInr > 0) {
                balanceStrings.push(`â‚¹${totalInr.toFixed(2)}`);
                hasNonZero = true;
            }
            
            for (const symbol of Object.keys(balanceMap)) {
                if (symbol !== 'USDT' && symbol !== 'INR') {
                    const total = balanceMap[symbol];
                    if (total > 0) {
                        balanceStrings.push(`${total.toFixed(6)} ${symbol}`);
                        hasNonZero = true;
                    }
                }
            }
            if (hasNonZero) {
                return balanceStrings.join('<br>');
            }
            return 'â‚¹0.00';
        }
    } catch (e) {
        console.error(`Failed to fetch balances for user ${userId}:`, e);
    }
    return 'â‚¹0.00';
}

export async function loadUsersList() {
    if (!currentAdmin) return;
    
    // Fetch exchange rate to convert USDT to INR
    let usdtToInrRate = 1.0;
    try {
        const rateRes = await apiFetch('GET', '/asset-exchange-rates?baseAssetId=1183348576672026624&quoteAssetId=1126151490264633456', null, true);
        if (rateRes && rateRes.code === 200) {
            const list = rateRes.result || rateRes.data || [];
            const activeRate = list.find(r => r.enabled);
            if (activeRate) {
                usdtToInrRate = parseFloat(activeRate.rate) || 1.0;
                window.userUsdtToInrRate = usdtToInrRate;
            }
        }
    } catch (e) {
        console.error("Failed to load exchange rate for user balances:", e);
    }

    let userPhoneMap = {};
    try {
        userPhoneMap = await window.adminState.getUserPhoneMap();
    } catch (e) {
        console.error("Failed to load userPhoneMap in loadUsersList:", e);
    }

    const filterEl = document.getElementById('user-search-input');
    if (!filterEl) {
        const users = await window.adminState.getUsers();
        const statTotalUsers = document.getElementById('stat-total-users');
        if (statTotalUsers) statTotalUsers.innerText = users.length;
        return;
    }

    // Sync size select dropdown with current page size state
    const usersSizeSelect = document.getElementById('users-size-select');
    if (usersSizeSelect) {
        usersSizeSelect.value = window.adminPages.users.size;
    }
    
    // 1. Fetch risk levels dynamically if not cached
    if (!window.cachedRiskLevels || window.cachedRiskLevels.length === 0) {
        try {
            const rlRes = await apiFetch('GET', '/users/risk-levels', null, true);
            if (rlRes.code === 200) {
                window.cachedRiskLevels = rlRes.result || rlRes.data || [];
            }
        } catch (e) {
            console.error("Failed to fetch risk levels for users mapping:", e);
        }
    }
    
    // 2. Populate options for risk level selectors
    const riskLevels = window.cachedRiskLevels || [];
    const filterRiskLevelSelect = document.getElementById('filter-users-risk-level');
    if (filterRiskLevelSelect) {
        const currentSelected = filterRiskLevelSelect.value;
        filterRiskLevelSelect.innerHTML = '<option value="ALL">å…¨éƒ¨</option>';
        riskLevels.forEach(rl => {
            if (rl.enabled) {
                const opt = document.createElement('option');
                opt.value = rl.id;
                opt.textContent = `${rl.name} (ç­‰çº§ ${rl.level || 0})`;
                filterRiskLevelSelect.appendChild(opt);
            }
        });
        filterRiskLevelSelect.value = currentSelected || 'ALL';
    }
    const groupModalSelect = document.getElementById('group-select-level-id');
    if (groupModalSelect) {
        groupModalSelect.innerHTML = '<option value="">-- è¯·é€‰æ‹©é£ŽæŽ§å±‚çº§ (æ— åˆ†ç»„) --</option>';
        riskLevels.forEach(rl => {
            if (rl.enabled) {
                const opt = document.createElement('option');
                opt.value = rl.id;
                opt.textContent = `${rl.name} (ç­‰çº§ ${rl.level || 0})`;
                groupModalSelect.appendChild(opt);
            }
        });
    }

    const searchVal = filterEl.value.trim().toLowerCase();
    const kycFilter = document.getElementById('filter-users-kyc')?.value || 'ALL';
    const statusFilter = document.getElementById('filter-users-status')?.value || 'ALL';
    const riskLevelFilter = document.getElementById('filter-users-risk-level')?.value || 'ALL';
    
    const pageConf = window.adminPages.users;
    const isFilterActive = (searchVal !== '' || kycFilter !== 'ALL' || statusFilter !== 'ALL' || riskLevelFilter !== 'ALL');
    
    let users = [];
    let pagingObj = null;
    
    if (isFilterActive) {
        // If filters are active, fetch all users from cache or full endpoint, filter locally and page
        const allUsers = await window.adminState.getUsers(true);
        if (allUsers) {
            let filteredUsers = allUsers;
            if (searchVal !== '') {
                filteredUsers = filteredUsers.filter(u => 
                    String(u.id) === searchVal ||
                    String(u.uid).includes(searchVal) || 
                    (u.username && u.username.toLowerCase().includes(searchVal)) || 
                    (u.email && u.email.toLowerCase().includes(searchVal)) ||
                    (u.nickname && u.nickname.toLowerCase().includes(searchVal))
                );
            }
            
            // Sync KYC status map
            let kycMap = {};
            try {
                if (!window.kycFetchPromise) {
                    window.kycFetchPromise = apiFetch('GET', '/users/kyc?page=1&pageSize=1000', null, true);
                }
                const kycRes = await window.kycFetchPromise;
                if (kycRes.code === 200) {
                    const kycList = kycRes.result || kycRes.data || [];
                    kycList.forEach(a => {
                        kycMap[String(a.userId)] = a.status;
                    });
                }
            } catch (e) {
                console.error('Failed to pre-fetch KYC list for users list mapping:', e);
            }
            filteredUsers.forEach(u => {
                u.kycStatus = kycMap[String(u.id)] || 'NOT_VERIFIED';
            });
            
            if (kycFilter !== 'ALL') {
                filteredUsers = filteredUsers.filter(u => u.kycStatus === kycFilter);
            }
            if (statusFilter !== 'ALL') {
                filteredUsers = filteredUsers.filter(u => {
                    const s = u.status || 'ENABLED';
                    return s === statusFilter;
                });
            }
            if (riskLevelFilter !== 'ALL') {
                const targetLevelDef = window.cachedRiskLevels?.find(l => String(l.id) === String(riskLevelFilter));
                const targetLevelNum = targetLevelDef ? (targetLevelDef.level || 0) : null;
                filteredUsers = filteredUsers.filter(u => {
                    if (!u.riskLevelId) {
                        return targetLevelNum === 0;
                    }
                    if (String(u.riskLevelId) === String(riskLevelFilter)) {
                        return true;
                    }
                    const currentLevelDef = window.cachedRiskLevels?.find(l => String(l.id) === String(u.riskLevelId));
                    return targetLevelNum !== null && currentLevelDef && (currentLevelDef.level || 0) === targetLevelNum;
                });
            }
            
            window.cachedUsersList = filteredUsers;
            
            pagingObj = {
                page: pageConf.current,
                pageSize: pageConf.size,
                records: filteredUsers.length,
                pages: Math.max(1, Math.ceil(filteredUsers.length / pageConf.size))
            };
            
            users = paginateList(filteredUsers, 'users');
        }
    } else {
        // No filter active: direct native server-side pagination!
        const res = await apiFetch('GET', `/users?page=${pageConf.current}&pageSize=${pageConf.size}`, null, true);
        if (res.code === 200) {
            users = res.result || res.data || [];
            
            // Sync KYC status map for the returned page
            let kycMap = {};
            try {
                if (!window.kycFetchPromise) {
                    window.kycFetchPromise = apiFetch('GET', '/users/kyc?page=1&pageSize=1000', null, true);
                }
                const kycRes = await window.kycFetchPromise;
                if (kycRes.code === 200) {
                    const kycList = kycRes.result || kycRes.data || [];
                    kycList.forEach(a => {
                        kycMap[String(a.userId)] = a.status;
                    });
                }
            } catch (e) {
                console.error('Failed to pre-fetch KYC list for users list mapping:', e);
            }
            users.forEach(u => {
                u.kycStatus = kycMap[String(u.id)] || 'NOT_VERIFIED';
            });
            
            window.cachedUsersList = users;
            
            pagingObj = res.paging || {
                page: pageConf.current,
                pageSize: pageConf.size,
                records: users.length,
                pages: 1
            };
            updateAdminPageIndicator('users', pagingObj);
        } else {
            showToast(res.errorMessage || 'èŽ·å–ç”¨æˆ·åˆ—è¡¨å¤±è´¥ï¼', true);
            return;
        }
    }
    
    // Dynamically update total user count on screen!
    if (pagingObj && pagingObj.records !== undefined && !isFilterActive) {
        const statTotalUsers = document.getElementById('stat-total-users');
        if (statTotalUsers) statTotalUsers.innerText = pagingObj.records;
    }
    
    const bodyEl = document.getElementById('users-table-body');
    if (!bodyEl) return;
    
    if (users.length === 0) {
        bodyEl.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px 0;">æœªæœç´¢åˆ°ç¬¦åˆæ¡ä»¶çš„äº¤æ˜“å‘˜ç”¨æˆ·</td></tr>`;
        
        // Update pagination indicator
        const indicator = document.getElementById(`users-page-indicator`);
        if (indicator) indicator.innerText = `ç¬¬ 1 / 1 é¡µ (å…± 0 æ¡)`;
        return;
    }
    
    window.selectedUserIds = window.selectedUserIds || {};
    
    bodyEl.innerHTML = users.map(u => {
        const date = u.createdAt ? new Date(parseInt(u.createdAt)).toLocaleDateString() : '--';
        
        const kycBadgeType = u.kycStatus === 'APPROVED' ? 'APPROVED' : (u.kycStatus === 'PENDING' ? 'PENDING' : 'REJECTED');
        const statusBadgeType = u.status === 'ENABLED' || !u.status ? 'APPROVED' : (u.status === 'FROZEN' ? 'PENDING' : 'REJECTED');
        
        const riskLevelText = u.userRisk && u.userRisk.name
            ? `<span style="font-weight: 600; color: #38BDF8;">${u.userRisk.name}</span>`
            : `<span style="color: var(--text-secondary);">æœªåˆ†ç»„</span>`;
            
        const isChecked = window.selectedUserIds[u.id] ? 'checked' : '';
        
        const balanceVal = u.defaultBalance ? parseFloat(u.defaultBalance.total) : 0;
        const balanceSymbol = u.defaultBalance ? u.defaultBalance.assetSymbol : 'USDT';
        
        let displayVal = balanceVal;
        if (balanceSymbol === 'USDT') {
            displayVal = balanceVal * (window.userUsdtToInrRate || 1.0);
        }
        const balanceText = `â‚¹${displayVal.toFixed(2)}`;
        
        const referrerPhone = u.referralUserId ? (userPhoneMap[String(u.referralUserId)] || u.referralUserId) : null;
        const referralText = u.referralUserId 
            ? `<div style="font-size: 0.65rem; color: #38BDF8; margin-top: 3px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                   <span>ä¸Šçº§: ${referrerPhone}</span>
                   <button class="action-btn" onclick="searchUserById('${u.referralUserId}')" style="padding: 1px 4px; font-size: 0.6rem; height: 16px; line-height: 14px; background: rgba(56, 189, 248, 0.15); border: none; border-radius: 3px; color: #38BDF8; cursor: pointer;">åŽ»æŸ¥çœ‹</button>
               </div>`
            : `<div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 3px;">ä¸Šçº§: æ— </div>`;
            
        const subordinatesBtn = `<div style="margin-top: 4px;"><button class="action-btn" onclick="showUserReferralsTree('${u.id}', '${u.nickname || u.uid}')" style="padding: 2px 6px; font-size: 0.65rem; background: rgba(16, 185, 129, 0.1); border: 1.5px solid rgba(16, 185, 129, 0.25); color: #10B981; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 2px; height: 20px; font-weight: 600;">ðŸŒ³ ä¸‹çº§å…³ç³»æ ‘</button></div>`;
        
        return `
            <tr>
                <td style="text-align: center;">
                    <input type="checkbox" class="user-select-checkbox" value="${u.id}" ${isChecked} onchange="updateBatchActionBtnState()" style="cursor: pointer;">
                </td>
                <td>${u.uid || '--'}</td>
                <td>${u.username || '--'}</td>
                <td>${u.email || '--'}</td>
                <td>
                    <div style="font-weight: 600;">${u.nickname}</div>
                    ${referralText}
                    ${subordinatesBtn}
                </td>
                <td>
                    <span class="badge badge-${kycBadgeType}" style="margin-bottom: 4px; display: inline-flex;">
                        <span class="badge-status-dot"></span>
                        KYC: ${u.kycStatus}
                    </span>
                    <br>
                    <span class="badge badge-${statusBadgeType}" style="display: inline-flex;">
                        <span class="badge-status-dot"></span>
                        è´¦å·: ${u.status || 'ENABLED'}
                    </span>
                </td>
                <td>${riskLevelText}</td>
                <td style="font-weight: 600;">${balanceText}</td>
                <td style="color: var(--text-muted);">${date}</td>
                <td class="sticky-right" style="text-align: center;">
                    <div class="action-dropdown-container">
                        <button class="action-btn btn-approve" onclick="toggleUserActionDropdown(event, '${u.id}')" style="padding: 4px 10px; font-size: 0.72rem; font-weight: 600; background: var(--primary); color: white; border: none; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; height: 26px;">
                            æ“ä½œ â–¾
                        </button>
                        <div class="action-dropdown-menu" id="dropdown-menu-${u.id}">
                            ${u.status === 'BLOCKED' || u.status === 'FROZEN' 
                                ? `<a class="dropdown-item" onclick="toggleUserStatus('${u.id}', 'ENABLED')">âœ“ å¯ç”¨è´¦å·</a>`
                                : `
                                    <a class="dropdown-item" onclick="toggleUserStatus('${u.id}', 'FROZEN')">â„ï¸ å†»ç»“è´¦å·</a>
                                    <a class="dropdown-item" onclick="toggleUserStatus('${u.id}', 'BLOCKED')">âœ• å°ç¦è´¦å·</a>
                                  `
                            }
                            <a class="dropdown-item" onclick="showUserReferralsTree('${u.id}', '${u.nickname || u.uid}')">ðŸŒ³ é‚€è¯·æ ‘</a>
                            <a class="dropdown-item" onclick="openUpdateReferralModal('${u.id}', '${u.nickname || u.uid}')">ðŸ”— å˜æ›´æŽ¨èäºº</a>
                            <a class="dropdown-item" onclick="openSingleGroupModal('${u.id}', '${u.nickname || u.uid}')">ðŸ·ï¸ åˆ†ç»„è®¾ç½®</a>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Sync checkboxes and batch button count
    updateBatchActionBtnState();
}


export // --- USER BLOCKING & ACTIVATION CONTROLLERS (Phase 20 Integration) ---
async function toggleUserStatus(userId, newStatus) {
    let actionStr = 'å¯ç”¨';
    if (newStatus === 'BLOCKED') actionStr = 'å°ç¦';
    if (newStatus === 'FROZEN') actionStr = 'å†»ç»“';
    
    if (newStatus === 'BLOCKED' && !confirm('âš ï¸ æ‚¨ç¡®å®šè¦æ°¸ä¹…å°ç¦è¯¥äº¤æ˜“å‘˜è´¦æˆ·å—ï¼Ÿå°ç¦åŽè¯¥ç”¨æˆ·å°†æ— æ³•ç™»å½•å¹¶è¢«å¼ºè¡Œä¸­æ–­æ‰€æœ‰è·Ÿå•ï¼')) {
        return;
    }
    if (newStatus === 'FROZEN' && !confirm('â„ï¸ æ‚¨ç¡®å®šè¦æš‚æ—¶å†»ç»“è¯¥äº¤æ˜“å‘˜è´¦æˆ·å—ï¼Ÿå†»ç»“åŽè¯¥ç”¨æˆ·å°†æ— æ³•è¿›è¡Œä»»ä½•é‡åŒ–è·Ÿå•äº¤æ˜“ï¼')) {
        return;
    }
    if (newStatus === 'ENABLED' && !confirm('âœ“ æ‚¨ç¡®å®šè¦æ¢å¤å¹¶å¯ç”¨è¯¥äº¤æ˜“å‘˜è´¦æˆ·å—ï¼Ÿ')) {
        return;
    }
    
    showToast(`æ­£åœ¨å¯¹äº¤æ˜“å‘˜æ‰§è¡Œ${actionStr}æ“ä½œ...`, false);
    
    try {
        const res = await apiFetch('POST', `/users/${userId}/update-status`, {
            status: newStatus
        }, true);
        
        if (res.code === 200) {
            showToast(`âœ“ äº¤æ˜“å‘˜è´¦æˆ·å·²æˆåŠŸ${actionStr}ï¼`, false);
            loadUsersList(); // è‡ªåŠ¨çƒ­åˆ·æ–°åˆ—è¡¨
        } else {
            showToast(res.errorMessage || `æ‰§è¡Œ${actionStr}å¤±è´¥ï¼`, true);
        }
    } catch (e) {
        console.error(e);
        showToast('æ‰§è¡Œè´¦æˆ·çŠ¶æ€æ›´æ–°ç½‘ç»œå¼‚å¸¸ï¼', true);
    }
}
window.toggleUserStatus = toggleUserStatus;


export function resetUsersFilters() {
    const kw = document.getElementById('user-search-input');
    const kyc = document.getElementById('filter-users-kyc');
    const status = document.getElementById('filter-users-status');
    const riskLevel = document.getElementById('filter-users-risk-level');
    if (kw) kw.value = '';
    if (kyc) kyc.value = 'ALL';
    if (status) status.value = 'ALL';
    if (riskLevel) riskLevel.value = 'ALL';
    window.adminPages.users.current = 1;
    loadUsersList();
    showToast('âœ“ ç”¨æˆ·ç®¡ç†æ£€ç´¢æ¡ä»¶å·²é‡ç½®', false);
}
window.resetUsersFilters = resetUsersFilters;

// ==========================================
// ðŸŒ³ ç”¨æˆ·é‚€è¯·å…³ç³»æ ‘ç®¡ç†æ¨¡å— (User Referral Tree Module)

window.currentReferralUserId = null;
window.currentReferralUserNickname = '';

function renderReferralNode(node, level = 0) {
    const statusMap = {
        'ENABLED': { label: 'æ­£å¸¸ (ENABLED)', type: 'APPROVED' },
        'FROZEN': { label: 'å·²å†»ç»“ (FROZEN)', type: 'PENDING' },
        'BLOCKED': { label: 'å·²å°ç¦ (BLOCKED)', type: 'REJECTED' }
    };
    const statusInfo = statusMap[node.status] || { label: node.status || 'ENABLED', type: 'APPROVED' };
    const dateStr = node.createdAt ? new Date(parseInt(node.createdAt)).toLocaleString() : '--';
    
    let childrenHtml = '';
    if (node.children && node.children.length > 0) {
        childrenHtml = `
            <div class="tree-children-container" style="border-left: 2px dashed rgba(255,255,255,0.15); margin-left: 20px; padding-left: 15px; margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">
                ${node.children.map(child => renderReferralNode(child, level + 1)).join('')}
            </div>
        `;
    }
    
    return `
        <div class="tree-node" style="background: rgba(255, 255, 255, 0.04); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px 15px; color: #FFFFFF; margin-top: 5px; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.15rem;">ðŸ‘¤</span>
                    <div>
                        <div style="font-weight: bold; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                            <span>${node.nickname || 'æœªè®¾å®šæ˜µç§°'}</span>
                            <span style="color: var(--primary); font-size: 0.72rem; font-weight: normal; background: rgba(91,81,249,0.15); padding: 2px 6px; border-radius: 4px;">UID: ${node.uid}</span>
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
                            <span>é‚€è¯·ç : <strong style="color: var(--text-primary);">${node.referralCode || '--'}</strong></span>
                            <span style="margin: 0 6px;">|</span>
                            <span>æ³¨å†Œæ—¶é—´: ${dateStr}</span>
                        </div>
                    </div>
                </div>
                <div>
                    <span class="badge badge-${statusInfo.type}" style="display: inline-flex; align-items: center; gap: 4px;">
                        <span class="badge-status-dot"></span>
                        ${statusInfo.label}
                    </span>
                </div>
            </div>
            ${childrenHtml}
        </div>
    `;
}

async function showUserReferralsTree(userId, nickname) {
    window.currentReferralUserId = userId;
    window.currentReferralUserNickname = nickname;
    
    const titleEl = document.getElementById('ref-user-name-title');
    if (titleEl) titleEl.innerText = nickname;
    
    const bodyEl = document.getElementById('user-referrals-tree-body');
    if (bodyEl) {
        bodyEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0;">â³ æ­£åœ¨å®‰å…¨æ£€ç´¢ä¸‹çº§è£‚å˜æ ‘ï¼Œè¯·ç¨å€™...</div>`;
    }
    
    const modal = document.getElementById('user-referrals-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
    
    try {
        const res = await apiFetch('GET', `/users/${userId}/referrals/tree?depth=3`, null, true);
        if (res.code === 200) {
            const nodes = res.result || res.data || [];
            if (!bodyEl) return;
            
            if (nodes.length === 0) {
                bodyEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0;">ðŸŒ³ è¯¥ç”¨æˆ·æš‚æ— é‚€è¯·ä¸‹çº§è®°å½•</div>`;
            } else {
                bodyEl.innerHTML = `<div style="display: flex; flex-direction: column; gap: 12px;">${nodes.map(node => renderReferralNode(node)).join('')}</div>`;
            }
        } else {
            showToast(res.errorMessage || 'èŽ·å–é‚€è¯·æ ‘æ•°æ®è¢«åŽç«¯æ‹’ç»ï¼', true);
            if (bodyEl) {
                bodyEl.innerHTML = `<div style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ èŽ·å–é‚€è¯·æ ‘å¤±è´¥ï¼š${res.errorMessage || 'æœªçŸ¥é”™è¯¯'}</div>`;
            }
        }
    } catch (e) {
        console.error(e);
        showToast('èŽ·å–ä¸‹çº§é‚€è¯·å…³ç³»æ ‘ç½‘ç»œå¼‚å¸¸ï¼', true);
        if (bodyEl) {
            bodyEl.innerHTML = `<div style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ èŽ·å–é‚€è¯·æ ‘å‘é€ç½‘ç»œè¯·æ±‚å¼‚å¸¸</div>`;
        }
    }
}
window.showUserReferralsTree = showUserReferralsTree;

function closeUserReferralsModal() {
    const modal = document.getElementById('user-referrals-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    window.currentReferralUserId = null;
    window.currentReferralUserNickname = '';
}
window.closeUserReferralsModal = closeUserReferralsModal;

function refreshUserReferralsTree() {
    if (window.currentReferralUserId) {
        showUserReferralsTree(window.currentReferralUserId, window.currentReferralUserNickname);
        showToast('âœ“ é‚€è¯·æ ‘æ•°æ®å·²æˆåŠŸåˆ·æ–°ï¼', false);
    }
}
window.refreshUserReferralsTree = refreshUserReferralsTree;







// --- ADMIN UPDATE USER REFERRAL BINDING ACTIONS ---
function openUpdateReferralModal(userId, nickname) {
    window.activeUpdateRefUserId = userId;
    const targetNameEl = document.getElementById('update-ref-target-name');
    const inputEl = document.getElementById('update-ref-input-id');
    const modal = document.getElementById('update-referral-modal');
    if (targetNameEl) {
        targetNameEl.textContent = nickname + " (ID: " + userId + ")";
    }
    if (inputEl) {
        inputEl.value = '';
    }
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}
window.openUpdateReferralModal = openUpdateReferralModal;

function closeUpdateReferralModal() {
    const modal = document.getElementById('update-referral-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    window.activeUpdateRefUserId = null;
}
window.closeUpdateReferralModal = closeUpdateReferralModal;

async function submitUpdateReferralUser() {
    const inputEl = document.getElementById('update-ref-input-id');
    if (!inputEl || !inputEl.value.trim()) {
        showToast('è¯·è¾“å…¥æŽ¨èäººç”¨æˆ· IDï¼', true);
        return;
    }
    const referralUserId = inputEl.value.trim();
    
    showToast('æ­£åœ¨å¼ºè¡Œæ›´æ­£æŽ¨èäººå…³ç³»...', false);
    try {
        const rawBodyStr = '{"referralUserId":' + referralUserId + '}';
        const res = await apiFetchWithRawBody('POST', '/users/' + window.activeUpdateRefUserId + '/update-referral-user', rawBodyStr, true);
        if (res.code === 200) {
            showToast('âœ“ æŽ¨èäººå…³ç³»å·²æˆåŠŸå¼ºåˆ¶å˜æ›´ï¼', false);
            closeUpdateReferralModal();
            if (typeof loadUsersList === 'function') {
                loadUsersList();
            }
        } else {
            showToast(res.errorMessage || 'å˜æ›´æŽ¨èäººå…³ç³»å¤±è´¥ï¼', true);
        }
    } catch (e) {
        console.error(e);
        showToast('ç½‘ç»œè¿žæŽ¥å¤±è´¥æˆ–æŽ¥å£å¼‚å¸¸ï¼', true);
    }
}
window.submitUpdateReferralUser = submitUpdateReferralUser;

// ==========================================
// ðŸ›¡ï¸ ç”¨æˆ·é£ŽæŽ§å±‚çº§ç®¡ç†æ¨¡å— (User Risk Levels Management)

export async function loadRiskLevelsList() {
    const tableBody = document.getElementById('risk-levels-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">ðŸ”„ æ­£åœ¨å®‰å…¨è°ƒå–ç”¨æˆ·é£ŽæŽ§å±‚çº§åˆ—è¡¨...</td></tr>';
    
    try {
        const pageConf = window.adminPages.riskLevels;
        const res = await apiFetch('GET', `/users/risk-levels?page=${pageConf.current}&pageSize=${pageConf.size}`, null, true);
        if (res.code === 200) {
            const list = res.result || res.data || [];
            
            // Sort by Snowflake ID descending
            list.sort((a, b) => {
                const aId = BigInt(a.id || 0);
                const bId = BigInt(b.id || 0);
                return aId > bId ? -1 : (aId < bId ? 1 : 0);
            });
            
            window.cachedRiskLevels = list;
            
            const totalRecords = (res.paging && res.paging.records > 0) ? res.paging.records : list.length;
            const totalPages = (res.paging && res.paging.pages > 0) ? res.paging.pages : Math.max(1, Math.ceil(totalRecords / pageConf.size));
            const pagingObj = {
                page: (res.paging && res.paging.page) || pageConf.current,
                pageSize: (res.paging && res.paging.pageSize) || pageConf.size,
                records: totalRecords,
                pages: totalPages
            };
            
            updateAdminPageIndicator('riskLevels', pagingObj);
            
            if (list.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">ðŸ“­ æš‚æ— åŒ¹é…çš„ç”¨æˆ·é£ŽæŽ§å±‚çº§è®°å½•</td></tr>';
                return;
            }
            
            tableBody.innerHTML = list.map(item => {
                const enabledChecked = item.enabled ? 'checked' : '';
                const needAuditText = item.needAudit ? '<span style="color: var(--red); font-weight: bold;">âš ï¸ éœ€è¦å®¡æ ¸</span>' : '<span style="color: var(--green); font-weight: bold;">âœ“ å…å®¡æ ¸</span>';
                
                const lockBadge = item.locked
                    ? `<span style="cursor: pointer; font-size: 0.75rem; padding: 4px 10px; border-radius: 4px; background: rgba(239, 68, 68, 0.08); color: #EF4444; font-weight: bold; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(239, 68, 68, 0.15);" onclick="toggleRiskLevelLocked('${item.id}', false)">ðŸ”’ å·²é”å®š</span>`
                    : `<span style="cursor: pointer; font-size: 0.75rem; padding: 4px 10px; border-radius: 4px; background: rgba(16, 185, 129, 0.08); color: #10B981; font-weight: bold; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(16, 185, 129, 0.15);" onclick="toggleRiskLevelLocked('${item.id}', true)">ðŸ”“ æœªé”å®š</span>`;
                
                return `
                    <tr style="border-bottom: 1.5px solid var(--border-light);">
                        <td style="font-family: monospace; font-size: 0.8rem;">${item.id}</td>
                        <td style="font-weight: bold; color: var(--text-primary);">${item.name}</td>
                        <td><code style="background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: 600;">ç­‰çº§ ${item.level || 0}</code></td>
                        <td style="font-weight: 600; color: var(--text-primary);">${parseFloat(item.depositLimit || 0).toFixed(2)} USDT</td>
                        <td style="font-weight: 600; color: var(--text-primary);">${parseFloat(item.withdrawLimit || 0).toFixed(2)} USDT</td>
                        <td>${needAuditText}</td>
                        <td>${item.remark || item.memo || '-'}</td>
                        <td>
                            <label class="switch">
                                <input type="checkbox" ${enabledChecked} onchange="toggleRiskLevelEnabled('${item.id}', this.checked)">
                                <span class="switch-slider"></span>
                            </label>
                        </td>
                        <td style="text-align: center;">${lockBadge}</td>
                        <td style="text-align: center;">
                            <div style="display: flex; gap: 8px; justify-content: center;">
                                <button class="action-btn btn-approve" onclick="openRiskLevelModal('${item.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px;">ç¼–è¾‘</button>
                                <button class="action-btn btn-reject" onclick="deleteRiskLevel('${item.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; background: rgba(239,68,68,0.1); color: #EF4444; border: 1px solid rgba(239,68,68,0.2);">åˆ é™¤</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            showToast(res.errorMessage || 'èŽ·å–é£ŽæŽ§å±‚çº§åˆ—è¡¨å¤±è´¥ï¼', true);
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ èŽ·å–å¤±è´¥: ${res.errorMessage || 'æœªçŸ¥æŽ¥å£é”™è¯¯'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        showToast('èŽ·å–é£ŽæŽ§å±‚çº§åˆ—è¡¨ç½‘ç»œå¼‚å¸¸ï¼', true);
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #EF4444; padding: 40px 0;">âŒ ç½‘ç»œè¯·æ±‚é”™è¯¯ï¼Œè¯·é‡è¯•ï¼</td></tr>';
    }
}
window.loadRiskLevelsList = loadRiskLevelsList;

export async function toggleRiskLevelEnabled(id, checked) {
    showToast(checked ? 'æ­£åœ¨å¯ç”¨é£ŽæŽ§å±‚çº§...' : 'æ­£åœ¨ç¦ç”¨é£ŽæŽ§å±‚çº§...', false);
    try {
        const res = await apiFetch('POST', `/users/risk-levels/${id}/set-enabled`, { enabled: checked }, true);
        if (res.code === 200) {
            showToast(`âœ“ é£ŽæŽ§å±‚çº§å·²æˆåŠŸ${checked ? 'å¯ç”¨' : 'ç¦ç”¨'}ï¼`);
            if (window.cachedRiskLevels) {
                const matched = window.cachedRiskLevels.find(x => String(x.id) === String(id));
                if (matched) matched.enabled = checked;
            }
        } else {
            showToast(res.errorMessage || 'ä¿®æ”¹é£ŽæŽ§å±‚çº§çŠ¶æ€å¤±è´¥', true);
            loadRiskLevelsList();
        }
    } catch (e) {
        console.error(e);
        showToast('ä¿®æ”¹é£ŽæŽ§å±‚çº§çŠ¶æ€ç½‘ç»œå¼‚å¸¸', true);
        loadRiskLevelsList();
    }
}
window.toggleRiskLevelEnabled = toggleRiskLevelEnabled;

export async function toggleRiskLevelLocked(id, checked) {
    showToast(checked ? 'æ­£åœ¨é”å®šé£ŽæŽ§å±‚çº§...' : 'æ­£åœ¨è§£é”é£ŽæŽ§å±‚çº§...', false);
    try {
        const res = await apiFetch('POST', `/users/risk-levels/${id}/set-locked`, { locked: checked }, true);
        if (res.code === 200) {
            showToast(`âœ“ é£ŽæŽ§å±‚çº§å·²æˆåŠŸ${checked ? 'é”å®š' : 'è§£é”'}ï¼`);
            if (window.cachedRiskLevels) {
                const matched = window.cachedRiskLevels.find(x => String(x.id) === String(id));
                if (matched) matched.locked = checked;
            }
            loadRiskLevelsList();
        } else {
            showToast(res.errorMessage || 'æ“ä½œå¤±è´¥ï¼', true);
            loadRiskLevelsList();
        }
    } catch (e) {
        console.error(e);
        showToast('æ“ä½œé£ŽæŽ§å±‚çº§é”å®šçŠ¶æ€ç½‘ç»œå¼‚å¸¸', true);
        loadRiskLevelsList();
    }
}
window.toggleRiskLevelLocked = toggleRiskLevelLocked;

export function openRiskLevelModal(id = null) {
    const titleEl = document.getElementById('risk-level-modal-title');
    const editIdEl = document.getElementById('risk-level-edit-id');
    const nameEl = document.getElementById('risk-level-name');
    const codeEl = document.getElementById('risk-level-code');
    const depositLimitEl = document.getElementById('risk-level-depositLimit');
    const withdrawLimitEl = document.getElementById('risk-level-withdrawLimit');
    const needAuditEl = document.getElementById('risk-level-needAudit');
    const remarkEl = document.getElementById('risk-level-remark');
    
    if (!titleEl || !editIdEl) return;
    
    if (id) {
        titleEl.innerText = 'ðŸ›¡ï¸ ç¼–è¾‘é£ŽæŽ§å±‚çº§';
        editIdEl.value = id;
        
        const matched = (window.cachedRiskLevels || []).find(x => String(x.id) === String(id));
        if (matched) {
            nameEl.value = matched.name || '';
            codeEl.value = matched.level !== undefined ? matched.level : '';
            depositLimitEl.value = matched.depositLimit !== undefined ? matched.depositLimit : '';
            withdrawLimitEl.value = matched.withdrawLimit !== undefined ? matched.withdrawLimit : '';
            needAuditEl.value = matched.needAudit ? 'true' : 'false';
            remarkEl.value = matched.remark || matched.memo || '';
        }
    } else {
        titleEl.innerText = 'ðŸ›¡ï¸ æ–°å¢žé£ŽæŽ§å±‚çº§';
        editIdEl.value = '';
        nameEl.value = '';
        codeEl.value = '0';
        depositLimitEl.value = '0';
        withdrawLimitEl.value = '0';
        needAuditEl.value = 'true';
        remarkEl.value = '';
    }
    
    const modal = document.getElementById('risk-level-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}
window.openRiskLevelModal = openRiskLevelModal;

export function closeRiskLevelModal() {
    const modal = document.getElementById('risk-level-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}
window.closeRiskLevelModal = closeRiskLevelModal;

export async function submitRiskLevelForm(event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('risk-level-edit-id').value;
    const name = document.getElementById('risk-level-name').value.trim();
    const level = parseInt(document.getElementById('risk-level-code').value.trim());
    const depositLimit = parseFloat(document.getElementById('risk-level-depositLimit').value) || 0;
    const withdrawLimit = parseFloat(document.getElementById('risk-level-withdrawLimit').value) || 0;
    const needAudit = document.getElementById('risk-level-needAudit').value === 'true';
    const remark = document.getElementById('risk-level-remark').value.trim();
    
    if (!name || isNaN(level)) {
        showToast('å±‚çº§åç§°å’Œçº§åˆ«æ˜¯å¿…å¡«å­—æ®µï¼', true);
        return;
    }
    
    showToast('æ­£åœ¨æäº¤é£ŽæŽ§å±‚çº§é…ç½®...', false);
    
    const payload = {
        name,
        level,
        depositLimit,
        withdrawLimit,
        needAudit,
        remark,
        enabled: true
    };
    
    try {
        let res;
        if (id) {
            payload.id = parseInt(id);
            res = await apiFetch('PUT', `/users/risk-levels/${id}`, payload, true);
        } else {
            res = await apiFetch('POST', '/users/risk-levels', payload, true);
        }
        
        if (res.code === 200) {
            showToast('âœ“ é£ŽæŽ§å±‚çº§é…ç½®å·²æˆåŠŸä¿å­˜ï¼');
            closeRiskLevelModal();
            loadRiskLevelsList();
        } else {
            showToast(res.errorMessage || 'ä¿å­˜é£ŽæŽ§å±‚çº§é…ç½®å¤±è´¥ï¼', true);
        }
    } catch (e) {
        console.error(e);
        showToast('ä¿å­˜é£ŽæŽ§å±‚çº§ç½‘ç»œå¼‚å¸¸ï¼', true);
    }
}
window.submitRiskLevelForm = submitRiskLevelForm;

export async function deleteRiskLevel(id) {
    if (!confirm('âš ï¸ è­¦å‘Šï¼šç¡®å®šè¦å½»åº•åˆ é™¤è¯¥é£ŽæŽ§å±‚çº§å—ï¼Ÿåˆ é™¤åŽç»‘å®šæ­¤å±‚çº§çš„é€šé“åŠç”¨æˆ·æŽ§åˆ¶å¯èƒ½å—å½±å“ï¼Œæ­¤æ“ä½œä¸å¯é€†ï¼')) {
        return;
    }
    
    showToast('æ­£åœ¨åˆ é™¤é£ŽæŽ§å±‚çº§...', false);
    try {
        const res = await apiFetch('POST', `/users/risk-levels/${id}/delete`, {}, true);
        if (res.code === 200) {
            showToast('âœ“ é£ŽæŽ§å±‚çº§å·²æˆåŠŸåˆ é™¤ï¼');
            loadRiskLevelsList();
        } else {
            showToast(res.errorMessage || 'åˆ é™¤é£ŽæŽ§å±‚çº§å¤±è´¥ï¼', true);
        }
    } catch (e) {
        console.error(e);
        showToast('åˆ é™¤é£ŽæŽ§å±‚çº§ç½‘ç»œå¼‚å¸¸ï¼', true);
    }
}
window.deleteRiskLevel = deleteRiskLevel;

// ==========================================
// ðŸ·ï¸ ç”¨æˆ·åˆ†ç»„åŠæ‰¹é‡åˆ†ç»„ç®¡ç†æ¨¡å— (User Grouping & Batch Grouping Module)

window.selectedUserIds = window.selectedUserIds || {};

export function toggleSelectAllUsers(checked) {
    const checkboxes = document.querySelectorAll('.user-select-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) {
            window.selectedUserIds[cb.value] = true;
        } else {
            delete window.selectedUserIds[cb.value];
        }
    });
    updateBatchActionBtnState();
}
window.toggleSelectAllUsers = toggleSelectAllUsers;

export function updateBatchActionBtnState() {
    const checkboxes = document.querySelectorAll('.user-select-checkbox');
    checkboxes.forEach(cb => {
        if (cb.checked) {
            window.selectedUserIds[cb.value] = true;
        } else {
            delete window.selectedUserIds[cb.value];
        }
    });
    
    const selectedCount = Object.keys(window.selectedUserIds).length;
    const btn = document.getElementById('batch-group-btn');
    if (btn) {
        if (selectedCount > 0) {
            btn.innerText = `æ‰¹é‡åˆ†ç»„ (å·²é€‰ ${selectedCount} äºº)`;
        } else {
            btn.innerText = 'æ‰¹é‡åˆ†ç»„';
        }
    }
    
    const selectAllCb = document.getElementById('user-select-all');
    if (selectAllCb) {
        const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
        selectAllCb.checked = allChecked;
    }
}
window.updateBatchActionBtnState = updateBatchActionBtnState;

export function openSingleGroupModal(userId, name) {
    const titleEl = document.getElementById('user-group-modal-title');
    const descEl = document.getElementById('user-group-modal-desc');
    const targetIdEl = document.getElementById('group-target-user-id');
    const manualContainer = document.getElementById('group-manual-input-container');
    const selectEl = document.getElementById('group-select-level-id');
    
    if (titleEl) titleEl.innerText = 'ðŸ·ï¸ ç”¨æˆ·åˆ†ç»„è®¾ç½® (é£ŽæŽ§å±‚çº§)';
    if (descEl) descEl.innerHTML = `æ­£åœ¨ä¸ºç”¨æˆ· <strong style="color: #38BDF8;">${name}</strong> è®¾ç½®é£ŽæŽ§å±‚çº§åˆ†ç»„`;
    if (targetIdEl) targetIdEl.value = userId;
    if (manualContainer) manualContainer.style.display = 'none';
    
    const users = window.cachedUsersList || [];
    const user = users.find(x => String(x.id) === String(userId));
    if (selectEl) {
        selectEl.value = user && user.riskLevelId ? user.riskLevelId : '';
    }
    
    const modal = document.getElementById('user-group-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}
window.openSingleGroupModal = openSingleGroupModal;

export function openBatchGroupModal() {
    const titleEl = document.getElementById('user-group-modal-title');
    const descEl = document.getElementById('user-group-modal-desc');
    const targetIdEl = document.getElementById('group-target-user-id');
    const manualContainer = document.getElementById('group-manual-input-container');
    const selectEl = document.getElementById('group-select-level-id');
    const manualInputsEl = document.getElementById('group-manual-inputs');
    
    const selectedCount = Object.keys(window.selectedUserIds).length;
    
    if (titleEl) titleEl.innerText = 'ðŸ·ï¸ æ‰¹é‡ç”¨æˆ·åˆ†ç»„è®¾ç½®';
    if (descEl) descEl.innerHTML = `å·²åœ¨åˆ—è¡¨ä¸­å‹¾é€‰ <strong style="color: #38BDF8;">${selectedCount}</strong> åäº¤æ˜“å‘˜ã€‚æ‚¨ä¹Ÿå¯ä»¥åœ¨ä¸‹æ–¹æ‰‹åŠ¨è¾“å…¥æ›´å¤šç”¨æˆ·çš„ UID æˆ–æ‰‹æœºå·è¿›è¡Œæ‰¹é‡åˆ†ç»„ã€‚`;
    if (targetIdEl) targetIdEl.value = 'BATCH';
    if (manualContainer) manualContainer.style.display = 'flex';
    if (manualInputsEl) manualInputsEl.value = '';
    if (selectEl) selectEl.value = '';
    
    const modal = document.getElementById('user-group-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}
window.openBatchGroupModal = openBatchGroupModal;

export function closeUserGroupModal() {
    const modal = document.getElementById('user-group-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}
window.closeUserGroupModal = closeUserGroupModal;

export async function submitUserGrouping() {
    const targetType = document.getElementById('group-target-user-id').value;
    const selectedLevelId = document.getElementById('group-select-level-id').value;
    const levelIdPayload = selectedLevelId ? parseInt(selectedLevelId) : null;
    
    let finalUserIds = [];
    
    if (targetType === 'BATCH') {
        const checkedIds = Object.keys(window.selectedUserIds);
        checkedIds.forEach(id => finalUserIds.push(id));
        
        const manualInput = document.getElementById('group-manual-inputs')?.value || '';
        const rawInputs = manualInput.split(/[\n,ï¼Œ\s]+/).map(x => x.trim()).filter(x => x);
        
        if (rawInputs.length > 0) {
            const allUsers = await window.adminState.getUsers();
            for (const input of rawInputs) {
                const matchedUser = allUsers.find(u => {
                    if (/^\+?\d+$/.test(input)) {
                        return String(u.uid) === input || 
                               String(u.phone).includes(input) || 
                               String(u.username) === input;
                    } else {
                        return String(u.username).toLowerCase() === input.toLowerCase() || 
                               String(u.email).toLowerCase() === input.toLowerCase() ||
                               String(u.nickname).toLowerCase() === input.toLowerCase();
                    }
                });
                
                if (!matchedUser) {
                    showToast(`âŒ æ— æ³•è¯†åˆ«çš„æ‰‹åŠ¨è¾“å…¥äº¤æ˜“å‘˜: ${input}`, true);
                    return;
                }
                finalUserIds.push(matchedUser.id);
            }
        }
        
        finalUserIds = Array.from(new Set(finalUserIds));
        
        if (finalUserIds.length === 0) {
            showToast('è¯·è‡³å°‘é€‰æ‹©æˆ–è¾“å…¥ä¸€åäº¤æ˜“å‘˜è¿›è¡Œåˆ†ç»„ï¼', true);
            return;
        }
        
        showToast(`æ­£åœ¨æ‰¹é‡æ›´æ–° ${finalUserIds.length} åç”¨æˆ·çš„é£ŽæŽ§åˆ†ç»„...`, false);
        try {
            const res = await apiFetch('POST', '/users/batch-update-risk-level', {
                userIds: finalUserIds,
                levelId: levelIdPayload
            }, true);
            
            if (res.code === 200) {
                showToast('âœ“ æ‰¹é‡åˆ†ç»„è®¾ç½®å·²æˆåŠŸä¿å­˜ï¼');
                closeUserGroupModal();
                window.selectedUserIds = {};
                const selectAllCb = document.getElementById('user-select-all');
                if (selectAllCb) selectAllCb.checked = false;
                updateBatchActionBtnState();
                
                // Clear state cache to force reload
                window.adminState.clearUsersCache();
                loadUsersList();
            } else {
                showToast(res.errorMessage || 'æ‰¹é‡åˆ†ç»„è®¾ç½®å¤±è´¥ï¼', true);
            }
        } catch (e) {
            console.error(e);
            showToast('æ‰¹é‡åˆ†ç»„ç½‘ç»œå¼‚å¸¸ï¼', true);
        }
        
    } else {
        const userId = targetType;
        showToast('æ­£åœ¨æ›´æ–°äº¤æ˜“å‘˜é£ŽæŽ§åˆ†ç»„...', false);
        try {
            const res = await apiFetch('POST', `/users/${userId}/update-risk-level`, {
                levelId: levelIdPayload
            }, true);
            
            if (res.code === 200) {
                showToast('âœ“ äº¤æ˜“å‘˜é£ŽæŽ§åˆ†ç»„å·²æˆåŠŸä¿å­˜ï¼');
                closeUserGroupModal();
                
                // Clear state cache to force reload
                window.adminState.clearUsersCache();
                loadUsersList();
            } else {
                showToast(res.errorMessage || 'ä¿å­˜äº¤æ˜“å‘˜åˆ†ç»„å¤±è´¥ï¼', true);
            }
        } catch (e) {
            console.error(e);
            showToast('ä¿å­˜äº¤æ˜“å‘˜åˆ†ç»„ç½‘ç»œå¼‚å¸¸ï¼', true);
        }
    }
}
window.submitUserGrouping = submitUserGrouping;

// ==========================================
// â–¾ ä¸‹æ‹‰èœå•æ“ä½œæŽ§åˆ¶å™¨ (Action Dropdown Controllers)

export function toggleUserActionDropdown(event, userId) {
    event.stopPropagation();
    const menu = document.getElementById(`dropdown-menu-${userId}`);
    if (!menu) return;
    const isShown = menu.style.display === 'block';
    closeAllUserActionDropdowns();
    if (!isShown) {
        menu.style.display = 'block';
        const td = menu.closest('td.sticky-right');
        if (td) {
            td.classList.add('dropdown-open');
        }
        const tr = menu.closest('tr');
        if (tr) {
            tr.classList.add('dropdown-open');
        }
    }
}
window.toggleUserActionDropdown = toggleUserActionDropdown;

export function closeAllUserActionDropdowns() {
    const menus = document.querySelectorAll('.action-dropdown-menu');
    menus.forEach(m => {
        m.style.display = 'none';
    });
    const activeTds = document.querySelectorAll('td.sticky-right.dropdown-open');
    activeTds.forEach(td => {
        td.classList.remove('dropdown-open');
    });
    const activeTrs = document.querySelectorAll('tr.dropdown-open');
    activeTrs.forEach(tr => {
        tr.classList.remove('dropdown-open');
    });
}
window.closeAllUserActionDropdowns = closeAllUserActionDropdowns;

if (!window.userDropdownListenerAdded) {
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.action-dropdown-container')) {
            if (typeof window.closeAllUserActionDropdowns === 'function') {
                window.closeAllUserActionDropdowns();
            }
        }
    });
    window.userDropdownListenerAdded = true;
}

window.searchUserById = function(id) {
    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
        searchInput.value = id;
        window.adminPages.users.current = 1;
        loadUsersList();
        showToast(`ðŸ” å·²è¿‡æ»¤æ˜¾ç¤ºç›®æ ‡ä¸Šçº§ç”¨æˆ·`, false);
    }
};