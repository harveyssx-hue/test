export async function loadDashboardStats() {
    window.kycFetchPromise = null;
    try {
        const version = Date.now();
        const [kycModule, quantModule, usersModule] = await Promise.all([
            import(`./kyc.js?v=${version}`),
            import(`./quant.js?v=${version}`),
            import(`./users.js?v=${version}`)
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