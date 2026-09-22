import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function context(){
  const ctx=vm.createContext({console,Date,URL,crypto,localStorage:{getItem(){return null;}},document:{addEventListener(){}}});
  for(const f of ['employee-core','employee-files','employee-api','employee-list-detail','paid-leave-csv','dispatch'])vm.runInContext(readFileSync(new URL(`../assets/js/${f}.js`,import.meta.url),'utf8'),ctx);
  return ctx;
}
test('CSV preserves quoted multiline values; rejects malformed rows before any write',async()=>{
  const c=context();vm.runInContext('employees=[];attendanceEmployeesReady=true',c);
  const csv='\uFEFF姓,名,会社,入社日,メモ\r\nTest,One,覚善,2024-02-29,"first, line\r\nsecond ""quoted"" line"';
  const rows=c.validatedEmployeeCSV(csv);assert.equal(rows.length,1);assert.equal(rows[0].memo,'first, line\r\nsecond "quoted" line');
  for(const bad of [csv.replace('2024-02-29','2026-02-30'),csv+'"',csv.replace('会社','missing'),csv.replace('覚善','Other'),csv+'\nToo,few'])assert.throws(()=>c.validatedEmployeeCSV(bad));
  let writes=0;c.db={insertEmployees(){writes++;}};c.showToast=()=>{};c.confirm=()=>true;
  await c.importCSV({files:[{text:async()=>csv.replace('2024-02-29','bad')}],value:'file'});assert.equal(writes,0);
});
test('CSV double submit is ignored; readback failure after commit does not invite reimport',async()=>{
  const c=context();vm.runInContext('employees=[];attendanceEmployeesReady=true',c);let writes=0,release;const pending=new Promise(r=>release=r);const messages=[];
  c.db={async insertEmployees(){writes++;await pending;}};c.confirm=()=>true;c.showToast=m=>messages.push(m);c.loadEmployees=async()=>{throw Error('offline')};
  const input={files:[{text:async()=>'姓,名,会社\nTest,One,覚善'}],value:'file'};
  const first=c.importCSV(input);await Promise.resolve();await c.importCSV(input);release();await first;
  assert.equal(writes,1);assert.equal(input.value,'');assert.match(messages.at(-1),/完了.*再取込は不要/);
});
test('attachment HTML blocks active schemes and escapes URL attributes',()=>{
  const c=context();
  for(const value of ['javascript:alert(1)','data:text/html;base64,QQ==','data:image/svg+xml;base64,QQ==','x" onmouseover="alert(1)'])assert.equal(c.safeAttachmentUrl(value),'');
  const html=c.filePreviewHtml('https://example.com/a?x="&y=1');assert.doesNotMatch(html,/onclick|onmouseover/);assert.match(html,/&amp;/);
  assert.match(c.filePreviewHtml('data:image/png;base64,AAAA'),/<img/);
  assert.match(c.filePreviewHtml('data:application/pdf;base64,AAAA'),/ファイルを開く/);
});
test('unreadable dispatch history stays a rejection rather than empty data',async()=>{
  const c=context();c.fetchDispatchContractsForEmployee=async()=>{throw Error('offline')};await assert.rejects(c.loadDispatchContracts(1),/offline/);
});
test('malformed grant date/expiry never becomes a numeric available balance',()=>{
  const c=context();vm.runInContext("employees=[{id:1,nyusha_date:'2024-01-01'}];yukyuRecords=[];",c);
  for(const patch of [{expire_date:'not-a-date'},{expire_date:'2026-02-30'},{grant_date:'bad'},{days:-1}]){
    c.grant={employee_id:1,grant_date:'2025-07-01',expire_date:'2027-06-30',days:10,...patch};vm.runInContext('yukyuGrants=[grant]',c);
    const info=c.calcYukyuInfo(1,'2026-09-19');assert.equal(info.invalidGrant,true);assert.equal(info.remaining,null);
  }
});
test('site replacement submits a single atomic operation set, including original deletion',async()=>{
  const c=context(),toasts=[];let operations;
  c.document.getElementById=id=>({value:id==='s-id'?'s':id==='s-client-id'?'c':id==='s-name'?'New':''});c.wpList=[{pattern_name:'new',start_time:'09:00',end_time:'18:00'}];
  c.db={from(){return{select(){return{eq:async()=>({data:[{id:'old'}],error:null})}}}},async atomicWrite(ops){operations=ops;throw Error('offline')}};c.toast=m=>toasts.push(m);
  await c.saveSite();assert.equal(operations.length,3);assert.equal(operations[1].remove,true);assert.equal(operations[2].data.pattern_name,'new');assert.match(toasts.at(-1),/保存できません/);
});
test('CSV does not read or write before employee load or above the size limit',async()=>{
  const c=context();let reads=0; c.showToast=()=>{};
  const file={size:1,text:async()=>{reads++;return ''}};
  vm.runInContext('attendanceEmployeesReady=false',c);await c.importCSV({files:[file]});
  vm.runInContext('attendanceEmployeesReady=true',c);file.size=5*1024*1024+1;await c.importCSV({files:[file]});
  assert.equal(reads,0);
});
test('Escape delegates to the existing dirty/saving guard before closing a protected modal',()=>{
  let keydown,guarded=0,removed=0;
  const modal={id:'grantModal',classList:{remove(){removed++;}}};
  const c=vm.createContext({Map,document:{querySelectorAll:()=>[],querySelector:()=>modal,getElementById:()=>modal,addEventListener:(type,fn)=>{if(type==='keydown')keydown=fn;}},closeGrantModal(){guarded++;}});
  vm.runInContext(readFileSync(new URL('../assets/js/billing-settings.js',import.meta.url),'utf8'),c);
  keydown({key:'Escape',preventDefault(){}});assert.equal(guarded,1);assert.equal(removed,0);
  c.closeModal('grantModal',true);assert.equal(removed,1);
});
test('grant write boundary rejects negative/nonfinite days and invalid or reversed dates',async()=>{
  const c=context();let writes=0;c.db={from(){writes++;return{insert:async()=>({data:[],error:null})}},updateByRevision(){writes++;return{data:[],error:null}}};
  for(const patch of [{days:-1},{days:Infinity},{days:NaN},{grant_date:'2026-02-30'},{grant_date:'2026-09-19',expire_date:'2026-09-18'}]){
    await assert.rejects(c.saveYukyuGrant(null,patch));await assert.rejects(c.createYukyuGrants([patch]));
  }
  assert.equal(writes,0);await c.saveYukyuGrant(null,{days:0,grant_date:'2026-09-19',expire_date:'2026-09-19'});assert.equal(writes,1);
});
test('employee export supplies the required import columns and preserves quoted multiline names',()=>{
  const c=context();let csv;c.confirm=()=>true;c.dlCSV=rows=>csv=rows.map(row=>row.join(',')).join('\n');
  vm.runInContext(`employees=[{id:1,company:'覚善',shain_no:'QA',sei:'A,"B',mei:'C\\nD'}];departments=[]`,c);c.exportCSV();
  vm.runInContext('employees=[]',c);const rows=c.validatedEmployeeCSV(csv);assert.equal(rows.length,1);assert.equal(rows[0].company,'覚善');assert.equal(rows[0].shain_no,'QA');assert.equal(rows[0].sei,'A,"B');assert.equal(rows[0].mei,'C\nD');
});

