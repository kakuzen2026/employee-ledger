// ---- 従業員一覧 ----
function renderList(){
  // フィルター値を復元または取得
  const sq=document.getElementById('searchQ')?.value??listFilter.sq;
  const fs=document.getElementById('fStatus')?.value??listFilter.fs;
  const fd=document.getElementById('fDept')?.value??listFilter.fd;
  const fc=document.getElementById('fCompany')?.value??listFilter.fc;
  // 保存
  listFilter={sq,fs,fd,fc};

  let list=employees;
  if(sq)list=list.filter(e=>{
    return employeeSearchText(e).includes(sq.toLowerCase());
  });
  if(fs)list=list.filter(e=>e.status===fs);
  if(fd)list=list.filter(e=>String(e.dept_id)===fd);
  if(fc)list=list.filter(e=>e.company===fc);
  currentFilteredList=[...list];

  const today=new Date(),total=employees.length,active=employees.filter(e=>e.status==='在籍').length;
  const warn=employees.filter(e=>{if(!e.visa_expiry)return false;return(new Date(e.visa_expiry)-today)/86400000<90;}).length;
  const selectCnt=employees.filter(e=>e.company==='セレクト').length;
  const kakuzenCnt=employees.filter(e=>e.company==='覚善').length;
  const focus=getLedgerFocusMetrics(today);

  const showCol=k=>visibleCols.includes(k);

  document.getElementById('mainContent').innerHTML=`
    <div class="emp-today-board">
      <section class="emp-today-main">
        <div class="emp-today-head">
          <div>
            <div class="emp-today-kicker">TODAY</div>
            <div class="emp-today-title">今日の確認</div>
            <div class="emp-today-sub">期限、契約書、有給の未処理を先に確認できます。</div>
          </div>
          <button class="btn btn-primary" onclick="showView('add')">新規登録</button>
        </div>
        <div class="emp-task-grid">
          <button class="emp-task-card ${focus.expiredTotal?'danger':'warn'}" onclick="showView('alert')">
            <div class="emp-task-num">${focus.deadlineTotal}</div>
            <div class="emp-task-label">期限アラート</div>
            <div class="emp-task-note">在留・免許の期限切れ ${focus.expiredTotal}件 / 90日以内 ${Math.max(0,focus.deadlineTotal-focus.expiredTotal)}件</div>
          </button>
          <button class="emp-task-card ${focus.contractNeed.length?'danger':'info'}" onclick="showView('alert')">
            <div class="emp-task-num">${focus.contractNeed.length}</div>
            <div class="emp-task-label">契約書確認</div>
            <div class="emp-task-note">未作成または終了15日以内の雇用契約書を確認</div>
          </button>
          <button class="emp-task-card ${focus.yukyuUnset.length?'warn':'info'}" onclick="showView('yukyu_list')">
            <div class="emp-task-num">${focus.yukyuUnset.length}</div>
            <div class="emp-task-label">有給未設定</div>
            <div class="emp-task-note">付与日はあるが日数未設定の従業員を確認</div>
          </button>
        </div>
      </section>
      <aside class="emp-today-side">
        <div class="emp-today-kicker">WORKFLOW</div>
        <div class="emp-today-title" style="font-size:15px;margin-bottom:10px">よく使う導線</div>
        <div class="emp-flow-list">
          <button class="emp-flow-btn" onclick="showView('list')"><strong>従業員を探す</strong><span>検索・絞り込み</span></button>
          <button class="emp-flow-btn" onclick="showView('yukyu_add')"><strong>有給を登録</strong><span>取得/付与を追加</span></button>
          <button class="emp-flow-btn" onclick="showView('cert_list')"><strong>証明書を見る</strong><span>発行履歴・再発行</span></button>
          <button class="emp-flow-btn" onclick="showView('contract_list')"><strong>契約書を見る</strong><span>作成履歴・再発行</span></button>
        </div>
      </aside>
    </div>
    <div class="emp-command-zone">
      <div class="emp-command-title">
        <strong>従業員一覧</strong>
        <span>詳細確認、書類作成、退職処理は各行から実行できます。</span>
      </div>
      <div class="emp-command-actions">
        <button class="btn btn-primary" onclick="showView('add')">新規登録</button>
        <button class="btn" onclick="showView('alert')">警告確認</button>
        <button class="btn" onclick="showView('yukyu_add')">有給登録</button>
        <button class="btn emp-secondary-action" onclick="exportCSV()">CSV出力</button>
      </div>
    </div>
    <div class="summary-grid">
      <div class="scard"><div class="scard-label">総従業員数</div><div class="scard-val">${total}</div></div>
      <div class="scard"><div class="scard-label">在籍</div><div class="scard-val" style="color:#1a5c30">${active}</div></div>
      <div class="scard"><div class="scard-label">セレクト</div><div class="scard-val" style="color:var(--emp-info)">${selectCnt}</div></div>
      <div class="scard"><div class="scard-label">覚善</div><div class="scard-val" style="color:var(--emp-accent)">${kakuzenCnt}</div></div>
      <div class="scard"><div class="scard-label">在留期限90日以内</div><div class="scard-val" style="color:var(--emp-warn)">${warn}</div></div>
    </div>
    <div class="emp-list-toolbar">
      <div class="search-bar" style="margin-bottom:0">
        <input id="searchQ" placeholder="氏名・部署・在留資格で検索" value="${sq}" onkeydown="if(event.key==='Enter'&&!event.isComposing){listFilter.sq=this.value;renderList();}">
        <button onclick="listFilter.sq=document.getElementById('searchQ').value;renderList();" style="padding:7px 14px;border-radius:8px;border:1px solid var(--emp-border2);background:var(--emp-accent);color:#fff;font-size:13px;cursor:pointer;white-space:nowrap;">検索</button>
        <select id="fCompany" onchange="listFilter.fc=this.value;render()">
          <option value="">会社：全て</option>
          <option value="セレクト" ${fc==='セレクト'?'selected':''}>セレクト</option>
          <option value="覚善" ${fc==='覚善'?'selected':''}>覚善</option>
        </select>
        <select id="fStatus" onchange="listFilter.fs=this.value;render()">
          <option value="">在籍：全て</option>
          <option value="在籍" ${fs==='在籍'?'selected':''}>在籍</option>
          <option value="退職" ${fs==='退職'?'selected':''}>退職</option>
        </select>
        <select id="fDept" onchange="listFilter.fd=this.value;render()">
          <option value="">部署：全て</option>
          ${departments.map(d=>`<option value="${d.id}" ${fd==d.id?'selected':''}>${deptLabel(d)}</option>`).join('')}
        </select>
        <button class="btn btn-sm" onclick="showColSettings()" style="white-space:nowrap">⚙ 表示列</button>
      </div>
    </div>
    ${list.length===0?'<div class="empty">該当する従業員がいません</div>':`
    <div class="table-wrap"><table>
      <thead><tr>
        <th>氏名</th>
        ${showCol('company')?'<th>会社</th>':''}
        ${showCol('shozoku1')?'<th>所属1</th>':''}
        ${showCol('shozoku2')?'<th>所属2</th>':''}
        ${showCol('koyou')?'<th>雇用形態</th>':''}
        ${showCol('status')?'<th>在籍</th>':''}
        ${showCol('visa')?'<th>在留資格</th>':''}
        ${showCol('visa_expiry')?'<th>在留期限</th>':''}
        ${showCol('license_expiry')?'<th>免許期限</th>':''}
        ${showCol('nyusha_date')?'<th>入社日</th>':''}
        ${showCol('shain_no')?'<th>社員番号</th>':''}
        ${showCol('updated_at')?'<th>更新日</th>':''}
        <th></th>
      </tr></thead>
      <tbody>${list.map(e=>{
        const dept=departments.find(d=>d.id===Number(e.dept_id));
        const exp=e.visa_expiry?new Date(e.visa_expiry):null,dl=exp?Math.round((exp-today)/86400000):null;
        const vb=e.visa?(dl!==null&&dl<0?`<span class="badge badge-danger">${e.visa}</span>`:(dl!==null&&dl<90?`<span class="badge badge-warn">${e.visa}</span>`:`<span class="badge badge-visa">${e.visa}</span>`)):'<span style="color:var(--emp-text3)">—</span>';
        const el=e.visa_expiry?(dl<0?`<span style="color:var(--emp-danger);font-size:12px">${e.visa_expiry}（期限切れ）</span>`:(dl<90?`<span style="color:var(--emp-warn);font-size:12px">${e.visa_expiry}（残${dl}日）</span>`:`<span style="font-size:12px">${e.visa_expiry}</span>`)):'<span style="color:var(--emp-text3)">—</span>';
        const licExp=e.license_expiry?new Date(e.license_expiry):null,licDl=licExp?Math.round((licExp-today)/86400000):null;
        const ll=e.license_expiry?(licDl<0?`<span style="color:var(--emp-danger);font-size:12px">${e.license_expiry}（期限切れ）</span>`:(licDl<90?`<span style="color:var(--emp-warn);font-size:12px">${e.license_expiry}（残${licDl}日）</span>`:`<span style="font-size:12px">${e.license_expiry}</span>`)):'<span style="color:var(--emp-text3)">—</span>';
        const isExpired=(dl!==null&&dl<0)||(licDl!==null&&licDl<0);
        const isWarn=(dl!==null&&dl>=0&&dl<90)||(licDl!==null&&licDl>=0&&licDl<90);
        const rowBg=isExpired?'background:#fdf0f0':isWarn?'background:#fdf3e7':'';
        const companyBadge=e.company==='セレクト'?`<span class="badge badge-visa">セレクト</span>`:e.company==='覚善'?`<span class="badge badge-active">覚善</span>`:'<span style="color:var(--emp-text3)">—</span>';
        return`<tr style="${rowBg}">
          <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${e.id})">${emp_esc(e.sei)} ${emp_esc(e.mei)}<br><span style="font-size:11px;color:var(--emp-text2);font-weight:400">${emp_esc(e.seikana||'')} ${emp_esc(e.meikana||'')}</span></span>${e.shain_no&&!showCol('shain_no')?`<br><span style="font-size:11px;color:var(--emp-text3)">No. ${emp_esc(e.shain_no)}</span>`:''}</td>
          ${showCol('company')?`<td data-label="会社">${companyBadge}</td>`:''}
          ${showCol('shozoku1')?`<td data-label="所属1">${emp_esc(dept?.shozoku1||'—')}</td>`:''}
          ${showCol('shozoku2')?`<td data-label="所属2">${emp_esc(dept?.shozoku2||'—')}</td>`:''}
          ${showCol('koyou')?`<td data-label="雇用形態"><span class="chip">${emp_esc(e.koyou||'—')}</span></td>`:''}
          ${showCol('status')?`<td data-label="在籍"><span class="badge ${e.status==='在籍'?'badge-active':'badge-retired'}">${emp_esc(e.status||'—')}</span></td>`:''}
          ${showCol('visa')?`<td data-label="在留資格">${vb}</td>`:''}
          ${showCol('visa_expiry')?`<td data-label="在留期限">${el}</td>`:''}
          ${showCol('license_expiry')?`<td data-label="免許期限">${ll}</td>`:''}
          ${showCol('nyusha_date')?`<td data-label="入社日" style="font-size:12px">${emp_esc(e.nyusha_date||'—')}</td>`:''}
          ${showCol('shain_no')?`<td data-label="社員番号" style="font-size:12px;color:var(--emp-text2)">${emp_esc(e.shain_no||'—')}</td>`:''}
          ${showCol('updated_at')?`<td data-label="更新日" style="font-size:12px;color:var(--emp-text3)">${emp_esc(e.updated_at||'—')}</td>`:''}
          <td class="no-label" style="white-space:nowrap">
            <button class="btn btn-sm" onclick="editEmp(${e.id})">編集</button>
            <button class="btn btn-sm" onclick="generateCertificate(${e.id},'zaishoku')" style="margin-left:4px">在職証明</button>
            ${e.status==='退職'?`<button class="btn btn-sm" onclick="generateCertificate(${e.id},'taishoku')" style="margin-left:4px">退職証明</button>`:''}
            <button class="btn btn-sm" onclick="emp_openContractModal(${e.id})" style="margin-left:4px">契約書</button>
            ${e.status==='在籍'?`<button class="btn btn-sm btn-danger" onclick="retireEmp(${e.id})" style="margin-left:4px">退職処理</button>`:''}
          </td></tr>`;
      }).join('')}</tbody>
    </table></div>`}`;
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
  viewingId=id;currentView='detail';detailTab=tab||'basic';
  // currentFilteredListが空の場合は全員を対象に
  if(currentFilteredList.length===0)currentFilteredList=[...employees];
  render();
}
function setDetailTab(tab){
  detailTab=tab;
  document.querySelectorAll('.tab-list .itab').forEach(btn=>{
    const active=btn.dataset.tab===tab;
    btn.classList.toggle('active',active);
    if(active)btn.setAttribute('aria-current','page');
    else btn.removeAttribute('aria-current');
  });
  renderDT();
}
function editEmp(id){editingId=id;currentView='edit';render();setTimeout(()=>{const el=document.getElementById('page-jugyoin');if(el)el.scrollTop=0;},0);}

