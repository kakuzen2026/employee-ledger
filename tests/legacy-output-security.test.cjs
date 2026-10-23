const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = process.env.EMPLOYEE_LEGACY_SOURCE || path.join(__dirname, '..');
const modules = ['core','employee-core','employee-api','dispatch','employee-list-detail','employee-settings-docs','employee-health','employee-files','paid-leave-csv','records-documents'];
const sources = modules.map(name => {
  const text = fs.readFileSync(path.join(root, 'assets/js', name + '.js'), 'utf8');
  return name === 'core' ? text.split('\n').slice(4).join('\n') : text;
});
// Only named pure/render/import/export functions are evaluated. No script body,
// SDK initialization, configuration literals, or preview/employee seed is run.
function functionSource(name) {
  for (const source of sources) {
    const start = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
    if (!start) continue;
    const tail = source.slice(start.index);
    const next = /\n(?:(?:async )?function \w+\(|\/\/ ===== END EMPLOYEE MANAGEMENT)/.exec(tail);
    return next ? tail.slice(0, next.index) : tail;
  }
  return '';
}
const functions = ['esc', 'emp_esc', 'emp_attr', 'emp_textarea', 'df', 'fi', 'calcAgeVal',
  'renderList', 'renderDetail', 'renderDT', 'renderAlert', 'renderForm', 'searchCEmp',
  'fetchEmployees', 'createEmployee', 'loadEmployees', 'importCSV', 'parseCSVLine', 'csvExportCell', 'exportCSV', 'exportYukyuCSV', 'dlCSV'];
functions.push('generateCertificate', 'emp_openContractModal', 'closeContractModal', 'generateContract',
  'renderContractList', 'renderCertList', 'renderKenkoList', 'exportKenkoCSV', 'renderYukyuList',
  'loadRecords', 'openRecordModal', 'renderRecTypeFields', 'openDocsModal', 'renderYukyuAdd', 'findYukyuDuplicateRecord', 'yukyuDuplicateWarningHtml', 'empDDItems', 'filterEmpDD', 'pickEmp');
function element() {
  return { innerHTML: '', value: '', style: {}, children: [], listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    replaceChildren(...children) { this.children = children; this.innerHTML = ''; },
    click() {}, classList: { toggle() {}, add() {}, remove() {} } };
}
function environment(record = {}) {
  const elements = new Map(['mainContent', 'dtc', 'ct-emp-dd', 'ct-emp-search', 'empDD', 'empQ',
    'mainContent-records', 'rec-emp-id', 'rec-contract-id', 'rec-id', 'rec-modal-title', 'rec-type', 'rec-type-fields', 'docs-title', 'docs-contract-info', 'docs-site-btns', 'docs-emp-btns', 'contractModal', 'contractModalBody', 'cm_start', 'cm_end', 'cm_wage', 'cm_work'].map(id => [id, element()]));
  const records = [];
  const messages = [];
  const downloads = [];
  const documents = [];
  const employee = { id: 7, sei: '山田', mei: '太郎', status: '在籍', visa: '技術・人文知識',
    visa_expiry: '2020-01-01', license_expiry: '2020-02-01', nyusha_date: '2024-01-01', ...record };
  const focus = { expiredTotal: 0, deadlineTotal: 0, contractNeed: [], yukyuUnset: [] };
  const context = { console, Date, Math, Number, String, JSON, Set,
    employees: [employee], EMP_ST: {}, departments: [], yukyuRecords: [], yukyuGrants: [], employmentContracts: [],
    listFilter: { sq: '', fs: '', fd: '', fc: '' }, currentFilteredList: [employee],
    visibleCols: ['visa', 'visa_expiry', 'license_expiry'], viewingId: 7, detailTab: 'basic', currentView: 'list',
    empCache: null, empTimer: null, selEmps: [], KOYOU: [], visaTypes: [], CHECKRES: [],
    certificates: [], companyInfo: { company_name: 'Synthetic Company' }, workPatterns: [],
    yf: { employee_id: null, employee_name: '' }, yfFromDetail: false,
    USE_TYPES: [], SHUBETSU: [], KUBUN: [], INPUT_BY: [],
    createCertificate: async () => [], createEmploymentContract: async () => [], fetchDispatchContractEmployeeSummaries: async () => [],
    deptLabelById: () => '', loadCertificates: async () => {}, loadEmploymentContracts: async () => {},
    rcImgData: '', licFormImgData: '', skFormImgData: [],
    getLedgerFocusMetrics: () => focus,
    calcYukyuInfo: () => ({ unsetDays: false, remaining: 0, granted: 0, used: 0, nextDate: null }),
    getFuyouList: () => [], stripFuyouMeta: x => x || '', maskSensitive: () => 'masked',
    multiImgGrid: () => '', setupDrop() {}, setupFormDropZones() {}, deptOptions: () => '', loadDispatchAlerts() {},
    confirm: () => true, showToast: (...args) => messages.push(args),
    sb: async (p, method, body) => {
      if (method === 'POST') { records.push({ ...body, id: records.length + 1 }); return []; }
      return p.startsWith('employees?') ? records.map(x => ({ ...x })) : [];
    },
    addSelEmp: (...args) => { context.selection = args; },
    db: { from: table => {
      const data = () => table === 'employees' ? context.employees : (context.database[table] || []);
      const query = { select() { return this; }, order() { return this; }, eq() { return this; }, in() { return this; },
        limit: async () => ({ data: data() }), single: async () => ({ data: data()[0] }),
        then(resolve, reject) { return Promise.resolve({ data: data() }).then(resolve, reject); } };
      return query;
    } },
    openModal() {}, database: {},
    clearTimeout() {}, setTimeout(fn) { context.pending = Promise.resolve(fn()); return 1; },
    window: { open: () => ({ document: { write: content => documents.push(content), close() {} }, print() {} }) },
    document: {
      getElementById: id => elements.get(id) || null,
      querySelectorAll: () => [],
      createElement: tag => { const el = element(); if (tag === 'a') el.click = () => downloads.push(el); return el; }
    }
  };
  context.render = () => context.renderList();
  vm.createContext(context);
  vm.runInContext(sources.find(s => s.includes('const EMPLOYEE_SELECT=')).match(/^const EMPLOYEE_SELECT=.*$/m)[0] + '\n' + functions.map(functionSource).filter(Boolean).join('\n'), context);
  return { context, elements, employee, records, messages, downloads, documents };
}
const attack = '<img src=x onerror="unexpected()">';
const quote = '" data-unexpected="yes';
function inert(html) {
  assert.equal(/<img\s+src=x|\sdata-unexpected="yes"|<svg\s/i.test(html), false, 'Synthetic markup must remain text/attribute data');
}
const csvQuote = value => '"' + String(value).replaceAll('"', '""') + '"';

for (const field of ['visa', 'visa_expiry', 'license_expiry']) {
  test(`list keeps imported ${field} as text`, () => {
    const { context, elements } = environment({ [field]: attack });
    context.renderList();
    const html = elements.get('mainContent').innerHTML;
    inert(html);
    assert.ok(html.includes('&lt;img'));
  });
}
test('actual selected CSV -> storage stub -> reload -> list remains inert', async () => {
  const { context, records, elements } = environment();
  const text = ['社員番号,姓,名,在留資格,在留期限,免許有効期限',
    ['001-A', '山田', '太郎', attack, '2030-01-01', '2031-01-01'].map(csvQuote).join(',')].join('\n');
  const input = { files: [{ text: async () => text }], value: 'selected' };
  await context.importCSV(input);
  assert.equal(records[0].visa, attack); // persistence keeps original data
  assert.equal(records[0].shain_no, '001-A');
  assert.equal(input.value, '');
  inert(elements.get('mainContent').innerHTML);
});
test('imported quoted name survives storage and staff selection without an inline handler', async () => {
  const { context, elements, records } = environment();
  const surname = quote + attack;
  const text = ['社員番号,姓,名,入社日', ['001-A', surname, "O'Neil", '2024-01-01'].map(csvQuote).join(',')].join('\n');
  await context.importCSV({ files: [{ text: async () => text }], value: 'selected' });
  context.searchCEmp('');
  await context.pending;
  const option = elements.get('ct-emp-dd').children[0];
  assert.ok(option);
  inert(option.innerHTML);
  option.listeners.click();
  assert.equal(context.selection[0], records[0].id);
  assert.equal(context.selection[1], `${surname} O'Neil`);
  assert.equal(records[0].shain_no, '001-A');
});
test('staff search uses an inert name and binds the exact identity/name', async () => {
  const { context, elements, employee } = environment({ sei: quote, mei: "O'Neil\\研究", employment_type: 'fixed' });
  context.searchCEmp('');
  await context.pending;
  const dropdown = elements.get('ct-emp-dd');
  inert(dropdown.innerHTML + dropdown.children.map(x => x.innerHTML).join(''));
  assert.equal(dropdown.children.length, 1);
  assert.doesNotMatch(dropdown.children[0].innerHTML, /onclick=/);
  dropdown.children[0].listeners.click();
  assert.deepEqual(Array.from(context.selection), [7, `${employee.sei} ${employee.mei}`, 'fixed']);
});
for (const field of ['sei', 'mei', 'seikana', 'meikana']) {
  test(`warning list escapes imported ${field}`, async () => {
    const { context, elements } = environment({ [field]: attack });
    await context.renderAlert();
    inert(elements.get('mainContent').innerHTML);
  });
}
for (const field of ['license_no', 'license_date', 'license_expiry']) {
  test(`license detail keeps ${field} within its text/attribute context`, async () => {
    const { context, elements } = environment({ [field]: quote + attack });
    context.detailTab = 'license';
    await context.renderDT();
    inert(elements.get('dtc').innerHTML);
  });
}
test('detail basic uses existing text escaping for all imported scalar fields', async () => {
  const record = Object.fromEntries(['shain_no', 'sei', 'mei', 'seikana', 'meikana', 'birthday', 'gender',
    'address', 'tel', 'email', 'position', 'koyou', 'nyusha_date', 'kyuyo', 'jikyu',
    'bank_name', 'bank_branch', 'bank_account_no', 'bank_account_name'].map(k => [k, attack]));
  const { context, elements } = environment(record);
  await context.renderDT();
  inert(elements.get('dtc').innerHTML);
});
for (const field of ['birthday', 'company']) {
  test(`edit form keeps imported ${field} inside value`, () => {
    const { context, elements } = environment({ [field]: quote + attack });
    context.setTimeout = () => 1;
    context.renderForm(7);
    inert(elements.get('mainContent').innerHTML);
  });
}
test('ordinary Japanese names, dates, IDs and numeric detail remain visible', async () => {
  const { context, elements } = environment({ sei: '山田"研究', mei: "O'Neil", kyuyo: 0, jikyu: -1250 });
  context.renderList();
  assert.match(elements.get('mainContent').innerHTML, /山田&quot;研究 O&#x27;Neil/);
  await context.renderDT();
  assert.match(elements.get('dtc').innerHTML, /-1250円/);
});
for (const value of ['=1+1', '+SUM(A1)', '-SUM(A1)', '@SUM(A1)', ' \t=1', '\r=1', '\n=1']) {
  test(`CSV display cell neutralizes ${JSON.stringify(value)}`, () => {
    const { context, downloads } = environment({ sei: value });
    context.exportCSV();
    assert.equal(downloads.length, 1);
    const csv = decodeURIComponent(downloads[0].href.split(',').slice(1).join(','));
    assert.ok(csv.includes(csvQuote("'" + value)));
  });
}
test('CSV export retains zeros, negative numbers, quoting and unchanged numeric identity', () => {
  const { context, downloads } = environment({ id: 17, sei: '山田,研究"部\n第二', kyuyo: 0, jikyu: -1250 });
  context.exportCSV();
  const csv = decodeURIComponent(downloads[0].href.split(',').slice(1).join(','));
  assert.ok(csv.includes('"17","山田,研究""部\n第二"'));
  assert.ok(csv.includes('"0","-1250"'));
});
test('risky employee ID aborts before download, preserving identity', () => {
  const { context, downloads, messages, employee } = environment({ id: '=identity' });
  context.exportCSV();
  assert.equal(downloads.length, 0);
  assert.equal(employee.id, '=identity');
  assert.match(messages[0][0], /ID/);
});
test('leave CSV protects display cells, preserves IDs and rejects risky identity', () => {
  const { context, downloads } = environment();
  context.yukyuRecords = [{ id: 11, employee_id: 7, employee_name: '=1', biko: '@note' }];
  context.exportYukyuCSV();
  const csv = decodeURIComponent(downloads[0].href.split(',').slice(1).join(','));
  assert.ok(csv.includes('"11","7","\'=1"'));
  assert.ok(csv.includes('"\'@note"'));
  context.yukyuRecords[0].employee_id = '=other';
  context.exportYukyuCSV();
  assert.equal(downloads.length, 1);
});
test('CSV keeps leading-zero stable identity and empty/null cells without rewriting', () => {
  const { context, downloads, employee } = environment({ id: '00017-A', sei: null, kyuyo: '0', jikyu: '+1250.50' });
  context.exportCSV();
  const csv = decodeURIComponent(downloads[0].href.split(',').slice(1).join(','));
  assert.ok(csv.includes('"00017-A",""'));
  assert.ok(csv.includes('"0","+1250.50"'));
  assert.equal(employee.id, '00017-A');
});

async function importEmployee(env, fields) {
  const headers = Object.keys(fields);
  const text = [headers.map(csvQuote).join(','), Object.values(fields).map(csvQuote).join(',')].join('\n');
  await env.context.importCSV({ files: [{ text: async () => text }], value: 'selected' });
  return env.context.employees[0];
}
test('actual CSV -> employee dropdown and selected leave form remain inert', async () => {
  const env = environment();
  const employee = await importEmployee(env, { '社員番号': quote + attack, '姓': attack, '名': "O'Neil", '姓カナ': attack });
  env.context.filterEmpDD();
  inert(env.elements.get('empDD').innerHTML);
  assert.doesNotMatch(env.elements.get('empDD').innerHTML, /pickEmp\([^)]*O/);
  env.context.pickEmp(employee.id);
  assert.equal(env.context.yf.employee_name, `${attack} O'Neil`);
  inert(env.elements.get('mainContent').innerHTML);
});
for (const type of ['zaishoku', 'taishoku']) {
  test(`actual CSV -> ${type} certificate keeps every imported text slot inert`, async () => {
    const env = environment();
    const employee = await importEmployee(env, { '姓': attack, '名': attack, '雇用形態': attack, '入社日': attack });
    env.context.generateCertificate(employee.id, type);
    assert.equal(env.documents.length, 1);
    inert(env.documents[0]);
    assert.ok(env.documents[0].includes('&lt;img'));
  });
}
test('actual CSV -> contract modal -> printed document keeps imported address, DOB, name and wage inert', async () => {
  const env = environment();
  const employee = await importEmployee(env, { '姓': attack, '名': attack, '住所': attack, '生年月日': attack,
    '入社日': quote + attack, '月給': quote + attack });
  env.context.emp_openContractModal(employee.id);
  inert(env.elements.get('contractModalBody').innerHTML);
  // Synthetic controls represent the modal's DOM value roundtrip, never HTML execution.
  env.elements.get('cm_start').value = employee.nyusha_date;
  env.elements.get('cm_wage').value = employee.kyuyo;
  env.elements.get('cm_work').value = attack;
  env.context.generateContract();
  assert.equal(env.documents.length, 1);
  inert(env.documents[0]);
  assert.ok(env.documents[0].includes('&lt;img'));
});
test('actual formula-like imported name is neutralized in health CSV with a synthetic health record', async () => {
  const env = environment();
  const employee = await importEmployee(env, { '姓': '=1+1', '名': '研究', '姓カナ': '@name' });
  employee.kenkou_list = [{ date: '2026-01-01', result: '異常なし' }];
  env.context.exportKenkoCSV();
  assert.equal(env.downloads.length, 1);
  const csv = decodeURIComponent(env.downloads[0].href.split(',').slice(1).join(','));
  assert.ok(csv.includes(csvQuote("'=1+1 研究")));
  assert.ok(csv.includes(csvQuote("'@name")));
});
for (const name of ['renderContractList', 'renderCertList', 'renderKenkoList', 'renderYukyuList']) {
  test(`${name} employee options keep imported name text inert`, async () => {
    const env = environment();
    await importEmployee(env, { '姓': '</option></select>' + attack, '名': '研究' });
    await env.context[name]();
    inert(env.elements.get('mainContent').innerHTML);
  });
}
test('ordinary imported name and numeric identity survive dropdown selection and document generation', async () => {
  const env = environment();
  const employee = await importEmployee(env, { '社員番号': '001-A', '姓': '山田"研究', '名': "O'Neil", '住所': '東京 & 大阪',
    '生年月日': '1990-01-01', '入社日': '2024-01-01', '月給': '-1250' });
  env.context.pickEmp(employee.id);
  assert.equal(env.context.yf.employee_id, employee.id);
  assert.equal(env.context.yf.employee_name, `${employee.sei} ${employee.mei}`);
  env.context.generateCertificate(employee.id, 'zaishoku');
  assert.ok(env.documents[0].includes('山田&quot;研究 O&#x27;Neil'));
  env.context.emp_openContractModal(employee.id);
  env.context.generateContract();
  assert.ok(env.documents[1].includes('東京 &amp; 大阪'));
});
test('CSV cannot replace backend-generated identity through an extra ID column', async () => {
  const env = environment();
  const employee = await importEmployee(env, { 'ID': 'forged-id', 'employee_id': '=other', '社員番号': '001-A', '姓': '山田', '名': '研究' });
  assert.equal(employee.id, 1);
  assert.equal(employee.shain_no, '001-A');
  env.context.pickEmp(employee.id);
  assert.equal(env.context.yf.employee_id, 1);
  env.context.pickEmp('forged-id');
  assert.equal(env.context.yf.employee_id, 1);
});
test('dropdown attribute serializes a quoted stable ID and selection preserves it exactly', () => {
  const id = '001-"quoted\'ID';
  const env = environment({ id });
  const html = env.context.empDDItems('');
  const handler = /onclick="([^"]*)"/.exec(html)[1]
    .replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
  assert.equal(handler, `pickEmp(${JSON.stringify(id)})`);
  env.context.pickEmp(id);
  assert.equal(env.context.yf.employee_id, id);
});

