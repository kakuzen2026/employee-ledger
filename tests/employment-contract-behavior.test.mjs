import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/js/employee-settings-docs.js',import.meta.url),'utf8');
const renderer=await readFile(new URL('../assets/js/employment-contract-print.js',import.meta.url),'utf8');
const historySource=await readFile(new URL('../assets/js/employment-contract-history.js',import.meta.url),'utf8');
const employee={id:1,sei:'検証用',mei:'一郎',address:'検証用住所',birthday:'1990-01-01'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness({blocked=false,save=async()=>[],reload=async()=>{}}={}){
  const fields={};const messages=[];const printed=[];const saved=[];let closed=false;
  const ctx=vm.createContext({
    console:{error(){}},Date,employees:[{...employee}],employmentContracts:[],documentContractsReady:true,attendanceEmployeesReady:true,canCreateEmployeeDocument:()=>true,
    emp_esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    showToast:message=>messages.push(message),
    closeModal(){closed=true;},
    openModal(){closed=false;},
    document:{getElementById:id=>fields[id]||(fields[id]={value:'',focus(){},addEventListener(){},classList:{contains:()=>false,remove(){closed=true;}}})},
    window:{open:()=>blocked?null:{document:{write:html=>printed.push(html),close(){},getElementById:()=>({addEventListener(){}})},print(){}}},
    createEmploymentContract:record=>{saved.push(record);return save(record);},loadEmploymentContracts:reload
  });
  vm.runInContext(renderer+'\n'+source+'\n'+historySource,ctx);
  const defaults=vm.runInContext('({...EMPLOYMENT_CONTRACT_DEFAULTS})',ctx);
  const terms={...defaults,contract_type:'permanent',start:'2026-09-10',place:'検証用 第一工場',place_scope:'変更なし',work_scope:'変更なし',
    work_system:'shift',work_days:'就業カレンダーによる',shift_schedule:'8:30〜17:30（休憩60分）\n22:00〜翌7:00（休憩60分）',work_hours:'1日8時間',
    wage_type:'hourly',wage:'1,250円',pay_method:'銀行振込',consultation:'人事窓口',treatment_explanation:'人事窓口',rules_access:'事務所',
    employer_name:'検証用株式会社',employer_representative:'検証用代表',employer_address:'検証用所在地'};
  for(const [key,value] of Object.entries(terms))fields[`cm_${key}`]={value,focus(){}};
  vm.runInContext('contractEmpId=1',ctx);
  return {ctx,terms,fields,messages,printed,saved,isClosed:()=>closed};
}

test('different employee workplaces, wages, hours and allowances reach the print without example personal data',()=>{
  const h=harness();
  for(const [place,wage,schedule,allowances] of [
    ['第一工場','1,250円','8:30〜17:30（休憩60分）',''],
    ['第二工場','1,230円','7:00〜16:00（休憩60分）','通勤費 13円/km'],
    ['第三工場','1,450円','22:00〜翌7:00（休憩60分）','皆勤手当 5,000円']
  ]){
    const html=h.ctx.buildEmploymentContractContent(employee,{...h.terms,place,wage,shift_schedule:schedule,allowances},'2026年9月10日');
    for(const value of [place,wage,schedule,allowances])assert.ok(html.includes(value));
    for(const section of ['雇用契約書','賃金改定','更新の有無','相談窓口','署名欄','就業場所の変更範囲','就業規則の確認方法'])assert.ok(html.includes(section));
    assert.doesNotMatch(html,/undefined|株式会社セレクト|サラザー|カワムラ|ササキ|レイエス/);
  }
});

test('all externally supplied printable values are escaped',()=>{
  const h=harness();const attack='<img src=x onerror=alert(1)>';
  const terms=Object.fromEntries(Object.keys(h.terms).map(k=>[k,attack]));
  const html=h.ctx.buildEmploymentContractContent({sei:attack,mei:attack,address:attack},terms,attack);
  assert.doesNotMatch(html,/<img|onerror=alert\(1\)>/);
  assert.ok(html.includes('&lt;img'));
});

test('permanent contract clears hidden end and renewal values before printing and saving',async()=>{
  const h=harness();h.fields.cm_end={value:'2026-12-31'};
  h.ctx.generateContract();await tick();
  assert.equal(h.saved.length,1);assert.equal(h.saved[0].contract_end,null);
  assert.equal(h.saved[0].terms.renew,'');assert.equal(h.saved[0].terms.indefinite_conversion,'');
  assert.equal(h.saved[0].issued_by,h.terms.employer_name);
  assert.doesNotMatch(h.printed[0],/2026-12-31|更新の判断基準|無期転換後/);
  assert.ok(h.isClosed());
});

test('fixed term requires an end, rejects reversed dates and retains renewal clauses',async()=>{
  const h=harness();h.fields.cm_contract_type.value='fixed';
  h.ctx.generateContract();assert.equal(h.saved.length,0);
  h.fields.cm_end.value='2026-01-01';h.ctx.generateContract();assert.equal(h.saved.length,0);
  h.fields.cm_end.value='2026-12-31';h.ctx.generateContract();await tick();
  assert.equal(h.saved[0].contract_end,'2026-12-31');
  assert.match(h.printed[0],/更新の判断基準/);assert.match(h.printed[0],/無期転換後/);
});

test('shift time bands are required and fixed hours retain their own validation',()=>{
  const h=harness();h.fields.cm_shift_schedule.value='';h.ctx.generateContract();assert.equal(h.saved.length,0);
  h.fields.cm_work_system.value='fixed';h.ctx.generateContract();assert.equal(h.saved.length,0);
  h.fields.cm_start_time.value='09:00';h.fields.cm_end_time.value='18:00';h.fields.cm_break.value='60分';
  h.ctx.generateContract();assert.equal(h.saved.length,1);assert.match(h.printed[0],/09:00〜18:00/);
});

test('blocked popup and missing required terms do not save or discard input',()=>{
  const h=harness({blocked:true});h.ctx.generateContract();
  assert.equal(h.saved.length,0);assert.equal(h.isClosed(),false);assert.equal(h.fields.cm_wage.value,'1,250円');
  h.fields.cm_place.value='';h.ctx.generateContract();assert.equal(h.saved.length,0);
});

test('pending save blocks duplicate submission and write failure preserves editable form',async()=>{
  let reject;const h=harness({save:()=>new Promise((_,r)=>{reject=r;})});
  h.ctx.generateContract();h.ctx.generateContract();assert.equal(h.saved.length,1);
  assert.equal(h.fields.contractModalBody.inert,true);
  reject(new Error('offline'));await tick();
  assert.equal(h.isClosed(),false);assert.equal(h.fields.cm_wage.value,'1,250円');
  assert.equal(h.fields.contractModalBody.inert,false);assert.match(h.messages.at(-1),/保存に失敗/);
});

test('successful save followed by reload failure is reported as saved',async()=>{
  const h=harness({reload:async()=>{throw new Error('offline');}});
  h.ctx.generateContract();await tick();assert.equal(h.saved.length,1);
  assert.match(h.messages.at(-1),/保存済み/);assert.ok(h.isClosed());
});

test('former supplementary terms stay in the main contract without a separate page',()=>{
  const h=harness();
  const extras=['place_scope','work_scope','work_system','work_days','work_hours','overtime_detail','holiday_work_detail','pay_method','retirement_age','treatment_explanation','rules','rules_access'];
  const terms={...h.terms,...Object.fromEntries(extras.map(key=>[key,`検証_${key}`]))};
  const html=h.ctx.buildEmploymentContractContent(employee,terms,'2026年9月10日');
  for(const key of extras)assert.ok(html.includes(`検証_${key}`),key);
  assert.doesNotMatch(html,/別紙|break-before:page|page-break-before:always/);
});

test('electronic seal accepts bounded raster data only and renders next to the employer',()=>{
  const h=harness();const seal='data:image/png;base64,aGVsbG8=';
  for(const value of ['https://example.org/seal.png','javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,'+'A'.repeat(350001)]){
    assert.equal(h.ctx.isEmploymentContractSeal(value),false);
    assert.doesNotMatch(h.ctx.buildEmploymentContractContent(employee,{...h.terms,employer_seal:value},'date'),/<img/);
  }
  const html=h.ctx.buildEmploymentContractContent(employee,{...h.terms,employer_seal:seal},'date');
  assert.match(html,/<img class="employer-seal"/);assert.ok(html.includes(seal));
});

function sealHarness(){
  const h=harness();const reads=[];
  h.ctx.FileReader=class{readAsDataURL(){reads.push(this);}};
  h.ctx.Image=class{naturalWidth=160;naturalHeight=168;async decode(){}};
  Object.assign(h.fields,{cm_seal_file:{value:'',files:[{type:'image/png',size:32}],isConnected:true},
    cm_employer_seal:{value:''},cm_seal_preview:{style:{},removeAttribute(){}},cm_seal_status:{textContent:''}});
  return {...h,reads};
}

test('pending or failed seal upload blocks issuing and clear restores issuing',async()=>{
  const h=sealHarness();const reading=h.ctx.readEmploymentContractSeal(h.fields.cm_seal_file);
  h.ctx.generateContract();assert.equal(h.saved.length,0);
  h.reads[0].onerror();await reading;h.ctx.generateContract();assert.equal(h.saved.length,0);
  h.ctx.clearEmploymentContractSeal();h.ctx.generateContract();await tick();assert.equal(h.saved.length,1);
});

test('a stale seal read cannot refill a cleared or closed form',async()=>{
  for(const action of ['clearEmploymentContractSeal','closeContractModal']){
    const h=sealHarness();const reading=h.ctx.readEmploymentContractSeal(h.fields.cm_seal_file);
    h.ctx[action]();h.reads[0].result='data:image/png;base64,aGVsbG8=';h.reads[0].onload();await reading;
    assert.equal(h.fields.cm_employer_seal.value,'');
  }
});

test('save without printing retains only the employee identity used on the contract',async()=>{
  const h=harness({blocked:true});
  h.ctx.employees[0].my_number='not-needed-on-contract';
  h.ctx.generateContract(false);await tick();
  assert.equal(h.printed.length,0);assert.equal(h.saved.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.saved[0].employee_snapshot)),{
    sei:employee.sei,mei:employee.mei,address:employee.address,birthday:employee.birthday
  });
  h.ctx.employees[0].address='変更後の住所';h.fields.cm_wage.value='9,999円';
  assert.equal(h.saved[0].employee_snapshot.address,employee.address);
  assert.equal(h.saved[0].terms.wage,'1,250円');assert.equal(h.saved[0].copied_from_id,null);
  assert.match(h.saved[0].created_at,/^\d{4}-\d{2}-\d{2}T/);
});

