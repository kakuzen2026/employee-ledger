import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

function clone(value) {
  return structuredClone(value);
}

function createFirebaseMock(seed, signInUser = null, onTransactionRead = null) {
  const stores = new Map(Object.entries(seed)
    .filter(([table]) => table !== '_counters' && table !== '_blobs')
    .map(([table, rows]) => [table, new Map(rows.map((row) => [String(row.id), clone(row)]))]));
  const counter = new Map(Object.entries(seed._counters || {}));
  const blobs = new Map(Object.entries(seed._blobs || {}).map(([id, value]) => [id, clone(value)]));
  const versions = new Map();
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
    const key = `${table}/${id}`;
    const touch = () => versions.set(key, (versions.get(key) || 0) + 1);
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
        touch();
      },
      async delete() {
        stores.get(table)?.delete(String(id));
        touch();
      },
      _counter: table === '_meta' && id === 'counters',
      _key: key,
      _version: () => versions.get(key) || 0
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
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const reads = new Map();
        const writes = [];
        const result = await work({
          async get(reference) {
            const snapshot = await reference.get();
            reads.set(reference._key, reference._version());
            if (attempt === 0 && onTransactionRead) await onTransactionRead(reference);
            return snapshot;
          },
          update(reference, patch) {
            writes.push({ type: 'update', reference, patch });
          },
          delete(reference) {
            writes.push({ type: 'delete', reference });
          }
        });
        if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) continue;
        for (const write of writes) {
          if (write.type === 'delete') await write.reference.delete();
          else if (write.reference._counter) Object.entries(write.patch).forEach(([key, value]) => counter.set(key, value));
          else await write.reference.set(write.patch, { merge: true });
        }
        return result;
      }
      throw new Error('transaction conflict');
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

function createTwoPartyBarrier() {
  let arrivals = 0;
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  return async () => {
    arrivals += 1;
    if (arrivals === 2) release();
    await ready;
  };
}