test('billing accepts exact safe integers, requires month, and preserves cache on read failure',async()=>{
  const c=context(),nodes=new Map(),messages=[],saved=[];
  c.document.querySelectorAll=()=>[];c.document.getElementById=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'previous'});return nodes.get(id);};
  vm.runInContext(readFileSync(new URL('../assets/js/billing-settings.js',import.meta.url),'utf8'),c);
  c.toast=m=>messages.push(m);c.closeModal=()=>{};c.ST={billing:[{id:'previous'}]};c.reportReadFailure=e=>{if(e)messages.push('read failed');return Boolean(e);};
  const realLoad=c.loadBilling;c.loadBilling=async()=>{};
  c.document.getElementById('b-client-id').value='client';c.document.getElementById('b-month').value='2026-09';
  c.db={from(){return{insert:async p=>{saved.push(p);return{error:null};}}}};
  for(const input of ['','1e3','1.5','100oops','9007199254740992']){c.document.getElementById('b-amount').value=input;await c.saveBilling();}
  assert.equal(saved.length,0);
  for(const input of ['0','1000','-100']){c.document.getElementById('b-amount').value=input;await c.saveBilling();}
  assert.deepEqual(saved.map(x=>x.amount),[0,1000,-100]);
  c.document.getElementById('b-month').value='';await c.saveBilling();assert.equal(saved.length,3);
  const query={select(){return this},gte(){return this},lte(){return this},order:async()=>({data:null,error:Error('offline')})};c.db={from:()=>query};
  await realLoad();assert.equal(c.ST.billing[0].id,'previous');assert.equal(c.document.getElementById('billing-table').innerHTML,'previous');assert.equal(messages.at(-1),'read failed');
});

