import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const coreSource = await readFile(new URL('../assets/js/employee-core.js', import.meta.url), 'utf8');
const detailSource = await readFile(new URL('../assets/js/employee-list-detail.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function loadCore(employees = [], yukyuGrants = [], yukyuRecords = []) {
  const context = {
    console,
    document: {
      addEventListener() {},
      getElementById() { return null; },
      createElement() { return { style: {}, appendChild() {}, remove() {} }; }
    },
    localStorage: { getItem() { return null; } },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    setTimeout,
    clearTimeout,
    btoa,
    atob,
    escape,
    unescape,
    confirm() { return true; },
    location: { reload() {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(`${coreSource}\nthis.__employeeTestState=EMP_ST;this.__syncEmployeeTestState=syncFromST;`, context, { filename: 'employee-core.js' });
  context.__employeeTestState.employees = employees;
  context.__employeeTestState.yukyuGrants = yukyuGrants;
  context.__employeeTestState.yukyuRecords = yukyuRecords;
  context.__syncEmployeeTestState();
  vm.runInContext('attendanceEmployeesReady=true;attendanceGrantsReady=true;',context);
  return context;
}

function wireGrantWrites(context) {
  const calls = { create: [], update: [], remove: [] };
  context.createYukyuGrants = async (rows, updates=[]) => {
    for(const u of updates)await context.saveYukyuGrant(u.id,u.patch,u.expectedRevision);
    calls.create.push(...rows);
    context.__employeeTestState.yukyuGrants.push(...rows.map((row, index) => ({ ...row, id: row.id ?? 1000 + index })));
    context.__syncEmployeeTestState();
    return rows;
  };
  context.saveYukyuGrant = async (id, patch, expectedRevision) => {
    calls.update.push({ id, patch, expectedRevision });
    const grant = context.__employeeTestState.yukyuGrants.find(row => row.id === id);
    if (grant) Object.assign(grant, patch, { _revision: expectedRevision + 1 });
    context.__syncEmployeeTestState();
    return grant;
  };
  context.deleteYukyuGrant = async id => {
    calls.remove.push(id);
    context.__employeeTestState.yukyuGrants = context.__employeeTestState.yukyuGrants.filter(row => row.id !== id);
    context.__syncEmployeeTestState();
  };
  context.fetchYukyuGrants = async () => context.__employeeTestState.yukyuGrants;
  return calls;
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

function wireSharedGrantWrites(context, sharedGrants, waitForPeer) {
  const calls = { create: [], update: [] };
  context.createYukyuGrants = async (rows, updates=[]) => {
    for(const u of updates)await context.saveYukyuGrant(u.id,u.patch,u.expectedRevision);
    calls.create.push(...rows);
    await waitForPeer();
    for (const row of rows) sharedGrants.set(row.id, { ...row });
    return rows;
  };
  context.saveYukyuGrant = async (id, patch) => {
    calls.update.push({ id, patch });
    const grant = sharedGrants.get(id);
    if (grant) sharedGrants.set(id, { ...grant, ...patch });
    return sharedGrants.get(id);
  };
  context.fetchYukyuGrants = async () => Array.from(sharedGrants.values());
  return calls;
}

test('参照勤続は法定日数が得られる最初の1月1日から候補を作る', () => {
  const context = loadCore([
    { id: 1, status: '在籍', nyusha_date: '2025-09-01', kousoku_start_date: '2025-07-01' },
    { id: 2, status: '在籍', nyusha_date: '2000-02-01', kousoku_start_date: '2000-01-01' },
    { id: 3, status: '在籍', nyusha_date: '2025-09-01', kousoku_start_date: '2025-07-02' }
  ]);
  assert.deepEqual(Array.from(context.calcGrantDates(1).slice(0, 3)), ['2026-01-01', '2027-01-01', '2028-01-01']);
  assert.equal(context.calcYukyuLegalDays(1, '2026-01-01'), 10);
  assert.equal(context.calcYukyuLegalDays(3, '2026-01-01'), null);
  assert.deepEqual(Array.from(context.calcGrantDates(3).slice(0, 2)), ['2027-01-01', '2028-01-01']);
  const currentYear = new Date().getFullYear();
  assert.equal(context.calcGrantDates(2).includes(`${currentYear}-01-01`), true);
  assert.equal(context.calcGrantDates(2).includes(`${currentYear + 5}-01-01`), true);
});

test('参照勤続が6か月未満の1月1日は空日数レコードを作らず次の年から始める', async () => {
  const context = loadCore([
    { id: 1, status: '在籍', nyusha_date: '2026-02-01', kousoku_start_date: '2025-12-31' }
  ]);
  const calls = wireGrantWrites(context);
  await context.checkAndAutoGrant('2026-08-01');
  assert.deepEqual(Array.from(context.calcGrantDates(1).slice(0, 2)), ['2027-01-01', '2028-01-01']);
  assert.deepEqual(Array.from(calls.create), []);
});

test('参照なしは入社6か月後と同月同日を使い、空値系は同じ通常計算になる', () => {
  for (const kousokuStart of [null, undefined, '']) {
    const context = loadCore([
      { id: 1, status: '在籍', nyusha_date: '2026-03-15', kousoku_start_date: kousokuStart }
    ]);
    assert.deepEqual(Array.from(context.calcGrantDates(1).slice(0, 3)), ['2026-09-15', '2027-09-15', '2028-09-15']);
  }
});

test('参照勤続は同じ暦年に既存付与があれば1月1日を追加せず、次年を表示する', async () => {
  const context = loadCore([
    { id: 1, status: '在籍', nyusha_date: '2025-09-01', kousoku_start_date: '2025-07-01' }
  ], [{ id: 9, employee_id: 1, grant_date: '2026-07-01', days: 10 }]);
  const calls = wireGrantWrites(context);
  assert.equal(context.calcYukyuInfo(1, '2025-12-01').nextDate, '2027-01-01');
  await context.checkAndAutoGrant('2026-08-01');
  assert.equal(calls.create.some(row => row.grant_date === '2026-01-01'), false);
});

test('参照なしは別日付の既存付与では抑制せず、予定日そのものだけを重複排除する', async () => {
  const context = loadCore([
    { id: 1, status: '在籍', nyusha_date: '2025-01-01', kousoku_start_date: '' }
  ], [{ id: 9, employee_id: 1, grant_date: '2025-08-01', days: 10 }]);
  const calls = wireGrantWrites(context);
  await context.checkAndAutoGrant('2026-01-01');
  assert.equal(calls.create.filter(row => row.grant_date === '2025-07-01').length, 1);
  assert.equal(calls.create.filter(row => row.grant_date === '2025-08-01').length, 0);
});

test('自動付与は並行セッションでも同じ負の決定的IDへ収束する', async () => {
  const employees = [
    { id: 7, status: '在籍', nyusha_date: '2025-01-01', kousoku_start_date: '' }
  ];
  const first = loadCore(employees);
  const second = loadCore(employees);
  const sharedGrants = new Map();
  const waitForPeer = createTwoPartyBarrier();
  const firstCalls = wireSharedGrantWrites(first, sharedGrants, waitForPeer);
  const secondCalls = wireSharedGrantWrites(second, sharedGrants, waitForPeer);

  await Promise.all([
    first.checkAndAutoGrant('2026-01-01'),
    second.checkAndAutoGrant('2026-01-01')
  ]);

  const firstGrant = firstCalls.create.find(row => row.grant_date === '2025-07-01');
  const secondGrant = secondCalls.create.find(row => row.grant_date === '2025-07-01');
  assert.equal(firstGrant.id, secondGrant.id);
  assert.equal(Number.isSafeInteger(firstGrant.id), true);
  assert.equal(firstGrant.id < 0, true);
  assert.equal(Array.from(sharedGrants.values()).filter(row => row.employee_id === 7 && row.grant_date === '2025-07-01').length, 1);
  assert.notEqual(first.autoGrantRecordId(7, '2025-07-01'), first.autoGrantRecordId(8, '2025-07-01'));
  assert.notEqual(first.autoGrantRecordId(7, '2025-07-01'), first.autoGrantRecordId(7, '2026-07-01'));
  const calls = [];
  new Function('openGrantModal', 'delGrant', `openGrantModal(7,${firstGrant.id});delGrant(${firstGrant.id},7);`)(
    (...args) => calls.push(args),
    (...args) => calls.push(args)
  );
  assert.deepEqual(calls, [[7, firstGrant.id], [firstGrant.id, 7]]);
});

test('自動付与は不正または符号化上限を超える従業員IDを fail-closed で抑止する', async () => {
  const context = loadCore([
    { id: -1, status: '在籍', nyusha_date: '2025-01-01', kousoku_start_date: '' },
    { id: Number.MAX_SAFE_INTEGER, status: '在籍', nyusha_date: '2025-01-01', kousoku_start_date: '' }
  ]);
  const calls = wireGrantWrites(context);
  assert.equal(context.autoGrantRecordId(-1, '2025-07-01'), null);
  assert.equal(context.autoGrantRecordId(Number.MAX_SAFE_INTEGER, '2025-07-01'), null);
  await context.checkAndAutoGrant('2026-01-01');
  assert.deepEqual(Array.from(calls.create), []);
});

test('日数の手入力値は保持し、未設定値だけを期限に応じて days 専用パッチで補完する', async () => {
  const context = loadCore([
    { id: 1, status: '在籍', nyusha_date: '2024-01-01', kousoku_start_date: '' }
  ], [
    { id: 10, employee_id: 1, grant_date: '2024-07-01', days: 3 },
    { id: 11, employee_id: 1, grant_date: '2025-07-01', days: null },
    { id: 12, employee_id: 1, grant_date: '2025-07-01', days: undefined, expire_date: '' },
    { id: 13, employee_id: 1, grant_date: '2025-07-01', days: '', expire_date: '2027-06-30' },
    { id: 14, employee_id: 1, grant_date: '2025-07-01', days: 0 },
    { id: 15, employee_id: 1, grant_date: '2025-07-01', days: 3 },
    { id: 16, employee_id: 1, grant_date: '2025-07-01', days: null, expire_date: 'not-a-date' },
    { id: 17, employee_id: 1, grant_date: '2025-07-01', days: null, expire_date: '2025-12-31' }
  ]);
  const calls = wireGrantWrites(context);
  await context.checkAndAutoGrant('2026-01-01');
  assert.deepEqual(Array.from(calls.update.map(call => call.id).sort((a, b) => a - b)), [11, 12, 13]);
  for (const call of calls.update) {
    assert.deepEqual(Object.keys(call.patch), ['days']);
    assert.equal(call.patch.days, 11);
    assert.equal(call.expectedRevision, 0);
  }
  assert.equal(context.__employeeTestState.yukyuGrants.find(row => row.id === 11).expire_date, undefined);
  assert.equal(context.__employeeTestState.yukyuGrants.find(row => row.id === 12).expire_date, '');
  assert.equal(context.__employeeTestState.yukyuGrants.find(row => row.id === 13).expire_date, '2027-06-30');
  assert.equal(context.__employeeTestState.yukyuGrants.find(row => row.id === 10).days, 3);
  assert.equal(context.__employeeTestState.yukyuGrants.find(row => row.id === 14).days, 0);
  assert.equal(context.__employeeTestState.yukyuGrants.find(row => row.id === 15).days, 3);
  assert.equal(context.__employeeTestState.yukyuGrants.find(row => row.id === 16).days, null);
  assert.equal(context.__employeeTestState.yukyuGrants.find(row => row.id === 17).days, null);
});

test('自動days補完は読込時revisionを使い、成功時にrevisionを増やす', async () => {
  const context = loadCore([
    { id: 1, status: '在籍', nyusha_date: '2024-01-01', kousoku_start_date: '' }
  ], [
    { id: 20, employee_id: 1, grant_date: '2025-07-01', days: null, expire_date: '2027-06-30', _revision: 2 }
  ]);
  const calls = wireGrantWrites(context);

  await context.checkAndAutoGrant('2026-01-01');

  assert.equal(calls.update.length, 1);
  assert.equal(calls.update[0].expectedRevision, 2);
  assert.equal(context.__employeeTestState.yukyuGrants[0].days, 11);
  assert.equal(context.__employeeTestState.yukyuGrants[0]._revision, 3);
});

test('自動days補完がstaleなら手動変更を上書きせず最新grantを再取得する', async () => {
  const context = loadCore([
    { id: 1, status: '在籍', nyusha_date: '2024-01-01', kousoku_start_date: '' }
  ], [
    { id: 21, employee_id: 1, grant_date: '2025-07-01', days: null, expire_date: '2027-06-30', _revision: 2 }
  ]);
  let reloads = 0;
  context.console={...console,error(){}};
  context.createYukyuGrants = async (rows,updates) => { for(const u of updates)await context.saveYukyuGrant(u.id,u.patch,u.expectedRevision); };
  context.saveYukyuGrant = async (id, patch, expectedRevision) => {
    assert.equal(id, 21);
    assert.deepEqual(Object.keys(patch), ['days']);
    assert.equal(expectedRevision, 2);
    Object.assign(context.__employeeTestState.yukyuGrants[0], { days: 12, _revision: 3 });
    const error = new Error('stale');
    error.code = 'STALE_WRITE';
    throw error;
  };
  context.fetchYukyuGrants = async () => {
    reloads += 1;
    return context.__employeeTestState.yukyuGrants;
  };

  await context.checkAndAutoGrant('2026-01-01');

  assert.equal(reloads, 1);
  assert.equal(context.__employeeTestState.yukyuGrants[0].days, 12);
  assert.equal(context.__employeeTestState.yukyuGrants[0]._revision, 3);
});

test('期限切れの欠落年を遡及作成せず、無効な参照勤続は新規付与を抑制する', async () => {
  const context = loadCore([
    { id: 1, status: '在籍', nyusha_date: '2020-01-01', kousoku_start_date: '' },
    { id: 2, status: '在籍', nyusha_date: '2025-01-01', kousoku_start_date: 'not-a-date' }
  ], [{ id: 55, employee_id: 1, grant_date: '2020-07-01', days: 10, expire_date: '2022-06-30' }]);
  const calls = wireGrantWrites(context);
  await context.checkAndAutoGrant('2026-08-01');
  assert.equal(calls.create.some(row => row.employee_id === 1 && row.grant_date < '2024-08-01'), false);
  assert.equal(calls.create.some(row => row.employee_id === 2), false);
  assert.deepEqual(Array.from(context.calcGrantDates(2)), []);
  assert.deepEqual(Array.from(calls.remove), []);
  assert.equal(context.__employeeTestState.yukyuGrants.some(row => row.id === 55), true);
});

test('月末付与日は対象月末に丸め、以後は最初の付与日を基準に毎年安定する', () => {
  const context = loadCore([
    { id: 1, status: '在籍', nyusha_date: '2025-08-31', kousoku_start_date: '' }
  ]);
  assert.deepEqual(Array.from(context.calcGrantDates(1).slice(0, 3)), ['2026-02-28', '2027-02-28', '2028-02-28']);
  assert.equal(context.addMonthsToDateStr('2023-08-31', 6), '2024-02-29');
  assert.equal(context.addMonthsToDateStr('2024-08-31', 6), '2025-02-28');
  assert.equal(context.addYearsToDateStr('2024-02-29', 1), '2025-02-28');
  assert.equal(context.grantExpireDate('2025-10-15'), '2027-10-14');
  assert.match(detailSource, /付与日：毎年1月1日/);
  assert.match(detailSource, /付与日：入社6か月後、その後は毎年同月同日/);
  assert.match(htmlSource, /assets\/js\/employee-core\.js\?v=20260922\.1/);
  assert.match(htmlSource, /assets\/js\/employee-list-detail\.js\?v=20260922\.1/);
});

test('従業員または付与の読込が未確認なら自動付与は書込みを行わない', async () => {
  for (const flags of ['attendanceEmployeesReady=false','attendanceGrantsReady=false']) {
    const context = loadCore([{id:1,status:'在籍',nyusha_date:'2025-01-01'}]);
    const calls = wireGrantWrites(context);
    vm.runInContext(flags, context);
    assert.equal(await context.checkAndAutoGrant('2026-09-08'), false);
    assert.equal(calls.create.length, 0);
    assert.equal(calls.update.length, 0);
  }
});

test('削除した自動付与は新しいログインでも再作成せず、翌年分は付与する', async () => {
  const employee={id:1,status:'在籍',nyusha_date:'2025-01-01'};
  const initial=loadCore([employee]);
  wireGrantWrites(initial);
  await initial.checkAndAutoGrant('2025-09-09');
  const stored=initial.__employeeTestState.yukyuGrants;
  assert.equal(stored.length,1);
  const grant=stored[0];
  // Exercise the real delete API against persistent synthetic rows.
  const apiContext={db:{async updateByRevision(table,id,revision,patch){
    assert.equal(table,'yukyu_grants');assert.equal(id,grant.id);assert.equal(revision,grant._revision);
    Object.assign(grant,patch,{_revision:revision+1});return {data:[grant],error:null};
  }}};
  vm.runInNewContext(await readFile(new URL('../assets/js/employee-api.js',import.meta.url),'utf8'),apiContext);
  await apiContext.deleteYukyuGrant(grant.id,grant._revision);
  const reloaded=loadCore([employee],structuredClone(stored));
  const calls=wireGrantWrites(reloaded);
  await reloaded.checkAndAutoGrant('2025-09-10');
  assert.equal(calls.create.length,0);
  assert.equal(calls.update.length,0);
  assert.equal(reloaded.calcYukyuInfo(1,'2025-09-10').granted,0);
  assert.equal(reloaded.calcYukyuInfo(1,'2025-09-10').remaining,0);
  assert.equal(vm.runInContext('yukyuGrants.length',reloaded),0);
  await reloaded.checkAndAutoGrant('2026-07-01');
  assert.deepEqual(calls.create.map(g=>g.grant_date),['2026-07-01']);
  assert.equal(reloaded.calcYukyuInfo(1,'2026-07-01').granted,11);
});

test('参照勤続の手動付与削除も同じ年に自動再作成しない', async () => {
  const context=loadCore([{id:1,status:'在籍',nyusha_date:'2025-01-01',kousoku_start_date:'2024-01-01'}],[
    {id:100,employee_id:1,grant_date:'2025-02-01',days:0,deleted:true,_revision:2}
  ]);
  const calls=wireGrantWrites(context);
  await context.checkAndAutoGrant('2025-09-09');
  assert.equal(calls.create.some(g=>g.grant_date.startsWith('2025')),false);
  assert.equal(calls.update.length,0);
});

test('有休に関わる4資産を現在の検証済みURLで読み込む',()=>{
  const versions={'employee-api':'20260922.1','employee-core':'20260922.1','employee-list-detail':'20260922.1','paid-leave-csv':'20260922.1'};
  for(const [name,version] of Object.entries(versions))assert.ok(htmlSource.includes('assets/js/'+name+'.js?v='+version),name);
});
