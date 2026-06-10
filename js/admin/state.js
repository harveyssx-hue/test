// js/admin/state.js
export const state = {
    users: null,
    usersPromise: null,
    
    async getUsers(force = false) {
        if (!force && this.users) {
            return this.users;
        }
        if (this.usersPromise && !force) {
            return this.usersPromise;
        }
        
        this.usersPromise = (async () => {
            try {
                const res = await window.apiFetch('GET', '/users', null, true);
                if (res.code === 200) {
                    this.users = res.result || res.data || [];
                    return this.users;
                }
                return [];
            } catch (e) {
                console.error("Failed to fetch users list in state:", e);
                return [];
            } finally {
                this.usersPromise = null;
            }
        })();
        
        return this.usersPromise;
    },
    
    async getUserPhoneMap(force = false) {
        const usersList = await this.getUsers(force);
        const map = {};
        usersList.forEach(u => {
            map[String(u.id)] = u.phone || u.username || u.email || '--';
        });
        return map;
    },
    
    clearUsersCache() {
        this.users = null;
        this.usersPromise = null;
    }
};
