// User Session Authentication Controller
import { state } from '../modules/state.js?v=2.2.0';

function checkAuthSession() {
    const accessToken = localStorage.getItem('matp_access_token');
    const uid = localStorage.getItem('matp_user_uid');
    const nickname = localStorage.getItem('matp_user_nickname');
    const kycStatus = localStorage.getItem('matp_user_kyc') || 'NOT_VERIFIED';
    

    const homeLoginBanner = document.getElementById('home-login-banner');
    const vipBadge = document.getElementById('profile-vip-tag');
    const uidContainer = document.getElementById('profile-uid-container');
    const uidText = document.getElementById('profile-uid-text');
    
    if (accessToken) {
        currentUser = { uid: uid || '', nickname: nickname || '', kycStatus };
        
        // Hide login buttons, show dashboard profile info
        const displayNick = nickname || 'User';
        const nicknameEl = document.getElementById('profile-nickname');
        if (nicknameEl) {
            nicknameEl.removeAttribute('data-i18n'); // Prevent translation overwrite
            nicknameEl.innerHTML = `${displayNick} <span style="font-size:0.9rem; margin-left:6px; cursor:pointer;" onclick="changeNicknameManual(event)" title="Edit Nickname">✏️</span>`;
        }
        const avatarEl = document.getElementById('profile-avatar-letter');
        if (avatarEl) {
            avatarEl.innerText = displayNick.charAt(0).toUpperCase();
        }
        const logoutBoxEl = document.getElementById('profile-logout-box');
        if (logoutBoxEl) {
            logoutBoxEl.style.display = 'block';
        }
        if (uidContainer && uidText) {
            uidText.innerText = uid || '--';
            uidContainer.style.display = uid ? 'flex' : 'none';
        }
        
        if (homeLoginBanner) {
            if (kycStatus === 'VERIFIED') {
                homeLoginBanner.style.display = 'none';
            } else {
                homeLoginBanner.style.display = 'flex';
                const bannerTitle = document.getElementById('kyc-banner-title');
                const bannerDesc = document.getElementById('kyc-banner-desc');
                const bannerBtn = document.getElementById('kyc-banner-btn');
                if (bannerTitle) bannerTitle.setAttribute('data-i18n', 'kyc_banner_title');
                if (bannerDesc) bannerDesc.setAttribute('data-i18n', 'kyc_banner_desc');
                if (bannerBtn) bannerBtn.setAttribute('data-i18n', 'kyc_banner_btn');
                if (window.applyTranslations) window.applyTranslations();
            }
        }
        if (vipBadge) vipBadge.style.display = 'inline-block';
        
        syncKycUI(kycStatus);
        
        loadUserAssets();
        loadQuantConfig();
        loadQuantOrders();
        loadWatchlist();
        
        listenToBizEvents();
        syncKycStatusFromServer();
        syncUserInfoFromServer();
        
        // 激活 60 秒轻量资产轮询定时器
        if (!assetPollInterval) {
            assetPollInterval = setInterval(() => {
                if (currentUser) {
                    loadUserAssets();
                }
            }, 60000);
        }
    } else {
        currentUser = null;
        
        // 登出或未登录状态下，清除并销毁资产轮询器
        if (assetPollInterval) {
            clearInterval(assetPollInterval);
            assetPollInterval = null;
        }
        watchlist = [];
        const guestText = currentLocale === 'hi' ? 'अतिथि' : 'Guest';
        const loginActionText = currentLocale === 'hi' ? 'लॉग इन / रजिस्टर' : 'Sign In / Register';
        
        const nicknameEl = document.getElementById('profile-nickname');
        if (nicknameEl) {
            nicknameEl.setAttribute('data-i18n', 'profile_nickname_guest');
            nicknameEl.innerHTML = `${guestText} <span style="font-size:0.7rem; font-weight:normal; background:rgba(255,255,255,0.22); padding:3px 8px; border-radius:6px; margin-left:6px; cursor:pointer;" onclick="openAuthModal()">${loginActionText}</span>`;
        }
        const avatarEl = document.getElementById('profile-avatar-letter');
        if (avatarEl) {
            avatarEl.innerText = '?';
        }
        const logoutBoxEl = document.getElementById('profile-logout-box');
        if (logoutBoxEl) {
            logoutBoxEl.style.display = 'none';
        }
        if (uidContainer) {
            uidContainer.style.display = 'none';
        }
        
        if (homeLoginBanner) {
            homeLoginBanner.style.display = 'flex';
            const bannerTitle = document.getElementById('kyc-banner-title');
            const bannerDesc = document.getElementById('kyc-banner-desc');
            const bannerBtn = document.getElementById('kyc-banner-btn');
            if (bannerTitle) bannerTitle.setAttribute('data-i18n', 'home_guest_title');
            if (bannerDesc) bannerDesc.setAttribute('data-i18n', 'home_guest_desc');
            if (bannerBtn) bannerBtn.setAttribute('data-i18n', 'home_guest_btn');
            if (window.applyTranslations) window.applyTranslations();
        }
        if (vipBadge) vipBadge.style.display = 'none';
        
        // Dynamically populate guest login warning
        loadQuantOrders();
        
        syncKycUI('NONE');
    }
}

