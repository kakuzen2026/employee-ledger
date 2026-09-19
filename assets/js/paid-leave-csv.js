// Shared record presentation for the all-staff list and employee detail.
function employeeAttendanceTable(records,showEmployee=false,fromDetail=false,grants=null){
  const unified=grants!==null;
  const warning=(!attendanceRecordsReady?'<div class="empty" role="alert">勤怠記録を読み込めませんでした。<button class="btn" onclick="retryAttendanceLoad()">再読み込み</button></div>':'')+(unified&&!attendanceGrantsReady?'<div class="empty" role="alert">付与記録を読み込めませんでした。<button class="btn" onclick="retryAttendanceLoad()">再読み込み</button></div>':'');
  const entries=[...(attendanceRecordsReady?records:[]).map(r=>({date:r.use_date||'',record:r})),...(unified&&attendanceGrantsReady?grants:[]).map(g=>({date:g.grant_date||'',grant:g}))].sort((a,b)=>b.date.localeCompare(a.date)||Number(!!b.grant)-Number(!!a.grant));
  if(!entries.length)return warning||`<div class="empty">この条件の${unified?'付与・勤怠':'勤怠'}記録はありません。</div>`;
  return warning+`<div class="table-wrap attendance-table"><table><thead><tr><th>日付</th>${showEmployee?'<th>氏名</th>':''}<th>内容</th><th>種別</th><th>区分</th><th>ポイント</th><th>入力者</th><th><span class="sr-only">操作</span></th></tr></thead><tbody>${entries.map(({record:r,grant:g})=>g?`<tr id="leave-grant-${Number(g.id)}">
    <td data-label="日付">${emp_esc(g.grant_date||'日付未設定')}</td>
    <td data-label="内容"><strong>有休付与 ${g.days==null||g.days===''?'日数未設定':emp_esc(g.days)+'日'}</strong><div class="record-note">期限：${emp_esc(g.expire_date||'—')}</div></td>
    <td data-label="種別">付与</td><td data-label="区分">—</td><td data-label="ポイント">—</td><td data-label="入力者">—</td>
    <td class="no-label"><button class="btn btn-sm" onclick="openGrantModal(${Number(g.employee_id)},${Number(g.id)})">編集</button><button class="text-button danger-text" onclick="delGrant(${Number(g.id)},${Number(g.employee_id)})">削除</button></td></tr>`:`<tr id="attendance-record-${Number(r.id)}" class="${EMP_UI.highlightId===r.id?'record-highlight':''}">
    <td data-label="日付">${emp_esc(r.use_date||'日付未設定')}</td>
    ${showEmployee?`<td data-label="氏名"><button class="emp-name" onclick="viewDetail(${Number(r.employee_id)},'yukyu')">${emp_esc(r.employee_name||'氏名未設定')}</button></td>`:''}
    <td data-label="内容"><strong>${unified&&['全日','半休（午前）','半休（午後）'].includes(r.use_type)?'有休取得 ':''}${emp_esc(r.use_type||'未設定')}</strong>${r.biko?`<div class="record-note">${emp_esc(r.biko)}</div>`:''}<div class="record-note">${r.touroku_date?'登録 '+emp_esc(r.touroku_date):''}</div></td>
    <td data-label="種別">${emp_esc(r.shubetsu||'—')}</td><td data-label="区分">${emp_esc(r.kubun||'未分類')}</td>
    <td data-label="ポイント">${attendancePoints(r)===null?'未確定':attendancePoints(r)+'pt'}</td><td data-label="入力者">${emp_esc(r.input_by||'—')}</td>
    <td class="no-label"><button class="btn btn-sm" onclick="openYukyuEdit(${Number(r.id)},${fromDetail})">編集</button><button class="text-button danger-text" onclick="delYR(${Number(r.id)})">削除</button></td></tr>`).join('')}</tbody></table></div>`;
}
function renderYukyuList(){
  const fq=EMP_UI.attendanceFilter.q,fe=EMP_UI.attendanceFilter.employee,fm=EMP_UI.attendanceFilter.month;
  const list=yukyuRecords.filter(r=>{
    const e=employees.find(x=>x.id===Number(r.employee_id));
    return (!fq||(employeeSearchText(e)+(r.employee_name||'').toLowerCase()).includes(fq.toLowerCase()))&&(!fe||Number(r.employee_id)===Number(fe))&&(!fm||r.use_date?.startsWith(fm));
  }).sort((a,b)=>(b.use_date||'').localeCompare(a.use_date||''));
  const activeEmps=employees.filter(e=>e.status==='在籍'&&(!fe||Number(e.id)===Number(fe))&&(!fq||employeeSearchText(e).includes(fq.toLowerCase())));
  const tab=EMP_UI.attendanceTab;
  document.getElementById('mainContent').innerHTML=`
    <div class="workspace-heading"><h1>有休・勤怠</h1><div class="workspace-actions"><button class="btn btn-sm" onclick="exportYukyuCSV()">勤怠CSV</button><button class="btn btn-primary" onclick="showView('yukyu_add')">＋ 有休・勤怠を登録</button></div></div>
    <nav class="workspace-tabs" aria-label="有休・勤怠の表示">${[['records','勤怠記録'],['balance','有休残数・付与'],['allowance','皆勤手当']].map(([key,label])=>`<button class="${key===tab?'active':''}" ${key===tab?'aria-current="page"':''} onclick="setAttendanceTab('${key}')">${label}</button>`).join('')}</nav>
    <div class="search-bar attendance-search"><div class="search-input-group"><input id="fyQ" aria-label="勤怠の氏名・所属で検索" placeholder="氏名・所属で検索" value="${emp_attr(fq)}" onkeydown="if(event.key==='Enter'&&!event.isComposing)updateAttendanceFilters()"><button class="btn" onclick="updateAttendanceFilters()">検索</button></div>
      <select id="fyEmp" aria-label="従業員" onchange="updateAttendanceFilters()"><option value="">すべての従業員</option>${employees.map(e=>`<option value="${e.id}" ${fe==e.id?'selected':''}>${emp_esc(e.sei)} ${emp_esc(e.mei)}${e.status==='退職'?'（退職）':''}</option>`).join('')}</select>
      ${tab==='records'?`<label class="month-filter">対象月<input type="month" id="fyMonth" value="${emp_attr(fm)}" onchange="updateAttendanceFilters()"></label>`:''}
    </div>
    ${tab==='allowance'?attendanceReportHtml(attendanceFilteredEmployees(fq,fe)):tab==='balance'?`
      <p class="workspace-help">在籍中の従業員を表示しています。詳細から付与の登録・編集ができます。</p>
      ${!attendanceGrantsReady||!attendanceRecordsReady?'<div class="empty" role="alert">有休データを読み込めませんでした。<button class="btn" onclick="loadAndRender()">再読み込み</button></div>':`<div class="table-wrap"><table><thead><tr><th>氏名</th><th>所属</th><th>有休残数</th><th>付与済み合計</th><th>記録上の取得合計</th><th>次回付与日</th><th></th></tr></thead><tbody>${activeEmps.map(e=>{const info=calcYukyuInfo(e.id);return `<tr><td data-label="氏名"><button class="emp-name" onclick="viewDetail(${e.id},'yukyu')">${emp_esc(e.sei)} ${emp_esc(e.mei)}</button></td><td data-label="所属">${emp_esc(deptLabelById(e.dept_id)||'—')}</td><td data-label="有休残数"><strong>${info.invalidGrant?'未確認':info.remaining+'日'}</strong></td><td data-label="付与済み合計">${info.invalidGrant?'未確認':info.granted+'日'}</td><td data-label="記録上の取得合計">${info.invalidGrant?'未確認':info.used+'日'}</td><td data-label="次回付与日">${info.invalidGrant?'未確認':emp_esc(info.nextDate||'—')}</td><td class="no-label"><button class="btn btn-sm" onclick="viewDetail(${e.id},'yukyu')">付与・詳細</button></td></tr>`;}).join('')||'<tr><td colspan="7">該当する従業員がいません。</td></tr>'}</tbody></table></div>`}`:employeeAttendanceTable(list,true)}`;
}
const PAID_LEAVE_STALE_MESSAGE='別の端末またはタブでこの記録が更新されています。最新内容を表示しました。確認してからもう一度操作してください。';
function paidLeaveRevision(row){return row?._revision==null?0:row._revision;}
function isStaleWrite(error){return error?.code==='STALE_WRITE';}
async function reloadPaidLeaveAfterStale(kind,employeeId=null){
  if(kind==='grant'){
    closeGrantModal(true);await loadGrants();renderDT();
  }else{
    await loadYukyu();
    if(currentView==='yukyu_add')returnFromEmployeeForm();
    else if(currentView==='detail')renderDT();
    else renderYukyuList();
  }
  showToast(PAID_LEAVE_STALE_MESSAGE,'warn');
}
async function delYR(id){
  if(!confirmPermanentDelete('この有休・勤怠記録'))return;
  const record=yukyuRecords.find(row=>row.id===Number(id));
  if(!record){showToast('有休・勤怠記録が見つかりません','error');return;}
  try{
    await deleteYukyuRecord(id,paidLeaveRevision(record));await loadYukyu();
    if(currentView==='yukyu_list')renderYukyuList();else renderDT();
  }catch(error){
    if(isStaleWrite(error))await reloadPaidLeaveAfterStale('record',record.employee_id);
    else showToast('削除に失敗しました：'+error.message,'error');
  }
}

