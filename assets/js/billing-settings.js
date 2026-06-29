// ===== BILLING =====
function initBillingMonths(){
  const sel=document.getElementById('billing-month-filter');sel.innerHTML='';const now=new Date();
  for(let i=-2;i<=3;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);const v=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const opt=document.createElement('option');opt.value=v;opt.textContent=`${d.getFullYear()}年${d.getMonth()+1}月`;if(i===0)opt.selected=true;sel.appendChild(opt);}
}
async function loadBilling(){
  const m=document.getElementById('billing-month-filter').value;
  const {data}=await db.from('billing').select('*,clients(name)').gte('billing_month',m+'-01').lte('billing_month',m+'-31').order('created_at');
  ST.billing=data||[];
  const el=document.getElementById('billing-table');
  if(!ST.billing.length){el.innerHTML='<div class="empty-state"><div class="icon">💴</div><p>この月の請求がありません</p></div>';return;}
  const total=ST.billing.reduce((s,b)=>s+(b.amount||0),0);
  el.innerHTML=`<table><thead><tr><th>取引先</th><th>対象月</th><th>金額</th><th>状態</th><th>備考</th><th>操作</th></tr></thead><tbody>
    ${ST.billing.map(b=>`<tr>
      <td data-label="取引先"><strong>${esc(b.clients?.name||'—')}</strong></td>
      <td data-label="対象月">${esc(b.billing_month?.substring(0,7)||'—')}</td>
      <td data-label="金額" style="font-family:'DM Mono',monospace;">${(b.amount||0).toLocaleString('ja-JP')}円</td>
      <td data-label="状態">${b.is_billed?'<span class="badge badge-green">請求済み</span>':'<span class="badge badge-yellow">未請求</span>'}</td>
      <td data-label="備考">${esc(b.notes||'—')}</td>
      <td class="no-label" style="display:flex;gap:6px;">
        <button class="btn btn-secondary btn-sm" onclick="openBillingModalById('${esc(b.id)}')">編集</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBilling('${esc(b.id)}')">削除</button>
      </td></tr>`).join('')}
    <tr style="background:rgba(59,130,246,.05);"><td colspan="2"><strong>合計</strong></td><td colspan="4" style="font-family:'DM Mono',monospace;font-weight:700;color:var(--accent2);">${total.toLocaleString('ja-JP')}円</td></tr>
    </tbody></table>`;
}
async function openBillingModalById(id){
  const b=ST.billing.find(x=>x.id===id);
  await openBillingModal(b);
}
async function openBillingModal(b){
  document.getElementById('mb-title').textContent=b?'請求を編集':'請求を記録';
  document.getElementById('b-id').value=b?.id||'';document.getElementById('b-amount').value=b?.amount||'';
  document.getElementById('b-billed').value=b?.is_billed?'true':'false';document.getElementById('b-notes').value=b?.notes||'';
  if(b?.billing_month) document.getElementById('b-month').value=b.billing_month.substring(0,7);
  else{const n=new Date();document.getElementById('b-month').value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;}
  const {data:cl}=await db.from('clients').select('id,name').order('name');
  document.getElementById('b-client-id').innerHTML=(cl||[]).map(c=>`<option value="${c.id}" ${c.id===b?.client_id?'selected':''}>${c.name}</option>`).join('');
  openModal('modal-billing');
}
async function saveBilling(){
  const id=document.getElementById('b-id').value;const m=document.getElementById('b-month').value;
  const p={client_id:document.getElementById('b-client-id').value,billing_month:m+'-01',amount:parseInt(document.getElementById('b-amount').value)||0,is_billed:document.getElementById('b-billed').value==='true',notes:document.getElementById('b-notes').value,updated_at:new Date().toISOString()};
  if(!p.client_id||!p.billing_month){toast('必須項目を入力してください','error');return;}
  const {error}=id?await db.from('billing').update(p).eq('id',id):await db.from('billing').insert(p);
  if(error){toast('保存に失敗しました','error');return;}
  toast(id?'請求を更新しました':'請求を記録しました','success');closeModal('modal-billing');loadBilling();
}
async function deleteBilling(id){
  const b=ST.billing.find(x=>x.id===id);
  const label=b?`請求 ${b.billing_month||''} / ${Number(b.amount||0).toLocaleString()}円`:'この請求';
  if(!confirmPermanentDelete(label))return;
  const {error}=await db.from('billing').delete().eq('id',id);
  if(error)toast('削除に失敗しました','error');else{toast('削除しました','success');loadBilling();}
}

