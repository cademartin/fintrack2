/**
 * db.js — Offline localStorage-based JSON Database
 * Replicates the Python JsonDB class for the Android/browser environment.
 * Data is stored per-user under key: tea_db_<username>
 */
const DB = {
    _currentUser: null,
    _key: null,
    _data: null,

    init(username) {
        this._currentUser = username;
        this._key = 'tea_db_' + username.toLowerCase();
        this._load();
    },

    _load() {
        try {
            const raw = localStorage.getItem(this._key);
            this._data = raw ? JSON.parse(raw) : {
                tea_entries: [],
                financial_entries: [],
                accounts: [],
                loans_debts: [],
                expected_expenses: [],
                settings: []
            };
        } catch (e) {
            console.error('DB load error:', e);
            this._data = { tea_entries: [], financial_entries: [], accounts: [], loans_debts: [], expected_expenses: [], settings: [] };
        }
    },

    _save() {
        try {
            localStorage.setItem(this._key, JSON.stringify(this._data));
        } catch (e) {
            console.error('DB save error:', e);
        }
    },

    _ensureCollection(collection) {
        if (!this._data[collection]) this._data[collection] = [];
    },

    _genId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    getAll(collection) {
        this._load();
        this._ensureCollection(collection);
        return [...this._data[collection]];
    },

    getById(collection, id) {
        this._load();
        this._ensureCollection(collection);
        return this._data[collection].find(item => String(item.id) === String(id)) || null;
    },

    add(collection, data) {
        this._load();
        this._ensureCollection(collection);
        const item = { ...data, id: data.id !== undefined ? data.id : this._genId() };
        this._data[collection].push(item);
        this._save();
        return item;
    },

    update(collection, id, data) {
        this._load();
        this._ensureCollection(collection);
        const idx = this._data[collection].findIndex(item => String(item.id) === String(id));
        if (idx === -1) return null;
        const updated = { ...this._data[collection][idx], ...data, id: this._data[collection][idx].id };
        this._data[collection][idx] = updated;
        this._save();
        return updated;
    },

    delete(collection, id) {
        this._load();
        this._ensureCollection(collection);
        const idx = this._data[collection].findIndex(item => String(item.id) === String(id));
        if (idx === -1) return false;
        this._data[collection].splice(idx, 1);
        this._save();
        return true;
    },

    getAllData() {
        this._load();
        return { ...this._data };
    },

    replaceAll(data) {
        try {
            this._data = data;
            this._save();
            return true;
        } catch (e) {
            console.error('replaceAll error:', e);
            return false;
        }
    },

    isInitialized() {
        return this._currentUser !== null;
    }
};
