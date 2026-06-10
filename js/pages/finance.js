// Finance Payments (Deposits, Withdrawals, Account Bindings) Controller
import { state } from '../modules/state.js?v=2.2.0';

let currentPaymentMethods = [];

function closeDepositModal() {
    switchTab('profile');
}

function closeWithdrawModal() {
    switchTab('profile');
}

function copyFiatValue(elementId, label) {
    const val = document.getElementById(elementId).value;
    if (!val) return;
    navigator.clipboard.writeText(val);
    showToast(currentLocale === 'hi' ? `✓ जमा ${label} क्लिपबोर्ड पर कॉपी किया गया!` : `✓ Deposit ${label} copied to clipboard!`, false);
}

async function openDepositModal() {
    if (!currentUser) { openAuthModal(); return; }
    
    // Check cached kyc status first (instant check)
    const cachedKyc = localStorage.getItem('matp_user_kyc') || 'NOT_VERIFIED';
    if (cachedKyc !== 'VERIFIED') {
        if (cachedKyc === 'PENDING') {
            showToast(currentLocale === 'hi' ? '⚠️ आपका केवाईसी सत्यापन समीक्षाधीन है, कृपया जमा करने से पहले समीक्षा पूरी होने की प्रतीक्षा करें!' : '⚠️ Your KYC verification is under review, please wait for approval before depositing!', true);
            return;
        } else {
            showToast(currentLocale === 'hi' ? '⚠️ जमा और धन संचालन करने से पहले आपको केवाईसी पूरा करना होगा और स्वीकृत होना होगा!' : '⚠️ You need to complete KYC verification and be approved before depositing!', true);
            setTimeout(() => {
                openKycModal();
            }, 1500);
            return;
        }
    }
    
    if (!document.getElementById('deposit-amount')) {
        switchTab('deposit');
        return;
    }
    
    // Set default deposit amount (none by default as per request) and remittance tracking code
    document.getElementById('deposit-amount').value = '';
    document.getElementById('deposit-remittance-code').value = '';
    
    // Render Loading and Open Modal Overlay instantly
    const container = document.getElementById('deposit-channels-container');
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 0.85rem;">${currentLocale === 'hi' ? '🔄 उपलब्ध जमा चैनलों को प्राप्त किया जा रहा है...' : '🔄 Fetching available deposit channels...'}</div>`;
    document.getElementById('deposit-channel-details').style.display = 'none';
    document.getElementById('selected-payment-method-asset-id').value = '';
    
    switchTab('deposit');
    
    // Sync latest exchange rates from backend (non-blocking)
    syncExchangeRates();
    
    // Run the remaining verification and network load in the background
    (async () => {
        let kycStatus = cachedKyc;
        // Proactively fetch latest user info to sync KYC status and prevent 11001006 Invalid User compliance failure
        try {
            const profileRes = await apiFetch('GET', '/users/info', null, true);
            if (profileRes.code === 200) {
                const user = profileRes.result || profileRes.data || {};
                kycStatus = user.kycStatus || 'NOT_VERIFIED';
                localStorage.setItem('matp_user_kyc', kycStatus);
                if (window.currentUser) {
                    window.currentUser.kycStatus = kycStatus;
                }
            }
        } catch (e) {
            console.error('Failed to sync KYC status before deposit:', e);
        }

        if (kycStatus !== 'VERIFIED') {
            if (kycStatus === 'PENDING') {
                showToast(currentLocale === 'hi' ? '⚠️ आपका केवाईसी सत्यापन समीक्षाधीन है, कृपया जमा करने से पहले समीक्षा पूरी होने की प्रतीक्षा करें!' : '⚠️ Your KYC verification is under review, please wait for approval before depositing!', true);
            } else {
                showToast(currentLocale === 'hi' ? '⚠️ जमा और धन संचालन करने से पहले आपको केवाईसी पूरा करना होगा और स्वीकृत होना होगा!' : '⚠️ You need to complete KYC verification and be approved before depositing!', true);
                setTimeout(() => {
                    openKycModal();
                }, 1500);
            }
            switchTab('profile');
            return;
        }
        
        // Proactively check if nickname needs an update and correct it right before deposit setup
        const nickname = localStorage.getItem('matp_user_nickname') || '';
        let phone = localStorage.getItem('matp_user_clean_phone') || '';
        if (!phone || phone.includes('*')) {
            const fallbackPhone = localStorage.getItem('matp_user_email') || '';
            if (fallbackPhone.includes('*') || !fallbackPhone) {
                const userFormPhone = prompt(currentLocale === 'hi' ? '🔒 सुरक्षा अंशांकन:\nजमा सुरक्षा सुविधाओं को बाध्य करने के लिए कृपया अपना पूरा मोबाइल नंबर दर्ज करें:' : '🔒 Security Calibration:\nPlease enter your full mobile number to bind deposit security features:', '');
                if (!userFormPhone) {
                    showToast(currentLocale === 'hi' ? '⚠️ जमा पहचान सत्यापन विफल!' : '⚠️ Deposit identity verification failed!', true);
                    switchTab('profile');
                    return;
                }
                phone = userFormPhone.trim();
                if (!/^\d{8,15}$/.test(phone)) {
                    showToast(currentLocale === 'hi' ? '⚠️ कृपया एक वैध मोबाइल नंबर दर्ज करें!' : '⚠️ Please enter a valid mobile number!', true);
                    switchTab('profile');
                    return;
                }
                localStorage.setItem('matp_user_clean_phone', phone);
            } else {
                phone = fallbackPhone;
                localStorage.setItem('matp_user_clean_phone', phone);
            }
        }
        const INVALID_NICKS = ['invalid user', 'invalid', 'unknown', 'null', 'undefined', ''];
        if (INVALID_NICKS.includes(nickname.toLowerCase()) || nickname.includes('*') || /^[a-zA-Z0-9]{10}$/.test(nickname) || (phone && nickname !== phone)) {
            showToast(currentLocale === 'hi' ? '⚙️ आपके लिए जमा सुरक्षा सुविधाओं को स्वचालित रूप से कैलिब्रेट किया जा रहा है...' : '⚙️ Automatically calibrating deposit security features for you...', false);
            try {
                const updateRes = await apiFetch('POST', '/users/update-nickname', { nickname: phone }, true);
                if (updateRes.code === 200) {
                    localStorage.setItem('matp_user_nickname', phone);
                    if (window.currentUser) {
                        window.currentUser.nickname = phone;
                    }
                    const nickEl = document.getElementById('profile-nickname');
                    if (nickEl) nickEl.innerText = phone;
                    const avatarLetterEl = document.getElementById('profile-avatar-letter');
                    if (avatarLetterEl) avatarLetterEl.innerText = phone.charAt(0).toUpperCase();
                    showToast(currentLocale === 'hi' ? '✓ जमा सुरक्षा विशेषताएं अंशांकित, जमा करना शुरू करें!' : '✓ Deposit security features calibrated, start depositing!', false);
                }
            } catch (e) {
                console.error('Failed to proactively correct nickname before deposit:', e);
            }
        }
        
        // Dynamically Fetch and Load Deposit Channels
        try {
            const methodsRaw = await apiFetchRaw('GET', '/finance/payments/methods', null, true);
            const methodsRes = JSON.parse(methodsRaw);
            if (methodsRes.code === 200) {
                const list = methodsRes.result || methodsRes.data || [];
                // Sort by orderIndex in ascending order (sorting weight)
                currentPaymentMethods = list.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
                
                if (currentPaymentMethods.length === 0) {
                    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #EF4444; font-size: 0.85rem;">${currentLocale === 'hi' ? '⚠️ कोई जमा चैनल उपलब्ध नहीं है।' : '⚠️ No deposit channels available.'}</div>`;
                    return;
                }
                
                // Safe parser for BigInt identifiers in raw payload to prevent precision loss
                const rawMethodsArr = methodsRaw.match(/\{[^}]+"paymentMethodAssetId"\s*:\s*(\d+)/g) || [];
                currentPaymentMethods.forEach((m, idx) => {
                    let actualAssetId = String(m.paymentMethodAssetId);
                    if (rawMethodsArr[idx]) {
                        const match = rawMethodsArr[idx].match(/"paymentMethodAssetId"\s*:\s*(\d+)/);
                        if (match) actualAssetId = match[1];
                    }
                    m.paymentMethodAssetIdRawStr = actualAssetId; // Cache clean raw string BigInt
                });
                
                // Build card-list interface dynamically
                container.innerHTML = currentPaymentMethods.map((m, idx) => {
                    const isSelected = idx === 0;
                    const borderStyle = isSelected ? '2px solid var(--primary)' : '1px solid rgba(0,0,0,0.08)';
                    const bgStyle = isSelected ? 'rgba(91,81,249,0.04)' : '#FFF';
                    const shadowStyle = isSelected ? '0 4px 12px rgba(91,81,249,0.08)' : 'none';
                    const checkIcon = isSelected ? '✓' : '';
                    const checkBorder = isSelected ? 'var(--primary)' : 'rgba(0,0,0,0.2)';
                    const checkBg = isSelected ? 'var(--primary)' : 'transparent';
                    
                    // Disaster recovery for garbled names/descriptions in DB (e.g. "?????" for FIAT)
                    let displayName = m.name;
                    if (!displayName || displayName.includes('?') || displayName === 'null') {
                        if (m.assetClass === 'FIAT') {
                            displayName = currentLocale === 'hi' ? `फ़िएट गेटवे रैपिड क्लीयरेंस (${m.asset?.symbol || 'USD'})` : `Fiat Gateway Rapid Clearance (${m.asset?.symbol || 'USD'})`;
                        } else {
                            displayName = m.name || (currentLocale === 'hi' ? 'क्रिप्टोकरेंसी जमा चैनल' : 'Cryptocurrency Deposit Channel');
                        }
                    }
                    
                    let displayDesc = m.description;
                    if (!displayDesc || displayDesc.includes('?') || displayDesc === 'null') {
                        if (m.assetClass === 'FIAT') {
                            displayDesc = currentLocale === 'hi' ? 'नेट बैंकिंग/काउंटर and अन्य फ़िएट चैनलों के माध्यम से बड़े जमा क्लीयरेंस का समर्थन करता है' : 'Supports large deposit clearance through net banking/counter and other fiat channels';
                        } else {
                            displayDesc = currentLocale === 'hi' ? 'ब्लॉकचेन नेटवर्क के माध्यम से त्वरित जमा क्लीयरेंस का समर्थन करता है' : 'Supports instant deposit clearance through blockchain network';
                        }
                    }
                    
                    const methodBadge = m.assetClass === 'FIAT' ? (m.asset?.symbol || 'FIAT') : (m.target?.network || 'USDT');
                    
                    return `
                        <div class="channel-card-item" id="channel-card-${idx}" onclick="selectDepositChannel(${idx})" style="display: flex; align-items: center; justify-content: space-between; border: ${borderStyle}; background: ${bgStyle}; box-shadow: ${shadowStyle}; padding: 12px 15px; border-radius: 10px; cursor: pointer; transition: all 0.2s;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <img src="${m.asset?.logo || 'https://storage.googleapis.com/matpcs-dev/uploads/images/9093375a-4ead-4f93-818a-14a91cfe7370.png'}" style="width: 26px; height: 26px; border-radius: 5px; object-fit: contain;">
                                <div style="text-align: left;">
                                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${displayName}</div>
                                    <div style="font-size: 0.72rem; color: var(--text-secondary);">${displayDesc}</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.72rem; background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary); font-family: monospace;">${methodBadge}</span>
                                <div class="channel-check" id="channel-check-${idx}" style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid ${checkBorder}; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; color: #FFF; background: ${checkBg};">${checkIcon}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                selectDepositChannel(0);
            } else {
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: #EF4444; font-size: 0.85rem;">${currentLocale === 'hi' ? '⚠️ जमा चैनल प्राप्त करने में विफल:' : '⚠️ Failed to load deposit channels:'} ${methodsRes.errorMessage || ''}</div>`;
            }
        } catch (e) {
            console.error('Failed to load deposit channels:', e);
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: #EF4444; font-size: 0.85rem;">${currentLocale === 'hi' ? '⚠️ जमा चैनल लोड करते समय नेटवर्क अपवाद!' : '⚠️ Network exception loading deposit channels!'}</div>`;
        }
    })();
}

function selectDepositChannel(idx) {
    if (!currentPaymentMethods || idx >= currentPaymentMethods.length) return;
    
    currentPaymentMethods.forEach((m, i) => {
        const card = document.getElementById(`channel-card-${i}`);
        const check = document.getElementById(`channel-check-${i}`);
        if (card && check) {
            if (i === idx) {
                card.style.border = '2px solid var(--primary)';
                card.style.background = 'rgba(91,81,249,0.04)';
                card.style.boxShadow = '0 4px 12px rgba(91,81,249,0.08)';
                check.style.border = '1.5px solid var(--primary)';
                check.style.background = 'var(--primary)';
                check.innerText = '✓';
            } else {
                card.style.border = '1px solid rgba(0,0,0,0.08)';
                card.style.background = '#FFF';
                card.style.boxShadow = 'none';
                check.style.border = '1.5px solid rgba(0,0,0,0.2)';
                check.style.background = 'transparent';
                check.innerText = '';
            }
        }
    });
    
    const m = currentPaymentMethods[idx];
    document.getElementById('selected-payment-method-asset-id').value = m.paymentMethodAssetIdRawStr || m.paymentMethodAssetId;
    
    const details = document.getElementById('deposit-channel-details');
    details.style.display = 'block';
    
    document.getElementById('channel-logo').src = m.asset?.logo || 'https://storage.googleapis.com/matpcs-dev/uploads/images/9093375a-4ead-4f93-818a-14a91cfe7370.png';
    document.getElementById('channel-name').innerText = m.name;
    
    const cryptoDetails = document.getElementById('deposit-crypto-details');
    const fiatDetails = document.getElementById('deposit-fiat-details');
    
    if (m.assetClass === 'FIAT') {
        cryptoDetails.style.display = 'none';
        fiatDetails.style.display = 'flex';
        
        document.getElementById('channel-desc').innerText = currentLocale === 'hi' ? `फ़िएट स्थानांतरण चैनल | सीमा: ${m.target?.minDepositAmount || '100'} - ${m.target?.maxDepositAmount || '1000000'} ${m.asset?.symbol || 'HKD'}` : `Fiat Transfer Channel | Limit: ${m.target?.minDepositAmount || '100'} - ${m.target?.maxDepositAmount || '1000000'} ${m.asset?.symbol || 'HKD'}`;
        document.getElementById('fiat-bank-name').value = m.target?.bankName || '';
        document.getElementById('fiat-account-name').value = m.target?.accountName || '';
        document.getElementById('fiat-account-number').value = m.target?.accountNumber || '';
        if (m.target?.swiftCode) {
            document.getElementById('fiat-swift-box').style.display = 'block';
            document.getElementById('fiat-swift-code').value = m.target.swiftCode;
        } else {
            document.getElementById('fiat-swift-box').style.display = 'none';
            document.getElementById('fiat-swift-code').value = '';
        }
    } else {
        cryptoDetails.style.display = 'block';
        fiatDetails.style.display = 'none';
        
        document.getElementById('channel-desc').innerText = currentLocale === 'hi' ? `${m.target?.network || 'USDT'} रैपिड चैनल | सीमा: ${m.target?.minDepositAmount || '10'} - ${m.target?.maxDepositAmount || '50000'} USDT` : `${m.target?.network || 'USDT'} Rapid Channel | Limit: ${m.target?.minDepositAmount || '10'} - ${m.target?.maxDepositAmount || '50000'} USDT`;
        document.getElementById('channel-receiving-address').value = m.target?.address || (currentLocale === 'hi' ? 'कोई पता कॉन्फ़िगर नहीं किया गया' : 'No address configured');
    }
    
    // Track current selected channel index and recalculate rate display conversion
    currentSelectedChannelIdx = idx;
    calculateDepositConversion();
}

function copyDepositAddress() {
    const address = document.getElementById('channel-receiving-address').value;
    if (!address || address === 'Fetching...') return;
    navigator.clipboard.writeText(address);
    showToast(currentLocale === 'hi' ? '✓ जमा प्राप्त करने का पता क्लिपबोर्ड पर कॉपी किया गया!' : '✓ Deposit address copied to clipboard!', false);
}

function triggerDepositUpload() {
    const fileInput = document.getElementById('deposit-proof-file');
    if (fileInput) fileInput.click();
}

function handleDepositFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast(currentLocale === 'hi' ? '⚠️ कृपया एक वैध वाउचर छवि अपलोड करें!' : '⚠️ Please upload a valid voucher image!', true);
        return;
    }
    
    const submitBtn = document.getElementById('deposit-submit-btn');
    const placeholder = document.getElementById('upload-placeholder-content');
    const previewContainer = document.getElementById('upload-preview-container');
    const previewImg = document.getElementById('upload-preview-img');
    const proofUrlInput = document.getElementById('deposit-proof-url');
    
    // Read, compress, and preview the image
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Draw on canvas to compress and downscale
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            const max_size = 400; // Max width or height
            if (width > height) {
                if (width > max_size) {
                    height *= max_size / width;
                    width = max_size;
                }
            } else {
                if (height > max_size) {
                    width *= max_size / height;
                    height = max_size;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Highly compress to 0.7 quality and convert to blob
            canvas.toBlob(async function(blob) {
                if (!blob) {
                    showToast(currentLocale === 'hi' ? '⚠️ छवि प्रसंस्करण विफल!' : '⚠️ Image processing failed!', true);
                    return;
                }
                
                // Show loading state
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = currentLocale === 'hi' ? 'क्लाउड पर सुरक्षित रूप से अपलोड किया जा रहा है...' : 'Securing upload of voucher to cloud...';
                }
                if (placeholder) {
                    placeholder.innerHTML = `
                        <div style="font-size: 1.8rem; margin-bottom: 8px;">⏳</div>
                        <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary);">currentLocale === 'hi' ? 'सुरक्षित रूप से अपलोड किया जा रहा है, कृपया प्रतीक्षा करें...' : 'Securing upload, please wait...'</div>
                        <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">currentLocale === 'hi' ? 'सुरक्षित रूप से अपलोड किया जा रहा है...' : 'Securing upload...'</div>
                    `;
                }
                
                try {
                    // 1. Get presigned upload URL
                    const presignedRes = await apiFetch('POST', '/common/upload/presigned', {
                        contentType: 'image/jpeg',
                        fileName: 'proof.jpg',
                        type: 'kyc'
                    }, true);
                    
                    if (presignedRes.code !== 200) {
                        throw new Error(presignedRes.errorMessage || (currentLocale === 'hi' ? 'अपलोड प्राधिकरण प्राप्त करने में विफल' : 'Failed to obtain upload authorization'));
                    }
                    
                    const { uploadUrl, downloadUrl, path: storagePath } = presignedRes.result || presignedRes.data || {};
                    if (!uploadUrl || !downloadUrl) {
                        throw new Error(currentLocale === 'hi' ? 'प्राधिकरण डेटा अपवाद' : 'Authorization data exception');
                    }
                    
                    // 2. PUT binary image directly to GCS (routing through local proxy on dev to solve GCS CORS block)
                    let finalPutUrl = uploadUrl;
                    const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
                    if (isLocalDev) {
                        finalPutUrl = '/upload-gcs?url=' + encodeURIComponent(uploadUrl);
                    }
                    
                    const putRes = await fetch(finalPutUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'image/jpeg'
                        },
                        body: blob
                    });
                    
                    if (!putRes.ok) {
                        throw new Error(currentLocale === 'hi' ? 'नेटवर्क अपलोड विफल' : 'Network upload failed');
                    }
                    
                    // 3. Confirm GCS upload completion
                    const confirmRes = await apiFetch('POST', '/common/upload/confirm', {
                        path: storagePath
                    }, true);
                    
                    if (confirmRes.code !== 200) {
                        throw new Error(confirmRes.errorMessage || (currentLocale === 'hi' ? 'अपलोड पुष्टि विफल' : 'Upload confirmation failed'));
                    }
                    
                    // 4. Update preview and store URL in hidden field
                    if (proofUrlInput) proofUrlInput.value = downloadUrl;
                    if (previewImg) previewImg.src = canvas.toDataURL('image/jpeg', 0.5); // Local preview for speed
                    if (placeholder) placeholder.style.display = 'none';
                    if (previewContainer) previewContainer.style.display = 'flex';
                    
                    showToast(currentLocale === 'hi' ? '✓ वाउचर छवि अपलोड की गई और तैयार है!' : '✓ Voucher image uploaded and ready!', false);
                    
                } catch (err) {
                    console.error('Cloud upload error:', err);
                    showToast(currentLocale === 'hi' ? `⚠️ वाउचर अपलोड विफल: ${err.message || err}` : `⚠️ Voucher upload failed: ${err.message || err}`, true);
                    
                    // Reset placeholder HTML
                    if (placeholder) {
                        placeholder.innerHTML = `
                            <div style="font-size: 1.8rem; margin-bottom: 8px;">📸</div>
                            <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary);">currentLocale === 'hi' ? 'चुनने/अपलोड करने के लिए क्लिक करें' : 'Click to select/upload voucher screenshot'</div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">currentLocale === 'hi' ? 'PNG, JPG, JPEG प्रारूप का समर्थन करता है' : 'Supports PNG, JPG, JPEG format images'</div>
                        `;
                        placeholder.style.display = 'block';
                    }
                    if (previewContainer) previewContainer.style.display = 'none';
                    if (proofUrlInput) proofUrlInput.value = '';
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = currentLocale === 'hi' ? 'भुगतान की पुष्टि करें, जमा अनुरोध सबमिट करें' : 'Confirm payment, submit deposit request';
                    }
                }
            }, 'image/jpeg', 0.7);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function handleDepositFormSubmit(event) {
    event.preventDefault();
    if (!currentUser) return;
    
    const amt = parseFloat(document.getElementById('deposit-amount').value);
    const methodAssetIdStr = document.getElementById('selected-payment-method-asset-id').value;
    const proofUrl = document.getElementById('deposit-proof-url').value.trim();
    const remittanceCode = document.getElementById('deposit-remittance-code').value.trim();
    
    if (isNaN(amt) || amt <= 0) {
        showToast(currentLocale === 'hi' ? '⚠️ कृपया वैध जमा राशि दर्ज करें!' : '⚠️ Please enter a valid deposit amount!', true);
        return;
    }
    if (!methodAssetIdStr) {
        showToast(currentLocale === 'hi' ? '⚠️ कृपया एक वैध जमा चैनल चुनें!' : '⚠️ Please select a valid deposit channel!', true);
        return;
    }
    if (!proofUrl) {
        showToast(currentLocale === 'hi' ? '⚠️ कृपया जमा वाउचर स्क्रीनशॉट अपलोड करें!' : '⚠️ Please upload deposit voucher screenshot!', true);
        return;
    }
    
    const submitBtn = document.getElementById('deposit-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerText = currentLocale === 'hi' ? 'जमा अनुरोध सबमिट किया जा रहा है...' : 'Submitting deposit request...';
    
    try {
        // Build stable sorted JSON body exactly matching SIGN-SPEC-1.0 to avoid precision loss on paymentMethodAssetId BigInt
        const bodyStr = `{"amount":${amt},"paymentMethodAssetId":${methodAssetIdStr},"paymentProof":"${proofUrl}","remittanceCode":"${remittanceCode}"}`;
        
        const depositRes = await apiFetchWithRawBody('POST', '/finance/deposits', bodyStr, true);
        if (depositRes.code === 200) {
            showToast(currentLocale === 'hi' ? `✓ $${amt.toFixed(2)} USDT जमा अनुरोध सफलतापूर्वक सबमिट किया गया! प्रसंस्करण की प्रतीक्षा करें।` : `✓ $${amt.toFixed(2)} USDT deposit request successfully submitted! Waiting for processing.`, false);
            closeDepositModal();
            loadUserAssets();
        } else {
            const errMsg = depositRes.errorMessage || (currentLocale === 'hi' ? 'जमा विफल' : 'Deposit failed');
            const errCode = depositRes.code || '';
            showToast(currentLocale === 'hi' ? `जमा विफल [${errCode}]: ${errMsg}` : `Deposit failed [${errCode}]: ${errMsg}`, true);
        }
    } catch (e) {
        console.error(e);
        showToast(currentLocale === 'hi' ? 'जमा अनुरोध नेटवर्क अपवाद!' : 'Deposit request network exception!', true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = currentLocale === 'hi' ? 'भुगतान की पुष्टि करें, जमा अनुरोध सबमिट करें' : 'Confirm payment, submit deposit request';
    }
}

function maskName(name) {
    if (!name) return '';
    if (name.length > 20) {
        return name.substring(0, 6) + '...' + name.substring(name.length - 4);
    }
    if (name.length <= 2) {
        return name.substring(0, 1) + '*';
    }
    return name.substring(0, 2) + '*'.repeat(name.length - 4 >= 0 ? name.length - 3 : 1) + name.substring(name.length - 1);
}

function maskPhone(phone) {
    if (!phone) return '';
    if (phone.includes('@')) {
        const parts = phone.split('@');
        const username = parts[0];
        const domain = parts[1];
        if (username.length <= 3) {
            return username.substring(0, 1) + '**@' + domain;
        }
        return username.substring(0, 2) + '*'.repeat(username.length - 2) + '@' + domain;
    }
    if (/^\d+$/.test(phone)) {
        if (phone.length <= 4) return phone;
        return '*'.repeat(phone.length - 4) + phone.substring(phone.length - 4);
    }
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+')) {
        if (cleaned.length > 9) {
            return cleaned.substring(0, 5) + '*****' + cleaned.substring(cleaned.length - 4);
        }
    } else {
        if (cleaned.length > 6) {
            return cleaned.substring(0, 3) + '****' + cleaned.substring(cleaned.length - 4);
        }
    }
    return phone;
}

function switchWithdrawTab(tabId) {
    const tabs = ['crypto', 'upi', 'bank'];
    tabs.forEach(t => {
        const card = document.getElementById(`withdraw-card-${t}`);
        const checkPlaceholder = document.getElementById(`withdraw-card-check-${t}`);
        if (card) {
            if (t === tabId) {
                card.classList.add('active');
                if (checkPlaceholder) {
                    checkPlaceholder.innerHTML = `
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1A3EC1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                }
            } else {
                card.classList.remove('active');
                if (checkPlaceholder) {
                    checkPlaceholder.innerHTML = '';
                }
            }
        }
    });
    
    document.getElementById('current-withdraw-tab').value = tabId;
    
    // Toggle currency symbols
    const symEl = document.getElementById('withdraw-amount-currency-symbol');
    if (symEl) {
        symEl.innerText = tabId === 'crypto' ? '$' : '\u20b9';
    }
    
    // Trigger fee recalculation to dynamically update display units and limits
    calculateWithdrawFee();
}

async function openWithdrawModal() {
    if (!currentUser) { openAuthModal(); return; }
    
    // Check cached kyc status first (instant check)
    const cachedKyc = localStorage.getItem('matp_user_kyc') || 'NOT_VERIFIED';
    if (cachedKyc !== 'VERIFIED') {
        if (cachedKyc === 'PENDING') {
            showToast(currentLocale === 'hi' ? '⚠️ आपका केवाईसी सत्यापन समीक्षाधीन है, कृपया निकासी से पहले समीक्षा पूरी होने की प्रतीक्षा करें!' : '⚠️ Your KYC verification is under review, please wait for approval before withdrawing!', true);
            return;
        } else {
            showToast(currentLocale === 'hi' ? '⚠️ निकासी से पहले आपको केवाईसी पूरा करना होगा और स्वीकृत होना होगा!' : '⚠�  You need to complete KYC verification and be approved before withdrawing!', true);
            setTimeout(() => {
                openKycModal();
            }, 1500);
            return;
        }
    }
    
    if (!document.getElementById('withdraw-amount')) {
        switchTab('withdraw');
        return;
    }
    
    // Reset fields and setup UI instantly
    document.getElementById('withdraw-amount').value = '';
    
    document.getElementById('withdraw-address').value = '';
    document.getElementById('selected-withdraw-method-id').value = '';
    document.getElementById('selected-withdraw-method-address-cached').value = '';
    
    document.getElementById('withdraw-upi-address').value = '';
    document.getElementById('selected-withdraw-upi-id').value = '';
    document.getElementById('selected-withdraw-upi-address-cached').value = '';
    
    document.getElementById('withdraw-bank-name').value = '';
    document.getElementById('withdraw-bank-account').value = '';
    document.getElementById('withdraw-bank-ifsc').value = '';
    document.getElementById('selected-withdraw-bank-id').value = '';
    document.getElementById('selected-withdraw-bank-number-cached').value = '';
    document.getElementById('selected-withdraw-bank-name-cached').value = '';
    document.getElementById('selected-withdraw-bank-ifsc-cached').value = '';
    
        const bindingTip = document.getElementById('withdraw-binding-tip');
    if (bindingTip) bindingTip.innerText = currentLocale === 'hi' ? '\u2139\ufe0f \u0915\u094b\u0908 \u092c\u093e\u0927\u094d\u092f \u092a\u0924\u093e \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u093e, \u0938\u094d\u0935\u091a\u093e\u0932\u093f\u0924 \u0930\u0942\u092a \u0938\u0947 \u092c\u093e\u0927\u094d\u092f \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u092a\u0924\u093e \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902' : '\u2139\ufe0f No bound address detected, enter address to bind automatically';
    const upiTip = document.getElementById('withdraw-upi-tip');
    if (upiTip) upiTip.innerText = currentLocale === 'hi' ? '\u2139\ufe0f \u0915\u094b\u0908 \u092c\u093e\u0927\u094d\u092f \u0916\u093e\u0924\u093e \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u093e, \u0938\u094d\u0935\u091a\u093e\u0932\u093f\u0924 \u0930\u0942\u092a \u0938\u0947 \u092c\u093e\u0927\u094d\u092f \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u092f\u0942\u092a\u0940\u0906\u0908 \u0906\u0908\u0921\u0940 \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902' : '\u2139\ufe0f No bound account detected, enter UPI ID to bind automatically';
    const bankTip = document.getElementById('withdraw-bank-tip');
    if (bankTip) bankTip.innerText = currentLocale === 'hi' ? '\u2139\ufe0f \u0915\u094b\u0908 \u092c\u093e\u0927\u094d\u092f \u0915\u093e\u0930\u094d\u0921 \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u093e, \u0938\u094d\u0935\u091a\u093e\u0932\u093f\u0924 \u0930\u0942\u092a \u0938\u0947 \u092c\u093e\u0927\u094d\u092f \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u092c\u0948\u0902\u0915 \u0935\u093f\u0935\u0930\u0923 \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902' : '\u2139\ufe0f No bound card detected, enter bank details to bind automatically';
    
    document.getElementById('withdraw-fee-text').innerText = '0.00 USDT';
    document.getElementById('withdraw-net-amount-text').innerText = '0.00 USDT';
    
    switchWithdrawTab('upi');
    switchTab('withdraw');
    
    // Sync latest exchange rates and platform config from backend (non-blocking)
    syncExchangeRates();
    syncWithdrawMinLimit();
    
    // Run background KYC verification and loading of withdrawal methods
    (async () => {
        let kycStatus = cachedKyc;
        try {
            const profileRes = await apiFetch('GET', '/users/info', null, true);
            if (profileRes.code === 200) {
                const user = profileRes.result || profileRes.data || {};
                kycStatus = user.kycStatus || 'NOT_VERIFIED';
                localStorage.setItem('matp_user_kyc', kycStatus);
                if (window.currentUser) {
                    window.currentUser.kycStatus = kycStatus;
                }
            }
        } catch (e) {
            console.error('Failed to sync KYC status before withdraw:', e);
        }

        if (kycStatus !== 'VERIFIED') {
            if (kycStatus === 'PENDING') {
                showToast(currentLocale === 'hi' ? '⚠️ आपका केवाईसी सत्यापन समीक्षाधीन है, कृपया निकासी से पहले समीक्षा पूरी होने की प्रतीक्षा करें!' : '⚠�  Your KYC verification is under review, please wait for approval before withdrawing!', true);
            } else {
                showToast(currentLocale === 'hi' ? '⚠️ निकासी से पहले आपको केवाईसी पूरा करना होगा और स्वीकृत होना होगा!' : '⚠�  You need to complete KYC verification and be approved before withdrawing!', true);
                setTimeout(() => {
                    openKycModal();
                }, 1500);
            }
            switchTab('profile');
            return;
        }

        try {
            const methodsRes = await apiFetch('GET', '/finance/withdraw-methods', null, true);
            if (methodsRes.code === 200) {
                const data = methodsRes.data || methodsRes.result || {};
                
                const cryptoAccount = data.crypto;
                if (cryptoAccount && cryptoAccount.id) {
                    const methodId = cryptoAccount.id;
                    document.getElementById('withdraw-address').value = cryptoAccount.address;
                    document.getElementById('selected-withdraw-method-id').value = methodId;
                    document.getElementById('selected-withdraw-method-address-cached').value = cryptoAccount.address;
                    if (bindingTip) bindingTip.innerText = currentLocale === 'hi' ? '✓ निकासी बटुआ पता सुरक्षित रूप से बाध्य है' : '✓ Withdrawal wallet address safely bound';
                }
                
                const upiAccount = data.upi;
                if (upiAccount && upiAccount.id) {
                    const methodId = upiAccount.id;
                    document.getElementById('withdraw-upi-address').value = upiAccount.upi;
                    document.getElementById('selected-withdraw-upi-id').value = methodId;
                    document.getElementById('selected-withdraw-upi-address-cached').value = upiAccount.upi;
                    if (upiTip) upiTip.innerText = currentLocale === 'hi' ? '✓ यूपीआई खाता सुरक्षित रूप से बाध्य है' : '✓ UPI account safely bound';
                }
                
                const bankAccount = data.bank;
                if (bankAccount && bankAccount.id) {
                    const methodId = bankAccount.id;
                    document.getElementById('withdraw-bank-name').value = bankAccount.bankName;
                    document.getElementById('withdraw-bank-account').value = bankAccount.accountNumber;
                    document.getElementById('withdraw-bank-ifsc').value = bankAccount.ifscCode || bankAccount.ifsc || '';
                    
                    document.getElementById('selected-withdraw-bank-id').value = methodId;
                    document.getElementById('selected-withdraw-bank-name-cached').value = bankAccount.bankName;
                    document.getElementById('selected-withdraw-bank-number-cached').value = bankAccount.accountNumber;
                    document.getElementById('selected-withdraw-bank-ifsc-cached').value = bankAccount.ifscCode || bankAccount.ifsc || '';
                    if (bankTip) bankTip.innerText = currentLocale === 'hi' ? '✓ बैंक कार्ड विवरण सुरक्षित रूप से बाध्य हैं' : '✓ Bank card details safely bound';
                }
                
                updateWithdrawMethodCards();
            }
        } catch (e) {
            console.error('Failed to load withdrawal methods in background:', e);
        }
    })();
}

window.withdrawMinLimit = null;

async function syncWithdrawMinLimit() {
    try {
        const res = await apiFetch('GET', '/common/bootstrap-config', null, false);
        if (res.code === 200 && res.data && res.data.withdrawMinAmount) {
            const parsed = parseFloat(res.data.withdrawMinAmount);
            if (!isNaN(parsed) && parsed > 0) {
                window.withdrawMinLimit = parsed;
                calculateWithdrawFee();
            }
        }
    } catch (e) {
        console.warn('Failed to sync withdraw minimum limit:', e);
    }
}

function calculateWithdrawFee() {
    const amt = parseFloat(document.getElementById('withdraw-amount').value) || 0;
    const activeTab = document.getElementById('current-withdraw-tab').value;
    let rate = PLATFORM_EXCHANGE_RATES['USDT'] || 83.00;
    
    const balEl = document.getElementById('withdraw-available-balance');
    if (balEl) {
        if (activeTab === 'crypto') {
            balEl.innerText = `$${userUsdtBalance.toFixed(5)}`;
        } else {
            balEl.innerText = `\u20b9${(userUsdtBalance * rate).toFixed(5)}`;
        }
    }
    
    const amountInput = document.getElementById('withdraw-amount');
    const label = document.getElementById('withdraw-amount-limit-label');
    
    // Resolve dynamic minimum limit (default fallback to 10 USDT)
    const baseMinLimit = (window.withdrawMinLimit !== null && window.withdrawMinLimit !== undefined) 
        ? window.withdrawMinLimit 
        : ((window.CONFIG && window.CONFIG.MIN_WITHDRAW_USDT) ? window.CONFIG.MIN_WITHDRAW_USDT : 10);

    if (amountInput) {
        if (activeTab === 'crypto') {
            if (label) {
                label.innerText = currentLocale === 'hi' 
                    ? `निकासी राशि (न्यूनतम निकासी राशि: ${baseMinLimit} USDT)` 
                    : `Withdrawal amount (Mini withdrawal amount: ${baseMinLimit} USDT)`;
            }
            amountInput.placeholder = currentLocale === 'hi' 
                ? `न्यूनतम निकासी ${baseMinLimit} USDT` 
                : `Min withdrawal ${baseMinLimit} USDT`;
            amountInput.min = String(baseMinLimit);
        } else {
            const minInrVal = Math.ceil(baseMinLimit * rate);
            if (label) {
                label.innerText = currentLocale === 'hi' 
                    ? `निकासी राशि (न्यूनतम निकासी राशि: ${minInrVal})` 
                    : `Withdrawal amount (Mini withdrawal amount: ${minInrVal})`;
            }
            amountInput.placeholder = currentLocale === 'hi' 
                ? `न्यूनतम निकासी ${minInrVal}` 
                : `Min withdrawal ${minInrVal}`;
            amountInput.min = String(minInrVal);
        }
    }
    const feeRate = (window.CONFIG && window.CONFIG.WITHDRAW_FEE_RATE !== undefined) ? window.CONFIG.WITHDRAW_FEE_RATE : 0.22;
    
    if (activeTab === 'crypto') {
        const fee = amt * feeRate;
        const net = Math.max(0, amt - fee);
        document.getElementById('withdraw-fee-text').innerText = `$${fee.toFixed(2)} USDT`;
        document.getElementById('withdraw-net-amount-text').innerText = `$${net.toFixed(2)} USDT`;
        
        const tipEl = document.getElementById('withdraw-exchange-rate-tip');
        if (tipEl) {
            tipEl.style.display = 'block';
            tipEl.innerHTML = currentLocale === 'hi' 
                ? '\u0935\u0930\u094d\u0924\u092e\u093e\u0928 \u0928\u093f\u0915\u093e\u0938\u0940 \u0935\u093f\u0928\u093f\u092e\u092f \u0926\u0930: 1 <b>USDT</b> \u2248 <b>' + rate.toFixed(2) + ' INR</b>' 
                : 'Current exchange rate: 1 <b>USDT</b> \u2248 <b>' + rate.toFixed(2) + ' INR</b>';
        }
        const feeCard = document.getElementById('withdraw-fee-card');
        if (feeCard) {
            feeCard.style.display = 'flex';
        }
    } else {
        const feeInr = amt * feeRate;
        const netInr = Math.max(0, amt - feeInr);
        document.getElementById('withdraw-fee-text').innerText = `\u20b9${feeInr.toFixed(2)} INR`;
        document.getElementById('withdraw-net-amount-text').innerText = `\u20b9${netInr.toFixed(2)} INR`;
        
        const tipEl = document.getElementById('withdraw-exchange-rate-tip');
        if (tipEl) {
            tipEl.style.display = 'none';
        }
        const feeCard = document.getElementById('withdraw-fee-card');
        if (feeCard) {
            feeCard.style.display = 'none';
        }
    }
}


async function syncExchangeRates() {
    const symbols = ['USDT', 'HKD', 'USD', 'EUR', 'BTC', 'ETH'];
    const promises = symbols.map(async (symbol) => {
        try {
            const res = await apiFetch('GET', `/market/exchange-rate?from=${symbol}`, null, true);
            if (res && res.code === 200) {
                const data = res.result || res.data;
                if (data && data.rate) {
                    const parsedRate = parseFloat(data.rate);
                    if (!isNaN(parsedRate) && parsedRate > 0) {
                        PLATFORM_EXCHANGE_RATES[symbol] = parsedRate;
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to sync exchange rate for ${symbol}:`, e);
        }
    });
    await Promise.all(promises);
}

function updateWithdrawMethodCards() {
    const wUpiAddr = document.getElementById('withdraw-upi-address');
    const wBankName = document.getElementById('withdraw-bank-name');
    const wBankAccount = document.getElementById('withdraw-bank-account');
    const wAddress = document.getElementById('withdraw-address');
    
    if (!wUpiAddr || !wBankName || !wBankAccount || !wAddress) {
        return; // Safe return if not on withdrawal page
    }
    
    const upiVal = wUpiAddr.value;
    const bankName = wBankName.value;
    const bankAccount = wBankAccount.value;
    const cryptoAddress = wAddress.value;
    
    const upiSub = document.getElementById('withdraw-card-sub-upi');
    if (upiSub) {
        upiSub.innerText = upiVal ? maskPhone(upiVal) : t('payment_not_bound');
    }
    
    const bankSub = document.getElementById('withdraw-card-sub-bank');
    if (bankSub) {
        bankSub.innerText = (bankName && bankAccount) ? `${bankName} - ${maskPhone(bankAccount)}` : t('payment_not_bound');
    }
    
    const cryptoSub = document.getElementById('withdraw-card-sub-crypto');
    if (cryptoSub) {
        cryptoSub.innerText = cryptoAddress ? maskName(cryptoAddress) : t('payment_not_bound');
    }
}

function openPaymentAccountModal() {
    switchTab('payment-account');
}

async function initPaymentAccountPage() {
    if (!currentUser) { openAuthModal(); return; }
    
    try {
        await syncKycStatusFromServer();
    } catch (e) {
        console.error('Failed to sync KYC status before opening payment accounts:', e);
    }
    
    const cachedKyc = localStorage.getItem('matp_user_kyc') || 'NOT_VERIFIED';
    if (cachedKyc !== 'VERIFIED') {
        const kycErr = currentLocale === 'hi' 
            ? '\u26a0\ufe0f \u092d\u0941\u0917\u0924\u093e\u0928 \u0916\u093e\u0924\u0947 \u0915\u094b \u092a\u094d\u0930\u092c\u0902\u0927\u093f\u0924 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0915\u0947\u0935\u093e\u0908\u0938\u094c \u0938\u0924\u094d\u092f\u093e\u092a\u0928 \u0906\u0935\u0936\u094d\u092f\u0915 \u0939\u0948!' 
            : '\u26a0\ufe0f KYC verification is required to manage payment accounts!';
        showToast(kycErr, true);
        openKycModal();
        return;
    }
    
    const nicknameEl = document.getElementById('payment-user-nickname');
    if (nicknameEl) nicknameEl.innerText = maskName(currentUser.nickname || currentUser.username || 'Guest');
    const phoneEl = document.getElementById('payment-user-phone');
    if (phoneEl) phoneEl.innerText = maskPhone(currentUser.phone || '--');
    
    togglePaymentEdit('upi', false);
    togglePaymentEdit('bank', false);
    togglePaymentEdit('crypto', false);
    
    await loadPaymentAccounts();
}

async function loadPaymentAccounts() {
    try {
        const res = await apiFetch('GET', '/finance/withdraw-methods', null, true);
        if (res.code === 200) {
            const data = res.data || res.result || {};
            
            const upiAccount = data.upi || {};
            const upiDisplay = document.getElementById('payment-display-upi');
            const upiInput = document.getElementById('edit-upi-val');
            if (upiAccount.id) {
                if (upiDisplay) upiDisplay.innerText = maskPhone(upiAccount.upi);
                if (upiInput) upiInput.value = upiAccount.upi;
            } else {
                if (upiDisplay) upiDisplay.innerText = t('payment_not_bound');
                if (upiInput) upiInput.value = '';
            }
            
            const bankAccount = data.bank || {};
            const bankNameDisplay = document.getElementById('payment-display-bank-name');
            const bankAccDisplay = document.getElementById('payment-display-bank-account');
            const bankIfscDisplay = document.getElementById('payment-display-bank-ifsc');
            const editBankName = document.getElementById('edit-bank-name');
            const editBankAccount = document.getElementById('edit-bank-account');
            const editBankIfsc = document.getElementById('edit-bank-ifsc');
            
            if (bankAccount.id) {
                if (bankNameDisplay) bankNameDisplay.innerText = bankAccount.bankName;
                if (bankAccDisplay) bankAccDisplay.innerText = maskPhone(bankAccount.accountNumber);
                if (bankIfscDisplay) bankIfscDisplay.innerText = bankAccount.ifscCode || bankAccount.ifsc || '';
                if (editBankName) editBankName.value = bankAccount.bankName;
                if (editBankAccount) editBankAccount.value = bankAccount.accountNumber;
                if (editBankIfsc) editBankIfsc.value = bankAccount.ifscCode || bankAccount.ifsc || '';
            } else {
                const unboundText = t('payment_not_bound');
                if (bankNameDisplay) bankNameDisplay.innerText = unboundText;
                if (bankAccDisplay) bankAccDisplay.innerText = unboundText;
                if (bankIfscDisplay) bankIfscDisplay.innerText = unboundText;
                if (editBankName) editBankName.value = '';
                if (editBankAccount) editBankAccount.value = '';
                if (editBankIfsc) editBankIfsc.value = '';
            }
            
            const cryptoAccount = data.crypto || {};
            const cryptoAddrDisplay = document.getElementById('payment-display-crypto-address');
            const editCryptoAddr = document.getElementById('edit-crypto-address');
            if (cryptoAccount.id) {
                if (cryptoAddrDisplay) cryptoAddrDisplay.innerText = maskName(cryptoAccount.address);
                if (editCryptoAddr) editCryptoAddr.value = cryptoAccount.address;
            } else {
                if (cryptoAddrDisplay) cryptoAddrDisplay.innerText = t('payment_not_bound');
                if (editCryptoAddr) editCryptoAddr.value = '';
            }
        }
    } catch (e) {
        console.error('Failed to load payment account info:', e);
    }
}

function closePaymentAccountModal() {
    if (window.paymentAccountReferrer === 'withdraw') {
        switchTab('withdraw');
    } else {
        switchTab('profile');
    }
}

function togglePaymentEdit(method, isEdit) {
    const disp = document.getElementById(`payment-card-display-${method}`);
    const edit = document.getElementById(`payment-card-edit-${method}`);
    if (disp && edit) {
        if (isEdit) {
            disp.style.display = 'none';
            edit.style.display = 'block';
        } else {
            disp.style.display = 'block';
            edit.style.display = 'none';
        }
    }
}

async function savePaymentField(method) {
    if (!currentUser) return;
    
    let url = `/finance/withdraw-methods/${method}`;
    let body = {};
    
    if (method === 'upi') {
        const upiVal = document.getElementById('edit-upi-val').value.trim();
        if (!upiVal) {
            showToast(currentLocale === 'hi' ? '⚠️ कृपया अपना यूपीआई खाता दर्ज करें!' : '⚠️ Please enter your UPI account!', true);
            return;
        }
        body = { upi: upiVal };
    } else if (method === 'bank') {
        const bankName = document.getElementById('edit-bank-name').value.trim();
        const accNum = document.getElementById('edit-bank-account').value.trim();
        const ifsc = document.getElementById('edit-bank-ifsc').value.trim();
        
        if (!bankName || !accNum || !ifsc) {
            showToast(currentLocale === 'hi' ? '⚠️ कृपया पूरा बैंक विवरण भरें!' : '⚠️ Please fill in complete bank details!', true);
            return;
        }
        body = { bankName: bankName, accountNumber: accNum, ifsc: ifsc };
    } else if (method === 'crypto') {
        const address = document.getElementById('edit-crypto-address').value.trim();
        if (!address) {
            showToast(currentLocale === 'hi' ? '⚠️ कृपया अपना TRC20 निकासी पता दर्ज करें!' : '⚠️ Please enter your TRC20 withdrawal address!', true);
            return;
        }
        body = { address: address, network: 'TRC20', memo: '123456' };
    }
    
    showToast(currentLocale === 'hi' ? '⚙️ खाता विवरण बाध्य किया जा रहा है...' : '⚙️ Binding account details...', false);
    
    try {
        const res = await apiFetch('POST', url, body, true);
        const savedData = res.data || res.result || {};
        if (res.code === 200) {
            showToast(currentLocale === 'hi' ? '✓ खाता सुरक्षित रूप से बाध्य!' : '✓ Account bound successfully!', false);
            
            // Robust check to parse nested VO structures or direct/flat objects safely
            let upiObj = null;
            let bankObj = null;
            let cryptoObj = null;
            
            if (savedData.upi && typeof savedData.upi === 'object') {
                upiObj = savedData.upi;
            } else if (savedData.upi && typeof savedData.upi === 'string' && savedData.id) {
                upiObj = savedData;
            } else if (!savedData.upi && savedData.id && method === 'upi') {
                upiObj = savedData;
            }
            
            if (savedData.bank && typeof savedData.bank === 'object') {
                bankObj = savedData.bank;
            } else if (savedData.accountNumber && savedData.id) {
                bankObj = savedData;
            } else if (!savedData.bank && savedData.id && method === 'bank') {
                bankObj = savedData;
            }
            
            if (savedData.crypto && typeof savedData.crypto === 'object') {
                cryptoObj = savedData.crypto;
            } else if (savedData.address && savedData.id) {
                cryptoObj = savedData;
            } else if (!savedData.crypto && savedData.id && method === 'crypto') {
                cryptoObj = savedData;
            }

            if (method === 'upi' && upiObj) {
                const wUpiAddr = document.getElementById('withdraw-upi-address');
                const selWUpiId = document.getElementById('selected-withdraw-upi-id');
                const selWUpiAddrCached = document.getElementById('selected-withdraw-upi-address-cached');
                const pDisplayUpi = document.getElementById('payment-display-upi');
                
                if (wUpiAddr) wUpiAddr.value = upiObj.upi;
                if (selWUpiId) selWUpiId.value = upiObj.id;
                if (selWUpiAddrCached) selWUpiAddrCached.value = upiObj.upi;
                if (pDisplayUpi) pDisplayUpi.innerText = maskPhone(upiObj.upi);
            } else if (method === 'bank' && bankObj) {
                const wBankName = document.getElementById('withdraw-bank-name');
                const wBankAccount = document.getElementById('withdraw-bank-account');
                const wBankIfsc = document.getElementById('withdraw-bank-ifsc');
                const selWBankId = document.getElementById('selected-withdraw-bank-id');
                const selWBankNameCached = document.getElementById('selected-withdraw-bank-name-cached');
                const selWBankNumberCached = document.getElementById('selected-withdraw-bank-number-cached');
                const selWBankIfscCached = document.getElementById('selected-withdraw-bank-ifsc-cached');
                const pDisplayBankName = document.getElementById('payment-display-bank-name');
                const pDisplayBankAccount = document.getElementById('payment-display-bank-account');
                const pDisplayBankIfsc = document.getElementById('payment-display-bank-ifsc');
                
                if (wBankName) wBankName.value = bankObj.bankName;
                if (wBankAccount) wBankAccount.value = bankObj.accountNumber;
                if (wBankIfsc) wBankIfsc.value = bankObj.ifscCode || bankObj.ifsc || '';
                
                if (selWBankId) selWBankId.value = bankObj.id;
                if (selWBankNameCached) selWBankNameCached.value = bankObj.bankName;
                if (selWBankNumberCached) selWBankNumberCached.value = bankObj.accountNumber;
                if (selWBankIfscCached) selWBankIfscCached.value = bankObj.ifscCode || bankObj.ifsc || '';
                
                if (pDisplayBankName) pDisplayBankName.innerText = bankObj.bankName;
                if (pDisplayBankAccount) pDisplayBankAccount.innerText = maskPhone(bankObj.accountNumber);
                if (pDisplayBankIfsc) pDisplayBankIfsc.innerText = bankObj.ifscCode || bankObj.ifsc || '';
            } else if (method === 'crypto' && cryptoObj) {
                const wAddress = document.getElementById('withdraw-address');
                const selWMethodId = document.getElementById('selected-withdraw-method-id');
                const selWMethodAddrCached = document.getElementById('selected-withdraw-method-address-cached');
                const pDisplayCryptoAddress = document.getElementById('payment-display-crypto-address');
                
                if (wAddress) wAddress.value = cryptoObj.address;
                if (selWMethodId) selWMethodId.value = cryptoObj.id;
                if (selWMethodAddrCached) selWMethodAddrCached.value = cryptoObj.address;
                if (pDisplayCryptoAddress) pDisplayCryptoAddress.innerText = maskName(cryptoObj.address);
            }
            
            // Unified background sync: refresh both Payment Account modal and Withdrawal page inputs from GET source-of-truth
            try {
                if (window.loadPaymentAccounts) {
                    await window.loadPaymentAccounts();
                }
            } catch (err) {
                console.error('Failed loadPaymentAccounts background sync:', err);
            }
            
            try {
                const methodsRes = await apiFetch('GET', '/finance/withdraw-methods', null, true);
                if (methodsRes.code === 200) {
                    const data = methodsRes.data || methodsRes.result || {};
                    
                    const cryptoAccount = data.crypto;
                    if (cryptoAccount && cryptoAccount.id) {
                        const methodId = cryptoAccount.id;
                        const wAddr = document.getElementById('withdraw-address');
                        const selWId = document.getElementById('selected-withdraw-method-id');
                        const selWAddrCached = document.getElementById('selected-withdraw-method-address-cached');
                        if (wAddr) wAddr.value = cryptoAccount.address;
                        if (selWId) selWId.value = methodId;
                        if (selWAddrCached) selWAddrCached.value = cryptoAccount.address;
                        const bindingTip = document.getElementById('withdraw-binding-tip');
                        if (bindingTip) bindingTip.innerText = currentLocale === 'hi' ? '✓ निकासी बटुआ पता सुरक्षित रूप से बाध्य है' : '✓ Withdrawal wallet address safely bound';
                    }
                    
                    const upiAccount = data.upi;
                    if (upiAccount && upiAccount.id) {
                        const methodId = upiAccount.id;
                        const wUpiAddr = document.getElementById('withdraw-upi-address');
                        const selWUpiId = document.getElementById('selected-withdraw-upi-id');
                        const selWUpiAddrCached = document.getElementById('selected-withdraw-upi-address-cached');
                        if (wUpiAddr) wUpiAddr.value = upiAccount.upi;
                        if (selWUpiId) selWUpiId.value = methodId;
                        if (selWUpiAddrCached) selWUpiAddrCached.value = upiAccount.upi;
                        const upiTip = document.getElementById('withdraw-upi-tip');
                        if (upiTip) upiTip.innerText = currentLocale === 'hi' ? '✓ यूपीआई खाता सुरक्षित रूप से बाध्य है' : '✓ UPI account safely bound';
                    }
                    
                    const bankAccount = data.bank;
                    if (bankAccount && bankAccount.id) {
                        const methodId = bankAccount.id;
                        const wBankName = document.getElementById('withdraw-bank-name');
                        const wBankAccount = document.getElementById('withdraw-bank-account');
                        const wBankIfsc = document.getElementById('withdraw-bank-ifsc');
                        const selWBankId = document.getElementById('selected-withdraw-bank-id');
                        const selWBankNameCached = document.getElementById('selected-withdraw-bank-name-cached');
                        const selWBankNumberCached = document.getElementById('selected-withdraw-bank-number-cached');
                        const selWBankIfscCached = document.getElementById('selected-withdraw-bank-ifsc-cached');
                        
                        if (wBankName) wBankName.value = bankAccount.bankName;
                        if (wBankAccount) wBankAccount.value = bankAccount.accountNumber;
                        if (wBankIfsc) wBankIfsc.value = bankAccount.ifscCode || bankAccount.ifsc || '';
                        
                        if (selWBankId) selWBankId.value = methodId;
                        if (selWBankNameCached) selWBankNameCached.value = bankAccount.bankName;
                        if (selWBankNumberCached) selWBankNumberCached.value = bankAccount.accountNumber;
                        if (selWBankIfscCached) selWBankIfscCached.value = bankAccount.ifscCode || bankAccount.ifsc || '';
                        const bankTip = document.getElementById('withdraw-bank-tip');
                        if (bankTip) bankTip.innerText = currentLocale === 'hi' ? '✓ बैंक कार्ड विवरण सुरक्षित रूप से बाध्य हैं' : '✓ Bank card details safely bound';
                    }
                }
            } catch (err) {
                console.error('Failed to sync withdraw inputs after save:', err);
            }
            
            if (window.updateWithdrawMethodCards) {
                window.updateWithdrawMethodCards();
            }
            togglePaymentEdit(method, false);
        } else {
            showToast(res.errorMessage || (currentLocale === 'hi' ? 'बाइंडिंग विफल' : 'Binding failed'), true);
        }
    } catch (e) {
        console.error(e);
        showToast(currentLocale === 'hi' ? 'बाइंडिंग अनुरोध नेटवर्क अपवाद!' : 'Binding request network exception!', true);
    }
}

async function handleWithdrawFormSubmit(event) {
    event.preventDefault();
    if (!currentUser) return;
    
    const amt = parseFloat(document.getElementById('withdraw-amount').value);
    if (isNaN(amt) || amt <= 0) {
        showToast(currentLocale === 'hi' ? '⚠️ कृपया वैध निकासी राशि दर्ज करें!' : '⚠️ Please enter a valid withdrawal amount!', true);
        return;
    }
    
    const activeTab = document.getElementById('current-withdraw-tab').value;
    let rate = PLATFORM_EXCHANGE_RATES['USDT'] || 83.00;
    
    const baseMinLimit = (window.withdrawMinLimit !== null && window.withdrawMinLimit !== undefined) 
        ? window.withdrawMinLimit 
        : ((window.CONFIG && window.CONFIG.MIN_WITHDRAW_USDT) ? window.CONFIG.MIN_WITHDRAW_USDT : 10);

    if (activeTab === 'crypto') {
        if (amt > userUsdtBalance) {
            showToast(currentLocale === 'hi' ? '⚠️ निकासी विफल! राशि वर्तमान शेष राशि से अधिक है।' : '⚠️ Withdrawal failed! Amount exceeds current balance.', true);
            return;
        }
        if (amt < baseMinLimit) {
            showToast(currentLocale === 'hi' ? `⚠️ न्यूनतम निकासी ${baseMinLimit} USDT है!` : `⚠️ Min withdrawal amount is ${baseMinLimit} USDT!`, true);
            return;
        }
    } else {
        const userInrBalance = userUsdtBalance * rate;
        const minInr = baseMinLimit * rate;
        if (amt > userInrBalance) {
            showToast(currentLocale === 'hi' ? '⚠️ निकासी विफल! राशि वर्तमान शेष राशि से अधिक है।' : '⚠️ Withdrawal failed! Amount exceeds current balance.', true);
            return;
        }
        if (amt < minInr) {
            showToast(currentLocale === 'hi' ? `⚠️ न्यूनतम निकासी ${Math.ceil(minInr)} INR है!` : `⚠️ Min withdrawal amount is ${Math.ceil(minInr)} INR!`, true);
            return;
        }
    }
    
    let methodId = '';
    if (activeTab === 'crypto') {
        methodId = document.getElementById('selected-withdraw-method-id').value;
        if (!methodId) {
            showToast(currentLocale === 'hi' ? '⚠️ कृपया पहले यूपीआई/बैंक/क्रिप्टो को बाइंड करने के लिए "प्रबंधित करें" पर क्लिक करें!' : '⚠️ Please click "Manage" to bind your Crypto account first!', true);
            return;
        }
    } else if (activeTab === 'upi') {
        methodId = document.getElementById('selected-withdraw-upi-id').value;
        if (!methodId) {
            showToast(currentLocale === 'hi' ? '⚠️ कृपया पहले यूपीआई/बैंक/क्रिप्टो को बाइंड करने के लिए "प्रबंधित करें" पर क्लिक करें!' : '⚠️ Please click "Manage" to bind your UPI account first!', true);
            return;
        }
    } else if (activeTab === 'bank') {
        methodId = document.getElementById('selected-withdraw-bank-id').value;
        if (!methodId) {
            showToast(currentLocale === 'hi' ? '⚠️ कृपया पहले यूपीआई/बैंक/क्रिप्टो को बाइंड करने के लिए "प्रबंधित करें" पर क्लिक करें!' : '⚠️ Please click "Manage" to bind your Bank card first!', true);
            return;
        }
    }
    
    const submitBtn = document.getElementById('withdraw-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerText = currentLocale === 'hi' ? 'निकासी अनुरोध सबमिट किया जा रहा है...' : 'Submitting withdrawal request...';
    
    try {
        const submittedAmount = activeTab === 'crypto' ? amt * rate : amt;
        
        const bodyStr = `{"amount":${submittedAmount},"withdrawMethodId":${methodId}}`;
        const withdrawRes = await apiFetchWithRawBody('POST', '/finance/withdrawals', bodyStr, true);
        if (withdrawRes.code === 200) {
            if (activeTab === 'crypto') {
                showToast(currentLocale === 'hi' ? `✓ $${amt.toFixed(2)} USDT निकासी अनुरोध सफलतापूर्वक सबमिट किया गया!` : `✓ $${amt.toFixed(2)} USDT withdrawal request successfully submitted!`, false);
            } else {
                showToast(currentLocale === 'hi' ? `✓ \u20b9${amt.toFixed(2)} INR निकासी अनुरोध सफलतापूर्वक सबमिट किया गया!` : `✓ \u20b9${amt.toFixed(2)} INR withdrawal request successfully submitted!`, false);
            }
            closeWithdrawModal();
            loadUserAssets();
        } else {
            showToast(withdrawRes.errorMessage || (currentLocale === 'hi' ? 'निकासी विफल' : 'Withdrawal failed'), true);
        }
    } catch (e) {
        console.error(e);
        showToast(currentLocale === 'hi' ? 'निकासी अनुरोध नेटवर्क अपवाद!' : 'Withdrawal request network exception!', true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = currentLocale === 'hi' ? '\u091c\u093e\u0930\u0940 \u0930\u0916\u0947\u0902' : 'Continue';
    }
}

function calculateDepositConversion() {
    const amtInput = document.getElementById('deposit-amount');
    const tipEl = document.getElementById('deposit-exchange-rate-tip');
    if (!amtInput || !tipEl) return;
    
    const amt = parseFloat(amtInput.value) || 0;
    
    if (!currentPaymentMethods || currentPaymentMethods.length === 0) {
        tipEl.innerText = t('deposit_rate_tip_default');
        return;
    }
    
    const m = currentPaymentMethods[currentSelectedChannelIdx];
    if (!m) return;
    
    const symbol = m.asset?.symbol || 'USDT';
    
    // Find rate in local platform exchange rates mapping constant
    let rate = PLATFORM_EXCHANGE_RATES[symbol] || (symbol === 'USDT' || symbol === 'USD' ? 83.00 : (symbol === 'HKD' ? 14.16 : 1.0));
    
    const convertedAmt = amt * rate;
    let template = t('deposit_rate_tip_template');
    template = template.replace('{symbol}', symbol)
                       .replace('{rate}', rate.toFixed(2))
                       .replace('{converted}', convertedAmt.toFixed(2));
    tipEl.innerHTML = template;
}

window.calculateDepositConversion = calculateDepositConversion;

// --- SEARCH CENTER MODAL CONTROLLERS (Phase 8 Integration) ---

window.closeDepositModal = closeDepositModal;
window.closeWithdrawModal = closeWithdrawModal;
window.copyFiatValue = copyFiatValue;
window.openDepositModal = openDepositModal;
window.selectDepositChannel = selectDepositChannel;
window.copyDepositAddress = copyDepositAddress;
window.triggerDepositUpload = triggerDepositUpload;
window.handleDepositFileSelect = handleDepositFileSelect;
window.handleDepositFormSubmit = handleDepositFormSubmit;
window.maskName = maskName;
window.maskPhone = maskPhone;
window.switchWithdrawTab = switchWithdrawTab;
window.openWithdrawModal = openWithdrawModal;
window.calculateWithdrawFee = calculateWithdrawFee;
window.syncExchangeRates = syncExchangeRates;
window.updateWithdrawMethodCards = updateWithdrawMethodCards;
window.openPaymentAccountModal = openPaymentAccountModal;
window.loadPaymentAccounts = loadPaymentAccounts;
window.closePaymentAccountModal = closePaymentAccountModal;
window.togglePaymentEdit = togglePaymentEdit;
window.initPaymentAccountPage = initPaymentAccountPage;
window.savePaymentField = savePaymentField;
window.handleWithdrawFormSubmit = handleWithdrawFormSubmit;
window.calculateDepositConversion = calculateDepositConversion;
