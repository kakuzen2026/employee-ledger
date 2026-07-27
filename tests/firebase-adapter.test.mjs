import assert from 'node:assert/strict';
import test from 'node:test';

function clone(value) {
  return structuredClone(value);
}

function createFirebaseMock(seed, signInUser = null) {
  const stores = new Map(Object.entries(seed)
    .filter(([table]) => table !== '_counters' && table !== '_blobs')
    .map(([table, rows]) => [table, new Map(rows.map((row) => [String(row.id), clone(row)]))]));
  const counter = new Map(Object.entries(seed._counters || {}));
  const blobs = new Map(Object.entries(seed._blobs || {}).map(([id, value]) => [id, clone(value)]));
  const app = {};
  const authClient = {
    currentUser: null,
    onAuthStateChanged(callback) {
      queueMicrotask(() => callback(null));
      return () => {};
    },
    signInWithEmailAndPassword: async () => {
      if (!signInUser) throw new Error('not used');
      authClient.currentUser = signInUser;
      return { user: signInUser };
    },
    signOut: async () => { authClient.currentUser = null; }
  };

  function refFor(table, id) {
    return {
      async get() {
        if (table === '_meta' && id === 'counters') {
          return { exists: true, data: () => Object.fromEntries(counter) };
        }
        const row = stores.get(table)?.get(String(id));
        return { exists: Boolean(row), data: () => clone(row) };
      },
      async set(value, options = {}) {
        const current = stores.get(table)?.get(String(id)) || {};
        if (!stores.has(table)) stores.set(table, new Map());
        stores.get(table).set(String(id), clone(options.merge ? { ...current, ...value } : value));
      },
      async delete() {
        stores.get(table)?.delete(String(id));
      },
      _counter: table === '_meta' && id === 'counters'
    };
  }

  const firestore = {
    collection(table) {
      return {
        async get() {
          const rows = [...(stores.get(table)?.entries() || [])];
          return {
            docs: rows.map(([id, row]) => ({ id, data: () => clone(row) }))
          };
        },
        doc(id) { return refFor(table, id); }
      };
    },
    async runTransaction(work) {
      return work({
        get: (reference) => reference.get(),
        update: (reference, patch) => {
          if (!reference._counter) throw new Error('unexpected transaction target');
          Object.entries(patch).forEach(([key, value]) => counter.set(key, value));
        }
      });
    }
  };

  const realtime = {
    ref(path) {
      const id = String(path).split('/').at(-1);
      return {
        once: async () => ({ exists: () => blobs.has(id), val: () => clone(blobs.get(id) || null) }),
        set: async (value) => { blobs.set(id, clone(value)); }
      };
    }
  };

  return {
    apps: [],
    initializeApp() { this.apps.push(app); return app; },
    app() { return app; },
    auth() { return authClient; },
    firestore() { return firestore; },
    database() { return realtime; }
  };
}

test('Firestore adapter keeps relation selection, filtering, ID allocation, and mutations compatible', async () => {
  const blobId = 'a'.repeat(64);
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({
    _counters: { clients: 1, sites: 2, work_patterns: 3 },
    _blobs: { [blobId]: { data: 'data:image/png;base64,AAA' } },
    clients: [{ id: 1, name: '顧客A' }],
    sites: [{ id: 2, client_id: 1, name: '現場A' }],
    work_patterns: [{ id: 3, site_id: 2, pattern_name: '日勤' }],
    employees: [{ id: 1, residence_card_imgs: [`firebase-rtdb://blobs/migration-v1/${blobId}`] }]
  });

  await import(`../assets/js/firebase-adapter.js?test=${Date.now()}`);
  const db = globalThis.createFirebaseDb();

  const selected = await db.from('sites')
    .select('*,clients(name),work_patterns(*)')
    .eq('id', 2)
    .single();
  assert.equal(selected.error, null);
  assert.equal(selected.data.clients.name, '顧客A');
  assert.equal(selected.data.work_patterns[0].pattern_name, '日勤');

  const employee = await db.from('employees').select('id,residence_card_imgs').single();
  assert.equal(employee.error, null);
  assert.equal(employee.data.residence_card_imgs[0], 'data:image/png;base64,AAA');

  const inserted = await db.from('clients').insert({ name: '顧客B' }).select('id,name').single();
  assert.equal(inserted.error, null);
  assert.equal(inserted.data.id, 2);
  assert.equal(inserted.data.name, '顧客B');

  const updated = await db.from('clients').update({ name: '顧客B更新' }).eq('id', 2).select('name').single();
  assert.equal(updated.error, null);
  assert.equal(updated.data.name, '顧客B更新');

  const deleted = await db.from('clients').delete().eq('id', 2);
  assert.equal(deleted.error, null);
  const missing = await db.from('clients').select('*').eq('id', 2).maybeSingle();
  assert.equal(missing.data, null);
});

test('Firebase adapter signs out a user without the administrator claim', async () => {
  const member = {
    uid: 'member', email: 'member@example.test',
    getIdTokenResult: async () => ({ claims: {} }),
    getIdToken: async () => 'test-token'
  };
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({}, member);

  await import(`../assets/js/firebase-adapter.js?nonadmin=${Date.now()}`);
  const db = globalThis.createFirebaseDb();
  const result = await db.auth.signInWithPassword({ email: member.email, password: 'not-a-real-password' });

  assert.ok(result.error);
  assert.equal(db.authClient.currentUser, null);
});
