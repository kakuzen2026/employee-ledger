import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/js/paid-leave-csv.js', import.meta.url), 'utf8');
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
    confirmPermanentDelete() { return true; },
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
      use_type: '全日', shubetsu: '有給', kubun: '通常', input_by: '管理者', biko: '', _revision: 4
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
