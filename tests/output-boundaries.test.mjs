import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=name=>readFileSync(new URL(`../assets/js/${name}.js`,import.meta.url),'utf8');
function harness(){
  const nodes=new Map(),downloads=[],printed=[],history=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',querySelectorAll(){return [];}});return nodes.get(id);};
  const ctx=vm.createContext({console,Date,URL,crypto,confirm:()=>true,localStorage:{getItem(){return null;}},
    document:{querySelectorAll(){return [];},addEventListener(){},getElementById:node,createElement(){const a={click(){downloads.push(decodeURIComponent(a.href.split(',').slice(1).join(',')));}};return a;}},
    window:{open(){return{document:{write(html){printed.push(html);},close(){}},print(){}};}}});
  const core=source('core');vm.runInContext(core.slice(core.indexOf('// ===== XSS'),core.indexOf('// ===== STATE')),ctx);
  for(const name of ['employee-core','employee-navigation','employee-settings-docs','employment-contract-history','paid-leave-csv','employee-health','attendance-points','dispatch','billing-settings','records-documents','employee-list-detail'])vm.runInContext(source(name),ctx);
  ctx.ST={clients:[],sites:[],contracts:[],billing:[],ctTab:'active'};
  ctx.reportReadFailure=()=>false;ctx.showToast=()=>{};ctx.openModal=()=>{};ctx.closeModal=()=>{};
  ctx.createCertificate=async record=>history.push(record);ctx.loadCertificates=async()=>{};
  return {ctx,node,downloads,printed,history};
}
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|#x27);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#x27;':"'"}[x]));
function handlers(html){return [...html.matchAll(/\bonclick="([^"]*)"/g)].map(m=>decode(m[1]));}
function executeIds(ctx,html,functions,id){
  const calls=[];
  for(const fn of functions)ctx[fn]=(...args)=>calls.push([fn,...args]);
  for(const code of handlers(html))vm.runInContext(code,ctx);
  assert.equal(ctx.injected,undefined);
  for(const fn of functions){const call=calls.find(c=>c[0]===fn);assert.ok(call,fn);assert.equal(call[1],id,fn);}
}

test('CSV import through certificate popup keeps text inert and stores unchanged history',async()=>{
  for(const payload of ['<script>window.injected=1</script>','<img src=x onerror="window.injected=1">','山田 & <太郎>']){
    for(const type of ['zaishoku','taishoku']){
      const {ctx,printed,history}=harness();
      vm.runInContext('attendanceEmployeesReady=true;employees=[];departments=[];',ctx);
      ctx.db={async insertEmployees(rows){ctx.imported=rows.map((r,i)=>({...r,id:i+1}));}};
      ctx.loadEmployees=async()=>vm.runInContext('employees=imported',ctx);ctx.render=()=>{};
      const quote=s=>'"'+s.replace(/"/g,'""')+'"';
      await ctx.importCSV({files:[{size:100,text:async()=>['姓,名,会社,雇用形態,在籍状況',`${quote(payload)},${quote(payload)},覚善,${quote(payload)},${type==='zaishoku'?'在籍':'退職'}`].join('\n')}],value:'csv'});
      assert.equal(ctx.imported[0].sei,payload);
      ctx.payload=payload;vm.runInContext('companyInfo={company_name:payload,postal_code:payload,address:payload,tel:payload,representative:payload};departments=[{id:1,shozoku1:payload,shozoku2:payload}];employees[0].dept_id=1;employees[0].nyusha_date=payload;employees[0].taishoku_date=payload;',ctx);
      ctx.generateCertificate(1,type);await Promise.resolve();
      assert.equal(printed.length,1);assert.doesNotMatch(printed[0],/<script\b|<img\b/i);
      assert.ok(printed[0].includes(ctx.emp_esc(payload)));
      assert.equal(history[0].employee_name,payload+' '+payload);assert.equal(history[0].issued_by,payload);
      assert.equal(history[0].cert_type,type==='zaishoku'?'在職証明書':'退職証明書');
    }
  }
});

test('management print template escapes every stability field and insurance sibling',()=>{
  const {ctx,printed}=harness(),payload='<img src=x onerror="injected=1"> & 文面';
  const fields=['STABILITY_HOPE','STABILITY_DIRECT_REQ','STABILITY_DIRECT_ANS','STABILITY_OTHER','STABILITY_MUKIROGEN','STABILITY_ETC','KENPO_ARI','KOSEI_ARI','KOYO_ARI'];
  const body=ctx.buildMotochoHtml(Object.fromEntries(fields.map(f=>[f,payload])));
  ctx.openPdfWindow('合成台帳',body,'fixture');
  assert.equal(printed.length,1);assert.doesNotMatch(printed[0],/<img\b/i);
  assert.equal(body.split(ctx.e(payload)).length-1,fields.length);
  const normal=ctx.buildMotochoHtml({STABILITY_HOPE:'直接雇用希望',STABILITY_DIRECT_REQ:'2026-01-01 電話',STABILITY_DIRECT_ANS:'検討中'});
  assert.match(normal,/直接雇用希望/);assert.match(normal,/依頼日時・方法：2026-01-01 電話/);assert.match(normal,/派遣先の回答：検討中/);
});

test('all CSV exports neutralize formula text, including leading controls, and preserve ordinary cells',()=>{
  for(const payload of ['=1+1','+1+1','-1+1','@SUM(1,1)',' \t=1+1','\r\n+1+1','\u0000\u001f=1+1','\u00a0@SUM(1,1)']){
    const {ctx,downloads}=harness();ctx.payload=payload;
    vm.runInContext(`employees=[{id:1,company:'覚善',sei:payload,mei:'太郎',shain_no:payload,seikana:payload,meikana:'タロウ',kyuyo:0,jikyu:-100,status:'在籍',kenkou_list:[{date:'2026-01-01',result:payload}]}];departments=[];yukyuRecords=[{id:1,employee_id:1,employee_name:payload,biko:payload}];attendanceEmployeesReady=true;attendanceRecordsReady=true;`,ctx);
    ctx.exportCSV();ctx.exportYukyuCSV();ctx.exportKenkoCSV();ctx.exportAttendanceCSV();ctx.downloadSampleCSV();
    assert.equal(downloads.length,5);
    const tables=downloads.map(csv=>ctx.parseCSV(csv));
    for(const table of tables.slice(0,4)){
      const cells=Array.from(table[1]);assert.ok(cells.some(c=>c==="'"+payload||c==="'"+payload+' 太郎'));
      assert.ok(cells.filter(c=>c.includes(payload)).every(c=>c.startsWith("'")));
    }
    assert.equal(tables[0][1][18],'0');assert.equal(tables[0][1][19],'-100');
    assert.equal(tables[0][1][4],'太郎');assert.equal(tables[4][1][2],'田中');
    for(const value of ['日本語','A,"B\nC',0,-1,1.5,''])assert.equal(ctx.parseCSV(ctx.csvCell(value))[0]?.[0]??'',String(value));
  }
});

test('rendered client/site/contract/billing and selected employee actions preserve IDs after HTML decoding',async()=>{
  for(const id of ["x');injected=1;('",'x" );injected=1;//','x\\\n\"<&quot;','583b8346-fadb-4e34-910a-4a67e892165b']){
    const {ctx,node}=harness();ctx.renderClients([{id,name:'合成取引先'}]);
    executeIds(ctx,node('clients-table').innerHTML,['openClientModalById','deleteClient'],id);
    ctx.renderSites([{id,name:'合成現場'}]);executeIds(ctx,node('sites-table').innerHTML,['openSiteModalById','deleteSite'],id);
    ctx.ST.contracts=[{id,status:'active',contract_end:'2099-12-31'}];ctx.renderContracts();
    executeIds(ctx,node('contracts-table').innerHTML,['openCtDetail','openContractModal','openDocsModal','openRenewalModal','endContract','deleteContract'],id);
    const query={select(){return this;},gte(){return this;},lte(){return this;},order:async()=>({data:[{id,amount:0}]})};ctx.db={from:()=>query};await ctx.loadBilling();executeIds(ctx,node('billing-table').innerHTML,['openBillingModalById','deleteBilling'],id);
  }
  for(const id of [7,"7);injected=1;//"]){
    const {ctx,node}=harness();ctx.id=id;vm.runInContext("selEmps=[{id,name:'合成従業員'}]",ctx);ctx.renderSelEmps();
    executeIds(ctx,node('sel-emp-list').innerHTML,['removeSelEmp'],id);
  }
});

test('dispatch alert query parameters encode IDs and retain employee action type',async()=>{
  for(const id of ["x');injected=1;('",'x"&contract=other<',7]){
    const {ctx,node}=harness();ctx.id=id;
    vm.runInContext("employees=[{id,sei:'合成',mei:'従業員'}]",ctx);
    ctx.fetchDispatchContractsByEnd=async()=>[{employee_id:id,dispatch_app_contract_id:id,contract_end:'2000-01-01'}];
    const opened=[];ctx.window.open=(...args)=>opened.push(args);ctx.viewDetail=value=>assert.equal(value,id);
    await ctx.loadDispatchAlerts();for(const code of handlers(node('dispatch-alert-section').innerHTML))vm.runInContext(code,ctx);
    assert.equal(ctx.injected,undefined);assert.equal(opened.length,1);
    assert.equal(new URL(opened[0][0]).searchParams.get('contract'),String(id));
  }
});

test('detail footer, record deletion and employee document actions serialize persisted identifiers',async()=>{
  const id="x');injected=1;('", {ctx,node}=harness();
  const contract={id,status:'active',contract_end:'2099-12-31',contract_employees:[]};
  const query={select(){return this;},eq(){return this;},single:async()=>({data:contract})};ctx.db={from:()=>query};
  await ctx.openCtDetail(id);
  executeIds(ctx,node('ctd-footer').innerHTML,['openContractModal','openDocsModal','openRenewalModal','endContract','deleteContract'],id);
  const records=[{id,employee_id:7,type:'complaint',content:'合成記録'}];
  ctx.db={from(table){const q={select(){return q;},order(){return Promise.resolve({data:table==='employee_records'?records:[]});}};return q;}};
  await ctx.loadRecords();executeIds(ctx,node('mainContent-records').innerHTML,['deleteEmployeeRecord'],id);
  // Use a fresh context so the real document modal loader is still present.
  const h=harness(),documentContract={id:'contract',contract_employees:[{employee_id:id}]};
  h.ctx.db={from(table){const q={select(){return q;},eq(){return q;},in(){return q;},order(){return q;},single:async()=>({data:documentContract}),then(resolve){return Promise.resolve({data:table==='employees'?[{id,sei:'合成',mei:'従業員'}]:[]}).then(resolve);}};return q;}};
  h.ctx.currentDocContract=null;await h.ctx.openDocsModal('contract');
  const calls=[];h.ctx.genEmpDoc=(type,value)=>calls.push([type,value]);
  for(const code of handlers(h.node('docs-emp-btns').innerHTML))vm.runInContext(code,h.ctx);
  assert.equal(h.ctx.injected,undefined);assert.deepEqual(calls,[['koyo_joken',id],['chicho',id]]);
});

test('ID attributes, employee options and drag events remain inert after rendering',()=>{
  const {ctx,node}=harness(),id='x" onmouseover="injected=1',label='<img src=x onerror="injected=1">';
  ctx.id=id;ctx.label=label;vm.runInContext("departments=[{id,shozoku1:label}];employees=[{id,sei:'合成',mei:'従業員'}]",ctx);
  assert.ok(ctx.documentEmployeeOptions().includes('value="'+ctx.emp_attr(id)+'"'));
  const options=ctx.deptOptions();assert.doesNotMatch(options,/<img\b/);assert.ok(options.includes(ctx.emp_attr(id)));
  ctx.renderSettings();const html=node('mainContent').innerHTML;
  const calls=[];ctx.event={};ctx.deptDragStart=(event,value)=>calls.push(value);ctx.deptDrop=(event,value)=>calls.push(value);
  for(const m of html.matchAll(/\b(?:ondragstart|ondrop)="([^"]*)"/g))vm.runInContext(decode(m[1]),ctx);
  assert.deepEqual(calls,[id,id]);assert.equal(ctx.injected,undefined);assert.doesNotMatch(html,/<img\b/);
});


test('contract history creation ID stays inside its HTML attribute for hostile and normal IDs',async()=>{
  for(const id of ['x"><img src=x onerror="window.injected=1">', 'x&CHARS;\\\"\'<>', 7, '583b8346-fadb-4e34-910a-4a67e892165b']){
    const {ctx,node}=harness();ctx.id=id;
    vm.runInContext("documentContractsReady=true;attendanceEmployeesReady=true;employees=[{id}];employmentContracts=[];currentView='detail';detailTab='contract';viewingId=id;",ctx);
    const assertCard=html=>{
      assert.doesNotMatch(html,/<img\b/i);
      const match=html.match(/data-employee-action="contract-open" data-id="([^"]*)"/);
      assert.ok(match);assert.equal(decode(match[1]),String(id));
      assert.match(html,/この従業員の雇用契約書はまだ保存されていません/);
      assert.equal(ctx.window.injected,undefined);
    };
    assertCard(ctx.employmentContractHistoryCards(id));
    const container={innerHTML:'',isConnected:true,querySelector:()=>node('history-host')};
    ctx.fetchDispatchContractsForEmployee=async value=>{assert.equal(value,id);return [];};
    await ctx.renderEmployeeContractHistory({id},container);
    assertCard(container.innerHTML);
  }
});
