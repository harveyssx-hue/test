// User Profile / Settings Page View Controller
import { state } from '../modules/state.js?v=2.2.0';

async function openNotifyModal() { await ensureModalLoaded('notify-modal'); document.getElementById('notify-modal').classList.add('active'); }

function closeNotifyModal() { document.getElementById('notify-modal').classList.remove('active'); }

function openAcademyModal() { document.getElementById('academy-modal').classList.add('active'); }

function closeAcademyModal() { document.getElementById('academy-modal').classList.remove('active'); }

async function openPlatformAgreementModal(code, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    await ensureModalLoaded('platform-agreement-modal');
    const modal = document.getElementById('platform-agreement-modal');
    if (!modal) return;
    
    const titleEl = document.getElementById('platform-agreement-title');
    const summaryEl = document.getElementById('platform-agreement-summary');
    const bodyEl = document.getElementById('platform-agreement-body');
    
    titleEl.innerText = 'Loading Agreement...';
    summaryEl.style.display = 'none';
    bodyEl.innerHTML = '<div style="text-align: center; padding: 40px 0; color: var(--text-secondary);">🔄 Loading agreement content...</div>';
    
    modal.classList.add('active');
    
    try {
        const res = await apiFetch('GET', `/common/platform-contents/${code}?localeTag=${currentLocale}`, null, false);
        const docData = res.result || res.data;
        if (res.code === 200 && docData) {
            titleEl.innerText = docData.title || code;
            if (docData.summary) {
                summaryEl.innerText = docData.summary;
                summaryEl.style.display = 'block';
            } else {
                summaryEl.style.display = 'none';
            }
            bodyEl.innerHTML = parseMarkdownToHtml(docData.content);
        } else {
            titleEl.innerText = 'Error';
            bodyEl.innerHTML = `<div style="text-align: center; padding: 20px; color: #EF4444;">❌ Failed to load agreement. (Code: ${res.code})</div>`;
        }
    } catch (err) {
        console.error('Failed to fetch platform agreement content:', err);
        titleEl.innerText = 'Error';
        bodyEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #EF4444;">❌ Error loading agreement content. Please try again.</div>';
    }
}

function closePlatformAgreementModal() {
    const modal = document.getElementById('platform-agreement-modal');
    if (modal) modal.classList.remove('active');
}

async function openInviteModal() {
    if (!currentUser) { openAuthModal(); return; }
    switchTab('invite');
}

function closeInviteModal() {
    switchTab('profile');
}

function copyProfileUid(event) {
    if (event) event.stopPropagation();
    const uidText = document.getElementById('profile-uid-text');
    if (!uidText) return;
    
    const uid = uidText.innerText.trim();
    if (!uid || uid === '--') return;
    
    navigator.clipboard.writeText(uid).then(() => {
        const msg = currentLocale === 'hi' ? `✓ UID ${uid} क्लिपबोर्ड पर कॉपी किया गया` : `✓ UID ${uid} copied to clipboard`;
        showToast(msg, false);
    }).catch(err => {
        console.error('Failed to copy UID:', err);
        showToast(currentLocale === 'hi' ? 'कॉपी करने में विफल' : 'Copy failed', true);
    });
}

async function checkAndOpenPaymentAccount() {
    if (!currentUser) { openAuthModal(); return; }
    window.paymentAccountReferrer = window.location.hash.includes('withdraw') ? 'withdraw' : 'profile';
    if (window.openPaymentAccountModal) {
        window.openPaymentAccountModal();
    }
}

