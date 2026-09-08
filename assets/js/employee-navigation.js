// UI context only. Employee records and unsaved form values never enter the URL or storage.
const EMP_UI={attendanceFilter:{q:'',employee:'',month:''},attendanceTab:'records',detailMonth:'',deadlineOpen:'',documentFilters:{},activeForm:'',
  detailReturn:null,formReturn:null,dirty:false,saving:false,initialized:false,restoring:false,
  historyIndex:0,bouncing:false,lastRoute:'',focusReturn:null,highlightId:null};
const EMP_UI_KEY='employee-ui-v1';
function employeeScroll(){return document.getElementById('page-jugyoin')?.scrollTop||0;}
function employeeSnapshot(){
  return {view:currentView,employee:viewingId,tab:detailTab,listFilter:{...listFilter},
    attendanceFilter:{...EMP_UI.attendanceFilter},attendanceTab:EMP_UI.attendanceTab,
    detailMonth:EMP_UI.detailMonth,deadlineOpen:EMP_UI.deadlineOpen,documentFilters:EMP_UI.documentFilters,attendanceYear,attendanceQuarter,scroll:employeeScroll(),
    detailReturn:EMP_UI.detailReturn};
}
function employeeRoute(s){
  const base='#employees/';
  return base+s.view+(s.view==='detail'?'/'+s.employee+'/'+s.tab:'');
}
function rememberEmployeeNavigation(mode){
  if(!EMP_UI.initialized||EMP_UI.restoring||EMP_UI.activeForm||currentView==='yukyu_add'||currentView==='add'||currentView==='edit')return;
  const s=employeeSnapshot(),route=employeeRoute(s);
  const replace=mode==='replace'||(mode!=='push'&&route===EMP_UI.lastRoute);
  if(!replace)EMP_UI.historyIndex++;
  history[replace?'replaceState':'pushState']({employeeUI:s,employeeIndex:EMP_UI.historyIndex},'',route);
  EMP_UI.lastRoute=route;
  try{sessionStorage.setItem(EMP_UI_KEY,JSON.stringify(s));}catch(_){}
}
function captureEmployeeContext(){
  const q=document.getElementById('searchQ');
  if(q)listFilter={sq:q.value,fs:document.getElementById('fStatus').value,fd:document.getElementById('fDept').value,fc:document.getElementById('fCompany').value};
  if(document.getElementById('fyQ'))EMP_UI.attendanceFilter={q:document.getElementById('fyQ').value,employee:document.getElementById('fyEmp').value,month:document.getElementById('fyMonth')?.value??EMP_UI.attendanceFilter.month};
  rememberEmployeeNavigation('replace');
  return employeeSnapshot();
}
function validEmployeeSnapshot(s){
  const views=['list','detail','alert','yukyu_list','kenko_list','cert_list','contract_list','settings'];
  if(!s||!views.includes(s.view))return null;
  const tabs=['basic','visa','insurance','fuyou','yukyu','kenko','license','memo','dispatch','contract'];
  const text=v=>typeof v==='string'?v.slice(0,200):'';
  const filter=s.listFilter||{},att=s.attendanceFilter||{};
  return {view:s.view,employee:Number.isSafeInteger(Number(s.employee))?Number(s.employee):null,
    tab:tabs.includes(s.tab)?s.tab:'basic',listFilter:{sq:text(filter.sq),fs:text(filter.fs),fd:text(filter.fd),fc:text(filter.fc)},
    attendanceFilter:{q:text(att.q),employee:/^\d+$/.test(att.employee)?att.employee:'',month:/^\d{4}-\d{2}$/.test(att.month)?att.month:''},
    attendanceTab:['records','balance','allowance'].includes(s.attendanceTab)?s.attendanceTab:'records',
    detailMonth:/^\d{4}-\d{2}$/.test(s.detailMonth)?s.detailMonth:'',
    deadlineOpen:['visa','license'].includes(s.deadlineOpen)?s.deadlineOpen:'',
    documentFilters:validatedDocumentFilters(s.documentFilters),
    attendanceYear:Number.isInteger(s.attendanceYear)&&s.attendanceYear>=1900&&s.attendanceYear<=9999?s.attendanceYear:new Date().getFullYear(),
    attendanceQuarter:[0,1,2,3].includes(s.attendanceQuarter)?s.attendanceQuarter:Math.floor(new Date().getMonth()/3),
    scroll:Number.isFinite(s.scroll)?Math.max(0,s.scroll):0,detailReturn:s.detailReturn?{...s.detailReturn,detailReturn:null}:null};
}
function applyEmployeeSnapshot(raw){
  const s=validEmployeeSnapshot(raw);if(!s)return;
  EMP_UI.restoring=true;closeAttendanceDrawer();EMP_UI.dirty=false;
  currentView=s.view;viewingId=s.employee;detailTab=s.tab;listFilter=s.listFilter;
  EMP_UI.attendanceFilter=s.attendanceFilter;EMP_UI.attendanceTab=s.attendanceTab;EMP_UI.detailMonth=s.detailMonth;EMP_UI.deadlineOpen=s.deadlineOpen;EMP_UI.documentFilters=s.documentFilters;
  EMP_UI.detailReturn=validEmployeeSnapshot(s.detailReturn);attendanceYear=s.attendanceYear;attendanceQuarter=s.attendanceQuarter;
  editingId=null;yfFromDetail=false;
  // The old screen must not override the restored filters while rendering.
  document.getElementById('mainContent').replaceChildren();
  currentFilteredList=employeeFilteredList();
  render();EMP_UI.restoring=false;EMP_UI.lastRoute=employeeRoute(employeeSnapshot());
  requestAnimationFrame(()=>{document.getElementById('page-jugyoin').scrollTop=s.scroll;});
}
function initializeEmployeeNavigation(){
  if(EMP_UI.initialized)return;
  let saved=null;try{saved=JSON.parse(sessionStorage.getItem(EMP_UI_KEY));}catch(_){}
  const match=location.hash.match(/^#employees\/(list|detail|alert|yukyu_list|kenko_list|cert_list|contract_list|settings)(?:\/(\d+)\/([a-z]+))?$/);
  if(match){saved={...(saved||employeeSnapshot()),view:match[1],employee:match[2]?Number(match[2]):null,tab:match[3]||'basic'};}
  EMP_UI.historyIndex=Number.isInteger(history.state?.employeeIndex)?history.state.employeeIndex:0;
  EMP_UI.initialized=true;
  if(saved)applyEmployeeSnapshot(saved);
  rememberEmployeeNavigation('replace');
}
function markEmployeeDirty(){EMP_UI.dirty=true;}
function canLeaveEmployeeView(){
  if(EMP_UI.saving){showToast('保存処理中です。完了までお待ちください。','warn');return false;}
  return !EMP_UI.dirty||confirm('入力した内容がまだ保存されていません。変更を破棄して移動しますか？');
}
function beginEmployeeNavigation(){
  if(!canLeaveEmployeeView())return false;
  captureEmployeeContext();closeAttendanceDrawer();EMP_UI.dirty=false;return true;
}
function openEmployeeFormContext(){
  document.getElementById('emp-toast-wrap')?.replaceChildren();
  EMP_UI.formReturn=captureEmployeeContext();EMP_UI.focusReturn=document.activeElement;
  EMP_UI.dirty=false;
  if(EMP_UI.initialized){
    EMP_UI.historyIndex++;
    history.pushState({employeeUI:EMP_UI.formReturn,employeeIndex:EMP_UI.historyIndex,employeeForm:true},'','#employees/form');
  }
}
function closeAttendanceDrawer(){
  for(const id of ['attendanceDrawer','documentEditor','healthImagePreview']){const dialog=document.getElementById(id);if(dialog){dialog.close();dialog.remove();}}
  EMP_UI.activeForm='';
  document.body.classList.remove('employee-form-open');
}
function returnFromEmployeeForm(consumeHistory=true){
  const target=EMP_UI.formReturn||{...employeeSnapshot(),view:'list'};
  const consumeEntry=consumeHistory&&history.state?.employeeForm===true;
  closeAttendanceDrawer();EMP_UI.dirty=false;EMP_UI.formReturn=null;
  applyEmployeeSnapshot(target);
  if(consumeEntry)history.back();else rememberEmployeeNavigation('replace');
  requestAnimationFrame(()=>{if(EMP_UI.focusReturn?.isConnected)EMP_UI.focusReturn.focus({preventScroll:true});else{const heading=document.querySelector('#mainContent h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}});
}
function cancelEmployeeForm(){if(canLeaveEmployeeView())returnFromEmployeeForm();}
function employeeBackToList(){
  if(!beginEmployeeNavigation())return;
  applyEmployeeSnapshot(EMP_UI.detailReturn||{...employeeSnapshot(),view:'list',scroll:0});rememberEmployeeNavigation('push');
}
function updateAttendanceFilters(){
  captureEmployeeContext();renderYukyuList();rememberEmployeeNavigation('replace');
}
function setAttendanceTab(tab){captureEmployeeContext();EMP_UI.attendanceTab=tab;renderYukyuList();rememberEmployeeNavigation('replace');}
function setDetailMonth(value){
  if(!canLeaveEmployeeView()){document.getElementById('detailMonth').value=EMP_UI.detailMonth;return;}
  EMP_UI.detailMonth=value;renderDT();rememberEmployeeNavigation('replace');
}
function setEmployeeSaving(saving){
  EMP_UI.saving=saving;
  document.querySelectorAll('#documentEditor button,#documentEditor input,#documentEditor select,#grantModal button,#grantModal input,#attendanceDrawer button,#attendanceDrawer input,#attendanceDrawer textarea,#mainContent .sticky-footer button,#mainContent .form-wrap input,#mainContent .form-wrap select,#mainContent .form-wrap textarea').forEach(el=>{el.disabled=saving;});
}
function bindEmployeeLabels(root=document.getElementById('mainContent')){
  root?.querySelectorAll('.field,.frow').forEach((field,i)=>{
    const label=field.querySelector('label'),input=field.querySelector('input:not([type="hidden"]),select,textarea');
    if(label&&input&&!label.contains(input)){if(!input.id)input.id='employee-field-'+i;label.htmlFor=input.id;}
  });
}
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('beforeunload',event=>{if(EMP_UI.dirty||EMP_UI.saving){event.preventDefault();event.returnValue='';}else if(EMP_UI.initialized)captureEmployeeContext();});
  const updateViewport=()=>document.documentElement.style.setProperty('--employee-viewport-height',(window.visualViewport?.height||window.innerHeight)+'px');
  window.visualViewport?.addEventListener('resize',updateViewport);updateViewport();
  window.addEventListener('popstate',event=>{
    if(!event.state?.employeeUI||!EMP_UI.initialized)return;
    if(EMP_UI.bouncing){EMP_UI.bouncing=false;return;}
    const index=event.state.employeeIndex??0;
    if(!canLeaveEmployeeView()){EMP_UI.bouncing=true;history.go(EMP_UI.historyIndex-index);return;}
    EMP_UI.historyIndex=index;EMP_UI.formReturn=null;
    if(typeof ST!=='undefined'&&ST.page!=='jugyoin')navigate('jugyoin');
    applyEmployeeSnapshot(event.state.employeeUI);rememberEmployeeNavigation('replace');
  });
  document.addEventListener('click',event=>{if(event.target.closest('#mainContent .form-wrap .sel-btn'))markEmployeeDirty();});
  document.addEventListener('input',event=>{
    if(event.target.id==='detailMonth')return;
    if(event.target.closest('#documentEditor')||event.target.closest('#grantModal.open')||event.target.closest('#attendanceDrawer')||event.target.closest('#mainContent .form-wrap')||event.target.closest('#dtc'))markEmployeeDirty();
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='detailMonth')return;
    if(event.target.closest('#documentEditor')||event.target.closest('#grantModal.open')||event.target.closest('#attendanceDrawer')||event.target.closest('#mainContent .form-wrap')||event.target.closest('#dtc'))markEmployeeDirty();
  });
}

function validatedDocumentFilters(value){
  const result={};for(const view of ['kenko_list','cert_list','contract_list']){result[view]={};for(const key of ['employee','result','month','type','tab']){const v=value?.[view]?.[key];result[view][key]=typeof v==='string'?v.slice(0,100):'';}}return result;
}
function documentFilters(view){return EMP_UI.documentFilters[view]||(EMP_UI.documentFilters[view]={});}
function setDocumentFilter(view,key,value){
  if(!canLeaveEmployeeView())return;
  documentFilters(view)[key]=value;render();rememberEmployeeNavigation('replace');
}
function documentEmployeeOptions(selected='',activeOnly=false){
  return employees.filter(e=>!activeOnly||e.status==='在籍').map(e=>`<option value="${e.id}" ${String(selected)===String(e.id)?'selected':''}>${emp_esc(e.sei)} ${emp_esc(e.mei)} · ${emp_esc(e.shain_no||'番号未設定')}${e.status==='退職'?'（退職）':''}</option>`).join('');
}
function documentComposer(kind){
  if(!attendanceEmployeesReady)return '<p class="workspace-help" role="alert">従業員情報を再読み込みしてから書類を作成してください。<button class="btn btn-sm" onclick="loadAndRender()">再読み込み</button></p>';
  const selected=documentFilters(currentView).employee;
  return `<details id="documentComposer" class="document-composer"><summary>${kind==='cert'?'発行する従業員と証明書を選択':'契約書を作成する従業員を選択'}</summary><div class="document-compose-fields"><label for="documentEmployee">従業員<select id="documentEmployee" ${kind==='cert'?'onchange="updateCertificateActions()"':''}><option value="">選択してください</option>${documentEmployeeOptions(selected)}</select></label>${kind==='cert'?`<div class="workspace-actions" id="certificateActions">${certificateActions(selected)}</div>`:'<button class="btn btn-primary" onclick="startDocumentForEmployee(\'contract\')">契約内容を入力</button>'}</div></details>`;
}
function certificateActions(empId){const e=employees.find(e=>e.id===Number(empId));if(!e)return '<p class="workspace-help">従業員を選ぶと、発行できる証明書が表示されます。</p>';const type=e.status==='在籍'?'zaishoku':e.status==='退職'?'taishoku':'';return type?`<button class="btn btn-primary" onclick="startDocumentForEmployee('${type}')">${type==='zaishoku'?'在職':'退職'}証明書を発行</button>`:'<p class="workspace-help">在籍状態を確認してから発行してください。</p>';}
function updateCertificateActions(){document.getElementById('certificateActions').innerHTML=certificateActions(document.getElementById('documentEmployee').value);}
function canCreateEmployeeDocument(){if(attendanceEmployeesReady)return true;showToast('従業員情報を再読み込みしてから作成してください。','error');return false;}
function canIssueCertificate(e,type){if((type==='zaishoku'&&e?.status==='在籍')||(type==='taishoku'&&e?.status==='退職'))return true;showToast('在籍状態と証明書の種類が一致しません。従業員情報を確認してください。','error');return false;}
function openDocumentComposer(){if(!canCreateEmployeeDocument())return;const panel=document.getElementById('documentComposer');if(!panel)return;panel.open=true;panel.scrollIntoView({block:'nearest'});document.getElementById('documentEmployee').focus();}
function startDocumentForEmployee(kind){if(!canCreateEmployeeDocument())return;const id=Number(document.getElementById('documentEmployee')?.value),e=employees.find(e=>e.id===id);if(!e){showToast('従業員を選択してください','error');return;}if(kind==='contract')emp_openContractModal(id);else if(canIssueCertificate(e,kind))generateCertificate(id,kind);}