// ---- 詳細 ----
function renderDetail(id){
  const e=employees.find(x=>x.id===id);if(!e){currentView='list';render();return;}
  const today=new Date(),exp=e.visa_expiry?new Date(e.visa_expiry):null,dl=exp?Math.round((exp-today)/86400000):null;
  const tabs=['basic','visa','insurance','fuyou','yukyu','kenko','license','memo','dispatch','contract'];
  const labels=['基本情報','在留・外国人','保険','扶養','有給','健康診断','免許・資格','メモ','派遣契約','雇用契約書'];

  // 前へ・次へ
  const idx=currentFilteredList.findIndex(x=>x.id===id);
  const prevEmp=idx>0?currentFilteredList[idx-1]:null;
  const nextEmp=idx<currentFilteredList.length-1?currentFilteredList[idx+1]:null;

  document.getElementById('mainContent').innerHTML=`
    <div class="sticky-back">
      <button class="btn btn-sm" onclick="currentView='list';render()">← 一覧</button>
      <h2>${emp_esc(e.sei)} ${emp_esc(e.mei)}</h2>
      <span class="badge ${e.status==='在籍'?'badge-active':'badge-retired'}">${emp_esc(e.status||'—')}</span>
      ${dl!==null&&dl<90?`<span class="badge badge-warn">在留${dl<0?'期限切れ':'残'+dl+'日'}</span>`:''}
      <span style="font-size:12px;color:var(--emp-text3);margin-left:auto" class="hide-sp">最終更新: ${emp_esc(e.updated_at||'—')}</span>
      <button class="btn btn-sm" ${prevEmp?`onclick="viewDetail(${prevEmp.id})"`:'disabled'} style="${!prevEmp?'opacity:.4':''}">◀ 前へ</button>
      <span style="font-size:12px;color:var(--emp-text3)">${idx+1}/${currentFilteredList.length}</span>
      <button class="btn btn-sm" ${nextEmp?`onclick="viewDetail(${nextEmp.id})"`:'disabled'} style="${!nextEmp?'opacity:.4':''}">次へ ▶</button>
      <button class="btn btn-sm" onclick="generateCertificate(${e.id},'zaishoku')">在職証明</button>
      ${e.status==='退職'?`<button class="btn btn-sm" onclick="generateCertificate(${e.id},'taishoku')">退職証明</button>`:''}
      <button class="btn btn-sm" onclick="emp_openContractModal(${e.id})">雇用契約書</button>
      <button class="btn btn-sm hide-sp" style="background:var(--emp-info-light);color:var(--emp-info);border-color:var(--emp-info)" onclick="window.open('https://kakuzen2026.github.io/dispatch-kanri/','_blank')">派遣管理で確認 ↗</button>
      <button class="btn btn-sm" onclick="editEmp(${e.id})">編集</button>
    </div>
    <div class="tab-list">${tabs.map((t,i)=>`<button class="itab ${detailTab===t?'active':''}" data-tab="${t}" ${detailTab===t?'aria-current="page"':''} onclick="setDetailTab('${t}')">${labels[i]}</button>`).join('')}</div>
    <div id="dtc"></div>`;
  renderDT();
}