async function verifyInviteCode(code) {
    const welcomeBox = document.getElementById('auth-invite-welcome');
    const warningBox = document.getElementById('auth-invite-warning');
    const nameEl = document.getElementById('invite-welcome-name');
    const uidEl = document.getElementById('invite-welcome-uid');
    const avatarEl = document.getElementById('invite-welcome-avatar');
    
    if (!code) return;
    
    try {
        const res = await apiFetch('GET', '/auth/referral-users/' + code, null, false);
        if (res.code === 200) {
            const user = res.result || res.data || {};
            if (nameEl) nameEl.textContent = user.nickname || 'Inviter';
            if (uidEl) uidEl.textContent = '(Code: ' + (user.referralCode || '--') + ')';
            if (avatarEl && user.nickname) {
                avatarEl.textContent = user.nickname.charAt(0).toUpperCase();
            }
            if (welcomeBox) welcomeBox.style.display = 'block';
            if (warningBox) warningBox.style.display = 'none';
        } else {
            if (welcomeBox) welcomeBox.style.display = 'none';
            if (warningBox) warningBox.style.display = 'block';
        }
    } catch (e) {
        console.error('Verify invite code error:', e);
    }
}

async function loadMyReferrer() {
    const boundBox = document.getElementById('referrer-bound-box');
    const unboundBox = document.getElementById('referrer-unbound-box');
    const nameEl = document.getElementById('bound-referrer-name');
    const previewEl = document.getElementById('bind-referrer-preview');
    const inputEl = document.getElementById('bind-referrer-input');
    
    if (previewEl) previewEl.style.display = 'none';
    if (inputEl) inputEl.value = '';
    
    if (!currentUser) {
        if (boundBox) boundBox.style.display = 'none';
        if (unboundBox) unboundBox.style.display = 'none';
        return;
    }
    
    try {
        const profileRes = await apiFetch('GET', '/users/info', null, true);
        if (profileRes.code === 200) {
            const user = profileRes.result || profileRes.data || {};
            const referrerId = user.referrerId || user.referrerUserId || user.parentUserId || user.parentInviteUserId || user.inviteUserId || user.inviterId;
            if (referrerId && String(referrerId) !== '0') {
                const refRes = await apiFetch('GET', '/users/referral-users/' + referrerId, null, true);
                if (refRes.code === 200) {
                    const refUser = refRes.result || refRes.data || {};
                    if (nameEl) nameEl.textContent = (refUser.nickname || 'Inviter') + ' (UID: ' + (refUser.uid || refUser.id || referrerId) + ')';
                    if (boundBox) boundBox.style.display = 'flex';
                    if (unboundBox) unboundBox.style.display = 'none';
                    return;
                }
                if (nameEl) nameEl.textContent = 'User ID: ' + referrerId;
                if (boundBox) boundBox.style.display = 'flex';
                if (unboundBox) unboundBox.style.display = 'none';
            } else {
                if (boundBox) boundBox.style.display = 'none';
                if (unboundBox) unboundBox.style.display = 'block';
            }
        }
    } catch(e) {
        console.error('Failed to load referrer:', e);
    }
}

function handleKycBannerClick() {
    if (!currentUser) {
        openAuthModal();
    } else {
        openKycModal();
    }
}

async function verifyAndBindReferrer() {
    const inputEl = document.getElementById('bind-referrer-input');
    if (!inputEl) return;
    const refId = inputEl.value.trim();
    if (!refId) {
        showToast(currentLocale === 'hi' ? 'कृपया आमंत्रणकर्ता उपयोगकर्ता आईडी दर्ज करें!' : 'Please enter inviter user ID!', true);
        return;
    }
    
    showToast(currentLocale === 'hi' ? 'आमंत्रितकर्ता की जानकारी सत्यापित की जा रही है...' : 'Verifying inviter information...', false);
    
    try {
        const refRes = await apiFetch('GET', '/users/referral-users/' + refId, null, true);
        const previewBox = document.getElementById('bind-referrer-preview');
        const previewName = document.getElementById('bound-referrer-name');
        
        if (refRes.code === 200) {
            const refUser = refRes.result || refRes.data || {};
            window.tempReferrerIdToBind = refId;
            window.tempReferrerCodeToBind = refUser.referralCode;
            if (previewName) previewName.textContent = (refUser.nickname || 'Inviter') + ' (UID: ' + (refUser.uid || refUser.id || refId) + ')';
            if (previewBox) previewBox.style.display = 'flex';
            showToast(t('invite_verify_success'), false);
        } else {
            showToast(refRes.errorMessage || t('invite_verify_fail'), true);
            if (previewBox) previewBox.style.display = 'none';
        }
    } catch(e) {
        console.error(e);
        showToast(t('invite_verify_error'), true);
    }
}

