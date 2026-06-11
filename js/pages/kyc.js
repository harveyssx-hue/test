// KYC Real-name Verification Controller
import { state } from '../modules/state.js?v=2.2.0';

async function openKycModal() {
    if (!currentUser) {
        openAuthModal();
        return;
    }

    let kycRecord = null;
    try {
        const res = await apiFetch('GET', '/users/kyc/info', null, true);
        if (res && res.code === 200 && (res.data || res.result)) {
            kycRecord = res.data || res.result;
        }
    } catch (e) {
        console.error('Failed to fetch existing KYC info:', e);
    }

    // Prepopulate fields from existing KYC record or fallback to defaults/currentUser
    const nameInput = document.getElementById('kyc-name');
    if (nameInput) {
        nameInput.value = (kycRecord && kycRecord.fullName) || '';
    }
    
    const idTypeInput = document.getElementById('kyc-id-type');
    if (idTypeInput) {
        idTypeInput.value = (kycRecord && kycRecord.idType) || 'ID_CARD';
    }
    
    const idNumberInput = document.getElementById('kyc-id-number');
    if (idNumberInput) {
        idNumberInput.value = (kycRecord && kycRecord.idNumber) || '';
    }
    
    const genderInput = document.getElementById('kyc-gender');
    if (genderInput) {
        genderInput.value = (kycRecord && kycRecord.gender) || 'MALE';
    }
    
    const dobInput = document.getElementById('kyc-dob');
    if (dobInput) {
        dobInput.value = (kycRecord && kycRecord.dateOfBirth) || '1990-01-01';
    }
    
    const regionInput = document.getElementById('kyc-region');
    if (regionInput) {
        regionInput.value = (kycRecord && kycRecord.regionCode) || 'IN';
    }
    
    const phoneInput = document.getElementById('kyc-phone');
    if (phoneInput) {
        phoneInput.value = localStorage.getItem('matp_user_clean_phone') || (currentUser && currentUser.phone) || (kycRecord && kycRecord.phone) || '';
    }
    
    const emailInput = document.getElementById('kyc-email');
    if (emailInput) {
        emailInput.value = (kycRecord && kycRecord.email) || (currentUser && currentUser.email) || '';
    }
    
    const companyInput = document.getElementById('kyc-company');
    if (companyInput) {
        companyInput.value = (kycRecord && kycRecord.company) || 'AI Trading Group';
    }
    
    const occupationInput = document.getElementById('kyc-occupation');
    if (occupationInput) {
        occupationInput.value = (kycRecord && kycRecord.occupation) || 'Trader';
    }
    
    const salaryInput = document.getElementById('kyc-salary');
    if (salaryInput) {
        salaryInput.value = (kycRecord && kycRecord.salary) || '250000';
    }
    
    const addressInput = document.getElementById('kyc-address');
    if (addressInput) {
        addressInput.value = (kycRecord && kycRecord.address) || 'Xuhui District, Shanghai, China';
    }
    
    const frontUrlInput = document.getElementById('kyc-front-url');
    const frontPlaceholder = document.getElementById('kyc-front-placeholder');
    const frontPreviewContainer = document.getElementById('kyc-front-preview-container');
    const frontPreviewImg = document.getElementById('kyc-front-preview-img');
    
    if (frontUrlInput) {
        let url = (kycRecord && kycRecord.idCardFront) || '';
        // If the URL contains 'example.com', treat it as a placeholder to avoid net::ERR_CONNECTION_TIMED_OUT
        if (url && url.includes('example.com')) {
            url = '';
        }
        frontUrlInput.value = url;
        if (url) {
            if (frontPreviewImg) frontPreviewImg.src = url;
            if (frontPlaceholder) frontPlaceholder.style.display = 'none';
            if (frontPreviewContainer) frontPreviewContainer.style.display = 'flex';
        } else {
            if (frontPlaceholder) frontPlaceholder.style.display = 'block';
            if (frontPreviewContainer) frontPreviewContainer.style.display = 'none';
            if (frontPreviewImg) frontPreviewImg.removeAttribute('src');
        }
    }
    
    const backUrlInput = document.getElementById('kyc-back-url');
    const backPlaceholder = document.getElementById('kyc-back-placeholder');
    const backPreviewContainer = document.getElementById('kyc-back-preview-container');
    const backPreviewImg = document.getElementById('kyc-back-preview-img');
    
    if (backUrlInput) {
        let url = (kycRecord && kycRecord.idCardBack) || '';
        // If the URL contains 'example.com', treat it as a placeholder to avoid net::ERR_CONNECTION_TIMED_OUT
        if (url && url.includes('example.com')) {
            url = '';
        }
        backUrlInput.value = url;
        if (url) {
            if (backPreviewImg) backPreviewImg.src = url;
            if (backPlaceholder) backPlaceholder.style.display = 'none';
            if (backPreviewContainer) backPreviewContainer.style.display = 'flex';
        } else {
            if (backPlaceholder) backPlaceholder.style.display = 'block';
            if (backPreviewContainer) backPreviewContainer.style.display = 'none';
            if (backPreviewImg) backPreviewImg.removeAttribute('src');
        }
    }

    switchTab('kyc');
}

