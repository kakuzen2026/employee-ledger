import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/js/paid-leave-csv.js', import.meta.url), 'utf8');
const pointsSource = await readFile(new URL('../assets/js/attendance-points.js', import.meta.url), 'utf8');
const staleMessage = '別の端末またはタブでこの記録が更新されています。最新内容を表示しました。確認してからもう一度操作してください。';

function staleError() {
  const error = new Error(staleMessage);
  error.code = 'STALE_WRITE';
  return error;
}

function loadPaidLeaveUi({ grants = [], records = [] } = {}) {
  const elements = new Map();
  const element = (id, value = '') => {
    const target = {
      id,
      value,
      innerHTML: '',
      textContent: '',
      oninput: null,
      classList: {
        open: false,
        add(name) { if (name === 'open') this.open = true; },
        remove(name) { if (name === 'open') this.open = false; }
      }
    };
    elements.set(id, target);
    return target;
  };
  element('grantModalTitle');
  element('grantModal');
  element('gm_date');
  element('gm_days');
  element('gm_expire');
  element('yDate');
  element('yBiko');

  const calls = { toast: [], grantReload: 0, recordReload: 0, renderDetail: 0, renderList: 0 };
  const context = {
    console,
    document: { getElementById(id) { return elements.get(id) || null; } },
    employees: [{ id: 1, status: '在籍', sei: 'テスト', mei: '従業員', shain_no: '1' }],
    yukyuGrants: grants,
    yukyuRecords: records,
    currentView: 'yukyu_list',
    detailTab: 'basic',
    viewingId: null,
    yf: { employee_id: null, employee_name: '', use_type: '', shubetsu: '', kubun: '', input_by: '' },
    yfFromDetail: false,
    EMP_UI: {saving:false,dirty:false,formReturn:null},
    canLeaveEmployeeView() { return true; },
    openEmployeeFormContext() { context.EMP_UI.formReturn={view:context.currentView}; },
    setEmployeeSaving(value) { context.EMP_UI.saving=value; },
    returnFromEmployeeForm() {
      context.currentView=context.EMP_UI.formReturn?.view||'yukyu_list';context.yfFromDetail=false;
      if(context.currentView==='detail')calls.renderDetail++;else calls.renderList++;
    },
    confirmPermanentDelete() { return true; },
    confirm() { return true; },
    employeeGrantDataReady(){return true;},
    markEmployeeDirty(){},
    calcYukyuInfo() { return { nextDate: '2026-09-01' }; },
    calcYukyuLegalDays() { return 10; },
    setNav() {},
    showToast(message, type) { calls.toast.push({ message, type }); },
    async loadGrants() { calls.grantReload += 1; },
    async loadYukyu() { calls.recordReload += 1; },
    render() { calls.renderDetail += 1; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(pointsSource, context);
  vm.runInContext(source, context, { filename: 'paid-leave-csv.js' });
  context.renderDT = () => { calls.renderDetail += 1; };
  context.renderYukyuList = () => { calls.renderList += 1; };
  context.renderYukyuAdd = () => {};
  return { context, calls, elements };
}

test('Grant edit keeps the opened revision and stale handling reloads without retrying', async () => {
  const { context, calls, elements } = loadPaidLeaveUi({
    grants: [{ id: 10, employee_id: 1, grant_date: '2026-01-01', days: 10, expire_date: '2027-12-31', _revision: 3 }]
  });
  const saves = [];
  context.saveYukyuGrant = async (...args) => { saves.push(args); throw staleError(); };

  context.openGrantModal(1, 10);
  elements.get('gm_days').value = '12';
  await context.saveGrant();

  assert.equal(saves.length, 1);
  assert.equal(saves[0][0], 10);
  assert.equal(saves[0][2], 3);
  assert.equal(calls.grantReload, 1);
  assert.equal(calls.renderDetail, 1);
  assert.equal(elements.get('grantModal').classList.open, false);
  assert.deepEqual(calls.toast, [{ message: staleMessage, type: 'warn' }]);
});

test('Grant and paid-leave record deletes pass the displayed revision and reject stale deletion', async () => {
  const { context, calls } = loadPaidLeaveUi({
    grants: [{ id: 10, employee_id: 1, _revision: 5 }],
    records: [{ id: 20, employee_id: 1, _revision: 7 }]
  });
  const grantDeletes = [];
  const recordDeletes = [];
  context.deleteYukyuGrant = async (...args) => { grantDeletes.push(args); throw staleError(); };
  context.deleteYukyuRecord = async (...args) => { recordDeletes.push(args); throw staleError(); };

  await context.delGrant(10, 1);
  await context.delYR(20);

  assert.deepEqual(grantDeletes, [[10, 5]]);
  assert.deepEqual(recordDeletes, [[20, 7]]);
  assert.equal(calls.grantReload, 1);
  assert.equal(calls.recordReload, 1);
  assert.equal(calls.toast.length, 2);
  assert.equal(calls.toast.every(call => call.message === staleMessage && call.type === 'warn'), true);
});

test('Paid-leave record edit keeps the opened revision and stale handling returns to latest data', async () => {
  const { context, calls, elements } = loadPaidLeaveUi({
    records: [{
      id: 20, employee_id: 1, employee_name: 'テスト 従業員', use_date: '2026-09-01',
      use_type: '全日', shubetsu: '有給', kubun: '計画', input_by: '管理者', biko: '', _revision: 4
    }]
  });
  const updates = [];
  context.updateYukyuRecord = async (...args) => { updates.push(args); throw staleError(); };
  elements.get('yDate').value = '2026-09-01';

  context.openYukyuEdit(20);
  await context.saveYR();

  assert.equal(updates.length, 1);
  assert.equal(updates[0][0], 20);
  assert.equal(updates[0][2], 4);
  assert.equal(calls.recordReload, 1);
  assert.equal(calls.renderList, 1);
  assert.deepEqual(calls.toast, [{ message: staleMessage, type: 'warn' }]);
});

test('New grant double submission writes once while the first save is pending', async () => {
  const {context,calls,elements}=loadPaidLeaveUi();
  let release,writes=0;
  const pending=new Promise(resolve=>{release=resolve;});
  context.saveYukyuGrant=async()=>{writes++;await pending;};
  context.openGrantModal(1);
  const first=context.saveGrant();
  await context.saveGrant();
  assert.equal(writes,1);
  assert.equal(context.EMP_UI.saving,true);
  release();await first;
  assert.equal(context.EMP_UI.saving,false);
  assert.equal(elements.get('grantModal').classList.open,false);
  assert.equal(calls.grantReload,1);
});

test('Unconfirmed grant data blocks opening and direct saving', async () => {
  const {context,elements}=loadPaidLeaveUi();let writes=0;
  context.employeeGrantDataReady=()=>false;
  context.saveYukyuGrant=async()=>{writes++;};
  context.openGrantModal(1);
  elements.get('gm_date').value='2026-09-08';
  await context.saveGrant();
  assert.equal(elements.get('grantModal').classList.open,false);
  assert.equal(writes,0);
});

test('Grant save success with failed reload closes the form without inviting another insert', async () => {
  const {context,calls,elements}=loadPaidLeaveUi();let writes=0;
  context.saveYukyuGrant=async()=>{writes++;};
  context.loadGrants=async()=>{throw new Error('offline');};
  context.openGrantModal(1);await context.saveGrant();
  assert.equal(writes,1);
  assert.equal(elements.get('grantModal').classList.open,false);
  assert.equal(context.EMP_UI.saving,false);
  assert.match(calls.toast.at(-1).message,/保存は完了/);
});

test('付与削除の連打を防ぎ、削除成功後の再読込失敗を区別する', async () => {
  const {context,calls}=loadPaidLeaveUi({grants:[{id:10,employee_id:1,_revision:1}]});
  let release;const pending=new Promise(resolve=>{release=resolve});let count=0;
  context.deleteYukyuGrant=async()=>{count++;await pending;};
  context.loadGrants=async()=>{throw new Error('reload offline');};
  const first=context.delGrant(10,1);
  await context.delGrant(10,1);
  assert.equal(count,1);assert.equal(context.EMP_UI.saving,true);
  release();await first;
  assert.equal(context.EMP_UI.saving,false);
  assert.match(calls.toast[0].message,/削除は完了しました/);
});
