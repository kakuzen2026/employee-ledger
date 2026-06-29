// ---- 健康診断一覧 ----
function renderKenkoList(){
  const fe=(document.getElementById('fkEmp')||{}).value||'';
  const fr=(document.getElementById('fkResult')||{}).value||'';
  const fm=(document.getElementById('fkMonth')||{}).value||'';

  // 全従業員の健康診断記録をフラット化
  let allRecs=[];
  employees.forEach(e=>{
    (e.kenkou_list||[]).forEach((k,i)=>{
      allRecs.push({...k,empId:e.id,empName:e.sei+' '+e.mei,empKana:(e.seikana||'')+' '+(e.meikana||''),idx:i});
    });
  });
  allRecs.sort((a,b)=>b.date.localeCompare(a.date));

  if(fe)allRecs=allRecs.filter(r=>r.empId===Number(fe));
  if(fr)allRecs=allRecs.filter(r=>r.result===fr);
  if(fm)allRecs=allRecs.filter(r=>r.date&&r.date.startsWith(fm));

  const total=allRecs.length;
  const ijou=allRecs.filter(r=>r.result==='異常なし').length;
  const youkeka=allRecs.filter(r=>r.result==='要経過観察').length;
  const yousei=allRecs.filter(r=>r.result==='要精密検査').length;

  // 健康診断登録フォーム用の状態
  const kfEmp=(document.getElementById('kfEmp')||{}).value||'';
  const kfDate=(document.getElementById('kfDate')||{}).value||new Date().toISOString().slice(0,10);
  const kfResult=(document.getElementById('kfResult')||{}).value||CHECKRES[0];

  document.getElementById('mainContent').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <span style="font-size:16px;font-weight:700">健康診断管理</span>
      <button class="btn btn-sm" onclick="exportKenkoCSV()">CSV出力</button>
    </div>

    <div class="summary-grid" style="max-width:500px;margin-bottom:16px">
      <div class="scard"><div class="scard-label">記録総数</div><div class="scard-val">${total}</div></div>
      <div class="scard"><div class="scard-label">異常なし</div><div class="scard-val" style="color:#1a5c30">${ijou}</div></div>
      <div class="scard"><div class="scard-label">要経過観察</div><div class="scard-val" style="color:var(--emp-warn)">${youkeka}</div></div>
      <div class="scard"><div class="scard-label">要精密検査</div><div class="scard-val" style="color:var(--emp-danger)">${yousei}</div></div>
    </div>

    <!-- 新規登録フォーム -->
    <div style="background:var(--emp-surface);border:1px solid var(--emp-border);border-radius:var(--emp-radius-lg);padding:16px;margin-bottom:16px;max-width:760px">
      <div style="font-size:13px;font-weight:500;margin-bottom:12px">＋ 健康診断を登録</div>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div style="min-width:180px;flex:1">
          <div style="font-size:12px;color:var(--emp-text2);margin-bottom:4px">従業員</div>
          <select id="kfEmp" style="width:100%;padding:7px 10px;border:1px solid var(--emp-border2);border-radius:var(--emp-radius);font-size:13px;font-family:inherit">
            <option value="">選択してください</option>
            ${employees.filter(e=>e.status==='在籍').map(e=>`<option value="${e.id}">${e.sei} ${e.mei}</option>`).join('')}
          </select>
        </div>
        <div>
          <div style="font-size:12px;color:var(--emp-text2);margin-bottom:4px">受診日</div>
          <input type="date" id="kfDate" value="${new Date().toISOString().slice(0,10)}" style="padding:7px 10px;border:1px solid var(--emp-border2);border-radius:var(--emp-radius);font-size:13px;font-family:inherit">
        </div>
        <div>
          <div style="font-size:12px;color:var(--emp-text2);margin-bottom:4px">結果</div>
          <select id="kfResult" style="padding:7px 10px;border:1px solid var(--emp-border2);border-radius:var(--emp-radius);font-size:13px;font-family:inherit">
            ${CHECKRES.map(r=>`<option>${r}</option>`).join('')}
          </select>
        </div>
        <div>
          <div style="font-size:12px;color:var(--emp-text2);margin-bottom:4px">写真</div>
          <label class="btn btn-sm" style="cursor:pointer;display:inline-block">添付<input type="file" accept="image/*" id="kfImg" style="display:none" onchange="previewKfImg(this)"></label>
          <span id="kfImgName" style="font-size:12px;color:var(--emp-text2);margin-left:4px"></span>
        </div>
        <button class="btn btn-primary" onclick="addKenkoFromList()">登録</button>
      </div>
    </div>

    <!-- 絞り込み -->
    <div class="search-bar">
      <select id="fkEmp" onchange="renderKenkoList()" style="min-width:160px">
        <option value="">従業員：全て</option>
        ${employees.map(e=>`<option value="${e.id}" ${fe==e.id?'selected':''}>${e.sei} ${e.mei}</option>`).join('')}
      </select>
      <select id="fkResult" onchange="renderKenkoList()">
        <option value="">結果：全て</option>
        ${CHECKRES.map(r=>`<option value="${r}" ${fr===r?'selected':''}>${r}</option>`).join('')}
      </select>
      <input type="month" id="fkMonth" value="${fm}" onchange="renderKenkoList()">
    </div>

    ${allRecs.length===0?'<div class="empty">健康診断記録がありません</div>':`
    <div class="table-wrap"><table>
      <thead><tr><th>受診日</th><th>氏名</th><th>結果</th><th>写真</th><th></th></tr></thead>
      <tbody>${allRecs.map(r=>`<tr>
        <td data-label="受診日" style="font-size:13px">${emp_esc(r.date||'—')}</td>
        <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${r.empId})">${emp_esc(r.empName)}<br><span style="font-size:11px;color:var(--emp-text2)">${emp_esc(r.empKana.trim())}</span></span></td>
        <td data-label="結果"><span class="badge ${r.result==='異常なし'?'badge-active':r.result==='要精密検査'?'badge-danger':'badge-warn'}">${emp_esc(r.result||'—')}</span></td>
        <td data-label="写真">${r.img?`<img src="${emp_esc(r.img)}" style="height:36px;border-radius:4px;cursor:pointer" onclick="window.open(this.src)">`:'—'}</td>
        <td class="no-label"><button class="btn btn-sm btn-danger" onclick="delKenkoFromList(${r.empId},${r.idx})">削除</button></td>
      </tr>`).join('')}
      </tbody>
    </table></div>`}`;
}

let kfImgData='';
function previewKfImg(input){
  const f=input.files[0];if(!f)return;
  document.getElementById('kfImgName').textContent=f.name+'（圧縮中…）';
  compressImage(f).then(data=>{kfImgData=data;document.getElementById('kfImgName').textContent=f.name;});
}
async function addKenkoFromList(){
  const empId=document.getElementById('kfEmp')?.value;
  if(!empId){showToast('従業員を選択してください','error');return;}
  const d=document.getElementById('kfDate')?.value;
  if(!d){showToast('受診日を入力してください','error');return;}
  const result=document.getElementById('kfResult')?.value;
  const e=employees.find(x=>x.id===Number(empId));
  e.kenkou_list=e.kenkou_list||[];
  e.kenkou_list.push({date:d,result,img:kfImgData});
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateEmployeeKenko(empId,e.kenkou_list,e.updated_at);
  kfImgData='';
  await loadEmployees();
  renderKenkoList();
}
async function delKenkoFromList(empId,idx){
  if(!confirmPermanentDelete('この健康診断記録'))return;
  const e=employees.find(x=>x.id===empId);
  e.kenkou_list.splice(idx,1);
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateEmployeeKenko(empId,e.kenkou_list,e.updated_at);
  await loadEmployees();
  renderKenkoList();
}
function exportKenkoCSV(){
  const h=['受診日','氏名','姓カナ','名カナ','結果'];
  const rows=[];
  employees.forEach(e=>{
    (e.kenkou_list||[]).forEach(k=>{
      rows.push([k.date,e.sei+' '+e.mei,e.seikana||'',e.meikana||'',k.result].map(v=>'"'+(v||'').toString().replace(/"/g,'""')+'"'));
    });
  });
  rows.sort((a,b)=>b[0].localeCompare(a[0]));
  dlCSV([h.map(v=>'"'+v+'"'),...rows],'健康診断記録');
}

