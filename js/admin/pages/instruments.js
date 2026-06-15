export // ==========================================
// 交易商品管理 (Trading Instruments Management)
// ==========================================
let instrumentsList = [];
let instrumentsSearchTimeout = null;

async function loadInstrumentsList() {
    const tableBody = document.getElementById('instruments-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">🔄 正在安全调取交易商品列表...</td></tr>';
    
    try {
        const pageConf = window.adminPages.instruments;
        const keyword = (document.getElementById('instruments-search-input')?.value || '').toLowerCase().trim();
        const assetClass = document.getElementById('instruments-asset-class-filter')?.value || '';
        const isCore = document.getElementById('instruments-core-filter')?.value || '';
        const recommended = document.getElementById('instruments-recommended-filter')?.value || '';
        const enabled = document.getElementById('instruments-enabled-filter')?.value || '';

        // 构建带分页与过滤参数的请求 URL
        let path = `/instruments?page=${pageConf.current}&pageSize=${pageConf.size}`;
        if (keyword) path += `&symbol=${encodeURIComponent(keyword)}`;
        if (assetClass) path += `&assetClass=${encodeURIComponent(assetClass)}`;
        if (isCore !== '') path += `&isCore=${isCore}`;
        if (recommended !== '') path += `&recommended=${recommended}`;
        if (enabled !== '') path += `&enabled=${enabled}`;
        
        const res = await apiFetch('GET', path, null, true);
        const dataList = res.result || res.data;
        if (res.code === 200 && dataList) {
            instrumentsList = dataList;
            
            // 使用后端返回的分页数据更新界面分页状态
            const paging = res.paging || { page: pageConf.current, pages: 1, pageSize: pageConf.size, records: dataList.length };
            const totalItems = paging.records !== undefined ? paging.records : dataList.length;
            const totalPages = paging.pages !== undefined ? paging.pages : Math.max(1, Math.ceil(totalItems / pageConf.size));
            
            pageConf.current = paging.page || pageConf.current;
            
            // 更新页面底部页码文字指示器
            const indicator = document.getElementById('instruments-page-indicator');
            if (indicator) {
                indicator.innerText = `第 ${pageConf.current} / ${totalPages} 页 (共 ${totalItems} 条)`;
            }
            
            if (dataList.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">📭 暂无匹配的交易商品记录</td></tr>';
                return;
            }
            
            let html = '';
            dataList.forEach(inst => {
                const enabledChecked = inst.enabled ? 'checked' : '';
                const coreChecked = inst.isCore ? 'checked' : '';
                const recChecked = inst.recommended ? 'checked' : '';
                
                const baseAssetId = inst.baseAssetId || (inst.baseAsset && inst.baseAsset.id) || '--';
                const quoteAssetId = inst.quoteAssetId || (inst.quoteAsset && inst.quoteAsset.id) || '--';
                
                html += `
                    <tr style="border-bottom: 1.5px solid var(--border-light);">
                        <td style="font-family: monospace; font-size: 0.8rem;">${inst.id}</td>
                        <td style="font-weight: bold; color: var(--text-primary); font-family: monospace;">${inst.symbol}</td>
                        <td>${escapeHtml(inst.name)}</td>
                        <td><span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(91,81,249,0.1); color: var(--primary); font-weight: bold;">${inst.assetClass}</span></td>
                        <td style="font-family: monospace;">Base: ${baseAssetId} / Quote: ${quoteAssetId}</td>
                        <td>${inst.exchangeId}</td>
                        <td>${inst.dataSource || '--'}</td>
                        <td>
                            <label class="switch">
                                <input type="checkbox" ${enabledChecked} onchange="toggleInstrumentEnabled('${inst.id}', this.checked)">
                                <span class="switch-slider"></span>
                            </label>
                        </td>
                        <td>
                            <label class="switch">
                                <input type="checkbox" ${coreChecked} onchange="toggleInstrumentCore('${inst.id}', this.checked)">
                                <span class="switch-slider"></span>
                            </label>
                        </td>
                        <td>
                            <label class="switch">
                                <input type="checkbox" ${recChecked} onchange="toggleInstrumentRecommendation('${inst.id}', this.checked)">
                                <span class="switch-slider"></span>
                            </label>
                        </td>
                        <td>
                            <div style="display: flex; gap: 8px;">
                                <button class="action-btn btn-approve" onclick="openInstrumentDrawer('${inst.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px;">编辑</button>
                                <button class="action-btn btn-reject" onclick="deleteInstrument('${inst.id}')" style="padding: 4px 10px; font-size: 0.78rem; border-radius: 4px; background: rgba(239,68,68,0.1); color: #EF4444; border: 1px solid rgba(239,68,68,0.2);">删除</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        } else {
            showToast(res.errorMessage || '加载交易商品列表失败！', true);
            tableBody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #EF4444; padding: 40px 0;">❌ 加载失败: ${res.errorMessage || '未知接口错误'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
        showToast('获取交易商品列表异常！', true);
        tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #EF4444; padding: 40px 0;">❌ 网络请求错误，请刷新重试！</td></tr>';
    }
}

function debounceInstrumentsLoad() {
    if (instrumentsSearchTimeout) {
        clearTimeout(instrumentsSearchTimeout);
    }
    instrumentsSearchTimeout = setTimeout(() => {
        window.adminPages.instruments.current = 1;
        loadInstrumentsList();
    }, 300);
}

async function toggleInstrumentEnabled(id, checked) {
    const inst = instrumentsList.find(x => String(x.id) === String(id));
    if (!inst) {
        showToast('未找到商品缓存数据，请刷新重试', true);
        loadInstrumentsList();
        return;
    }
    
    const updatedInst = {
        ...inst,
        enabled: checked
    };
    
    try {
        const res = await apiFetch('PUT', `/instruments/${id}`, updatedInst, true);
        if (res.code === 200) {
            showToast(`商品 ${inst.symbol} 已${checked ? '上架' : '下架'}`);
            inst.enabled = checked;
        } else {
            showToast(res.errorMessage || '修改上架状态失败', true);
            loadInstrumentsList();
        }
    } catch (e) {
        console.error(e);
        showToast('修改上架状态请求异常', true);
        loadInstrumentsList();
    }
}

async function toggleInstrumentCore(id, checked) {
    try {
        const res = await apiFetch('POST', `/instruments/${id}/core-status`, { isCore: checked }, true);
        if (res.code === 200) {
            showToast(`核心状态已更新`);
            const inst = instrumentsList.find(x => String(x.id) === String(id));
            if (inst) inst.isCore = checked;
        } else {
            showToast(res.errorMessage || '修改核心状态失败', true);
            loadInstrumentsList();
        }
    } catch (e) {
        console.error(e);
        showToast('修改核心状态请求异常', true);
        loadInstrumentsList();
    }
}

async function toggleInstrumentRecommendation(id, checked) {
    try {
        const res = await apiFetch('POST', `/instruments/${id}/recommendation`, { recommended: checked }, true);
        if (res.code === 200) {
            showToast(`推荐状态已更新`);
            const inst = instrumentsList.find(x => String(x.id) === String(id));
            if (inst) inst.recommended = checked;
        } else {
            showToast(res.errorMessage || '修改推荐状态失败', true);
            loadInstrumentsList();
        }
    } catch (e) {
        console.error(e);
        showToast('修改推荐状态请求异常', true);
        loadInstrumentsList();
    }
}

function openInstrumentDrawer(instId = null) {
    const form = document.getElementById('instruments-form');
    if (!form) return;
    
    form.reset();
    
    if (!instId) {
        document.getElementById('instruments-drawer-title').innerText = '📝 新建交易商品';
        document.getElementById('edit-inst-id').value = '';
        document.getElementById('edit-inst-symbol').readOnly = false;
        
        document.getElementById('edit-inst-enabled').checked = true;
        document.getElementById('edit-inst-isCore').checked = false;
        document.getElementById('edit-inst-recommended').checked = false;
    } else {
        const inst = instrumentsList.find(x => String(x.id) === String(instId));
        if (!inst) {
            showToast('未找到该商品数据', true);
            return;
        }
        
        const bId = inst.baseAssetId || (inst.baseAsset && inst.baseAsset.id) || '';
        const qId = inst.quoteAssetId || (inst.quoteAsset && inst.quoteAsset.id) || '';

        document.getElementById('instruments-drawer-title').innerText = `✏️ 编辑交易商品 (ID: ${instId})`;
        document.getElementById('edit-inst-id').value = inst.id;
        document.getElementById('edit-inst-symbol').value = inst.symbol;
        document.getElementById('edit-inst-symbol').readOnly = true;
        document.getElementById('edit-inst-name').value = inst.name;
        document.getElementById('edit-inst-assetClass').value = inst.assetClass;
        document.getElementById('edit-inst-exchangeId').value = inst.exchangeId || '';
        document.getElementById('edit-inst-baseAssetId').value = bId;
        document.getElementById('edit-inst-quoteAssetId').value = qId;
        document.getElementById('edit-inst-dataSource').value = inst.dataSource || '';
        
        document.getElementById('edit-inst-enabled').checked = inst.enabled || false;
        document.getElementById('edit-inst-isCore').checked = inst.isCore || false;
        document.getElementById('edit-inst-recommended').checked = inst.recommended || false;
    }
    
    document.getElementById('instruments-overlay').classList.add('active');
    document.getElementById('instruments-drawer').classList.add('active');
}

function closeInstrumentDrawer() {
    document.getElementById('instruments-overlay').classList.remove('active');
    document.getElementById('instruments-drawer').classList.remove('active');
}

async function saveInstrumentSubmit(event) {
    event.preventDefault();
    
    const id = document.getElementById('edit-inst-id').value;
    const symbol = document.getElementById('edit-inst-symbol').value.trim().toLowerCase();
    const name = document.getElementById('edit-inst-name').value.trim();
    const assetClass = document.getElementById('edit-inst-assetClass').value;
    
    const exchangeIdInput = document.getElementById('edit-inst-exchangeId').value.trim();
    const baseAssetIdInput = document.getElementById('edit-inst-baseAssetId').value.trim();
    const quoteAssetIdInput = document.getElementById('edit-inst-quoteAssetId').value.trim();
    
    // 防止大数（Snowflake 19位ID）强转 Number 产生精度丢失：仅在不溢出 MAX_SAFE_INTEGER 时转为数字提交，否则保留为字符串
    const exchangeId = /^\d+$/.test(exchangeIdInput) && Number(exchangeIdInput) <= Number.MAX_SAFE_INTEGER ? parseInt(exchangeIdInput, 10) : exchangeIdInput;
    const baseAssetId = /^\d+$/.test(baseAssetIdInput) && Number(baseAssetIdInput) <= Number.MAX_SAFE_INTEGER ? parseInt(baseAssetIdInput, 10) : baseAssetIdInput;
    const quoteAssetId = /^\d+$/.test(quoteAssetIdInput) && Number(quoteAssetIdInput) <= Number.MAX_SAFE_INTEGER ? parseInt(quoteAssetIdInput, 10) : quoteAssetIdInput;
    
    const dataSource = document.getElementById('edit-inst-dataSource').value.trim();
    const enabled = document.getElementById('edit-inst-enabled').checked;
    const isCore = document.getElementById('edit-inst-isCore').checked;
    const recommended = document.getElementById('edit-inst-recommended').checked;
    
    if (!symbol || !name) {
        showToast('Symbol 和商品名称为必填项！', true);
        return;
    }
    
    const instData = {
        symbol,
        name,
        assetClass,
        exchangeId,
        baseAssetId,
        quoteAssetId,
        dataSource: dataSource || null,
        enabled,
        isCore,
        recommended
    };
    
    try {
        let res;
        if (id) {
            res = await apiFetch('PUT', `/instruments/${id}`, instData, true);
        } else {
            res = await apiFetch('POST', '/instruments', instData, true);
        }
        
        if (res.code === 200) {
            showToast(id ? '修改商品配置成功！' : '新建交易商品成功！');
            closeInstrumentDrawer();
            loadInstrumentsList();
        } else {
            showToast(res.errorMessage || '保存商品配置失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('保存商品配置请求异常！', true);
    }
}

async function deleteInstrument(instId) {
    if (!confirm('确认要彻底删除该交易商品吗？此操作不可逆！')) {
        return;
    }
    
    try {
        const res = await apiFetch('POST', `/instruments/${instId}/delete`, {}, true);
        if (res.code === 200) {
            showToast('删除交易商品成功！');
            loadInstrumentsList();
        } else {
            showToast(res.errorMessage || '删除交易商品失败！', true);
        }
    } catch (e) {
        console.error(e);
        showToast('删除交易商品异常！', true);
    }
}

window.loadInstrumentsList = loadInstrumentsList;
window.debounceInstrumentsLoad = debounceInstrumentsLoad;
window.toggleInstrumentEnabled = toggleInstrumentEnabled;
window.toggleInstrumentCore = toggleInstrumentCore;
window.toggleInstrumentRecommendation = toggleInstrumentRecommendation;
window.openInstrumentDrawer = openInstrumentDrawer;
window.closeInstrumentDrawer = closeInstrumentDrawer;
window.saveInstrumentSubmit = saveInstrumentSubmit;
window.deleteInstrument = deleteInstrument;