test('viewing or reprinting saved history uses the saved identity, terms and date without inserting',()=>{
  const h=harness();
  h.ctx.employmentContracts=[{id:7,employee_id:1,issued_date:'2025-02-03',employee_snapshot:{sei:'保存時',mei:'氏名',address:'保存時の住所',birthday:'1980-02-03'},terms:{...h.terms,wage:'1,100円'}}];
  h.ctx.showSavedEmploymentContract(7);
  assert.equal(h.saved.length,0);assert.equal(h.printed.length,1);
  for(const value of ['保存時 氏名','保存時の住所','1980-02-03','1,100円','2025年2月3日','印刷・PDF保存'])assert.ok(h.printed[0].includes(value));
  assert.doesNotMatch(h.printed[0],/検証用住所|1,250円/);
});

test('legacy terms display only known values and flag missing identity without inventing current values',()=>{
  const h=harness();
  h.ctx.employmentContracts=[{id:8,employee_id:1,employee_name:'当時の氏名',issued_date:'2025-01-01',is_fixed:false,issued_by:'当時の会社',terms:{wage:'1,000円'}}];
  h.ctx.showSavedEmploymentContract(8);
  assert.match(h.printed[0],/作成時の住所・生年月日/);
  assert.match(h.printed[0],/当時の氏名/);assert.match(h.printed[0],/当時の会社/);
  assert.doesNotMatch(h.printed[0],/検証用住所|undefined|1990-01-01|変更なし/);
  assert.equal(h.saved.length,0);
});