function toggleKousoku(id,useKousoku,btn){
  btn.closest('.sel-group').querySelectorAll('.sel-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  const row=document.getElementById('kousokuDateRow');
  const note=row?.nextElementSibling;
  if(useKousoku){
    if(row)row.style.display='flex';
    if(note)note.style.display='none';
  } else {
    if(row)row.style.display='none';
    // 参照しないを選んだら即座にクリア保存
    saveKousokuDate(id,true);
  }
}
async function saveKousokuDate(id,clear=false){
  const d=clear?'':document.getElementById('kousokuInput')?.value||'';
  const e=employees.find(x=>x.id===id);
  await updateKousokuStartDate(id,d,new Date().toISOString().slice(0,10));
  if(!clear)showToast('保存しました');
  renderDT();
}

// ---- 有給付与 ----
let grantEmpId=null,grantEditId=null,grantEditRevision=null;
function requireGrantData(){
  if(employeeGrantDataReady())return true;
  showToast('従業員・有休付与データを再読み込みしてから操作してください。','error');return false;
}
function openGrantModal(empId,editGrantId=null){
  if(!requireGrantData()||!canLeaveEmployeeView())return;
  if(EMP_UI.dirty)renderDT();EMP_UI.dirty=false;
  grantEmpId=empId;grantEditId=editGrantId;grantEditRevision=null;
  document.getElementById('grantModalTitle').textContent=editGrantId?'有給付与を編集':'有給付与を登録';
  if(editGrantId){
    const g=yukyuGrants.find(x=>x.id===editGrantId);
    grantEditRevision=paidLeaveRevision(g);
    document.getElementById('gm_date').value=g?.grant_date||'';
    document.getElementById('gm_days').value=g?.days!=null?g.days:'';
    document.getElementById('gm_expire').value=g?.expire_date||'';
  } else {
    const info=calcYukyuInfo(empId);
    const d=info.nextDate||new Date().toISOString().slice(0,10);
    document.getElementById('gm_date').value=d;
    document.getElementById('gm_days').value=calcYukyuLegalDays(empId,d)??'';
    document.getElementById('gm_expire').value='';
  }
  const dateInput=document.getElementById('gm_date');
  const daysInput=document.getElementById('gm_days');
  dateInput.oninput=()=>{daysInput.value=calcYukyuLegalDays(grantEmpId,dateInput.value)??'';markEmployeeDirty();};
  openModal('grantModal');
}
function closeGrantModal(force=false){
  if(!force&&!canLeaveEmployeeView())return;
  closeModal('grantModal',true);grantEmpId=null;grantEditId=null;grantEditRevision=null;EMP_UI.dirty=false;
}
async function saveGrant(){
  if(EMP_UI.saving||!requireGrantData())return;
  const d=document.getElementById('gm_date').value;
  if(!d){showToast('付与日は必須です','error');return;}
  const daysVal=document.getElementById('gm_days').value;
  const days=daysVal!==''?Number(daysVal):null;
  let expire=document.getElementById('gm_expire').value;
  if(!expire){
    const ed=new Date(d);ed.setFullYear(ed.getFullYear()+2);ed.setDate(ed.getDate()-1);
    expire=ed.toISOString().slice(0,10);
  }
  let saved=false;setEmployeeSaving(true);
  try{
    if(grantEditId){
      await saveYukyuGrant(grantEditId,{grant_date:d,days,expire_date:expire},grantEditRevision);
    } else {
      await saveYukyuGrant(null,{employee_id:grantEmpId,grant_date:d,days,expire_date:expire});
    }
    saved=true;EMP_UI.dirty=false;
    await loadGrants();closeGrantModal(true);renderDT();
  }catch(e){
    if(saved){closeGrantModal(true);renderDT();showToast('付与の保存は完了しました。最新データを再読み込みしてください。','warn');}
    else if(isStaleWrite(e))await reloadPaidLeaveAfterStale('grant');
    else{
      showToast('保存に失敗しました：'+e.message,'error');
      if(e.code==='STALE_WRITE'&&!document.getElementById('employee-stale')){
        const notice=document.createElement('div');notice.id='employee-stale';notice.setAttribute('role','alert');
        notice.innerHTML='<p>別の画面で更新されています。入力内容を控えてから、最新情報を読み込んでください。</p><button class="btn" onclick="reloadEmployeeEdit()">最新情報を読み込む</button>';
        document.querySelector('#mainContent .form-wrap').prepend(notice);
      }
    }
  }finally{setEmployeeSaving(false);}
}
async function delGrant(id,empId){
  if(EMP_UI.saving||!requireGrantData())return;
  if(!confirm('この付与記録を削除しますか？\n一覧と残日数の計算から除外し、この付与日の自動再作成を停止します。'))return;
  const grant=yukyuGrants.find(row=>row.id===Number(id));
  if(!grant){showToast('有給付与が見つかりません','error');return;}
  let deleted=false;setEmployeeSaving(true);
  try{
    await deleteYukyuGrant(id,paidLeaveRevision(grant));
    deleted=true;
    await loadGrants();renderDT();
  }catch(error){
    if(deleted){renderDT();showToast('削除は完了しました。最新データを再読み込みしてください。','warn');}
    else if(isStaleWrite(error))await reloadPaidLeaveAfterStale('grant',empId);
    else showToast('削除に失敗しました：'+error.message,'error');
  }finally{setEmployeeSaving(false);}
}

// ---- 有給登録 ----
function newAttendanceDraft(employeeId=null){
  const e=employees.find(x=>x.id===employeeId);
  return {employee_id:e?.id||null,employee_name:e?e.sei+' '+e.mei:'',use_date:localDateStr(),use_type:'',shubetsu:'',kubun:'',input_by:'',biko:''};
}
function openYukyuFromList(){
  if(!canLeaveEmployeeView())return;
  openEmployeeFormContext();
  yf=newAttendanceDraft(Number(EMP_UI.attendanceFilter.employee)||null);yfFromDetail=false;
  currentView='yukyu_add';setNav('tYukyu');renderYukyuAdd();
}
function openYukyuFromDetail(empId){
  if(!canLeaveEmployeeView()||!employees.some(e=>e.id===empId))return;
  openEmployeeFormContext();yf=newAttendanceDraft(empId);
  yfFromDetail=true;currentView='yukyu_add';setNav('tList');renderYukyuAdd();
}
function openYukyuEdit(id,fromDetail=false){
  const r=yukyuRecords.find(x=>x.id===Number(id));
  if(!r){showToast('有休・勤怠記録が見つかりません','error');return false;}
  if(!canLeaveEmployeeView())return false;
  if(currentView!=='yukyu_add')openEmployeeFormContext();
  EMP_UI.dirty=false;
  yf={id:r.id,_revision:paidLeaveRevision(r),employee_id:r.employee_id,employee_name:r.employee_name||'',use_date:r.use_date||'',use_type:r.use_type||'',shubetsu:r.shubetsu||'',kubun:r.kubun||'',input_by:r.input_by||'',biko:r.biko||''};
  yfFromDetail=fromDetail;currentView='yukyu_add';setNav(fromDetail?'tList':'tYukyu');renderYukyuAdd();return true;
}
function renderYukyuAdd(){
  let dialog=document.getElementById('attendanceDrawer');
  const isNew=!dialog;
  if(isNew){
    dialog=document.createElement('dialog');dialog.id='attendanceDrawer';dialog.className='attendance-drawer';
    dialog.setAttribute('aria-labelledby','attendanceFormTitle');
    dialog.addEventListener('cancel',event=>{event.preventDefault();cancelEmployeeForm();});
    document.getElementById('emp-app-inner').appendChild(dialog);
  }
  const options=(key,label,values)=>`<fieldset class="frow"><legend>${label}<span class="required-mark">必須</span></legend><div class="sel-group">${values.map(t=>`<button type="button" class="sel-btn ${yf[key]===t?'selected':''}" aria-pressed="${yf[key]===t}" onclick="selYF('${key}','${t}',this)">${t}</button>`).join('')}</div></fieldset>`;
  dialog.innerHTML=`<form onsubmit="event.preventDefault();saveYR()" novalidate>
    <div class="drawer-header"><div><h2 id="attendanceFormTitle">有休・勤怠を${yf.id?'編集':'登録'}</h2><p>保存後は、元の画面に戻ります。</p></div><button class="drawer-close" type="button" aria-label="登録画面を閉じる" onclick="cancelEmployeeForm()">×</button></div>
    <div class="drawer-fields">
      <div class="frow"><label for="empQ">従業員<span class="required-mark">必須</span></label>
        ${yf.employee_id?`<div class="emp-selected-box"><strong>${emp_esc(yf.employee_name)}</strong>${!yfFromDetail?'<button type="button" class="text-button" onclick="changeYukyuEmployee()">変更</button>':''}</div>`:`<div class="emp-search-wrap"><input class="emp-search-input" id="empQ" aria-label="従業員を検索" placeholder="氏名で検索して選択" oninput="filterEmpDD()" onfocus="showEmpDD()" onkeydown="if(event.key==='ArrowDown'){event.preventDefault();document.querySelector('#empDD button')?.focus()}" autocomplete="off"><div class="emp-dropdown" id="empDD">${empDDItems('')}</div></div>`}
      </div>
      <div class="frow"><label for="yDate">日付<span class="required-mark">必須</span></label><input type="date" id="yDate" value="${emp_attr(yf.use_date||localDateStr())}" oninput="yf.use_date=this.value;renderYukyuDuplicateWarning()" aria-required="true"></div>
      <div id="yukyuDupWarning">${yukyuDuplicateWarningHtml(yf.use_date||localDateStr())}</div>
      ${options('use_type','内容（全日・半休は有休）',USE_TYPES)}
      ${options('shubetsu','種別',SHUBETSU)}${options('kubun','区分',KUBUN)}${options('input_by','入力者',INPUT_BY)}
      <div class="frow"><label for="yBiko">備考（任意）</label><textarea id="yBiko" rows="3" oninput="yf.biko=this.value">${emp_textarea(yf.biko||'')}</textarea></div>
    </div><div class="drawer-footer"><button type="button" class="btn" onclick="cancelEmployeeForm()">キャンセル</button><button id="saveAttendanceButton" type="submit" class="btn btn-primary">保存する</button></div>
  </form>`;
  document.body.classList.add('employee-form-open','employee-editing');
  if(isNew)dialog.showModal();
}
function empDDItems(q){
  const list=employees.filter(e=>e.status==='在籍'&&(!q||employeeSearchText(e).includes(q.toLowerCase())));
  return list.map(e=>`<button type="button" class="emp-option" onclick="pickEmp(${e.id})"><strong>${emp_esc(e.sei)} ${emp_esc(e.mei)}</strong><span>${emp_esc(e.shain_no||'')} · ${emp_esc(deptLabelById(e.dept_id)||'')}</span></button>`).join('')||'<p class="workspace-help">該当する従業員がいません。</p>';
}
function showEmpDD(){document.getElementById('empDD')?.classList.add('show');}
function hideEmpDD(){document.getElementById('empDD')?.classList.remove('show');}
function filterEmpDD(){const q=document.getElementById('empQ')?.value||'',d=document.getElementById('empDD');if(d){d.innerHTML=empDDItems(q);d.classList.add('show');}}
function pickEmp(id){const e=employees.find(x=>x.id===id);if(!e)return;yf.employee_id=id;yf.employee_name=e.sei+' '+e.mei;markEmployeeDirty();renderYukyuAdd();document.getElementById('yDate').focus();}
function changeYukyuEmployee(){yf.employee_id=null;yf.employee_name='';markEmployeeDirty();renderYukyuAdd();document.getElementById('empQ').focus();}
function selYF(key,val,btn){yf[key]=val;markEmployeeDirty();btn.closest('.sel-group').querySelectorAll('.sel-btn').forEach(b=>{const active=b===btn;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});if(key==='use_type')renderYukyuDuplicateWarning();}
function previewYukyuRecord(id){
  const r=yukyuRecords.find(x=>x.id===id);if(!r)return;
  const dialog=document.createElement('dialog');dialog.className='attendance-preview';dialog.setAttribute('aria-label','同日の申請');
  dialog.innerHTML=`<h2>同日の申請</h2><p>${emp_esc(r.employee_name)}</p><dl><dt>日付・内容</dt><dd>${emp_esc(r.use_date)} · ${emp_esc(r.use_type||'未設定')}</dd><dt>種別・区分</dt><dd>${emp_esc(r.shubetsu||'—')} · ${emp_esc(r.kubun||'未分類')}</dd><dt>入力者</dt><dd>${emp_esc(r.input_by||'—')}</dd><dt>備考</dt><dd>${emp_esc(r.biko||'—')}</dd></dl><div class="workspace-actions"><button class="btn" data-close>入力に戻る</button><button class="btn btn-primary" data-edit>この申請を編集</button></div>`;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.querySelector('[data-edit]').onclick=()=>{if(openYukyuEdit(id,yfFromDetail))dialog.close();};
  dialog.addEventListener('close',()=>dialog.remove());document.getElementById('emp-app').appendChild(dialog);dialog.showModal();
}
function findYukyuSameDayRecords(employeeId,useDate,ignoreId=null){
  if(!employeeId||!useDate)return [];
  const emp=employees.find(e=>e.id===Number(employeeId));
  const shainNo=(emp?.shain_no||'').toString().trim();
  return yukyuRecords.filter(r=>{
    if(ignoreId&&Number(r.id)===Number(ignoreId))return false;
    if(r.use_date!==useDate)return false;
    const recEmp=employees.find(e=>e.id===Number(r.employee_id));
    const recNo=(recEmp?.shain_no||'').toString().trim();
    return shainNo&&recNo?recNo===shainNo:Number(r.employee_id)===Number(employeeId);
  });
}
function findYukyuDuplicateRecord(employeeId,useDate,ignoreId=null,useType=yf.use_type){
  const nonLeave=['欠勤','遅刻','早退'];
  return findYukyuSameDayRecords(employeeId,useDate,ignoreId).find(r=>
    nonLeave.includes(useType)||nonLeave.includes(r.use_type)?r.use_type===useType:true
  )||null;
}
function yukyuDuplicateWarningHtml(useDate){
  const records=findYukyuSameDayRecords(yf.employee_id,useDate,yf.id);
  if(!records.length)return '';
  const duplicate=findYukyuDuplicateRecord(yf.employee_id,useDate,yf.id);
  return `<div class="alert alert-warning" style="margin-bottom:16px">
    <div>同じ従業員・同じ日付の申請が${records.length}件あります。${duplicate?'同じ内容の重複登録はできません。':''}</div>
    <ul style="margin:8px 0 0;padding-left:20px">${records.map(r=>`<li>${Number.isSafeInteger(Number(r.id))?`<a href="#attendance-record-${Number(r.id)}" onclick="event.preventDefault();previewYukyuRecord(${Number(r.id)})">${emp_esc(r.use_date)}・${emp_esc(r.use_type||'内容未設定')}・${emp_esc(r.kubun||'未分類')}の申請を開く</a>`:'申請IDを確認してください'}</li>`).join('')}</ul>
  </div>`;
}
function renderYukyuDuplicateWarning(){
  const el=document.getElementById('yukyuDupWarning');
  if(el)el.innerHTML=yukyuDuplicateWarningHtml(document.getElementById('yDate')?.value||'');
}
async function saveYR(){
  if(EMP_UI.saving)return;
  if(!yf.employee_id){showToast('従業員を選択してください','error');return;}
  const d=document.getElementById('yDate')?.value;
  if(!d){showToast('使用日を入力してください','error');return;}
  if(findYukyuDuplicateRecord(yf.employee_id,d,yf.id)){
    alert('同じ社員番号・日付・内容の記録がすでにあります。重複登録はできません。');
    renderYukyuDuplicateWarning();
    return;
  }
  if(!['全日','半休（午前）','半休（午後）','欠勤','遅刻','早退'].includes(yf.use_type)){showToast('内容を選択してください','error');return;}
  if(!attendanceMonth(d)){showToast('正しい日付を入力してください','error');return;}
  if(!yf.shubetsu){showToast('種別を選択してください','error');return;}
  if(!['計画','突発'].includes(yf.kubun)){showToast('計画または突発を選択してください','error');return;}
  if(!yf.input_by){showToast('入力者を選択してください','error');return;}
  let saved=false;
  setEmployeeSaving(true);
  try{
    const payload={employee_id:yf.employee_id,employee_name:yf.employee_name,use_date:d,use_type:yf.use_type,shubetsu:yf.shubetsu,kubun:yf.kubun,input_by:yf.input_by,biko:document.getElementById('yBiko')?.value||''};
    const result=yf.id?await updateYukyuRecord(yf.id,payload,yf._revision):await createYukyuRecord({...payload,touroku_date:new Date().toISOString().slice(0,10)});
    saved=true;EMP_UI.dirty=false;EMP_UI.highlightId=yf.id||result?.[0]?.id||null;
    await loadYukyu();returnFromEmployeeForm();showToast('保存しました');
  }catch(e){
    if(saved){returnFromEmployeeForm();showToast('保存は完了しました。一覧の再読み込みに失敗したため、再読み込みしてください。','warn');}
    else if(isStaleWrite(e))await reloadPaidLeaveAfterStale('record');
    else{
      showToast('保存に失敗しました：'+e.message,'error');
      if(e.code==='STALE_WRITE'&&!document.getElementById('employee-stale')){
        const notice=document.createElement('div');notice.id='employee-stale';notice.setAttribute('role','alert');
        notice.innerHTML='<p>別の画面で更新されています。入力内容を控えてから、最新情報を読み込んでください。</p><button class="btn" onclick="reloadEmployeeEdit()">最新情報を読み込む</button>';
        document.querySelector('#mainContent .form-wrap').prepend(notice);
      }
    }
  }finally{setEmployeeSaving(false);}
}

// ---- 従業員フォーム ----
let employeeFormRevision;
function renderForm(id){
  const isEdit=id!==null,e=isEdit?employees.find(x=>x.id===id):{};
  employeeFormRevision=e._revision;
  rcImgData=e.residence_card||'';
  licFormImgData='';
  skFormImgData=(e.shikaku_list||[]).slice(0,3).map(s=>s.img||'');
  while(skFormImgData.length<3)skFormImgData.push('');
  document.getElementById('mainContent').innerHTML=`
    <div class="sticky-back">
      <button class="btn btn-sm" onclick="cancelEmployeeForm()">← 戻る</button>
      <h2>${isEdit?'従業員情報を編集':'新規従業員登録'}</h2>
    </div>
    <div class="form-wrap">
    <div class="section-title">基本情報</div>
    <div class="field-grid">
      ${fi('shain_no','社員番号',e.shain_no)}
      ${fi('my_number','マイナンバー',e.my_number)}
    </div>
    <div class="field-grid" style="margin-top:10px">
      ${fi('sei','姓',e.sei)}${fi('mei','名',e.mei)}
    </div>
    <div class="field-grid" style="margin-top:10px">
      ${fi('seikana','姓カナ',e.seikana)}${fi('meikana','名カナ',e.meikana)}
    </div>
    <div class="field-grid" style="margin-top:10px">
      <div class="field">
        <label>生年月日</label>
        <input type="date" id="f_birthday" value="${emp_esc(e.birthday||'')}" oninput="calcAge()">
      </div>
      <div class="field">
        <label>年齢</label>
        <div id="ageDisplay" style="padding:7px 10px;border:1px solid var(--emp-border);border-radius:var(--emp-radius);background:var(--emp-bg);font-size:13px;color:var(--emp-text2)">${e.birthday?calcAgeVal(e.birthday)+'歳':'生年月日を入力してください'}</div>
      </div>
      <div class="field"><label>性別</label><select id="f_gender">${['男','女','その他'].map(x=>`<option ${e.gender===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>国籍</label>
        <select id="f_nationality" onchange="document.getElementById('f_nationality_other').style.display=this.value==='その他'?'block':'none'">
          ${['','日本','ブラジル','ベトナム','中国','フィリピン','インドネシア','ミャンマー','タイ','ペルー','ネパール','韓国','その他'].map(x=>`<option value="${x}" ${(e.nationality||'')==x?'selected':(!['','日本','ブラジル','ベトナム','中国','フィリピン','インドネシア','ミャンマー','タイ','ペルー','ネパール','韓国','その他'].includes(e.nationality||'')&&x==='その他')?'selected':''}>${x||'選択してください'}</option>`).join('')}
        </select>
        <input type="text" id="f_nationality_other" placeholder="国籍を入力" value="${!['','日本','ブラジル','ベトナム','中国','フィリピン','インドネシア','ミャンマー','タイ','ペルー','ネパール','韓国','その他'].includes(e.nationality||'')?emp_attr(e.nationality||''):''}" style="margin-top:6px;display:${(e.nationality&&!['','日本','ブラジル','ベトナム','中国','フィリピン','インドネシア','ミャンマー','タイ','ペルー','ネパール','韓国','その他'].includes(e.nationality))||e.nationality==='その他'?'block':'none'}">
      </div>
    </div>
    ${fi('address','住所',e.address,'text',false,true)}
    <div class="field-grid">${fi('tel','電話番号',e.tel)}${fi('email','メールアドレス',e.email)}</div>
    <div class="section-title">雇用情報</div>
    <div class="field-grid">
      <div class="field" style="grid-column:1/-1">
        <label>会社（大分類）<span style="color:var(--emp-danger)"> *</span></label>
        <div class="sel-group">
          <button type="button" class="sel-btn ${e.company==='セレクト'?'selected':''}" onclick="this.closest('.sel-group').querySelectorAll('.sel-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');document.getElementById('f_company').value='セレクト'">セレクト</button>
          <button type="button" class="sel-btn ${e.company==='覚善'?'selected':''}" onclick="this.closest('.sel-group').querySelectorAll('.sel-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');document.getElementById('f_company').value='覚善'">覚善</button>
        </div>
        <input type="hidden" id="f_company" value="${emp_esc(e.company||'')}">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>部署（所属1 / 所属2）</label>
        <div class="dept-inline">
          <select id="f_dept_id">${deptOptions(e.dept_id)}</select>
          <button type="button" class="dept-add-btn" data-employee-action="department-add" data-select-target="f_dept_id">＋ 部署を追加</button>
        </div>
      </div>
    </div>
    <div class="field-grid">
      ${fi('position','役職',e.position)}
      <div class="field"><label>雇用形態</label><select id="f_koyou">${KOYOU.map(k=>`<option ${e.koyou===k?'selected':''}>${k}</option>`).join('')}</select></div>
      <div class="field"><label>雇用期間の定め</label><select id="f_employment_type">
        <option value="fixed" ${(e.employment_type||'fixed')==='fixed'?'selected':''}>有期（期間の定めあり）</option>
        <option value="permanent" ${e.employment_type==='permanent'?'selected':''}>無期（期間の定めなし）</option>
      </select></div>
    </div>
    <div style="margin-top:8px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
        <input type="checkbox" id="f_contract_other_system" ${e.contract_other_system?'checked':''} style="width:16px;height:16px;">
        <span>雇用契約書は他システムで管理（アラート対象外にする）</span>
      </label>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px" class="sp-grid-1col">
      ${fi('nyusha_date','入社日',e.nyusha_date,'date')}
      <div class="field">
        <label>退職日</label>
        <input type="date" id="f_taishoku_date" value="${emp_esc(e.taishoku_date||'')}" oninput="onTaishokuChange()">
      </div>
      <div class="field">
        <label>在籍状況</label>
        <select id="f_status">
          <option ${e.status==='在籍'||!e.status?'selected':''}>在籍</option>
          <option ${e.status==='退職'?'selected':''}>退職</option>
        </select>
      </div>
    </div>
    <div class="field-grid" style="margin-top:10px">${fi('kyuyo','月給（円）',e.kyuyo,'number')}${fi('jikyu','時給（円）',e.jikyu,'number')}</div>
    <div class="section-title">在留・外国人情報</div>
    <div class="field-grid">
      <div class="field"><label>在留資格</label><select id="f_visa"><option value="">（なし）</option>${visaTypes.map(v=>`<option ${e.visa===v.name?'selected':''}>${emp_esc(v.name)}</option>`).join('')}</select></div>
      ${fi('visa_expiry','在留期限',e.visa_expiry,'date')}${fi('visa_no','在留カード番号',e.visa_no)}
    </div>
    <div class="field" style="margin-top:10px">
      <label>在留カード写真</label>
      <label class="photo-upload file-dropzone" tabindex="0" role="button" aria-label="画像・PDFを添付" id="rcDropArea" style="display:flex;align-items:center;justify-content:center;min-height:80px;cursor:pointer">
        <input type="file" accept="image/*,application/pdf" id="f_rc" style="display:none" onchange="previewRC(this)">${fileDropHint("image/*,application/pdf")}
        <span id="rcPreview">${e.residence_card?`<img src="${emp_attr(safeAttachmentUrl(e.residence_card))}" style="max-height:120px;border-radius:var(--emp-radius)">`:'クリックまたはドロップして在留カードを追加'}</span>
      </label>
    </div>
    <div class="section-title">雇用保険</div>
    <div class="field-grid">${fi('koyo_hoken_no','被保険者番号',e.koyo_hoken_no)}${fi('koyo_nyusha','加入日',e.koyo_nyusha,'date')}${fi('koyo_soshitsu','喪失日',e.koyo_soshitsu,'date')}</div>
    <div class="section-title">社会保険</div>
    <div class="field-grid">${fi('shakai_hoken_no','被保険者番号',e.shakai_hoken_no)}${fi('shakai_nyusha','加入日',e.shakai_nyusha,'date')}${fi('shakai_soshitsu','喪失日',e.shakai_soshitsu,'date')}</div>
    <div class="section-title">運転免許証</div>
    <div class="field-grid">
      ${fi('license_no','免許証番号',e.license_no)}${fi('license_date','取得日',e.license_date,'date')}${fi('license_expiry','有効期限',e.license_expiry,'date')}
    </div>
    <div class="field" style="margin-top:10px">
      <label>免許証写真</label>
      <label class="photo-upload file-dropzone" tabindex="0" role="button" aria-label="画像・PDFを添付" id="licDropArea" style="display:flex;align-items:center;justify-content:center;min-height:70px;cursor:pointer">
        <input type="file" accept="image/*,application/pdf" id="f_lic_img" style="display:none" onchange="previewLicForm(this)">${fileDropHint("image/*,application/pdf")}
        <span id="licFormPreview">${e.license_img?`<img src="${emp_attr(safeAttachmentUrl(e.license_img))}" style="max-height:100px;border-radius:var(--emp-radius)">`:'クリックまたはドロップして免許証を追加'}</span>
      </label>
    </div>
    <div class="section-title">その他資格（最大3件）</div>
    ${[0,1,2].map(i=>{
      const sk=(e.shikaku_list||[])[i]||{};
      return`<div style="background:var(--emp-bg);border:1px solid var(--emp-border);border-radius:var(--emp-radius);padding:12px;margin-bottom:8px">
        <div style="font-size:12px;color:var(--emp-text2);font-weight:500;margin-bottom:8px">資格 ${i+1}</div>
        <div class="field-grid">
          <div class="field"><label>資格名</label><input type="text" id="f_sk${i}_name" value="${emp_attr(sk.name||'')}"></div>
          <div class="field">
            <label>写真・PDF</label>
            <label class="photo-upload file-dropzone" tabindex="0" role="button" aria-label="画像・PDFを添付" id="skDrop${i}" style="display:flex;align-items:center;justify-content:center;min-height:50px;cursor:pointer">
              <input type="file" accept="image/*,application/pdf" id="f_sk${i}_img" style="display:none" onchange="previewSkForm(this,${i})">${fileDropHint("image/*,application/pdf")}
              <span id="skFormPreview${i}">${sk.img?`<img src="${emp_attr(safeAttachmentUrl(sk.img))}" style="max-height:60px;border-radius:4px">`:'クリックまたはドロップ'}</span>
            </label>
          </div>
        </div>
      </div>`;
    }).join('')}
    <div class="section-title">銀行口座</div>
    <div class="field-grid">
      ${fi('bank_name','銀行名',e.bank_name)}${fi('bank_branch','支店名',e.bank_branch)}
      ${fi('bank_account_no','口座番号',e.bank_account_no)}${fi('bank_account_name','口座名義',e.bank_account_name)}
    </div>
    <div class="section-title">メモ</div>
    ${fi('memo','',stripFuyouMeta(e.memo),'text',true)}
    <div class="page-actions" style="visibility:hidden;height:0;margin:0;padding:0"></div>
    </div>
    <div class="sticky-footer">
      <button class="btn" onclick="cancelEmployeeForm()">キャンセル</button>
      <button class="btn btn-primary" onclick="saveForm(${isEdit},${e.id||'null'})">保存</button>
    </div>`;
  groupEmployeeFormSections();bindEmployeeLabels();
}
function groupEmployeeFormSections(){
  const wrap=document.querySelector('#mainContent .form-wrap');
  const openFor={visa:'在留',insurance:'保険',license:'免許',memo:'メモ'}[detailTab]||'基本';
  let section;
  for(const node of [...wrap.children]){
    if(node.classList.contains('section-title')){
      section=document.createElement('details');section.className='employee-form-section';
      section.open=node.textContent.includes(openFor);
      const summary=document.createElement('summary');summary.textContent=node.textContent;
      section.appendChild(summary);wrap.insertBefore(section,node);node.remove();
    }else if(section)section.appendChild(node);
  }
}
function fi(key,label,val,type='text',isTA=false,full=false){
  const v=val||'',s=full?'style="grid-column:1/-1"':'';
  if(isTA)return`<div class="field" ${s}><label for="f_${key}">${emp_esc(label||'メモ')}</label><textarea id="f_${key}" rows="3">${emp_textarea(v)}</textarea></div>`;
  return`<div class="field" ${s}><label for="f_${key}">${emp_esc(label)}</label><input type="${type}" id="f_${key}" value="${emp_attr(v)}"></div>`;
}
function onTaishokuChange(){
  const d=document.getElementById('f_taishoku_date')?.value;
  const s=document.getElementById('f_status');
  if(!s)return;
  if(d){s.value='退職';}else{s.value='在籍';}
}
function calcAgeVal(birthday){
  if(!birthday)return'';
  const today=new Date(),b=new Date(birthday);
  let age=today.getFullYear()-b.getFullYear();
  const m=today.getMonth()-b.getMonth();
  if(m<0||(m===0&&today.getDate()<b.getDate()))age--;
  return age;
}
function calcAge(){
  const v=document.getElementById('f_birthday')?.value;
  const d=document.getElementById('ageDisplay');
  if(!d)return;
  d.textContent=v?calcAgeVal(v)+'歳':'生年月日を入力してください';
}
function previewRC(input){
  return readAttachment(input,(data,file)=>{rcImgData=data;document.getElementById('rcPreview').innerHTML=filePreviewHtml(data,'120px');});
}
let licFormImgData='';
let skFormImgData=['','',''];
function previewLicForm(input){
  return readAttachment(input,(data,file)=>{licFormImgData=data;document.getElementById('licFormPreview').innerHTML=filePreviewHtml(data,'100px');});
}
function previewSkForm(input,i){
  return readAttachment(input,(data,file)=>{skFormImgData[i]=data;document.getElementById('skFormPreview'+i+'').innerHTML=filePreviewHtml(data,'60px');});
}

async function saveForm(isEdit,id){
  if(EMP_UI.saving||attachmentsStillLoading())return;
  const g=k=>{const el=document.getElementById('f_'+k);return el?el.value:'';};
  if(!g('sei')||!g('mei')){showToast('姓・名は必須です','error');return;}
  if(!g('company')){showToast('会社（セレクト／覚善）を選択してください','error');return;}
  const deptId=document.getElementById('f_dept_id')?.value;
  const existingEmp=isEdit?employees.find(e=>e.id===id):null;
  const emp={
    shain_no:g('shain_no'),
    my_number:g('my_number'),
    sei:g('sei'),mei:g('mei'),seikana:g('seikana'),meikana:g('meikana'),
    birthday:document.getElementById('f_birthday')?.value||'',gender:g('gender'),
    nationality:(()=>{const s=document.getElementById('f_nationality')?.value;return s==='その他'?(document.getElementById('f_nationality_other')?.value||'その他'):s||'';})(),
    address:g('address'),tel:g('tel'),email:g('email'),
    contract_other_system:document.getElementById('f_contract_other_system')?.checked||false,
    company:g('company'),
    dept_id:deptId?Number(deptId):null,
    position:g('position'),koyou:g('koyou'),employment_type:g('employment_type')||'fixed',nyusha_date:g('nyusha_date'),
    taishoku_date:document.getElementById('f_taishoku_date')?.value||'',
    status:g('status'),
    kyuyo:g('kyuyo'),jikyu:g('jikyu'),
    visa:g('visa'),visa_expiry:g('visa_expiry'),visa_no:g('visa_no'),residence_card:rcImgData,
    koyo_hoken_no:g('koyo_hoken_no'),koyo_nyusha:g('koyo_nyusha'),koyo_soshitsu:g('koyo_soshitsu'),
    shakai_hoken_no:g('shakai_hoken_no'),shakai_nyusha:g('shakai_nyusha'),shakai_soshitsu:g('shakai_soshitsu'),
    license_no:g('license_no'),license_date:g('license_date'),license_expiry:g('license_expiry'),
    license_img:licFormImgData||(isEdit?employees.find(e=>e.id===id)?.license_img||'':''),
    bank_name:g('bank_name'),bank_branch:g('bank_branch'),bank_account_no:g('bank_account_no'),bank_account_name:g('bank_account_name'),
    memo:memoWithFuyouMeta(g('memo'),getFuyouList(existingEmp)),updated_at:new Date().toISOString().slice(0,10)
  };
  let saved=false;setEmployeeSaving(true);
  try{
    if(isEdit){
      const ex=existingEmp;
      emp.yukyu_list=ex?.yukyu_list||[];
      emp.kenkou_list=ex?.kenkou_list||[];
      // 既存shikaku_listの4件目以降を保持しつつフォームの3件を上書き
      const existingSk=ex?.shikaku_list||[];
      const formSk=[0,1,2].map(i=>{
        const name=document.getElementById('f_sk'+i+'_name')?.value.trim()||'';
        const img=skFormImgData[i]||(existingSk[i]?.img||'');
        return name?{name,img,date:existingSk[i]?.date||'',expiry:existingSk[i]?.expiry||''}:null;
      }).filter(Boolean);
      emp.shikaku_list=[...formSk,...existingSk.slice(3)];
      await updateEmployee(id,emp,employeeFormRevision);
    } else {
      emp.yukyu_list=[];emp.kenkou_list=[];
      emp.shikaku_list=[0,1,2].map(i=>{
        const name=document.getElementById('f_sk'+i+'_name')?.value.trim()||'';
        return name?{name,img:skFormImgData[i]||'',date:'',expiry:''}:null;
      }).filter(Boolean);
      await createEmployee(emp);
    }
    saved=true;EMP_UI.dirty=false;licFormImgData='';skFormImgData=['','',''];
    await loadEmployees();returnFromEmployeeForm();showToast('従業員情報を保存しました');
  }catch(e){
    if(saved){returnFromEmployeeForm();showToast('保存は完了しました。最新の従業員情報を再読み込みしてください。','warn');}
    else{
      showToast('保存に失敗しました：'+e.message,'error');
      if(e.code==='STALE_WRITE'&&!document.getElementById('employee-stale')){
        const notice=document.createElement('div');notice.id='employee-stale';notice.setAttribute('role','alert');
        notice.innerHTML='<p>別の画面で更新されています。入力内容を控えてから、最新情報を読み込んでください。</p><button class="btn" onclick="reloadEmployeeEdit()">最新情報を読み込む</button>';
        document.querySelector('#mainContent .form-wrap').prepend(notice);
      }
    }
  }finally{setEmployeeSaving(false);}
}

async function reloadEmployeeEdit(){
  if(!canLeaveEmployeeView())return;
  try{await loadEmployees();EMP_UI.dirty=false;render();}
  catch{showToast('最新情報を読み込めませんでした。入力内容は保持しています。','error');}
}

// ---- CSV インポート ----
const CSV_COLS=['社員番号','会社','姓','名','姓カナ','名カナ','生年月日','性別','住所','電話','メール','役職','雇用形態','入社日','在籍状況','月給','時給','在留資格','在留カード番号','在留期限','雇用保険番号','雇用保険加入日','雇用保険喪失日','社会保険番号','社会保険加入日','社会保険喪失日','免許証番号','免許取得日','免許有効期限','銀行名','支店名','口座番号','口座名義','メモ'];

function downloadSampleCSV(){
  const sample=[CSV_COLS,['S001','セレクト','田中','一郎','タナカ','イチロウ','1990-05-12','男','愛知県豊川市','090-1111-2222','tanaka@example.com','班長','正社員','2018-04-01','在籍','280000','','技能実習2号','AB1234567','2025-09-30','12345678','2018-04-01','','87654321','2018-04-01','','','','','〇〇銀行','豊川支店','1234567','タナカ イチロウ','']];
  dlCSV(sample.map(r=>r.map(v=>'"'+v.replace(/"/g,'""')+'"')),'従業員台帳_サンプル');
}

let employeeImportPending=false;
async function importCSV(input){
  if(employeeImportPending)return;
  const file=input.files[0];if(!file)return;
  if(!attendanceEmployeesReady){showToast('従業員一覧を読み込んでから取り込んでください。','error');return;}
  if(file.size>5*1024*1024){showToast('CSVは5MB以下にしてください。','error');return;}
  employeeImportPending=true;
  try{
    const records=validatedEmployeeCSV(await file.text());
    if(!confirm(`${records.length}件のデータをインポートします。よろしいですか？`))return;
    await db.insertEmployees(records);
    input.value='';
    try{await loadEmployees();render();showToast(`インポート完了：${records.length}件`);}
    catch{showToast('インポートは完了しました。一覧を再読み込みしてください。再取込は不要です。','warn');}
  }catch(error){showToast('インポートできませんでした：'+error.message,'error');}
  finally{employeeImportPending=false;}
}
function validatedEmployeeCSV(text){
  const [headers,...rows]=parseCSV(text);
  if(!headers||!rows.length)throw new Error('データがありません');
  if(new Set(headers).size!==headers.length||['姓','名','会社'].some(h=>!headers.includes(h)))throw new Error('見出しに「姓」「名」「会社」が必要です。サンプルCSVを確認してください。');
  if(rows.length>450)throw new Error('CSVは450件以下に分けてください');
  const numbers=new Set((employees||[]).map(e=>String(e.shain_no||'').trim()).filter(Boolean));
  return rows.map((r,n)=>{
    const g=col=>{const i=headers.indexOf(col);return i>=0?(r[i]||''):'';};
    const invalid=msg=>{throw new Error(`${n+2}行目：${msg}`);};
    if(r.length!==headers.length)invalid('列数が見出しと一致しません');
    if(!g('姓').trim()||!g('名').trim())invalid('姓・名は必須です');
    if(!['セレクト','覚善'].includes(g('会社')))invalid('会社を確認してください');
    if(g('在籍状況')&&!['在籍','退職','休職'].includes(g('在籍状況')))invalid('在籍状況を確認してください');
    for(const h of headers.filter(h=>/(年月日|入社日|加入日|喪失日|取得日|有効期限|在留期限)$/.test(h))){if(g(h)&&!normalizeDateStr(g(h)))invalid(h+'の日付が不正です');}
    const number=g('社員番号').trim();if(number&&numbers.has(number))invalid('社員番号が重複しています');if(number)numbers.add(number);
    return {
      shain_no:g('社員番号'),company:g('会社'),
      sei:g('姓'),mei:g('名'),seikana:g('姓カナ'),meikana:g('名カナ'),
      birthday:g('生年月日'),gender:g('性別'),address:g('住所'),tel:g('電話'),email:g('メール'),
      position:g('役職'),koyou:g('雇用形態'),nyusha_date:g('入社日'),status:g('在籍状況')||'在籍',
      kyuyo:g('月給'),jikyu:g('時給'),
      visa:g('在留資格'),visa_no:g('在留カード番号'),visa_expiry:g('在留期限'),
      koyo_hoken_no:g('雇用保険番号'),koyo_nyusha:g('雇用保険加入日'),koyo_soshitsu:g('雇用保険喪失日'),
      shakai_hoken_no:g('社会保険番号'),shakai_nyusha:g('社会保険加入日'),shakai_soshitsu:g('社会保険喪失日'),
      license_no:g('免許証番号'),license_date:g('免許取得日'),license_expiry:g('免許有効期限'),
      bank_name:g('銀行名'),bank_branch:g('支店名'),bank_account_no:g('口座番号'),bank_account_name:g('口座名義'),
      memo:g('メモ'),yukyu_list:[],kenkou_list:[],shikaku_list:[],
      updated_at:new Date().toISOString().slice(0,10)
    };
  });
}
function parseCSV(text){
  const rows=[];let row=[],value='',quoted=false,closed=false;
  text=String(text).replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}
      else value+=c;
    }else if(c==='"'){
      if(value||closed)throw new Error('CSVの引用符が不正です');quoted=true;
    }else if(c===','||c==='\n'||c==='\r'){
      row.push(value);value='';closed=false;
      if(c!==','){if(row.some(v=>v!==''))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}
    }else{if(closed)throw new Error('CSVの引用符の後に余分な文字があります');value+=c;}
  }
  if(quoted)throw new Error('CSVの引用符が閉じていません');
  row.push(value);if(row.some(v=>v!==''))rows.push(row);
  return rows;
}
function parseCSVLine(line){return parseCSV(line)[0]||[];}

// ---- CSV エクスポート ----
function exportCSV(){
  if(!confirm(`従業員CSVを出力します。\n対象: ${employees.length}件\n住所・電話・メール・保険番号などの個人情報が含まれます。続行しますか？`))return;
  const h=['ID','姓','名','姓カナ','名カナ','生年月日','性別','住所','電話','メール','所属1','所属2','役職','雇用形態','入社日','在籍状況','月給','時給','在留資格','在留カード番号','在留期限','雇用保険番号','雇用保険加入日','雇用保険喪失日','社会保険番号','社会保険加入日','社会保険喪失日','更新日'];
  const rows=employees.map(e=>{
    const dept=departments.find(d=>d.id===Number(e.dept_id));
    return[e.id,e.sei,e.mei,e.seikana,e.meikana,e.birthday,e.gender,e.address,e.tel,e.email,dept?.shozoku1||'',dept?.shozoku2||'',e.position,e.koyou,e.nyusha_date,e.status,e.kyuyo,e.jikyu,e.visa,e.visa_no,e.visa_expiry,e.koyo_hoken_no,e.koyo_nyusha,e.koyo_soshitsu,e.shakai_hoken_no,e.shakai_nyusha,e.shakai_soshitsu,e.updated_at].map(v=>'"'+(v||'').toString().replace(/"/g,'""')+'"');
  });
  dlCSV([h,...rows],'従業員台帳');
}
function exportYukyuCSV(){
  const h=['ID','従業員ID','氏名','使用日','使用内容','種別','区分','入力者','登録日','備考'];
  const rows=yukyuRecords.map(r=>[r.id,r.employee_id,r.employee_name,r.use_date,r.use_type,r.shubetsu,r.kubun,r.input_by,r.touroku_date,r.biko].map(v=>'"'+(v||'').toString().replace(/"/g,'""')+'"'));
  dlCSV([h,...rows],'有休・勤怠記録');
}
function dlCSV(data,name){
  const csv='\uFEFF'+data.map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download=name+'_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
}
// ===== END EMPLOYEE MANAGEMENT =====
