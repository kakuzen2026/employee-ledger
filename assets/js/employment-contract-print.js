// Printable contract based on the supplied Excel structure. All employee and
// employer values are passed in; the print renderer never reads live records.
function buildEmploymentContractContent(employee,terms,todayStr){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=value=>esc(value||'—');
  const isFixed=terms.contract_type==='fixed';
  const labels={
    renew:{auto:'自動的に更新する',possible:'更新する場合がある',none:'更新しない'},
    renew_limit:{none:'無',yes:'有'},
    work_system:{fixed:'固定時間制',shift:'交替制・シフト制',variable:'変形労働時間制',flex:'フレックスタイム制',other:'その他'},
    yes_no:{yes:'有',no:'無',rules:'就業規則・会社規定による'},
    wage_type:{monthly:'月給',daily:'日給',hourly:'時間給',other:'その他'}
  };
  const label=(group,value)=>labels[group]?.[value]||value||'—';
  const row=(name,value)=>`<tr><th scope="row">${esc(name)}</th><td colspan="2">${text(value)}</td></tr>`;
  const group=(name,rows)=>rows.map(([title,value],i)=>`<tr>${i===0?`<th scope="rowgroup" rowspan="${rows.length}">${esc(name)}</th>`:''}<th class="subhead" scope="row">${esc(title)}</th><td>${text(value)}</td></tr>`).join('');
  const schedule=terms.work_system==='shift'?terms.shift_schedule:`${terms.start_time}〜${terms.end_time}　休憩 ${terms.break}`;
  const other=[terms.dismissal,terms.trial?`試用期間：${terms.trial}`:'',terms.trial_detail,terms.resignation,
    isFixed?'雇用契約期間が満了したときは、更新しない場合は雇用終了となる。':'',terms.other_terms,
    isFixed?terms.indefinite_conversion:''].filter(Boolean).join('\n');
  const employeeName=`${employee.sei||''} ${employee.mei||''}`.trim();
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>雇用契約書</title>
<style>
  @page{size:A4;margin:7mm}
  *{box-sizing:border-box}
  body{font-family:'Yu Mincho','Hiragino Mincho ProN',serif;margin:0;color:#111;font-size:9px;line-height:1.3}
  h1{text-align:center;font-size:20px;font-weight:normal;letter-spacing:3px;margin:0 0 2mm}
  table{width:calc(100% - 1px);border-collapse:collapse;table-layout:fixed}
  th,td{border:1px solid #222;padding:.55mm 1.5mm;white-space:pre-wrap;overflow-wrap:anywhere;vertical-align:middle}
  th{font-weight:normal;text-align:center}
  .subhead{text-align:left}
  tr{break-inside:avoid;page-break-inside:avoid}
  .signature{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:2mm;break-inside:avoid}
  .signature p{margin:.6mm 0}
  .signature-space{min-height:6mm;padding-top:2mm}
  .employer-signature{display:grid;grid-template-columns:1fr 22mm;gap:2mm;align-items:center}
  .employer-seal{width:22mm;height:22mm;object-fit:contain}
  .agreement{margin:2mm 0 1mm}
  .date{margin:1mm 0}
  .explanation{margin:1mm 0}
  @media screen{body{max-width:196mm;margin:7mm auto;padding:0 3mm}}
</style></head><body>
  <h1>雇用契約書</h1>
  <table aria-label="雇用契約条件"><colgroup><col style="width:19%"><col style="width:22%"><col style="width:59%"></colgroup>
    ${row('契約期間',`${terms.start} 〜 ${isFixed?terms.end:'期間の定めなし'}　　契約区分：${isFixed?'有期契約':'無期契約'}`)}
    ${row('就業の場所',`${terms.place}\n就業場所の変更範囲：${terms.place_scope}`)}
    ${row('従事すべき業務内容',`${terms.work}\n業務内容の変更範囲：${terms.work_scope}`)}
    ${group('始業・終業の時刻、\n休憩時間、所定時間外・\n休日労働の有無',[
      ['始業・終業／休憩',`${schedule}\n勤務制度：${label('work_system',terms.work_system)}／勤務日：${terms.work_days}\n所定労働時間：${terms.work_hours}`],
      ['所定時間外労働',`${label('yes_no',terms.overtime)}${terms.overtime_detail?`：${terms.overtime_detail}`:''}`],
      ['休日労働',`${label('yes_no',terms.holiday_work)}${terms.holiday_work_detail?`：${terms.holiday_work_detail}`:''}`]
    ])}
    ${row('休日',terms.holiday)}
    ${row('休暇',[terms.yukyu,terms.other_leave].filter(Boolean).join('\n'))}
    ${row('加入保険',`${terms.social_insurance||'—'}　雇用保険：${terms.employment_insurance||'—'}`)}
    ${group('賃金',[
      ['1. 基本給',`${label('wage_type',terms.wage_type)}　${terms.wage}`],['2. 諸手当',terms.allowances],
      ['3. 割増賃金率',`法定時間外 ${terms.premium_overtime||'—'}、法定休日 ${terms.premium_holiday||'—'}、深夜 ${terms.premium_night||'—'}、60時間超 ${terms.premium_overtime_over60||'—'}`],
      ['4. 賃金締切日',terms.pay_close],['5. 賃金支払日・方法',`${terms.pay_date}／${terms.pay_method}`],
      ['6. 賃金改定',`${label('yes_no',terms.raise)}${terms.raise_detail?`（${terms.raise_detail}）`:''}`],
      ['7. 賞与',label('yes_no',terms.bonus)],['8. 退職金・定年',`退職金：${label('yes_no',terms.retirement)}／定年制・継続雇用：${terms.retirement_age||'—'}`],['9. 賃金からの控除',terms.deductions]
    ])}
    ${isFixed?group('更新の有無',[
      ['1. 更新の有無',label('renew',terms.renew)],['2. 更新の上限',`${label('renew_limit',terms.renew_limit)}${terms.renew_limit==='yes'?`（${terms.renew_limit_detail}）`:''}`],['3. 更新の判断基準',terms.renew_criteria]
    ]):row('更新の有無','該当なし（無期契約）')}
    ${row('解雇、退職、懲戒、\n服務規律、契約解除、\nその他',other)}
    ${row('相談窓口',`${terms.consultation}\n待遇差の説明請求窓口：${terms.treatment_explanation}`)}
    ${row('適用される就業規則',`${terms.rules}\n就業規則の確認方法・場所：${terms.rules_access}`)}
  </table>
  ${isFixed?'<p class="explanation">短時間・有期雇用労働者は、通常の労働者との待遇差の内容および理由について、使用者に説明を求めることができます。</p>':''}
  <div class="agreement">上記条件で雇用契約を締結する。本契約書は甲乙1部ずつ作成し、各々で保管する。</div>
  <div class="date">作成日：${text(todayStr)}　　契約締結日：　　　年　　月　　日</div>
  <div class="signature">
    <div class="employer-signature"><div><p>雇用者（甲）</p><p>〒${text(terms.employer_postal_code)} ${text(terms.employer_address)}</p><p>${text(terms.employer_name)}</p><p>${text(terms.employer_representative)}</p><p>TEL：${text(terms.employer_tel)}</p><div class="signature-space">使用者（甲）署名欄：　　　　　　　　　</div></div>${isEmploymentContractSeal(terms.employer_seal)?`<img class="employer-seal" src="${esc(terms.employer_seal)}" alt="雇用者の電子印">`:'<span>印</span>'}</div>
    <div><p>被雇用者（乙）</p><p>住所：${text(employee.address)}</p><p>氏名：${text(employeeName)}</p><p>生年月日：${text(employee.birthday)}</p><div class="signature-space">労働者（乙）署名欄：　　　　　　　　印</div></div>
  </div>
</body></html>`;
}

function isEmploymentContractSeal(value){
  return typeof value==='string'&&value.length<=350000&&/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
