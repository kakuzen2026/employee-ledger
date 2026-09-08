// ---- 従業員一覧 ----
function employeeFilteredList(){
  const {sq,fs,fd,fc}=listFilter;
  return employees.filter(e=>(!sq||employeeSearchText(e).includes(sq.toLowerCase()))&&(!fs||e.status===fs)&&(!fd||String(e.dept_id)===fd)&&(!fc||e.company===fc));
}
function renderList(){
  listFilter={sq:document.getElementById('searchQ')?.value??listFilter.sq,
    fs:document.getElementById('fStatus')?.value??listFilter.fs,
    fd:document.getElementById('fDept')?.value??listFilter.fd,
    fc:document.getElementById('fCompany')?.value??listFilter.fc};
  const {sq,fs,fd,fc}=listFilter,list=employeeFilteredList();currentFilteredList=[...list];
  const focus=getLedgerFocusMetrics();
  const columns=ALL_COLS.filter(c=>c.always||visibleCols.includes(c.key));
  const cell=(e,key)=>{
    const dept=departments.find(d=>d.id===Number(e.dept_id));
    if(key==='name')return `<button class="emp-name" onclick="viewDetail(${e.id})">${emp_esc(e.sei)} ${emp_esc(e.mei)}</button><div class="employee-number">${emp_esc(e.shain_no||'社員番号未設定')}</div>`;
    if(key==='shozoku1'||key==='shozoku2')return emp_esc(dept?.[key]||'—');
    if(key==='status')return `<span class="status-dot ${e.status==='在籍'?'is-active':''}">${emp_esc(e.status||'—')}</span>`;
    if(key==='remaining')return attendanceRecordsReady&&attendanceGrantsReady?`<strong>${calcYukyuInfo(e.id).remaining}日</strong>`:'未確認';
    if(key==='attention'){
      const labels=[];
      if([...focus.visaExpired,...focus.visaSoon].some(x=>x.id===e.id))labels.push('在留期限を確認');
      if([...focus.licenseExpired,...focus.licenseSoon].some(x=>x.id===e.id))labels.push('免許期限を確認');
      if(focus.contractNeed.some(x=>x.id===e.id))labels.push('契約書を確認');
      if(focus.yukyuUnset.some(x=>x.id===e.id))labels.push('有休付与を確認');
      return labels.length?`<span class="employee-attention">${labels.join('・')}</span>`:'—';
    }
    return emp_esc(e[key]||'—');
  };
  document.getElementById('mainContent').innerHTML=`
    <div class="workspace-heading"><h1>従業員</h1><button class="btn btn-primary" onclick="showView('add')">＋ 従業員を追加</button></div>
    ${renderDeadlineOverview(focus)}
    <div class="search-bar employee-search">
      <div class="search-input-group"><input id="searchQ" aria-label="氏名・所属で検索" placeholder="氏名・所属で検索" value="${emp_attr(sq)}" onkeydown="if(event.key==='Enter'&&!event.isComposing)render()"><button class="btn" onclick="render()">検索</button></div>
      <select id="fStatus" aria-label="在籍状況" onchange="render()"><option value="">在籍：すべて</option><option value="在籍" ${fs==='在籍'?'selected':''}>在籍中</option><option value="退職" ${fs==='退職'?'selected':''}>退職</option></select>
      <select id="fDept" aria-label="所属" onchange="render()"><option value="">すべての所属</option>${departments.map(d=>`<option value="${d.id}" ${fd==d.id?'selected':''}>${emp_esc(deptLabel(d))}</option>`).join('')}</select>
      <select id="fCompany" aria-label="会社" onchange="render()"><option value="">すべての会社</option>${['セレクト','覚善'].map(c=>`<option ${fc===c?'selected':''}>${c}</option>`).join('')}</select>
      <button class="btn btn-sm" onclick="showColSettings()">表示列</button><span class="result-count">${list.length}名</span>
    </div>
    ${!attendanceEmployeesReady?'<div class="empty" role="alert">従業員を読み込めませんでした。<button class="btn" onclick="loadAndRender()">再読み込み</button></div>':list.length===0?'<div class="empty">条件に合う従業員がいません。検索や絞り込みを変更してください。</div>':`
    <div class="table-wrap employee-table"><table><thead><tr>${columns.map(c=>`<th>${c.label}</th>`).join('')}<th><span class="sr-only">詳細を開く</span></th></tr></thead>
    <tbody>${list.map(e=>`<tr>${columns.map(c=>`<td data-label="${c.label}" data-column="${c.key}">${cell(e,c.key)}</td>`).join('')}<td class="no-label"><button class="btn btn-sm" onclick="viewDetail(${e.id})" aria-label="${emp_attr(e.sei+' '+e.mei)}の詳細">詳細</button></td></tr>`).join('')}</tbody></table></div>`}
    <div class="workspace-list-footer">${list.length}名を表示<span>書類作成・退職処理は従業員の詳細から行えます。</span></div>`;
}

