/**
 * auth.js — Client-side authentication module
 * Replicates Python's app/auth.py for the Android/browser environment.
 * Users stored in localStorage under key: tea_users
 */
const Auth = {
    USERS_KEY: 'tea_users',

    _loadUsers() {
        try {
            const raw = localStorage.getItem(this.USERS_KEY);
            return raw ? JSON.parse(raw) : { users: [] };
        } catch (e) {
            return { users: [] };
        }
    },

    _saveUsers(data) {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(data));
    },

    async _hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async register(username, password) {
        if (!username || !username.trim()) {
            return { success: false, message: 'Username cannot be empty.' };
        }
        if (!password || password.length < 4) {
            return { success: false, message: 'Password must be at least 4 characters.' };
        }

        const usersData = this._loadUsers();
        const existing = usersData.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
        if (existing) {
            return { success: false, message: 'Username already exists.' };
        }

        const passwordHash = await this._hashPassword(password);
        usersData.users.push({
            username: username.trim(),
            password_hash: passwordHash
        });
        this._saveUsers(usersData);
        return { success: true, message: 'User registered successfully.' };
    },

    async verify(username, password) {
        if (!username || !password) return false;
        const usersData = this._loadUsers();
        const user = usersData.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
        if (!user) return false;
        const hash = await this._hashPassword(password);
        return hash === user.password_hash;
    },

    async updateAccountDetails(currentUser, currentPassword, newUsername, newPassword) {
        if (!await this.verify(currentUser, currentPassword)) {
            return { success: false, message: 'Current password is incorrect.' };
        }
        if (!newUsername && !newPassword) {
            return { success: false, message: 'Nothing to update.' };
        }

        const usersData = this._loadUsers();

        // Check new username availability
        if (newUsername && newUsername.toLowerCase() !== currentUser.toLowerCase()) {
            const taken = usersData.users.find(u => u.username.toLowerCase() === newUsername.toLowerCase());
            if (taken) return { success: false, message: 'That username is already taken.' };
        }

        // Apply changes
        const userIdx = usersData.users.findIndex(u => u.username.toLowerCase() === currentUser.toLowerCase());
        if (userIdx === -1) return { success: false, message: 'User not found.' };

        if (newUsername) usersData.users[userIdx].username = newUsername.trim();
        if (newPassword) usersData.users[userIdx].password_hash = await this._hashPassword(newPassword);

        this._saveUsers(usersData);

        const changed = [];
        if (newUsername) changed.push('username');
        if (newPassword) changed.push('password');
        const label = changed.map((s, i) => i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s).join(' and ');

        return { success: true, message: label + ' updated successfully.', newUsername: newUsername || currentUser };
    }
};
