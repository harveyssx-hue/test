export async function loadKycList() {
    if (!currentAdmin) return;
    
    const filterEl = document.getElementById('kyc-status-filter');
    if (!filterEl) {
        if (!window.kycFetchPromise) {
            window.kycFetchPromise = apiFetch('GET', '/users/kyc?page=1&pageSize=10000', null, true);
        }
        const res = await window.kycFetchPromise;
        if (res.code === 200) {
            const apps = res.result || res.data || [];
            const pendingCount = apps.filter(a => a.status === 'PENDING' || a.status === 'NOT_VERIFIED').length;
            const statPendingKycEl = document.getElementById('stat-pending-kyc');
            if (statPendingKycEl) statPendingKycEl.innerText = pendingCount;
            
            const badge = document.getElementById('kyc-pending-badge');
            if (badge) {
                if (pendingCount > 0) {
                    badge.style.display = 'inline-block';
                    badge.innerText = pendingCount;
                } else {
                    badge.style.display = 'none';
                }
            }
        }
        return;
    }

    const filter = filterEl.value;
    let realFilter = filter;
    if (filter === 'APPROVED') realFilter = 'VERIFIED';
    if (filter === 'REJECTED') realFilter = 'REFUSED';
    
    const uidVal = document.getElementById('filter-kyc-uid')?.value.trim().toLowerCase() || '';
    const emailVal = document.getElementById('filter-kyc-email')?.value.trim().toLowerCase() || '';
    const nameVal = document.getElementById('filter-kyc-name')?.value.trim().toLowerCase() || '';
    
    const pageConf = window.adminPages.kyc;
    const isFilterActive = (realFilter !== 'ALL' || uidVal !== '' || emailVal !== '' || nameVal !== '');
    
    // Sync size select dropdown with current page size state
    const kycSizeSelect = document.getElementById('kyc-size-select');
    if (kycSizeSelect) {
        kycSizeSelect.value = pageConf.size;
    }

    let apps = [];
    let pagingObj = null;

    let phoneMap = {};
    try {
        phoneMap = await window.adminState.getUserPhoneMap();
    } catch (phoneErr) {
        console.error("Failed to load user phone map for KYC view:", phoneErr);
    }
    
    if (isFilterActive) {
        // If filters are active, fetch all (up to 1000) to apply filters locally
        const res = await apiFetch('GET', `/users/kyc?page=1&pageSize=1000`, null, true);
        if (res.code === 200) {
            let allApps = res.result || res.data || [];
            
            if (realFilter !== 'ALL') {
                allApps = allApps.filter(a => {
                    if (realFilter === 'PENDING' || realFilter === 'NOT_VERIFIED') {
                        return a.status === 'PENDING' || a.status === 'NOT_VERIFIED';
                    }
                    return a.status === realFilter;
                });
            }
            if (uidVal !== '') {
                allApps = allApps.filter(a => {
                    const phone = phoneMap[String(a.userId)] || '';
                    return String(a.userId).toLowerCase().includes(uidVal) || phone.toLowerCase().includes(uidVal);
                });
            }
            if (emailVal !== '') {
                allApps = allApps.filter(a => a.email && String(a.email).toLowerCase().includes(emailVal));
            }
            if (nameVal !== '') {
                allApps = allApps.filter(a => a.fullName && String(a.fullName).toLowerCase().includes(nameVal));
            }
            
            window.cachedKycApps = allApps; // Cache globally for detail drawers
            
            pagingObj = {
                page: pageConf.current,
                pageSize: pageConf.size,
                records: allApps.length,
                pages: Math.max(1, Math.ceil(allApps.length / pageConf.size))
            };
            
            apps = paginateList(allApps, 'kyc');
        } else {
            showToast(res.errorMessage || '获取实名列表失败！', true);
            return;
        }
    } else {
        // No filter active: direct server-side pagination!
        const res = await apiFetch('GET', `/users/kyc?page=${pageConf.current}&pageSize=${pageConf.size}`, null, true);
        if (res.code === 200) {
            apps = res.result || res.data || [];
            pagingObj = res.paging || {
                page: pageConf.current,
                pageSize: pageConf.size,
                records: apps.length,
                pages: 1
            };
            window.cachedKycApps = apps;
            updateAdminPageIndicator('kyc', pagingObj);
        } else {
            showToast(res.errorMessage || '获取实名列表失败！', true);
            return;
        }
    }
    
    // Update dashboard overview statistics using KYC status count
    if (pagingObj && pagingObj.records !== undefined && !isFilterActive) {
        const statPendingKycEl = document.getElementById('stat-pending-kyc');
        // Overview count needs actual pending, which might require fetching all, so we fetch all in overview.
    }
    
    const bodyEl = document.getElementById('kyc-table-body');
    if (!bodyEl) return;
    
    if (apps.length === 0) {
        bodyEl.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">该筛选条件下无实名申请记录</td></tr>`;
        
        // Update pagination indicator
        const indicator = document.getElementById(`kyc-page-indicator`);
        if (indicator) indicator.innerText = `第 1 / 1 页 (共 0 条)`;
        return;
    }
    
    bodyEl.innerHTML = apps.map(a => {
        let actionHtml = '';
        if (a.status === 'PENDING' || a.status === 'NOT_VERIFIED') {
            actionHtml = `
                <div class="action-btn-group">
                    <button class="action-btn btn-view" onclick="openKycDrawer('${a.id}')">🔎 审核材料</button>
                </div>
            `;
        } else {
            actionHtml = `<span style="color: var(--text-muted); font-size: 0.8rem;">已审核完结</span>`;
        }
        
        return `
            <tr>
                <td>${phoneMap[String(a.userId)] || '--'}</td>
                <td>${a.email}</td>
                <td>${a.fullName}</td>
                <td>${translateIdType(a.idType)}</td>
                <td style="font-family: monospace;">${a.idNumber}</td>
                <td>
                    <span class="badge badge-${a.status}">
                        <span class="badge-status-dot"></span>
                        ${a.status}
                    </span>
                </td>
                <td>${actionHtml}</td>
            </tr>
        `;
    }).join('');
}