// Existing deadline criteria and active-employee scope are shared with navigation badges.
function renderDeadlineOverview(focus){
  const documentLinks=`<nav class="document-shortcuts" aria-label="書類の一覧"><button onclick="showView('kenko_list')">健康診断一覧</button><button onclick="showView('cert_list')">証明書一覧</button><button onclick="showView('contract_list')">雇用契約書一覧</button></nav>`;
  if(!attendanceEmployeesReady)return `<section class="deadline-overview"><h2>期限アラート</h2><p role="status">従業員情報を読み込めていないため、件数は未確認です。</p>${documentLinks}</section>`;
  const groups=[{key:'visa',label:'在留期限',expired:focus.visaExpired,soon:focus.visaSoon,field:'visa_expiry',tab:'visa'},
    {key:'license',label:'免許期限',expired:focus.licenseExpired,soon:focus.licenseSoon,field:'license_expiry',tab:'license'}];
  const selected=groups.find(g=>g.key===EMP_UI.deadlineOpen);
  const rows=selected?[...selected.expired,...selected.soon].sort((a,b)=>a[selected.field].localeCompare(b[selected.field])):[];
  return `<section class="deadline-overview" aria-labelledby="deadlineTitle">
    <div class="deadline-heading"><h2 id="deadlineTitle">期限アラート</h2><button class="text-button" onclick="showView('alert')">書類・その他のアラート →</button></div>
    <div class="deadline-shortcuts">${groups.map(g=>`<button class="deadline-shortcut ${g.expired.length?'has-expired':''}" aria-expanded="${g===selected}" aria-controls="deadlinePeople" data-deadline-kind="${g.key}" onclick="toggleDeadlineOverview('${g.key}')"><span>${g.label}</span><strong>${g.expired.length+g.soon.length}<small>名</small></strong><span class="deadline-breakdown">期限切れ ${g.expired.length}名 · 期限間近 ${g.soon.length}名</span></button>`).join('')}</div>
    <p class="deadline-help">在籍者の期限切れ・90日未満を表示。従業員一覧の絞り込みにかかわらず確認できます。</p>
    <div id="deadlinePeople" ${selected?'':'hidden'}>${selected?`<div class="deadline-people-heading"><h3>${selected.label}の確認が必要な従業員</h3><button class="text-button" onclick="toggleDeadlineOverview('${selected.key}')">閉じる</button></div>${rows.length?`<ul class="deadline-people">${rows.map(e=>`<li><button class="deadline-person" onclick="viewDeadlineEmployee(${e.id},'${selected.tab}')"><span><strong>${emp_esc(e.sei)} ${emp_esc(e.mei)}</strong><small>${emp_esc(e.shain_no||'')} · ${emp_esc(deptLabelById(e.dept_id)||'所属未設定')}</small></span><span class="deadline-person-date">${selected.expired.includes(e)?'<span class="danger-text">期限切れ</span>':'期限間近'}<strong>${emp_esc(e[selected.field])}</strong></span><span aria-hidden="true">→</span></button></li>`).join('')}</ul>`:'<p class="deadline-empty">該当する従業員はいません。</p>'}` : ''}</div>
    ${documentLinks}
  </section>`;
}
function viewDeadlineEmployee(id,tab){
  const e=employees.find(x=>x.id===id);if(!e)return;
  if(!currentFilteredList.some(x=>x.id===id))currentFilteredList=[e,...currentFilteredList];
  viewDetail(id,tab);
}
function toggleDeadlineOverview(kind){
  if(!['visa','license'].includes(kind))return;
  EMP_UI.deadlineOpen=EMP_UI.deadlineOpen===kind?'':kind;
  renderList();rememberEmployeeNavigation('replace');
  document.querySelector('[data-deadline-kind="'+kind+'"]')?.focus({preventScroll:true});
}

// ---- 表示列設定 ----
function showColSettings(){
  const modal=document.createElement('div');
  modal.className='modal-overlay open';modal.id='colModal';
  modal.innerHTML=`<div class="modal-box">
    <h3>表示列を選択</h3>
    <div style="display:flex;flex-direction:column;gap:8px;margin:12px 0">
      ${ALL_COLS.map(c=>`
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:${c.always?'default':'pointer'}">
          <input type="checkbox" ${visibleCols.includes(c.key)?'checked':''} ${c.always?'disabled':''} onchange="toggleCol('${c.key}',this.checked)">
          ${c.label}${c.always?' （固定）':''}
        </label>`).join('')}
    </div>
    <div class="actions"><button class="btn btn-primary" onclick="document.getElementById('colModal').remove();render()">閉じる</button></div>
  </div>`;
  document.body.appendChild(modal);
}
function toggleCol(key,checked){
  if(checked){if(!visibleCols.includes(key))visibleCols.push(key);}
  else{visibleCols=visibleCols.filter(k=>k!==key);}
  localStorage.setItem('emp_cols',JSON.stringify(visibleCols));
  localStorage.removeItem('visibleCols');
}

function viewDetail(id,tab){
  const nextTab=tab||(currentView==='detail'?detailTab:'basic');
  if(!canLeaveEmployeeView())return;
  const origin=captureEmployeeContext();
  if(currentView!=='detail')EMP_UI.detailReturn={...origin,detailReturn:null};
  closeAttendanceDrawer();EMP_UI.dirty=false;
  viewingId=id;currentView='detail';detailTab=nextTab;
  if(currentFilteredList.length===0||!currentFilteredList.some(e=>e.id===id))currentFilteredList=[...employees];
  render();document.getElementById('page-jugyoin').scrollTop=0;
}
function setDetailTab(tab){
  if(!beginEmployeeNavigation())return;
  detailTab=tab;render();
}
function editEmp(id){
  if(!canLeaveEmployeeView())return;
  openEmployeeFormContext();editingId=id;currentView='edit';render();
  document.getElementById('page-jugyoin').scrollTop=0;
}

// ---- 詳細 ----
function renderDetail(id){
  const e=employees.find(x=>x.id===id);if(!e){currentView='list';render();return;}
  const groups=[{label:'基本情報',tabs:[['basic','基本・雇用'],['visa','在留・外国人'],['insurance','保険'],['fuyou','扶養']]},
    {label:'有休・勤怠',tabs:[['yukyu','有休・勤怠']]},
    {label:'書類・期限',tabs:[['kenko','健康診断'],['license','免許・資格'],['contract','雇用契約書']]},
    {label:'その他',tabs:[['memo','メモ'],['dispatch','派遣契約']]}];
  const group=groups.find(g=>g.tabs.some(([tab])=>tab===detailTab))||groups[0];
  if(!currentFilteredList.some(x=>x.id===id))currentFilteredList=[e,...currentFilteredList];
  const idx=currentFilteredList.findIndex(x=>x.id===id),prev=currentFilteredList[idx-1],next=currentFilteredList[idx+1];
  document.getElementById('mainContent').innerHTML=`
    <div class="employee-detail-head">
      <button class="text-button employee-back" onclick="employeeBackToList()">← 一覧に戻る</button>
      <div class="employee-identity-row"><div><div class="employee-identity"><h1>${emp_esc(e.sei)} ${emp_esc(e.mei)}</h1><span class="status-dot ${e.status==='在籍'?'is-active':''}">${emp_esc(e.status||'—')}</span></div><p>${emp_esc(e.shain_no||'社員番号未設定')}<span> · </span>${emp_esc(deptLabelById(e.dept_id)||'所属未設定')}</p></div>
      <div class="employee-switcher"><button class="btn btn-sm" ${prev?`onclick="viewDetail(${prev.id},detailTab)"`:'disabled'}>前の従業員</button><span>${idx+1}/${currentFilteredList.length}</span><button class="btn btn-sm" ${next?`onclick="viewDetail(${next.id},detailTab)"`:'disabled'}>次の従業員</button></div></div>
      <div class="employee-detail-actions"><span class="employee-updated">最終更新：${emp_esc(e.updated_at||'—')}</span><button class="btn btn-sm" onclick="editEmp(${e.id})">情報を編集</button>
      <details class="employee-tools"><summary class="btn btn-sm">書類・その他の操作</summary><div>
        <button class="btn" onclick="generateCertificate(${e.id},'zaishoku')">在職証明</button>
        ${e.status==='退職'?`<button class="btn" onclick="generateCertificate(${e.id},'taishoku')">退職証明</button>`:''}
        <button class="btn" data-employee-action="contract-open" data-id="${e.id}">雇用契約書を作成</button>
        <button class="btn" onclick="window.open('https://kakuzen2026.github.io/dispatch-kanri/','_blank','noopener')">派遣管理で確認 ↗</button>
        ${e.status==='在籍'?`<button class="btn btn-danger" onclick="retireEmp(${e.id})">退職処理</button>`:''}
      </div></details></div>
      <nav class="tab-list workspace-tabs" aria-label="従業員情報">${groups.map(g=>`<button class="itab ${g===group?'active':''}" data-tab="${g.tabs[0][0]}" ${g===group?'aria-current="page"':''} onclick="setDetailTab('${g.tabs[0][0]}')">${g.label}</button>`).join('')}</nav>
      ${group.tabs.length>1?`<nav class="employee-subtabs" aria-label="${group.label}の項目">${group.tabs.map(([tab,label])=>`<button class="${tab===detailTab?'active':''}" data-tab="${tab}" ${tab===detailTab?'aria-current="page"':''} onclick="setDetailTab('${tab}')">${label}</button>`).join('')}</nav>`:''}
    </div><div id="dtc"></div>`;
  renderDT();
}

