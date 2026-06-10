export async function loadDashboardStats() {
    window.kycFetchPromise = null;
    try {
        const [kycModule, quantModule, usersModule] = await Promise.all([
            import(`./kyc.js`),
            import(`./quant.js`),
            import(`./users.js`)
        ]);
        
        // Expose to window as well so other clicks can use them
        window.loadKycList = kycModule.loadKycList;
        window.loadQuantMonitor = quantModule.loadQuantMonitor;
        window.loadUsersList = usersModule.loadUsersList;
        
        kycModule.loadKycList();
        quantModule.loadQuantMonitor();
        usersModule.loadUsersList();
    } catch (err) {
        console.error('Failed to load dashboard sub-modules:', err);
    }
}