test('metadata-only or unavailable histories cannot be viewed or copied',()=>{
  const h=harness();h.ctx.employmentContracts=[{id:1,employee_id:1}];
  h.ctx.showSavedEmploymentContract(1);h.ctx.duplicateEmploymentContract(1);
  assert.equal(h.printed.length,0);assert.equal(h.saved.length,0);
  assert.match(h.ctx.employmentContractHistoryActions(h.ctx.employmentContracts[0]),/本文の保存がない/);
  h.ctx.documentContractsReady=false;
  assert.match(h.ctx.employmentContractHistoryCards(1),/読み込めていません/);
  assert.doesNotMatch(h.ctx.employmentContractHistoryCards(1),/0件|まだ保存されていません/);
  assert.equal(h.ctx.findSavedEmploymentContract(1),null);
});

test('fixed-term copy preserves all saved conditions and seal, opens a new period and never mutates its source',()=>{
  const h=harness();
  const record={id:4,contract_start:'2026-07-01',contract_end:'2026-12-31',is_fixed:true,terms:{...h.terms,contract_type:'fixed',start:'2026-07-01',end:'2026-12-31',employer_seal:'data:image/png;base64,aGVsbG8='}};
  const before=JSON.stringify(record),copied=h.ctx.employmentContractCopyTerms(record);
  assert.equal(copied.start,'2027-01-01');assert.equal(copied.end,'');
  for(const [key,value] of Object.entries(record.terms))if(!['start','end'].includes(key))assert.equal(copied[key],value,key);
  copied.wage='1,500円';assert.equal(JSON.stringify(record),before);
  h.fields.cm_contract_type.value='fixed';h.ctx.document.getElementById('cm_end').value='';h.ctx.generateContract(false);
  assert.equal(h.saved.length,0);
});