async function syncUserInfoFromServer() {
    const accessToken = localStorage.getItem('matp_access_token');
    if (!accessToken) return;
    try {
        const profileRes = await apiFetch('GET', '/users/info', null, true);
        if (profileRes.code === 200) {
            const user = profileRes.result || profileRes.data || {};
            const nick = user.nickname || '';
            const freshUid = user.uid || user.id || '';
            const kyc = user.kycStatus || 'NOT_VERIFIED';
            
            localStorage.setItem('matp_user_uid', freshUid);
            localStorage.setItem('matp_user_nickname', nick);
            localStorage.setItem('matp_user_kyc', kyc);
            
            if (window.currentUser) {
                window.currentUser.uid = freshUid;
                window.currentUser.nickname = nick;
                window.currentUser.kycStatus = kyc;
            }
            
            // Update profile nickname dynamically in the DOM
            const nicknameEl = document.getElementById('profile-nickname');
            if (nicknameEl) {
                nicknameEl.removeAttribute('data-i18n'); // Prevent translation overwrite
                nicknameEl.innerHTML = `${nick || 'User'} <span style="font-size:0.9rem; margin-left:6px; cursor:pointer;" onclick="changeNicknameManual(event)" title="Edit Nickname">✏️</span>`;
            }
            const avatarEl = document.getElementById('profile-avatar-letter');
            if (avatarEl && nick) {
                avatarEl.innerText = nick.charAt(0).toUpperCase();
            }
            const uidContainer = document.getElementById('profile-uid-container');
            const uidText = document.getElementById('profile-uid-text');
            if (uidContainer && uidText) {
                uidText.innerText = freshUid;
                uidContainer.style.display = 'flex';
            }
            syncKycUI(kyc);
        }
    } catch(e) {
        console.error('Failed to sync user info from server:', e);
    }
}
window.syncUserInfoFromServer = syncUserInfoFromServer;

async function syncKycStatusFromServer() {
    if (!currentUser) return;
    try {
        const res = await apiFetch('GET', '/users/kyc/info', null, true);
        if (res.code === 200 && (res.result || res.data)) {
            const record = res.result || res.data;
            let finalStatus = 'NOT_VERIFIED';
            if (record.status === 'NOT_VERIFIED') finalStatus = 'PENDING';
            else if (record.status === 'VERIFIED') finalStatus = 'VERIFIED';
            else if (record.status === 'REFUSED') finalStatus = 'REFUSED';
            
            currentUser.kycStatus = finalStatus;
            localStorage.setItem('matp_user_kyc', finalStatus);
            syncKycUI(finalStatus);
        } else if (res.code === 11001001 || res.code === 404) {
            currentUser.kycStatus = 'NOT_VERIFIED';
            localStorage.setItem('matp_user_kyc', 'NOT_VERIFIED');
            syncKycUI('NOT_VERIFIED');
        }
    } catch(e) {
        console.error('Failed to sync KYC status from server:', e);
    }
}

