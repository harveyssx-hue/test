// Home Page View Controller
import { state } from '../modules/state.js?v=2.2.0';

const getCoinFallbackSvg = (symbol, size = 32) => {
    const cleanSym = symbol.toUpperCase().replace('USDT', '');
    const coinColors = { BTC: '#F7931A', ETH: '#627EEA', SOL: '#14F195', XRP: '#23292F', USDT: '#26A17B' };
    const coinColor = encodeURIComponent(coinColors[cleanSym] || '#1A3EC1');
    const half = size / 2;
    const yPos = half + (size * 0.14);
    const fontSize = Math.floor(size * 0.34);
    const text = cleanSym.substring(0, 2);
    return `data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22${size}%22 height=%22${size}%22><circle cx=%22${half}%22 cy=%22${half}%22 r=%22${half}%22 fill=%22${coinColor}%22/><text x=%22${half}%22 y=%22${yPos}%22 font-size=%22${fontSize}%22 font-weight=%22800%22 fill=%22white%22 text-anchor=%22middle%22 font-family=%22system-ui, sans-serif%22>${text}</text></svg>`;
};

function initHomeProfitsRotator() {
    // Disabled as requested to remove frontend mock simulator data
}

// Extremely fast DOM element reference cache to avoid expensive DOM queries during real-time WebSocket ticks
const domElementCache = {};
function renderHomeTrending(type = 'gainers') {
    currentTrendingType = type;
    const listEl = document.getElementById('home-trending-stocks');
    if (!listEl) return;
    
    if (recommendedInstruments.length === 0) {
        listEl.innerHTML = `<div class="loading-state-mini">${t('loading_home_trending')}</div>`;
        return;
    }
    
    // Sort copy of recommendedInstruments
    const sorted = [...recommendedInstruments].sort((a, b) => {
        const aChg = parseFloat(a.ticker?.priceChangePercent || 0);
        const bChg = parseFloat(b.ticker?.priceChangePercent || 0);
        return type === 'gainers' ? bChg - aChg : aChg - bChg;
    });
    
    // Take top 4
    const top4 = sorted.slice(0, 4);
    
    const shortenCompanyName = (name) => {
        if (!name) return '';
        let clean = name.trim();
        // Only filter out legal structure suffixes (case-insensitive)
        clean = clean.replace(/\b(ltd|limited|co|co\.|corp|corporation|inc|incorporated|plc)\b/ig, '');
        // Clean up trailing spaces, commas, dots, dashes
        clean = clean.replace(/[\s,\.\-]+$/, '').trim();
        return clean;
    };
    
    listEl.innerHTML = top4.map(inst => {
        const symUpper = inst.symbol.toUpperCase();
        const ticker = inst.ticker || {};
        
        const priceVal = parseFloat(ticker.closePrice || 0);
        const priceStr = priceVal ? priceVal.toFixed(inst.symbol.toLowerCase() === 'xrpusdt' ? 4 : 2) : '--';
        
        const chgPercent = parseFloat(ticker.priceChangePercent || 0);
        const chgStr = `${chgPercent >= 0 ? '+' : ''}${chgPercent.toFixed(2)}%`;
        const chgClass = chgPercent >= 0 ? 'green' : 'red';
        const chgBg = chgPercent >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        const chgColor = chgPercent >= 0 ? '#10B981' : '#EF4444';
        
        const cleanSym = inst.symbol.toUpperCase().replace('.IN', '').replace('USDT', '');
        const fallbackSvg = getCoinFallbackSvg(inst.symbol, 32);
        
        const isStock = inst.assetClass === 'STOCK' || !inst.symbol.toUpperCase().endsWith('USDT');
        const quoteHtml = isStock ? '' : '<span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 600;">/USDT</span>';
        
        return `
            <div class="trending-stock-row" onclick="showMarketDetail('${inst.symbol}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #FFF; border-radius: 16px; border: 1.5px solid var(--border-light); cursor: pointer; transition: var(--transition);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${inst.logo || ''}" onerror="this.onerror=null; this.src='${fallbackSvg}'" alt="${cleanSym}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: contain; background: #F8FAFC; border: 1px solid rgba(0,0,0,0.03);" />
                    <div style="text-align: left;">
                        <div style="font-size: 0.8rem; font-weight: 750; color: var(--text-primary);">${cleanSym}${quoteHtml}</div>
                        <div style="font-size: 0.62rem; color: var(--text-muted); font-weight: 600; margin-top: 1px;">${shortenCompanyName(inst.name) || cleanSym}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary); font-family: system-ui, sans-serif;">${priceStr}</span>
                    <span style="font-size: 0.68rem; padding: 5px 10px; border-radius: 10px; font-weight: 750; background: ${chgBg}; color: ${chgColor}; min-width: 58px; text-align: center;">${chgStr}</span>
                </div>
            </div>
        `;
    }).join('');
}

function switchTrendingTab(type) {
    currentTrendingType = type;
    const btnGainers = document.getElementById('btn-trending-gainers');
    const btnLosers = document.getElementById('btn-trending-losers');
    
    if (type === 'gainers') {
        if (btnGainers) {
            btnGainers.className = 'trending-tab active';
            btnGainers.style.background = 'var(--primary)';
            btnGainers.style.color = '#FFF';
            btnGainers.style.border = 'none';
        }
        if (btnLosers) {
            btnLosers.className = 'trending-tab';
            btnLosers.style.background = '#FFF';
            btnLosers.style.color = 'var(--text-secondary)';
            btnLosers.style.border = '1.5px solid var(--border-light)';
        }
    } else {
        if (btnGainers) {
            btnGainers.className = 'trending-tab';
            btnGainers.style.background = '#FFF';
            btnGainers.style.color = 'var(--text-secondary)';
            btnGainers.style.border = '1.5px solid var(--border-light)';
        }
        if (btnLosers) {
            btnLosers.className = 'trending-tab active';
            btnLosers.style.background = 'var(--primary)';
            btnLosers.style.color = '#FFF';
            btnLosers.style.border = 'none';
        }
    }
    
    renderHomeTrending(type);
}

function openAdvisoryModal() {
    if (window.showToast) {
        const msg = (window.t ? window.t('toast_online_support_prep') : 'Online support preparing...');
        window.showToast(msg, false);
    }
}

window.initHomeProfitsRotator = initHomeProfitsRotator;
window.renderHomeTrending = renderHomeTrending;
window.switchTrendingTab = switchTrendingTab;
window.openAdvisoryModal = openAdvisoryModal;