async function confirmBindReferrerSubmit() {
    if (!window.tempReferrerCodeToBind) return;
    
    showToast(t('invite_bind_submitting'), false);
    try {
        const rawBodyStr = stableStringify({ referralCode: window.tempReferrerCodeToBind });
        const res = await apiFetchWithRawBody('POST', '/users/bind-referral-user', rawBodyStr, true);
        
        if (res.code === 200) {
            showToast(t('invite_bind_success'), false);
            window.tempReferrerIdToBind = null;
            window.tempReferrerCodeToBind = null;
            loadMyReferrer();
        } else {
            showToast(res.errorMessage || t('invite_bind_fail'), true);
        }
    } catch (e) {
        console.error(e);
        showToast(t('invite_bind_error'), true);
    }
}

async function loadMyInvitees() {
    if (!currentUser) {
        const listEl = document.getElementById('profile-invitees-list');
        if (listEl) listEl.innerHTML = `<div style="text-align: center; padding: 25px; color: var(--text-secondary); font-size: 0.78rem;">${t('invite_err_login_required')}</div>`;
        const countEl = document.getElementById('profile-invitees-count');
        if (countEl) countEl.textContent = '0' + t('invite_unit_people');
        return;
    }
    
    try {
        const res = await apiFetch('GET', '/users/referrals?page=1&pageSize=1000', null, true);
        
        if (res.code === 200) {
            const list = res.result || res.data || [];
            
            const countEl = document.getElementById('profile-invitees-count');
            if (countEl) countEl.textContent = list.length + t('invite_unit_people');
            
            const inviteBadge = document.getElementById('profile-invite-count-badge');
            if (inviteBadge) {
                inviteBadge.innerText = `+${list.length}`;
            }
            
            const bubbleWrap = document.querySelector('.overlap-avatars');
            if (bubbleWrap && list.length > 0) {
                const colors = ['#5B51F9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#8B5CF6'];
                bubbleWrap.innerHTML = list.slice(0, 5).map((item, idx) => {
                    const nick = item.nickname || item.username || 'U';
                    const letter = nick.charAt(0).toUpperCase();
                    const bg = colors[idx % colors.length];
                    return `<div class="bubble-avatar" style="background-color: ${bg};">${letter}</div>`;
                }).join('');
            }
            
            const listEl = document.getElementById('profile-invitees-list');
            if (listEl) {
                if (list.length === 0) {
                    listEl.innerHTML = `
                        <div style="text-align: center; padding: 30px 10px; color: var(--text-secondary);">
                            <div style="font-size: 1.5rem; margin-bottom: 8px;">🚀</div>
                            <div style="font-size: 0.75rem; font-weight: 500;">${t('invite_empty_title')}</div>
                            <div style="font-size: 0.68rem; opacity: 0.7; margin-top: 3px;">${t('invite_empty_desc')}</div>
                        </div>
                    `;
                    return;
                }
                
                listEl.innerHTML = list.map(item => {
                    const nick = item.nickname || item.username || ('UID: ' + (item.uid || item.id));
                    const safeNick = nick.includes('*') ? nick : (nick.length > 11 ? nick.substring(0, 11) + '...' : nick);
                    const uid = item.uid || item.id || '--';
                    const colors = ['#5B51F9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#8B5CF6'];
                    const colorIdx = parseInt(uid) % colors.length;
                    const avatarBg = colors[isNaN(colorIdx) ? 0 : colorIdx];
                    const avatarLetter = nick.charAt(0).toUpperCase();
                    
                    let dateStr = '--';
                    if (item.createdAt) {
                        const d = new Date(parseInt(item.createdAt));
                        dateStr = d.toISOString().replace('T', ' ').substring(0, 10);
                    }
                    
                    const isEnabled = item.status === 'ENABLED';
                    const statusText = isEnabled ? t('invite_status_enabled') : t('invite_status_disabled');
                    const statusStyle = isEnabled 
                        ? 'background: rgba(16,185,129,0.1); color: #10B981;' 
                        : 'background: rgba(239,68,68,0.1); color: #EF4444;';
                    
                    return `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); transition: all 0.2s;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${avatarBg}; color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem;">
                                    ${avatarLetter}
                                </div>
                                <div style="text-align: left;">
                                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary);">${safeNick}</div>
                                    <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 2px;">${t('invite_register_prefix')}${dateStr}</div>
                                </div>
                            </div>
                            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                <span style="font-size: 0.68rem; color: var(--text-secondary); font-family: monospace; font-weight: 600;">UID: ${uid}</span>
                                <span style="font-size: 0.62rem; padding: 1px 6px; border-radius: 4px; font-weight: 700; ${statusStyle}">${statusText}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } else {
            const listEl = document.getElementById('profile-invitees-list');
            if (listEl) listEl.innerHTML = `<div style="text-align: center; padding: 25px; color: #EF4444; font-size: 0.75rem;">${t('invite_err_fetch_failed')} ${res.errorMessage || t('invite_status_disabled')}</div>`;
        }
    } catch (e) {
        console.error(e);
        const listEl = document.getElementById('profile-invitees-list');
        if (listEl) listEl.innerHTML = `<div style="text-align: center; padding: 25px; color: #EF4444; font-size: 0.75rem;">${t('invite_err_network')}</div>`;
    }
}

async function openSubordinatesModal() {
    if (!currentUser) { openAuthModal(); return; }
    switchTab('subordinates');
}

function closeSubordinatesModal() {
    switchTab('invite');
}

async function initInvitePage() {
    if (!currentUser) { openAuthModal(); return; }
    
    // Set loading placeholders
    const qrContainer = document.getElementById('invite-qr-container');
    const codeBox = document.getElementById('invite-code-display');
    const copyBtn = document.getElementById('btn-copy-invite-code');
    
    if (codeBox) codeBox.textContent = '...';
    
    try {
        const profileRes = await apiFetch('GET', '/users/info', null, true);
        if (profileRes.code === 200) {
            const user = profileRes.result || profileRes.data || {};
            const refCode = user.referralCode || user.uid || user.id || 'AI88888';
            
            // Save to localStorage
            localStorage.setItem('matp_user_referral_code', refCode);
            
            // Update invite code text box
            if (codeBox) codeBox.textContent = refCode;
            
            // Generate QR code with prefix 'MATP:referral:'
            const qrData = `MATP:referral:${refCode}`;
            if (qrContainer) {
                qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrData)}" style="width: 140px; height: 140px; border-radius: 8px;" alt="QR Code" />`;
                qrContainer.style.border = 'none'; // remove border style
            }
            
            // Update copy button click handler to copy the actual invite code dynamically
            if (copyBtn) {
                copyBtn.setAttribute('onclick', `navigator.clipboard.writeText('${refCode}'); showToast(t('invite_code_copied').replace('AI88888', '${refCode}'), false);`);
            }
        }
    } catch(e) {
        console.error('Failed to load user info for invite page:', e);
        // Fallback
        const refCode = localStorage.getItem('matp_user_referral_code') || 'AI88888';
        if (codeBox) codeBox.textContent = refCode;
        const qrData = `MATP:referral:${refCode}`;
        if (qrContainer) {
            qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrData)}" style="width: 140px; height: 140px; border-radius: 8px;" alt="QR Code" />`;
            qrContainer.style.border = 'none';
        }
        if (copyBtn) {
            copyBtn.setAttribute('onclick', `navigator.clipboard.writeText('${refCode}'); showToast(t('invite_code_copied').replace('AI88888', '${refCode}'), false);`);
        }
    }
}

