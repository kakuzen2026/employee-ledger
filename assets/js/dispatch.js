function dashboardReadFailed(){
  for(const id of ['expiry-list','recent-contracts'])document.getElementById(id).innerHTML='<div role="alert">読み込みに失敗しました。<button class="btn btn-secondary" onclick="loadDashboard()">再読み込み</button></div>';
  for(const id of ['op-expiring','op-active-contracts','op-recent-contracts','op-active-staff'])document.getElementById(id).textContent='—';
}
let contractSaving=false,renewalSaving=false;
// ===== DASHBOARD =====
function updateDispatchFocusCards(metrics){
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  set('op-expiring', metrics.expiringCount);
  set('op-active-contracts', metrics.activeContracts);
  set('op-recent-contracts', metrics.recentContracts);
  set('op-active-staff', metrics.activeStaff);
}
async function loadDashboard(){
  const [c,s,ct,ce]=await Promise.allSettled([
    db.from('clients').select('id'),
    db.from('sites').select('id'),
    db.from('contracts').select('*').eq('status','active'),
    db.from('contract_employees').select('id').eq('is_active',true),
  ]);
  document.getElementById('s-clients').textContent=(c.status==='fulfilled'?(c.value.data||[]).length:'—');
  document.getElementById('s-sites').textContent=(s.status==='fulfilled'?(s.value.data||[]).length:'—');
  document.getElementById('s-contracts').textContent=(ct.status==='fulfilled'?(ct.value.data||[]).length:'—');
  document.getElementById('s-staff').textContent=(ce.status==='fulfilled'?(ce.value.data||[]).length:'—');
  if([c,s,ct,ce].some(result=>result.status==='rejected'||result.value.error)){
    ['s-clients','s-sites','s-contracts','s-staff','op-expiring','op-active-contracts','op-recent-contracts','op-active-staff'].forEach(id=>document.getElementById(id).textContent='—');
    document.getElementById('expiry-list').textContent='読み込みに失敗しました。画面を開き直してください。';
    document.getElementById('recent-contracts').textContent='読み込みに失敗しました。画面を開き直してください。';
    return;
  }
  const today=new Date();
  const activeContracts=ct.status==='fulfilled'?(ct.value.data||[]):[];
  const expiring=activeContracts.filter(x=>calendarDaysUntil(x.contract_end,today)<=60);
  const exEl=document.getElementById('expiry-list');
  if(!expiring.length){exEl.innerHTML='<div class="empty-state"><div class="icon">✅</div><p>期限が近い契約はありません</p></div>';}
  else{
    const sids=[...new Set(expiring.map(x=>x.site_id))];
    const readResult1=await db.from('sites').select('id,name,clients(name)').in('id',sids);if(reportReadFailure(readResult1.error)){dashboardReadFailed();return;}const sites=readResult1.data;
    const sm={};(sites||[]).forEach(s=>sm[s.id]=s);
    exEl.innerHTML=`<table><thead><tr><th>現場</th><th>取引先</th><th>終了日</th><th>残日数</th><th>操作</th></tr></thead><tbody>
      ${expiring.map(x=>{const si=sm[x.site_id];const d=calendarDaysUntil(x.contract_end,today);const cls=d<=14?'expiry-expired':'expiry-near';
        return`<tr>
          <td data-label="現場">${esc(si?.name||'—')}</td>
          <td data-label="取引先">${esc(si?.clients?.name||'—')}</td>
          <td data-label="終了日" class="${cls}">${esc(x.contract_end)}</td>
          <td data-label="残日数" class="${cls}">${d}日</td>
          <td class="no-label"><button class="btn btn-warning btn-sm" onclick="openRenewalModal('${esc(x.id)}')">🔄 更新</button></td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
  const readResult2=await db.from('contracts').select('*,sites(name,clients(name)),contract_employees(id,is_active)').order('created_at',{ascending:false}).limit(6);if(reportReadFailure(readResult2.error)){dashboardReadFailed();return;}const recent=readResult2.data;
  updateDispatchFocusCards({
    expiringCount:expiring.length,
    activeContracts:activeContracts.length,
    recentContracts:(recent||[]).length,
    activeStaff:ce.status==='fulfilled'?(ce.value.data||[]).length:'—'
  });
  const rcEl=document.getElementById('recent-contracts');
  if(!(recent||[]).length){rcEl.innerHTML='<div class="empty-state"><div class="icon">📄</div><p>契約がありません</p></div>';}
  else{
    rcEl.innerHTML=`<table><thead><tr><th>契約番号</th><th>現場</th><th>取引先</th><th>期間</th><th>スタッフ</th><th>状態</th></tr></thead><tbody>
      ${recent.map(x=>{const cnt=(x.contract_employees||[]).filter(e=>e.is_active).length;
        return`<tr>
          <td data-label="契約番号" style="font-family:'DM Mono',monospace;font-size:12px;">${esc(x.contract_no||'—')}</td>
          <td data-label="現場"><strong>${esc(x.sites?.name||'—')}</strong></td>
          <td data-label="取引先">${esc(x.sites?.clients?.name||'—')}</td>
          <td data-label="期間" style="font-family:'DM Mono',monospace;font-size:12px;">${esc(x.contract_start)}〜${esc(x.contract_end)}</td>
          <td data-label="人数"><span class="badge badge-blue">${cnt}名</span></td>
          <td data-label="状態">${stBadge(x.status,x.contract_end)}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
}
function stBadge(status,endDate){
  if(status==='ended') return'<span class="badge badge-gray">終了</span>';
  const d=calendarDaysUntil(endDate,new Date());
  if(d<0) return'<span class="badge badge-red">期限切れ</span>';
  if(d<=30) return'<span class="badge badge-yellow">期限間近</span>';
  return'<span class="badge badge-green">有効</span>';
}

// ===== CONTRACT NO =====
function contractNumberPrefix(){
  const now=new Date();
  return `KZ-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-`;
}

// ===== CLIENTS =====
async function loadClients(force=false){if(!force&&ST.clients.length){renderClients(ST.clients);return;}const readResult4=await db.from('clients').select('*').order('name');if(reportReadFailure(readResult4.error,"clients-table","loadClients(true)"))return;const data=readResult4.data;ST.clients=data||[];renderClients(ST.clients);}
function renderClients(list){
  const el=document.getElementById('clients-table');
  if(!list.length){el.innerHTML='<div class="empty-state"><div class="icon">🏢</div><p>取引先が登録されていません</p></div>';return;}
  el.innerHTML=`<table><thead><tr><th>企業名</th><th>担当者</th><th>電話番号</th><th>メール</th><th>操作</th></tr></thead><tbody>
    ${list.map(c=>{
      const name=esc(c.ceo||'');
      const title=esc(c.contact_person||'');
      let tantou='—';
      if(name&&title) tantou=`<span style="font-size:11px;color:var(--text3);">${title}</span><br>${name}`;
      else if(name) tantou=name;
      else if(title) tantou=title;
      return`<tr>
      <td data-label="企業名"><strong>${esc(c.name)}</strong></td>
      <td data-label="担当者">${tantou}</td>
      <td data-label="電話番号">${esc(c.contact_phone||'—')}</td>
      <td data-label="メール">${esc(c.contact_email||'—')}</td>
      <td class="no-label" style="display:flex;gap:6px;">
        <button class="btn btn-secondary btn-sm" onclick="openClientModalById('${esc(c.id)}')">編集</button>
        <button class="btn btn-danger btn-sm" onclick="deleteClient('${esc(c.id)}')">削除</button>
      </td></tr>`;
    }).join('')}</tbody></table>`;
}
function filterClients(){const q=document.getElementById('search-clients').value.toLowerCase();renderClients(ST.clients.filter(c=>c.name.toLowerCase().includes(q)));}
function openClientModalById(id){
  const c=ST.clients.find(x=>x.id===id);
  openClientModal(c);
}
function openClientModal(c){
  document.getElementById('mc-title').textContent=c?'取引先を編集':'取引先を登録';
  document.getElementById('c-id').value=c?.id||'';document.getElementById('c-name').value=c?.name||'';
  document.getElementById('c-address').value=c?.address||'';document.getElementById('c-ceo').value=c?.ceo||'';
  document.getElementById('c-contact-person').value=c?.contact_person||'';document.getElementById('c-contact-phone').value=c?.contact_phone||'';
  document.getElementById('c-contact-email').value=c?.contact_email||'';document.getElementById('c-notes').value=c?.notes||'';
  openModal('modal-client');
}
async function saveClient(){
  const id=document.getElementById('c-id').value;
  const p={name:document.getElementById('c-name').value,address:document.getElementById('c-address').value,
    ceo:document.getElementById('c-ceo').value,contact_person:document.getElementById('c-contact-person').value,
    contact_phone:document.getElementById('c-contact-phone').value,contact_email:document.getElementById('c-contact-email').value,
    notes:document.getElementById('c-notes').value,updated_at:new Date().toISOString()};
  if(!p.name){toast('企業名を入力してください','error');return;}
  const {error}=id?await db.from('clients').update(p).eq('id',id):await db.from('clients').insert(p);
  if(error){toast('保存に失敗：'+error.message,'error');return;}
  toast(id?'取引先を更新しました':'取引先を登録しました','success');
  closeModal('modal-client');loadClients(true);
}
async function deleteClient(id){
  if(!confirmPermanentDelete('この取引先'))return;
  const {error}=await db.from('clients').delete().eq('id',id);
  if(error)toast('削除に失敗しました','error');else{toast('削除しました','success');loadClients(true);}
}

// ===== SITES =====
async function loadSites(force=false){if(!force&&ST.sites.length){renderSites(ST.sites);return;}const readResult5=await db.from('sites').select('*,clients(name),work_patterns(*)').order('name');if(reportReadFailure(readResult5.error,"sites-table","loadSites(true)"))return;const data=readResult5.data;ST.sites=data||[];renderSites(ST.sites);}
function renderSites(list){
  const el=document.getElementById('sites-table');
  if(!list.length){el.innerHTML='<div class="empty-state"><div class="icon">📍</div><p>現場が登録されていません</p></div>';return;}
  el.innerHTML=`<table><thead><tr><th>現場名</th><th>取引先</th><th>職種</th><th>指揮命令者</th><th>就業パターン</th><th>操作</th></tr></thead><tbody>
    ${list.map(s=>{
      const ps=s.work_patterns||[];
      const ph=ps.length?ps.map(p=>`<div style="font-size:11px;">${esc(p.pattern_name)}：${esc(p.start_time?.substring(0,5))}〜${esc(p.end_time?.substring(0,5))}（休憩${esc(String(p.break_minutes))}分）</div>`).join(''):'<span style="color:var(--text3);font-size:11px;">未設定</span>';
      return`<tr>
        <td data-label="現場名"><strong>${esc(s.name)}</strong></td>
        <td data-label="取引先">${esc(s.clients?.name||'—')}</td>
        <td data-label="職種">${esc(s.job_type||'—')}</td>
        <td data-label="指揮命令者">${esc(s.supervisor||'—')}</td>
        <td data-label="就業時間">${ph}</td>
        <td class="no-label" style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" onclick="openSiteModalById('${esc(s.id)}')">編集</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSite('${esc(s.id)}')">削除</button>
        </td></tr>`;
    }).join('')}</tbody></table>`;
}
function filterSites(){const q=document.getElementById('search-sites').value.toLowerCase();renderSites(ST.sites.filter(s=>s.name.toLowerCase().includes(q)||(s.clients?.name||'').toLowerCase().includes(q)));}

async function openSiteModalById(id){
  const site=ST.sites.find(x=>x.id===id);
  await openSiteModal(site);
}
async function openSiteModal(site){
  document.getElementById('ms-title').textContent=site?'現場を編集':'現場を登録';
  const DEFAULT_SAFETY = `派遣先は、派遣労働者の安全衛生に関し、労働安全衛生法等関係法令を遵守し、必要な措置を講ずるものとする。
・就業場所の安全管理、衛生管理を適切に行うこと
・危険・有害業務に従事させる場合は、必要な安全衛生教育を実施すること
・健康診断の実施については労働安全衛生法の定めによる
・派遣労働者が労働災害等を被った場合は、直ちに派遣元に通知すること`;

  const DEFAULT_WELFARE = `派遣先は、派遣労働者が利用できる福利厚生施設（給食施設・休憩室・更衣室）について、派遣先の労働者と同等の利用を認めるものとする。`;

  const fields={
    's-id':'id','s-name':'name','s-address-site':'address',
    's-work-dept':'work_dept','s-work-tel':'work_tel',
    's-supervisor':'supervisor','s-cmd-dept':'cmd_dept','s-cmd-title':'cmd_title','s-cmd-tel':'cmd_tel',
    's-job-type':'job_type','s-org-unit':'organization_unit','s-unit-mgr-title':'unit_manager_title',
    's-client-mgr-dept':'client_mgr_dept','s-client-mgr-title':'client_mgr_title','s-client-mgr-name':'client_mgr_name','s-client-mgr-tel':'client_mgr_tel',
    's-complaint-client-dept':'complaint_client_dept','s-complaint-client-title':'complaint_client_title','s-complaint-client-name':'complaint_client_name','s-complaint-client-tel':'complaint_client_tel',
    's-complaint-haken-dept':'complaint_haken_dept','s-complaint-haken-title':'complaint_haken_title','s-complaint-haken-name':'complaint_haken_name','s-complaint-haken-tel':'complaint_haken_tel',
    's-haken-mgr-dept-site':'haken_mgr_dept','s-haken-mgr-title-site':'haken_mgr_title','s-haken-mgr-name-site':'haken_mgr_name','s-haken-mgr-tel-site':'haken_mgr_tel',
    's-job-detail':'job_detail','s-authority':'authority_detail','s-overtime':'overtime_rule','s-work-days':'work_days','s-holiday':'holiday',
    's-jissai-date':'jissai_shokuchoku_date','s-soshiki-date':'soshiki_shokuchoku_date',
    's-notes-site':'notes',
  };
  Object.entries(fields).forEach(([elId,key])=>{ document.getElementById(elId).value=site?.[key]||''; });
  document.getElementById('s-mukirogen').value=site?.mukirogen||'none';
  document.getElementById('s-kyotei').value=site?.kyotei||'yes';
  // 安全衛生・福祉：既存データがあればそれを表示、なければデフォルト文言
  document.getElementById('s-safety').value = site?.safety_content || DEFAULT_SAFETY;
  document.getElementById('s-welfare').value = site?.welfare_content || DEFAULT_WELFARE;
  wpList=[];
  if(site?.id){const readResult6=await db.from('work_patterns').select('*').eq('site_id',site.id).order('created_at');if(reportReadFailure(readResult6.error))return;const data=readResult6.data;wpList=(data||[]).map(p=>({...p}));}
  renderWP();
  const readResult7=await db.from('clients').select('id,name').order('name');if(reportReadFailure(readResult7.error))return;const clients=readResult7.data;
  document.getElementById('s-client-id').innerHTML=(clients||[]).map(c=>`<option value="${c.id}" ${c.id===site?.client_id?'selected':''}>${esc(c.name)}</option>`).join('');
  openModal('modal-site');
}

function renderWP(){
  const list=document.getElementById('wp-list');const emp=document.getElementById('wp-empty');
  if(!wpList.length){list.innerHTML='';emp.style.display='block';return;}
  emp.style.display='none';
  list.innerHTML=wpList.map((p,i)=>`
    <div class="wp-row">
      <div><div class="col-label">パターン名</div><input type="text" value="${esc(p.pattern_name||'')}" placeholder="例:通常・早番" onchange="wpList[${i}].pattern_name=this.value"></div>
      <div><div class="col-label">開始時刻</div><input type="time" value="${p.start_time?p.start_time.substring(0,5):''}" onchange="wpList[${i}].start_time=this.value"></div>
      <div><div class="col-label">終了時刻</div><input type="time" value="${p.end_time?p.end_time.substring(0,5):''}" onchange="wpList[${i}].end_time=this.value"></div>
      <div><div class="col-label">休憩（分）</div><input type="number" value="${esc(p.break_minutes??60)}" min="0" step="5" onchange="wpList[${i}].break_minutes=parseInt(this.value)||0"></div>
      <button class="wp-del" onclick="wpList.splice(${i},1);renderWP()">🗑</button>
    </div>`).join('');
}
function addWP(){wpList.push({pattern_name:'',start_time:'',end_time:'',break_minutes:60});renderWP();}

async function replacementOperations(table,field,value,rows){
  const existing=await firebaseRows(db.from(table).select('id').eq(field,value));
  return [...existing.map(row=>({table,id:row.id,remove:true})),
    ...rows.map(row=>({table,id:crypto.randomUUID(),data:{...row,[field]:value}}))];
}
async function contractOperations(id,record,staff){
  const site=await firebaseRows(db.from('sites').select('name,clients(name)').eq('id',record.site_id).single());
  const links=await replacementOperations('contract_employees','contract_id',id,staff.map(e=>({employee_id:e.employee_id??e.id,employment_type:e.employment_type||'fixed',is_active:true})));
  const mirror=await replacementOperations('dispatch_contracts','dispatch_app_contract_id',id,staff.map(e=>({employee_id:e.employee_id??e.id,contract_no:record.contract_no,contract_start:record.contract_start,contract_end:record.contract_end,site_name:site.name||'',client_name:site.clients?.name||''})));
  return [{table:'contracts',id,data:record},...links,...mirror];
}
async function saveSite(){
  const id=document.getElementById('s-id').value;
  const p={
    client_id:document.getElementById('s-client-id').value,
    name:document.getElementById('s-name').value,
    address:document.getElementById('s-address-site').value,
    work_dept:document.getElementById('s-work-dept').value,
    work_tel:document.getElementById('s-work-tel').value,
    mukirogen:document.getElementById('s-mukirogen').value,
    kyotei:document.getElementById('s-kyotei').value,
    supervisor:document.getElementById('s-supervisor').value,
    cmd_dept:document.getElementById('s-cmd-dept').value,
    cmd_title:document.getElementById('s-cmd-title').value,
    cmd_tel:document.getElementById('s-cmd-tel').value,
    job_type:document.getElementById('s-job-type').value,
    organization_unit:document.getElementById('s-org-unit').value,
    unit_manager_title:document.getElementById('s-unit-mgr-title').value,
    client_mgr_dept:document.getElementById('s-client-mgr-dept').value,
    client_mgr_title:document.getElementById('s-client-mgr-title').value,
    client_mgr_name:document.getElementById('s-client-mgr-name').value,
    client_mgr_tel:document.getElementById('s-client-mgr-tel').value,
    complaint_client_dept:document.getElementById('s-complaint-client-dept').value,
    complaint_client_title:document.getElementById('s-complaint-client-title').value,
    complaint_client_name:document.getElementById('s-complaint-client-name').value,
    complaint_client_tel:document.getElementById('s-complaint-client-tel').value,
    complaint_haken_dept:document.getElementById('s-complaint-haken-dept').value,
    complaint_haken_title:document.getElementById('s-complaint-haken-title').value,
    complaint_haken_name:document.getElementById('s-complaint-haken-name').value,
    complaint_haken_tel:document.getElementById('s-complaint-haken-tel').value,
    haken_mgr_dept:document.getElementById('s-haken-mgr-dept-site').value,
    haken_mgr_title:document.getElementById('s-haken-mgr-title-site').value,
    haken_mgr_name:document.getElementById('s-haken-mgr-name-site').value,
    haken_mgr_tel:document.getElementById('s-haken-mgr-tel-site').value,
    job_detail:document.getElementById('s-job-detail').value,
    authority_detail:document.getElementById('s-authority').value,
    overtime_rule:document.getElementById('s-overtime').value,
    work_days:document.getElementById('s-work-days').value,
    holiday:document.getElementById('s-holiday').value,
    jissai_shokuchoku_date:document.getElementById('s-jissai-date').value||null,
    soshiki_shokuchoku_date:document.getElementById('s-soshiki-date').value||null,
    safety_content:document.getElementById('s-safety').value,
    welfare_content:document.getElementById('s-welfare').value,
    notes:document.getElementById('s-notes-site').value,
    updated_at:new Date().toISOString(),
  };
  if(!p.name||!p.client_id){toast('必須項目を入力してください','error');return;}
  const sid=id||crypto.randomUUID();
  const valid=wpList.filter(x=>x.pattern_name&&x.start_time&&x.end_time);
  try{
    const children=await replacementOperations('work_patterns','site_id',sid,valid.map(x=>({pattern_name:x.pattern_name,start_time:x.start_time,end_time:x.end_time,break_minutes:x.break_minutes??60})));
    await db.atomicWrite([{table:'sites',id:sid,data:p},...children]);
  }catch(error){toast('現場を保存できませんでした：'+error.message,'error');return;}
  toast(id?'現場を更新しました':'現場を登録しました','success');
  closeModal('modal-site');loadSites(true);
}
async function deleteSite(id){
  if(!confirmPermanentDelete('この現場'))return;
  const {error}=await db.from('sites').delete().eq('id',id);
  if(error)toast('削除に失敗しました','error');else{toast('削除しました','success');loadSites(true);}
}

// ===== CONTRACTS =====
async function loadContracts(force=false){
  if(!force&&ST.contracts.length){renderContracts();return;}
  const readResult8=await db.from('contracts').select('*,sites(name,clients(name)),contract_employees(id,employee_id,employment_type,is_active)').order('contract_end',{ascending:true});if(reportReadFailure(readResult8.error,"contracts-table","loadContracts(true)"))return;const data=readResult8.data;
  ST.contracts=data||[];renderContracts();
}
function switchCtTab(tab,el){ST.ctTab=tab;document.querySelectorAll('#page-contracts .tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');renderContracts();}
function renderContracts(){
  let list=ST.contracts;const today=new Date();
  if(ST.ctTab==='active') list=list.filter(x=>x.status==='active'&&calendarDaysUntil(x.contract_end,today)>=0);
  else if(ST.ctTab==='expiring') list=list.filter(x=>{const d=calendarDaysUntil(x.contract_end,today);return x.status==='active'&&d>=0&&d<=30;});
  else if(ST.ctTab==='ended') list=list.filter(x=>x.status==='ended'||calendarDaysUntil(x.contract_end,today)<0);
  const el=document.getElementById('contracts-table');
  if(!list.length){el.innerHTML='<div class="empty-state"><div class="icon">📄</div><p>該当する契約がありません</p></div>';return;}
  el.innerHTML=`<table><thead><tr><th>契約番号</th><th>現場</th><th>取引先</th><th>期間</th><th>人数</th><th>状態</th><th>操作</th></tr></thead><tbody>
    ${list.map(x=>{
      const cnt=(x.contract_employees||[]).filter(e=>e.is_active).length;
      return`<tr>
        <td data-label="契約番号" style="font-family:'DM Mono',monospace;font-size:12px;">${esc(x.contract_no||'—')}</td>
        <td data-label="現場"><strong>${esc(x.sites?.name||'—')}</strong></td>
        <td data-label="取引先">${esc(x.sites?.clients?.name||'—')}</td>
        <td data-label="期間" style="font-family:'DM Mono',monospace;font-size:12px;">${esc(x.contract_start)}〜${esc(x.contract_end)}</td>
        <td data-label="人数"><span class="badge badge-blue">${cnt}名</span></td>
        <td data-label="状態">${stBadge(x.status,x.contract_end)}</td>
        <td class="no-label" style="display:flex;gap:4px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="openCtDetail('${esc(x.id)}')">詳細</button>
          <button class="btn btn-secondary btn-sm" onclick="openContractModal('${esc(x.id)}')">編集</button>
          <button class="btn btn-purple btn-sm" onclick="openDocsModal('${esc(x.id)}')">📄 書類</button>
          ${x.status==='active'?`<button class="btn btn-warning btn-sm" onclick="openRenewalModal('${esc(x.id)}')">🔄 更新</button>`:''}
          ${x.status==='active'?`<button class="btn btn-danger btn-sm" onclick="endContract('${esc(x.id)}')">終了</button>`:''}
          <button class="btn btn-danger btn-sm" onclick="deleteContract('${esc(x.id)}')">削除</button>
        </td></tr>`;
    }).join('')}</tbody></table>`;
}

async function openCtDetail(cid){
  const readResult9=await db.from('contracts').select('*,sites(name,address,job_type,supervisor,clients(name,address,contact_person)),contract_employees(*)').eq('id',cid).single();if(reportReadFailure(readResult9.error))return;const c=readResult9.data;
  if(!c)return;
  const empIds=(c.contract_employees||[]).map(e=>e.employee_id);
  let enames={};
  if(empIds.length){const readResult10=await db.from('employees').select('id,sei,mei').in('id',empIds);if(reportReadFailure(readResult10.error))return;const emps=readResult10.data;(emps||[]).forEach(e=>enames[e.id]=`${e.sei} ${e.mei}`);}
  document.getElementById('ctd-title').textContent=`契約詳細：${c.contract_no||c.sites?.name||''}`;
  document.getElementById('ctd-body').innerHTML=`
    <div class="ct-header">
      <div class="ct-item"><div class="ct-lbl">契約番号</div><div class="ct-val" style="font-family:'DM Mono',monospace;">${esc(c.contract_no||'—')}</div></div>
      <div class="ct-item"><div class="ct-lbl">取引先</div><div class="ct-val"><strong>${esc(c.sites?.clients?.name||'—')}</strong></div></div>
      <div class="ct-item"><div class="ct-lbl">現場</div><div class="ct-val"><strong>${esc(c.sites?.name||'—')}</strong></div></div>
      <div class="ct-item"><div class="ct-lbl">契約期間</div><div class="ct-val">${esc(c.contract_start)} 〜 ${esc(c.contract_end)}</div></div>
      <div class="ct-item"><div class="ct-lbl">状態</div><div class="ct-val">${stBadge(c.status,c.contract_end)}</div></div>
      <div class="ct-item"><div class="ct-lbl">更新回数</div><div class="ct-val">${c.renewal_count||0}回</div></div>
    </div>
    <h3 style="font-size:13px;font-weight:600;margin-bottom:12px;">配属スタッフ（${(c.contract_employees||[]).length}名）</h3>
    <div class="emp-card-grid">
      ${(c.contract_employees||[]).map(e=>`
        <div class="emp-card">
          <h4>👤 ${esc(enames[e.employee_id]||'（氏名取得中）')}</h4>
          <div style="font-size:12px;color:var(--text3);">雇用形態：<span style="color:var(--text);">${e.employment_type==='permanent'?'無期契約':'有期契約'}</span></div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px;font-family:'DM Mono',monospace;">従業員ID: ${e.employee_id}</div>
          <button class="btn btn-secondary btn-sm" style="margin-top:8px;width:100%;" onclick="navigate('jugyoin')" title="従業員管理台帳で確認">従業員台帳で確認</button>
        </div>`).join('')}
    </div>
    ${c.job_detail?`<div style="margin-top:8px;"><div style="font-size:11px;color:var(--text3);">業務内容</div><div style="font-size:13px;margin-top:4px;">${esc(c.job_detail)}</div></div>`:''}
    ${c.notes?`<div class="alert alert-info" style="margin-top:12px;">📝 ${esc(c.notes)}</div>`:''}`;
  document.getElementById('ctd-footer').innerHTML=`
    <button class="btn btn-secondary" onclick="closeModal('modal-ct-detail')">閉じる</button>
    <button class="btn btn-secondary" onclick="closeModal('modal-ct-detail');openContractModal('${esc(c.id)}')">✏️ 編集</button>
    <button class="btn btn-purple" onclick="closeModal('modal-ct-detail');openDocsModal('${esc(c.id)}')">📄 書類を生成</button>
    ${c.status==='active'?`<button class="btn btn-warning" onclick="closeModal('modal-ct-detail');openRenewalModal('${esc(c.id)}')">🔄 契約を更新</button>`:''}
    ${c.status==='active'?`<button class="btn btn-danger" onclick="closeModal('modal-ct-detail');endContract('${esc(c.id)}')">契約を終了</button>`:''}
    <button class="btn btn-danger" onclick="closeModal('modal-ct-detail');deleteContract('${esc(c.id)}')">🗑 削除</button>`;
  openModal('modal-ct-detail');
}

async function endContract(id){
  if(!confirm('この契約を終了しますか？\n元に戻せません。'))return;
  try{
    const current=await firebaseRows(db.from('contracts').select('*').eq('id',id).single());
    const staff=await firebaseRows(db.from('contract_employees').select('id').eq('contract_id',id));
    await db.atomicWrite([{table:'contracts',id,expectedRevision:current._revision??0,data:{status:'ended',updated_at:new Date().toISOString()}},...staff.map(row=>({table:'contract_employees',id:row.id,data:{is_active:false}}))]);
  }catch(error){toast('契約を終了できませんでした：'+error.message,'error');return;}
  toast('契約を終了しました','success');loadContracts(true);
}

async function deleteContract(id){
  if(!confirm('この契約を完全に削除します。\nスタッフの紐づけも全て削除され、復元できません。\n通常は「契約を終了」を使ってください。\n完全削除を続行しますか？'))return;
  try{
    const current=await firebaseRows(db.from('contracts').select('*').eq('id',id).single());
    const staff=await replacementOperations('contract_employees','contract_id',id,[]);
    const mirror=await replacementOperations('dispatch_contracts','dispatch_app_contract_id',id,[]);
    await db.atomicWrite([{table:'contracts',id,remove:true,expectedRevision:current._revision??0},...staff,...mirror]);
  }catch(error){toast('削除に失敗しました：'+error.message,'error');return;}
  toast('契約を削除しました','success');loadContracts(true);
}

// ===== EMPLOYEE SEARCH =====
async function searchCEmp(q){
  const dd=document.getElementById('ct-emp-dd');
  clearTimeout(empTimer);
  empTimer=setTimeout(async()=>{
    dd.innerHTML='<div style="padding:10px 12px;font-size:12px;color:var(--text3);">読み込み中...</div>';
    dd.style.display='block';
    if(!empCache){const readResult11=await db.from('employees').select('id,sei,mei,seikana,meikana,employment_type').order('sei').limit(200);if(reportReadFailure(readResult11.error,"ct-emp-dd","searchCEmp(document.getElementById('ct-emp-search').value)"))return;const data=readResult11.data;empCache=data||[];}
    const used=selEmps.map(e=>e.id);
    const filtered=(!q?empCache:empCache.filter(e=>(e.sei||'').toLowerCase().includes(q.toLowerCase())||(e.mei||'').toLowerCase().includes(q.toLowerCase())||(e.seikana||'').includes(q)||(e.meikana||'').includes(q))).filter(e=>!used.includes(e.id));
    if(!filtered.length){dd.innerHTML='<div style="padding:10px 12px;font-size:12px;color:var(--text3);">該当なし</div>';return;}
    dd.innerHTML=filtered.map(e=>{
      const name=`${esc(e.sei)} ${esc(e.mei)}`;const kana=`${esc(e.seikana||'')} ${esc(e.meikana||'')}`.trim();
      const etLabel=e.employment_type==='permanent'?'無期':'有期';
      const etColor=e.employment_type==='permanent'?'var(--success)':'var(--accent2)';
      const args=[Number(e.id),`${e.sei} ${e.mei}`,e.employment_type==='permanent'?'permanent':'fixed'];
      return`<div class="emp-option" onclick="${esc('addSelEmp('+args.map(v=>JSON.stringify(v)).join(',')+')')}">
        <div><div style="font-weight:500;">${name}</div>${kana?`<div style="font-size:11px;color:var(--text3);">${kana}</div>`:''}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;color:${etColor};font-weight:600;">${etLabel}</span>
          <span class="emp-id-label">ID:${e.id}</span>
        </div></div>`;}).join('');
  },q?150:0);
}
function addSelEmp(id,name,empType){
  if(selEmps.find(e=>e.id===id))return;
  selEmps.push({id,name,employment_type:empType||'fixed'});
  renderSelEmps();
  document.getElementById('ct-emp-dd').style.display='none';
  document.getElementById('ct-emp-search').value='';
}
function removeSelEmp(id){selEmps=selEmps.filter(e=>e.id!==id);renderSelEmps();}
function renderSelEmps(){
  const el=document.getElementById('sel-emp-list');
  if(!selEmps.length){el.innerHTML='';return;}
  el.innerHTML=selEmps.map(e=>{
    const etLabel=e.employment_type==='permanent'?'無期契約':'有期契約';
    const etColor=e.employment_type==='permanent'?'var(--success)':'var(--accent2)';
    return`<div class="sel-emp-item">
      <span class="sname">👤 ${esc(e.name)}</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;font-weight:600;color:${etColor};">${etLabel}</span>
        <span style="font-size:11px;color:var(--text3);">（従業員台帳から取得）</span>
        <button class="rm-btn" onclick="removeSelEmp(${e.id})">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function openContractModal(cid){
  let existing = null;
  if(cid){
    const readResult12=await db.from('contracts').select('*,contract_employees(*)').eq('id',cid).single();if(reportReadFailure(readResult12.error))return;const data=readResult12.data;
    existing=data;
  }

  document.getElementById('mct-title').textContent=existing?'契約を編集':'契約を作成';
  document.getElementById('ct-id').value=existing?.id||'';
  document.getElementById('ct-id').dataset.revision=String(existing?._revision??0);
  document.getElementById('ct-parent-id').value='';
  document.getElementById('ct-no').value=existing?.contract_no||'保存時に自動採番';
  document.getElementById('ct-start').value=existing?.contract_start||'';
  document.getElementById('ct-end').value=existing?.contract_end||'';
  document.getElementById('ct-contract-date').value=existing?.contract_date||'';
  document.getElementById('ct-ryokin').value=existing?.haken_ryokin||'';
  document.getElementById('ct-ryokin-tani').value=existing?.ryokin_tani||'';
  document.getElementById('ct-notes').value=existing?.notes||'';

  selEmps=[];empCache=null;
  if(existing?.contract_employees?.length){
    const empIds=existing.contract_employees.map(e=>e.employee_id);
    const readResult13=await db.from('employees').select('id,sei,mei,employment_type').in('id',empIds);if(reportReadFailure(readResult13.error))return;const emps=readResult13.data;
    const empMap={};(emps||[]).forEach(e=>empMap[e.id]=e);
    selEmps=existing.contract_employees.map(e=>{
      const emp=empMap[e.employee_id];
      return{
        id:e.employee_id,
        name:emp?`${emp.sei} ${emp.mei}`:`ID:${e.employee_id}`,
        employment_type:emp?.employment_type||e.employment_type||'fixed',
      };
    });
  }
  renderSelEmps();
  document.getElementById('ct-emp-dd').style.display='none';
  document.getElementById('ct-emp-search').value='';

  const readResult14=await db.from('sites').select('id,name,clients(name)').order('name');if(reportReadFailure(readResult14.error))return;const sites=readResult14.data;
  document.getElementById('ct-site-id').innerHTML=(sites||[]).map(s=>
    `<option value="${s.id}" ${s.id===existing?.site_id?'selected':''}>${esc(s.clients?.name||'')} / ${esc(s.name)}</option>`
  ).join('');

  openModal('modal-contract');
}

async function saveContract(){
  if(contractSaving)return;
  const id=document.getElementById('ct-id').value;
  if(!selEmps.length){toast('スタッフを1名以上選択してください','error');return;}
  const siteId=document.getElementById('ct-site-id').value;
  if(!siteId){toast('取引先 / 現場を選択してください','error');return;}

  // 現場から業務内容等を引き継ぐ
  const site=ST.sites.find(s=>s.id===siteId);
  const p={
    site_id:siteId,
    contract_no:id?document.getElementById('ct-no').value:'',
    contract_start:document.getElementById('ct-start').value,
    contract_end:document.getElementById('ct-end').value,
    contract_date:document.getElementById('ct-contract-date').value||null,
    haken_ryokin:document.getElementById('ct-ryokin').value,
    ryokin_tani:document.getElementById('ct-ryokin-tani').value,
    jissai_shokuchoku_date:site?.jissai_shokuchoku_date||null,
    soshiki_shokuchoku_date:site?.soshiki_shokuchoku_date||null,
    job_detail:site?.job_detail||'',
    authority_detail:site?.authority_detail||'',
    overtime_rule:site?.overtime_rule||'',
    work_days:site?.work_days||'',
    notes:document.getElementById('ct-notes').value,
    parent_contract_id:document.getElementById('ct-parent-id').value||null,
    status:'active',updated_at:new Date().toISOString(),
  };
  if(!p.contract_start||!p.contract_end){toast('契約期間を入力してください','error');return;}
  if(!normalizeDateStr(p.contract_start)||!normalizeDateStr(p.contract_end)||p.contract_end<p.contract_start){toast('終了日は開始日以降の日付を入力してください','error');return;}
  const cid=id||crypto.randomUUID();
  contractSaving=true;
  try{
    const operations=await contractOperations(cid,p,selEmps);
    if(id)operations[0].expectedRevision=Number(document.getElementById('ct-id').dataset.revision);
    else operations[0].data._revision=1;
    await db.atomicWrite(operations,id?{}:{contractId:cid,contractPrefix:contractNumberPrefix()});
  }
  catch(error){toast('契約を保存できませんでした：'+error.message,'error');return;}
  finally{contractSaving=false;}

  toast('契約を保存しました','success');closeModal('modal-contract');loadContracts(true);
}

// ===== RENEWAL =====
async function openRenewalModal(cid){
  const readResult15=await db.from('contracts').select('*,contract_employees(*),sites(name)').eq('id',cid).single();if(reportReadFailure(readResult15.error))return;const c=readResult15.data;
  document.getElementById('rn-contract-id').value=cid;
  document.getElementById('rn-start').value=c.contract_end;
  document.getElementById('rn-end').value='';
  const empIds=(c.contract_employees||[]).map(e=>e.employee_id);
  let enames={};
  if(empIds.length){const readResult16=await db.from('employees').select('id,sei,mei').in('id',empIds);if(reportReadFailure(readResult16.error))return;const emps=readResult16.data;(emps||[]).forEach(e=>enames[e.id]=`${e.sei} ${e.mei}`);}
  document.getElementById('rn-info').innerHTML=`<strong>現場：</strong>${esc(c.sites?.name||'—')}<br><span style="color:var(--text3);font-size:12px;">配属：${(c.contract_employees||[]).map(e=>esc(enames[e.employee_id]||`ID:${e.employee_id}`)).join('、')}</span>`;
  document.getElementById('rn-emp-opts').textContent='ここで更新するのは派遣契約です。雇用契約書は自動更新されません。従業員台帳の各スタッフの詳細から、内容を確認して別途更新してください。';
  openModal('modal-renewal');
}

async function execRenewal(){
  if(renewalSaving)return;
  const cid=document.getElementById('rn-contract-id').value;
  const ns=document.getElementById('rn-start').value;const ne=document.getElementById('rn-end').value;
  if(!ns||!ne){toast('新しい契約期間を入力してください','error');return;}
  if(!normalizeDateStr(ns)||!normalizeDateStr(ne)||ne<ns){toast('終了日は開始日以降の日付を入力してください','error');return;}
  renewalSaving=true;
  try{
    const orig=await firebaseRows(db.from('contracts').select('*,contract_employees(*)').eq('id',cid).single());
    const newNo='',newId=crypto.randomUUID();
    const record={_revision:1,site_id:orig.site_id,contract_no:newNo,contract_start:ns,contract_end:ne,
      contract_type:orig.contract_type||'',renewal_count:(orig.renewal_count||0)+1,
      parent_contract_id:cid,job_detail:orig.job_detail||'',authority_detail:orig.authority_detail||'',
      overtime_rule:orig.overtime_rule||'',work_days:orig.work_days||'',haken_ryokin:orig.haken_ryokin||'',
      ryokin_tani:orig.ryokin_tani||'',notes:orig.notes||'',status:'active',updated_at:new Date().toISOString()};
    const operations=await contractOperations(newId,record,orig.contract_employees||[]);
    operations.push({table:'contracts',id:cid,expectedRevision:orig._revision??0,data:{status:'ended',updated_at:new Date().toISOString()}});
    for(const staff of orig.contract_employees||[])operations.push({table:'contract_employees',id:staff.id,data:{is_active:false}});
    await db.atomicWrite(operations,{contractId:newId,contractPrefix:contractNumberPrefix()});
  }catch(error){toast('契約を更新できませんでした：'+error.message,'error');return;}
  finally{renewalSaving=false;}

  toast('契約を更新しました','success');closeModal('modal-renewal');loadContracts(true);
  if(ST.page==='dashboard') loadDashboard();
}