test('date-only expiry and retirement use local calendar dates around midnight and DST',async()=>{
  const prior=process.env.TZ;
  try{
    process.env.TZ='Asia/Tokyo';const c=context(),now=new Date('2026-09-22T00:30:00+09:00');
    assert.equal(c.localDateStr(now),'2026-09-22');assert.equal(c.calendarDaysUntil('2026-09-21',now),-1);assert.equal(c.calendarDaysUntil('2026-09-22',now),0);
    assert.ok(Number.isNaN(c.calendarDaysUntil('2026-02-30',now)));
    process.env.TZ='America/New_York';assert.equal(c.calendarDaysUntil('2026-03-09',new Date(2026,2,7,23,30)),2);
  }finally{if(prior===undefined)delete process.env.TZ;else process.env.TZ=prior;}
});

test('both contract forms reject reversed periods before database access',async()=>{
  const c=context(),values={'ct-id':'','ct-site-id':'s','ct-start':'2026-10-02','ct-end':'2026-10-01','rn-start':'2026-10-02','rn-end':'2026-10-01'},messages=[];
  c.document.getElementById=id=>({value:values[id]||''});c.ST={sites:[]};c.selEmps=[{id:1}];c.toast=m=>messages.push(m);let writes=0;c.db={from(){writes++;throw Error('unexpected read')},atomicWrite(){writes++}};
  await c.saveContract();await c.execRenewal();assert.equal(writes,0);assert.equal(messages.length,2);assert.ok(messages.every(m=>m.includes('開始日以降')));
});

test('contract lists and employee deadline cards stay consistent for the whole local expiry day',()=>{
  const c=context(),node={innerHTML:''};c.document.getElementById=()=>node;c.esc=x=>String(x??'');
  c.ST={ctTab:'active',contracts:[{id:'c',contract_no:'visible',status:'active',contract_end:c.localDateStr()}]};c.renderContracts();assert.match(node.innerHTML,/visible/);
  c.ST.ctTab='ended';c.renderContracts();assert.doesNotMatch(node.innerHTML,/visible/);
  const day='2026-09-22';vm.runInContext(`employees=[{id:1,status:'在籍',visa_expiry:'${day}',license_expiry:'${day}',contract_other_system:true}];`,c);c.calcYukyuInfo=()=>({});c.getLatestEmploymentContractMap=()=>({});
  const prior=process.env.TZ;try{process.env.TZ='Asia/Tokyo';for(const hour of [0,9,21,23]){const metrics=c.getLedgerFocusMetrics(new Date(2026,8,22,hour,30));assert.equal(metrics.expiredTotal,0);assert.equal(metrics.deadlineTotal,2);}}finally{if(prior===undefined)delete process.env.TZ;else process.env.TZ=prior;}
  assert.equal(c.grantExpireDate('2022-03-01'),'2024-02-29');assert.equal(c.grantExpireDate('2020-03-01'),'2022-02-28');
});

test('dashboard secondary read failure replaces loading panels with retry controls',async()=>{
  for(const tableFailure of ['sites','recent']){
    const c=context(),nodes=new Map();c.esc=x=>String(x??'');c.document.getElementById=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'spinner',textContent:''});return nodes.get(id)};c.reportReadFailure=error=>Boolean(error);
    c.db={from(table){let selection='';const q={select(value){selection=value;return q},eq(){return q},in(){return q},order(){return q},limit(){return q},then(resolve){let result={data:table==='contracts'?[{id:'c',site_id:'s',contract_end:c.localDateStr()}]:[],error:null};if((tableFailure==='sites'&&table==='sites'&&selection.includes('clients'))||(tableFailure==='recent'&&table==='contracts'&&selection.includes('sites')))result={data:null,error:Error('offline')};return Promise.resolve(result).then(resolve)}};return q}};
    await c.loadDashboard();for(const id of ['expiry-list','recent-contracts'])assert.match(nodes.get(id).innerHTML,/再読み込み/);
  }
});

test('dispatch renewal clearly explains employment contracts are updated separately',async()=>{
  const c=context(),elements={};c.document.getElementById=id=>elements[id]??=( {value:'',textContent:'',innerHTML:''} );
  c.db={from(){return{select(){return{eq(){return{single:async()=>({data:{contract_end:'2026-10-31',contract_employees:[],sites:{name:'Test'}}})}}}}}}};
  c.reportReadFailure=()=>false;c.esc=s=>s;c.openModal=()=>{};
  await c.openRenewalModal('contract');assert.match(elements['rn-emp-opts'].textContent,/自動更新されません/);assert.match(elements['rn-emp-opts'].textContent,/従業員台帳/);assert.equal(elements['rn-emp-opts'].innerHTML,'');
});
