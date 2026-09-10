// Contract history always uses saved values. It must never read today's
// employee/company fields to fill gaps in an older document.
function compareEmploymentContracts(a,b){
  return String(b.issued_date||'').localeCompare(String(a.issued_date||''))||
    String(b.created_at||'').localeCompare(String(a.created_at||''))||Number(b.id)-Number(a.id);
}

function savedEmploymentContractTerms(record){
  if(!record?.terms||typeof record.terms!=='object'||Array.isArray(record.terms)||!Object.keys(record.terms).length)return null;
  const terms=Object.fromEntries(EMPLOYMENT_CONTRACT_TERM_IDS.map(id=>{
    const key=id.slice(3),value=record.terms[key];
    return [key,typeof value==='string'||typeof value==='number'?String(value):''];
  }));
  terms.contract_type=terms.contract_type||record.contract_type||(record.is_fixed?'fixed':'permanent');
  terms.start=terms.start||record.contract_start||'';
  terms.end=terms.end||record.contract_end||'';
  terms.employer_name=terms.employer_name||record.issued_by||'';
  return terms;
}

function employmentContractDateLabel(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');
  return match?`${match[1]}年${Number(match[2])}月${Number(match[3])}日`:'作成日未記録';
}

function employmentContractEmployeeSnapshot(employee){
  return Object.fromEntries(['sei','mei','address','birthday'].map(key=>[key,String(employee[key]??'')]));
}

function findSavedEmploymentContract(id){
  if(!documentContractsReady){showToast('雇用契約書の履歴を再読み込みしてください。','warn');return null;}
  const record=employmentContracts.find(item=>item.id===id);
  if(!record)showToast('雇用契約書が見つかりません。履歴を再読み込みしてください。','warn');
  return record;
}

function employmentContractHistoryActions(record){
  const available=!!savedEmploymentContractTerms(record);
  const employeeExists=employees.some(employee=>employee.id===record.employee_id);
  return `<div class="workspace-actions" style="display:flex;gap:6px;flex-wrap:wrap">
    <button type="button" class="btn btn-sm" data-employee-action="contract-view" data-id="${emp_esc(record.id)}" ${available?'':'disabled'}>表示・印刷</button>
    <button type="button" class="btn btn-sm" data-employee-action="contract-copy" data-id="${emp_esc(record.id)}" ${available&&employeeExists&&attendanceEmployeesReady?'':'disabled'}>複製して作成</button>
    </div>${available?'':'<p class="workspace-help">本文の保存がないため、表示・複製はできません。</p>'}`;
}

function employmentContractHistoryCards(employeeId){
  if(!documentContractsReady)return '<div class="empty" role="alert">雇用契約書の履歴を読み込めていません。<button class="btn" onclick="loadAndRender()">再読み込み</button></div>';
  const records=employmentContracts.filter(record=>record.employee_id===employeeId).sort(compareEmploymentContracts);
  return `<div class="workspace-heading" style="flex-wrap:wrap"><div style="flex:1;min-width:240px"><h2 class="document-section-title">雇用契約書の履歴（${records.length}件）</h2><p class="workspace-help">過去の内容を確認・印刷できます。更新時は「複製して作成」を選んでください。</p></div><button type="button" class="btn btn-primary" style="flex-shrink:0" data-employee-action="contract-open" data-id="${employeeId}" ${attendanceEmployeesReady?'':'disabled'}>＋ 新しく作成</button></div>
    ${records.length?`<div style="display:flex;flex-direction:column;gap:10px">${records.map(record=>`<article class="list-item" data-contract-id="${emp_esc(record.id)}">
      <div style="flex:1;min-width:180px"><strong>${emp_esc(record.issued_date||'発行日未記録')} 作成</strong> <span class="badge ${record.is_fixed?'badge-warn':'badge-active'}">${record.is_fixed?'有期':'無期'}</span>
      <p style="margin:6px 0">${emp_esc(record.contract_start||'開始日未記録')} 〜 ${emp_esc(record.contract_end||(record.is_fixed?'終了日未記録':'期間の定めなし'))}</p>
      <span class="workspace-help">${emp_esc(record.issued_by||'発行元未記録')}${record.copied_from_id?' · 過去の契約書から複製':''}</span></div>
      <div>${employmentContractHistoryActions(record)}</div>
    </article>`).join('')}</div>`:'<div class="empty">この従業員の雇用契約書はまだ保存されていません。</div>'}`;
}