export function openKycDrawer(kycId) {
    const apps = window.cachedKycApps || [];
    const a = apps.find(item => String(item.id) === String(kycId));
    if (!a) {
        showToast('找不到实名认证明细！', true);
        return;
    }
    
    document.getElementById('drawer-kyc-id').value = kycId;
    document.getElementById('drawer-user-id').innerText = a.userId || '--';
    document.getElementById('drawer-user-email').innerText = a.email || '--';
    document.getElementById('drawer-user-name').innerText = a.fullName || '--';
    document.getElementById('drawer-id-type').innerText = translateIdType(a.idType);
    document.getElementById('drawer-id-number').innerText = a.idNumber || '--';
    
    // Additional rich fields
    document.getElementById('drawer-kyc-region').innerText = a.regionCode || '--';
    document.getElementById('drawer-kyc-gender-dob').innerText = `${a.gender || 'OTHER'} / ${a.dateOfBirth || '--'}`;
    document.getElementById('drawer-kyc-work').innerText = `${a.company || '--'} / ${a.occupation || '--'}`;
    document.getElementById('drawer-kyc-salary').innerText = a.salary ? `${a.salary} USDT` : '--';
    document.getElementById('drawer-kyc-address').innerText = a.address || '--';
    
    // Preview Front Photo
    const frontImg = document.getElementById('drawer-kyc-front-img');
    const frontPlaceholder = document.getElementById('drawer-kyc-front-placeholder');
    if (a.idCardFront) {
        let frontUrl = a.idCardFront;
        const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
        if (isLocalDev && (frontUrl.includes('storage.googleapis.com') || frontUrl.startsWith('http://') || frontUrl.startsWith('https://'))) {
            frontUrl = `/download-gcs?url=${encodeURIComponent(frontUrl)}`;
        }
        frontImg.src = frontUrl;
        frontImg.style.display = 'block';
        frontPlaceholder.style.display = 'none';
    } else {
        frontImg.style.display = 'none';
        frontPlaceholder.style.display = 'flex';
    }
    
    // Preview Back Photo
    const backImg = document.getElementById('drawer-kyc-back-img');
    const backPlaceholder = document.getElementById('drawer-kyc-back-placeholder');
    if (a.idCardBack) {
        let backUrl = a.idCardBack;
        const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
        if (isLocalDev && (backUrl.includes('storage.googleapis.com') || backUrl.startsWith('http://') || backUrl.startsWith('https://'))) {
            backUrl = `/download-gcs?url=${encodeURIComponent(backUrl)}`;
        }
        backImg.src = backUrl;
        backImg.style.display = 'block';
        backPlaceholder.style.display = 'none';
    } else {
        backImg.style.display = 'none';
        backPlaceholder.style.display = 'flex';
    }
    
    document.getElementById('kyc-drawer').classList.add('active');
}

function openKycImageLightbox(src) {
    const modal = document.getElementById('proof-lightbox-modal');
    const img = document.getElementById('proof-lightbox-img');
    if (modal && img) {
        img.src = src;
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}
window.openKycImageLightbox = openKycImageLightbox;
window.openKycDrawer = openKycDrawer;
window.closeKycDrawer = closeKycDrawer;
window.handleKycReviewSubmit = handleKycReviewSubmit;

function closeKycDrawer() {
    document.getElementById('kyc-drawer').classList.remove('active');
}

async function handleKycReviewSubmit(status) {
    const kycId = document.getElementById('drawer-kyc-id').value;
    
    // Conforms strictly to handlers_user.KYCAuditRequest body schema
    const body = {
        approved: status === 'APPROVED', 
        reason: status === 'APPROVED' ? '合规身份验证成功，全套审计凭证合法。' : '合规身份审计退回，提交图片模糊或信息有误。'
    };
    
    showToast(`正在提交实名审核指令 [${status === 'APPROVED' ? '批准' : '拒绝'}]...`, false);
    
    try {
        const res = await apiFetch('POST', `/users/kyc/${kycId}/audit`, body, true);
        
        if (res && res.code === 200) {
            window.kycFetchPromise = null; // Clear cached promise so next load fetches fresh data
            closeKycDrawer();
            const statStr = status === 'APPROVED' ? '实名材料批准通过 ✓' : '实名材料驳回拒绝 ✕';
            showToast(`💼 审核决策处理成功：${statStr}`, false);
            loadDashboardStats();
            loadKycList();
        } else {
            showToast((res ? res.errorMessage : '') || '审核操作提交失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('提交实名审核网络异常！', true);
    }
}


export function resetKycFilters() {
    const uid = document.getElementById('filter-kyc-uid');
    const email = document.getElementById('filter-kyc-email');
    const name = document.getElementById('filter-kyc-name');
    const status = document.getElementById('kyc-status-filter');
    const size = document.getElementById('kyc-size-select');
    if (uid) uid.value = '';
    if (email) email.value = '';
    if (name) name.value = '';
    if (status) status.value = 'ALL';
    if (size) size.value = '10';
    window.adminPages.kyc.size = 10;
    window.adminPages.kyc.current = 1;
    loadKycList();
    showToast('✓ KYC 检索条件已重置', false);
}