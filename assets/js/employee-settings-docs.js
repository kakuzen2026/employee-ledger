// ---- 設定ページ ----
function renderSettings(){
  document.getElementById('mainContent').innerHTML=`
    <div style="max-width:600px">
      <div style="font-size:16px;font-weight:700;margin-bottom:20px">設定</div>

      <div class="settings-card" style="margin-bottom:20px">
        <h3>発行元情報（証明書用）</h3>
        <div class="field-grid" style="margin-bottom:12px">
          <div class="field"><label>会社名</label><input type="text" id="ci_company" value="${companyInfo.company_name||''}" placeholder="株式会社〇〇"></div>
          <div class="field"><label>郵便番号</label><input type="text" id="ci_postal" value="${companyInfo.postal_code||''}" placeholder="000-0000"></div>
          <div class="field" style="grid-column:1/-1"><label>住所</label><input type="text" id="ci_address" value="${companyInfo.address||''}" placeholder="愛知県〇〇市..."></div>
          <div class="field"><label>電話番号</label><input type="text" id="ci_tel" value="${companyInfo.tel||''}" placeholder="0000-00-0000"></div>
          <div class="field"><label>代表者名</label><input type="text" id="ci_rep" value="${companyInfo.representative||''}" placeholder="代表取締役 〇〇 〇〇"></div>
        </div>
        <div style="text-align:right"><button type="button" class="btn btn-primary btn-sm" data-employee-action="company-save">保存</button></div>
      </div>

      <div class="settings-card" style="margin-bottom:20px">
        <h3>部署マスター管理</h3>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <span style="font-size:12px;color:var(--emp-text3)">☰ ドラッグで並び替え</span>
          <button type="button" class="btn btn-primary btn-sm" data-employee-action="department-add">＋ 部署を追加</button>
        </div>
        ${departments.length===0?'<div class="empty" style="padding:20px 0">部署が登録されていません</div>':`
        <div id="deptSortList">
          ${departments.map(d=>`
            <div class="dept-row" draggable="true" data-id="${d.id}"
              style="cursor:grab;user-select:none"
              ondragstart="deptDragStart(event,${d.id})"
              ondragover="deptDragOver(event)"
              ondrop="deptDrop(event,${d.id})"
              ondragend="deptDragEnd(event)">
              <span style="color:var(--emp-text3);font-size:16px;margin-right:4px">☰</span>
              <div class="d1">${d.shozoku1}</div>
              <div class="d2">${d.shozoku2||'<span style="color:var(--emp-text3)">所属2なし</span>'}</div>
              <button type="button" class="btn btn-sm" data-employee-action="department-edit" data-id="${d.id}">編集</button>
              <button type="button" class="btn btn-sm btn-danger" data-employee-action="department-delete" data-id="${d.id}">削除</button>
            </div>`).join('')}
        </div>`}
      </div>
      <div class="settings-card" style="margin-top:20px">
        <h3>在留資格マスター管理</h3>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button type="button" class="btn btn-primary btn-sm" data-employee-action="visa-add">＋ 在留資格を追加</button>
        </div>
        ${visaTypes.length===0?'<div class="empty" style="padding:20px 0">在留資格が登録されていません</div>':
          visaTypes.map(v=>`
            <div class="dept-row">
              <div class="d1" style="flex:2">${v.name}</div>
              <button type="button" class="btn btn-sm" data-employee-action="visa-edit" data-id="${v.id}">編集</button>
              <button type="button" class="btn btn-sm btn-danger" data-employee-action="visa-delete" data-id="${v.id}">削除</button>
            </div>`).join('')}
      </div>
      <div class="settings-card" style="margin-top:20px">
        <h3>勤務パターン管理（雇用契約書用）</h3>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button type="button" class="btn btn-primary btn-sm" data-employee-action="work-pattern-add">＋ パターンを追加</button>
        </div>
        ${workPatterns.length===0?'<div class="empty" style="padding:20px 0">勤務パターンが登録されていません</div>':
          workPatterns.map(p=>`
            <div class="dept-row" style="flex-wrap:wrap">
              <div style="font-weight:500;font-size:13px;flex:1;min-width:120px">${p.name}</div>
              <div style="font-size:12px;color:var(--emp-text2);flex:2;min-width:0;word-break:break-all">
                ${p.start_time||''}〜${p.end_time||''} 休憩${p.break_minutes||60}分
                週${p.work_days_per_week||''}日 休日：${p.holidays||''}
              </div>
              <button type="button" class="btn btn-sm" data-employee-action="work-pattern-edit" data-id="${p.id}">編集</button>
              <button type="button" class="btn btn-sm btn-danger" data-employee-action="work-pattern-delete" data-id="${p.id}">削除</button>
            </div>`).join('')}
      </div>
    </div>`;
}

// ---- 勤務パターン ----
let wpEditId=null;
function openWorkPatternModal(id=null){
  wpEditId=id;
  document.getElementById('wpModalTitle').textContent=id?'勤務パターンを編集':'勤務パターンを追加';
  if(id){
    const p=workPatterns.find(x=>x.id===id);
    document.getElementById('wp_name').value=p?.name||'';
    document.getElementById('wp_start').value=p?.start_time||'';
    document.getElementById('wp_end').value=p?.end_time||'';
    document.getElementById('wp_break').value=p?.break_minutes??60;
    document.getElementById('wp_days').value=p?.work_days_per_week||'';
    document.getElementById('wp_holidays').value=p?.holidays||'';
    document.getElementById('wp_note').value=p?.note||'';
  } else {
    document.getElementById('wp_name').value='';
    document.getElementById('wp_start').value='';
    document.getElementById('wp_end').value='';
    document.getElementById('wp_break').value=60;
    document.getElementById('wp_days').value='';
    document.getElementById('wp_holidays').value='';
    document.getElementById('wp_note').value='';
  }
  document.getElementById('wpModal').classList.add('open');
}
function closeWpModal(){document.getElementById('wpModal').classList.remove('open');}
async function saveWpModal(){
  const name=document.getElementById('wp_name').value.trim();
  if(!name){showToast('パターン名は必須です','error');return;}
  const data={
    name,
    start_time:document.getElementById('wp_start').value||null,
    end_time:document.getElementById('wp_end').value||null,
    break_minutes:Number(document.getElementById('wp_break').value)||60,
    work_days_per_week:document.getElementById('wp_days').value?Number(document.getElementById('wp_days').value):null,
    holidays:document.getElementById('wp_holidays').value||null,
    note:document.getElementById('wp_note').value||null,
  };
  try{
    await saveWorkPattern(wpEditId,data,workPatterns.length+1);
    await loadWorkPatterns();closeWpModal();renderSettings();
  }catch(e){showToast('保存に失敗しました：'+e.message,'error');}
}
async function deleteWorkPattern(id){
  if(!confirmPermanentDelete('この勤務パターン'))return;
  await deleteWorkPatternRecord(id);
  await loadWorkPatterns();renderSettings();
}