async function renderEmployeeContractHistory(employee,container){
  const generation=++renderEmployeeContractHistory.generation;
  container.innerHTML=employmentContractHistoryCards(employee.id)+'<section id="employeeDispatchContractHistory" style="margin-top:24px"><p class="workspace-help">派遣管理の契約情報を確認しています…</p></section>';
  let records=[],failed=false;
  try{records=await fetchDispatchContractsForEmployee(employee.id);}catch(_){failed=true;}
  if(generation!==renderEmployeeContractHistory.generation||currentView!=='detail'||detailTab!=='contract'||viewingId!==employee.id||!container.isConnected)return;
  const host=container.querySelector('#employeeDispatchContractHistory');
  if(!host)return;
  host.innerHTML=failed?'<p class="workspace-help" role="alert">派遣管理の契約情報を取得できませんでした。<button class="btn btn-sm" onclick="renderDT()">再読み込み</button></p>':records.length?`<h2 class="document-section-title">派遣管理で作成した契約書</h2><div style="display:flex;flex-direction:column;gap:8px">${records.map(record=>`<div class="list-item"><div style="flex:1"><strong>${emp_esc(record.contract_no||'—')}</strong><p>${emp_esc(record.client_name||'—')} / ${emp_esc(record.site_name||'—')}</p><span>${emp_esc(record.contract_start||'—')} 〜 ${emp_esc(record.contract_end||'—')}</span></div><span class="badge badge-visa">派遣管理</span></div>`).join('')}</div>`:'';
}
renderEmployeeContractHistory.generation=0;

function showSavedEmploymentContract(id){
  const record=findSavedEmploymentContract(id);if(!record)return;
  const terms=savedEmploymentContractTerms(record);
  if(!terms){showToast('この履歴には契約書の本文が保存されていません。','warn');return;}
  const hasSnapshot=record.employee_snapshot&&typeof record.employee_snapshot==='object'&&!Array.isArray(record.employee_snapshot);
  const employee=hasSnapshot?employmentContractEmployeeSnapshot(record.employee_snapshot):{sei:record.employee_name||'',mei:'',address:'',birthday:''};
  const note=hasSnapshot?'保存時の契約内容です。表示・印刷では履歴を追加しません。':'この古い履歴には作成時の住所・生年月日などが保存されていません。保存済みの内容のみを現在の書式で表示しています。';
  const content=buildEmploymentContractContent(employee,terms,employmentContractDateLabel(record.issued_date));
  const toolbar=`<div id="contract-history-toolbar" style="font-family:sans-serif;font-size:13px;line-height:1.6;margin-bottom:18px;padding:12px;border:1px solid #ccc"><p>${emp_esc(note)}</p><button type="button" id="contract-history-print">印刷・PDF保存</button> <button type="button" id="contract-history-close">閉じる</button></div><style>@media print{#contract-history-toolbar{display:none}}</style>`;
  const w=window.open('','_blank','width=900,height=1100');
  if(!w){showToast('契約書の表示をブロックしました。ブラウザでポップアップを許可してください。','warn');return;}
  w.document.write(content.replace('<body>','<body>'+toolbar));w.document.close();
  w.document.getElementById('contract-history-print').addEventListener('click',async()=>{
    try{await w.document.fonts?.ready;await Promise.all(Array.from(w.document.images).map(image=>image.decode()));w.print();}
    catch(_){showToast('契約書の画像を表示できませんでした。印刷画面を確認してください。','error');}
  });
  w.document.getElementById('contract-history-close').addEventListener('click',()=>w.close());
}

function employmentContractCopyTerms(record){
  const terms=savedEmploymentContractTerms(record);if(!terms)return null;
  if(terms.contract_type==='fixed'){
    const end=/^\d{4}-\d{2}-\d{2}$/.test(terms.end)?new Date(terms.end+'T00:00:00Z'):null;
    const validEnd=end&&!Number.isNaN(end.getTime())&&end.toISOString().slice(0,10)===terms.end;
    if(validEnd)end.setUTCDate(end.getUTCDate()+1);
    terms.start=validEnd?end.toISOString().slice(0,10):'';
    terms.end='';
  }
  return terms;
}

function duplicateEmploymentContract(id){
  const record=findSavedEmploymentContract(id);if(!record)return;
  if(!savedEmploymentContractTerms(record)){showToast('この履歴には複製できる契約条件が保存されていません。','warn');return;}
  if(!employees.some(employee=>employee.id===record.employee_id)){showToast('対象の従業員が見つかりません。従業員情報を再読み込みしてください。','warn');return;}
  emp_openContractModal(record.employee_id,record);
}

function applyCopiedEmploymentContract(record){
  const terms=employmentContractCopyTerms(record);
  for(const id of EMPLOYMENT_CONTRACT_TERM_IDS){
    const field=document.getElementById(id);if(field)field.value=terms[id.slice(3)]||'';
  }
  const seal=terms.employer_seal;
  if(isEmploymentContractSeal(seal)){
    const preview=document.getElementById('cm_seal_preview');preview.src=seal;preview.style.display='block';
    document.getElementById('cm_seal_status').textContent='前回の電子印を引き継ぎました。必要に応じて変更・削除できます。';
  }else clearEmploymentContractSeal();
}

function refreshEmploymentContractViews(){
  if(typeof currentView==='undefined')return;
  if(currentView==='contract_list')void renderContractList();
  else if(currentView==='detail'&&detailTab==='contract')void renderDT();
}
