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
        <div style="text-align:right"><button class="btn btn-primary btn-sm" onclick="saveCompanyInfo()">保存</button></div>
      </div>

      <div class="settings-card" style="margin-bottom:20px">
        <h3>部署マスター管理</h3>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <span style="font-size:12px;color:var(--emp-text3)">☰ ドラッグで並び替え</span>
          <button class="btn btn-primary btn-sm" onclick="openDeptModal('add')">＋ 部署を追加</button>
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
              <button class="btn btn-sm" onclick="openDeptModal('edit',${d.id})">編集</button>
              <button class="btn btn-sm btn-danger" onclick="deleteDept(${d.id})">削除</button>
            </div>`).join('')}
        </div>`}
      </div>
      <div class="settings-card" style="margin-top:20px">
        <h3>在留資格マスター管理</h3>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="openVisaModal('add')">＋ 在留資格を追加</button>
        </div>
        ${visaTypes.length===0?'<div class="empty" style="padding:20px 0">在留資格が登録されていません</div>':
          visaTypes.map(v=>`
            <div class="dept-row">
              <div class="d1" style="flex:2">${v.name}</div>
              <button class="btn btn-sm" onclick="openVisaModal('edit',${v.id},'${v.name.replace(/'/g,"\\'")}')">編集</button>
              <button class="btn btn-sm btn-danger" onclick="deleteVisaType(${v.id})">削除</button>
            </div>`).join('')}
      </div>
      <div class="settings-card" style="margin-top:20px">
        <h3>勤務パターン管理（雇用契約書用）</h3>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-primary btn-sm" onclick="openWorkPatternModal()">＋ パターンを追加</button>
        </div>
        ${workPatterns.length===0?'<div class="empty" style="padding:20px 0">勤務パターンが登録されていません</div>':
          workPatterns.map(p=>`
            <div class="dept-row" style="flex-wrap:wrap">
              <div style="font-weight:500;font-size:13px;flex:1;min-width:120px">${p.name}</div>
              <div style="font-size:12px;color:var(--emp-text2);flex:2;min-width:0;word-break:break-all">
                ${p.start_time||''}〜${p.end_time||''} 休憩${p.break_minutes||60}分
                週${p.work_days_per_week||''}日 休日：${p.holidays||''}
              </div>
              <button class="btn btn-sm" onclick="openWorkPatternModal(${p.id})">編集</button>
              <button class="btn btn-sm btn-danger" onclick="deleteWorkPattern(${p.id})">削除</button>
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
  document.getElementById('wpModal').style.display='flex';
}
function closeWpModal(){document.getElementById('wpModal').style.display='none';}
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
  const e=employees.find(x=>x.id===empId);
  if(!e){showToast('従業員が見つかりません','error');return;}
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
  }).then(()=>loadCertificates()).catch(err=>console.error(err));
}

// ---- 雇用契約書 ----
let contractEmpId=null;
function emp_openContractModal(empId){
  contractEmpId=empId;
  const e=employees.find(x=>x.id===empId);
  if(!e)return;
  if(!companyInfo.company_name){showToast('設定画面で発行元情報を登録してください','warn');return;}
  const isFixed=e.employment_type!=='permanent';
  const dept=departments.find(d=>d.id===Number(e.dept_id));
  document.getElementById('contractModalBody').innerHTML=`
    <div style="font-size:12px;color:var(--emp-text2);margin-bottom:12px">
      従業員データから自動入力されています。必要に応じて修正してください。
    </div>
    <div class="field-grid" style="gap:8px">
      <div class="field"><label>契約開始日 <span style="color:var(--emp-danger)">*</span></label><input type="date" id="cm_start" value="${e.nyusha_date||''}"></div>
      ${isFixed?`<div class="field"><label>契約終了日 <span style="color:var(--emp-danger)">*</span></label><input type="date" id="cm_end" value=""></div>`:''}
      <div class="field"><label>就業場所</label><input type="text" id="cm_place" value="${dept?[dept.shozoku1,dept.shozoku2].filter(Boolean).join(' '):''}"></div>
      <div class="field"><label>業務内容</label><input type="text" id="cm_work" value="" placeholder="例：製造業務全般"></div>
      <div class="field"><label>始業時刻</label><input type="text" id="cm_start_time" value="08:00"></div>
      <div class="field"><label>終業時刻</label><input type="text" id="cm_end_time" value="17:00"></div>
      <div class="field"><label>休憩時間</label><input type="text" id="cm_break" value="60分"></div>
      <div class="field"><label>所定労働時間</label><input type="text" id="cm_work_hours" value="8時間"></div>
      <div class="field"><label>時間外労働</label><input type="text" id="cm_overtime" value="有（月45時間以内）"></div>
      <div class="field"><label>休日</label><input type="text" id="cm_holiday" value="土・日・祝日、年末年始"></div>
      <div class="field"><label>年次有給休暇</label><input type="text" id="cm_yukyu" value="労働基準法に定める日数付与"></div>
      <div class="field"><label>賃金形態</label><select id="cm_wage_type">
        <option value="monthly" ${e.kyuyo?'selected':''}>月給制</option>
        <option value="hourly" ${!e.kyuyo&&e.jikyu?'selected':''}>時給制</option>
      </select></div>
      <div class="field"><label>基本賃金</label><input type="text" id="cm_wage" value="${e.kyuyo?e.kyuyo+'円（月額）':e.jikyu?e.jikyu+'円（時給）':''}"></div>
      <div class="field"><label>賃金締め日</label><input type="text" id="cm_pay_close" value="毎月末日"></div>
      <div class="field"><label>賃金支払日</label><input type="text" id="cm_pay_date" value="翌月25日"></div>
      <div class="field"><label>昇給</label><input type="text" id="cm_raise" value="有（会社業績・本人評価による）"></div>
      <div class="field"><label>賞与</label><input type="text" id="cm_bonus" value="有（会社業績による）"></div>
      <div class="field"><label>退職金</label><input type="text" id="cm_retirement" value="無"></div>
      ${isFixed?`<div class="field"><label>契約更新</label><select id="cm_renew">
        <option value="auto">自動更新あり（条件による）</option>
        <option value="discuss">更新する場合があり得る</option>
        <option value="none">契約の更新はしない</option>
      </select></div>`:''}
      <div class="field"><label>試用期間</label><input type="text" id="cm_trial" value="入社後3ヶ月"></div>
      <div class="field"><label>社会保険</label><input type="text" id="cm_insurance" value="健康保険・厚生年金・雇用保険・労災保険に加入"></div>
    </div>`;
  document.getElementById('contractModal').style.display='flex';
}
function closeContractModal(){document.getElementById('contractModal').style.display='none';}

function generateContract(){
  const e=employees.find(x=>x.id===contractEmpId);
  if(!e)return;
  const g=id=>document.getElementById(id)?.value||'';
  const isFixed=e.employment_type!=='permanent';
  const dept=departments.find(d=>d.id===Number(e.dept_id));
  const today=new Date();
  const todayStr=`${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
  const renewMap={'auto':'自動更新あり（勤務成績・会社の経営状況等を考慮のうえ判断）','discuss':'更新する場合があり得る','none':'契約の更新はしない'};
  const renewText=isFixed?renewMap[g('cm_renew')]||'—':'—';

  const content=`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  body{font-family:'MS Mincho','Yu Mincho',serif;margin:0;padding:30px 40px;color:#000;font-size:13px;line-height:1.8}
  h1{text-align:center;font-size:20px;font-weight:bold;margin:10px 0 6px;letter-spacing:4px}
  .sub{text-align:center;font-size:12px;margin-bottom:20px;color:#333}
  .date{text-align:right;margin-bottom:16px;font-size:12px}
  .parties{display:flex;justify-content:space-between;margin-bottom:20px;font-size:12px}
  .party{width:48%}
  .party-label{font-weight:bold;border-bottom:1px solid #000;margin-bottom:4px;padding-bottom:2px}
  .section{margin:14px 0}
  .section-title{font-weight:bold;background:#f0f0f0;padding:4px 8px;margin-bottom:6px;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  td{padding:5px 8px;border:1px solid #999;vertical-align:top}
  td:first-child{width:32%;background:#f8f8f8;font-weight:bold}
  .sign-area{margin-top:30px;display:flex;justify-content:space-between}
  .sign-box{width:46%;border:1px solid #999;padding:12px;min-height:80px}
  .sign-label{font-size:11px;color:#555;margin-bottom:6px}
  .note{font-size:11px;color:#555;margin-top:16px;line-height:1.6}
  @media print{body{padding:15px 25px}h1{font-size:18px}}
</style>

<style>
/* テーマ切り替え */
body.theme-dark{background:var(--bg,#141210);color:var(--text,#F5F0EB);}
body.theme-light{background:#f5f4f0;color:#1a1a18;}
body.theme-light #sidebar{display:none!important;}
body.theme-light .topbar{display:none!important;}
body.theme-light #main{margin-left:0!important;padding:0!important;}
body.theme-light #main .page{display:none!important;}
body.theme-light #main #page-jugyoin{display:block!important;height:100dvh;overflow:auto;}
#emp-back-btn{position:fixed;top:10px;right:16px;z-index:1000;background:rgba(217,119,6,.12);color:#F59E0B;border:1px solid rgba(217,119,6,.3);border-radius:5px;padding:4px 11px;font-size:11px;cursor:pointer;display:none;font-family:'JetBrains Mono',monospace;}

</style></head>
<body class="theme-dark">
<button id="emp-back-btn" onclick="navigate('jugyoin')">← 従業員管理に戻る</button>
  <div class="date">作成日：${todayStr}</div>
  <h1>労働条件通知書兼雇用契約書</h1>
  <div class="sub">（${isFixed?'有期':'無期'}雇用契約）</div>

  <div class="parties">
    <div class="party">
      <div class="party-label">使用者（甲）</div>
      〒${companyInfo.postal_code||''}<br>
      ${companyInfo.address||''}<br>
      ${companyInfo.company_name||''}<br>
      代表者：${companyInfo.representative||''}<br>
      TEL：${companyInfo.tel||''}
    </div>
    <div class="party">
      <div class="party-label">労働者（乙）</div>
      ${e.address||''}<br>
      氏名：${e.sei} ${e.mei}　　　　㊞<br>
      生年月日：${e.birthday||''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">第１条　契約期間</div>
    <table>
      <tr><td>契約形態</td><td>${isFixed?'有期雇用契約（期間の定めあり）':'無期雇用契約（期間の定めなし）'}</td></tr>
      <tr><td>契約開始日</td><td>${g('cm_start')||'—'}</td></tr>
      ${isFixed?`<tr><td>契約終了日</td><td>${g('cm_end')||'—'}</td></tr>`:''}
      ${isFixed?`<tr><td>契約の更新</td><td>${renewText}</td></tr>`:''}
    </table>
  </div>

  <div class="section">
    <div class="section-title">第２条　就業の場所・業務内容</div>
    <table>
      <tr><td>就業場所</td><td>${g('cm_place')||'—'}</td></tr>
      <tr><td>業務内容</td><td>${g('cm_work')||'—'}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">第３条　労働時間・休憩・休日</div>
    <table>
      <tr><td>始業時刻</td><td>${g('cm_start_time')}</td></tr>
      <tr><td>終業時刻</td><td>${g('cm_end_time')}</td></tr>
      <tr><td>休憩時間</td><td>${g('cm_break')}</td></tr>
      <tr><td>所定労働時間</td><td>${g('cm_work_hours')}</td></tr>
      <tr><td>時間外労働</td><td>${g('cm_overtime')}</td></tr>
      <tr><td>休日</td><td>${g('cm_holiday')}</td></tr>
      <tr><td>年次有給休暇</td><td>${g('cm_yukyu')}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">第４条　賃金</div>
    <table>
      <tr><td>賃金形態</td><td>${g('cm_wage_type')==='monthly'?'月給制':'時給制'}</td></tr>
      <tr><td>基本賃金</td><td>${g('cm_wage')||'—'}</td></tr>
      <tr><td>賃金締め日</td><td>${g('cm_pay_close')}</td></tr>
      <tr><td>賃金支払日</td><td>${g('cm_pay_date')}</td></tr>
      <tr><td>昇給</td><td>${g('cm_raise')}</td></tr>
      <tr><td>賞与</td><td>${g('cm_bonus')}</td></tr>
      <tr><td>退職金</td><td>${g('cm_retirement')}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">第５条　試用期間・社会保険</div>
    <table>
      <tr><td>試用期間</td><td>${g('cm_trial')}</td></tr>
      <tr><td>社会保険</td><td>${g('cm_insurance')}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">第６条　退職・解雇</div>
    <table>
      <tr><td>自己都合退職</td><td>退職希望日の30日前までに書面で通知すること</td></tr>
      <tr><td>解雇</td><td>労働基準法の定めに従い、少なくとも30日前に予告するか、または30日分以上の平均賃金を支払う</td></tr>
    </table>
  </div>

  <div class="note">
    ※本契約書に定めのない事項については、就業規則その他の社内規程の定めるところによります。<br>
    ※本契約書は２通作成し、甲乙各１通を保有します。
  </div>

  <div class="sign-area">
    <div class="sign-box">
      <div class="sign-label">使用者（甲）署名欄</div>
      会社名：${companyInfo.company_name||''}<br>
      代表者：${companyInfo.representative||''}<br><br>
      署名：　　　　　　　　　㊞
    </div>
    <div class="sign-box">
      <div class="sign-label">労働者（乙）署名欄</div>
      氏名：${e.sei} ${e.mei}<br><br>
      署名：　　　　　　　　　㊞<br>
      日付：　　年　　月　　日
    </div>
  </div>
</body>
</html>`;

  closeContractModal();
  const w=window.open('','_blank','width=900,height=1100');
  w.document.write(content);
  w.document.close();
  w.onload=()=>{w.print();};

  // 雇用契約書履歴を保存
  createEmploymentContract({
    employee_id:contractEmpId,
    employee_name:e.sei+' '+e.mei,
    contract_start:g('cm_start'),
    contract_end:g('cm_end')||null,
    is_fixed:e.employment_type!=='permanent',
    source:'this_app',
    issued_date:new Date().toISOString().slice(0,10),
    issued_by:companyInfo.company_name||''
  }).then(()=>loadEmploymentContracts()).catch(err=>console.error(err));
}

// ---- 雇用契約書一覧 ----
async function renderContractList(){
  const today=new Date();
  const todayStr=today.toISOString().slice(0,10);

  // 派遣管理アプリの雇用契約書を取得
  let dispatchContracts=[];
  try{
    dispatchContracts=await fetchDispatchContractEmployeeSummaries();
  }catch(e){dispatchContracts=[];}

  // 従業員ごとの最新雇用契約書を集計
  // このアプリ: employment_contracts
  // 派遣アプリ: dispatch_contracts.contract_employees
  const empContractMap={};// employee_id -> {source, contract_end, is_active}

  // このアプリの契約
  employmentContracts.forEach(c=>{
    const id=c.employee_id;
    if(!empContractMap[id]||c.issued_date>(empContractMap[id].issued_date||''))
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
  const activeEmps=employees.filter(e=>e.status==='在籍');
  const alertEmps=activeEmps.filter(e=>{
    const ct=empContractMap[e.id];
    if(!ct)return true; // 契約書なし
    if(!ct.contract_end)return false; // 無期または終了日なし
    const days=Math.ceil((new Date(ct.contract_end)-today)/86400000);
    return days<=15; // 期限切れ or 15日以内
  });

  // 絞り込み
  const fe=(document.getElementById('fceEmp')||{}).value||'';
  const fstat=(document.getElementById('fceStatus')||{}).value||'all';
  let thisList=employmentContracts;
  if(fe)thisList=thisList.filter(r=>r.employee_id===Number(fe));

  document.getElementById('mainContent').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <span style="font-size:16px;font-weight:700">雇用契約書一覧</span>
    </div>

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
            <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${e.id})">${emp_esc(e.sei)} ${emp_esc(e.mei)}</span></td>
            <td data-label="所属" style="font-size:12px">${emp_esc(dept?.shozoku1||'—')}</td>
            <td data-label="状態">${statusLabel}</td>
            <td data-label="契約終了日" style="font-size:12px">${emp_esc(ct?.contract_end||'—')}</td>
            <td class="no-label"><button class="btn btn-sm" onclick="emp_openContractModal(${e.id})">契約書作成</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`:'<div style="background:#e8f0eb;border:1px solid #b8d4be;border-radius:var(--emp-radius);padding:12px 16px;margin-bottom:16px;font-size:13px;color:#1a5c30">✓ アラート対象の従業員はいません</div>'}

    <div style="font-size:13px;font-weight:500;margin-bottom:8px">発行履歴（このアプリ）</div>
    <div class="search-bar" style="margin-bottom:12px">
      <select id="fceEmp" onchange="renderContractList()" style="min-width:160px">
        <option value="">従業員：全て</option>
        ${employees.map(e=>`<option value="${e.id}" ${fe==e.id?'selected':''}>${e.sei} ${e.mei}</option>`).join('')}
      </select>
    </div>
    ${thisList.length===0?'<div class="empty">雇用契約書の発行履歴がありません</div>':`
    <div class="table-wrap"><table>
      <thead><tr><th>発行日</th><th>氏名</th><th>契約開始</th><th>契約終了</th><th>種別</th><th>発行元</th><th></th></tr></thead>
      <tbody>${thisList.map(r=>`<tr>
        <td data-label="発行日" style="font-size:13px">${emp_esc(r.issued_date||'—')}</td>
        <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${r.employee_id})">${emp_esc(r.employee_name||'—')}</span></td>
        <td data-label="契約開始" style="font-size:12px">${emp_esc(r.contract_start||'—')}</td>
        <td data-label="契約終了" style="font-size:12px">${emp_esc(r.contract_end||'無期')}</td>
        <td data-label="種別"><span class="badge ${r.is_fixed?'badge-warn':'badge-active'}">${r.is_fixed?'有期':'無期'}</span></td>
        <td data-label="発行元" style="font-size:12px;color:var(--emp-text2)">${emp_esc(r.issued_by||'—')}</td>
        <td class="no-label">
          <button class="btn btn-sm" onclick="emp_openContractModal(${r.employee_id})">再発行</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEmploymentContract(${r.id})" style="margin-left:4px">削除</button>
        </td>
      </tr>`).join('')}
      </tbody>
    </table></div>`}`;
}

async function deleteEmploymentContract(id){
  if(!confirmPermanentDelete('この雇用契約書の発行履歴'))return;
  await deleteEmploymentContractRecord(id);
  await loadEmploymentContracts();
  renderContractList();
}

// ---- 証明書一覧 ----
function renderCertList(){
  const fe=(document.getElementById('fcEmp')||{}).value||'';
  const ft=(document.getElementById('fcType')||{}).value||'';
  const fm=(document.getElementById('fcMonth')||{}).value||'';
  // 雇用契約書は別タブで管理するため除外
  let list=certificates.filter(r=>r.cert_type!=='雇用契約書');
  if(fe)list=list.filter(r=>r.employee_id===Number(fe));
  if(ft)list=list.filter(r=>r.cert_type===ft);
  if(fm)list=list.filter(r=>r.issued_date&&r.issued_date.startsWith(fm));

  document.getElementById('mainContent').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <span style="font-size:16px;font-weight:700">証明書発行一覧</span>
      <div class="summary-grid" style="max-width:360px;margin:0">
        <div class="scard"><div class="scard-label">発行総数</div><div class="scard-val">${list.length}</div></div>
        <div class="scard"><div class="scard-label">在職証明</div><div class="scard-val" style="color:var(--emp-info)">${certificates.filter(c=>c.cert_type==='在職証明書').length}</div></div>
        <div class="scard"><div class="scard-label">退職証明</div><div class="scard-val" style="color:var(--emp-text2)">${certificates.filter(c=>c.cert_type==='退職証明書').length}</div></div>
      </div>
    </div>
    <div class="search-bar">
      <select id="fcEmp" onchange="renderCertList()" style="min-width:160px">
        <option value="">従業員：全て</option>
        ${employees.map(e=>`<option value="${e.id}" ${fe==e.id?'selected':''}>${e.sei} ${e.mei}</option>`).join('')}
      </select>
      <select id="fcType" onchange="renderCertList()">
        <option value="">種別：全て</option>
        <option value="在職証明書" ${ft==='在職証明書'?'selected':''}>在職証明書</option>
        <option value="退職証明書" ${ft==='退職証明書'?'selected':''}>退職証明書</option>
      </select>
      <input type="month" id="fcMonth" value="${fm}" onchange="renderCertList()">
    </div>
    ${list.length===0?'<div class="empty">証明書の発行履歴がありません</div>':`
    <div class="table-wrap"><table>
      <thead><tr><th>発行日</th><th>氏名</th><th>種別</th><th>発行元</th><th></th></tr></thead>
      <tbody>${list.map(r=>`<tr>
        <td data-label="発行日" style="font-size:13px">${emp_esc(r.issued_date||'—')}</td>
        <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${r.employee_id})">${emp_esc(r.employee_name||'—')}</span></td>
        <td data-label="種別"><span class="badge ${r.cert_type==='在職証明書'?'badge-visa':'badge-retired'}">${emp_esc(r.cert_type||'—')}</span></td>
        <td data-label="発行元" style="font-size:12px;color:var(--emp-text2)">${emp_esc(r.issued_by||'—')}</td>
        <td class="no-label">
          <button class="btn btn-sm" onclick="${r.cert_type==='雇用契約書'?`emp_openContractModal(${r.employee_id})`:`reissueCert(${r.employee_id},'${r.cert_type==='在職証明書'?'zaishoku':'taishoku'}')`}">再発行</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCert(${r.id})" style="margin-left:4px">削除</button>
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
  document.getElementById('visaModal').style.display='flex';
}
function closeVisaModal(){document.getElementById('visaModal').style.display='none';}
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