function syncKycUI(status) {
    const kycTextEl = document.getElementById('profile-kyc-text');
    const kycIconEl = document.getElementById('profile-kyc-check-icon');
    
    // Also support fallback for old profile-kyc-badge just in case
    const pKycEl = document.getElementById('profile-kyc-badge');
    if (pKycEl) {
        pKycEl.className = 'kyc-badge-status';
        if (status === 'VERIFIED') {
            pKycEl.innerText = currentLocale === 'hi' ? 'सत्यापित' : 'Verified';
            pKycEl.classList.add('kyc-status-VERIFIED');
        } else if (status === 'PENDING') {
            pKycEl.innerText = currentLocale === 'hi' ? 'समीक्षाधीन' : 'Pending';
            pKycEl.classList.add('kyc-status-PENDING');
        } else {
            pKycEl.innerText = currentLocale === 'hi' ? 'असत्यापित' : 'Unverified';
            pKycEl.classList.add('kyc-status-NONE');
        }
    }
    
    if (!kycTextEl) return;
    
    if (status === 'VERIFIED') {
        kycTextEl.removeAttribute('data-i18n'); // Prevent translation overwrite
        kycTextEl.innerText = currentLocale === 'hi' ? 'सत्यापित' : 'Verified';
        kycTextEl.className = 'menu-status-text text-verified';
        kycTextEl.style.color = ''; // reset inline
        if (kycIconEl) {
            kycIconEl.className = 'kyc-check-circle green-check';
            kycIconEl.style.backgroundColor = ''; // reset inline
        }
    } else if (status === 'PENDING') {
        kycTextEl.removeAttribute('data-i18n'); // Prevent translation overwrite
        kycTextEl.innerText = currentLocale === 'hi' ? 'समीक्षाधीन' : 'Pending';
        kycTextEl.className = 'menu-status-text';
        kycTextEl.style.color = '#F59E0B'; // orange
        if (kycIconEl) {
            kycIconEl.className = 'kyc-check-circle';
            kycIconEl.style.backgroundColor = '#F59E0B'; // orange
        }
    } else if (status === 'REFUSED') {
        kycTextEl.removeAttribute('data-i18n'); // Prevent translation overwrite
        kycTextEl.innerText = currentLocale === 'hi' ? 'अस्वीकृत' : 'Refused';
        kycTextEl.className = 'menu-status-text';
        kycTextEl.style.color = '#EF4444'; // red
        if (kycIconEl) {
            kycIconEl.className = 'kyc-check-circle';
            kycIconEl.style.backgroundColor = '#EF4444'; // red
        }
    } else {
        kycTextEl.setAttribute('data-i18n', 'profile_kyc_unverified'); // Restore translation key
        kycTextEl.innerText = currentLocale === 'hi' ? 'असत्यापित' : 'Unverified';
        kycTextEl.className = 'menu-status-text text-unverified';
        kycTextEl.style.color = ''; // reset inline
        if (kycIconEl) {
            kycIconEl.className = 'kyc-check-circle gray-check';
            kycIconEl.style.backgroundColor = ''; // reset inline
        }
    }
}


// --- USER ASSET WALLET SYNCRONIZER ---
// --- USER ASSET WALLET SYNCRONIZER ---
async function openAuthModal() {
    await ensureModalLoaded('auth-modal');
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('active');
    closeAuthOtpSheet();
}
function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
    closeAuthOtpSheet();
}

function openAuthOtpSheet() {
    const overlay = document.getElementById('auth-otp-sheet-overlay');
    if (overlay) overlay.classList.add('active');
    const sheet = document.getElementById('auth-otp-sheet');
    if (sheet) sheet.classList.add('active');
}
function closeAuthOtpSheet() {
    const overlay = document.getElementById('auth-otp-sheet-overlay');
    if (overlay) overlay.classList.remove('active');
    const sheet = document.getElementById('auth-otp-sheet');
    if (sheet) sheet.classList.remove('active');
}

function toggleAuthLangDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('auth-lang-dropdown');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

function changeAuthLanguage(locale, event) {
    changeAppLanguage(locale, event);
    const menu = document.getElementById('auth-lang-dropdown');
    if (menu) {
        menu.style.display = 'none';
    }
}

// Close language dropdown if clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('auth-lang-dropdown');
    if (dropdown && dropdown.style.display === 'block') {
        const btn = document.querySelector('.auth-lang-btn');
        if (btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    }
});

