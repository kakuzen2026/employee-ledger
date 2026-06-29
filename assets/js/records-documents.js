// ===== DOCS MODAL =====
// ===== RECORDS MANAGEMENT =====
async function loadRecords(){
  const [recRes, empRes, ctRes] = await Promise.all([
    db.from('employee_records').select('*').order('rec_date',{ascending:false}),
    db.from('employees').select('id,sei,mei').order('sei'),
    db.from('contracts').select('id,contract_no,sites(name,clients(name))').order('contract_no')
  ]);
  const records = recRes.data||[];
  const emps = empRes.data||[];
  const cts = ctRes.data||[];

  const empMap = {};
  emps.forEach(e=>empMap[e.id]=`${e.sei} ${e.mei}`);
  const ctMap = {};
  cts.forEach(c=>ctMap[c.id]=`${c.contract_no||'—'} ${c.sites?.clients?.name||''} / ${c.sites?.name||''}`);

  const typeLabel = {complaint:'苦情処理', training:'教育訓練', stability:'雇用安定措置'};
  const typeColor = {complaint:'var(--danger)', training:'var(--accent)', stability:'var(--success)'};

  document.getElementById('mainContent-records').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2 style="font-size:16px;font-weight:600;">記録管理</h2>
      <button class="btn btn-primary" onclick="openRecordModal()">＋ 記録を追加</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <select class="form-select" style="width:160px;" id="rec-filter-type" onchange="loadRecords()">
        <option value="">すべての種別</option>
        <option value="complaint">苦情処理</option>
        <option value="training">教育訓練</option>
        <option value="stability">雇用安定措置</option>
      </select>
      <select class="form-select" style="width:200px;" id="rec-filter-emp" onchange="loadRecords()">
        <option value="">すべての従業員</option>
        ${emps.map(e=>`<option value="${e.id}">${e.sei} ${e.mei}</option>`).join('')}
      </select>
    </div>
    <div id="rec-list">
      ${records.length===0?'<div style="text-align:center;color:var(--text3);padding:40px;">記録がありません</div>':''}
      ${records.map(r=>`
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span style="background:${typeColor[r.type]||'var(--accent)'};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${typeLabel[r.type]||r.type}</span>
              <span style="font-weight:600;font-size:13px;">${esc(empMap[r.employee_id]||`ID:${r.employee_id}`)}</span>
              ${r.contract_id?`<span style="font-size:11px;color:var(--text3);">📄 ${esc(ctMap[r.contract_id]||r.contract_id)}</span>`:''}
              ${r.rec_date?`<span style="font-size:11px;color:var(--text3);">${r.rec_date.substring(0,10)}</span>`:''}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="deleteEmployeeRecord('${r.id}')">削除</button>
          </div>
          <div style="margin-top:8px;font-size:12px;color:var(--text2);white-space:pre-wrap;">${esc(r.content||'')}</div>
          ${r.result?`<div style="margin-top:4px;font-size:12px;color:var(--text3);">処理結果：${esc(r.result)}</div>`:''}
        </div>
      `).join('')}
    </div>`;
}

function renderRecTypeFields(){
  const type = document.getElementById('rec-type').value;
  let html = '';
  if(type==='complaint'){
    html = `
      <div class="form-row">
        <div class="form-group"><label class="form-label">申出を受けた日</label><input type="date" class="form-input" id="rec-date"></div>
        <div class="form-group"></div>
      </div>
      <div class="form-group"><label class="form-label">苦情内容<span class="required">*</span></label><textarea class="form-textarea" id="rec-content" rows="3"></textarea></div>
      <div class="form-group"><label class="form-label">処理状況・結果</label><textarea class="form-textarea" id="rec-result" rows="3"></textarea></div>`;
  } else if(type==='training'){
    html = `
      <div class="form-row">
        <div class="form-group"><label class="form-label">実施日時</label><input type="datetime-local" class="form-input" id="rec-date"></div>
        <div class="form-group"></div>
      </div>
      <div class="form-group"><label class="form-label">教育訓練内容<span class="required">*</span></label><textarea class="form-textarea" id="rec-content" rows="4"></textarea></div>`;
  } else if(type==='stability'){
    html = `
      <div class="form-group"><label class="form-label">希望する雇用安定措置の内容</label><textarea class="form-textarea" id="rec-hope" rows="2"></textarea></div>
      <div class="form-section" style="margin-top:12px;">
        <div class="form-section-title">①派遣先への直接雇用の依頼</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">依頼日時・方法</label><input type="text" class="form-input" id="rec-direct-req"></div>
          <div class="form-group"><label class="form-label">派遣先の回答日時・内容</label><input type="text" class="form-input" id="rec-direct-ans"></div>
        </div>
      </div>
      <div class="form-group"><label class="form-label">②他の派遣先の紹介</label><textarea class="form-textarea" id="rec-other" rows="2"></textarea></div>
      <div class="form-group"><label class="form-label">③期間を定めない雇用の機会の確保</label><textarea class="form-textarea" id="rec-mukirogen" rows="2"></textarea></div>
      <div class="form-group"><label class="form-label">④その他</label><textarea class="form-textarea" id="rec-etc" rows="2"></textarea></div>`;
  }
  document.getElementById('rec-type-fields').innerHTML = html;
}

async function openRecordModal(record=null){
  document.getElementById('rec-id').value = record?.id||'';
  document.getElementById('rec-modal-title').textContent = record ? '📋 記録を編集' : '📋 記録を追加';
  // 従業員リスト
  const {data:emps}=await db.from('employees').select('id,sei,mei').order('sei');
  document.getElementById('rec-emp-id').innerHTML=(emps||[]).map(e=>`<option value="${e.id}" ${record?.employee_id===e.id?'selected':''}>${e.sei} ${e.mei}</option>`).join('');
  // 契約リスト
  const {data:cts}=await db.from('contracts').select('id,contract_no,sites(name,clients(name))').order('contract_no');
  document.getElementById('rec-contract-id').innerHTML=`<option value="">選択しない</option>`+(cts||[]).map(c=>`<option value="${c.id}" ${record?.contract_id===c.id?'selected':''}>${c.contract_no||'—'} ${c.sites?.clients?.name||''} / ${c.sites?.name||''}</option>`).join('');
  // 種別セット
  if(record) document.getElementById('rec-type').value=record.type;
  renderRecTypeFields();
  // 既存データ復元
  if(record){
    if(document.getElementById('rec-date')) document.getElementById('rec-date').value=record.rec_date||'';
    if(record.type==='stability'){
      try{const d=JSON.parse(record.content||'{}');
        document.getElementById('rec-hope').value=d.hope||'';
        document.getElementById('rec-direct-req').value=d.direct_req||'';
        document.getElementById('rec-direct-ans').value=d.direct_ans||'';
        document.getElementById('rec-other').value=d.other||'';
        document.getElementById('rec-mukirogen').value=d.mukirogen||'';
        document.getElementById('rec-etc').value=d.etc||'';
      }catch(e){}
    } else {
      if(document.getElementById('rec-content')) document.getElementById('rec-content').value=record.content||'';
      if(document.getElementById('rec-result')) document.getElementById('rec-result').value=record.result||'';
    }
  }
  openModal('modal-record-edit');
}

async function saveEmployeeRecord(){
  const id = document.getElementById('rec-id').value;
  const empId = document.getElementById('rec-emp-id').value;
  const contractId = document.getElementById('rec-contract-id').value||null;
  const type = document.getElementById('rec-type').value;
  if(!empId){toast('従業員を選択してください','error');return;}
  let p={employee_id:empId,contract_id:contractId,type,updated_at:new Date().toISOString()};
  if(type==='stability'){
    p.content=JSON.stringify({
      hope:document.getElementById('rec-hope')?.value||'',
      direct_req:document.getElementById('rec-direct-req')?.value||'',
      direct_ans:document.getElementById('rec-direct-ans')?.value||'',
      other:document.getElementById('rec-other')?.value||'',
      mukirogen:document.getElementById('rec-mukirogen')?.value||'',
      etc:document.getElementById('rec-etc')?.value||'',
    });
    p.rec_date=null;
  } else {
    const content=document.getElementById('rec-content')?.value||'';
    if(!content){toast('内容を入力してください','error');return;}
    p.content=content;
    p.result=document.getElementById('rec-result')?.value||'';
    p.rec_date=document.getElementById('rec-date')?.value||null;
  }
  const {error}=id
    ? await db.from('employee_records').update(p).eq('id',id)
    : await db.from('employee_records').insert(p);
  if(error){toast('保存に失敗しました','error');return;}
  toast('記録を保存しました','success');
  closeModal('modal-record-edit');
  loadRecords();
}

async function deleteEmployeeRecord(id){
  if(!confirmPermanentDelete('この稼働記録'))return;
  const {error}=await db.from('employee_records').delete().eq('id',id);
  if(error)toast('削除に失敗しました','error');
  else{toast('削除しました','success');loadRecords();}
}

async function openDocsModal(cid){
  const {data:c}=await db.from('contracts').select('*,sites(*,clients(*),work_patterns(*)),contract_employees(*)').eq('id',cid).single();
  if(!c)return;
  // work_patternsが取得できていない場合は別途取得
  if(c.sites?.id && (!c.sites.work_patterns || c.sites.work_patterns.length===0)){
    const {data:wp}=await db.from('work_patterns').select('*').eq('site_id',c.sites.id).order('created_at');
    c.sites.work_patterns=wp||[];
  }
  currentDocContract=c;
  const empIds=(c.contract_employees||[]).map(e=>e.employee_id);
  let empData={};
  if(empIds.length){const {data:emps}=await db.from('employees').select('*').in('id',empIds);(emps||[]).forEach(e=>empData[e.id]=e);}
  // 従業員ごとの記録を取得
  let recData={};
  if(empIds.length){
    const {data:recs}=await db.from('employee_records').select('*').in('employee_id',empIds).order('rec_date',{ascending:false});
    (recs||[]).forEach(r=>{
      if(!recData[r.employee_id])recData[r.employee_id]=[];
      recData[r.employee_id].push(r);
    });
  }
  currentDocContract._empData=empData;
  currentDocContract._recData=recData;
  document.getElementById('docs-title').textContent=`📄 書類を生成：${c.contract_no||c.sites?.name||''}`;
  document.getElementById('docs-contract-info').innerHTML=`
    <strong>${c.contract_no||'—'}</strong>　${c.sites?.clients?.name||'—'} / ${c.sites?.name||'—'}
    <span style="margin-left:12px;color:var(--text3);">${c.contract_start} 〜 ${c.contract_end}</span>
    <span class="badge badge-blue" style="margin-left:8px;">${(c.contract_employees||[]).length}名</span>`;
  document.getElementById('docs-site-btns').innerHTML=`
    <button class="doc-btn" onclick="genDoc('kobetsu')"><span class="doc-icon">📋</span><div class="doc-info"><div class="doc-title">個別契約書</div><div class="doc-sub">派遣法26条・現場単位</div></div></button>
    <button class="doc-btn" onclick="genDoc('motocho')"><span class="doc-icon">📁</span><div class="doc-info"><div class="doc-title">派遣元管理台帳</div><div class="doc-sub">派遣法37条・現場単位</div></div></button>`;
  // スタッフごとのボタン（雇用契約書兼就業条件明示書のみ）
  const empBtnsHtml=(c.contract_employees||[]).map(ce=>{
    const emp=empData[ce.employee_id];const name=emp?`${emp.sei} ${emp.mei}`:`ID:${ce.employee_id}`;
    const isFixed=ce.employment_type==='fixed';
    return`<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2);">👤 ${name}（${isFixed?'有期':'無期'}）</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="doc-btn btn-sm" style="padding:8px 12px;" onclick="genEmpDoc('koyo_joken','${ce.employee_id}')"><span class="doc-icon" style="font-size:16px;">📑</span><div class="doc-info"><div class="doc-title" style="font-size:12px;">雇用契約書兼就業条件明示書</div></div></button>
        <button class="doc-btn btn-sm" style="padding:8px 12px;" onclick="genEmpDoc('chicho','${ce.employee_id}')"><span class="doc-icon" style="font-size:16px;">📨</span><div class="doc-info"><div class="doc-title" style="font-size:12px;">派遣先通知書</div></div></button>
      </div></div>`;
  }).join('');
  document.getElementById('docs-emp-btns').innerHTML=empBtnsHtml;
  openModal('modal-docs');
}

// ===== DOCUMENT GENERATION =====
async function getSettingsData(){
  const {data}=await db.from('settings').select('*').limit(1).maybeSingle();
  return data||{};
}

function v(val,def=''){return val||def;}  // value or default

function toWareki(dateStr){
  if(!dateStr)return '';
  const d=new Date(dateStr);
  if(isNaN(d))return dateStr;
  const y=d.getFullYear(),m=d.getMonth()+1,day=d.getDate();
  let era,year;
  if(y>=2019||(y===2019&&m>=5)){era='令和';year=y-2018;}
  else if(y>=1989||(y===1989&&m>=1&&day>=8)){era='平成';year=y-1988;}
  else{era='昭和';year=y-1925;}
  return `${era}${year}年${m}月${day}日`;
}

function buildPlaceholders(c, emp, settings, recData={}){
  const site=c.sites||{};const client=site.clients||{};
  const wp=(site.work_patterns||[])[0]||{};
  const workStart=wp.start_time?wp.start_time.substring(0,5):'';
  const workEnd=wp.end_time?wp.end_time.substring(0,5):'';
  const breakMin=wp.break_minutes;
  const today=new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit'});
  // 有期スタッフが1人でもいるか判定
  const hasKiki=(c.contract_employees||[]).some(e=>e.employment_type!=='permanent');
  // 従業員の記録
  const empRecs=emp?(recData[emp.id]||[]):[];
  const complaints=empRecs.filter(r=>r.type==='complaint');
  const trainings=empRecs.filter(r=>r.type==='training');
  const stabilityRec=empRecs.find(r=>r.type==='stability');
  let stability={};
  try{if(stabilityRec)stability=JSON.parse(stabilityRec.content||'{}');}catch(e){}
  const complaintText=complaints.length?complaints.map(r=>`${r.rec_date?r.rec_date.substring(0,10)+' ':''}${r.content||''}${r.result?' → '+r.result:''}`).join('\n'):'';
  const trainingText=trainings.length?trainings.map(r=>`${r.rec_date?r.rec_date.substring(0,10)+' ':''}${r.content||''}`).join('\n'):'';
  return{
    CONTRACT_NO: v(c.contract_no),
    CONTRACT_DATE: v(c.contract_date) || today,
    CONTRACT_START: v(c.contract_start),
    CONTRACT_END: v(c.contract_end),
    DISPATCH_START: v(c.contract_start),
    DISPATCH_END: v(c.contract_end),
    WORK_DAYS: v(c.work_days),
    WORK_START: workStart,
    WORK_END: workEnd,
    BREAK_TIME: breakMin?`${breakMin}分`:'',
    JOB_DETAIL: v(c.job_detail),
    AUTHORITY_DETAIL: v(c.authority_detail),
    OVERTIME_RULE: v(c.overtime_rule),
    STAFF_COUNT: String((c.contract_employees||[]).filter(e=>e.is_active).length),
    HAKEN_RYOKIN: v(c.haken_ryokin),
    RYOKIN_TANI: v(c.ryokin_tani),
    JISSAI_SHOKUCHOKU_DATE: hasKiki ? v(c.jissai_shokuchoku_date) : null,
    SOSHIKI_SHOKUCHOKU_DATE: hasKiki ? v(c.soshiki_shokuchoku_date) : null,
    HAS_KIKI: hasKiki,
    // 現場
    CLIENT_SITE_NAME: v(site.name),
    CLIENT_SITE_ADDRESS: v(site.address),
    CLIENT_SITE_TEL: v(site.contact_phone,''),
    WORK_LOCATION_NAME: v(site.name),
    WORK_LOCATION_ADDRESS: v(site.address),
    WORK_LOCATION_DETAIL: v(site.address),
    WORK_DEPT: v(site.work_dept),WORK_TEL: v(site.work_tel),
    MUKIROGEN: site.mukirogen||'none',
    KYOTEI: site.kyotei||'yes',
    ORGANIZATION_UNIT: v(site.organization_unit),
    UNIT_MANAGER_TITLE: v(site.unit_manager_title),
    CMD_DEPT: v(site.cmd_dept),
    CMD_TITLE: v(site.cmd_title),
    CMD_NAME: v(site.supervisor),
    CMD_TEL: v(site.cmd_tel),
    CLIENT_MGR_DEPT: v(site.client_mgr_dept),
    CLIENT_MGR_TITLE: v(site.client_mgr_title),
    CLIENT_MGR_NAME: v(site.client_mgr_name),
    CLIENT_MGR_TEL: v(site.client_mgr_tel),
    COMPLAINT_CLIENT_DEPT: v(site.complaint_client_dept),
    COMPLAINT_CLIENT_TITLE: v(site.complaint_client_title),
    COMPLAINT_CLIENT_NAME: v(site.complaint_client_name),
    COMPLAINT_CLIENT_TEL: v(site.complaint_client_tel),
    SAFETY_CONTENT: v(site.safety_content),
    WELFARE_CONTENT: v(site.welfare_content),
    // 取引先
    CLIENT_NAME: v(client.name),
    CLIENT_ADDRESS: v(client.address),
    CLIENT_CEO: v(client.ceo),
    // 自社
    COMPANY_NAME: v(settings.company_name),
    COMPANY_ADDRESS: v(settings.company_address),
    COMPANY_CEO: v(settings.ceo_name),
    COMPANY_CEO_TITLE: v(settings.ceo_title),
    LICENSE_NO: v(settings.license_number),
    COMPANY_SITE_NAME: v(settings.company_name),
    HAKEN_MGR_DEPT: v(site.haken_mgr_dept||settings.haken_mgr_dept),
    HAKEN_MGR_TITLE: v(site.haken_mgr_title||settings.haken_mgr_title),
    HAKEN_MGR_NAME: v(site.haken_mgr_name||settings.haken_mgr_name),
    HAKEN_MGR_TEL: v(site.haken_mgr_tel||settings.haken_mgr_tel),
    COMPLAINT_HAKEN_DEPT: v(site.complaint_haken_dept||settings.complaint_dept),
    COMPLAINT_HAKEN_TITLE: v(site.complaint_haken_title||settings.complaint_title),
    COMPLAINT_HAKEN_NAME: v(site.complaint_haken_name||settings.complaint_name),
    COMPLAINT_HAKEN_TEL: v(site.complaint_haken_tel||settings.complaint_tel),
    PAY_CUTOFF: v(settings.pay_cutoff),
    PAY_DATE: v(settings.pay_date),
    // 従業員（empがある場合）
    EMPLOYEE_NAME: emp?`${emp.sei} ${emp.mei}`:'',
    BIRTH_DATE: emp?v(emp.birthday):'',
    EMPLOYEE_ADDRESS: emp?v(emp.address):'',
    HOURLY_WAGE: emp?v(emp.jikyu):'',
    MONTHLY_WAGE: emp?v(emp.kyuyo):'',
    KOYO_HOKEN_NO: emp?v(emp.koyo_hoken_no):'',
    KENPO_NO: emp?v(emp.shakai_hoken_no):'',
    KOSEI_NO: emp?v(emp.shakai_hoken_no):'',
    // 社会保険有無：加入日または被保険者番号があれば「有」
    KENPO_ARI: emp?(emp.shakai_nyusha||emp.shakai_hoken_no?'有':'無'):'',
    KOSEI_ARI: emp?(emp.shakai_nyusha||emp.shakai_hoken_no?'有':'無'):'',
    KOYO_ARI:  emp?(emp.koyo_nyusha||emp.koyo_hoken_no?'有':'無'):'',
    AGREEMENT_END_DATE:'',RENEWAL_LIMIT:'',HOLIDAY:v(site.holiday),
    OVERTIME_LIMIT:'45',OVERTIME_YEAR:'360',
    SPECIAL_DISPATCH_CONTENT:'該当なし',
    INTRO_DISPATCH:'',
    COMPLAINT_DATE:'',COMPLAINT_CONTENT:'',COMPLAINT_RESULT:'',NOTIFY_DATE:'',
    EDU_DATE:'',EDU_CONTENT:'',CAREER_DATE:'',CAREER_CONTENT:'',
    ANTEI_DATE:'',ANTEI_HOPE:'',ANTEI_MEASURE:'',
    KENPO_DATE:'',KOSEI_DATE:'',KOYO_DATE:'',
    KENPO_REASON:'',KOSEI_REASON:'',KOYO_REASON:'',
    HOLIDAY_WORK_DAYS:'',JOB_RANGE:'会社の定める業務全般',WORK_LOCATION_RANGE:'会社の定める事業所',
    RAISE_CRITERIA:'',RETIREMENT_PAY_CRITERIA:'',BONUS_CRITERIA:'',NOTICE_DAYS:'14',
    RETIREMENT_AGE:'',ALLOWANCE:'なし',REMARKS:'',
    // 記録データ
    COMPLAINT_TEXT: complaintText,
    TRAINING_TEXT: trainingText,
    STABILITY_HOPE: stability.hope||'',
    STABILITY_DIRECT_REQ: stability.direct_req||'',
    STABILITY_DIRECT_ANS: stability.direct_ans||'',
    STABILITY_OTHER: stability.other||'',
    STABILITY_MUKIROGEN: stability.mukirogen||'',
    STABILITY_ETC: stability.etc||'',
  };
}

function replacePlaceholders(text, ph){
  let result=text;
  Object.entries(ph).forEach(([k,v])=>{result=result.replaceAll(`【${k}】`,v||`【${k}】`);});
  return result;
}

// テンプレートテキストからdocxを生成（外部ライブラリ不要）
async function createSimpleDocx(title, bodyText, filename){
  // 後方互換：PDF生成にリダイレクト（呼ばれることはないが念のため残す）
  openPdfWindow(title, `<pre style="font-family:'MS Mincho',serif;font-size:12px;line-height:1.8;white-space:pre-wrap;">${esc(bodyText)}</pre>`, filename);
}

// ===== HTML → PDF印刷 =====
function openPdfWindow(title, bodyHtml, filename){
  const css = `
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'MS Mincho','Yu Mincho','Hiragino Mincho ProN',serif;font-size:9.5pt;line-height:1.7;color:#000;background:#fff;padding:12mm 15mm;}
    h1{font-size:14pt;font-weight:bold;text-align:center;letter-spacing:4px;margin:0 0 6mm;}
    h2{font-size:10pt;font-weight:bold;background:#f0f0f0;border:1px solid #999;padding:2px 6px;margin:4mm 0 2mm;}
    h3{font-size:9.5pt;font-weight:bold;border-left:3px solid #333;padding-left:6px;margin:3mm 0 2mm;}
    table{width:100%;border-collapse:collapse;margin:1.5mm 0;}
    th,td{border:1px solid #999;padding:3px 6px;font-size:9pt;vertical-align:top;}
    th{background:#f5f5f5;font-weight:bold;white-space:nowrap;width:32%;}
    td{width:68%;word-break:break-all;}
    .meta{text-align:right;font-size:8.5pt;margin-bottom:4mm;color:#333;}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:3mm 0 4mm;}
    .party{border:1px solid #999;padding:3px 6px;}
    .party-label{font-weight:bold;border-bottom:1px solid #999;margin-bottom:2px;padding-bottom:2px;font-size:8.5pt;}
    .party-body{font-size:8.5pt;line-height:1.6;}
    .sign-area{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:6mm;}
    .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:6mm;}
    .sign-box{border:1px solid #999;padding:4px 8px;min-height:20mm;font-size:8.5pt;line-height:1.6;}
    .sign-label{font-size:8.5pt;color:#555;margin-bottom:3px;border-bottom:1px solid #ddd;padding-bottom:2px;}
    .sign-line{margin-top:6mm;border-bottom:1px solid #333;width:80%;}
    .note{font-size:8pt;color:#555;margin-top:4mm;line-height:1.5;border-top:1px solid #ccc;padding-top:3mm;}
    .stamp{display:inline-block;width:12mm;height:12mm;border:2px solid #c00;border-radius:50%;text-align:center;line-height:12mm;color:#c00;font-size:8pt;vertical-align:middle;margin-left:3px;}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:3mm;}
    .section{margin:3mm 0;}
    @media print{
      body{padding:8mm 12mm;font-size:9pt;}
      @page{size:A4;margin:8mm 12mm;}
      tr{page-break-inside:avoid;break-inside:avoid;}
      td,th{page-break-inside:avoid;break-inside:avoid;}
      table{page-break-inside:auto;border-collapse:collapse;}
      h2{page-break-after:avoid;break-after:avoid;}
      .sign-area,.sign-grid{page-break-inside:avoid;break-inside:avoid;}
      .section{page-break-inside:avoid;break-inside:avoid;}
    }
  `;
  const w = window.open('','_blank','width=900,height=1100');
  if(!w){toast('ポップアップがブロックされました。ブラウザの設定でこのサイトのポップアップを許可してください。','error');return;}
  w.document.write(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${css}</style></head><body>${bodyHtml}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  w.document.close();
}

function e(val){ return val ? String(val).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
function row(label, val){ return `<tr><th>${e(label)}</th><td>${e(val)||'&nbsp;'}</td></tr>`; }
function row2(l1,v1,l2,v2){ return `<tr><th>${e(l1)}</th><td>${e(v1)||'&nbsp;'}</td><th>${e(l2)}</th><td>${e(v2)||'&nbsp;'}</td></tr>`; }

// ===== HTML テンプレート生成関数 =====
function buildKobetsuHtml(ph){
  const S='border:1px solid #666;padding:2px 5px;font-size:8.5pt;line-height:1.55;vertical-align:top;';
  const L=S+'background:#f0f0f0;font-weight:bold;white-space:nowrap;';
  const V=S;
  const labelStyle = S+'background:#f0f0f0;font-weight:bold;white-space:nowrap;width:26%;';
  const valStyle = S+'width:74%;';
  const tbl = (rows) => `<table style="width:100%;border-collapse:collapse;margin:0;">${rows}</table>`;
  const r = (label, val) => `<tr><td style="${labelStyle}">${label}</td><td style="${valStyle}">${val||'　'}</td></tr>`;
  const r2 = (l1,v1,l2,v2) => `<tr><td style="${L};width:18%;">${l1}</td><td style="${V};width:32%;">${v1||'　'}</td><td style="${L};width:18%;">${l2}</td><td style="${V};width:32%;">${v2||'　'}</td></tr>`;
  const secHead = (title) => `<div style="background:#e8e8e8;border:1px solid #666;border-bottom:none;padding:1px 5px;font-size:8.5pt;font-weight:bold;">■ ${title}</div>`;
  const secStart = () => `<div style="page-break-inside:avoid;break-inside:avoid;margin-top:2mm;">`;
  const secEnd = () => `</div>`;

  return `
<style>
  body{font-family:'MS Mincho','Yu Mincho','Hiragino Mincho ProN',serif;font-size:8.5pt;line-height:1.55;color:#000;background:#fff;padding:6mm 10mm;}
  h1{font-size:13pt;font-weight:bold;text-align:center;letter-spacing:5px;margin:0 0 2mm;}
  .meta{font-size:8pt;margin-bottom:1mm;}
  .intro{font-size:8.5pt;margin:1mm 0 2mm;line-height:1.6;}
  .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:3mm;}
  .sign-box{border:1px solid #666;padding:2px 6px;min-height:14mm;font-size:8pt;line-height:1.6;}
  .sign-label{font-weight:bold;border-bottom:1px solid #999;padding-bottom:1px;margin-bottom:1px;font-size:8pt;}
  @media print{
    body{padding:6mm 10mm;}
    @page{size:A4;margin:6mm 10mm;}
  }
</style>

<div class="meta" style="text-align:right;">契約No.${e(ph.CONTRACT_NO)}　　${ph.CONTRACT_DATE ? toWareki(ph.CONTRACT_DATE) : '令和　　年　　月　　日'}</div>
<h1>労 働 者 派 遣 個 別 契 約 書</h1>
<div class="intro">${e(ph.COMPANY_NAME)}（派遣元）は、${e(ph.CLIENT_NAME)}（派遣先）に対し、次の条件のもとに、労働者派遣を行うものとする。</div>

${secStart()}
${secHead('派遣先事業所 / 就業場所')}
${tbl(`
  ${r('派遣先事業所', e(ph.CLIENT_SITE_NAME)+'　'+e(ph.CLIENT_SITE_ADDRESS))}
  ${r('就業場所', e(ph.WORK_LOCATION_NAME)+'　'+e(ph.WORK_LOCATION_ADDRESS)+(ph.WORK_DEPT?'（部署）'+e(ph.WORK_DEPT):'')+(ph.WORK_TEL?'（電話）'+e(ph.WORK_TEL):''))}
`)}
${secEnd()}

${secStart()}
${secHead('限定区分 / 協定対象 / 派遣人員')}
${tbl(`
  ${r('無期雇用・60歳以上限定', (ph.MUKIROGEN==='mukirogen'?'☑':'□')+' 無期雇用又は60歳以上に限定　'+(ph.MUKIROGEN==='none'?'☑':'□')+' 限定なし')}
  ${r('協定対象派遣労働者に限定', (ph.KYOTEI==='yes'?'☑':'□')+' 限定　'+(ph.KYOTEI==='no'?'☑':'□')+' なし')}
  ${r('派遣人員', e(ph.STAFF_COUNT)+'人')}
`)}
${secEnd()}

${secStart()}
${secHead('業務内容 / 責任の程度 / 組織単位')}
${tbl(`
  ${r('業務内容', e(ph.JOB_DETAIL))}
  ${r('業務に伴う責任の程度', e(ph.AUTHORITY_DETAIL)||'付与される権限なし')}
  ${r('組織単位（長の職名）', e(ph.ORGANIZATION_UNIT)+(ph.UNIT_MANAGER_TITLE?'（'+e(ph.UNIT_MANAGER_TITLE)+'）':''))}
`)}
${secEnd()}

${secStart()}
${secHead('指揮命令者 / 派遣期間・就業日 / 就業時間')}
${tbl(`
  ${r('指揮命令者', '（部署）'+e(ph.CMD_DEPT)+'　（役職）'+e(ph.CMD_TITLE)+'　（氏名）'+e(ph.CMD_NAME)+'　（電話）'+e(ph.CMD_TEL))}
  ${r('派遣期間', e(ph.DISPATCH_START)+'　〜　'+e(ph.DISPATCH_END))}
  ${r('就業日', e(ph.WORK_DAYS))}
  ${r('就業時間', e(ph.WORK_START)+'から'+e(ph.WORK_END)+'（休憩 '+e(ph.BREAK_TIME)+'）')}
  ${r('就業時間外労働', e(ph.OVERTIME_RULE)||'月2日・１日5時間・月36時間・年360時間まで')}
`)}
${secEnd()}

${secStart()}
${secHead('派遣先責任者 / 派遣元責任者')}
${tbl(`
  ${r('派遣先責任者', '（部署）'+e(ph.CLIENT_MGR_DEPT)+'　（役職）'+e(ph.CLIENT_MGR_TITLE)+'　（氏名）'+e(ph.CLIENT_MGR_NAME)+'　（電話）'+e(ph.CLIENT_MGR_TEL))}
  ${r('派遣元責任者', '（部署）'+e(ph.HAKEN_MGR_DEPT)+'　（役職）'+e(ph.HAKEN_MGR_TITLE)+'　（氏名）'+e(ph.HAKEN_MGR_NAME)+'　（電話）'+e(ph.HAKEN_MGR_TEL))}
`)}
${secEnd()}

${secStart()}
${secHead('安全及び衛生 / 福祉増進のための便宜供与')}
${tbl(`
  ${r('安全及び衛生', e(ph.SAFETY_CONTENT))}
  ${r('福祉増進の便宜供与', e(ph.WELFARE_CONTENT))}
`)}
${secEnd()}

${secStart()}
${secHead('派遣先が派遣労働者を雇用する場合の紛争防止措置')}
<div style="border:1px solid #666;padding:2px 6px;font-size:8pt;line-height:1.6;">
派遣先が派遣終了後に、当該派遣労働者を雇用する場合、その雇用意思を事前に派遣元へ示すこととする。
</div>
${secEnd()}

${secStart()}
${secHead('労働者派遣契約の解除に当たって講ずる派遣労働者の雇用の安定を図るために必要な措置')}
<div style="border:1px solid #666;padding:2px 8px;font-size:8pt;line-height:1.7;">
  <div style="font-weight:bold;margin-bottom:1px;">（1）労働者派遣契約の解除の事前の申入れ</div>
  <div style="margin-bottom:4px;text-indent:1em;">派遣先は、専ら派遣先に起因する事由により、労働者派遣契約の契約期間が満了する前の解除を行おうとする場合には、派遣元の合意を得ることはもとより、あらかじめ相当の猶予期間をもって派遣元に解除の申入れを行うこととする。</div>
  <div style="font-weight:bold;margin-bottom:1px;">（2）派遣先における就業機会の確保</div>
  <div style="margin-bottom:4px;text-indent:1em;">派遣先及び派遣元は、労働者派遣契約の契約期間が満了する前に派遣労働者の責に帰すべき事由によらない労働者派遣契約の解除を行った場合には、派遣先の関連会社での就業をあっせんする等により、当該労働者派遣契約に係る派遣労働者の新たな就業機会の確保を図ることとする。</div>
  <div style="font-weight:bold;margin-bottom:1px;">（3）損害賠償等に係る適切な措置</div>
  <div style="margin-bottom:4px;text-indent:1em;">派遣先は、派遣先の責に帰すべき事由により労働者派遣契約の契約期間が満了する前に労働者派遣契約の解除を行おうとする場合には、派遣労働者の新たな就業機会の確保を図ることとし、これができないときには、少なくとも当該労働者派遣契約の解除に伴い派遣元が派遣労働者を休業させること等を余儀なくされたことにより生じた休業手当に相当する額以上の額の賠償を行う。また、派遣先及び派遣元双方の責に帰すべき事由がある場合には、それぞれの責に帰すべき部分の割合についても十分に考慮することとする。</div>
  <div style="font-weight:bold;margin-bottom:1px;">（4）労働者派遣契約の解除の理由の明示</div>
  <div style="text-indent:1em;">派遣先は、労働者派遣契約の契約期間が満了する前に労働者派遣契約の解除を行おうとする場合であって、派遣元から請求があったときは、労働者派遣契約の解除を行った理由を派遣元に対して明らかにすることとする。</div>
</div>
${secEnd()}

${secStart()}
${secHead('苦情の申出先、処理方法・連携体制')}
<div style="border:1px solid #666;padding:2px 6px;font-size:8pt;">
  <div style="font-weight:bold;margin-bottom:2px;">（1）苦情の申出を受ける者</div>
  <div style="margin-bottom:1px;"><span style="font-weight:bold;">派遣先</span>　<span style="color:#555;">（部署）</span>${e(ph.COMPLAINT_CLIENT_DEPT)}　<span style="color:#555;">（役職）</span>${e(ph.COMPLAINT_CLIENT_TITLE)}　<span style="color:#555;">（氏名）</span>${e(ph.COMPLAINT_CLIENT_NAME)}　<span style="color:#555;">（電話）</span>${e(ph.COMPLAINT_CLIENT_TEL)}</div>
  <div style="margin-bottom:3px;"><span style="font-weight:bold;">派遣元</span>　<span style="color:#555;">（部署）</span>${e(ph.COMPLAINT_HAKEN_DEPT)}　<span style="color:#555;">（役職）</span>${e(ph.COMPLAINT_HAKEN_TITLE)}　<span style="color:#555;">（氏名）</span>${e(ph.COMPLAINT_HAKEN_NAME)}　<span style="color:#555;">（電話）</span>${e(ph.COMPLAINT_HAKEN_TEL)}</div>
  <div style="font-weight:bold;margin-bottom:2px;">（2）苦情処理方法、連携体制等</div>
  <div style="line-height:1.7;">
    　①派遣先における(1)記載の者が苦情の申出を受けたときは、ただちに派遣先責任者へ連絡することとし、当該派遣先責任者が中心となって誠意をもって、遅滞なく、当該苦情の適切かつ迅速な処理を図ることとし、その結果について必ず派遣労働者に通知することとする。<br>
    　②派遣元における(1)記載の者が苦情の申出を受けたときは、ただちに派遣元責任者へ連絡することとし、当該派遣元責任者が中心となって誠意をもって、遅滞なく、当該苦情の適切かつ迅速な処理を図ることとし、その結果について必ず派遣労働者に通知することとする。<br>
    　③派遣先及び派遣元は、自らでその解決が容易であり、即時に処理した苦情の他は、相互に遅滞なく通知するとともに、密接に連絡調整を行いつつ、その解決を図ることとする。
  </div>
</div>
${secEnd()}

<div class="sign-grid" style="page-break-inside:avoid;break-inside:avoid;">
  <div class="sign-box">
    <div class="sign-label">派　遣　先</div>
    （所在地）${e(ph.CLIENT_ADDRESS)}<br>
    （事業所名）${e(ph.CLIENT_NAME)}<br>
    （代表者名）${e(ph.CLIENT_CEO)}
  </div>
  <div class="sign-box">
    <div class="sign-label">派　遣　元</div>
    （所在地）${e(ph.COMPANY_ADDRESS)}<br>
    （事業所名）${e(ph.COMPANY_NAME)}<br>
    （代表者名）${e(ph.COMPANY_CEO_TITLE)}&nbsp;${e(ph.COMPANY_CEO)}<br>
    （許可番号）${e(ph.LICENSE_NO)}
  </div>
</div>`;
}

function buildSakichoHtml(ph){
  const S='border:1px solid #666;padding:3px 6px;font-size:9pt;line-height:1.7;vertical-align:top;';
  const L=S+'background:#f0f0f0;font-weight:bold;white-space:nowrap;width:34%;';
  const V=S+'width:66%;';
  const r=(l,v)=>`<tr><td style="${L}">${l}</td><td style="${V}">${v||'　'}</td></tr>`;
  const sec=(t)=>`<div style="background:#e0e0e0;border:1px solid #666;border-bottom:none;padding:2px 6px;font-size:9pt;font-weight:bold;margin-top:2mm;page-break-after:avoid;break-after:avoid;">■ ${t}</div>`;
  return `
<style>body{font-family:'MS Mincho','Yu Mincho',serif;font-size:9pt;line-height:1.7;color:#000;padding:8mm 12mm;}
h1{font-size:14pt;font-weight:bold;text-align:center;letter-spacing:5px;margin:0 0 2mm;}
@media print{
  body{padding:8mm 12mm;}
  @page{size:A4;margin:8mm 12mm;}
  tr{page-break-inside:avoid;break-inside:avoid;}
  td,th{page-break-inside:avoid;break-inside:avoid;}
  table{page-break-inside:auto;border-collapse:collapse;}
  .sign-grid,.sign-area{page-break-inside:avoid;break-inside:avoid;}
}</style>
<h1>派 遣 先 管 理 台 帳</h1>
<p style="text-align:center;font-size:8.5pt;margin-bottom:3mm;">（労働者派遣法第42条に基づく）【労働者派遣終了後３年間保存】</p>
${sec('派遣労働者の氏名')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('氏名',e(ph.EMPLOYEE_NAME))}</table>
${sec('派遣先の事業所')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('名称・所在地', e(ph.CLIENT_SITE_NAME)+'　'+e(ph.CLIENT_SITE_ADDRESS))}
  ${r('就業場所・組織単位', e(ph.WORK_LOCATION_NAME)+'　組織単位：'+e(ph.ORGANIZATION_UNIT))}
</table>
${sec('派遣元事業主')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('名称・所在地', e(ph.COMPANY_NAME)+'　'+e(ph.COMPANY_ADDRESS))}
</table>
${sec('協定対象派遣労働者であるか否かの別')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('','☑ 協定対象派遣労働者　　□ 協定対象派遣労働者ではない（派遣先均等・均衡方式）')}</table>
${sec('無期・有期の別 / 60歳以上か否か')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr><td style="${L}">雇用期間の別</td><td style="${V}">□ 無期雇用　　☑ 有期雇用（${e(ph.CONTRACT_START)}から${e(ph.CONTRACT_END)}まで）</td></tr>
  <tr><td style="${L}">年齢</td><td style="${V}">□ 60歳以上　　☑ 60歳未満</td></tr>
</table>
${sec('業務内容 / 責任の程度')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('業務内容', e(ph.JOB_DETAIL))}
  ${r('業務に伴う責任の程度', e(ph.AUTHORITY_DETAIL)||'□ 付与される権限なし　□ 付与される権限あり：')}
</table>
${sec('派遣期間 / 就業日')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr><td style="${L}">派遣期間</td><td style="${V}">${e(ph.DISPATCH_START)}　〜　${e(ph.DISPATCH_END)}</td></tr>
  <tr><td style="${L}">就業日</td><td style="${V};white-space:nowrap;">${e(ph.WORK_DAYS)}</td></tr>
</table>
${sec('就業時間及び休憩時間')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('就業時間・休憩', e(ph.WORK_START)+'から'+e(ph.WORK_END)+'　（休憩 '+e(ph.BREAK_TIME)+'）')}</table>
${sec('就業日外労働及び就業時間外労働')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('内容', e(ph.OVERTIME_RULE)||'上記就業日以外の就労は月2日まで、上記就業時間外の労働の限度は１日5時間　月36時間　年360時間まで')}</table>
${sec('製造業務専門派遣先責任者（製造業務でない場合は「派遣先責任者」）')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('部署・役職・氏名・電話','（部署）'+e(ph.CLIENT_MGR_DEPT)+'　（役職）'+e(ph.CLIENT_MGR_TITLE)+'　（氏名）'+e(ph.CLIENT_MGR_NAME)+'　（電話）'+e(ph.CLIENT_MGR_TEL))}</table>
${sec('製造業務専門派遣元責任者（製造業務でない場合は「派遣元責任者」）')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('部署・役職・氏名・電話','（部署）'+e(ph.HAKEN_MGR_DEPT)+'　（役職）'+e(ph.HAKEN_MGR_TITLE)+'　（氏名）'+e(ph.HAKEN_MGR_NAME)+'　（電話）'+e(ph.HAKEN_MGR_TEL))}</table>
${sec('就業状況')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('就業状況','別添タイムシートのとおり')}</table>
${sec('社会保険・雇用保険の被保険者資格取得届の提出の有無')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr><td style="${L}">健康保険</td><td style="${V}">${ph.KENPO_ARI||'有 ・ 無'}　　${ph.KENPO_ARI==='無'?'無の理由：':''}</td>
      <td style="${L}">厚生年金保険</td><td style="${V}">${ph.KOSEI_ARI||'有 ・ 無'}　　${ph.KOSEI_ARI==='無'?'無の理由：':''}</td></tr>
  <tr><td style="${L}">雇用保険</td><td style="${V}">${ph.KOYO_ARI||'有 ・ 無'}　　${ph.KOYO_ARI==='無'?'無の理由：':''}${ph.KOYO_ARI==='有'&&ph.KOYO_HOKEN_NO?'　被保険者番号：'+e(ph.KOYO_HOKEN_NO):''}</td><td style="${L}"></td><td style="${V}"></td></tr>
</table>
${sec('派遣労働者からの苦情処理状況')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr><td style="${L}">申出を受けた日</td><td style="${V}">　　　年　　月　　日</td><td style="${L}">苦情内容・処理状況</td><td style="${V}">　</td></tr>
</table>
${sec('段階的かつ体系的な教育訓練を行った日時及び内容')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr><td style="${L}">実施日時</td><td style="${V}">　</td><td style="${L}">教育訓練内容</td><td style="${V}">　</td></tr>
</table>
${sec('雇用安定措置の内容')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('①派遣先への直接雇用の依頼','依頼日時・方法：<br>派遣先の回答日時・内容：')}
  ${r('②他の派遣先の紹介','')}
  ${r('③期間を定めない雇用の機会の確保','')}
</table>
<div style="font-size:8.5pt;color:#555;margin-top:2mm;">※本台帳は労働者派遣終了後３年間保存すること（派遣法第37条）</div>`;
}

function buildMotochoHtml(ph){
  const S='border:1px solid #666;padding:3px 6px;font-size:9pt;line-height:1.7;vertical-align:top;';
  const L=S+'background:#f0f0f0;font-weight:bold;white-space:nowrap;width:34%;';
  const V=S+'width:66%;';
  const r=(l,v)=>`<tr><td style="${L}">${l}</td><td style="${V}">${v||'　'}</td></tr>`;
  const sec=(t)=>`<div style="background:#e0e0e0;border:1px solid #666;border-bottom:none;padding:2px 6px;font-size:9pt;font-weight:bold;margin-top:2mm;page-break-after:avoid;break-after:avoid;">■ ${t}</div>`;
  return `
<style>body{font-family:'MS Mincho','Yu Mincho',serif;font-size:9pt;line-height:1.7;color:#000;padding:8mm 12mm;}
h1{font-size:14pt;font-weight:bold;text-align:center;letter-spacing:5px;margin:0 0 2mm;}
@media print{
  body{padding:8mm 12mm;}
  @page{size:A4;margin:8mm 12mm;}
  tr{page-break-inside:avoid;break-inside:avoid;}
  td,th{page-break-inside:avoid;break-inside:avoid;}
  table{page-break-inside:auto;border-collapse:collapse;}
  .sign-grid,.sign-area{page-break-inside:avoid;break-inside:avoid;}
}</style>
<h1>派 遣 元 管 理 台 帳</h1>
<p style="text-align:center;font-size:8.5pt;margin-bottom:3mm;">（労働者派遣法第37条に基づく）【労働者派遣終了後３年間保存】</p>
${sec('派遣労働者の氏名')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('氏名',e(ph.EMPLOYEE_NAME))}</table>
${sec('派遣先の名称 / 派遣先事業所の名称及び所在地')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('派遣先の名称', e(ph.CLIENT_NAME))}
  ${r('派遣先事業所の名称及び所在地', e(ph.CLIENT_SITE_NAME)+'　'+e(ph.CLIENT_SITE_ADDRESS))}
  ${r('就業場所・組織単位', e(ph.WORK_LOCATION_NAME)+'　組織単位：'+e(ph.ORGANIZATION_UNIT))}
</table>
${sec('派遣労働者の雇用期間 / 60歳以上か否か')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr><td style="${L}">雇用期間の別</td><td style="${V}">□ 無期雇用　　☑ 有期雇用（${e(ph.CONTRACT_START)}から${e(ph.CONTRACT_END)}まで）</td></tr>
  <tr><td style="${L}">60歳以上か否か</td><td style="${V}">□ 60歳以上　　☑ 60歳未満</td></tr>
</table>
${sec('協定対象派遣労働者であるか否かの別')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('','☑ 協定対象派遣労働者　　□ 協定対象派遣労働者ではない（派遣先均等・均衡方式）')}</table>
${sec('業務内容 / 責任の程度')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('業務内容', e(ph.JOB_DETAIL))}
  ${r('業務に伴う責任の程度', e(ph.AUTHORITY_DETAIL)||'□ 付与される権限なし　□ 付与される権限あり：')}
</table>
${sec('派遣期間 / 就業日')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr><td style="${L}">派遣期間</td><td style="${V}">${e(ph.DISPATCH_START)}　〜　${e(ph.DISPATCH_END)}</td></tr>
  <tr><td style="${L}">就業日</td><td style="${V};white-space:nowrap;">${e(ph.WORK_DAYS)}</td></tr>
</table>
${sec('就業時間及び休憩時間')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('就業時間・休憩', e(ph.WORK_START)+'から'+e(ph.WORK_END)+'　（休憩 '+e(ph.BREAK_TIME)+'）')}</table>
${sec('就業日外労働及び就業時間外労働')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('内容', e(ph.OVERTIME_RULE)||'上記就業日以外の就労は月2日まで、上記就業時間外の労働の限度は１日5時間　月36時間　年360時間まで')}</table>
${sec('製造業務専門派遣先責任者 / 派遣元責任者')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('派遣先責任者（部署・役職・氏名・電話）','（部署）'+e(ph.CLIENT_MGR_DEPT)+'　（役職）'+e(ph.CLIENT_MGR_TITLE)+'　（氏名）'+e(ph.CLIENT_MGR_NAME)+'　（電話）'+e(ph.CLIENT_MGR_TEL))}
  ${r('派遣元責任者（部署・役職・氏名・電話）','（部署）'+e(ph.HAKEN_MGR_DEPT)+'　（役職）'+e(ph.HAKEN_MGR_TITLE)+'　（氏名）'+e(ph.HAKEN_MGR_NAME)+'　（電話）'+e(ph.HAKEN_MGR_TEL))}
</table>
${sec('就業状況')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('就業状況','別添タイムシートのとおり')}</table>
 ${sec('社会保険・雇用保険の被保険者資格取得届の提出の有無')}
 <table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
   <tr><td style="${L}">健康保険</td><td style="${V}">${ph.KENPO_ARI||'有 ・ 無'}${ph.KENPO_ARI==='無'?'　　無の理由：':''}</td></tr>
   <tr><td style="${L}">厚生年金保険</td><td style="${V}">${ph.KOSEI_ARI||'有 ・ 無'}${ph.KOSEI_ARI==='無'?'　　無の理由：':''}</td></tr>
   <tr><td style="${L}">雇用保険</td><td style="${V}">${ph.KOYO_ARI||'有 ・ 無'}${ph.KOYO_ARI==='無'?'　　無の理由：':''}${ph.KOYO_ARI==='有'&&ph.KOYO_HOKEN_NO?'　被保険者番号：'+e(ph.KOYO_HOKEN_NO):''}</td></tr>
 </table>
 ${sec('派遣労働者からの苦情処理状況')}
 <table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
   <tr><td style="${L}">苦情処理状況</td><td style="${V}" style="white-space:pre-wrap;">${e(ph.COMPLAINT_TEXT)||'　'}</td></tr>
 </table>
 ${sec('段階的かつ体系的な教育訓練を行った日時及び内容')}
 <table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
   <tr><td style="${L}">教育訓練内容</td><td style="${V}" style="white-space:pre-wrap;">${e(ph.TRAINING_TEXT)||'　'}</td></tr>
 </table>
${sec('雇用安定措置の内容')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('希望する措置の内容', ph.STABILITY_HOPE||'　')}
  ${r('①派遣先への直接雇用の依頼', (ph.STABILITY_DIRECT_REQ?'依頼日時・方法：'+ph.STABILITY_DIRECT_REQ:'依頼日時・方法：')+(ph.STABILITY_DIRECT_ANS?'\n派遣先の回答：'+ph.STABILITY_DIRECT_ANS:'\n派遣先の回答：'))}
  ${r('②他の派遣先の紹介', ph.STABILITY_OTHER||'　')}
  ${r('③期間を定めない雇用の機会の確保', ph.STABILITY_MUKIROGEN||'　')}
  ${r('④その他', ph.STABILITY_ETC||'　')}
</table>
<div style="font-size:8.5pt;color:#555;margin-top:2mm;">※本台帳は労働者派遣終了後３年間保存すること（派遣法第37条）</div>`;
}

function buildKoyoJokenHtml(ph){
  const S='border:1px solid #666;padding:3px 6px;font-size:9pt;line-height:1.7;vertical-align:top;';
  const L=S+'background:#f0f0f0;font-weight:bold;white-space:nowrap;width:34%;';
  const V=S+'width:66%;';
  const r=(l,v)=>`<tr><td style="${L}">${l}</td><td style="${V}">${v||'　'}</td></tr>`;
  const sec=(t)=>`<div style="background:#e0e0e0;border:1px solid #666;border-bottom:none;padding:2px 6px;font-size:9pt;font-weight:bold;margin-top:2mm;page-break-after:avoid;break-after:avoid;">■ ${t}</div>`;
  return `
<style>body{font-family:'MS Mincho','Yu Mincho',serif;font-size:9pt;line-height:1.7;color:#000;padding:8mm 12mm;}
h1{font-size:13pt;font-weight:bold;text-align:center;letter-spacing:4px;margin:0 0 1mm;}
@media print{
  body{padding:8mm 12mm;}
  @page{size:A4;margin:8mm 12mm;}
  tr{page-break-inside:avoid;break-inside:avoid;}
  td,th{page-break-inside:avoid;break-inside:avoid;}
  table{page-break-inside:auto;border-collapse:collapse;}
  .sign-grid,.sign-area{page-break-inside:avoid;break-inside:avoid;}
}</style>
<div style="text-align:right;font-size:8.5pt;margin-bottom:1mm;">契約No.${e(ph.CONTRACT_NO)}　　${e(ph.CONTRACT_DATE)}</div>
<h1>雇 用 契 約 書　兼　就 業 条 件 明 示 書</h1>
<p style="text-align:center;font-size:8.5pt;margin-bottom:2mm;">（労働基準法第15条・労働者派遣法第34条　労使協定方式）</p>
<p style="font-size:9pt;margin-bottom:2mm;">
  ${e(ph.COMPANY_NAME)}（以下「会社」という）と下記派遣労働者は雇用契約を締結するとともに就業条件を明示する。
</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:3mm;">
  <div style="border:1px solid #666;padding:3px 6px;font-size:9pt;">
    <div style="font-weight:bold;border-bottom:1px solid #999;margin-bottom:2px;">派遣元事業主</div>
    所在地：${e(ph.COMPANY_ADDRESS)}<br>
    事業所名：${e(ph.COMPANY_NAME)}<br>
    代表者：${e(ph.COMPANY_CEO)}<br>
    許可番号：${e(ph.LICENSE_NO)}
  </div>
  <div style="border:1px solid #666;padding:3px 6px;font-size:9pt;">
    <div style="font-weight:bold;border-bottom:1px solid #999;margin-bottom:2px;">派遣労働者</div>
    氏名：${e(ph.EMPLOYEE_NAME)}<br>
    生年月日：${e(ph.BIRTH_DATE)}<br>
    住所：${e(ph.EMPLOYEE_ADDRESS)}
  </div>
</div>

${sec('【雇用条件（労働基準法第15条）】')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('雇用期間', e(ph.CONTRACT_START)+'　〜　'+e(ph.CONTRACT_END))}
  ${r('就業場所（変更の範囲）', '会社の定める事業所')}
  ${r('業務内容（変更の範囲）', '会社の定める業務全般')}
  ${r('始業・終業時刻', (ph.WORK_START&&ph.WORK_END?e(ph.WORK_START)+'　〜　'+e(ph.WORK_END):'現場指定時間による'))}
  ${r('休憩時間', e(ph.BREAK_TIME)||'60分')}
  ${r('就業日外・時間外労働', e(ph.OVERTIME_RULE)||'上記就業日以外の就労は月2日まで、就業時間外は１日5時間・月36時間・年360時間まで')}
  ${r('休日', e(ph.HOLIDAY)||'土日祝日')}
  <tr><td style="${L}">賃金</td><td style="${V}">
    ${ph.HOURLY_WAGE?'時給　'+e(ph.HOURLY_WAGE)+'円':''}${ph.MONTHLY_WAGE?'　月給　'+e(ph.MONTHLY_WAGE)+'円':''}<br>
    <span style="font-size:8.5pt;">時間外割増：25%以上　／　深夜割増（22時〜翌5時）：25%以上　／　休日割増：35%以上</span>
  </td></tr>
  ${r('賃金締切・支払日', '毎月'+e(ph.PAY_CUTOFF)+'日締　翌月'+e(ph.PAY_DATE)+'日払')}
  ${r('退職・解雇', '自己都合退職は'+e(ph.NOTICE_DAYS)+'日前申出　解雇：労基法の定めによる')}
  ${r('社会保険・労働保険', '健康保険・厚生年金保険・雇用保険・労災保険')}
  ${r('無期転換申込権', '通算5年超で無期転換申込可（労契法18条）')}
</table>

${sec('【就業条件明示（労働者派遣法第34条）】')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('派遣先事業所', e(ph.CLIENT_SITE_NAME)+'　'+e(ph.CLIENT_SITE_ADDRESS))}
  ${r('就業場所', e(ph.WORK_LOCATION_DETAIL)||e(ph.CLIENT_SITE_NAME))}
  ${r('業務内容（組織単位）', e(ph.JOB_DETAIL)+'　組織単位：'+e(ph.ORGANIZATION_UNIT)+'（'+e(ph.UNIT_MANAGER_TITLE)+'）')}
  ${r('業務に伴う責任の程度', e(ph.AUTHORITY_DETAIL)||'□ 付与される権限なし　□ 付与される権限あり：')}
  <tr><td style="${L}">指揮命令者</td><td style="${V}">（部署）${e(ph.CMD_DEPT)}　（役職）${e(ph.CMD_TITLE)}　（氏名）${e(ph.CMD_NAME)}　（電話）${e(ph.CMD_TEL)}</td></tr>
  <tr><td style="${L}">派遣期間</td><td style="${V}">${e(ph.DISPATCH_START)}　〜　${e(ph.DISPATCH_END)}</td></tr>
  <tr><td style="${L}">就業日</td><td style="${V};white-space:nowrap;">${e(ph.WORK_DAYS)}</td></tr>
  ${ph.HAS_KIKI ? r('事業所単位抵触日', e(ph.JISSAI_SHOKUCHOKU_DATE)||'　　　年　　月　　日') : ''}
  ${ph.HAS_KIKI ? r('組織単位抵触日', e(ph.SOSHIKI_SHOKUCHOKU_DATE)||'　　　年　　月　　日') : ''}
  ${r('派遣料金', ph.HAKEN_RYOKIN?e(ph.HAKEN_RYOKIN)+'円（税別・'+e(ph.RYOKIN_TANI)+'あたり）日額：円':'日額　　　　　円')}
  <tr><td style="${L}">製造業務専門派遣先責任者</td><td style="${V}">（部署）${e(ph.CLIENT_MGR_DEPT)}　（役職）${e(ph.CLIENT_MGR_TITLE)}　（氏名）${e(ph.CLIENT_MGR_NAME)}　（電話）${e(ph.CLIENT_MGR_TEL)}</td></tr>
  <tr><td style="${L}">製造業務専門派遣元責任者</td><td style="${V}">（部署）${e(ph.HAKEN_MGR_DEPT)}　（役職）${e(ph.HAKEN_MGR_TITLE)}　（氏名）${e(ph.HAKEN_MGR_NAME)}　（電話）${e(ph.HAKEN_MGR_TEL)}</td></tr>
  ${r('安全及び衛生', e(ph.SAFETY_CONTENT))}
  ${r('福祉増進のための便宜供与', e(ph.WELFARE_CONTENT))}
  <tr><td style="${L}">苦情申出先（派遣先）</td><td style="${V}">（部署）${e(ph.COMPLAINT_CLIENT_DEPT)}　（役職）${e(ph.COMPLAINT_CLIENT_TITLE)}　（氏名）${e(ph.COMPLAINT_CLIENT_NAME)}　（電話）${e(ph.COMPLAINT_CLIENT_TEL)}</td></tr>
  <tr><td style="${L}">苦情申出先（派遣元）</td><td style="${V}">（部署）${e(ph.COMPLAINT_HAKEN_DEPT)}　（役職）${e(ph.COMPLAINT_HAKEN_TITLE)}　（氏名）${e(ph.COMPLAINT_HAKEN_NAME)}　（電話）${e(ph.COMPLAINT_HAKEN_TEL)}</td></tr>
</table>

${sec('【協定対象派遣労働者であるか否か / 社会保険の状況】')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('協定対象の別', '☑ 協定対象派遣労働者（当該協定の有効期間の終了日：'+(e(ph.AGREEMENT_END_DATE)||'　　年　　月　　日')+'）')}
  <tr><td style="${L}">社会保険・雇用保険</td><td style="${V}">
    健康保険：<strong>${e(ph.KENPO_ARI)||'　'}</strong>　${ph.KENPO_ARI==='無'?'理由：':''}${ph.KENPO_ARI==='有'&&ph.KENPO_NO?'（被保険者番号：'+e(ph.KENPO_NO)+'）':''}<br>
    厚生年金保険：<strong>${e(ph.KOSEI_ARI)||'　'}</strong>　${ph.KOSEI_ARI==='無'?'理由：':''}<br>
    雇用保険：<strong>${e(ph.KOYO_ARI)||'　'}</strong>　${ph.KOYO_ARI==='無'?'理由：':''}${ph.KOYO_ARI==='有'&&ph.KOYO_HOKEN_NO?'（被保険者番号：'+e(ph.KOYO_HOKEN_NO)+'）':''}
  </td></tr>
</table>

${sec('【解雇予告・雇用維持措置】')}
<div style="border:1px solid #666;padding:3px 8px;font-size:8.5pt;line-height:1.8;">
  派遣元事業主は、労働者派遣契約の解除が行われた場合、新たな就業機会の確保を図ることとする。確保できない場合は休業等を行い雇用の維持を図るとともに、
  休業手当の支払等労働基準法等に基づく責任を果たすこととする。やむを得ず解雇する場合は少なくとも30日前に予告し、30日前に予告しないときは解雇予告手当を支払うこととする。
</div>

<p style="font-size:8.5pt;margin-top:2mm;">本書に定めのない事項は労働基準法・労働者派遣法その他関係法令による。</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:3mm;">
  <div style="border:1px solid #666;padding:4px 8px;min-height:18mm;font-size:9pt;">
    <div style="font-weight:bold;border-bottom:1px solid #999;margin-bottom:2px;">派遣元（会社）</div>
    所在地：${e(ph.COMPANY_ADDRESS)}<br>
    ${e(ph.COMPANY_NAME)}<br>
    代表者：${e(ph.COMPANY_CEO)}<br>
    許可番号：${e(ph.LICENSE_NO)}<br>
    <div style="margin-top:8mm;"></div>
  </div>
  <div style="border:1px solid #666;padding:4px 8px;min-height:18mm;font-size:9pt;">
    <div style="font-weight:bold;border-bottom:1px solid #999;margin-bottom:2px;">派遣労働者</div>
    氏名：${e(ph.EMPLOYEE_NAME)}<br>
    住所：${e(ph.EMPLOYEE_ADDRESS)}<br>
    <div style="margin-top:8mm;"></div>
    <span style="font-size:8.5pt;">署名</span>
  </div>
</div>`;
}

function buildHakensekiChichoHtml(ph){
  const S='border:1px solid #666;padding:3px 6px;font-size:9pt;line-height:1.7;vertical-align:top;';
  const L=S+'background:#f0f0f0;font-weight:bold;white-space:nowrap;width:34%;';
  const V=S+'width:66%;';
  const r=(l,v)=>`<tr><td style="${L}">${l}</td><td style="${V}">${v||'　'}</td></tr>`;
  const sec=(t)=>`<div style="background:#e0e0e0;border:1px solid #666;border-bottom:none;padding:2px 6px;font-size:9pt;font-weight:bold;margin-top:2mm;page-break-after:avoid;break-after:avoid;">■ ${t}</div>`;
  return `
<style>body{font-family:'MS Mincho','Yu Mincho',serif;font-size:9pt;line-height:1.7;color:#000;padding:8mm 12mm;}
h1{font-size:13pt;font-weight:bold;text-align:center;letter-spacing:4px;margin:0 0 2mm;}
@media print{
  body{padding:8mm 12mm;}
  @page{size:A4;margin:8mm 12mm;}
  tr{page-break-inside:avoid;break-inside:avoid;}
  td,th{page-break-inside:avoid;break-inside:avoid;}
  table{page-break-inside:auto;border-collapse:collapse;}
  .sign-grid,.sign-area{page-break-inside:avoid;break-inside:avoid;}
}</style>
<div style="text-align:right;font-size:8.5pt;margin-bottom:1mm;">${e(ph.CONTRACT_DATE)}</div>
<div style="font-size:9pt;margin-bottom:2mm;">${e(ph.CLIENT_NAME)}　御中</div>
<div style="text-align:right;font-size:9pt;margin-bottom:3mm;">
  所在地：${e(ph.COMPANY_ADDRESS)}<br>
  事業所名：${e(ph.COMPANY_NAME)}<br>
  代表者：${e(ph.COMPANY_CEO)}<br>
  許可番号：${e(ph.LICENSE_NO)}
</div>
<h1>派 遣 先 通 知 書</h1>
<p style="font-size:9pt;margin-bottom:3mm;">
  令和　　年　　月　　日に締結した労働者派遣契約（契約No.${e(ph.CONTRACT_NO)}）に基づき次の者を派遣します。
</p>

${sec('派遣労働者の氏名・性別・年齢')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr>
    <td style="${L}">氏名</td><td style="${V}">${e(ph.EMPLOYEE_NAME)}</td>
    <td style="${L}">性別</td><td style="${V}">　</td>
  </tr>
  <tr>
    <td style="${L}">年齢</td>
    <td style="${V}" colspan="3">□ 60歳以上　　☑ 60歳未満（　45歳以上60歳未満　□18歳未満（　　　歳））</td>
  </tr>
</table>

${sec('待遇決定方式')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">${r('','☑ 協定対象派遣労働者（労使協定方式）　　□ 協定対象派遣労働者ではない（派遣先均等・均衡方式）')}</table>

${sec('雇用期間')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr><td style="${L}">雇用期間</td><td style="${V}">□ 無期雇用　　☑ 有期雇用（${e(ph.CONTRACT_START)}〜${e(ph.CONTRACT_END)}）</td></tr>
</table>

${sec('労働・社会保険の被保険者資格取得届の提出の有無及び確認資料')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  <tr><td style="${L}">健康保険</td><td style="${V}">${ph.KENPO_ARI||'有・無'}　　${ph.KENPO_ARI==='無'?'無の場合の具体的な理由：':''}</td></tr>
  <tr><td style="${L}">厚生年金保険</td><td style="${V}">${ph.KOSEI_ARI||'有・無'}　　${ph.KOSEI_ARI==='無'?'無の場合の具体的な理由：':''}</td></tr>
  <tr><td style="${L}">雇用保険</td><td style="${V}">${ph.KOYO_ARI||'有・無'}　　${ph.KOYO_ARI==='無'?'無の場合の具体的な理由：':''}${ph.KOYO_ARI==='有'&&ph.KOYO_HOKEN_NO?'　被保険者番号：'+e(ph.KOYO_HOKEN_NO):''}</td></tr>
  <tr><td style="${L}">確認書類</td><td style="${V}">別添の被保険者証の写しのとおり</td></tr>
</table>

${sec('労働者派遣契約の就業条件の内容と異なる場合の就業条件の内容（変更がある場合のみ記載）')}
<table style="width:100%;border-collapse:collapse;page-break-inside:auto;">
  ${r('派遣期間','')}
  ${r('就業日','')}
  ${r('就業時間','')}
  ${r('休憩時間','')}
  ${r('就業日外労働・就業時間外労働','')}
  <tr><td style="${L}">派遣元責任者</td><td style="${V}">（部署）${e(ph.HAKEN_MGR_DEPT)}　（役職）${e(ph.HAKEN_MGR_TITLE)}　（氏名）${e(ph.HAKEN_MGR_NAME)}　（電話）${e(ph.HAKEN_MGR_TEL)}</td></tr>
  <tr><td style="${L}">派遣先責任者</td><td style="${V}">（部署）${e(ph.CLIENT_MGR_DEPT)}　（役職）${e(ph.CLIENT_MGR_TITLE)}　（氏名）${e(ph.CLIENT_MGR_NAME)}　（電話）${e(ph.CLIENT_MGR_TEL)}</td></tr>
  ${r('便宜供与に関する事項', e(ph.WELFARE_CONTENT))}
</table>
<p style="font-size:8.5pt;margin-top:2mm;">（注）通知した内容に変更があった場合には、遅滞なく再度通知すること。</p>`;
}

// ===== 書類生成（PDF） =====
const DOC_BUILDERS = {
  kobetsu:      { title:'労働者派遣個別契約書',       fn: buildKobetsuHtml },
  sakicho:      { title:'派遣先管理台帳',             fn: buildSakichoHtml },
  motocho:      { title:'派遣元管理台帳',             fn: buildMotochoHtml },
  koyo_joken:   { title:'雇用契約書兼就業条件明示書', fn: buildKoyoJokenHtml },
  chicho:       { title:'派遣先通知書',               fn: buildHakensekiChichoHtml },
};

async function genDoc(type){
  const c=currentDocContract;if(!c){toast('契約データがありません','error');return;}
  try{
    const settings=await getSettingsData();
    const builder=DOC_BUILDERS[type];if(!builder)return;
    const emps=Object.values(c._empData||{});
    if(['sakicho','motocho','koyo_joken'].includes(type)&&emps.length>1){
      for(const emp of emps){
        const ph=buildPlaceholders(c,emp,settings,c._recData||{});
        openPdfWindow(builder.title, builder.fn(ph), '');
      }
    } else {
      const emp=emps[0]||null;
      const ph=buildPlaceholders(c,emp,settings,c._recData||{});
      openPdfWindow(builder.title, builder.fn(ph), '');
    }
    toast(builder.title+'を生成しました','success');
  }catch(e){console.error(e);toast('生成に失敗しました：'+e.message,'error');}
}

async function genEmpDoc(type,empId){
  const c=currentDocContract;if(!c){toast('契約データがありません','error');return;}
  try{
    const settings=await getSettingsData();
    const emp=(c._empData||{})[empId];
    const builder=DOC_BUILDERS[type];if(!builder)return;
    const ph=buildPlaceholders(c,emp,settings,c._recData||{});
    openPdfWindow(builder.title, builder.fn(ph), '');
    toast(builder.title+'を生成しました','success');
  }catch(e){console.error(e);toast('生成に失敗しました：'+e.message,'error');}
}

async function genAllDocs(){
  const c=currentDocContract;if(!c){toast('契約データがありません','error');return;}
  try{
    const settings=await getSettingsData();
    const emps=Object.values(c._empData||{});
    // 個別契約書（現場単位）
    const phSite=buildPlaceholders(c,emps[0]||null,settings);
    openPdfWindow(DOC_BUILDERS.kobetsu.title, DOC_BUILDERS.kobetsu.fn(phSite), '');
    // スタッフごと
    for(const ce of(c.contract_employees||[])){
      const emp=(c._empData||{})[ce.employee_id];
      const ph=buildPlaceholders(c,emp,settings,c._recData||{});
      for(const type of['motocho','koyo_joken','chicho']){
        openPdfWindow(DOC_BUILDERS[type].title, DOC_BUILDERS[type].fn(ph), '');
      }
    }
    toast('全書類を生成しました（印刷ダイアログで「PDFに保存」を選択してください）','success');
  }catch(e){console.error(e);toast('生成に失敗しました：'+e.message,'error');}
}

