// js/admin/pages/holidays.js
let cachedHolidays = [];
let holidayDebounceTimer = null;

export async function loadHolidaysList() {
    const nameFilter = document.getElementById('holiday-search-name')?.value.trim() || '';
    const startFilter = document.getElementById('holiday-search-start')?.value || '';
    const endFilter = document.getElementById('holiday-search-end')?.value || '';
    
    const pageConf = window.adminPages.holidays;
    const tbody = document.getElementById('holidays-table-body');
    
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 20px 0;">⏳ 正在加载假期数据...</td></tr>';
    }
    
    // Construct Query Parameters
    let queryParams = `?page=${pageConf.current}&pageSize=${pageConf.size}`;
    if (nameFilter) queryParams += `&holidayName=${encodeURIComponent(nameFilter)}`;
    if (startFilter) queryParams += `&startHolidayDate=${startFilter}`;
    if (endFilter) queryParams += `&endHolidayDate=${endFilter}`;
    
    try {
        const res = await apiFetch('GET', `/market/holidays${queryParams}`, null, true);
        if (res.code === 200) {
            // Note: The API returns { code: 200, result: [...] } or { result: { list: [], paging: {} } }
            // Let's inspect the returned structure: it's standard pagination VO or a simple array
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
            
            cachedHolidays = list;
            
            // Render Pagination Indicator
            if (typeof window.updateAdminPageIndicator === 'function') {
                window.updateAdminPageIndicator('holidays', paging);
            }
            
            renderHolidaysTable(list);
        } else {
            showToast(res.errorMessage || '获取假期列表失败！', true);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #EF4444; padding: 20px 0;">❌ 数据拉取失败: ${res.errorMessage || '未知错误'}</td></tr>`;
            }
        }
    } catch (e) {
        console.error("Failed to load holidays:", e);
        showToast('拉取市场假期遇到网络异常！', true);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #EF4444; padding: 20px 0;">❌ 网络连接异常</td></tr>';
        }
    }
}