// ===== SETTINGS =====
async function loadSettings(){
  const {data}=await db.from('settings').select('*').limit(1).maybeSingle();
  if(data){
    const m={'s-company-name':'company_name','s-ceo':'ceo_name','s-ceo-title':'ceo_title','s-address':'company_address','s-license':'license_number','s-office-number':'office_number',
      's-pay-cutoff':'pay_cutoff','s-pay-date':'pay_date','s-haken-mgr-dept':'haken_mgr_dept','s-haken-mgr-title':'haken_mgr_title','s-haken-mgr-name':'haken_mgr_name','s-haken-mgr-tel':'haken_mgr_tel',
      's-complaint-dept':'complaint_dept','s-complaint-title':'complaint_title','s-complaint-name':'complaint_name','s-complaint-tel':'complaint_tel'};
    Object.entries(m).forEach(([elId,key])=>document.getElementById(elId).value=data[key]||'');
  }
}
async function saveSettings(){
  const p={company_name:document.getElementById('s-company-name').value,ceo_name:document.getElementById('s-ceo').value,ceo_title:document.getElementById('s-ceo-title').value,company_address:document.getElementById('s-address').value,
    license_number:document.getElementById('s-license').value,office_number:document.getElementById('s-office-number').value,
    pay_cutoff:document.getElementById('s-pay-cutoff').value,pay_date:document.getElementById('s-pay-date').value,
    haken_mgr_dept:document.getElementById('s-haken-mgr-dept').value,haken_mgr_title:document.getElementById('s-haken-mgr-title').value,
    haken_mgr_name:document.getElementById('s-haken-mgr-name').value,haken_mgr_tel:document.getElementById('s-haken-mgr-tel').value,
    complaint_dept:document.getElementById('s-complaint-dept').value,complaint_title:document.getElementById('s-complaint-title').value,
    complaint_name:document.getElementById('s-complaint-name').value,complaint_tel:document.getElementById('s-complaint-tel').value,
    updated_at:new Date().toISOString()};
  const {data:ex}=await db.from('settings').select('id').limit(1).maybeSingle();
  const {error}=ex?await db.from('settings').update(p).eq('id',ex.id):await db.from('settings').insert(p);
  if(error)toast('保存に失敗しました','error');else toast('自社情報を保存しました','success');
}

// ===== HELPERS =====
function openModal(id){
  document.querySelectorAll('.modal-overlay.open').forEach(m=>{if(m.id!==id)m.classList.remove('open');});
  document.getElementById(id).classList.add('open');
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function toast(msg,type='success'){
  const el=document.createElement('div');el.className=`toast ${type}`;
  el.innerHTML=`${type==='success'?'✅':'❌'} ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(),3500);
}
// モーダル外クリックで閉じる（テキスト選択中は閉じない）
document.querySelectorAll('.modal-overlay').forEach(o=>{
  let mousedownOnOverlay=false;
  o.addEventListener('mousedown',e=>{mousedownOnOverlay=(e.target===o);});
  o.addEventListener('click',e=>{if(e.target===o&&mousedownOnOverlay)o.classList.remove('open');});
});
document.addEventListener('click',e=>{const dd=document.getElementById('ct-emp-dd');const wrap=dd?.closest('.emp-search-wrap');if(wrap&&!wrap.contains(e.target))dd.style.display='none';});