async function initSubordinatesPage() {
    if (!currentUser) { openAuthModal(); return; }
    loadMyReferrer();
    loadMyInvitees();
}

function parseMarkdownToHtml(markdown) {
    if (!markdown) return '';
    let html = markdown;
    
    // Headings
    html = html.replace(/^### (.*$)/gim, '<h4 style="color: var(--text-primary); margin-top: 12px; font-weight: 700; font-size: 0.88rem;">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="color: var(--text-primary); margin-top: 16px; font-weight: 800; font-size: 0.95rem;">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 style="color: var(--text-primary); margin-top: 20px; font-weight: 900; font-size: 1.1rem;">$1</h2>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 4px solid var(--primary); padding-left: 10px; color: var(--text-secondary); margin: 10px 0; font-style: italic;">$1</blockquote>');
    
    // Unordered lists
    let lines = html.split('\n');
    let inList = false;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith('* ') || line.startsWith('- ')) {
            if (!inList) {
                lines[i] = '<ul style="padding-left: 20px; margin: 10px 0; list-style-type: disc;"><li>' + line.substring(2) + '</li>';
                inList = true;
            } else {
                lines[i] = '<li>' + line.substring(2) + '</li>';
            }
        } else {
            if (inList) {
                lines[i] = '</ul>' + lines[i];
                inList = false;
            }
        }
    }
    if (inList) {
        lines.push('</ul>');
    }
    html = lines.join('\n');
    
    // Paragraphs / Linebreaks
    html = html.replace(/\n/g, '<br>');
    return html;
}