function getNormalizedPhone() {
    let phone = document.getElementById('auth-phone').value.trim();
    if (!phone) return '';
    phone = phone.replace(/[^\d+]/g, '');
    if (!phone.startsWith('+')) {
        if (phone.startsWith('91') && phone.length === 12) {
            phone = '+' + phone;
        } else {
            phone = '+91' + phone;
        }
    }
    return phone;
}

let otpCountdownTimer = null;

async function handleSendOTP() {
    const normalizedPhone = getNormalizedPhone();
    if (!normalizedPhone || normalizedPhone.length < 10) {
        const phoneErr = currentLocale === 'hi' ? 'कृपया एक वैध फ़ोन नंबर दर्ज करें!' : 'Please enter a valid phone number!';
        showToast(phoneErr, true);
        return;
    }
    
    const proceedBtn = document.querySelector('#auth-step-phone .auth-primary-btn');
    const resendBtn = document.getElementById('auth-otp-resend-btn');
    const timerText = document.getElementById('auth-otp-timer-text');
    
    if (proceedBtn) {
        proceedBtn.disabled = true;
        proceedBtn.innerText = currentLocale === 'hi' ? 'भेजा जा रहा है...' : 'Sending...';
    }
    if (resendBtn) {
        resendBtn.disabled = true;
    }
    
    try {
        const res = await apiFetch('POST', '/auth/otp/send', { phone: normalizedPhone }, false);
        if (res.code === 200) {
            showToast(currentLocale === 'hi' ? '📱 सत्यापन कोड सफलतापूर्वक एसएमएस गेटवे पर भेज दिया गया है!' : '📱 Verification code successfully sent to SMS gateway!', false);
            
            let formattedPhone = normalizedPhone;
            if (normalizedPhone.startsWith('+91') && normalizedPhone.length === 13) {
                formattedPhone = '+91 ' + normalizedPhone.substring(3, 8) + ' ' + normalizedPhone.substring(8);
            }
            const targetPhoneEl = document.getElementById('auth-otp-target-phone');
            if (targetPhoneEl) {
                targetPhoneEl.innerText = formattedPhone;
            }
            
            if (otpCountdownTimer) {
                clearInterval(otpCountdownTimer);
            }
            
            let cd = 59;
            const countdownEl = document.getElementById('auth-otp-countdown');
            if (countdownEl) {
                countdownEl.innerText = cd;
            }
            if (timerText) {
                timerText.style.display = 'block';
            }
            if (resendBtn) {
                resendBtn.style.display = 'none';
            }
            
            openAuthOtpSheet();
            
            otpCountdownTimer = setInterval(() => {
                cd--;
                if (cd <= 0) {
                    clearInterval(otpCountdownTimer);
                    otpCountdownTimer = null;
                    if (timerText) {
                        timerText.style.display = 'none';
                    }
                    if (resendBtn) {
                        resendBtn.style.display = 'block';
                        resendBtn.disabled = false;
                    }
                } else {
                    if (countdownEl) {
                        countdownEl.innerText = cd;
                    }
                }
            }, 1000);
            
        } else {
            showToast(res.errorMessage || (currentLocale === 'hi' ? 'भेजने में विफल!' : 'Send failed!'), true);
        }
    } catch(e) {
        showToast(currentLocale === 'hi' ? 'नेटवर्क अपवाद!' : 'Network exception!', true);
    } finally {
        if (proceedBtn) {
            proceedBtn.disabled = false;
            proceedBtn.innerText = currentLocale === 'hi' ? 'आगे बढ़ें' : 'Proceed';
        }
        if (resendBtn) {
            resendBtn.disabled = false;
        }
    }
}

async function submitAuthPhoneStep() {
    await handleSendOTP();
}

