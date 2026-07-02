/**
 * api.js - Mobile API Bridge for Tea Tracker Android
 * Replaces the PyWebView bridge with a fully offline localStorage implementation.
 * Exposes the same API.get/post/put/delete interface as the desktop version.
 */

// Current session state
const Session = {
    _username: null,

    set(username) { this._username = username; localStorage.setItem('tea_session', username); },
    get() { return this._username || localStorage.getItem('tea_session') || null; },
    clear() { this._username = null; localStorage.removeItem('tea_session'); }
};

// ─── Business Logic Layer (mirrors Python TeaTrackerAPI) ────────────────────

const LocalAPI = {
    // ── Auth ────────────────────────────────────────────────────────────────
    async login(username, password) {
        const ok = await Auth.verify(username, password);
        if (ok) {
            Session.set(username.trim());
            DB.init(username.trim());
            return { success: true };
        }
        return { success: false, message: 'Invalid username or password.' };
    },

    async register(username, password) {
        const result = await Auth.register(username, password);
        if (result.success) {
            Session.set(username.trim());
            DB.init(username.trim());
        }
        return result;
    },

    logout() {
        Session.clear();
        return { success: true };
    },

    get_current_username() {
        return Session.get() || '';
    },

    // ── Dashboard ───────────────────────────────────────────────────────────
    get_dashboard_stats() {
        const db = DB;
        const teaEntries = db.getAll('tea_entries');
        const financialEntries = db.getAll('financial_entries');
        const loans = db.getAll('loans_debts');

        const totalTea = teaEntries.reduce((s, e) => s + (e.kilograms || 0), 0);
        const teaRevenue = teaEntries.reduce((s, e) => s + ((e.kilograms || 0) * (e.sellAmountPerKg || 30.0)), 0);
        const teaSalesExpenses = financialEntries
            .filter(e => (e.amount || 0) < 0 && (e.category || '').toLowerCase() === 'tea sales')
            .reduce((s, e) => s + Math.abs(e.amount || 0), 0);
        const netProfit = teaRevenue - teaSalesExpenses;
        const totalExpenses = teaEntries.reduce((s, e) => s + (e.amountToPay || 0), 0) +
            financialEntries.filter(e => (e.amount || 0) < 0).reduce((s, e) => s + Math.abs(e.amount || 0), 0);

        const now = new Date();
        const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthEnd = new Date(firstDayThisMonth - 1);
        const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);

        const parse = s => s ? new Date(s) : new Date(0);

        let lmTea = 0, lmRevenue = 0, lmSalesExpenses = 0, lmExpenses = 0;
        teaEntries.forEach(e => {
            const d = parse(e.date);
            if (d >= lastMonthStart && d <= lastMonthEnd) {
                lmTea += (e.kilograms || 0);
                lmRevenue += (e.kilograms || 0) * (e.sellAmountPerKg || 30.0);
                lmExpenses += (e.amountToPay || 0);
            }
        });
        financialEntries.forEach(e => {
            const d = parse(e.date);
            if (d >= lastMonthStart && d <= lastMonthEnd && (e.amount || 0) < 0) {
                lmExpenses += Math.abs(e.amount || 0);
                if ((e.category || '').toLowerCase() === 'tea sales') lmSalesExpenses += Math.abs(e.amount || 0);
            }
        });

        const activeLoans = loans.filter(l => ['active','pending'].includes((l.status || '').toLowerCase())).length;

        return {
            total_tea: totalTea,
            total_expenses: totalExpenses,
            net_profit: netProfit,
            active_loans: activeLoans,
            last_month: {
                tea_last_month: lmTea,
                expenses_last_month: lmExpenses,
                profit_last_month: lmRevenue - lmSalesExpenses
            }
        };
    },

    get_recent_activity() {
        const db = DB;
        const tea = [...db.getAll('tea_entries')].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const fins = [...db.getAll('financial_entries')].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return { tea_entries: tea.slice(0, 5), transactions: fins.slice(0, 5) };
    },

    // ── Tea Entries ─────────────────────────────────────────────────────────
    get_tea_entries() { return DB.getAll('tea_entries'); },
    create_tea_entry(data) { return DB.add('tea_entries', data); },
    get_tea_entry(id) { const r = DB.getById('tea_entries', id); if (!r) throw new Error('Entry not found'); return r; },
    update_tea_entry(id, data) { const r = DB.update('tea_entries', id, data); if (!r) throw new Error('Entry not found'); return r; },
    delete_tea_entry(id) { if (!DB.delete('tea_entries', id)) throw new Error('Entry not found'); return { message: 'Entry deleted successfully' }; },

    // ── Financial Entries ───────────────────────────────────────────────────
    get_financial_entries() { return DB.getAll('financial_entries'); },
    create_financial_entry(data) {
        const account = DB.getById('accounts', data.accountId || '');
        if (!account) throw new Error('Account not found');
        account.balance = (account.balance || 0) + (data.amount || 0);
        DB.update('accounts', data.accountId, account);
        return DB.add('financial_entries', data);
    },
    get_financial_entry(id) { const r = DB.getById('financial_entries', id); if (!r) throw new Error('Entry not found'); return r; },
    update_financial_entry(id, data) {
        const old = DB.getById('financial_entries', id);
        if (!old) throw new Error('Entry not found');
        const oldAcc = DB.getById('accounts', old.accountId || '');
        if (oldAcc) { oldAcc.balance = (oldAcc.balance || 0) - (old.amount || 0); DB.update('accounts', old.accountId, oldAcc); }
        const newAcc = DB.getById('accounts', data.accountId || '');
        if (newAcc) { newAcc.balance = (newAcc.balance || 0) + (data.amount || 0); DB.update('accounts', data.accountId, newAcc); }
        return DB.update('financial_entries', id, data);
    },
    delete_financial_entry(id) {
        const entry = DB.getById('financial_entries', id);
        if (!entry) throw new Error('Entry not found');
        const acc = DB.getById('accounts', entry.accountId || '');
        if (acc) { acc.balance = (acc.balance || 0) - (entry.amount || 0); DB.update('accounts', entry.accountId, acc); }
        DB.delete('financial_entries', id);
        return { message: 'Entry deleted successfully' };
    },

    // ── Accounts ────────────────────────────────────────────────────────────
    get_accounts() { return DB.getAll('accounts'); },
    create_account(data) { return DB.add('accounts', data); },
    get_account(id) { const r = DB.getById('accounts', id); if (!r) throw new Error('Account not found'); return r; },
    update_account(id, data) { const r = DB.update('accounts', id, data); if (!r) throw new Error('Account not found'); return r; },
    delete_account(id) { if (!DB.delete('accounts', id)) throw new Error('Account not found'); return { message: 'Account deleted successfully' }; },

    // ── Loans & Debts ───────────────────────────────────────────────────────
    get_loans_debts() { return DB.getAll('loans_debts'); },
    create_loan_debt(data) { return DB.add('loans_debts', data); },
    get_loan_debt(id) { const r = DB.getById('loans_debts', id); if (!r) throw new Error('Entry not found'); return r; },
    update_loan_debt(id, data) { const r = DB.update('loans_debts', id, data); if (!r) throw new Error('Entry not found'); return r; },
    delete_loan_debt(id) { if (!DB.delete('loans_debts', id)) throw new Error('Entry not found'); return { message: 'Entry deleted successfully' }; },

    // ── Expected Expenses ────────────────────────────────────────────────────
    get_expected_expenses() { return DB.getAll('expected_expenses'); },
    create_expected_expense(data) { return DB.add('expected_expenses', data); },
    update_expected_expense(id, data) { const r = DB.update('expected_expenses', id, data); if (!r) throw new Error('Expected expense not found'); return r; },
    delete_expected_expense(id) { if (!DB.delete('expected_expenses', id)) throw new Error('Expected expense not found'); return { message: 'Expected expense deleted successfully' }; },

    // ── Settings ─────────────────────────────────────────────────────────────
    get_settings() {
        const list = DB.getAll('settings');
        if (!list || list.length === 0) {
            const defaultSettings = {
                id: 1, theme: 'light', backgroundImage: null,
                backgroundColor: '#ffffff', fontFamily: 'Outfit', fontSize: 16,
                primaryColor: '#16a34a', secondaryColor: '#ffffff',
                modalOpacity: 0.5, currency: 'USD'
            };
            return DB.add('settings', defaultSettings);
        }
        return list[0];
    },
    update_settings(data) {
        const list = DB.getAll('settings');
        if (!list || list.length === 0) { data.id = 1; return DB.add('settings', data); }
        return DB.update('settings', String(list[0].id), data);
    },

    export_data() { return DB.getAllData(); },
    import_data(data) { if (!DB.replaceAll(data)) throw new Error('Failed to import data'); return { message: 'Data imported successfully' }; },

    // ── Account Details ───────────────────────────────────────────────────────
    async update_account_details(data) {
        const currentUser = Session.get();
        if (!currentUser) return { success: false, message: 'Not authenticated.' };
        const result = await Auth.updateAccountDetails(
            currentUser,
            data.current_password || '',
            data.new_username || '',
            data.new_password || ''
        );
        if (result.success && result.newUsername) {
            // Re-init DB for new username if changed
            if (result.newUsername !== currentUser) {
                const oldData = DB.getAllData();
                Session.set(result.newUsername);
                DB.init(result.newUsername);
                DB.replaceAll(oldData);
            }
        }
        return result;
    }
};