async function saveCompanyInfo(){
  const data={
    company_name:document.getElementById('ci_company')?.value||'',
    postal_code:document.getElementById('ci_postal')?.value||'',
    address:document.getElementById('ci_address')?.value||'',
    tel:document.getElementById('ci_tel')?.value||'',
    representative:document.getElementById('ci_rep')?.value||''
  };
  try{
    await updateCompanyInfo(data);
    companyInfo={...companyInfo,...data};
    showToast('保存しました');
  }catch(e){showToast('保存に失敗しました：'+e.message,'error');}
}

// ---- 証明書生成 ----
function generateCertificate(empId,type){
  if(!canCreateEmployeeDocument())return;
  const e=employees.find(x=>x.id===empId);
  if(!e){showToast('従業員が見つかりません','error');return;}
  if(!canIssueCertificate(e,type))return;
  if(!companyInfo.company_name){showToast('設定画面で発行元情報を登録してください','warn');return;}

  const today=new Date();
  const todayStr=`${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  const todayISO=today.toISOString().slice(0,10);
  const dept=departments.find(d=>d.id===Number(e.dept_id));
  const isZaishoku=type==='zaishoku';
  const title=isZaishoku?'在職証明書':'退職証明書';

  const content=`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  body{font-family:'MS Mincho','Yu Mincho',serif;margin:0;padding:40px;color:#000;font-size:14px;line-height:2}
  .title{text-align:center;font-size:24px;font-weight:bold;margin:20px 0 40px;letter-spacing:4px}
  .date{text-align:right;margin-bottom:30px}
  .content{margin:0 20px}
  .name-line{font-size:16px;margin:20px 0;border-bottom:1px solid #000;padding-bottom:4px}
  .table{width:100%;border-collapse:collapse;margin:16px 0}
  .table td{padding:8px 12px;border:1px solid #333;font-size:13px}
  .table td:first-child{width:30%;background:#f5f5f5;font-weight:bold}
  .seal-area{text-align:right;margin-top:40px}
  .company-info{text-align:right;line-height:1.8;margin-top:10px}
  @media print{body{padding:20px}}
</style>
</head>
<body>
  <div class="date">発行日：${todayStr}</div>
  <div class="title">${title}</div>
  <div class="content">
    <div class="name-line">氏　名：${e.sei} ${e.mei}　様</div>
    <div style="margin:20px 0">上記の者は、下記のとおり${isZaishoku?'在職していることを証明します':'退職したことを証明します'}。</div>
    <table class="table">
      <tr><td>所属</td><td>${dept?[dept.shozoku1,dept.shozoku2].filter(Boolean).join('　'):'—'}</td></tr>
      <tr><td>雇用形態</td><td>${e.koyou||'—'}</td></tr>
      <tr><td>雇用期間の定め</td><td>${e.employment_type==='permanent'?'無期（期間の定めなし）':e.employment_type==='fixed'?'有期（期間の定めあり）':'—'}</td></tr>
      <tr><td>入社年月日</td><td>${e.nyusha_date||'—'}</td></tr>
      ${!isZaishoku?`<tr><td>退職年月日</td><td>${e.taishoku_date||'—'}</td></tr>`:''}
      ${isZaishoku?`<tr><td>在籍状況</td><td>在職中</td></tr>`:''}
    </table>
    <div style="margin-top:30px;font-size:12px;color:#555">※本証明書は${todayStr}現在のものです。</div>
  </div>
  <div class="seal-area">
    <div class="company-info">
      〒${companyInfo.postal_code||''}<br>
      ${companyInfo.address||''}<br>
      ${companyInfo.company_name||''}<br>
      TEL：${companyInfo.tel||''}<br>
      代表者：${companyInfo.representative||''}
    </div>
  </div>
</body>
</html>`;

  const w=window.open('','_blank','width=800,height=900');
  if(!w){
    showToast('証明書の表示をブロックしました。ブラウザでポップアップを許可して、もう一度実行してください。','warn');
    return;
  }
  w.document.write(content);
  w.document.close();
  w.onload=()=>{w.print();};

  // 発行履歴を保存
  createCertificate({
    employee_id:empId,
    employee_name:e.sei+' '+e.mei,
    cert_type:isZaishoku?'在職証明書':'退職証明書',
    issued_date:todayISO,
    issued_by:companyInfo.company_name||''
  }).then(()=>loadCertificates()).then(()=>{if(currentView==='cert_list')renderCertList()}).catch(err=>{
    console.error(err);
    showToast('証明書は表示しましたが、発行履歴の保存に失敗しました：'+err.message,'error');
  });
}

// ---- 雇用契約書 ----
const EMPLOYMENT_CONTRACT_MODEL=Object.freeze({
  id:'provided-excel-employment-contract-20260910-v1',
  label:'ご提供のExcelひな形に基づく雇用契約書',
  checked_at:'2026-09-10'
});

let contractEmpId=null;
let contractIssuePending=false;
let contractSealGeneration=0;
let contractSealLoading=false;
let contractSealError='';
let contractSourceId=null;
let contractInitialTerms='';

// Only shared template wording. Personal details, workplaces and wages come from
// the selected employee or the form, never from the supplied example employees.
const EMPLOYMENT_CONTRACT_DEFAULTS=Object.freeze({
  work:'自動車製品の製造、加工、検査、組付け、梱包、出荷およびそれに付帯する業務',
  holiday:'就業カレンダーに準拠する',yukyu:'法定通り',
  overtime:'yes',holiday_work:'yes',
  premium_overtime:'25％',premium_overtime_over60:'50％',premium_holiday:'35％',premium_night:'25％',
  pay_close:'当月 末日',pay_date:'翌月 15日',
  raise:'yes',raise_detail:'年1回5月。但し、契約社員賃金規定に定める事由により改定を行わない又は降給を行うことがある。',
  bonus:'no',retirement:'no',
  deductions:'健康保険料、厚生年金保険料、雇用保険料、所得税、住民税、労使協定により定めたもの',
  renew:'possible',renew_limit:'none',
  renew_criteria:'契約の更新は次のいずれか又は総合的考慮により判断する。\n・契約期間満了時の業務量、要員充足状態、業務内容の転換、業務の廃止等の状況\n・従事する業務の進捗状況\n・執務態度、能力、成績、勤怠、健康状態、会社業績、経営状況\n・業務遂行の不履行等の発生状況\n・就業規則違反、不適格事由、解雇、懲戒に準ずる事案の発生状況\n・個別に定めた更新条件、その他上記に準ずる事項',
  indefinite_conversion:'契約期間が5年を超えている場合、本契約期間中に無期労働契約締結の申し込みをした時は、本契約期間満了の翌日から無期雇用に転換することができる。\n無期転換後の労働条件は有期契約時と同一とする。',
  resignation:'雇用契約期間中であっても契約社員は希望により退職でき（30日前迄に届出要）、甲も解雇事由や上記更新基準等を考慮し契約を解除することができる。',
  dismissal:'解雇、退職、懲戒、服務規律においては契約社員就業規則による。\n試用期間が経過し、本採用登用後も執務態度、能力、成績、勤怠などを考慮し、解雇、懲戒等を行うことがある。',
  trial_detail:'試用期間は、業務の都合又は乙の事情、甲と乙で定めた条件及び基準等を考慮して、短縮又は入社日より6ヶ月以内の日まで延長する場合がある。\n甲は試用期間中において、乙の執務態度、能力、成績、勤怠などについて不適格と認める場合は解雇する。また試用期間終了時において乙の執務態度、能力、成績、勤怠などについて不適格と認められた場合は試用期間満了とし、契約を解除する。',
  social_insurance:'健康保険、厚生年金',employment_insurance:'有',rules:'契約社員就業規則',
  other_terms:'個別合意又は就業規則の変更により、労働条件及び業務の変更等を行う場合がある。\n当該契約書で定めた事以外は契約社員就業規則、諸規定、諸協定、内規等による。'
});

function emp_contractInput(id,label,value='',options={}){
  const required=options.required?' <span style="color:var(--emp-danger)">*</span>':'';
  const full=options.full?'grid-column:1/-1':'';
  const type=options.type||'text';
  const placeholder=options.placeholder?` placeholder="${emp_esc(options.placeholder)}"`:'';
  return `<div class="field" style="${full}"><label for="${id}">${emp_esc(label)}${required}</label><input type="${type}" id="${id}" value="${emp_esc(value)}"${placeholder}></div>`;
}

function emp_contractArea(id,label,value='',options={}){
  const required=options.required?' <span style="color:var(--emp-danger)">*</span>':'';
  const full=options.full===false?'':'grid-column:1/-1';
  const placeholder=options.placeholder?` placeholder="${emp_esc(options.placeholder)}"`:'';
  return `<div class="field" style="${full}"><label for="${id}">${emp_esc(label)}${required}</label><textarea id="${id}" rows="${options.rows||2}"${placeholder}>${emp_esc(value)}</textarea></div>`;
}

function emp_contractSelect(id,label,choices,selected='',options={}){
  const required=options.required?' <span style="color:var(--emp-danger)">*</span>':'';
  const full=options.full?'grid-column:1/-1':'';
  const change=options.change?` data-employee-change="${emp_esc(options.change)}"`:'';
  return `<div class="field" style="${full}"><label for="${id}">${emp_esc(label)}${required}</label><select id="${id}"${change}>
    ${choices.map(([value,text])=>`<option value="${emp_esc(value)}" ${String(value)===String(selected)?'selected':''}>${emp_esc(text)}</option>`).join('')}
  </select></div>`;
}

function emp_contractSection(title,body){
  return `<section style="border:1px solid var(--emp-border2,#ddd);border-radius:8px;padding:12px;margin:12px 0">
    <h4 style="margin:0 0 10px;font-size:14px">${emp_esc(title)}</h4>
    <div class="field-grid" style="gap:8px">${body}</div>
  </section>`;
}

function emp_openContractModal(empId,sourceContract=null){
  if(!canCreateEmployeeDocument())return;
  if(contractIssuePending){showToast('発行履歴を保存しています。完了までお待ちください。','warn');return;}
  const e=employees.find(x=>x.id===empId);
  if(!e)return;
  if(!sourceContract&&!companyInfo.company_name){showToast('設定画面で発行元情報を登録してください','warn');return;}
  if(document.getElementById('contractModal').classList.contains('open')&&!closeContractModal())return;
  contractEmpId=empId;contractSourceId=sourceContract?.id??null;
  document.getElementById('contractModalTitle').textContent=sourceContract?'過去の雇用契約書を複製して作成':'雇用契約書を作成';
  const isFixed=e.employment_type!=='permanent';
  const contractType=isFixed?'fixed':'permanent';
  const dept=departments.find(d=>d.id===Number(e.dept_id));
  const deptName=dept?[dept.shozoku1,dept.shozoku2].filter(Boolean).join(' '):'';
  const wageType=e.kyuyo?'monthly':e.jikyu?'hourly':'';
  const wage=e.kyuyo?`${e.kyuyo}円（月額）`:e.jikyu?`${e.jikyu}円（時給）`:'';
  const blankChoice=[['','選択してください'],['yes','有'],['no','無'],['rules','就業規則・会社規定による']];
  contractSealGeneration++;contractSealLoading=false;contractSealError='';
  document.getElementById('contractModalBody').innerHTML=`
    ${sourceContract?`<p class="workspace-help" role="status"><strong>${emp_esc(`${e.sei||''} ${e.mei||''}`.trim())}</strong>さんの${emp_esc(sourceContract.issued_date||'日付未記録')}の契約条件・電子印を引き継ぎます。元の契約書は変更せず、新しい履歴に保存します。従業員の氏名・住所は現在の登録情報を使います。有期契約では開始日を前回終了日の翌日にしています。終了日と今回の条件を確認してください。</p>`:''}
    ${sourceContract?'':`<div style="font-size:12px;line-height:1.7;color:var(--emp-text2);margin-bottom:12px">
      ${emp_esc(EMPLOYMENT_CONTRACT_MODEL.label)}。共通の文言を入力済みです。<br>
      <strong>${emp_esc(`${e.sei||''} ${e.mei||''}`.trim())}</strong>さんの就業場所・時給・勤務時間・手当を確認し、共通の条件も必要に応じて変更してください。変更範囲なども本文にまとめて印刷します。
    </div>`}
    ${emp_contractSection('1. 契約期間',`
      ${emp_contractSelect('cm_contract_type','契約種別',[
        ['fixed','有期契約（期間の定めあり）'],['permanent','無期契約（期間の定めなし）']
      ],contractType,{required:true,full:true,change:'contract-type'})}
      ${emp_contractInput('cm_start','契約開始日',e.nyusha_date||'',{type:'date',required:true})}
      <div id="cm_fixed_fields" class="field-grid" style="gap:8px;grid-column:1/-1;${isFixed?'':'display:none'}">
      ${emp_contractInput('cm_end','契約終了日','',{type:'date',required:true})}
      ${emp_contractSelect('cm_renew','契約更新',[
        ['','選択してください'],['auto','自動的に更新する'],['possible','更新する場合があり得る'],['none','更新しない']
      ],'',{required:true})}
      ${emp_contractArea('cm_renew_criteria','更新の判断基準','',{
        required:true,placeholder:'勤務成績・態度、能力、業務量、会社の経営状況、従事業務の進捗状況など'
      })}
      ${emp_contractSelect('cm_renew_limit','更新上限（通算契約期間・更新回数）',[
        ['','選択してください'],['none','上限なし'],['yes','上限あり']
      ],'',{required:true})}
      ${emp_contractInput('cm_renew_limit_detail','更新上限の内容','',{full:true,placeholder:'例：通算5年／更新4回まで'})}
      ${emp_contractArea('cm_indefinite_conversion','無期転換申込機会・転換後の労働条件','',{
        required:true,placeholder:'例：法定の要件を満たした場合、申込みにより期間満了日の翌日から無期契約へ転換。変更する条件：なし'
      })}
      </div>
    `)}
    ${emp_contractSection('2. 就業場所・業務内容',`
      ${emp_contractInput('cm_place','就業場所（雇入れ直後）',deptName,{required:true})}
      ${emp_contractInput('cm_place_scope','就業場所の変更範囲','',{required:true,placeholder:'例：変更なし／会社の定める事業所'})}
      ${emp_contractInput('cm_work','業務内容（雇入れ直後）','',{required:true,placeholder:'例：製造業務'})}
      ${emp_contractInput('cm_work_scope','業務内容の変更範囲','',{required:true,placeholder:'例：変更なし／会社の定める業務'})}
    `)}
    ${emp_contractSection('3. 労働時間・休憩・休日',`
      ${emp_contractSelect('cm_work_system','勤務制度',[
        ['','選択してください'],['fixed','固定時間制'],['shift','交替制・シフト制'],
        ['variable','変形労働時間制'],['flex','フレックスタイム制'],['other','その他']
      ],'',{required:true})}
      ${emp_contractInput('cm_work_days','勤務日','',{required:true,placeholder:'例：月曜日から金曜日'})}
      ${emp_contractInput('cm_start_time','始業時刻','',{required:true,placeholder:'例：08:00'})}
      ${emp_contractInput('cm_end_time','終業時刻','',{required:true,placeholder:'例：17:00'})}
      ${emp_contractInput('cm_break','休憩時間','',{required:true,placeholder:'例：60分（12:00〜13:00）'})}
      ${emp_contractArea('cm_shift_schedule','交替勤務の時間帯・休憩','',{rows:3,placeholder:'交替勤務の場合は全時間帯と各休憩を記載。例：\n8:30〜17:30（休憩60分）\n22:00〜翌7:00（休憩60分）'})}
      ${emp_contractInput('cm_work_hours','所定労働時間','',{required:true,placeholder:'例：1日8時間・週40時間'})}
      ${emp_contractSelect('cm_overtime','所定時間外労働',blankChoice,'',{required:true})}
      ${emp_contractInput('cm_overtime_detail','時間外労働の条件','',{full:true,placeholder:'例：業務上必要な場合に命じることがある（36協定の範囲内）'})}
      ${emp_contractSelect('cm_holiday_work','休日労働',blankChoice,'',{required:true})}
      ${emp_contractInput('cm_holiday_work_detail','休日労働の条件','',{full:true,placeholder:'例：業務上必要な場合に命じることがある'})}
      ${emp_contractArea('cm_holiday','休日','',{required:true,placeholder:'例：毎週土・日曜日、国民の祝日、年末年始'})}
    `)}
    ${emp_contractSection('4. 休暇',`
      ${emp_contractArea('cm_yukyu','年次有給休暇','',{required:true,placeholder:'付与時期・日数、時間単位年休の有無などを記載'})}
      ${emp_contractInput('cm_other_leave','その他の休暇','',{full:true,placeholder:'例：慶弔休暇、育児・介護休業（就業規則による）'})}
    `)}
    ${emp_contractSection('5. 賃金',`
      ${emp_contractSelect('cm_wage_type','賃金形態',[
        ['','選択してください'],['monthly','月給制'],['daily','日給制'],['hourly','時給制'],['other','その他']
      ],wageType,{required:true})}
      ${emp_contractInput('cm_wage','基本賃金',wage,{required:true,placeholder:'例：250,000円（月額）'})}
      ${emp_contractArea('cm_allowances','諸手当・計算方法','',{placeholder:'手当名、金額、計算方法を記載'})}
      ${emp_contractInput('cm_premium_overtime','時間外割増率（60時間以内）','',{placeholder:'例：25%以上'})}
      ${emp_contractInput('cm_premium_overtime_over60','時間外割増率（60時間超）','',{placeholder:'例：50%以上'})}
      ${emp_contractInput('cm_premium_holiday','法定休日割増率','',{placeholder:'例：35%以上'})}
      ${emp_contractInput('cm_premium_night','深夜割増率','',{placeholder:'例：25%以上'})}
      ${emp_contractInput('cm_pay_close','賃金締切日','',{required:true,placeholder:'例：毎月末日'})}
      ${emp_contractInput('cm_pay_date','賃金支払日','',{required:true,placeholder:'例：翌月25日'})}
      ${emp_contractInput('cm_pay_method','支払方法','',{required:true,placeholder:'例：本人名義の銀行口座へ振込'})}
      ${emp_contractInput('cm_deductions','賃金からの控除','',{full:true,placeholder:'社会保険料・税金・労使協定による控除など'})}
      ${emp_contractSelect('cm_raise','昇給',blankChoice,'',{required:true})}
      ${emp_contractArea('cm_raise_detail','賃金改定の時期・条件','')}
      ${emp_contractSelect('cm_bonus','賞与',blankChoice,'',{required:true})}
      ${emp_contractSelect('cm_retirement','退職金',blankChoice,'',{required:true})}
    `)}
    ${emp_contractSection('6. 退職・解雇',`
      ${emp_contractInput('cm_retirement_age','定年制・継続雇用制度','',{full:true,placeholder:'例：定年60歳、継続雇用65歳まで／定年制なし'})}
      ${emp_contractArea('cm_resignation','自己都合退職の手続','',{required:true,placeholder:'例：就業規則第○条に基づき、退職希望日の○日前までに申し出る'})}
      ${emp_contractArea('cm_dismissal','解雇の事由・手続','',{required:true,placeholder:'就業規則の該当条項、解雇事由および手続を記載'})}
    `)}
    ${emp_contractSection('7. その他',`
      ${emp_contractInput('cm_trial','試用期間','',{placeholder:'例：入社日から3か月／なし'})}
      ${emp_contractArea('cm_trial_detail','試用期間の取扱い','',{rows:4})}
      ${emp_contractInput('cm_social_insurance','社会保険の加入','',{placeholder:'健康保険・厚生年金の加入有無'})}
      ${emp_contractInput('cm_employment_insurance','雇用保険の適用','',{placeholder:'有／無'})}
      ${emp_contractInput('cm_consultation','雇用管理・相談窓口','',{required:true,placeholder:'部署名・担当者名・連絡先'})}
      ${emp_contractArea('cm_treatment_explanation','待遇差の説明請求窓口','',{
        required:true,placeholder:'短時間・有期雇用労働者が待遇差の内容・理由の説明を求める場合の窓口'
      })}
      ${emp_contractInput('cm_rules','適用される就業規則','',{required:true,placeholder:'例：正社員就業規則／有期契約社員就業規則'})}
      ${emp_contractInput('cm_rules_access','就業規則の確認方法・場所','',{required:true,placeholder:'例：総務部で閲覧、社内ポータルに掲載'})}
      ${emp_contractArea('cm_other_terms','安全衛生・教育訓練・災害補償・休職等','',{placeholder:'その他の適用条件や参照規程を記載'})}
    `)}
    ${emp_contractSection('8. 契約書に記載する雇用者',`
      ${emp_contractInput('cm_employer_name','雇用者名',companyInfo.company_name||'',{required:true})}
      ${emp_contractInput('cm_employer_representative','代表者',companyInfo.representative||'',{required:true})}
      ${emp_contractInput('cm_employer_postal_code','郵便番号',companyInfo.postal_code||'')}
      ${emp_contractInput('cm_employer_address','雇用者の所在地',companyInfo.address||'',{required:true})}
      ${emp_contractInput('cm_employer_tel','雇用者の電話番号',companyInfo.tel||'')}
      <div class="field" style="grid-column:1/-1">
        <label for="cm_seal_file">雇用者の電子印（PNG・JPEG、256KBまで）</label>
        <input type="file" id="cm_seal_file" accept="image/png,image/jpeg" style="max-width:100%">
        <input type="hidden" id="cm_employer_seal" value="">
        <div><img id="cm_seal_preview" alt="選択した雇用者の電子印" style="display:none;width:88px;height:88px;object-fit:contain"></div>
        <span id="cm_seal_status" role="status">電子印を使う場合は画像を選択してください。</span>
        <button type="button" class="btn btn-sm" id="cm_seal_clear">電子印を外す</button>
      </div>
    `)}`;
  for(const [key,value] of Object.entries(EMPLOYMENT_CONTRACT_DEFAULTS)){
    const field=document.getElementById(`cm_${key}`);
    if(field)field.value=value;
  }
  document.getElementById('cm_work_system').addEventListener('change',toggleContractWorkFields);
  document.getElementById('cm_seal_file').addEventListener('change',event=>readEmploymentContractSeal(event.target));
  document.getElementById('cm_seal_clear').addEventListener('click',clearEmploymentContractSeal);
  if(sourceContract)applyCopiedEmploymentContract(sourceContract);
  toggleContractTermFields();
  toggleContractWorkFields();
  contractInitialTerms=JSON.stringify(collectEmploymentContractTerms());
  document.getElementById('contractModal').classList.add('open');
  document.querySelector('#contractModal .modal-box').scrollTop=0;
}
function hasUnsavedEmploymentContract(){
  return document.getElementById('contractModal')?.classList.contains('open')&&
    (contractSealLoading||contractSealError||JSON.stringify(collectEmploymentContractTerms())!==contractInitialTerms);
}
function closeContractModal({saved=false}={}){
  if(!saved&&contractIssuePending){showToast('発行履歴を保存しています。完了までお待ちください。','warn');return false;}
  if(!saved&&hasUnsavedEmploymentContract()&&!confirm('入力した雇用契約書はまだ保存されていません。変更を破棄して閉じますか？'))return false;
  contractSealGeneration++;contractSealLoading=false;contractSealError='';
  document.getElementById('contractModal').classList.remove('open');
  contractSourceId=null;contractInitialTerms='';
  return true;
}

function clearEmploymentContractSeal({keepFile=false}={}){
  contractSealGeneration++;contractSealLoading=false;contractSealError='';
  if(!keepFile)document.getElementById('cm_seal_file').value='';
  document.getElementById('cm_employer_seal').value='';
  const preview=document.getElementById('cm_seal_preview');
  preview.removeAttribute('src');preview.style.display='none';
  document.getElementById('cm_seal_status').textContent='電子印を使う場合は画像を選択してください。';
}

async function readEmploymentContractSeal(input){
  const file=input.files?.[0];
  clearEmploymentContractSeal({keepFile:true});
  if(!file)return;
  const generation=contractSealGeneration;
  const status=document.getElementById('cm_seal_status');
  contractSealLoading=true;status.textContent='電子印を読み込んでいます…';
  try{
    if(!['image/png','image/jpeg'].includes(file.type)||file.size>256*1024)throw new Error('256KB以下のPNGまたはJPEG画像を選択してください。');
    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('画像を読み込めませんでした。もう一度選択してください。'));reader.readAsDataURL(file);
    });
    if(!isEmploymentContractSeal(data))throw new Error('PNGまたはJPEG画像を選択してください。');
    const image=new Image();image.src=data;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth>4096||image.naturalHeight>4096)throw new Error('画像の縦横は4096ピクセル以下にしてください。');
    if(generation!==contractSealGeneration||!input.isConnected)return;
    document.getElementById('cm_employer_seal').value=data;
    const preview=document.getElementById('cm_seal_preview');preview.src=data;preview.style.display='block';
    status.textContent='電子印を読み込みました。契約書の雇用者欄に表示します。';
  }catch(error){
    if(generation!==contractSealGeneration||!input.isConnected)return;
    contractSealError=error.message||'画像を読み込めませんでした。';
    status.textContent=contractSealError;
  }finally{if(generation===contractSealGeneration)contractSealLoading=false;}
}

function toggleContractTermFields(){
  const isFixed=document.getElementById('cm_contract_type')?.value==='fixed';
  const fields=document.getElementById('cm_fixed_fields');
  if(fields)fields.style.display=isFixed?'grid':'none';
}

function toggleContractWorkFields(){
  const shift=document.getElementById('cm_work_system')?.value==='shift';
  for(const id of ['cm_start_time','cm_end_time','cm_break','cm_shift_schedule']){
    const field=document.getElementById(id);
    if(field)field.closest('.field').style.display=(id==='cm_shift_schedule'?!shift:shift)?'none':'';
  }
}

const EMPLOYMENT_CONTRACT_TERM_IDS=[
    'cm_contract_type','cm_start','cm_end','cm_renew','cm_renew_criteria','cm_renew_limit','cm_renew_limit_detail',
    'cm_indefinite_conversion','cm_place','cm_place_scope','cm_work','cm_work_scope',
    'cm_work_system','cm_work_days','cm_start_time','cm_end_time','cm_break','cm_work_hours',
    'cm_overtime','cm_overtime_detail','cm_holiday_work','cm_holiday_work_detail','cm_holiday',
    'cm_yukyu','cm_other_leave','cm_wage_type','cm_wage','cm_allowances','cm_premium_overtime',
    'cm_premium_overtime_over60','cm_premium_holiday','cm_premium_night','cm_pay_close',
    'cm_pay_date','cm_pay_method','cm_deductions','cm_raise','cm_bonus','cm_retirement',
    'cm_retirement_age','cm_resignation','cm_dismissal','cm_trial','cm_social_insurance',
    'cm_employment_insurance','cm_consultation','cm_treatment_explanation','cm_rules',
    'cm_rules_access','cm_other_terms','cm_shift_schedule','cm_raise_detail','cm_trial_detail',
    'cm_employer_name','cm_employer_representative','cm_employer_postal_code','cm_employer_address','cm_employer_tel','cm_employer_seal'
];
function collectEmploymentContractTerms(){
  const value=id=>document.getElementById(id)?.value?.trim()||'';
  const terms=Object.fromEntries(EMPLOYMENT_CONTRACT_TERM_IDS.map(id=>[id.replace(/^cm_/,''),value(id)]));
  if(terms.contract_type==='permanent'){
    for(const key of ['end','renew','renew_criteria','renew_limit','renew_limit_detail','indefinite_conversion'])terms[key]='';
  }
  if(terms.work_system==='shift'){
    for(const key of ['start_time','end_time','break'])terms[key]='';
  }else terms.shift_schedule='';
  return terms;
}

function validateEmploymentContractTerms(terms,isFixed){
  const required=[
    ['contract_type','契約種別'],['start','契約開始日'],['place','就業場所（雇入れ直後）'],['place_scope','就業場所の変更範囲'],
    ['work','業務内容（雇入れ直後）'],['work_scope','業務内容の変更範囲'],['work_system','勤務制度'],
    ['work_days','勤務日'],
    ['work_hours','所定労働時間'],['overtime','所定時間外労働'],['holiday_work','休日労働'],
    ['holiday','休日'],['yukyu','年次有給休暇'],['wage_type','賃金形態'],['wage','基本賃金'],
    ['pay_close','賃金締切日'],['pay_date','賃金支払日'],['pay_method','支払方法'],
    ['raise','昇給'],['bonus','賞与'],['retirement','退職金'],['resignation','自己都合退職の手続'],
    ['dismissal','解雇の事由・手続'],['consultation','雇用管理・相談窓口'],
    ['treatment_explanation','待遇差の説明請求窓口'],['rules','適用される就業規則'],
    ['rules_access','就業規則の確認方法・場所'],
    ['employer_name','雇用者名'],['employer_representative','代表者'],['employer_address','雇用者の所在地']
  ];
  if(terms.work_system==='shift')required.push(['shift_schedule','交替勤務の時間帯・休憩']);
  else required.push(['start_time','始業時刻'],['end_time','終業時刻'],['break','休憩時間']);
  if(isFixed)required.push(
    ['end','契約終了日'],['renew','契約更新'],['renew_criteria','更新の判断基準'],
    ['renew_limit','更新上限'],['indefinite_conversion','無期転換申込機会・転換後の労働条件']
  );
  if(isFixed&&terms.renew_limit==='yes'&&!terms.renew_limit_detail){
    required.push(['renew_limit_detail','更新上限の内容']);
  }
  return required.filter(([key])=>!terms[key]);
}

function generateContract(print=true){
  if(!canCreateEmployeeDocument())return;
  if(contractIssuePending){showToast('発行履歴を保存しています。完了までお待ちください。','warn');return;}
  if(contractSealLoading){showToast('電子印の読み込みが完了するまでお待ちください。','warn');return;}
  if(contractSealError){showToast('電子印を選び直すか、「電子印を外す」を押してください。','warn');return;}
  const e=employees.find(x=>x.id===contractEmpId);
  if(!e)return;
  const terms=collectEmploymentContractTerms();
  const isFixed=terms.contract_type==='fixed';
  const missing=validateEmploymentContractTerms(terms,isFixed);
  if(missing.length){
    const labels=missing.map(([,label])=>label);
    showToast(`未入力の必須項目があります：${labels.slice(0,5).join('、')}${labels.length>5?` ほか${labels.length-5}件`:''}`,'warn');
    document.getElementById(`cm_${missing[0][0]}`)?.focus();
    return;
  }
  if(isFixed&&terms.end<terms.start){
    showToast('契約終了日は契約開始日以降の日付を指定してください','warn');
    document.getElementById('cm_end')?.focus();
    return;
  }
  const today=new Date();
  const todayStr=`${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  const issuedDate=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const employeeSnapshot=employmentContractEmployeeSnapshot(e);
  const content=buildEmploymentContractContent(employeeSnapshot,terms,todayStr);

  if(print){
    const w=window.open('','_blank','width=900,height=1100');
    if(!w){
      showToast('雇用契約書の表示をブロックしました。ブラウザでポップアップを許可して、もう一度実行してください。','warn');
      return;
    }
    w.onload=async()=>{
      try{
        await w.document.fonts?.ready;
        await Promise.all(Array.from(w.document.images).map(image=>image.decode()));
        w.print();
      }catch(error){showToast('契約書の画像を表示できませんでした。印刷画面を確認してください。','error');}
    };
    w.document.write(content);
    w.document.close();
  }

  // 雇用契約書履歴を保存
  contractIssuePending=true;
  document.getElementById('contractModalBody').inert=true;
  createEmploymentContract({
    employee_id:e.id,
    employee_name:e.sei+' '+e.mei,
    employee_snapshot:employeeSnapshot,
    copied_from_id:contractSourceId,
    contract_start:terms.start,
    contract_end:terms.end||null,
    is_fixed:isFixed,
    contract_type:terms.contract_type,
    source:'this_app',
    issued_date:issuedDate,
    created_at:today.toISOString(),
    issued_by:terms.employer_name,
    template_id:EMPLOYMENT_CONTRACT_MODEL.id,
    template_checked_at:EMPLOYMENT_CONTRACT_MODEL.checked_at,
    terms
  }).then(async()=>{
    // A reload error must not invite a second insert of a successfully saved record.
    if(contractEmpId===e.id)closeContractModal({saved:true});
    showToast('雇用契約書を履歴に保存しました。','success');
    try{await loadEmploymentContracts();}
    catch(err){
      console.error(err);
      showToast('発行履歴は保存済みですが、一覧の再読み込みに失敗しました。再発行せず、画面を再読み込みしてください。','warn');
    }
    refreshEmploymentContractViews();
  }).catch(err=>{
    console.error(err);
    showToast(`${print?'雇用契約書は表示しましたが、':''}発行履歴の保存に失敗しました。入力内容を残しています。通信を確認して再実行してください。`,'error');
  }).finally(()=>{
    contractIssuePending=false;
    document.getElementById('contractModalBody').inert=false;
  });
}

// ---- 雇用契約書一覧 ----
async function renderContractList(){
  const generation=++renderContractList.generation;
  const today=new Date();
  const todayStr=today.toISOString().slice(0,10);

  // 派遣管理アプリの雇用契約書を取得
  let dispatchContracts=[],dispatchReady=true;
  try{
    dispatchContracts=await fetchDispatchContractEmployeeSummaries();
  }catch(e){dispatchReady=false;}
  if(generation!==renderContractList.generation||currentView!=='contract_list')return;

  // 従業員ごとの最新雇用契約書を集計
  // このアプリ: employment_contracts
  // 派遣アプリ: dispatch_contracts.contract_employees
  const empContractMap={};// employee_id -> {source, contract_end, is_active}

  // このアプリの契約
  [...employmentContracts].sort(compareEmploymentContracts).forEach(c=>{
    const id=c.employee_id;
    if(!empContractMap[id])
      empContractMap[id]={source:'this_app',contract_end:c.contract_end,issued_date:c.issued_date,contractId:c.id,is_fixed:c.is_fixed};
  });

  // 派遣アプリの契約（is_active=trueのもの）
  dispatchContracts.forEach(dc=>{
    (dc.contract_employees||[]).forEach(ce=>{
      if(!ce.is_active)return;
      const id=ce.employee_id;
      if(!empContractMap[id])
        empContractMap[id]={source:'dispatch',contract_end:ce.contract_end,is_fixed:ce.employment_type==='fixed'};
    });
  });

  // アラート対象の在籍中従業員を抽出
  const activeEmps=employees.filter(e=>e.status==='在籍'&&!e.contract_other_system);
  const alertEmps=activeEmps.filter(e=>{
    const ct=empContractMap[e.id];
    if(!ct)return dispatchReady; // 読み込みに失敗した場合は契約書なしと断定しない
    if(!ct.contract_end)return false; // 無期または終了日なし
    const days=Math.ceil((new Date(ct.contract_end)-today)/86400000);
    return days<=15; // 期限切れ or 15日以内
  });

  // 絞り込み
  const filters=documentFilters('contract_list'),fe=filters.employee||'',tab=filters.tab==='history'?'history':'attention';
  let thisList=[...employmentContracts].sort(compareEmploymentContracts);
  if(fe)thisList=thisList.filter(r=>r.employee_id===Number(fe));

  document.getElementById('mainContent').innerHTML=`
    <div class="workspace-heading document-heading"><div><h1>雇用契約書</h1><p class="workspace-help">契約期限を確認し、対象者の契約書を作成できます。</p></div><button class="btn btn-primary" ${attendanceEmployeesReady?'':'disabled'} onclick="openDocumentComposer()">＋ 契約書を作成</button></div>
    ${documentComposer('contract')}
    <nav class="workspace-tabs document-task-tabs" aria-label="契約書の確認内容"><button class="${tab==='attention'?'active':''}" onclick="setDocumentFilter('contract_list','tab','attention')">要確認</button><button class="${tab==='history'?'active':''}" onclick="setDocumentFilter('contract_list','tab','history')">発行履歴</button></nav>
    ${!documentContractsReady||!attendanceEmployeesReady?'<div class="empty" role="alert">従業員または契約書の読み込みが未完了です。<button class="btn" onclick="loadAndRender()">再読み込み</button></div>':''}
    <section ${tab!=='attention'||!documentContractsReady||!attendanceEmployeesReady?'hidden':''}>
    ${!dispatchReady?'<p class="workspace-help" role="alert">派遣管理の契約情報を取得できませんでした。確認できた期限のみ表示しています。<button class="btn btn-sm" onclick="renderContractList()">再読み込み</button></p>':''}

    ${alertEmps.length>0?`
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:500;margin-bottom:8px;color:var(--emp-danger)">⚠ 雇用契約書アラート（${alertEmps.length}名）</div>
      <div class="table-wrap"><table>
        <thead><tr><th>氏名</th><th>所属</th><th>状態</th><th>契約終了日</th><th></th></tr></thead>
        <tbody>${alertEmps.map(e=>{
          const ct=empContractMap[e.id];
          const dept=departments.find(d=>d.id===Number(e.dept_id));
          const days=ct?.contract_end?Math.ceil((new Date(ct.contract_end)-today)/86400000):null;
          const statusLabel=!ct
            ?`<span class="badge badge-danger">契約書なし</span>`
            :days<0?`<span class="badge badge-danger">期限切れ（${Math.abs(days)}日）</span>`
            :`<span class="badge badge-warn">残${days}日</span>`;
          const rowBg=!ct||days<0?'background:#fdf0f0':'background:#fdf3e7';
          return`<tr style="${rowBg}">
            <td data-label="氏名"><button class="emp-name" onclick="viewDetail(${e.id})">${emp_esc(e.sei)} ${emp_esc(e.mei)}</button></td>
            <td data-label="所属" style="font-size:12px">${emp_esc(dept?.shozoku1||'—')}</td>
            <td data-label="状態">${statusLabel}</td>
            <td data-label="契約終了日" style="font-size:12px">${emp_esc(ct?.contract_end||'—')}</td>
            <td class="no-label"><button type="button" class="btn btn-sm" data-employee-action="contract-open" data-id="${e.id}">契約書作成</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`:dispatchReady?'<div class="empty">現在、期限切れ・15日以内の期限・契約書なしの対象者はいません。</div>':'<div class="empty">契約書の不足は未確認です。</div>'}
    </section><section ${tab!=='history'||!documentContractsReady?'hidden':''}>

    <div style="font-size:13px;font-weight:500;margin-bottom:8px">発行履歴（このアプリ）</div>
    <div class="search-bar" style="margin-bottom:12px">
      <select id="fceEmp" aria-label="従業員で絞り込み" onchange="setDocumentFilter('contract_list','employee',this.value)" style="min-width:160px">
        <option value="">従業員：全て</option>
        ${documentEmployeeOptions(fe)}
      </select>
    </div>
    ${thisList.length===0?'<div class="empty">雇用契約書の発行履歴がありません</div>':`
    <div class="table-wrap"><table>
      <thead><tr><th>発行日</th><th>氏名</th><th>契約開始</th><th>契約終了</th><th>種別</th><th>発行元</th><th></th></tr></thead>
      <tbody>${thisList.map(r=>`<tr>
        <td data-label="発行日" style="font-size:13px">${emp_esc(r.issued_date||'—')}</td>
        <td data-label="氏名"><button class="emp-name" onclick="viewDetail(${r.employee_id})">${emp_esc(r.employee_name||'—')}</button></td>
        <td data-label="契約開始" style="font-size:12px">${emp_esc(r.contract_start||'—')}</td>
        <td data-label="契約終了" style="font-size:12px">${emp_esc(r.contract_end||'無期')}</td>
        <td data-label="種別"><span class="badge ${r.is_fixed?'badge-warn':'badge-active'}">${r.is_fixed?'有期':'無期'}</span></td>
        <td data-label="発行元" style="font-size:12px;color:var(--emp-text2)">${emp_esc(r.issued_by||'—')}</td>
        <td class="no-label">
          ${employmentContractHistoryActions(r)}
          <details class="row-actions"><summary>その他</summary><button type="button" class="btn btn-sm btn-danger" data-employee-action="contract-delete" data-id="${r.id}" style="margin-left:4px">削除</button></details>
        </td>
      </tr>`).join('')}
      </tbody>
    </table></div>`}</section>`;
}
renderContractList.generation=0;

async function deleteEmploymentContract(id){
  if(!confirmPermanentDelete('この雇用契約書の発行履歴'))return;
  await deleteEmploymentContractRecord(id);
  await loadEmploymentContracts();
  renderContractList();
}

// ---- 証明書一覧 ----
function renderCertList(){
  const filters=documentFilters('cert_list'),fe=filters.employee||'',ft=filters.type||'',fm=filters.month||'';
  // 雇用契約書は別タブで管理するため除外
  let list=certificates.filter(r=>r.cert_type!=='雇用契約書').sort((a,b)=>String(b.issued_date||'').localeCompare(String(a.issued_date||'')));
  if(fe)list=list.filter(r=>r.employee_id===Number(fe));
  if(ft)list=list.filter(r=>r.cert_type===ft);
  if(fm)list=list.filter(r=>r.issued_date&&r.issued_date.startsWith(fm));

  document.getElementById('mainContent').innerHTML=`
    <div class="workspace-heading document-heading"><div><h1>証明書</h1><p class="workspace-help">在職・退職証明書の発行と、過去の発行履歴を確認できます。</p></div><button class="btn btn-primary" ${attendanceEmployeesReady?'':'disabled'} onclick="openDocumentComposer()">＋ 証明書を発行</button></div>
    ${documentComposer('cert')}
    <h2 class="document-section-title">発行履歴</h2>
    <div class="search-bar document-filters">
      <label>従業員<select id="fcEmp" onchange="setDocumentFilter('cert_list','employee',this.value)" style="min-width:160px">
        <option value="">従業員：全て</option>
        ${documentEmployeeOptions(fe)}
      </select></label>
      <label>証明書の種類<select id="fcType" onchange="setDocumentFilter('cert_list','type',this.value)">
        <option value="">種別：全て</option>
        <option value="在職証明書" ${ft==='在職証明書'?'selected':''}>在職証明書</option>
        <option value="退職証明書" ${ft==='退職証明書'?'selected':''}>退職証明書</option>
      </select></label>
      <label>発行月<input type="month" id="fcMonth" value="${emp_attr(fm)}" onchange="setDocumentFilter('cert_list','month',this.value)"></label>
    </div>
    ${!documentCertificatesReady?'<div class="empty" role="alert">発行履歴を読み込めませんでした。<button class="btn" onclick="loadAndRender()">再読み込み</button></div>':list.length===0?'<div class="empty">条件に合う発行履歴がありません</div>':`
    <p class="result-count document-count">${list.length}件の発行履歴</p>
    <div class="table-wrap"><table>
      <thead><tr><th>発行日</th><th>氏名</th><th>種別</th><th>発行元</th><th></th></tr></thead>
      <tbody>${list.map(r=>`<tr>
        <td data-label="発行日" style="font-size:13px">${emp_esc(r.issued_date||'—')}</td>
        <td data-label="氏名"><button class="emp-name" onclick="viewDetail(${r.employee_id})">${emp_esc(r.employee_name||'—')}</button></td>
        <td data-label="種別"><span class="badge ${r.cert_type==='在職証明書'?'badge-visa':'badge-retired'}">${emp_esc(r.cert_type||'—')}</span></td>
        <td data-label="発行元" style="font-size:12px;color:var(--emp-text2)">${emp_esc(r.issued_by||'—')}</td>
        <td class="no-label">
          <button class="btn btn-sm" onclick="${r.cert_type==='雇用契約書'?`emp_openContractModal(${r.employee_id})`:`reissueCert(${r.employee_id},'${r.cert_type==='在職証明書'?'zaishoku':'taishoku'}')`}">再発行</button>
          <details class="row-actions"><summary>その他</summary><button class="btn btn-sm btn-danger" onclick="deleteCert(${r.id})" style="margin-left:4px">削除</button></details>
        </td>
      </tr>`).join('')}
      </tbody>
    </table></div>`}`;
}

async function deleteCert(id){
  if(!confirmPermanentDelete('この発行履歴'))return;
  await deleteCertificate(id);
  await loadCertificates();
  renderCertList();
}

function reissueCert(empId,type){
  generateCertificate(empId,type);
}

// ---- 部署ドラッグ＆ドロップ ----
let dragSrcId=null;
function deptDragStart(e,id){
  dragSrcId=id;
  e.currentTarget.style.opacity='0.4';
  e.dataTransfer.effectAllowed='move';
}
function deptDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  e.currentTarget.style.borderTop='2px solid var(--emp-accent)';
}
function deptDragEnd(e){
  e.currentTarget.style.opacity='1';
  document.querySelectorAll('.dept-row').forEach(r=>r.style.borderTop='');
}
async function deptDrop(e,targetId){
  e.preventDefault();
  e.currentTarget.style.borderTop='';
  if(dragSrcId===targetId)return;
  const srcIdx=departments.findIndex(d=>d.id===dragSrcId);
  const tgtIdx=departments.findIndex(d=>d.id===targetId);
  const moved=departments.splice(srcIdx,1)[0];
  departments.splice(tgtIdx,0,moved);
  // sort_orderを更新
  try{
    await updateDepartmentSortOrders(departments);
    await loadDepts();renderSettings();
  }catch(err){showToast('並び替えの保存に失敗しました：'+err.message,'error');}
}
async function deleteDept(id){
  const inUse=employees.some(e=>Number(e.dept_id)===id);
  if(inUse){showToast('この部署は使用中です。先に従業員の部署を変更してください。','warn');return;}
  if(!confirmPermanentDelete('この部署'))return;
  await deleteDepartment(id);
  await loadDepts();renderSettings();
}

// ---- 在留資格マスター ----
let visaModalMode='add',visaModalId=null;
function openVisaModal(mode,id=null,name=''){
  visaModalMode=mode;visaModalId=id;
  document.getElementById('visaModalTitle').textContent=mode==='add'?'在留資格を追加':'在留資格を編集';
  document.getElementById('vm_name').value=name;
  document.getElementById('visaModal').classList.add('open');
}
function closeVisaModal(){document.getElementById('visaModal').classList.remove('open');}
async function saveVisaModal(){
  const name=document.getElementById('vm_name').value.trim();
  if(!name){showToast('在留資格名を入力してください','error');return;}
  try{
    await saveVisaType(visaModalMode==='add'?null:visaModalId,name);
    await loadVisaTypes();closeVisaModal();renderSettings();
  }catch(e){showToast('保存に失敗しました：'+e.message,'error');}
}
async function deleteVisaType(id){
  const inUse=employees.some(e=>e.visa===visaTypes.find(v=>v.id===id)?.name);
  if(inUse){showToast('この在留資格は使用中のため削除できません。','warn');return;}
  if(!confirmPermanentDelete('この在留資格'))return;
  await deleteVisaTypeRecord(id);
  await loadVisaTypes();renderSettings();
}
