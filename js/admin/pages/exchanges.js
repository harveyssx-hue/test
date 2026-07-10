// js/admin/pages/exchanges.js
window.adminPages = window.adminPages || {};
window.adminPages.exchanges = window.adminPages.exchanges || { current: 1, size: 10, totalPages: 1 };

// 1. Query Exchanges List
export async function loadExchangesList() {
    const tbody = document.getElementById('exchanges-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px 0;">🔄 正在加载交易所列表...</td></tr>`;

    // Fetch filters
    const code = document.getElementById('filter-exchange-code').value.trim();
    const name = document.getElementById('filter-exchange-name').value.trim();
    const enabled = document.getElementById('filter-exchange-enabled').value;

    let url = `/exchanges?page=${window.adminPages.exchanges.current}&pageSize=${window.adminPages.exchanges.size}`;
    if (code) url += `&code=${encodeURIComponent(code)}`;
    if (name) url += `&name=${encodeURIComponent(name)}`;
    if (enabled !== 'ALL') url += `&enabled=${enabled}`;

    try {
        const res = await apiFetch('GET', url, null, true);
        if (res && res.code === 200) {
            const list = res.data || res.result || [];
            const paging = res.paging || {};
            
            // Update pagination values
            window.adminPages.exchanges.totalPages = paging.pages || 1;
            updateAdminPageIndicator('exchanges', paging.page || 1, paging.pages || 1, paging.records || list.length);

            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 30px 0;">暂无符合条件的交易所数据</td></tr>`;
                return;
            }

            tbody.innerHTML = list.map(o => {
                const statusBadge = o.enabled ? 
                    `<span class="badge badge-success">启用</span>` : 
                    `<span class="badge badge-rejected">禁用</span>`;

                const createTime = o.createdAt ? new Date(parseInt(o.createdAt)).toLocaleString() : '--';
                
                // Format trading sessions list
                const sessionsStr = (o.tradingSessions || []).map(s => `<code>${s.start} - ${s.end}</code>`).join('<br>') || '--';
                
                // Format asset classes tags
                const assetsStr = (o.tradableAssetClasses || []).map(a => 
                    `<span style="font-size: 0.68rem; font-weight: 600; background: rgba(91,81,249,0.06); padding: 2px 6px; border-radius: 4px; color: var(--primary); margin-right: 4px;">${a}</span>`
                ).join('') || '--';

                return `
                    <tr>
                        <td><strong style="font-family: monospace; font-size: 0.78rem;">${o.id}</strong></td>
                        <td><code style="font-weight: bold; font-size: 0.8rem; color: var(--primary);">${o.code}</code></td>
                        <td>
                            <div style="font-weight: 700;">${o.name}</div>
                        </td>
                        <td>
                            <div>${o.displayName || '--'}</div>
                            <div style="font-size: 0.68rem; color: var(--text-muted);">地区: ${o.regionCode || '--'}</div>
                        </td>
                        <td><span style="font-family: monospace; font-size: 0.72rem;">${o.quoteAssetId || '--'}</span></td>
                        <td>
                            <div><strong>${o.timezone || '--'}</strong></div>
                            <div style="font-size: 0.68rem; color: var(--text-muted);">偏差: ${o.timezoneOffset !== undefined ? `${o.timezoneOffset}h` : '--'}</div>
                        </td>
                        <td style="line-height: 1.4; font-size: 0.75rem;">${sessionsStr}</td>
                        <td>${assetsStr}</td>
                        <td style="text-align: center;">${statusBadge}</td>
                        <td class="sticky-right" style="text-align: center;">
                            <button class="action-btn" onclick="openEditExchangeModal('${o.id}')" style="background: var(--primary); color: #FFF; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; border: none; cursor: pointer; margin-right: 4px;">编辑</button>
                            <button class="action-btn" onclick="deleteExchange('${o.id}', '${o.code}')" style="background: var(--red); color: #FFF; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; border: none; cursor: pointer;">删除</button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--red); padding: 30px 0;">❌ 加载交易所失败: ${res ? res.errorMessage : '未知错误'}</td></tr>`;
        }
    } catch (e) {
        console.error("Failed to load exchanges list:", e);
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--red); padding: 30px 0;">❌ 与服务器通信中断，加载失败</td></tr>`;
    }
}
window.loadExchangesList = loadExchangesList;

export function resetExchangeFilters() {
    document.getElementById('filter-exchange-code').value = '';
    document.getElementById('filter-exchange-name').value = '';
    document.getElementById('filter-exchange-enabled').value = 'true';
    window.adminPages.exchanges.current = 1;
    loadExchangesList();
}
window.resetExchangeFilters = resetExchangeFilters;

// 2. Open Add/Edit Exchange Modal
export function addSessionRow(startVal = "", endVal = "") {
    const container = document.getElementById('session-editor-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'session-row';
    row.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    row.innerHTML = `
        <input type="time" class="session-start" value="${startVal}" required style="flex: 1; height: 32px; border-radius: 4px; border: 1px solid var(--border-light); padding: 0 8px; background: transparent; color: var(--text-primary); outline: none;">
        <span style="color: var(--text-muted); font-size: 0.75rem;">至</span>
        <input type="time" class="session-end" value="${endVal}" required style="flex: 1; height: 32px; border-radius: 4px; border: 1px solid var(--border-light); padding: 0 8px; background: transparent; color: var(--text-primary); outline: none;">
        <button type="button" class="action-btn" onclick="this.parentElement.remove()" style="background: var(--red); color: #FFF; padding: 4px 10px; border-radius: 4px; border: none; cursor: pointer; height: 32px; font-weight: bold; display: flex; align-items: center; justify-content: center;">✕</button>
    `;
    container.appendChild(row);
}
window.addSessionRow = addSessionRow;

function getTradingSessionsFromForm() {
    const rows = document.querySelectorAll('#session-editor-container .session-row');
    const sessions = [];
    rows.forEach(row => {
        const start = row.querySelector('.session-start').value;
        const end = row.querySelector('.session-end').value;
        if (start && end) {
            sessions.push({ start, end });
        }
    });
    return sessions;
}

function setTradingSessionsInForm(sessions = []) {
    const container = document.getElementById('session-editor-container');
    if (container) container.innerHTML = '';
    
    if (sessions && sessions.length > 0) {
        sessions.forEach(s => addSessionRow(s.start, s.end));
    } else {
        // Add one empty row by default
        addSessionRow("", "");
    }
}

export function openAddExchangeModal() {
    const modal = document.getElementById('exchange-edit-modal');
    if (!modal) return;

    document.getElementById('exchange-modal-title').innerText = '🏛️ 新增交易所';
    document.getElementById('exchange-edit-form').reset();
    document.getElementById('edit-exch-id').value = '';
    
    // Default timezone and enabled
    document.getElementById('edit-exch-timezone').value = 'Asia/Kolkata';
    document.getElementById('edit-exch-enabled').value = 'true';

    // Clear checkboxes
    const checkboxes = document.querySelectorAll('input[name="tradable-asset"]');
    checkboxes.forEach(cb => cb.checked = false);

    // Reset trading sessions editor
    setTradingSessionsInForm([]);

    modal.style.display = 'flex';
    modal.classList.add('active');
}
window.openAddExchangeModal = openAddExchangeModal;

export async function openEditExchangeModal(exchId) {
    const modal = document.getElementById('exchange-edit-modal');
    if (!modal) return;

    document.getElementById('exchange-modal-title').innerText = '🏛️ 编辑交易所参数';
    document.getElementById('exchange-edit-form').reset();
    document.getElementById('edit-exch-id').value = exchId;

    try {
        // Fetch exchanges list to find matching exchange
        const res = await apiFetch('GET', `/exchanges?page=1&pageSize=1000`, null, true);
        if (res && res.code === 200) {
            const list = res.data || res.result || [];
            const d = list.find(e => String(e.id) === String(exchId));
            
            if (d) {
                document.getElementById('edit-exch-code').value = d.code || '';
                document.getElementById('edit-exch-name').value = d.name || '';
                document.getElementById('edit-exch-display').value = d.displayName || '';
                document.getElementById('edit-exch-region').value = d.regionCode || '';
                document.getElementById('edit-exch-timezone').value = d.timezone || 'Asia/Kolkata';
                document.getElementById('edit-exch-quote-asset').value = d.quoteAssetId || '';
                document.getElementById('edit-exch-enabled').value = String(d.enabled);

                // Set tradable asset classes checkboxes
                const checkboxes = document.querySelectorAll('input[name="tradable-asset"]');
                checkboxes.forEach(cb => {
                    cb.checked = (d.tradableAssetClasses || []).includes(cb.value);
                });

                // Set trading sessions rows
                setTradingSessionsInForm(d.tradingSessions || []);

                modal.style.display = 'flex';
                modal.classList.add('active');
            } else {
                showToast('❌ 未找到该交易所的配置详情', true);
            }
        } else {
            showToast('❌ 获取交易所数据失败: ' + (res ? res.errorMessage : '未知错误'), true);
        }
    } catch (e) {
        console.error("Failed to load exchange detail for edit:", e);
        showToast('❌ 与服务器通信失败', true);
    }
}
window.openEditExchangeModal = openEditExchangeModal;

export function closeExchangeEditModal() {
    const modal = document.getElementById('exchange-edit-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}
window.closeExchangeEditModal = closeExchangeEditModal;

// 3. Submit Exchange Edit/Add
export async function submitExchangeEdit(event) {
    if (event) event.preventDefault();

    const exchId = document.getElementById('edit-exch-id').value;
    const code = document.getElementById('edit-exch-code').value.trim();
    const name = document.getElementById('edit-exch-name').value.trim();
    const displayName = document.getElementById('edit-exch-display').value.trim();
    const regionCode = document.getElementById('edit-exch-region').value.trim();
    const timezone = document.getElementById('edit-exch-timezone').value;
    const quoteAssetIdStr = document.getElementById('edit-exch-quote-asset').value.trim();
    const enabled = document.getElementById('edit-exch-enabled').value === 'true';

    // Get asset classes array
    const assetCheckboxes = document.querySelectorAll('input[name="tradable-asset"]:checked');
    const tradableAssetClasses = Array.from(assetCheckboxes).map(cb => cb.value);

    // Get trading sessions array
    const tradingSessions = getTradingSessionsFromForm();

    if (!code || !name || !displayName || !timezone) {
        showToast('❌ 请填写所有交易所必填参数！', true);
        return;
    }

    // Build payload
    const payload = {
        code,
        name,
        displayName,
        timezone,
        enabled,
        tradingSessions,
        tradableAssetClasses
    };

    if (regionCode) payload.regionCode = regionCode;
    if (quoteAssetIdStr) {
        payload.quoteAssetId = parseInt(quoteAssetIdStr);
    }

    const method = exchId ? 'PUT' : 'POST';
    const path = exchId ? `/exchanges/${exchId}` : `/exchanges`;

    try {
        const res = await apiFetch(method, path, payload, true);
        if (res && res.code === 200) {
            showToast('✓ 交易所配置保存成功！', false);
            closeExchangeEditModal();
            loadExchangesList();
        } else {
            showToast('❌ 保存失败: ' + (res ? res.errorMessage : '未知错误'), true);
        }
    } catch (e) {
        console.error("Failed to submit exchange configuration:", e);
        showToast('❌ 与服务器通信失败，保存失败', true);
    }
}
window.submitExchangeEdit = submitExchangeEdit;

// 4. Delete Exchange
export async function deleteExchange(exchId, code) {
    if (!confirm(`⚠️ 您确定要删除交易所: ${code} 吗？\n删除交易所将不可逆，且可能导致关联的交易商品查询异常！`)) {
        return;
    }

    try {
        const res = await apiFetch('POST', `/exchanges/${exchId}/delete`, null, true);
        if (res && res.code === 200) {
            showToast(`✓ 交易所 ${code} 删除成功！`, false);
            loadExchangesList();
        } else {
            showToast('❌ 删除失败: ' + (res ? res.errorMessage : '未知错误'), true);
        }
    } catch (e) {
        console.error("Failed to delete exchange:", e);
        showToast('❌ 与服务器通信失败，删除失败', true);
    }
}
window.deleteExchange = deleteExchange;