function updateEyeIcons() {
    const eyeTotal = document.getElementById('eye-icon-total');
    const eyeAvail = document.getElementById('eye-icon-avail');
    
    const openEyeSvg = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    const closedEyeSvg = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>`;
    
    if (eyeTotal) {
        eyeTotal.innerHTML = isAssetValueVisible ? openEyeSvg : closedEyeSvg;
    }
    if (eyeAvail) {
        eyeAvail.innerHTML = isAssetValueVisible ? openEyeSvg : closedEyeSvg;
    }
}

function toggleAssetVisibility(event) {
    if (event) event.stopPropagation();
    isAssetValueVisible = !isAssetValueVisible;
    localStorage.setItem('matp_asset_value_visible', isAssetValueVisible);
    
    updateTotalValDisplay();
}

// --- GLOBAL WINDOW BINDINGS ---
window.updateEyeIcons = updateEyeIcons;
window.toggleAssetVisibility = toggleAssetVisibility;
window.copyProfileUid = copyProfileUid;
window.checkAndOpenPaymentAccount = checkAndOpenPaymentAccount;
window.verifyInviteCode = verifyInviteCode;
window.loadMyReferrer = loadMyReferrer;
window.verifyAndBindReferrer = verifyAndBindReferrer;
window.confirmBindReferrerSubmit = confirmBindReferrerSubmit;
window.loadMyInvitees = loadMyInvitees;
window.openSubordinatesModal = openSubordinatesModal;
window.closeSubordinatesModal = closeSubordinatesModal;
window.handleKycBannerClick = handleKycBannerClick;

window.openNotifyModal = openNotifyModal;
window.closeNotifyModal = closeNotifyModal;
window.openAcademyModal = openAcademyModal;
window.closeAcademyModal = closeAcademyModal;
window.openPlatformAgreementModal = openPlatformAgreementModal;
window.closePlatformAgreementModal = closePlatformAgreementModal;
window.openInviteModal = openInviteModal;
window.closeInviteModal = closeInviteModal;
window.initInvitePage = initInvitePage;
window.initSubordinatesPage = initSubordinatesPage;
