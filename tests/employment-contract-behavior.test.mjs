import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/js/employee-settings-docs.js',import.meta.url),'utf8');
const renderer=await readFile(new URL('../assets/js/employment-contract-print.js',import.meta.url),'utf8');
const employee={id:1,sei:'検証用',mei:'一郎',address:'検証用住所',birthday:'1990-01-01'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness({blocked=false,save=async()=>[],reload=async()=>{}}={}){
  const fields={};const messages=[];const printed=[];const saved=[];let closed=false;
  const ctx=vm.createContext({
    console:{error(){}},Date,employees:[employee],canCreateEmployeeDocument:()=>true,
    showToast:message=>messages.push(message),
    document:{getElementById:id=>fields[id]||(fields[id]={value:'',focus(){},classList:{remove(){closed=true;}}})},
    window:{open:()=>blocked?null:{document:{write:html=>printed.push(html),close(){}},print(){}}},
    createEmploymentContract:record=>{saved.push(record);return save(record);},loadEmploymentContracts:reload
  });
  vm.runInContext(renderer+'\n'+source,ctx);
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