// ---- 警告一覧 ----
async function renderAlert(){
  const today=new Date();
  const todayStr=today.toISOString().slice(0,10);

  // 有給日数未設定の従業員
  const yukyuAlerts=employees.filter(e=>e.status==='在籍'&&calcYukyuInfo(e.id).unsetDays);

  // 雇用契約書アラート（契約書なし・期限切れ・15日以内）
  let dispatchContracts=[];
  try{dispatchContracts=await fetchDispatchContractEnds();}catch(e){}
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
        <button class="btn btn-sm" onclick="emp_openContractModal(${e.id})">契約書</button>
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
            <td class="no-label"><button class="btn btn-sm" onclick="emp_openContractModal(${e.id})">契約書作成</button></td>
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
        <div class="photo-upload" id="rcDetailDrop" style="margin-top:8px;min-height:60px;display:flex;align-items:center;justify-content:center" onclick="document.getElementById('rcDetailInput').click()">
          <input type="file" id="rcDetailInput" accept="image/*,application/pdf" style="display:none" onchange="addRcImg(${e.id},this)">
          ＋ クリックまたはドロップして追加（残${4-rcImgs.length}枚）
        </div>`:''}
      </div>`;
  } else if(detailTab==='insurance'){
    const deps=getFuyouList(e);
    const socialCnt=deps.filter(d=>d.social_fuyou).length;
    c.innerHTML=`<div class="section-title">雇用保険</div><div class="detail-grid">${df('被保険者番号',e.koyo_hoken_no)}${df('加入日',e.koyo_nyusha)}${df('喪失日',e.koyo_soshitsu)}</div><div class="section-title">社会保険</div><div class="detail-grid">${df('被保険者番号',e.shakai_hoken_no)}${df('加入日',e.shakai_nyusha)}${df('喪失日',e.shakai_soshitsu)}${df('社会保険扶養',socialCnt?socialCnt+'名':'なし')}</div><div style="margin-top:12px"><button class="btn btn-sm" onclick="setDetailTab('fuyou')">扶養情報を登録・確認</button></div>`;
  } else if(detailTab==='fuyou'){
    c.innerHTML=renderFuyouEditor(e);
  } else if(detailTab==='yukyu'){
    const recs=yukyuRecords.filter(r=>r.employee_id===e.id).sort((a,b)=>b.use_date.localeCompare(a.use_date));
    const grants=yukyuGrants.filter(g=>g.employee_id===e.id).sort((a,b)=>b.grant_date.localeCompare(a.grant_date));
    const info=calcYukyuInfo(e.id);

    // 勤続年数計算（次回付与日時点）
    const startDate=e.kousoku_start_date||e.nyusha_date||null;
    let nensuStr='—';
    if(startDate&&info.nextDate){
      const s=new Date(startDate),n=new Date(info.nextDate);
      let years=n.getFullYear()-s.getFullYear();
      let months=n.getMonth()-s.getMonth();
      if(n.getDate()<s.getDate())months--;
      if(months<0){years--;months+=12;}
      nensuStr=`${years}年${months}ヶ月`;
    }

    c.innerHTML=`
      <div class="summary-grid" style="margin-bottom:16px">
        <div class="scard"><div class="scard-label">残日数</div><div class="scard-val" style="color:#1a5c30">${info.remaining}日</div></div>
        <div class="scard"><div class="scard-label">付与合計（2年以内）</div><div class="scard-val">${info.granted}日</div></div>
        <div class="scard"><div class="scard-label">取得合計</div><div class="scard-val">${info.used}日</div></div>
        <div class="scard"><div class="scard-label">次回付与日</div><div class="scard-val" style="font-size:14px;padding-top:4px">${info.nextDate||'—'}</div></div>
        <div class="scard"><div class="scard-label">次回付与日時点の勤続年数</div><div class="scard-val" style="font-size:16px;padding-top:4px">${nensuStr}</div></div>
      </div>

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
        </div>
        ${!e.kousoku_start_date?`<div style="font-size:12px;color:var(--emp-text3)">→ 本人の入社日（${e.nyusha_date||'未登録'}）で計算します</div>`:''}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <span style="font-size:13px;font-weight:500">付与・取得履歴</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="openGrantModal(${e.id})">＋ 付与を登録</button>
          <button class="btn btn-primary btn-sm" onclick="openYukyuFromDetail(${e.id})">＋ 有給を登録</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${(()=>{
          const timeline=[
            ...grants.map(g=>({type:'grant',date:g.grant_date||'',data:g})),
            ...recs.map(r=>({type:'use',date:r.use_date||'',data:r})),
          ].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
          if(timeline.length===0)return '<div class="empty">履歴がありません</div>';
          return timeline.map(item=>{
            if(item.type==='grant'){
              const g=item.data;
              const warn=(!g.days&&g.days!==0);
              return `<div class="list-item" style="background:var(--emp-accent-light);border-color:var(--emp-accent)${warn?';background:var(--emp-warn-light);border-color:#f5d9a8':''}">
                <span class="dt">${g.grant_date||'—'}</span>
                <span class="badge badge-active">付与</span>
                <span style="font-weight:500">${warn?'<span style="color:var(--emp-warn)">⚠ 日数未設定</span>':`＋${g.days}日`}</span>
                ${g.expire_date?`<span style="font-size:12px;color:var(--emp-text2)">期限：${g.expire_date}</span>`:''}
                <div style="margin-left:auto;display:flex;gap:4px">
                  <button class="btn btn-sm" onclick="openGrantModal(${e.id},${g.id})">編集</button>
                  <button class="btn btn-sm btn-danger" onclick="delGrant(${g.id},${e.id})">削除</button>
                </div>
              </div>`;
            } else {
              const r=item.data;
              return `<div class="list-item">
                <span class="dt">${r.use_date||'—'}</span>
                <span class="badge badge-visa">取得</span>
                <span class="chip">${r.use_type||'—'}</span>
                <span class="chip">${r.shubetsu||'—'}</span>
                <span class="chip">${r.kubun||'—'}</span>
                <span style="font-size:12px;color:var(--emp-text2)">入力：${r.input_by||'—'}</span>
                ${r.biko?`<span style="font-size:12px;color:var(--emp-text2)">備考：${r.biko}</span>`:''}
                <button class="btn btn-sm btn-danger" style="margin-left:auto" onclick="delYR(${r.id})">削除</button>
              </div>`;
            }
          }).join('');
        })()}
      </div>`;
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
        <div><label style="font-size:12px;color:var(--emp-text2)">写真</label><br><label class="btn btn-sm" style="cursor:pointer;display:inline-block;margin-top:4px">添付<input type="file" accept="image/*,application/pdf" id="kimg" style="display:none" onchange="previewKI(this)"></label> <span id="kimgName" style="font-size:12px;color:var(--emp-text2)"></span></div>
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
        <div class="photo-upload" id="licDetailDrop" style="margin-top:8px;min-height:60px;display:flex;align-items:center;justify-content:center" onclick="document.getElementById('licDetailInput').click()">
          <input type="file" id="licDetailInput" accept="image/*,application/pdf" style="display:none" onchange="addLicImg(${e.id},this)">
          ＋ クリックまたはドロップして追加（残${4-licImgs.length}枚）
        </div>`:''}
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
        <div><label style="font-size:12px;color:var(--emp-text2)">写真</label><br><label class="btn btn-sm" style="cursor:pointer;display:inline-block;margin-top:4px">添付<input type="file" accept="image/*" id="sk_img" style="display:none" onchange="previewSkImg(this)"></label> <span id="skImgName" style="font-size:12px;color:var(--emp-text2)"></span></div>
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
          html+='<button class="btn btn-sm" onclick="emp_openContractModal('+e.id+')">再発行</button>';
          html+='</div>';
        });
        html+='</div>';
      }
      c.innerHTML=html;
    }
  }
    if(document.getElementById('rcDetailDrop'))setupDrop('rcDetailDrop',(d)=>addRcImgDrop(e.id,d));
    if(document.getElementById('licDetailDrop'))setupDrop('licDetailDrop',(d)=>addLicImgDrop(e.id,d));
}
function df(label,val,full){
  return`<div class="detail-field" ${full?'style="grid-column:1/-1"':''}><div class="detail-label">${emp_esc(label)}</div><div class="detail-val">${val?emp_esc(val):'<span style="color:var(--emp-text3)">—</span>'}</div></div>`;
}
function renderFuyouEditor(e){
  const deps=getFuyouList(e);
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
function collectFuyouRows(){
  return[...document.querySelectorAll('.fuyou-row')].map(row=>({
    name:row.querySelector('.fy-name')?.value.trim()||'',
    relation:row.querySelector('.fy-relation')?.value.trim()||'',
    birthday:row.querySelector('.fy-birthday')?.value||'',
    tax_fuyou:row.querySelector('.fy-tax')?.checked||false,
    social_fuyou:row.querySelector('.fy-social')?.checked||false,
    certified_date:row.querySelector('.fy-certified')?.value||'',
    lost_date:row.querySelector('.fy-lost')?.value||'',
    note:row.querySelector('.fy-note')?.value.trim()||'',
  })).filter(d=>d.name||d.relation||d.birthday||d.tax_fuyou||d.social_fuyou);
}
function addFuyouRow(){
  const e=employees.find(x=>x.id===viewingId);if(!e)return;
  const rows=collectFuyouRows();rows.push({name:'',relation:'',birthday:'',tax_fuyou:false,social_fuyou:false,certified_date:'',lost_date:'',note:''});
  e.memo=memoWithFuyouMeta(e.memo,rows);
  document.getElementById('dtc').innerHTML=renderFuyouEditor(e);
}
function removeFuyouRow(idx){
  const e=employees.find(x=>x.id===viewingId);if(!e)return;
  const rows=collectFuyouRows();rows.splice(idx,1);
  e.memo=memoWithFuyouMeta(e.memo,rows);
  document.getElementById('dtc').innerHTML=renderFuyouEditor(e);
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
  e.memo=memoWithFuyouMeta(document.getElementById('memoText').value,getFuyouList(e));e.updated_at=new Date().toISOString().slice(0,10);
  await updateEmployeeMemo(id,e.memo,e.updated_at);showToast('保存しました');
}