async function handleAuthSubmit(event) {
    if (event) event.preventDefault();
    const normalizedPhone = getNormalizedPhone();
    const code = document.getElementById('auth-code').value.trim();
    
    if (!normalizedPhone || !code) return;
    
    const verifyBtn = document.querySelector('#auth-otp-sheet .auth-primary-btn');
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerText = currentLocale === 'hi' ? 'सत्यापन हो रहा है...' : 'Verifying...';
    }
    
    try {
        const inviteCodeInput = document.getElementById('auth-invite-code');
        const referralCode = inviteCodeInput ? inviteCodeInput.value.trim() : '';
        const loginPayload = { phone: normalizedPhone, code: code, channel: 'SMS' };
        if (referralCode) {
            loginPayload.referralCode = referralCode;
        }
        const res = await apiFetch('POST', '/auth/otp/login', loginPayload, false);
        if (res.code === 200) {
            const data = res.result || res.data;
            localStorage.setItem('matp_access_token', data.accessToken);
            localStorage.setItem('matp_session_key', data.sessionKey);
            localStorage.setItem('matp_user_clean_phone', normalizedPhone);
            
            const profileRes = await apiFetch('GET', '/users/info', null, true);
            if (profileRes.code === 200) {
                const user = profileRes.result || profileRes.data || {};
                const rawNick = user.nickname || '';
                const INVALID_NICKS = ['invalid user', 'invalid', 'unknown', 'null', 'undefined', ''];
                const needsNicknameUpdate = INVALID_NICKS.includes(rawNick.toLowerCase()) || 
                                           rawNick.includes('*') || 
                                           /^[a-zA-Z0-9]{10}$/.test(rawNick) || 
                                           rawNick !== normalizedPhone;
                
                if (needsNicknameUpdate) {
                    const newNickname = normalizedPhone;
                    try {
                        await apiFetch('POST', '/users/update-nickname', { nickname: newNickname }, true);
                    } catch(e) {}
                }
                
                const displayName = needsNicknameUpdate ? normalizedPhone : rawNick;
                localStorage.setItem('matp_user_uid', user.uid || user.id || '');
                localStorage.setItem('matp_user_nickname', displayName);
                localStorage.setItem('matp_user_email', user.username || normalizedPhone);
                localStorage.setItem('matp_user_kyc', user.kycStatus || 'NOT_VERIFIED');
                
                document.getElementById('auth-phone').value = '';
                document.getElementById('auth-code').value = '';
                
                closeAuthModal();
                checkAuthSession();
                showToast(currentLocale === 'hi' ? `👋 वापस स्वागत है, सम्मानित मात्रात्मक व्यापारी ${displayName}!` : `👋 Welcome back, distinguished quantitative trader ${displayName}!`, false);
            } else {
                try {
                    await apiFetch('POST', '/users/update-nickname', { nickname: normalizedPhone }, true);
                } catch(e) {}
                localStorage.setItem('matp_user_uid', '');
                localStorage.setItem('matp_user_nickname', normalizedPhone);
                localStorage.setItem('matp_user_email', normalizedPhone);
                localStorage.setItem('matp_user_kyc', 'NOT_VERIFIED');
                
                document.getElementById('auth-phone').value = '';
                document.getElementById('auth-code').value = '';
                
                closeAuthModal();
                checkAuthSession();
                showToast(currentLocale === 'hi' ? `👋 वापस स्वागत है!` : `👋 Welcome back!`, false);
            }
        } else {
            showToast(res.errorMessage || (currentLocale === 'hi' ? 'अमान्य सत्यापन कोड!' : 'Invalid verification code!'), true);
        }
    } catch(e) {
        showToast(currentLocale === 'hi' ? 'लॉगिन network अनुरोध विफल!' : 'Login network request failed!', true);
    } finally {
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.innerText = currentLocale === 'hi' ? 'सत्यापित करें' : 'Verify';
        }
    }
}

function handleLogout() {
    localStorage.removeItem('matp_access_token');
    localStorage.removeItem('matp_session_key');
    localStorage.removeItem('matp_user_uid');
    localStorage.removeItem('matp_user_nickname');
    localStorage.removeItem('matp_user_email');
    localStorage.removeItem('matp_user_kyc');
    localStorage.removeItem('matp_user_clean_phone');
    
    currentUser = null;
    checkAuthSession();
    showToast(currentLocale === 'hi' ? 'आपने एआई ट्रेडिंग खाता सफलतापूर्वक लॉग आउट कर दिया है।' : 'You have successfully logged out of your AI Trading account.', false);
    switchTab('home');
}

