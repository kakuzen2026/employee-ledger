// Firebase adapter for the existing static UI. It keeps the small Supabase-like
// surface used by the app while storing every record in the migrated collection.
(() => {
  'use strict';

  const FIREBASE_CONFIG = Object.freeze({
    apiKey: 'AIzaSyAL4q3AbLQNA6J-BSL1jbYIkrvxUDXINtA',
    authDomain: 'kakuzen-employee-ledger.firebaseapp.com',
    projectId: 'kakuzen-employee-ledger',
    databaseURL: 'https://kakuzen-employee-ledger-default-rtdb.asia-southeast1.firebasedatabase.app',
    storageBucket: 'kakuzen-employee-ledger.firebasestorage.app',
    messagingSenderId: '866192461818',
    appId: '1:866192461818:web:4a92a44d4f8d7aae711e43'
  });
  const TABLES = new Set([
    'settings', 'clients', 'sites', 'assignments', 'billing', 'contracts',
    'doc_templates', 'work_patterns', 'contract_employees', 'employee_records',
    'departments', 'visa_types', 'emp_work_patterns', 'company_info', 'employees',
    'yukyu_records', 'yukyu_grants', 'certificates', 'employment_contracts',
    'dispatch_contracts'
  ]);
  const BLOB_PREFIX = 'firebase-rtdb://blobs/migration-v1/';

  function appError(message, cause) {
    const error = new Error(message);
    if (cause) error.cause = cause;
    return error;
  }

  function equal(left, right) {
    return left === right || (left != null && right != null && String(left) === String(right));
  }

  function compare(left, right) {
    if (left == null && right == null) return 0;
    if (left == null) return -1;
    if (right == null) return 1;
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), 'ja');
  }

  function splitTopLevel(value) {
    const tokens = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i += 1) {
      if (value[i] === '(') depth += 1;
      if (value[i] === ')') depth -= 1;
      if (value[i] === ',' && depth === 0) {
        tokens.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
    const finalToken = value.slice(start).trim();
    if (finalToken) tokens.push(finalToken);
    return tokens.filter(Boolean);
  }

  function parseSelection(selection) {
    return splitTopLevel(selection || '*').map((token) => {
      const relation = token.match(/^([a-z_]+)\((.*)\)$/i);
      return relation
        ? { type: 'relation', name: relation[1], selection: parseSelection(relation[2]) }
        : { type: 'field', name: token };
    });
  }

  function isDataUrl(value) {
    return typeof value === 'string' && /^data:[^,]+,/i.test(value);
  }

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  class FirebaseQuery {
    constructor(adapter, table) {
      this.adapter = adapter;
      this.table = table;
      this.mode = 'select';
      this.selection = '*';
      this.filters = [];
      this.orders = [];
      this.maximum = null;
      this.one = false;
      this.optional = false;
      this.payload = null;
    }

    select(selection = '*') { this.selection = selection; return this; }
    eq(field, value) { this.filters.push((row) => equal(row[field], value)); return this; }
    in(field, values) {
      const accepted = Array.isArray(values) ? values : [];
      this.filters.push((row) => accepted.some((value) => equal(row[field], value)));
      return this;
    }
    gte(field, value) { this.filters.push((row) => compare(row[field], value) >= 0); return this; }
    lte(field, value) { this.filters.push((row) => compare(row[field], value) <= 0); return this; }
    like(field, pattern) {
      const expression = '^' + String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$';
      const regex = new RegExp(expression);
      this.filters.push((row) => regex.test(String(row[field] ?? '')));
      return this;
    }
    order(field, options = {}) {
      this.orders.push({ field, ascending: options.ascending !== false });
      return this;
    }
    limit(value) { this.maximum = Number(value); return this; }
    maybeSingle() { this.one = true; this.optional = true; return this; }
    single() { this.one = true; this.optional = false; return this; }
    insert(payload) { this.mode = 'insert'; this.payload = payload; return this; }
    update(payload) { this.mode = 'update'; this.payload = payload; return this; }
    delete() { this.mode = 'delete'; return this; }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }

    async execute() {
      try {
        if (this.mode === 'select') return await this.selectRows();
        if (this.mode === 'insert') return await this.insertRows();
        if (this.mode === 'update') return await this.updateRows();
        return await this.deleteRows();
      } catch (error) {
        return { data: null, error: appError(error.message || 'Firebaseへの操作に失敗しました。', error) };
      }
    }

    async selectRows() {
      const context = { cache: new Map() };
      let rows = (await this.adapter.readRows(this.table, context)).filter((row) => this.matches(row));
      rows = this.sort(rows);
      if (Number.isFinite(this.maximum)) rows = rows.slice(0, Math.max(0, this.maximum));
      const data = await Promise.all(rows.map((row) => this.adapter.projectRow(this.table, row, parseSelection(this.selection), context)));
      return this.finalize(data);
    }

    async insertRows() {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const created = [];
      for (const row of rows) created.push(await this.adapter.insertRow(this.table, row));
      const context = { cache: new Map([[this.table, Promise.resolve(created)]]) };
      const data = await Promise.all(created.map((row) => this.adapter.projectRow(this.table, row, parseSelection(this.selection), context)));
      return this.finalize(data);
    }

    async updateRows() {
      const context = { cache: new Map() };
      const targets = (await this.adapter.readRows(this.table, context)).filter((row) => this.matches(row));
      const updated = [];
      for (const target of targets) updated.push(await this.adapter.updateRow(this.table, target, this.payload));
      const outputContext = { cache: new Map([[this.table, Promise.resolve(updated)]]) };
      const data = await Promise.all(updated.map((row) => this.adapter.projectRow(this.table, row, parseSelection(this.selection), outputContext)));
      return this.finalize(data);
    }

    async deleteRows() {
      const context = { cache: new Map() };
      const targets = (await this.adapter.readRows(this.table, context)).filter((row) => this.matches(row));
      await Promise.all(targets.map((row) => this.adapter.deleteRow(this.table, row)));
      return this.finalize([]);
    }

    matches(row) { return this.filters.every((filter) => filter(row)); }

    sort(rows) {
      if (!this.orders.length) return rows;
      return [...rows].sort((left, right) => {
        for (const { field, ascending } of this.orders) {
          const result = compare(left[field], right[field]);
          if (result) return ascending ? result : -result;
        }
        return 0;
      });
    }

    finalize(rows) {
      if (!this.one) return { data: rows, error: null };
      if (rows.length === 1) return { data: rows[0], error: null };
      if (rows.length === 0 && this.optional) return { data: null, error: null };
      return { data: null, error: appError('対象のレコードを一意に取得できませんでした。') };
    }
  }

  class FirebaseAdapter {
    constructor() {
      if (!window.firebase) throw appError('Firebase SDKの読み込みに失敗しました。');
      this.app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
      this.authClient = firebase.auth(this.app);
      this.firestore = firebase.firestore(this.app);
      this.realtime = firebase.database(this.app);
      this.blobCache = new Map();
      this.authReady = new Promise((resolve) => {
        let unsubscribe = () => {};
        unsubscribe = this.authClient.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });
      });
    }

    auth = {
      getSession: async () => {
        const user = await this.currentAdmin();
        return { data: { session: user ? await this.sessionFor(user) : null }, error: null };
      },
      signInWithPassword: async ({ email, password }) => {
        try {
          const credential = await this.authClient.signInWithEmailAndPassword(email, password);
          const session = await this.sessionFor(credential.user, true);
          if (!session) {
            await this.authClient.signOut();
            return { error: appError('このアカウントには管理台帳へのアクセス権限がありません。') };
          }
          return { data: { session }, error: null };
        } catch (error) {
          return { error: appError('メールアドレスまたはパスワードを確認してください。', error) };
        }
      },
      signOut: async () => this.authClient.signOut()
    };

    from(table) {
      if (!TABLES.has(table)) throw appError('許可されていないデータ種別です。');
      return new FirebaseQuery(this, table);
    }

    async currentAdmin() {
      await this.authReady;
      const user = this.authClient.currentUser;
      if (!user) return null;
      const token = await user.getIdTokenResult();
      return token.claims.ledger_admin === true ? user : null;
    }

    async sessionFor(user, forceRefresh = false) {
      const token = await user.getIdTokenResult(forceRefresh);
      if (token.claims.ledger_admin !== true) return null;
      return { access_token: await user.getIdToken(), user: { id: user.uid, email: user.email || null } };
    }

    async readRows(table, context) {
      if (!context.cache.has(table)) {
        context.cache.set(table, this.firestore.collection(table).get().then((snapshot) => snapshot.docs.map((doc) => {
          const data = doc.data() || {};
          return { ...data, id: data.id == null ? doc.id : data.id, __documentId: doc.id };
        })));
      }
      return context.cache.get(table);
    }

    async projectRow(table, row, selection, context) {
      const output = {};
      const hasWildcard = selection.some((item) => item.type === 'field' && item.name === '*');
      if (hasWildcard) {
        Object.entries(row).forEach(([key, value]) => {
          if (key !== '__documentId') output[key] = value;
        });
      }
      for (const item of selection) {
        if (item.type === 'field' && item.name !== '*') output[item.name] = row[item.name];
        if (item.type === 'relation') output[item.name] = await this.projectRelation(table, row, item, context);
      }
      return this.rehydrateAttachments(output);
    }

    async projectRelation(table, row, relation, context) {
      const relationship = this.relationFor(table, row, relation.name);
      if (!relationship) return relation.name === 'contract_employees' ? [] : null;
      const targetRows = await this.readRows(relationship.table, context);
      const matching = targetRows.filter(relationship.match);
      if (relationship.many) {
        return Promise.all(matching.map((target) => this.projectRow(relationship.table, target, relation.selection, context)));
      }
      return matching.length
        ? this.projectRow(relationship.table, matching[0], relation.selection, context)
        : null;
    }

    relationFor(table, row, name) {
      if (name === 'clients' && row.client_id != null) {
        return { table: 'clients', many: false, match: (target) => equal(target.id, row.client_id) };
      }
      if (name === 'sites' && row.site_id != null) {
        return { table: 'sites', many: false, match: (target) => equal(target.id, row.site_id) };
      }
      if (name === 'work_patterns' && table === 'sites') {
        return { table: 'work_patterns', many: true, match: (target) => equal(target.site_id, row.id) };
      }
      if (name === 'contract_employees' && table === 'contracts') {
        return { table: 'contract_employees', many: true, match: (target) => equal(target.contract_id, row.id) };
      }
      return null;
    }

    async nextId(table) {
      const counter = this.firestore.collection('_meta').doc('counters');
      return this.firestore.runTransaction(async (transaction) => {
        const current = await transaction.get(counter);
        if (!current.exists) throw appError('ID採番用の管理文書がありません。');
        const counters = current.data() || {};
        const value = Number(counters[table]);
        if (!Number.isSafeInteger(value) || value < 0) throw appError('ID採番情報が不正です。');
        const next = value + 1;
        transaction.update(counter, { [table]: next });
        return next;
      });
    }

    async insertRow(table, input) {
      if (!isPlainObject(input)) throw appError('登録内容が不正です。');
      const id = input.id == null ? await this.nextId(table) : input.id;
      const stored = await this.prepareForStorage({ ...input, id });
      const documentId = String(id);
      const reference = this.firestore.collection(table).doc(documentId);
      const existing = await reference.get();
      if (existing.exists) throw appError('同じIDのレコードが既に存在します。');
      await reference.set(stored);
      return { ...stored, __documentId: documentId };
    }

    async updateRow(table, current, patch) {
      if (!isPlainObject(patch)) throw appError('更新内容が不正です。');
      const stored = await this.prepareForStorage(patch);
      const documentId = current.__documentId || String(current.id);
      await this.firestore.collection(table).doc(documentId).set(stored, { merge: true });
      return { ...current, ...stored, __documentId: documentId };
    }

    async deleteRow(table, row) {
      const documentId = row.__documentId || String(row.id);
      await this.firestore.collection(table).doc(documentId).delete();
    }

    async prepareForStorage(value) {
      if (Array.isArray(value)) return Promise.all(value.map((item) => this.prepareForStorage(item)));
      if (!isPlainObject(value)) {
        if (!isDataUrl(value)) return value;
        return this.storeBlob(value);
      }
      const output = {};
      for (const [key, item] of Object.entries(value)) {
        if (item !== undefined) output[key] = await this.prepareForStorage(item);
      }
      return output;
    }

    async storeBlob(dataUrl) {
      const blobId = await sha256(dataUrl);
      const blobRef = this.realtime.ref(`blobs/migration-v1/${blobId}`);
      const existing = await blobRef.once('value');
      if (!existing.exists()) await blobRef.set({ data: dataUrl, created_at: new Date().toISOString() });
      return BLOB_PREFIX + blobId;
    }

    async rehydrateAttachments(value) {
      if (Array.isArray(value)) return Promise.all(value.map((item) => this.rehydrateAttachments(item)));
      if (typeof value === 'string' && value.startsWith(BLOB_PREFIX)) return this.loadBlob(value.slice(BLOB_PREFIX.length));
      if (!isPlainObject(value)) return value;
      const output = {};
      for (const [key, item] of Object.entries(value)) output[key] = await this.rehydrateAttachments(item);
      return output;
    }

    async loadBlob(blobId) {
      if (!/^[a-f0-9]{64}$/.test(blobId)) throw appError('添付参照が不正です。');
      if (!this.blobCache.has(blobId)) {
        this.blobCache.set(blobId, this.realtime.ref(`blobs/migration-v1/${blobId}`).once('value').then((snapshot) => {
          const value = snapshot.val();
          if (!value || typeof value.data !== 'string') throw appError('添付ファイルが見つかりません。');
          return value.data;
        }));
      }
      return this.blobCache.get(blobId);
    }
  }

  window.createFirebaseDb = () => new FirebaseAdapter();
})();