test('Firestore adapter keeps relation selection, filtering, ID allocation, and mutations compatible', async () => {
  const blobId = 'a'.repeat(64);
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({
    _counters: { clients: 1, sites: 2, work_patterns: 3, departments: 14, employment_contracts: 0 },
    _blobs: { [blobId]: { data: 'data:image/png;base64,AAA' } },
    clients: [{ id: 1, name: '顧客A' }],
    sites: [{ id: 2, client_id: 1, name: '現場A' }],
    work_patterns: [{ id: 3, site_id: 2, pattern_name: '日勤' }],
    employees: [{ id: 1, residence_card_imgs: [`firebase-rtdb://blobs/migration-v1/${blobId}`] }],
    departments: [{ id: 14, shozoku1: '既存部署', sort_order: 1 }]
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
  assert.match(inserted.data.id, /^[0-9a-f-]{36}$/i);
  assert.equal(inserted.data.name, '顧客B');

  const department = await db.from('departments')
    .insert({ shozoku1: '新規部署', shozoku2: '', sort_order: 2 })
    .select('id,shozoku1,sort_order')
    .single();
  assert.equal(department.error, null);
  assert.equal(department.data.id, 15);
  assert.equal(department.data.sort_order, 2);

  const employmentContract = await db.from('employment_contracts')
    .insert({
      template_id: 'mhlw-general-worker-2026-10-ready-v1',
      terms: {
        place_scope: '変更なし',
        renew_limit: 'none',
        premium_rates: { overtime: '25%以上', holiday: '35%以上' }
      }
    })
    .select('*')
    .single();
  assert.equal(employmentContract.error, null);
  assert.equal(employmentContract.data.id, 1);
  assert.deepEqual(employmentContract.data.terms, {
    place_scope: '変更なし',
    renew_limit: 'none',
    premium_rates: { overtime: '25%以上', holiday: '35%以上' }
  });

  const updated = await db.from('clients').update({ name: '顧客B更新' }).eq('id', inserted.data.id).select('name').single();
  assert.equal(updated.error, null);
  assert.equal(updated.data.name, '顧客B更新');

  const deleted = await db.from('clients').delete().eq('id', inserted.data.id);
  assert.equal(deleted.error, null);
  const missing = await db.from('clients').select('*').eq('id', inserted.data.id).maybeSingle();
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

test('Department creation assigns the next persisted sort order', async () => {
  const inserted = [];
  const context = {
    departments: [{ sort_order: 2 }, { sort_order: 7 }, { sort_order: null }],
    db: {
      from(table) {
        assert.equal(table, 'departments');
        return {
          insert(row) {
            inserted.push(row);
            return Promise.resolve({ data: [row], error: null });
          }
        };
      }
    }
  };
  const source = await readFile(new URL('../assets/js/employee-api.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);

  const created = await context.createDepartment({ shozoku1: '新規部署', shozoku2: '' });
  assert.equal(created[0].sort_order, 8);
  assert.equal(inserted[0].sort_order, 8);
});

test('Company information can be created when the migrated collection is empty', async () => {
  const inserts = [];
  const context = {
    db: {
      from(table) {
        assert.equal(table, 'company_info');
        return {
          select() { return this; },
          limit() { return this; },
          maybeSingle: async () => ({ data: null, error: null }),
          insert(row) {
            inserts.push(row);
            return Promise.resolve({ data: [row], error: null });
          }
        };
      }
    }
  };
  const source = await readFile(new URL('../assets/js/employee-api.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);

  const saved = await context.updateCompanyInfo({ company_name: 'テスト会社' });
  assert.equal(saved[0].company_name, 'テスト会社');
  assert.equal(inserts.length, 1);
});

test('Firebase adapter identifies the table when the ID counter is unavailable', async () => {
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({ _counters: {} });

  await import(`../assets/js/firebase-adapter.js?counter-error=${Date.now()}`);
  const db = globalThis.createFirebaseDb();
  const { error } = await db.from('departments').insert({ shozoku1: 'テスト部署' });

  assert.ok(error);
  assert.match(error.message, /departments/);
  assert.match(error.message, /ID採番/);
});

test('UUID-backed collections can create records without numeric counters', async () => {
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({ _counters: {} });

  await import(`../assets/js/firebase-adapter.js?uuid-create=${Date.now()}`);
  const db = globalThis.createFirebaseDb();
  const { data, error } = await db.from('clients').insert({ name: 'テスト取引先' }).select('id').single();

  assert.equal(error, null);
  assert.match(data.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('Paid-leave transaction updates lazy-upgrade legacy revisions and increment current revisions', async () => {
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({
    yukyu_grants: [{ id: 1, days: null }],
    yukyu_records: [{ id: 2, use_type: '全日', _revision: 3 }]
  });

  await import(`../assets/js/firebase-adapter.js?revision-update=${Date.now()}`);
  const db = globalThis.createFirebaseDb();
  const legacy = await db.updateByRevision('yukyu_grants', 1, 0, { days: 10 });
  const current = await db.updateByRevision('yukyu_records', 2, 3, { use_type: '半休（午前）' });

  assert.equal(legacy.error, null);
  assert.equal(legacy.data[0]._revision, 1);
  assert.equal(current.error, null);
  assert.equal(current.data[0]._revision, 4);
});

test('Paid-leave transaction rejects a stale concurrent update and keeps the first committed value', async () => {
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({
    yukyu_grants: [{ id: 1, days: 10 }]
  }, null, createTwoPartyBarrier());

  await import(`../assets/js/firebase-adapter.js?stale-update=${Date.now()}`);
  const db = globalThis.createFirebaseDb();
  const results = await Promise.all([
    db.updateByRevision('yukyu_grants', 1, 0, { days: 12 }),
    db.updateByRevision('yukyu_grants', 1, 0, { days: 15 })
  ]);
  const success = results.find(result => result.error === null);
  const stale = results.find(result => result.error?.code === 'STALE_WRITE');
  const saved = await db.from('yukyu_grants').select('*').eq('id', 1).single();

  assert.ok(success);
  assert.ok(stale);
  assert.equal(stale.error.message, '別の端末またはタブでこの記録が更新されています。最新内容を表示しました。確認してからもう一度操作してください。');
  assert.equal(saved.data.days, success.data[0].days);
  assert.equal(saved.data._revision, 1);
});

test('Paid-leave transaction rejects stale deletes and permits a current delete', async () => {
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({
    yukyu_records: [{ id: 2, use_type: '全日', _revision: 4 }]
  });

  await import(`../assets/js/firebase-adapter.js?revision-delete=${Date.now()}`);
  const db = globalThis.createFirebaseDb();
  const updated = await db.updateByRevision('yukyu_records', 2, 4, { use_type: '半休（午後）' });
  const staleDelete = await db.deleteByRevision('yukyu_records', 2, 4);
  const present = await db.from('yukyu_records').select('*').eq('id', 2).single();
  const currentDelete = await db.deleteByRevision('yukyu_records', 2, 5);
  const missing = await db.from('yukyu_records').select('*').eq('id', 2).maybeSingle();

  assert.equal(updated.data[0]._revision, 5);
  assert.equal(staleDelete.error.code, 'STALE_WRITE');
  assert.equal(present.data._revision, 5);
  assert.equal(currentDelete.error, null);
  assert.equal(missing.data, null);
});

test('Paid-leave transaction fails closed for invalid expected or stored revisions', async () => {
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({
    yukyu_grants: [
      { id: 1, _revision: 'abc' },
      { id: 2, _revision: -1 },
      { id: 3, _revision: 1.5 },
      { id: 4, _revision: 0 }
    ]
  });

  await import(`../assets/js/firebase-adapter.js?invalid-revision=${Date.now()}`);
  const db = globalThis.createFirebaseDb();
  for (const id of [1, 2, 3]) {
    const result = await db.updateByRevision('yukyu_grants', id, 0, { days: 10 });
    assert.equal(result.error.code, 'STALE_WRITE');
  }
  for (const expected of ['0', -1, 1.5, Number.NaN]) {
    const result = await db.updateByRevision('yukyu_grants', 4, expected, { days: 10 });
    assert.equal(result.error.code, 'STALE_WRITE');
  }
});

test('Paid-leave API forces revision 1 for new rows and forwards expected revisions', async () => {
  const inserted = [];
  const updates = [];
  const deletes = [];
  const context = {
    db: {
      from(table) {
        return { insert(row) { inserted.push({ table, row }); return Promise.resolve({ data: Array.isArray(row) ? row : [row], error: null }); } };
      },
      updateByRevision(table, id, expectedRevision, patch) {
        updates.push({ table, id, expectedRevision, patch });
        return Promise.resolve({ data: [patch], error: null });
      },
      deleteByRevision(table, id, expectedRevision) {
        deletes.push({ table, id, expectedRevision });
        return Promise.resolve({ data: [], error: null });
      }
    }
  };
  const source = await readFile(new URL('../assets/js/employee-api.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context);

  await context.createYukyuGrants([{ id: -10, _revision: 99 }]);
  await context.saveYukyuGrant(null, { employee_id: 1, _revision: 98 });
  await context.createYukyuRecord({ employee_id: 1, _revision: 97 });
  await context.saveYukyuGrant(-10, { days: 0, _revision: 96 }, 3);
  await context.updateYukyuRecord(11, { use_type: '全日', _revision: 95 }, 4);
  await context.deleteYukyuGrant(-10, 3);
  await context.deleteYukyuRecord(11, 4);

  const createdRows = inserted.flatMap(call => Array.isArray(call.row) ? call.row : [call.row]);
  assert.deepEqual(createdRows.map(row => row._revision), [1, 1, 1]);
  assert.deepEqual(updates.map(call => [call.table, call.expectedRevision]), [['yukyu_grants', 3], ['yukyu_records', 4], ['yukyu_grants', 3]]);
  assert.equal(updates[2].patch.deleted, true);
  assert.equal(updates[2].patch.days, 0);
  assert.deepEqual(deletes.map(call => [call.table, call.expectedRevision]), [['yukyu_records', 4]]);
});

test('Dynamic employee actions use delegated click handlers', async () => {
  const [core, settings, detail, paidLeave, html] = await Promise.all([
    readFile(new URL('../assets/js/employee-core.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/js/employee-settings-docs.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/js/employee-list-detail.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/js/paid-leave-csv.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);

  assert.match(core, /closest\?\.\('\[data-employee-action\]'\)/);
  assert.match(core, /closest\?\.\('\[data-employee-change\]'\)/);
  assert.match(core, /employeeChange==='contract-type'/);
  assert.match(core, /getElementById\('deptModal'\)\.classList\.add\('open'\)/);
  assert.doesNotMatch(core, /getElementById\('deptModal'\)\.style\.display/);
  assert.match(settings, /data-employee-action="department-add"/);
  assert.match(settings, /change:'contract-type'/);
  assert.doesNotMatch(settings, /onclick="openDeptModal/);
  for (const modalId of ['wpModal', 'contractModal', 'visaModal']) {
    assert.match(settings, new RegExp(`getElementById\\('${modalId}'\\)\\.classList\\.add\\('open'\\)`));
  }
  assert.match(detail, /data-employee-action="contract-open"/);
  assert.doesNotMatch(detail, /onclick="emp_openContractModal/);
  assert.match(paidLeave, /data-select-target="f_dept_id"/);
  assert.match(paidLeave, /getElementById\('grantModal'\)\.classList\.add\('open'\)/);
  assert.match(html, /data-employee-action="department-save"/);
  assert.match(html, /data-employee-action="contract-generate"/);
  assert.match(html, /assets\/js\/employee-core\.js\?v=\d{8}\.\d+/);
  assert.match(html, /assets\/js\/employee-settings-docs\.js\?v=\d{8}\.\d+/);
});

test('Every collection used by application buttons supports the basic save lifecycle', async () => {
  const tables = [
    'assignments', 'billing', 'certificates', 'clients', 'company_info', 'contract_employees',
    'contracts', 'departments', 'dispatch_contracts', 'doc_templates', 'emp_work_patterns',
    'employee_records', 'employees', 'employment_contracts', 'settings', 'sites',
    'visa_types', 'work_patterns', 'yukyu_grants', 'yukyu_records'
  ];
  globalThis.window = globalThis;
  globalThis.firebase = createFirebaseMock({
    _counters: Object.fromEntries(tables.map((table) => [table, 0]))
  });

  await import(`../assets/js/firebase-adapter.js?save-lifecycle=${Date.now()}`);
  const db = globalThis.createFirebaseDb();
  const uuidTables = new Set([
    'assignments', 'billing', 'clients', 'contract_employees', 'contracts',
    'dispatch_contracts', 'doc_templates', 'employee_records', 'settings', 'sites',
    'work_patterns'
  ]);

  for (const table of tables) {
    const created = await db.from(table).insert({ marker: table }).select('id,marker').single();
    assert.equal(created.error, null, `${table} create`);
    if (uuidTables.has(table)) assert.match(created.data.id, /^[0-9a-f-]{36}$/i, `${table} UUID`);
    else assert.equal(created.data.id, 1, `${table} numeric ID`);
    assert.equal(created.data.marker, table, `${table} inserted data`);

    const updated = await db.from(table).update({ marker: `${table}-updated` }).eq('id', created.data.id).select('marker').single();
    assert.equal(updated.error, null, `${table} update`);
    assert.equal(updated.data.marker, `${table}-updated`, `${table} updated data`);

    const deleted = await db.from(table).delete().eq('id', created.data.id);
    assert.equal(deleted.error, null, `${table} delete`);
  }
});

test('employment contract API round-trips identity, conditions and seal for an independent renewal record',async()=>{
  globalThis.window=globalThis;
  globalThis.firebase=createFirebaseMock({_counters:{employment_contracts:0}});
  await import(`../assets/js/firebase-adapter.js?contract-history=${Date.now()}`);
  const context=vm.createContext({db:globalThis.createFirebaseDb()});
  vm.runInContext(await readFile(new URL('../assets/js/employee-api.js',import.meta.url),'utf8'),context);
  const original={employee_id:1,employee_name:'保存時 一郎',employee_snapshot:{sei:'保存時',mei:'一郎',address:'作成時の住所',birthday:'1990-01-01'},issued_date:'2026-09-10',created_at:'2026-09-10T01:00:00Z',terms:{contract_type:'fixed',wage:'1,250円',employer_seal:'data:image/png;base64,aGVsbG8='}};
  const [saved]=await context.createEmploymentContract(original);
  const renewal={...original,copied_from_id:saved.id,created_at:'2026-09-10T02:00:00Z',terms:{...original.terms,wage:'1,400円'}};
  const [copy]=await context.createEmploymentContract(renewal);
  assert.notEqual(copy.id,saved.id);
  // A fresh adapter must reload the seal through the existing attachment store.
  context.db=globalThis.createFirebaseDb();
  const reloaded=await context.fetchEmploymentContracts();
  assert.equal(reloaded.length,2);assert.equal(reloaded[0].id,copy.id);
  assert.deepEqual(reloaded.find(row=>row.id===saved.id).employee_snapshot,original.employee_snapshot);
  assert.deepEqual(reloaded.find(row=>row.id===saved.id).terms,original.terms);
  assert.equal(reloaded[0].terms.employer_seal,original.terms.employer_seal);
  assert.equal(reloaded[0].copied_from_id,saved.id);assert.equal(reloaded[0].terms.wage,'1,400円');
});