async function changeNicknameManual(event) {
    if (event) event.stopPropagation();
    if (!currentUser) { openAuthModal(); return; }
    
    const oldNick = localStorage.getItem('matp_user_nickname') || '';
    const newNick = prompt(currentLocale === 'hi' ? '✏️ निकनेम बदलें:\nकृपया नया निकनेम दर्ज करें जिसे आप सेट करना चाहते हैं:' : '✏️ Edit Nickname:\nPlease enter the new nickname you want to set:', oldNick);
    if (newNick === null) return; // User cancelled
    const cleanNick = newNick.trim();
    if (!cleanNick) {
        showToast(currentLocale === 'hi' ? 'निकनेम खाली नहीं हो सकता!' : 'Nickname cannot be empty!', true);
        return;
    }
    
    showToast(currentLocale === 'hi' ? 'निकनेम अपडेट किया जा रहा है...' : 'Updating nickname...', false);
    try {
        const res = await apiFetch('POST', '/users/update-nickname', { nickname: cleanNick }, true);
        if (res.code === 200) {
            localStorage.setItem('matp_user_nickname', cleanNick);
            if (window.currentUser) {
                window.currentUser.nickname = cleanNick;
            }
            checkAuthSession();
            showToast(currentLocale === 'hi' ? '✓ निकनेम सफलतापूर्वक अपडेट किया गया!' : '✓ Nickname updated successfully!', false);
        } else {
            showToast(res.errorMessage || (currentLocale === 'hi' ? 'निकनेम अपडेट विफल' : 'Nickname update failed'), true);
        }
    } catch(e) {
        console.error(e);
        showToast(currentLocale === 'hi' ? 'नेटवर्क त्रुटि!' : 'Network error!', true);
    }
}
window.changeNicknameManual = changeNicknameManual;

// APP Download Modal controls
function getCookieDomain() {
    const host = window.location.hostname;
    const parts = host.split('.');
    if (parts.length >= 2) {
        if (host === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
            return '';
        }
        return '.' + parts.slice(-2).join('.');
    }
    return '';
}
function getSharedCookie(name) {
    const matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : '';
}
async function openAppDownloadModal() {
    await ensureModalLoaded('app-download-modal');
    const androidLink = getSharedCookie('app_download_android') || localStorage.getItem('app_download_android') || '';
    const iosLink = getSharedCookie('app_download_ios') || localStorage.getItem('app_download_ios') || '';
    
    const androidBtn = document.getElementById('download-android-btn');
    const iosBtn = document.getElementById('download-ios-btn');
    
    if (androidBtn) {
        if (androidLink) {
            androidBtn.href = androidLink;
            androidBtn.onclick = null;
        } else {
            androidBtn.href = 'javascript:void(0)';
            androidBtn.onclick = () => {
                const msg = currentLocale === 'hi' 
                    ? '⚠️ डाउनलोड लिंक अभी तक कॉन्फ़िगर नहीं किया गया है!' 
                    : '⚠️ Android download link is not configured yet!';
                showToast(msg, true);
            };
        }
    }
    
    if (iosBtn) {
        if (iosLink) {
            iosBtn.href = iosLink;
            iosBtn.onclick = null;
        } else {
            iosBtn.href = 'javascript:void(0)';
            iosBtn.onclick = () => {
                const msg = currentLocale === 'hi' 
                    ? '⚠️ डाउनलोड लिंक अभी तक कॉन्फ़िगर नहीं किया गया है!' 
                    : '⚠️ iOS download link is not configured yet!';
                showToast(msg, true);
            };
        }
    }

    const modal = document.getElementById('app-download-modal');
    if (modal) modal.classList.add('active');
}
function closeAppDownloadModal() {
    const modal = document.getElementById('app-download-modal');
    if (modal) modal.classList.remove('active');
}

// KYC Modal controls

window.checkAuthSession = checkAuthSession;
window.syncKycStatusFromServer = syncKycStatusFromServer;
window.syncKycUI = syncKycUI;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.openAuthOtpSheet = openAuthOtpSheet;
window.closeAuthOtpSheet = closeAuthOtpSheet;
window.toggleAuthLangDropdown = toggleAuthLangDropdown;
window.changeAuthLanguage = changeAuthLanguage;
window.handleSendOTP = handleSendOTP;
window.handleAuthSubmit = handleAuthSubmit;
window.handleLogout = handleLogout;
window.changeNicknameManual = changeNicknameManual;
window.openAppDownloadModal = openAppDownloadModal;
window.closeAppDownloadModal = closeAppDownloadModal;
window.submitAuthPhoneStep = submitAuthPhoneStep;
