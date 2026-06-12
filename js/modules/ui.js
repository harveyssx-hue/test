// UI Utility Helper Module
import { state } from './state.js?v=2.2.0';

function showToast(msg, isErr = false) {
    const toast = document.getElementById('alert-toast');
    if (!toast) return;
    
    toast.innerText = msg;
    toast.className = isErr ? 'alert-popup active err' : 'alert-popup active';
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 4500);
}

// Helper to lazily load modal templates into the #modal-container
async function ensureModalLoaded(modalId, templateName = modalId) {
    if (document.getElementById(modalId)) {
        return; // Already loaded in DOM
    }
    try {
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const response = await fetch(`${basePath}components/${templateName}.html?v=${Date.now()}`);
        if (!response.ok) throw new Error(`Failed to load modal: ${templateName}`);
        const html = await response.text();
        
        const container = document.getElementById('modal-container');
        if (container) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const modalNode = tempDiv.firstElementChild;
            container.appendChild(modalNode);
            
            // Translate the new modal content
            if (window.applyTranslations) window.applyTranslations();
        }
    } catch (e) {
        console.error('Failed to lazy load modal:', e);
    }
}

window.showToast = showToast;
window.ensureModalLoaded = ensureModalLoaded;

export { showToast, ensureModalLoaded };