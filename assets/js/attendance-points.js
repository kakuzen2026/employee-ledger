// Derived from saved records; never persist totals or change paid-leave balances.
function attendancePoints(record){
  const planned={'全日':1,'半休（午前）':0.5,'半休（午後）':0.5,'欠勤':1,'遅刻':0.5,'早退':0.5};
  if(!Object.hasOwn(planned,record.use_type))return null;
  if(record.kubun==='突発')return 10;
  return record.kubun==='計画'?planned[record.use_type]:null;
}
function attendanceMonth(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;
  const parsed=new Date(date+'T00:00:00Z');
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date.slice(0,7):null;
}
function attendanceSummary(records,employeeId,year){
  const months=Array.from({length:12},()=>({points:0,unknown:0,count:0}));
  let invalidDates=0;
  records.filter(r=>Number(r.employee_id)===Number(employeeId)).forEach(r=>{
    const month=attendanceMonth(r.use_date);
    if(!month){invalidDates++;return;}
    if(month.slice(0,4)!==String(year))return;
    const bucket=months[Number(month.slice(5))-1];
    const points=attendancePoints(r);bucket.count++;
    if(points===null)bucket.unknown++;else bucket.points+=points;
  });
  const quarters=Array.from({length:4},(_,q)=>{
    const part=months.slice(q*3,q*3+3);
    const points=part.reduce((s,m)=>s+m.points,0);
    const unknown=part.reduce((s,m)=>s+m.unknown,0)+invalidDates;
    return {points,unknown,eligible:unknown?null:points<=3};
  });
  return {months,quarters,invalidDates};
}
let attendanceYear=new Date().getFullYear();
let attendanceQuarter=Math.floor(new Date().getMonth()/3);
function attendanceReportHtml(employeeList){
  if(!attendanceRecordsReady||!attendanceEmployeesReady)return `<section><h2 style="font-size:16px">勤怠ポイント・皆勤手当</h2><p role="alert">従業員一覧または勤怠記録を読み込めていないため、集計・判定を保留しています。</p><button class="btn" onclick="retryAttendanceLoad()">再読み込み</button></section>`;
  const start=attendanceQuarter*3;
  const year=attendanceYear;
  return `<section style="margin:0 0 24px">
    <h2 style="font-size:16px">勤怠ポイント・皆勤手当</h2>
    <p style="font-size:13px;line-height:1.8">計画：有休全日・欠勤 1pt／有休半日・遅刻・早退 0.5pt。突発：すべて1件10pt。四半期合計3pt以下が手当対象です。</p>
    <div class="search-bar">
      <label>集計年 <input id="attendanceYear" type="number" min="1900" max="9999" value="${year}" style="width:100px" onchange="changeAttendancePeriod()"></label>
      <label>期間 <select id="attendanceQuarter" onchange="changeAttendancePeriod()">${[0,1,2,3].map(q=>`<option value="${q}" ${q===attendanceQuarter?'selected':''}>${q*3+1}〜${q*3+3}月</option>`).join('')}</select></label>
      <button class="btn btn-sm" onclick="exportAttendanceCSV()">集計CSV</button>
    </div>
    <p style="font-size:12px;color:var(--emp-text2)">登録済みの記録による判定です。期間中は暫定です。区分未分類・内容不明・日付不明がある場合は判定を保留します。記録なしは0ptです。</p>
    <div class="table-wrap"><table><thead><tr><th>氏名</th>${[0,1,2].map(i=>`<th>${start+i+1}月</th>`).join('')}<th>3か月合計</th><th>皆勤手当</th></tr></thead>
    <tbody>${employeeList.map(e=>{
      const summary=attendanceSummary(yukyuRecords,e.id,year),q=summary.quarters[attendanceQuarter];
      return `<tr><td data-label="氏名">${emp_esc(e.sei)} ${emp_esc(e.mei)}</td>${summary.months.slice(start,start+3).map((m,i)=>`<td data-label="${start+i+1}月">${m.points}pt${m.unknown?`（未分類等${m.unknown}件）`:''}</td>`).join('')}<td data-label="3か月合計">${q.points}pt${q.unknown?'（未確定）':''}</td><td data-label="皆勤手当"><strong>皆勤手当：${q.eligible===null?'保留':q.eligible?'対象':'対象外'}</strong>${summary.invalidDates?`・日付不明${summary.invalidDates}件`:''}</td></tr>`;
    }).join('')||'<tr><td colspan="6">該当する従業員がいません</td></tr>'}</tbody></table></div>
  </section>`;
}
function changeAttendancePeriod(){
  const year=Number(document.getElementById('attendanceYear').value);
  const quarter=Number(document.getElementById('attendanceQuarter').value);
  if(!Number.isInteger(year)||year<1900||year>9999||![0,1,2,3].includes(quarter)){
    showToast('集計年は1900〜9999年で入力してください','error');return;
  }
  attendanceYear=year;attendanceQuarter=quarter;renderYukyuList();
}
function attendanceFilteredEmployees(query='',employeeId=''){
  return employees.filter(e=>(!employeeId||Number(e.id)===Number(employeeId))&&(!query||employeeSearchText(e).includes(query.toLowerCase())));
}
async function retryAttendanceLoad(){
  const results=await Promise.allSettled([loadEmployees(),loadYukyu()]);
  if(results.some(result=>result.status==='rejected'))showToast('従業員一覧または勤怠記録を読み込めませんでした','error');
  renderYukyuList();
}
function exportAttendanceCSV(){
  if(!attendanceRecordsReady||!attendanceEmployeesReady){showToast('従業員一覧と勤怠記録を再読み込みしてください','error');return;}
  const query=document.getElementById('fyQ')?.value||'',employeeId=document.getElementById('fyEmp')?.value||'';
  const start=attendanceQuarter*3;
  const rows=attendanceFilteredEmployees(query,employeeId).map(e=>{
    const s=attendanceSummary(yukyuRecords,e.id,attendanceYear),q=s.quarters[attendanceQuarter];
    return [attendanceYear,`${start+1}〜${start+3}月`,e.shain_no||'',`${e.sei} ${e.mei}`,...s.months.slice(start,start+3).map(m=>m.points),q.points,q.unknown,q.eligible===null?'保留':q.eligible?'対象':'対象外'];
  });
  const header=['年','期間','社員番号','氏名',...Array.from({length:3},(_,i)=>`${start+i+1}月pt`),'合計pt','未分類等件数','皆勤手当（登録済み記録による判定）'];
  dlCSV([header,...rows.map(row=>row.map(v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"'))],`勤怠ポイント_${attendanceYear}_${start+1}-${start+3}月`);
}