test('renewal date handles leap years and invalid prior dates without creating an invented period',()=>{
  const h=harness();
  for(const [end,start] of [['2028-02-28','2028-02-29'],['2028-02-29','2028-03-01'],['2026-02-29',''],['','']]){
    const copied=h.ctx.employmentContractCopyTerms({terms:{contract_type:'fixed',end}});
    assert.equal(copied.start,start);assert.equal(copied.end,'');
  }
  const permanent=h.ctx.employmentContractCopyTerms({terms:{...h.terms,contract_type:'permanent',start:'2025-01-01'}});
  assert.equal(permanent.start,'2025-01-01');
});

test('legacy copy leaves unsaved conditions blank so current defaults cannot silently become past terms',()=>{
  const h=harness();
  const copied=h.ctx.employmentContractCopyTerms({is_fixed:true,issued_by:'過去の雇用者',contract_end:'2026-09-30',terms:{wage:'1,000円'}});
  assert.equal(copied.start,'2026-10-01');assert.equal(copied.employer_name,'過去の雇用者');
  assert.equal(copied.work,'');assert.equal(copied.holiday,'');assert.equal(copied.renew,'');
  assert.ok(h.ctx.validateEmploymentContractTerms(copied,true).length>0);
});

test('employee history isolates people and orders same-day records by creation time and ID',()=>{
  const h=harness();h.ctx.employmentContracts=[
    {id:2,employee_id:1,issued_date:'2026-09-10',created_at:'2026-09-10T01:00:00Z',terms:h.terms},
    {id:3,employee_id:2,employee_name:'別の従業員',issued_date:'2026-09-11',terms:h.terms},
    {id:4,employee_id:1,issued_date:'2026-09-10',created_at:'2026-09-10T02:00:00Z',terms:h.terms},
    {id:5,employee_id:1,issued_date:'2026-09-10',created_at:'2026-09-10T02:00:00Z',terms:h.terms}
  ];
  const html=h.ctx.employmentContractHistoryCards(1);
  assert.match(html,/履歴（3件）/);assert.doesNotMatch(html,/data-contract-id="3"|別の従業員/);
  assert.ok(html.indexOf('data-contract-id="5"')<html.indexOf('data-contract-id="4"'));
  assert.ok(html.indexOf('data-contract-id="4"')<html.indexOf('data-contract-id="2"'));
});

test('late dispatch history cannot overwrite a different employee or a newer render',async()=>{
  const h=harness();h.ctx.currentView='detail';h.ctx.detailTab='contract';h.ctx.viewingId=1;
  let resolve;h.ctx.fetchDispatchContractsForEmployee=()=>new Promise(r=>{resolve=r;});
  let writes=0;const host={set innerHTML(_){writes++;}};
  const container={innerHTML:'',isConnected:true,querySelector:()=>host};
  const rendering=h.ctx.renderEmployeeContractHistory({id:1},container);
  assert.match(container.innerHTML,/雇用契約書の履歴/);
  h.ctx.viewingId=2;resolve([{contract_no:'previous-person'}]);await rendering;
  assert.equal(writes,0);
  h.ctx.viewingId=1;const first=h.ctx.renderEmployeeContractHistory({id:1},container),firstResolve=resolve;
  const second=h.ctx.renderEmployeeContractHistory({id:1},container),secondResolve=resolve;
  secondResolve([]);await second;firstResolve([{contract_no:'stale'}]);await first;
  assert.equal(writes,1);
});

test('unsaved input and pending save cannot be silently discarded',async()=>{
  const h=harness();h.fields.contractModal={classList:{contains:()=>true,remove(){}}};
  vm.runInContext('contractInitialTerms=JSON.stringify(collectEmploymentContractTerms())',h.ctx);
  h.fields.cm_wage.value='1,500円';h.ctx.confirm=()=>false;
  assert.equal(h.ctx.closeContractModal(),false);assert.equal(h.fields.cm_wage.value,'1,500円');
  h.ctx.confirm=()=>true;assert.equal(h.ctx.closeContractModal(),true);
  let resolve;const pending=harness({save:()=>new Promise(r=>{resolve=r;})});
  pending.ctx.generateContract(false);assert.equal(pending.ctx.closeContractModal(),false);
  assert.equal(pending.isClosed(),false);resolve([]);await tick();assert.equal(pending.isClosed(),true);
});