function closeKycModal() {
    switchTab('profile');
}

async function handleKycSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('kyc-name').value.trim();
    const idType = document.getElementById('kyc-id-type').value;
    const idNumber = document.getElementById('kyc-id-number').value.trim();
    
    const gender = document.getElementById('kyc-gender').value;
    const dob = document.getElementById('kyc-dob').value;
    const region = document.getElementById('kyc-region').value.trim();
    const phone = document.getElementById('kyc-phone').value.trim();
    const email = document.getElementById('kyc-email').value.trim();
    const company = document.getElementById('kyc-company').value.trim();
    const occupation = document.getElementById('kyc-occupation').value.trim();
    const salary = document.getElementById('kyc-salary').value.trim();
    const address = document.getElementById('kyc-address').value.trim();
    const frontUrl = document.getElementById('kyc-front-url').value.trim();
    const backUrl = document.getElementById('kyc-back-url').value.trim();
    
    try {
        const body = {
            fullName: name,
            idType: idType,
            idNumber: idNumber,
            dateOfBirth: dob,
            gender: gender,
            regionCode: region,
            address: address,
            company: company,
            occupation: occupation,
            salary: salary,
            phone: phone,
            email: email,
            idCardFront: frontUrl,
            idCardBack: backUrl
        };
        
        const res = await apiFetch('POST', '/users/kyc', body, true);
        if (res.code === 200) {
            closeKycModal();
            const successMsg = currentLocale === 'en' 
                ? 'KYC submitted successfully! Waiting for compliance review...' 
                : (currentLocale === 'hi' ? 'केवाईसी सफलतापूर्वक जमा किया गया! अनुपालन समीक्षा की प्रतीक्षा है...' : 'KYC materials submitted successfully! Sent to risk control compliance center for review...');
            showToast(successMsg, false);
            localStorage.setItem('matp_user_kyc', 'PENDING');
            checkAuthSession();
        } else {
            const failMsg = currentLocale === 'hi' ? 'केवाईसी सबमिशन विफल रहा!' : 'KYC submission failed!';
            showToast(res.errorMessage || failMsg, true);
        }
    } catch(e) {
        const netFailMsg = currentLocale === 'hi' ? 'केवाईसी जमा करने के दौरान नेटवर्क त्रुटि!' : 'Network error during KYC submission!';
        showToast(netFailMsg, true);
    }
}

function triggerKycUpload(side) {
    const fileInput = document.getElementById(`kyc-${side}-file`);
    if (fileInput) fileInput.click();
}

