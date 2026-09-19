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