// ---- 警告一覧 ----
let employeeAlertRender=0;
async function renderAlert(){
  const generation=++employeeAlertRender;
  const today=new Date();
  const todayStr=localDateStr(today);

  // 有給日数未設定の従業員
  const yukyuAlerts=employees.filter(e=>e.status==='在籍'&&calcYukyuInfo(e.id).unsetDays);

  // 雇用契約書アラート（契約書なし・期限切れ・15日以内）
  let dispatchContracts=[];
  try{dispatchContracts=await fetchDispatchContractEnds();}catch(e){}
  if(currentView!=='alert'||generation!==employeeAlertRender)return;
  const empContractMap={};
  employmentContracts.forEach(c=>{
    const id=c.employee_id;
    if(!empContractMap[id]||c.issued_date>(empContractMap[id].issued_date||''))
      empContractMap[id]={source:'this_app',contract_end:c.contract_end};
  });
  dispatchContracts.forEach(ce=>{
    if(!empContractMap[ce.employee_id])
      empContractMap[ce.employee_id]={source:'dispatch',contract_end:ce.contract_end};
  });
  const contractAlerts=employees.filter(e=>{
    if(e.status!=='在籍')return false;
    if(e.contract_other_system)return false; // 他システム管理はアラート対象外
    const ct=empContractMap[e.id];
    if(!ct)return true;
    if(!ct.contract_end)return false;
    return Math.ceil((new Date(ct.contract_end)-today)/86400000)<=15;
  });

  const alertList=employees.filter(e=>{
    const visaDl=e.visa_expiry?Math.round((new Date(e.visa_expiry)-today)/86400000):null;
    const licDl=e.license_expiry?Math.round((new Date(e.license_expiry)-today)/86400000):null;
    return(visaDl!==null&&visaDl<90)||(licDl!==null&&licDl<90);
  }).sort((a,b)=>{
    const aDl=Math.min(
      a.visa_expiry?Math.round((new Date(a.visa_expiry)-today)/86400000):9999,
      a.license_expiry?Math.round((new Date(a.license_expiry)-today)/86400000):9999
    );
    const bDl=Math.min(
      b.visa_expiry?Math.round((new Date(b.visa_expiry)-today)/86400000):9999,
      b.license_expiry?Math.round((new Date(b.license_expiry)-today)/86400000):9999
    );
    return aDl-bDl;
  });
  const expired=alertList.filter(e=>{
    const vd=e.visa_expiry?Math.round((new Date(e.visa_expiry)-today)/86400000):null;
    const ld=e.license_expiry?Math.round((new Date(e.license_expiry)-today)/86400000):null;
    return(vd!==null&&vd<0)||(ld!==null&&ld<0);
  });
  const warning=alertList.filter(e=>{
    const vd=e.visa_expiry?Math.round((new Date(e.visa_expiry)-today)/86400000):null;
    const ld=e.license_expiry?Math.round((new Date(e.license_expiry)-today)/86400000):null;
    return !((vd!==null&&vd<0)||(ld!==null&&ld<0));
  });

  const alertRow=(e)=>{
    const dept=departments.find(d=>d.id===Number(e.dept_id));
    const vd=e.visa_expiry?Math.round((new Date(e.visa_expiry)-today)/86400000):null;
    const ld=e.license_expiry?Math.round((new Date(e.license_expiry)-today)/86400000):null;
    const isExpired=(vd!==null&&vd<0)||(ld!==null&&ld<0);
    const rowBg=isExpired?'background:#fdf0f0':'background:#fdf3e7';
    const visaLabel=e.visa_expiry?(vd<0?`<span class="badge badge-danger">在留 期限切れ</span>`:`<span class="badge badge-warn">在留 残${vd}日</span>`):'';
    const licLabel=e.license_expiry&&ld<90?(ld<0?`<span class="badge badge-danger">免許 期限切れ</span>`:`<span class="badge badge-warn">免許 残${ld}日</span>`):'';
    return`<tr style="${rowBg}">
      <td><span class="emp-name" onclick="viewDetail(${e.id})">${e.sei} ${e.mei}<br><span style="font-size:11px;color:var(--emp-text2)">${e.seikana||''} ${e.meikana||''}</span></span></td>
      <td>${dept?.shozoku1||'—'}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;padding-top:12px">${visaLabel}${licLabel}</td>
      <td style="font-size:12px">${e.visa_expiry&&vd<90?e.visa_expiry:'—'}</td>
      <td style="font-size:12px">${e.license_expiry&&ld<90?e.license_expiry:'—'}</td>
      <td class="no-label" style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="editEmp(${e.id})">更新</button>
        <button class="btn btn-sm" onclick="generateCertificate(${e.id},'zaishoku')">証明書</button>
        <button type="button" class="btn btn-sm" data-employee-action="contract-open" data-id="${e.id}">契約書</button>
      </td>
    </tr>`;
  };

  document.getElementById('mainContent').innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <span style="font-size:16px;font-weight:700">⚠ 警告一覧</span>
    </div>

    ${contractAlerts.length>0?`
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:500;margin-bottom:8px;color:var(--emp-danger)">⚠ 雇用契約書アラート（${contractAlerts.length}名）</div>
      <div class="table-wrap"><table>
        <thead><tr><th>氏名</th><th>所属</th><th>状態</th><th>契約終了日</th><th></th></tr></thead>
        <tbody>${contractAlerts.map(e=>{
          const ct=empContractMap[e.id];
          const dept=departments.find(d=>d.id===Number(e.dept_id));
          const days=ct?.contract_end?Math.ceil((new Date(ct.contract_end)-today)/86400000):null;
          const statusLabel=!ct
            ?`<span class="badge badge-danger">契約書なし</span>`
            :days<0?`<span class="badge badge-danger">期限切れ（${Math.abs(days)}日）</span>`
            :`<span class="badge badge-warn">残${days}日</span>`;
          return`<tr style="${!ct||days<0?'background:#fdf0f0':'background:#fdf3e7'}">
            <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${e.id})">${emp_esc(e.sei)} ${emp_esc(e.mei)}</span></td>
            <td data-label="所属">${emp_esc(dept?.shozoku1||'—')}</td>
            <td data-label="状態">${statusLabel}</td>
            <td data-label="契約終了日" style="font-size:12px">${emp_esc(ct?.contract_end||'—')}</td>
            <td class="no-label"><button type="button" class="btn btn-sm" data-employee-action="contract-open" data-id="${e.id}">契約書作成</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`:''}

    ${yukyuAlerts.length>0?`
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:500;margin-bottom:8px;color:var(--emp-warn)">⚠ 有給付与日数が未設定の従業員（${yukyuAlerts.length}名）</div>
      <div class="table-wrap"><table>
        <thead><tr><th>氏名</th><th>所属</th><th>未設定の付与日</th><th></th></tr></thead>
        <tbody>${yukyuAlerts.map(e=>{
          const dept=departments.find(d=>d.id===Number(e.dept_id));
          const unsetGrants=yukyuGrants.filter(g=>g.employee_id===e.id&&(g.days===null||g.days===undefined||g.days==='')&&g.grant_date<=todayStr);
          return`<tr style="background:var(--warn-light)">
            <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${e.id},'yukyu')">${emp_esc(e.sei)} ${emp_esc(e.mei)}</span></td>
            <td data-label="所属">${emp_esc(dept?.shozoku1||'—')}</td>
            <td data-label="未設定の付与日" style="font-size:12px">${unsetGrants.map(g=>emp_esc(g.grant_date)).join('、')}</td>
            <td class="no-label"><button class="btn btn-sm" onclick="viewDetail(${e.id},'yukyu')">付与設定へ</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`:''}

    <div style="font-size:13px;font-weight:500;margin-bottom:8px">期限切れ・期限間近（在留・免許）</div>
    <div class="summary-grid" style="max-width:400px;margin-bottom:12px">
      <div class="scard"><div class="scard-label">期限切れ</div><div class="scard-val" style="color:var(--emp-danger)">${expired.length}</div></div>
      <div class="scard"><div class="scard-label">90日以内</div><div class="scard-val" style="color:var(--emp-warn)">${warning.length}</div></div>
    </div>
    ${alertList.length===0?`<div class="empty" style="background:var(--emp-surface);border:1px solid var(--emp-border);border-radius:var(--emp-radius-lg);padding:48px 0">期限切れ・期限間近の従業員はいません</div>`:`
    <div class="table-wrap"><table>
      <thead><tr><th>氏名</th><th>所属</th><th>警告内容</th><th>在留期限</th><th>免許期限</th><th></th></tr></thead>
      <tbody>${alertList.map(e=>alertRow(e)).join('')}</tbody>
    </table></div>`}

    <div id="dispatch-alert-section" style="margin-top:24px;">
      <div style="font-size:13px;font-weight:500;margin-bottom:8px;color:var(--emp-text)">📄 派遣契約の期限アラート</div>
      <div class="loading" style="padding:20px 0;">読み込み中...</div>
    </div>`;

  // 派遣契約アラートを非同期で読み込み
  loadDispatchAlerts();
}

async function loadDispatchAlerts(){
  const section=document.getElementById('dispatch-alert-section');
  if(!section)return;
  try{
    const today=new Date();
    const contracts=await fetchDispatchContractsByEnd();
    const alertContracts=contracts.filter(ct=>{
      const days=Math.ceil((new Date(ct.contract_end)-today)/86400000);
      return days<=60;
    });
    if(!alertContracts.length){
      section.innerHTML=`<div style="font-size:13px;font-weight:500;margin-bottom:8px;color:var(--emp-text)">📄 派遣契約の期限アラート</div>
        <div class="empty" style="background:var(--emp-surface);border:1px solid var(--emp-border);border-radius:var(--emp-radius-lg);padding:24px 0;font-size:13px;">期限が近い派遣契約はありません</div>`;
      return;
    }
    const empMap={};employees.forEach(e=>empMap[e.id]=e);
    section.innerHTML=`
      <div style="font-size:13px;font-weight:500;margin-bottom:8px;color:var(--emp-text)">📄 派遣契約の期限アラート（60日以内 ${alertContracts.length}件）</div>
      <div class="table-wrap"><table>
        <thead><tr><th>氏名</th><th>契約番号</th><th>取引先/現場</th><th>契約終了日</th><th>残日数</th><th></th></tr></thead>
        <tbody>${alertContracts.map(ct=>{
          const emp=empMap[ct.employee_id];
          const name=emp?`${emp_esc(emp.sei)} ${emp_esc(emp.mei)}`:`ID:${ct.employee_id}`;
          const days=Math.ceil((new Date(ct.contract_end)-today)/86400000);
          const rowBg=days<0?'background:var(--danger-light);':days<=14?'background:var(--warn-light);':'';
          const dayLabel=days<0?`<span style="color:var(--emp-danger);font-weight:600;">期限切れ（${Math.abs(days)}日）</span>`
            :`<span style="color:var(--emp-warn);font-weight:600;">${days}日</span>`;
          const dispatchUrl=`https://kakuzen2026.github.io/dispatch-kanri/?contract=${emp_esc(ct.dispatch_app_contract_id)}`;
          return`<tr style="${rowBg}">
            <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${ct.employee_id},'dispatch')">${name}</span></td>
            <td data-label="契約番号" style="font-size:12px;">${emp_esc(ct.contract_no||'—')}</td>
            <td data-label="取引先/現場" style="font-size:12px;">${emp_esc(ct.client_name||'—')} / ${emp_esc(ct.site_name||'—')}</td>
            <td data-label="契約終了日" style="font-size:12px;">${emp_esc(ct.contract_end)}</td>
            <td data-label="残日数">${dayLabel}</td>
            <td class="no-label"><button class="btn btn-sm" onclick="window.open('${dispatchUrl}','_blank')">派遣管理で確認</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`;
  }catch(e){
    const section=document.getElementById('dispatch-alert-section');
    if(section)section.style.display='none';
  }
}

// ---- 詳細 ----
async function deleteEmp(id){
  showToast('完全削除は停止中です。退職処理を使ってください。','warn');
}
async function retireEmp(id){
  const e=employees.find(x=>x.id===id);
  if(!e)return;
  if(!confirm(`${e.sei} ${e.mei} さんを退職扱いにします。\n台帳データは削除せず残します。よろしいですか？`))return;
  await retireEmployee(id,new Date().toISOString().slice(0,10));
  await loadEmployees();render();
}

async function renderDT(){
  EMP_UI.dirty=false;
  const e=employees.find(x=>x.id===viewingId);if(!e)return;
  const c=document.getElementById('dtc');
  const dept=departments.find(d=>d.id===Number(e.dept_id));
  if(detailTab==='basic'){
    c.innerHTML=`
      <div class="detail-grid">
        ${df('社員番号',e.shain_no)}
        ${df('マイナンバー',e.my_number?maskSensitive(e.my_number):null)}
      </div>
      <div class="detail-grid" style="margin-top:10px">
        ${df('姓',e.sei)}${df('名',e.mei)}
      </div>
      <div class="detail-grid" style="margin-top:10px">
        ${df('姓カナ',e.seikana)}${df('名カナ',e.meikana)}
      </div>
      <div class="detail-grid" style="margin-top:10px">
        ${df('生年月日',e.birthday)}${df('年齢',e.birthday?calcAgeVal(e.birthday)+'歳':null)}${df('性別',e.gender)}${df('国籍',e.nationality)}
      </div>
      ${df('住所',e.address,'full')}
      <div class="detail-grid">${df('電話',e.tel)}${df('メール',e.email)}</div>
      <div class="section-title">雇用情報</div>
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-label">会社</div><div class="detail-val">${e.company==='セレクト'?'<span class="badge badge-visa">セレクト</span>':e.company==='覚善'?'<span class="badge badge-active">覚善</span>':'<span style="color:var(--emp-text3)">—</span>'}</div></div>
        ${df('所属1（勤務先）',dept?.shozoku1)}${df('所属2（工場名）',dept?.shozoku2)}
        ${df('役職',e.position)}${df('雇用形態',e.koyou)}
        ${df('雇用期間の定め',e.employment_type==='permanent'?'無期（期間の定めなし）':e.employment_type==='fixed'?'有期（期間の定めあり）':null)}
        ${df('入社日',e.nyusha_date)}
        ${df('退職日',e.taishoku_date)}
        ${df('月給',e.kyuyo?e.kyuyo+'円':null)}${df('時給',e.jikyu?e.jikyu+'円':null)}
      </div>
      <div class="section-title">銀行口座</div>
      <div class="detail-grid">
        ${df('銀行名',e.bank_name)}${df('支店名',e.bank_branch)}
        ${df('口座番号',e.bank_account_no)}${df('口座名義',e.bank_account_name)}
      </div>`;
  } else if(detailTab==='visa'){
    const rcImgs=e.residence_card_imgs||[];
    c.innerHTML=`
      <div class="detail-grid">${df('在留資格',e.visa)}${df('在留カード番号',e.visa_no)}${df('在留期限',e.visa_expiry)}</div>
      <div style="margin-top:14px">
        <div style="font-size:12px;color:var(--emp-text2);margin-bottom:8px;font-weight:500">在留カード写真（最大4枚）</div>
        <div id="rcImgGrid">${multiImgGrid(rcImgs,'delRcImg')}</div>        ${rcImgs.length<4?`
        <label class="photo-upload file-dropzone" tabindex="0" role="button" aria-label="画像・PDFを追加" id="rcDetailDrop">
          <input type="file" id="rcDetailInput" accept="image/*,application/pdf" style="display:none" onchange="addRcImg(${e.id},this)">
          ${fileDropHint("image/*,application/pdf")}<span>残り${4-rcImgs.length}枚</span>
        </label>`:''}
      </div>`;
  } else if(detailTab==='insurance'){
    const deps=getFuyouList(e);
    const socialCnt=deps.filter(d=>d.social_fuyou).length;
    c.innerHTML=`<div class="section-title">雇用保険</div><div class="detail-grid">${df('被保険者番号',e.koyo_hoken_no)}${df('加入日',e.koyo_nyusha)}${df('喪失日',e.koyo_soshitsu)}</div><div class="section-title">社会保険</div><div class="detail-grid">${df('被保険者番号',e.shakai_hoken_no)}${df('加入日',e.shakai_nyusha)}${df('喪失日',e.shakai_soshitsu)}${df('社会保険扶養',socialCnt?socialCnt+'名':'なし')}</div><div style="margin-top:12px"><button class="btn btn-sm" onclick="setDetailTab('fuyou')">扶養情報を登録・確認</button></div>`;
  } else if(detailTab==='fuyou'){
    c.innerHTML=renderFuyouEditor(e);
  } else if(detailTab==='yukyu'){
    const recs=yukyuRecords.filter(r=>r.employee_id===e.id&&(!EMP_UI.detailMonth||r.use_date?.startsWith(EMP_UI.detailMonth))).sort((a,b)=>(b.use_date||'').localeCompare(a.use_date||''));
    const grants=yukyuGrants.filter(g=>g.employee_id===e.id).sort((a,b)=>(b.grant_date||'').localeCompare(a.grant_date||''));
    const info=calcYukyuInfo(e.id),ready=attendanceRecordsReady&&attendanceGrantsReady;
    const service=fullMonthsBetween(e.kousoku_start_date||e.nyusha_date,info.nextDate);
    c.innerHTML=`
      <div class="employee-leave-summary"><div><span>有休残数</span><strong>${ready?info.remaining+'日':'未確認'}</strong></div><div><span>記録上の取得合計</span><strong>${ready?info.used+'日':'未確認'}</strong></div><div><span>次回付与日</span><strong class="summary-date">${employeeGrantDataReady()?emp_esc(info.nextDate||'—'):'未確認'}</strong></div></div>
      <div class="workspace-heading section-heading"><h2>勤怠記録</h2><button class="btn btn-primary" onclick="openYukyuFromDetail(${e.id})">＋ 有休・勤怠を登録</button></div>
      <label class="month-filter detail-month">対象月<input type="month" id="detailMonth" value="${emp_attr(EMP_UI.detailMonth)}" onchange="setDetailMonth(this.value)"></label>
      ${employeeAttendanceTable(recs,false,true)}
      <details class="leave-history" ${info.unsetDays?'open':''}><summary>付与履歴・付与を登録</summary>
        <div class="workspace-heading section-heading"><p>付与済み合計：${attendanceGrantsReady?info.granted+'日':'未確認'}</p><button class="btn" ${employeeGrantDataReady()?'':'disabled'} onclick="openGrantModal(${e.id})">＋ 付与を登録</button></div>
        ${!attendanceGrantsReady?'<p role="alert">付与記録を読み込めませんでした。</p>':grants.map(g=>`<div class="list-item grant-row"><span>${emp_esc(g.grant_date||'日付未設定')}</span><strong>${g.days==null||g.days===''?'日数未設定':emp_esc(g.days)+'日'}</strong><span>期限：${emp_esc(g.expire_date||'—')}</span><div class="workspace-actions"><button class="btn btn-sm" onclick="openGrantModal(${e.id},${g.id})">編集</button><button class="text-button danger-text" onclick="delGrant(${g.id},${e.id})">削除</button></div></div>`).join('')||'<p class="workspace-help">付与履歴がありません。</p>'}
      </details>
      <details class="leave-settings"><summary>付与日・勤続年数の設定</summary><p class="workspace-help">次回付与日時点の勤続年数：${!employeeGrantDataReady()||service===null?'未確認':Math.floor(service/12)+'年'+service%12+'ヶ月'}</p>
      <div style="background:var(--emp-bg);border:1px solid var(--emp-border);border-radius:var(--emp-radius);padding:12px 14px;margin-bottom:16px">
        <div style="font-size:12px;color:var(--emp-text2);font-weight:500;margin-bottom:10px">以前の勤続年数を参照しますか？</div>
        <div class="sel-group" style="margin-bottom:10px">
          <button class="sel-btn ${e.kousoku_start_date?'selected':''}" onclick="toggleKousoku(${e.id},true,this)">参照する</button>
          <button class="sel-btn ${!e.kousoku_start_date?'selected':''}" onclick="toggleKousoku(${e.id},false,this)">参照しない</button>
        </div>
        <div id="kousokuDateRow" style="display:${e.kousoku_start_date?'flex':'none'};gap:8px;align-items:center;flex-wrap:wrap">
          <div style="font-size:12px;color:var(--emp-text2);margin-bottom:4px">以前の勤務先の入社日</div>
          <input type="date" id="kousokuInput" value="${e.kousoku_start_date||''}" style="padding:6px 10px;border:1px solid var(--emp-border2);border-radius:var(--emp-radius);font-size:13px;font-family:inherit">
          <button class="btn btn-primary btn-sm" onclick="saveKousokuDate(${e.id})">保存</button>
          <div style="font-size:12px;color:var(--emp-text3);flex-basis:100%">付与日：毎年1月1日</div>
        </div>
        <div style="font-size:12px;color:var(--emp-text3);display:${e.kousoku_start_date?'none':'block'}">付与日：入社6か月後、その後は毎年同月同日${!e.kousoku_start_date?`（本人の入社日：${e.nyusha_date||'未登録'}）`:''}</div>
      </div>

      </details>`;
  } else if(detailTab==='kenko'){
    const list=e.kenkou_list||[];
    c.innerHTML=`
      <div style="display:flex;flex-direction:column;gap:6px">
        ${list.length===0?'<div class="empty">健康診断記録がありません</div>':list.map((x,i)=>`
          <div class="list-item"><span class="dt">${x.date}</span>
          <span class="badge ${x.result==='異常なし'?'badge-active':x.result==='要精密検査'?'badge-danger':'badge-warn'}">${x.result}</span>
          ${x.img?`<img src="${x.img}" style="height:36px;border-radius:4px">`:''}
          <button class="btn btn-sm btn-danger" style="margin-left:auto" onclick="delKenko(${e.id},${i})">削除</button></div>`).join('')}
      </div>
      <div class="add-row">
        <div><label style="font-size:12px;color:var(--emp-text2)">受診日</label><br><input type="date" id="kd" style="width:150px;margin-top:4px"></div>
        <div><label style="font-size:12px;color:var(--emp-text2)">結果</label><br><select id="kr" style="margin-top:4px">${CHECKRES.map(r=>`<option>${r}</option>`).join('')}</select></div>
        <div><label style="font-size:12px;color:var(--emp-text2)">写真</label><br>${fileDropZone("kimg","image/*,application/pdf","previewKI(this)")} <span id="kimgName" style="font-size:12px;color:var(--emp-text2)"></span></div>
        <div style="align-self:flex-end"><button class="btn btn-primary" onclick="addKenko(${e.id})">追加</button></div>
      </div>`;
  } else if(detailTab==='license'){
    const slist=e.shikaku_list||[];
    const today=new Date();
    const licExp=e.license_expiry?new Date(e.license_expiry):null;
    const licDl=licExp?Math.round((licExp-today)/86400000):null;
    const licImgs=e.license_imgs||[];
    c.innerHTML=`
      <div class="section-title">運転免許証</div>
      <div class="detail-grid">
        ${df('免許証番号',e.license_no)}${df('取得日',e.license_date)}
        <div class="detail-field"><div class="detail-label">有効期限</div><div class="detail-val">
          ${e.license_expiry?(licDl<0?`<span style="color:var(--emp-danger)">${e.license_expiry}（期限切れ）</span>`:(licDl<90?`<span style="color:var(--emp-warn)">${e.license_expiry}（残${licDl}日）</span>`:e.license_expiry)):('<span style="color:var(--emp-text3)">—</span>')}
        </div></div>
      </div>
      <div style="margin-top:12px">
        <div style="font-size:12px;color:var(--emp-text2);margin-bottom:8px;font-weight:500">免許証写真（最大4枚）</div>
        <div id="licImgGrid">${multiImgGrid(licImgs,'delLicImg')}</div>
        ${licImgs.length<4?`
        <label class="photo-upload file-dropzone" tabindex="0" role="button" aria-label="画像・PDFを追加" id="licDetailDrop">
          <input type="file" id="licDetailInput" accept="image/*,application/pdf" style="display:none" onchange="addLicImg(${e.id},this)">
          ${fileDropHint("image/*,application/pdf")}<span>残り${4-licImgs.length}枚</span>
        </label>`:''}
      </div>
      <div class="add-row" style="margin-top:12px">
        <div><label style="font-size:12px;color:var(--emp-text2)">免許証番号</label><br><input type="text" id="lic_no" value="${e.license_no||''}" style="width:160px;margin-top:4px"></div>
        <div><label style="font-size:12px;color:var(--emp-text2)">取得日</label><br><input type="date" id="lic_date" value="${e.license_date||''}" style="width:150px;margin-top:4px"></div>
        <div><label style="font-size:12px;color:var(--emp-text2)">有効期限</label><br><input type="date" id="lic_expiry" value="${e.license_expiry||''}" style="width:150px;margin-top:4px"></div>
        <div style="align-self:flex-end"><button class="btn btn-primary" onclick="saveLicense(${e.id})">保存</button></div>
      </div>

      <div class="section-title" style="margin-top:24px">その他資格</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${slist.length===0?'<div class="empty" style="padding:16px 0">資格が登録されていません</div>':slist.map((x,i)=>{
          const sExp=x.expiry?new Date(x.expiry):null;
          const sDl=sExp?Math.round((sExp-today)/86400000):null;
          return`<div class="list-item">
            <span style="font-weight:500;min-width:120px">${x.name||'—'}</span>
            <span class="dt">取得：${x.date||'—'}</span>
            <span class="dt">有効期限：${x.expiry?(sDl<0?`<span style="color:var(--emp-danger)">${x.expiry}（切れ）</span>`:(sDl<90?`<span style="color:var(--emp-warn)">${x.expiry}（残${sDl}日）</span>`:x.expiry)):'なし'}</span>
            ${x.img?`<img src="${x.img}" style="height:32px;border-radius:4px">`:''}
            <button class="btn btn-sm btn-danger" style="margin-left:auto" onclick="delShikaku(${e.id},${i})">削除</button>
          </div>`;
        }).join('')}
      </div>
      <div class="add-row" style="margin-top:10px">
        <div><label style="font-size:12px;color:var(--emp-text2)">資格名</label><br><input type="text" id="sk_name" placeholder="例：フォークリフト" style="width:160px;margin-top:4px"></div>
        <div><label style="font-size:12px;color:var(--emp-text2)">取得日</label><br><input type="date" id="sk_date" style="width:150px;margin-top:4px"></div>
        <div><label style="font-size:12px;color:var(--emp-text2)">有効期限</label><br><input type="date" id="sk_expiry" style="width:150px;margin-top:4px"></div>
        <div><label style="font-size:12px;color:var(--emp-text2)">写真</label><br>${fileDropZone("sk_img","image/*","previewSkImg(this)")} <span id="skImgName" style="font-size:12px;color:var(--emp-text2)"></span></div>
        <div style="align-self:flex-end"><button class="btn btn-primary" onclick="addShikaku(${e.id})">追加</button></div>
      </div>`;
  } else if(detailTab==='memo'){
    c.innerHTML=`<div class="field"><label>メモ・備考</label><textarea id="memoText" style="min-height:160px">${emp_textarea(stripFuyouMeta(e.memo))}</textarea></div><div style="margin-top:10px;text-align:right"><button class="btn btn-primary" onclick="saveMemo(${e.id})">保存</button></div>`;
  } else if(detailTab==='dispatch'){
    c.innerHTML=`<div class="loading">派遣契約を読み込み中...</div>`;
    loadDispatchContracts(e.id).then(contracts=>{
      const today=new Date();
      if(!contracts.length){
        c.innerHTML=`<div class="empty">派遣契約の記録がありません</div>`;
        return;
      }
      c.innerHTML=`
        <div style="font-size:13px;color:var(--emp-text2);margin-bottom:12px;">派遣管理台帳に登録された契約履歴です。クリックすると派遣管理アプリの詳細へ移動します。</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${contracts.map(ct=>{
            const start=new Date(ct.contract_start);
            const end=new Date(ct.contract_end);
            const days=Math.ceil((end-today)/86400000);
            let statusBadge='',rowBg='';
            if(days<0){
              statusBadge=`<span class="badge badge-danger">期限切れ</span>`;
              rowBg='background:var(--danger-light);';
            } else if(days<=30){
              statusBadge=`<span class="badge badge-warn">残${days}日</span>`;
              rowBg='background:var(--warn-light);';
            } else {
              statusBadge=`<span class="badge badge-active">有効</span>`;
            }
            const dispatchUrl=`https://kakuzen2026.github.io/dispatch-kanri/?contract=${ct.dispatch_app_contract_id}`;
            return`<div class="list-item" style="${rowBg}cursor:pointer;" onclick="window.open('${dispatchUrl}','_blank')">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                  <span style="font-weight:600;font-size:13px;">${ct.contract_no||'—'}</span>
                  ${statusBadge}
                </div>
                <div style="font-size:12px;color:var(--emp-text2);">📍 ${ct.client_name||'—'} / ${ct.site_name||'—'}</div>
                <div style="font-size:12px;color:var(--emp-text2);margin-top:2px;">📅 ${ct.contract_start} 〜 ${ct.contract_end}${days>=0?` （残${days}日）`:' （期限切れ）'}</div>
              </div>
              <span style="font-size:11px;color:var(--emp-info);white-space:nowrap;">詳細 →</span>
            </div>`;
          }).join('')}
        </div>`;
    });
  } else if(detailTab==='contract'){
    const empContracts=employmentContracts.filter(c=>c.employee_id===e.id).sort((a,b)=>(b.issued_date||'').localeCompare(a.issued_date||''));
    const dispContracts=await (async()=>{try{return await fetchDispatchContractsForEmployee(e.id);}catch(_){return[];}})();
    if(!empContracts.length&&!dispContracts.length){
      c.innerHTML='<div class="empty">雇用契約書の発行履歴がありません</div>';
    } else {
      let html='';
      if(dispContracts.length){
        html+='<div class="section-title">派遣管理で作成した雇用契約書兼就業条件明示書</div>';
        html+='<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">';
        dispContracts.forEach(ct=>{
          html+='<div class="list-item">';
          html+='<div style="flex:1;">';
          html+='<div style="font-weight:600;font-size:13px;">'+(ct.contract_no||'—')+'</div>';
          html+='<div style="font-size:12px;color:var(--emp-text2);">📍 '+(ct.client_name||'—')+' / '+(ct.site_name||'—')+'</div>';
          html+='<div style="font-size:12px;color:var(--emp-text2);">📅 '+(ct.contract_start||'—')+' 〜 '+(ct.contract_end||'—')+'</div>';
          html+='</div>';
          html+='<span class="badge badge-visa">派遣管理</span>';
          html+='</div>';
        });
        html+='</div>';
      }
      if(empContracts.length){
        html+='<div class="section-title">このアプリで作成した雇用契約書</div>';
        html+='<div style="display:flex;flex-direction:column;gap:8px;">';
        empContracts.forEach(ct=>{
          html+='<div class="list-item">';
          html+='<div style="flex:1;">';
          html+='<div style="font-weight:600;font-size:13px;">'+(ct.issued_date||'—')+' 発行</div>';
          html+='<div style="font-size:12px;color:var(--emp-text2);">期間: '+(ct.contract_start||'—')+' 〜 '+(ct.contract_end||'—')+'</div>';
          html+='</div>';
          html+=`<button type="button" class="btn btn-sm" data-employee-action="contract-open" data-id="${e.id}">再発行</button>`;
          html+='</div>';
        });
        html+='</div>';
      }
      c.innerHTML=html;
    }
  }
}
function df(label,val,full){
  return`<div class="detail-field" ${full?'style="grid-column:1/-1"':''}><div class="detail-label">${emp_esc(label)}</div><div class="detail-val">${val?emp_esc(val):'<span style="color:var(--emp-text3)">—</span>'}</div></div>`;
}
function renderFuyouEditor(e,deps=getFuyouList(e)){
  const rows=deps.length?deps:[{name:'',relation:'',birthday:'',tax_fuyou:false,social_fuyou:false,certified_date:'',lost_date:'',note:''}];
  return`
    <div style="display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap">
      <div>
        <div class="section-title" style="margin:0">扶養情報</div>
        <div style="font-size:12px;color:var(--emp-text2);margin-top:4px">税扶養と社会保険扶養を分けて登録できます。</div>
      </div>
      <button class="btn btn-sm" onclick="addFuyouRow()">＋ 扶養家族を追加</button>
    </div>
    <div id="fuyouRows" style="display:flex;flex-direction:column;gap:10px">
      ${rows.map((d,i)=>fuyouRowHtml(d,i)).join('')}
    </div>
    <div class="page-actions" style="padding-bottom:20px">
      <button class="btn" onclick="renderDT()">変更を破棄</button>
      <button class="btn btn-primary" onclick="saveFuyou(${e.id})">扶養情報を保存</button>
    </div>`;
}
function fuyouRowHtml(d,i){
  return`<div class="settings-card fuyou-row" style="max-width:none;padding:14px" data-index="${i}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
      <strong style="font-size:13px">扶養家族 ${i+1}</strong>
      <button class="btn btn-sm btn-danger" onclick="removeFuyouRow(${i})">削除</button>
    </div>
    <div class="field-grid">
      <div class="field"><label>氏名</label><input type="text" class="fy-name" value="${emp_attr(d.name||'')}"></div>
      <div class="field"><label>続柄</label><input type="text" class="fy-relation" placeholder="配偶者・子など" value="${emp_attr(d.relation||'')}"></div>
      <div class="field"><label>生年月日</label><input type="date" class="fy-birthday" value="${emp_attr(d.birthday||'')}"></div>
      <div class="field"><label>認定日</label><input type="date" class="fy-certified" value="${emp_attr(d.certified_date||'')}"></div>
      <div class="field"><label>喪失日</label><input type="date" class="fy-lost" value="${emp_attr(d.lost_date||'')}"></div>
      <div class="field"><label>扶養区分</label>
        <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-top:6px"><input type="checkbox" class="fy-tax" ${d.tax_fuyou?'checked':''}> 税扶養</label>
        <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-top:6px"><input type="checkbox" class="fy-social" ${d.social_fuyou?'checked':''}> 社会保険扶養</label>
      </div>
    </div>
    <div class="field" style="margin-top:10px"><label>備考</label><textarea class="fy-note" rows="2">${emp_textarea(d.note||'')}</textarea></div>
  </div>`;
}
function collectFuyouRows(includeEmpty=false){
  return[...document.querySelectorAll('.fuyou-row')].map(row=>({
    name:row.querySelector('.fy-name')?.value.trim()||'',
    relation:row.querySelector('.fy-relation')?.value.trim()||'',
    birthday:row.querySelector('.fy-birthday')?.value||'',
    tax_fuyou:row.querySelector('.fy-tax')?.checked||false,
    social_fuyou:row.querySelector('.fy-social')?.checked||false,
    certified_date:row.querySelector('.fy-certified')?.value||'',
    lost_date:row.querySelector('.fy-lost')?.value||'',
    note:row.querySelector('.fy-note')?.value.trim()||'',
  })).filter(d=>includeEmpty||d.name||d.relation||d.birthday||d.tax_fuyou||d.social_fuyou);
}
function addFuyouRow(){
  const e=employees.find(x=>x.id===viewingId);if(!e)return;
  const rows=collectFuyouRows(true);rows.push({name:'',relation:'',birthday:'',tax_fuyou:false,social_fuyou:false,certified_date:'',lost_date:'',note:''});
  document.getElementById('dtc').innerHTML=renderFuyouEditor(e,rows);
  markEmployeeDirty();bindEmployeeLabels();
}
function removeFuyouRow(idx){
  const e=employees.find(x=>x.id===viewingId);if(!e)return;
  const rows=collectFuyouRows(true);rows.splice(idx,1);
  document.getElementById('dtc').innerHTML=renderFuyouEditor(e,rows);
  markEmployeeDirty();bindEmployeeLabels();
}
async function saveFuyou(id){
  const e=employees.find(x=>x.id===id);if(!e)return;
  const rows=collectFuyouRows();
  const memo=memoWithFuyouMeta(e.memo,rows);
  try{
    await updateEmployeeMemo(id,memo,new Date().toISOString().slice(0,10));
    e.memo=memo;e.updated_at=new Date().toISOString().slice(0,10);
    showToast('扶養情報を保存しました');
    renderDT();
  }catch(err){showToast('扶養情報の保存に失敗しました：'+err.message,'error');}
}
async function saveMemo(id){
  const e=employees.find(x=>x.id===id);
  const memo=memoWithFuyouMeta(document.getElementById('memoText').value,getFuyouList(e)),updated=new Date().toISOString().slice(0,10);
  try{await updateEmployeeMemo(id,memo,updated);e.memo=memo;e.updated_at=updated;EMP_UI.dirty=false;showToast('保存しました');}
  catch(error){showToast('保存に失敗しました：'+error.message,'error');}
}