// ─── API Router (same interface as desktop api.js) ───────────────────────────

function getApiEndpointDetails(endpoint, method) {
    let cleaned = endpoint.replace(/^\/api/, '').replace(/^\/+/, '').replace(/\/+$/, '');
    const parts = cleaned.split('/');

    if (parts[0] === 'dashboard') {
        if (parts[1] === 'stats') return { func: 'get_dashboard_stats', args: [] };
        if (parts[1] === 'recent-activity') return { func: 'get_recent_activity', args: [] };
    } else if (parts[0] === 'tea-entries') {
        if (parts.length === 1) {
            if (method === 'GET') return { func: 'get_tea_entries', args: [] };
            if (method === 'POST') return { func: 'create_tea_entry', args: [] };
        } else {
            const id = parts[1];
            if (method === 'GET') return { func: 'get_tea_entry', args: [id] };
            if (method === 'PUT') return { func: 'update_tea_entry', args: [id] };
            if (method === 'DELETE') return { func: 'delete_tea_entry', args: [id] };
        }
    } else if (parts[0] === 'finances') {
        if (parts.length === 1) {
            if (method === 'GET') return { func: 'get_financial_entries', args: [] };
            if (method === 'POST') return { func: 'create_financial_entry', args: [] };
        } else {
            const id = parts[1];
            if (method === 'GET') return { func: 'get_financial_entry', args: [id] };
            if (method === 'PUT') return { func: 'update_financial_entry', args: [id] };
            if (method === 'DELETE') return { func: 'delete_financial_entry', args: [id] };
        }
    } else if (parts[0] === 'accounts') {
        if (parts.length === 1) {
            if (method === 'GET') return { func: 'get_accounts', args: [] };
            if (method === 'POST') return { func: 'create_account', args: [] };
        } else {
            const id = parts[1];
            if (method === 'GET') return { func: 'get_account', args: [id] };
            if (method === 'PUT') return { func: 'update_account', args: [id] };
            if (method === 'DELETE') return { func: 'delete_account', args: [id] };
        }
    } else if (parts[0] === 'loans-debts') {
        if (parts.length === 1) {
            if (method === 'GET') return { func: 'get_loans_debts', args: [] };
            if (method === 'POST') return { func: 'create_loan_debt', args: [] };
        } else {
            const id = parts[1];
            if (method === 'GET') return { func: 'get_loan_debt', args: [id] };
            if (method === 'PUT') return { func: 'update_loan_debt', args: [id] };
            if (method === 'DELETE') return { func: 'delete_loan_debt', args: [id] };
        }
    } else if (parts[0] === 'expected-expenses') {
        if (parts.length === 1) {
            if (method === 'GET') return { func: 'get_expected_expenses', args: [] };
            if (method === 'POST') return { func: 'create_expected_expense', args: [] };
        } else {
            const id = parts[1];
            if (method === 'PUT') return { func: 'update_expected_expense', args: [id] };
            if (method === 'DELETE') return { func: 'delete_expected_expense', args: [id] };
        }
    } else if (parts[0] === 'settings') {
        if (parts.length === 1) {
            if (method === 'GET') return { func: 'get_settings', args: [] };
            if (method === 'PUT') return { func: 'update_settings', args: [] };
        } else if (parts[1] === 'export') {
            return { func: 'export_data', args: [] };
        } else if (parts[1] === 'import') {
            return { func: 'import_data', args: [] };
        }
    } else if (parts[0] === 'account' && parts[1] === 'update') {
        return { func: 'update_account_details', args: [] };
    }
    throw new Error('Unknown API endpoint: ' + endpoint);
}

const API = {
    async _call(endpoint, method, data) {
        const details = getApiEndpointDetails(endpoint, method);
        const funcName = details.func;
        const args = [...details.args];
        if (method === 'POST' || method === 'PUT') args.push(data);

        const fn = LocalAPI[funcName];
        if (!fn) throw new Error('API function not found: ' + funcName);

        try {
            const response = await fn.apply(LocalAPI, args);
            if (response && response.success === false) {
                throw new Error(response.message || 'Operation failed');
            }
            return response;
        } catch (err) {
            console.error('API Error in ' + funcName + ':', err);
            throw err;
        }
    },
    async get(endpoint, data) { return this._call(endpoint, 'GET', data); },
    async post(endpoint, data) { return this._call(endpoint, 'POST', data); },
    async put(endpoint, data) { return this._call(endpoint, 'PUT', data); },
    async delete(endpoint) { return this._call(endpoint, 'DELETE'); }
};

function formatCurrency(amount) {
    const currency = (window.appSettings && window.appSettings.currency) || 'USD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
}