function renderHolidaysTable(list) {
    const tbody = document.getElementById('holidays-table-body');
    if (!tbody) return;
    
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px 0;">ℹ️ 未查找到任何假期安排记录</td></tr>';
        return;
    }
    
    tbody.innerHTML = list.map((item, index) => {
        const idStr = item.id ? String(item.id) : '--';
        const dateStr = item.holidayDate || '--';
        const nameStr = item.holidayName || '--';
        const createdVal = item.createdAt ? new Date(parseInt(item.createdAt)).toLocaleString() : '--';
        const updatedVal = item.updatedAt ? new Date(parseInt(item.updatedAt)).toLocaleString() : '--';
        
        return `
            <tr>
                <td style="font-family: monospace; font-size: 0.72rem; font-weight: 600; color: var(--primary);">${idStr}</td>
                <td style="font-weight: 600; color: var(--text-primary);">${nameStr}</td>
                <td style="font-family: 'Outfit'; font-weight: 700; color: #EF4444;">${dateStr}</td>
                <td style="font-size: 0.72rem; color: var(--text-muted);">${createdVal}</td>
                <td style="font-size: 0.72rem; color: var(--text-muted);">${updatedVal}</td>
                <td>
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        <button class="action-btn" style="background: rgba(91, 81, 249, 0.08); border: 1.5px solid var(--primary); color: var(--primary); padding: 2px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="openHolidayModal('${item.id}')">编辑</button>
                        <button class="action-btn" style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid #EF4444; color: #EF4444; padding: 2px 8px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer;" onclick="deleteHoliday('${item.id}', '${nameStr}')">删除</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

export function debounceHolidaysLoad() {
    clearTimeout(holidayDebounceTimer);
    holidayDebounceTimer = setTimeout(() => {
        window.adminPages.holidays.current = 1;
        loadHolidaysList();
    }, 400);
}

export function resetHolidayFilters() {
    const nameFilter = document.getElementById('holiday-search-name');
    const startFilter = document.getElementById('holiday-search-start');
    const endFilter = document.getElementById('holiday-search-end');
    
    if (nameFilter) nameFilter.value = '';
    if (startFilter) startFilter.value = '';
    if (endFilter) endFilter.value = '';
    
    window.adminPages.holidays.current = 1;
    loadHolidaysList();
}

export async function openHolidayModal(id = null) {
    const modal = document.getElementById('holiday-form-modal');
    if (!modal) return;
    
    const titleEl = document.getElementById('holiday-modal-title');
    const idField = document.getElementById('holiday-id');
    const nameField = document.getElementById('holiday-name');
    const dateField = document.getElementById('holiday-date');
    
    idField.value = id || '';
    nameField.value = '';
    dateField.value = '';
    
    if (id) {
        if (titleEl) titleEl.innerText = '📝 编辑假期配置';
        try {
            const res = await apiFetch('GET', `/market/holidays/${id}`, null, true);
            if (res.code === 200) {
                const item = res.result || res.data || {};
                nameField.value = item.holidayName || '';
                dateField.value = item.holidayDate || '';
            } else {
                showToast(res.errorMessage || '获取假期详情失败！', true);
            }
        } catch (e) {
            console.error("Failed to load holiday detail:", e);
            showToast('获取假期详情遇到网络错误！', true);
        }
    } else {
        if (titleEl) titleEl.innerText = '📝 新增假期配置';
    }
    
    modal.style.display = 'flex';
    modal.classList.add('active');
}

export function closeHolidayModal() {
    const modal = document.getElementById('holiday-form-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

export async function saveHolidaySubmit(event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('holiday-id').value;
    const name = document.getElementById('holiday-name').value.trim();
    const date = document.getElementById('holiday-date').value;
    
    if (!name || !date) {
        showToast('❌ 假期名称和假期日期均为必填项！', true);
        return;
    }
    
    const reqBody = {
        holidayName: name,
        holidayDate: date
    };
    
    const submitBtn = document.getElementById('holiday-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = '正在提交...';
    }
    
    try {
        let res;
        if (id) {
            res = await apiFetch('PUT', `/market/holidays/${id}`, reqBody, true);
        } else {
            res = await apiFetch('POST', '/market/holidays', reqBody, true);
        }
        
        if (res.code === 200) {
            showToast(id ? '✓ 假期已成功更新' : '✓ 新假期已成功创建', false);
            closeHolidayModal();
            loadHolidaysList();
        } else {
            showToast(res.errorMessage || '提交保存失败！', true);
        }
    } catch (e) {
        console.error("Save holiday failed:", e);
        showToast('提交保存时遇到网络异常！', true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = '提交保存';
        }
    }
}

export async function deleteHoliday(id, name) {
    if (!confirm(`⚠️ 您确定要永久删除假期 [${name}] 吗？\n删除后相关的风控及休市逻辑可能受影响。`)) {
        return;
    }
    
    try {
        const res = await apiFetch('POST', `/market/holidays/${id}/delete`, null, true);
        if (res.code === 200) {
            showToast('✓ 假期已成功删除', false);
            loadHolidaysList();
        } else {
            showToast(res.errorMessage || '删除失败！', true);
        }
    } catch (e) {
        console.error("Failed to delete holiday:", e);
        showToast('删除假期遇到网络异常！', true);
    }
}

export async function syncHolidaysSubmit() {
    const region = document.getElementById('sync-holiday-region').value;
    const syncBtn = document.getElementById('btn-sync-holidays');
    if (!confirm(`确定要从第三方市场同步地区为 [${region}] 的假期数据吗？`)) {
        return;
    }
    
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.innerText = '⏳ 正在同步...';
    }
    
    try {
        const res = await apiFetch('POST', '/itick/market/holidays/sync', { region: region }, true);
        if (res.code === 200) {
            const resultObj = res.result || res.data || {};
            const created = resultObj.created !== undefined ? resultObj.created : 0;
            const updated = resultObj.updated !== undefined ? resultObj.updated : 0;
            showToast(`✓ 同步成功！新增 ${created} 条，更新 ${updated} 条。`, false);
            loadHolidaysList();
        } else {
            showToast(res.errorMessage || '外部同步失败！', true);
        }
    } catch (e) {
        console.error("Sync holidays failed:", e);
        showToast('同步外部假期遇到网络异常！', true);
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerText = '⚡ 同步假期';
        }
    }
}

// Bind to window to allow calling from HTML
window.loadHolidaysList = loadHolidaysList;
window.debounceHolidaysLoad = debounceHolidaysLoad;
window.resetHolidayFilters = resetHolidayFilters;
window.openHolidayModal = openHolidayModal;
window.closeHolidayModal = closeHolidayModal;
window.saveHolidaySubmit = saveHolidaySubmit;
window.deleteHoliday = deleteHoliday;
window.syncHolidaysSubmit = syncHolidaysSubmit;