function handleKycFileSelect(event, side) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast(currentLocale === 'hi' ? '⚠️ कृपया एक वैध छवि फ़ाइल अपलोड करें!' : '⚠️ Please upload a valid image file!', true);
        return;
    }
    
    const placeholder = document.getElementById(`kyc-${side}-placeholder`);
    const previewContainer = document.getElementById(`kyc-${side}-preview-container`);
    const previewImg = document.getElementById(`kyc-${side}-preview-img`);
    const proofUrlInput = document.getElementById(`kyc-${side}-url`);
    
    // Read, compress, and preview the image
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            const max_size = 400; // Max size
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
            
            canvas.toBlob(async function(blob) {
                if (!blob) {
                    showToast(currentLocale === 'hi' ? '⚠️ छवि प्रसंस्करण विफल!' : '⚠️ Image processing failed!', true);
                    return;
                }
                
                if (placeholder) {
                    placeholder.innerHTML = `
                        <div style="font-size: 1.6rem; margin-bottom: 6px;">⏳</div>
                        <div style="font-weight: 700; font-size: 0.8rem; color: var(--primary);">${currentLocale === 'hi' ? 'अपलोड हो रहा है...' : 'Uploading...'}</div>
                    `;
                }
                
                try {
                    // 1. Get presigned upload URL
                    const presignedRes = await apiFetch('POST', '/common/upload/presigned', {
                        contentType: 'image/jpeg',
                        fileName: `kyc_${side}.jpg`,
                        type: 'kyc'
                    }, true);
                    
                    if (presignedRes.code !== 200) {
                        throw new Error(presignedRes.errorMessage || (currentLocale === 'hi' ? 'अपलोड प्राधिकरण प्राप्त करने में विफल' : 'Failed to obtain upload authorization'));
                    }
                    
                    const { uploadUrl, downloadUrl, path: storagePath } = presignedRes.result || presignedRes.data || {};
                    if (!uploadUrl || !downloadUrl) {
                        throw new Error(currentLocale === 'hi' ? 'प्राधिकरण डेटा अपवाद' : 'Authorization data exception');
                    }
                    
                    // 2. PUT binary image
                    let finalPutUrl = uploadUrl;
                    const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
                    if (isLocalDev) {
                        finalPutUrl = '/upload-gcs?url=' + encodeURIComponent(uploadUrl);
                    } else {
                        if (uploadUrl.startsWith('https://storage.googleapis.com/')) {
                            finalPutUrl = uploadUrl.replace('https://storage.googleapis.com/', '/upload-gcs/');
                        }
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
                    
                    // 3. Confirm upload
                    const confirmRes = await apiFetch('POST', '/common/upload/confirm', {
                        path: storagePath
                    }, true);
                    
                    if (confirmRes.code !== 200) {
                        throw new Error(confirmRes.errorMessage || (currentLocale === 'hi' ? 'अपलोड पुष्टि विफल' : 'Upload confirmation failed'));
                    }
                    
                    // 4. Update preview and input values
                    if (proofUrlInput) proofUrlInput.value = downloadUrl;
                    if (previewImg) previewImg.src = canvas.toDataURL('image/jpeg', 0.5);
                    if (placeholder) placeholder.style.display = 'none';
                    if (previewContainer) previewContainer.style.display = 'flex';
                    
                    showToast(currentLocale === 'hi' ? `✓ ${side === 'front' ? 'सामने का' : 'पीछे का'} फोटो सफलतापूर्वक अपलोड किया गया!` : `✓ ${side === 'front' ? 'Front' : 'Back'} photo uploaded successfully!`, false);
                    
                } catch (err) {
                    console.error('KYC Cloud upload error:', err);
                    showToast(currentLocale === 'hi' ? `⚠️ अपलोड विफल: ${err.message || err}` : `⚠️ Upload failed: ${err.message || err}`, true);
                    
                    // Restore placeholder HTML
                    if (placeholder) {
                        placeholder.innerHTML = `
                            <div style="font-size: 1.6rem; margin-bottom: 6px;">📸</div>
                            <div style="font-weight: 700; font-size: 0.8rem; color: var(--primary);">${side === 'front' ? (currentLocale === 'hi' ? 'सामने का फोटो अपलोड करने के लिए क्लिक करें' : 'Click to upload ID Card Front') : (currentLocale === 'hi' ? 'पीछे का फोटो अपलोड करने के लिए क्लिक करें' : 'Click to upload ID Card Back')}</div>
                            <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 3px;">Supports PNG, JPG, JPEG formats</div>
                        `;
                    }
                }
            });
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

window.openKycModal = openKycModal;
window.closeKycModal = closeKycModal;
window.handleKycSubmit = handleKycSubmit;
window.triggerKycUpload = triggerKycUpload;
window.handleKycFileSelect = handleKycFileSelect;