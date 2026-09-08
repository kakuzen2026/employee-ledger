// ---- 健康診断：記録の確認を先に、入力は専用パネルで ----
function healthRecords(){
  return employees.flatMap(e=>(e.kenkou_list||[]).map((k,idx)=>({...k,empId:e.id,empName:e.sei+' '+e.mei,idx}))).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
function renderKenkoList(){
  const f=documentFilters('kenko_list'),tab=['records','attention','missing'].includes(f.tab)?f.tab:'records';
  const all=healthRecords(),latest=new Map();all.forEach(r=>{if(!latest.has(r.empId))latest.set(r.empId,r)});
  const active=employees.filter(e=>e.status==='在籍'),attention=active.map(e=>latest.get(e.id)).filter(r=>r&&['要経過観察','要精密検査'].includes(r.result));
  const missing=active.filter(e=>!latest.has(e.id)).filter(e=>!f.employee||String(e.id)===f.employee);
  let rows=(tab==='attention'?attention:all).filter(r=>(!f.employee||String(r.empId)===f.employee)&&(!f.result||r.result===f.result)&&(!f.month||String(r.date||'').startsWith(f.month)));
  document.getElementById('mainContent').innerHTML=`
    <div class="workspace-heading document-heading"><div><h1>健康診断</h1><p class="workspace-help">受診記録と最新の結果を確認できます。</p></div><div class="workspace-actions"><button class="btn" ${attendanceEmployeesReady?'':'disabled'} onclick="exportKenkoCSV()">全記録CSV</button><button class="btn btn-primary" ${attendanceEmployeesReady?'':'disabled'} onclick="openHealthEditor()">＋ 受診結果を記録</button></div></div>
    <nav class="workspace-tabs document-task-tabs" aria-label="健康診断の確認内容">${[['records','受診記録'],['attention','要確認の結果'],['missing','記録なし']].map(([key,label])=>`<button class="${tab===key?'active':''}" aria-current="${tab===key?'page':'false'}" onclick="setDocumentFilter('kenko_list','tab','${key}')">${label}${key==='attention'&&attendanceEmployeesReady?` <span>${attention.length}</span>`:''}</button>`).join('')}</nav>
    <div class="search-bar document-filters"><label>従業員<select id="fkEmp" onchange="setDocumentFilter('kenko_list','employee',this.value)"><option value="">すべての従業員</option>${documentEmployeeOptions(f.employee)}</select></label>${tab==='missing'?'':`<label>結果<select id="fkResult" onchange="setDocumentFilter('kenko_list','result',this.value)"><option value="">すべての結果</option>${CHECKRES.map(r=>`<option ${f.result===r?'selected':''}>${emp_esc(r)}</option>`).join('')}</select></label><label>受診月<input type="month" id="fkMonth" value="${emp_attr(f.month||'')}" onchange="setDocumentFilter('kenko_list','month',this.value)"></label>`}</div>
    ${!attendanceEmployeesReady?'<div class="empty" role="alert">従業員・受診記録を読み込めませんでした。<button class="btn" onclick="loadAndRender()">再読み込み</button></div>':tab==='missing'?`<p class="workspace-help">在籍者のうち、このアプリに受診記録がない人です。未受診と断定するものではありません。</p><div class="document-employee-list">${missing.map(e=>`<div><button class="emp-name" onclick="viewDetail(${e.id},'kenko')">${emp_esc(e.sei)} ${emp_esc(e.mei)}</button><span>${emp_esc(deptLabelById(e.dept_id)||'—')}</span><button class="btn btn-sm" onclick="openHealthEditor(${e.id})">結果を記録</button></div>`).join('')||'<div class="empty">該当する従業員はいません。</div>'}</div>`:`${tab==='attention'?'<p class="workspace-help">在籍者の最新記録が「要経過観察」「要精密検査」の人を表示しています。対応状況は従業員の履歴で確認してください。</p>':''}<p class="result-count document-count">${rows.length}件の記録</p>${rows.length?`<div class="table-wrap"><table><thead><tr><th>受診日</th><th>従業員</th><th>結果</th><th>添付</th><th>操作</th></tr></thead><tbody>${rows.map(r=>`<tr><td data-label="受診日">${emp_esc(r.date||'—')}</td><td data-label="従業員"><button class="emp-name" onclick="viewDetail(${r.empId},'kenko')">${emp_esc(r.empName)}</button></td><td data-label="結果"><span class="badge ${r.result==='異常なし'?'badge-active':r.result==='要精密検査'?'badge-danger':'badge-warn'}">${emp_esc(r.result||'未登録')}</span></td><td data-label="添付">${r.img?`<button class="btn btn-sm" onclick="openHealthImage(${r.empId},${r.idx})">画像を見る</button>`:'—'}</td><td class="no-label"><button class="btn btn-sm" onclick="viewDetail(${r.empId},'kenko')">履歴を見る</button><details class="row-actions"><summary>その他</summary><button class="text-button danger-text" onclick="delKenkoFromList(${r.empId},${r.idx})">この記録を削除</button></details></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">条件に合う記録はありません。</div>'}`}`;
}
let kfImgData='',healthImageLoading=false;
function openHealthEditor(empId){
  if(!attendanceEmployeesReady||!canLeaveEmployeeView())return;
  openEmployeeFormContext();EMP_UI.activeForm='health';kfImgData='';healthImageLoading=false;
  const dialog=document.createElement('dialog');dialog.id='documentEditor';dialog.className='attendance-drawer';dialog.setAttribute('aria-labelledby','healthEditorTitle');
  dialog.innerHTML=`<form onsubmit="event.preventDefault();addKenkoFromList()"><div class="drawer-header"><div><h2 id="healthEditorTitle">受診結果を記録</h2><p>保存後は元の一覧に戻ります。</p></div><button type="button" class="drawer-close" aria-label="登録画面を閉じる" onclick="cancelEmployeeForm()">×</button></div><div class="drawer-fields"><div class="frow"><label for="kfEmp">従業員</label><select id="kfEmp" required><option value="">選択してください</option>${documentEmployeeOptions(empId||documentFilters('kenko_list').employee,true)}</select></div><div class="frow"><label for="kfDate">受診日</label><input type="date" id="kfDate" value="${localDateStr()}" required></div><div class="frow"><label for="kfInputResult">結果</label><select id="kfInputResult" required><option value="">選択してください</option>${CHECKRES.map(r=>`<option>${emp_esc(r)}</option>`).join('')}</select></div><div class="frow"><label for="kfImg">結果の画像（任意）</label>${fileDropZone("kfImg","image/*","previewKfImg(this)")}<p id="kfImgName" class="workspace-help" role="status"></p></div></div><div class="drawer-footer"><button type="button" class="btn" onclick="cancelEmployeeForm()">キャンセル</button><button class="btn btn-primary" id="saveHealthButton" type="submit">保存する</button></div></form>`;
  dialog.addEventListener('cancel',e=>{e.preventDefault();cancelEmployeeForm()});document.getElementById('emp-app-inner').appendChild(dialog);document.body.classList.add('employee-form-open','employee-editing');dialog.showModal();
}
async function previewKfImg(input){
  const dialog=input.closest('dialog'),file=input.files[0];const token=String(Number(dialog.dataset.uploadToken||0)+1);dialog.dataset.uploadToken=token;kfImgData='';if(!file){healthImageLoading=false;return;}
  healthImageLoading=true;document.getElementById('kfImgName').textContent='画像を準備しています…';
  try{const data=await compressImage(file);if(!dialog.isConnected||dialog.dataset.uploadToken!==token)return;kfImgData=data;document.getElementById('kfImgName').textContent=file.name;}
  catch(error){if(dialog.isConnected&&dialog.dataset.uploadToken===token)showToast('画像を読み込めませんでした。選び直してください。','error');}
  finally{if(dialog.isConnected&&dialog.dataset.uploadToken===token)healthImageLoading=false;}
}
async function addKenkoFromList(){
  if(EMP_UI.saving)return;if(healthImageLoading){showToast('画像の準備が終わるまでお待ちください。','warn');return;}
  const empId=Number(document.getElementById('kfEmp')?.value),date=document.getElementById('kfDate')?.value,result=document.getElementById('kfInputResult')?.value,e=employees.find(e=>e.id===empId);
  if(!e||!normalizeDateStr(date)||!CHECKRES.includes(result)){showToast('従業員・受診日・結果を確認してください。','error');return;}
  const records=[...(e.kenkou_list||[]),{date,result,img:kfImgData}],updated=localDateStr();let saved=false;setEmployeeSaving(true);
  try{await updateEmployeeKenko(empId,records,updated);saved=true;e.kenkou_list=records;e.updated_at=updated;EMP_UI.dirty=false;await loadEmployees();returnFromEmployeeForm();showToast('受診結果を保存しました');}
  catch(error){if(saved){returnFromEmployeeForm();showToast('保存は完了しました。最新データを再読み込みしてください。','warn');}else showToast('保存に失敗しました：'+error.message,'error');}
  finally{setEmployeeSaving(false);}
}
function openHealthImage(empId,idx){
  const record=employees.find(e=>e.id===empId)?.kenkou_list?.[idx];if(!record?.img)return;
  const dialog=document.createElement('dialog');dialog.id='healthImagePreview';dialog.className='health-image-preview';dialog.setAttribute('aria-label','健康診断の添付画像');
  const close=document.createElement('button');close.className='btn';close.textContent='閉じる';close.onclick=()=>dialog.close();
  const img=document.createElement('img');img.alt='健康診断の添付画像';img.src=record.img;dialog.append(close,img);dialog.addEventListener('close',()=>dialog.remove());document.getElementById('emp-app-inner').appendChild(dialog);dialog.showModal();
}
async function delKenkoFromList(empId,idx){
  if(EMP_UI.saving||!attendanceEmployeesReady||!confirmPermanentDelete('この健康診断記録'))return;
  const e=employees.find(e=>e.id===empId);if(!e?.kenkou_list?.[idx])return;const records=e.kenkou_list.filter((_,i)=>i!==idx),updated=localDateStr();
  let saved=false;setEmployeeSaving(true);
  try{await updateEmployeeKenko(empId,records,updated);saved=true;e.kenkou_list=records;e.updated_at=updated;await loadEmployees();if(currentView==='kenko_list')renderKenkoList();showToast('受診記録を削除しました');}
  catch(error){if(saved){if(currentView==='kenko_list')renderKenkoList();showToast('削除は完了しました。最新データを再読み込みしてください。','warn');}else showToast('削除に失敗しました：'+error.message,'error');}
  finally{setEmployeeSaving(false);}
}
function exportKenkoCSV(){
  if(!attendanceEmployeesReady){showToast('従業員・受診記録を再読み込みしてください。','error');return;}
  const h=['受診日','氏名','姓カナ','名カナ','結果'];
  const rows=[];
  employees.forEach(e=>{
    (e.kenkou_list||[]).forEach(k=>{
      rows.push([k.date,e.sei+' '+e.mei,e.seikana||'',e.meikana||'',k.result].map(v=>'"'+(v||'').toString().replace(/"/g,'""')+'"'));
    });
  });
  rows.sort((a,b)=>b[0].localeCompare(a[0]));
  dlCSV([h.map(v=>'"'+v+'"'),...rows],'健康診断記録');
}