for (const name of ['loadRecords', 'openRecordModal', 'openDocsModal']) {
  test(`actual CSV -> ${name} employee names remain inert`, async () => {
    const env = environment();
    const employee = await importEmployee(env, { '社員番号': '001-A', '姓': '</option></select>' + attack, '名': '研究' });
    env.context.database.contracts = [{ id: 'contract-1', sites: { work_patterns: [] }, contract_employees: [{ employee_id: employee.id }] }];
    await env.context[name](name === 'openDocsModal' ? 'contract-1' : undefined);
    for (const id of ['mainContent-records', 'rec-emp-id', 'docs-emp-btns']) inert(env.elements.get(id).innerHTML);
    assert.ok([...env.elements.values()].some(el => el.innerHTML.includes('&lt;')));
  });
}
test('ordinary CSV export can be imported with unchanged text and existing generated-ID semantics', async () => {
  const env = environment({ id: 17, sei: '山田,研究"部', mei: "O'Neil", kyuyo: 0, jikyu: -1250 });
  env.context.exportCSV();
  const csv = decodeURIComponent(env.downloads[0].href.split(',').slice(1).join(','));
  await env.context.importCSV({ files: [{ text: async () => csv }], value: 'selected' });
  assert.equal(env.records[0].sei, '山田,研究"部');
  assert.equal(env.records[0].mei, "O'Neil");
  assert.equal(env.records[0].kyuyo, '0');
  assert.equal(env.records[0].jikyu, '-1250');
  assert.equal(env.records[0].id, 1); // Legacy importer creates a new backend ID, ignores exported ID.
  assert.equal(env.employee.id, 17); // Export never rewrites its original identity.
});

for (const field of ['sei','mei','seikana','meikana','birthday','gender','address','tel','email','position','koyou','nyusha_date','status','visa','visa_no','visa_expiry','koyo_hoken_no','koyo_nyusha','koyo_soshitsu','shakai_hoken_no','shakai_nyusha','shakai_soshitsu','updated_at']) {
  test(`employee CSV neutralizes formula-like ${field} display text`, () => {
    const env = environment({ [field]: '=1+1' });
    env.context.exportCSV();
    const csv = decodeURIComponent(env.downloads[0].href.split(',').slice(1).join(','));
    assert.ok(csv.includes(csvQuote("'=1+1")));
  });
}
for (const field of ['date', 'result']) {
  test(`health CSV neutralizes formula-like ${field} display text`, () => {
    const env = environment({ kenkou_list: [{ date: '2026-01-01', result: '異常なし', [field]: '=1+1' }] });
    env.context.exportKenkoCSV();
    const csv = decodeURIComponent(env.downloads[0].href.split(',').slice(1).join(','));
    assert.ok(csv.includes(csvQuote("'=1+1")));
  });
}
