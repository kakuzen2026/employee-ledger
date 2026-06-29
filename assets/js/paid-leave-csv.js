// ---- 有給一覧 ----
function renderYukyuList(){
  const fq=(document.getElementById('fyQ')||{}).value||'';
  const fe=(document.getElementById('fyEmp')||{}).value||'';
  const fm=(document.getElementById('fyMonth')||{}).value||'';
  let list=yukyuRecords;
  if(fq)list=list.filter(r=>{
    const e=employees.find(x=>x.id===Number(r.employee_id));
    return(employeeSearchText(e)+(r.employee_name||'').toLowerCase()).includes(fq.toLowerCase());
  });
  if(fe)list=list.filter(r=>r.employee_id===Number(fe));
  if(fm)list=list.filter(r=>r.use_date&&r.use_date.startsWith(fm));

  // 在籍中全員の残日数一覧
  const activeEmps=employees.filter(e=>e.status==='在籍'&&(!fq||employeeSearchText(e).includes(fq.toLowerCase())));
  document.getElementById('mainContent').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <span style="font-size:16px;font-weight:700">有給管理</span>
      <div style="display:flex;gap:8px"><button class="btn btn-sm" onclick="exportYukyuCSV()">CSV出力</button><button class="btn btn-primary btn-sm" onclick="showView('yukyu_add')">＋ 有給登録</button></div>
    </div>

    <div class="search-bar">
      <input id="fyQ" placeholder="氏名・部署・在留資格で検索" value="${emp_attr(fq)}" onkeydown="if(event.key==='Enter'&&!event.isComposing)renderYukyuList();">
      <button onclick="renderYukyuList()" style="padding:7px 14px;border-radius:8px;border:1px solid var(--emp-border2);background:var(--emp-accent);color:#fff;font-size:13px;cursor:pointer;white-space:nowrap;">検索</button>
      <select id="fyEmp" onchange="renderYukyuList()" style="min-width:160px">
        <option value="">従業員：全て</option>
        ${employees.map(e=>`<option value="${e.id}" ${fe==e.id?'selected':''}>${e.sei} ${e.mei}</option>`).join('')}
      </select>
      <input type="month" id="fyMonth" value="${fm}" onchange="renderYukyuList()">
    </div>

    <div style="font-size:13px;font-weight:500;margin-bottom:8px">残日数一覧（在籍中）</div>
    <div class="table-wrap" style="margin-bottom:20px"><table>
      <thead><tr><th>氏名</th><th>所属</th><th>残日数</th><th>付与合計</th><th>取得合計</th><th>次回付与日</th><th></th></tr></thead>
      <tbody>${activeEmps.map(e=>{
        const info=calcYukyuInfo(e.id);
        return`<tr>
          <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${e.id})">${emp_esc(e.sei)} ${emp_esc(e.mei)}</span></td>
          <td data-label="所属" style="font-size:12px;color:var(--emp-text2)">${emp_esc(deptLabelById(e.dept_id)||'—')}</td>
          <td data-label="残日数"><span style="font-weight:700;color:${info.remaining>0?'#1a5c30':'var(--emp-text2)'}">${info.remaining}日</span></td>
          <td data-label="付与合計" style="font-size:13px">${info.granted}日</td>
          <td data-label="取得合計" style="font-size:13px">${info.used}日</td>
          <td data-label="次回付与日" style="font-size:12px;color:var(--emp-text2)">${emp_esc(info.nextDate||'—')}</td>
          <td class="no-label"><button class="btn btn-sm" onclick="detailTab='yukyu';viewingId=${e.id};currentView='detail';render()">詳細</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>

    <div style="font-size:13px;font-weight:500;margin-bottom:8px">取得履歴</div>
    ${list.length===0?'<div class="empty">有給記録がありません</div>':`
    <div class="table-wrap"><table>
      <thead><tr><th>使用日</th><th>氏名</th><th>使用内容</th><th>種別</th><th>区分</th><th>入力者</th><th>登録日</th><th>備考</th><th></th></tr></thead>
      <tbody>${list.map(r=>`<tr>
        <td data-label="使用日">${emp_esc(r.use_date||'—')}</td>
        <td data-label="氏名"><span class="emp-name" onclick="viewDetail(${r.employee_id})">${emp_esc(r.employee_name||'—')}</span></td>
        <td data-label="使用内容"><span class="badge badge-visa">${emp_esc(r.use_type||'—')}</span></td>
        <td data-label="種別"><span class="chip">${emp_esc(r.shubetsu||'—')}</span></td>
        <td data-label="区分"><span class="chip">${emp_esc(r.kubun||'—')}</span></td>
        <td data-label="入力者">${emp_esc(r.input_by||'—')}</td>
        <td data-label="登録日" style="font-size:12px;color:var(--emp-text3)">${emp_esc(r.touroku_date||'—')}</td>
        <td data-label="備考" style="font-size:12px;color:var(--emp-text2);max-width:140px">${emp_esc(r.biko||'')}</td>
        <td class="no-label"><button class="btn btn-sm btn-danger" onclick="delYR(${r.id})">削除</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`}`;
}
async function delYR(id){
  if(!confirmPermanentDelete('この有給記録'))return;
  await deleteYukyuRecord(id);await loadYukyu();
  if(currentView==='yukyu_list')renderYukyuList();else renderDT();
}

function toggleKousoku(id,useKousoku,btn){
  btn.closest('.sel-group').querySelectorAll('.sel-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  const row=document.getElementById('kousokuDateRow');
  const note=row?.nextElementSibling;
  if(useKousoku){
    if(row)row.style.display='flex';
    if(note)note.style.display='none';
  } else {
    if(row)row.style.display='none';
    // 参照しないを選んだら即座にクリア保存
    saveKousokuDate(id,true);
  }
}
async function saveKousokuDate(id,clear=false){
  const d=clear?'':document.getElementById('kousokuInput')?.value||'';
  const e=employees.find(x=>x.id===id);
  e.kousoku_start_date=d;
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateKousokuStartDate(id,d,e.updated_at);
  if(!clear)showToast('保存しました');
  renderDT();
}

// ---- 有給付与 ----
let grantEmpId=null,grantEditId=null;
function openGrantModal(empId,editGrantId=null){
  grantEmpId=empId;grantEditId=editGrantId;
  document.getElementById('grantModalTitle').textContent=editGrantId?'有給付与を編集':'有給付与を登録';
  if(editGrantId){
    const g=yukyuGrants.find(x=>x.id===editGrantId);
    document.getElementById('gm_date').value=g?.grant_date||'';
    document.getElementById('gm_days').value=g?.days!=null?g.days:'';
    document.getElementById('gm_expire').value=g?.expire_date||'';
  } else {
    const info=calcYukyuInfo(empId);
    document.getElementById('gm_date').value=info.nextDate||new Date().toISOString().slice(0,10);
    document.getElementById('gm_days').value='';
    document.getElementById('gm_expire').value='';
  }
  document.getElementById('grantModal').style.display='flex';
}
function closeGrantModal(){document.getElementById('grantModal').style.display='none';}
async function saveGrant(){
  const d=document.getElementById('gm_date').value;
  if(!d){showToast('付与日は必須です','error');return;}
  const daysVal=document.getElementById('gm_days').value;
  const days=daysVal!==''?Number(daysVal):null;
  let expire=document.getElementById('gm_expire').value;
  if(!expire){
    const ed=new Date(d);ed.setFullYear(ed.getFullYear()+2);ed.setDate(ed.getDate()-1);
    expire=ed.toISOString().slice(0,10);
  }
  try{
    if(grantEditId){
      await saveYukyuGrant(grantEditId,{grant_date:d,days,expire_date:expire});
    } else {
      await saveYukyuGrant(null,{employee_id:grantEmpId,grant_date:d,days,expire_date:expire});
    }
    await loadGrants();closeGrantModal();renderDT();
  }catch(e){showToast('保存に失敗しました：'+e.message,'error');}
}
async function delGrant(id,empId){
  if(!confirmPermanentDelete('この付与記録'))return;
  await deleteYukyuGrant(id);
  await loadGrants();renderDT();
}

// ---- 有給登録 ----
function openYukyuFromDetail(empId){
  const e=employees.find(x=>x.id===empId);
  yf={employee_id:empId,employee_name:e.sei+' '+e.mei,use_type:'',shubetsu:'',kubun:'',input_by:''};
  yfFromDetail=true;currentView='yukyu_add';setNav('tYukyuAdd');renderYukyuAdd();
}
function renderYukyuAdd(){
  document.getElementById('mainContent').innerHTML=`
    <div class="sticky-back">
      <button class="btn btn-sm" onclick="${yfFromDetail?`detailTab='yukyu';currentView='detail';yfFromDetail=false;render()`:"showView('yukyu_list')"}">← 戻る</button>
      <h2>有給登録</h2>
    </div>
    <div class="yukyu-form">
      <div class="frow">
        <label>従業員を選択 <span style="color:var(--emp-danger)">*</span></label>
        ${yf.employee_id?`
          <div class="emp-selected-box">
            <span style="font-weight:500;font-size:14px">${yf.employee_name}</span>
            ${!yfFromDetail?`<button class="btn btn-sm" style="margin-left:auto" onclick="yf.employee_id=null;yf.employee_name='';renderYukyuAdd()">変更</button>`:''}
          </div>`:`
          <div class="emp-search-wrap">
            <input class="emp-search-input" id="empQ" placeholder="氏名で検索して選択..." oninput="filterEmpDD()" onfocus="showEmpDD()" onblur="setTimeout(hideEmpDD,200)" autocomplete="off">
            <div class="emp-dropdown" id="empDD">${empDDItems('')}</div>
          </div>`}
      </div>
      <div class="frow"><label>使用日 <span style="color:var(--emp-danger)">*</span></label><input type="date" id="yDate" value="${new Date().toISOString().slice(0,10)}" style="max-width:200px"></div>
      <div class="frow"><label>使用内容 <span style="color:var(--emp-danger)">*</span></label><div class="sel-group">${USE_TYPES.map(t=>`<button class="sel-btn ${yf.use_type===t?'selected':''}" onclick="selYF('use_type','${t}',this)">${t}</button>`).join('')}</div></div>
      <div class="frow"><label>種別 <span style="color:var(--emp-danger)">*</span></label><div class="sel-group">${SHUBETSU.map(t=>`<button class="sel-btn ${yf.shubetsu===t?'selected':''}" onclick="selYF('shubetsu','${t}',this)">${t}</button>`).join('')}</div></div>
      <div class="frow"><label>区分 <span style="color:var(--emp-danger)">*</span></label><div class="sel-group">${KUBUN.map(t=>`<button class="sel-btn ${yf.kubun===t?'selected':''}" onclick="selYF('kubun','${t}',this)">${t}</button>`).join('')}</div></div>
      <div class="frow"><label>入力者 <span style="color:var(--emp-danger)">*</span></label><div class="sel-group">${INPUT_BY.map(t=>`<button class="sel-btn ${yf.input_by===t?'selected':''}" onclick="selYF('input_by','${t}',this)">${t}</button>`).join('')}</div></div>
      <div class="frow"><label>備考</label><textarea id="yBiko" rows="3" style="max-width:500px"></textarea></div>
      <div style="height:80px"></div>
    </div>
    <div class="sticky-footer">
      <button class="btn" onclick="${yfFromDetail?`detailTab='yukyu';currentView='detail';yfFromDetail=false;render()`:"showView('yukyu_list')"}">キャンセル</button>
      <button class="btn btn-primary" onclick="saveYR()">登録する</button>
    </div>`;
}
function empDDItems(q){
  return employees.filter(e=>e.status==='在籍'&&(!q||(e.sei+e.mei+(e.seikana||'')+(e.meikana||'')+(e.shain_no||'')).toLowerCase().includes(q.toLowerCase())))
    .map(e=>`<div class="emp-option" onclick="pickEmp(${e.id},'${e.sei} ${e.mei}')">
      <div style="font-weight:500">${e.sei} ${e.mei}</div>
      <div style="font-size:11px;color:var(--emp-text3);display:flex;gap:8px;margin-top:2px">
        ${e.seikana||e.meikana?`<span>${e.seikana||''} ${e.meikana||''}</span>`:''}
        ${e.shain_no?`<span>No.${e.shain_no}</span>`:''}
        <span>${deptLabelById(e.dept_id)||''}</span>
      </div>
    </div>`).join('');
}
function showEmpDD(){document.getElementById('empDD')?.classList.add('show');}
function hideEmpDD(){document.getElementById('empDD')?.classList.remove('show');}
function filterEmpDD(){const q=document.getElementById('empQ')?.value||'';const d=document.getElementById('empDD');if(d){d.innerHTML=empDDItems(q);d.classList.add('show');}}
function pickEmp(id,name){yf.employee_id=id;yf.employee_name=name;renderYukyuAdd();}
function selYF(key,val,btn){yf[key]=val;btn.closest('.sel-group').querySelectorAll('.sel-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');}
async function saveYR(){
  if(!yf.employee_id){showToast('従業員を選択してください','error');return;}
  const d=document.getElementById('yDate')?.value;
  if(!d){showToast('使用日を入力してください','error');return;}
  if(!yf.use_type){showToast('使用内容を選択してください','error');return;}
  if(!yf.shubetsu){showToast('種別を選択してください','error');return;}
  if(!yf.kubun){showToast('区分を選択してください','error');return;}
  if(!yf.input_by){showToast('入力者を選択してください','error');return;}
  try{
    await createYukyuRecord({employee_id:yf.employee_id,employee_name:yf.employee_name,use_date:d,use_type:yf.use_type,shubetsu:yf.shubetsu,kubun:yf.kubun,input_by:yf.input_by,touroku_date:new Date().toISOString().slice(0,10),biko:document.getElementById('yBiko')?.value||''});
    await loadYukyu();showToast('登録しました');
    if(yfFromDetail){detailTab='yukyu';currentView='detail';yfFromDetail=false;render();}
    else showView('yukyu_list');
  }catch(e){showToast('登録に失敗しました：'+e.message,'error');}
}

// ---- 従業員フォーム ----
function renderForm(id){
  const isEdit=id!==null,e=isEdit?employees.find(x=>x.id===id):{};
  rcImgData=e.residence_card||'';
  licFormImgData='';
  skFormImgData=(e.shikaku_list||[]).slice(0,3).map(s=>s.img||'');
  while(skFormImgData.length<3)skFormImgData.push('');
  document.getElementById('mainContent').innerHTML=`
    <div class="sticky-back">
      <button class="btn btn-sm" onclick="currentView='list';render()">← 一覧</button>
      <h2>${isEdit?'従業員情報を編集':'新規従業員登録'}</h2>
    </div>
    <div class="form-wrap">
    <div class="section-title">基本情報</div>
    <div class="field-grid">
      ${fi('shain_no','社員番号',e.shain_no)}
      ${fi('my_number','マイナンバー',e.my_number)}
    </div>
    <div class="field-grid" style="margin-top:10px">
      ${fi('sei','姓',e.sei)}${fi('mei','名',e.mei)}
    </div>
    <div class="field-grid" style="margin-top:10px">
      ${fi('seikana','姓カナ',e.seikana)}${fi('meikana','名カナ',e.meikana)}
    </div>
    <div class="field-grid" style="margin-top:10px">
      <div class="field">
        <label>生年月日</label>
        <input type="date" id="f_birthday" value="${e.birthday||''}" oninput="calcAge()">
      </div>
      <div class="field">
        <label>年齢</label>
        <div id="ageDisplay" style="padding:7px 10px;border:1px solid var(--emp-border);border-radius:var(--emp-radius);background:var(--emp-bg);font-size:13px;color:var(--emp-text2)">${e.birthday?calcAgeVal(e.birthday)+'歳':'生年月日を入力してください'}</div>
      </div>
      <div class="field"><label>性別</label><select id="f_gender">${['男','女','その他'].map(x=>`<option ${e.gender===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>国籍</label>
        <select id="f_nationality" onchange="document.getElementById('f_nationality_other').style.display=this.value==='その他'?'block':'none'">
          ${['','日本','ブラジル','ベトナム','中国','フィリピン','インドネシア','ミャンマー','タイ','ペルー','ネパール','韓国','その他'].map(x=>`<option value="${x}" ${(e.nationality||'')==x?'selected':(!['','日本','ブラジル','ベトナム','中国','フィリピン','インドネシア','ミャンマー','タイ','ペルー','ネパール','韓国','その他'].includes(e.nationality||'')&&x==='その他')?'selected':''}>${x||'選択してください'}</option>`).join('')}
        </select>
        <input type="text" id="f_nationality_other" placeholder="国籍を入力" value="${!['','日本','ブラジル','ベトナム','中国','フィリピン','インドネシア','ミャンマー','タイ','ペルー','ネパール','韓国','その他'].includes(e.nationality||'')?e.nationality||'':''}" style="margin-top:6px;display:${(e.nationality&&!['','日本','ブラジル','ベトナム','中国','フィリピン','インドネシア','ミャンマー','タイ','ペルー','ネパール','韓国','その他'].includes(e.nationality))||e.nationality==='その他'?'block':'none'}">
      </div>
    </div>
    ${fi('address','住所',e.address,'text',false,true)}
    <div class="field-grid">${fi('tel','電話番号',e.tel)}${fi('email','メールアドレス',e.email)}</div>
    <div class="section-title">雇用情報</div>
    <div class="field-grid">
      <div class="field" style="grid-column:1/-1">
        <label>会社（大分類）<span style="color:var(--emp-danger)"> *</span></label>
        <div class="sel-group">
          <button type="button" class="sel-btn ${e.company==='セレクト'?'selected':''}" onclick="this.closest('.sel-group').querySelectorAll('.sel-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');document.getElementById('f_company').value='セレクト'">セレクト</button>
          <button type="button" class="sel-btn ${e.company==='覚善'?'selected':''}" onclick="this.closest('.sel-group').querySelectorAll('.sel-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');document.getElementById('f_company').value='覚善'">覚善</button>
        </div>
        <input type="hidden" id="f_company" value="${e.company||''}">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>部署（所属1 / 所属2）</label>
        <div class="dept-inline">
          <select id="f_dept_id">${deptOptions(e.dept_id)}</select>
          <button type="button" class="dept-add-btn" onclick="openDeptModal('add',null,function(newId){document.getElementById('f_dept_id').value=newId;})">＋ 部署を追加</button>
        </div>
      </div>
    </div>
    <div class="field-grid">
      ${fi('position','役職',e.position)}
      <div class="field"><label>雇用形態</label><select id="f_koyou">${KOYOU.map(k=>`<option ${e.koyou===k?'selected':''}>${k}</option>`).join('')}</select></div>
      <div class="field"><label>雇用期間の定め</label><select id="f_employment_type">
        <option value="fixed" ${(e.employment_type||'fixed')==='fixed'?'selected':''}>有期（期間の定めあり）</option>
        <option value="permanent" ${e.employment_type==='permanent'?'selected':''}>無期（期間の定めなし）</option>
      </select></div>
    </div>
    <div style="margin-top:8px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
        <input type="checkbox" id="f_contract_other_system" ${e.contract_other_system?'checked':''} style="width:16px;height:16px;">
        <span>雇用契約書は他システムで管理（アラート対象外にする）</span>
      </label>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px" class="sp-grid-1col">
      ${fi('nyusha_date','入社日',e.nyusha_date,'date')}
      <div class="field">
        <label>退職日</label>
        <input type="date" id="f_taishoku_date" value="${e.taishoku_date||''}" oninput="onTaishokuChange()">
      </div>
      <div class="field">
        <label>在籍状況</label>
        <select id="f_status">
          <option ${e.status==='在籍'||!e.status?'selected':''}>在籍</option>
          <option ${e.status==='退職'?'selected':''}>退職</option>
        </select>
      </div>
    </div>
    <div class="field-grid" style="margin-top:10px">${fi('kyuyo','月給（円）',e.kyuyo,'number')}${fi('jikyu','時給（円）',e.jikyu,'number')}</div>
    <div class="section-title">在留・外国人情報</div>
    <div class="field-grid">
      <div class="field"><label>在留資格</label><select id="f_visa"><option value="">（なし）</option>${visaTypes.map(v=>`<option ${e.visa===v.name?'selected':''}>${v.name}</option>`).join('')}</select></div>
      ${fi('visa_expiry','在留期限',e.visa_expiry,'date')}${fi('visa_no','在留カード番号',e.visa_no)}
    </div>
    <div class="field" style="margin-top:10px">
      <label>在留カード写真</label>
      <label class="photo-upload" id="rcDropArea" style="display:flex;align-items:center;justify-content:center;min-height:80px;cursor:pointer">
        <input type="file" accept="image/*,application/pdf" id="f_rc" style="display:none" onchange="previewRC(this)">
        <span id="rcPreview">${e.residence_card?`<img src="${e.residence_card}" style="max-height:120px;border-radius:var(--emp-radius)">`:'クリックまたはドロップして在留カードを追加'}</span>
      </label>
    </div>
    <div class="section-title">雇用保険</div>
    <div class="field-grid">${fi('koyo_hoken_no','被保険者番号',e.koyo_hoken_no)}${fi('koyo_nyusha','加入日',e.koyo_nyusha,'date')}${fi('koyo_soshitsu','喪失日',e.koyo_soshitsu,'date')}</div>
    <div class="section-title">社会保険</div>
    <div class="field-grid">${fi('shakai_hoken_no','被保険者番号',e.shakai_hoken_no)}${fi('shakai_nyusha','加入日',e.shakai_nyusha,'date')}${fi('shakai_soshitsu','喪失日',e.shakai_soshitsu,'date')}</div>
    <div class="section-title">運転免許証</div>
    <div class="field-grid">
      ${fi('license_no','免許証番号',e.license_no)}${fi('license_date','取得日',e.license_date,'date')}${fi('license_expiry','有効期限',e.license_expiry,'date')}
    </div>
    <div class="field" style="margin-top:10px">
      <label>免許証写真</label>
      <label class="photo-upload" id="licDropArea" style="display:flex;align-items:center;justify-content:center;min-height:70px;cursor:pointer">
        <input type="file" accept="image/*,application/pdf" id="f_lic_img" style="display:none" onchange="previewLicForm(this)">
        <span id="licFormPreview">${e.license_img?`<img src="${e.license_img}" style="max-height:100px;border-radius:var(--emp-radius)">`:'クリックまたはドロップして免許証を追加'}</span>
      </label>
    </div>
    <div class="section-title">その他資格（最大3件）</div>
    ${[0,1,2].map(i=>{
      const sk=(e.shikaku_list||[])[i]||{};
      return`<div style="background:var(--emp-bg);border:1px solid var(--emp-border);border-radius:var(--emp-radius);padding:12px;margin-bottom:8px">
        <div style="font-size:12px;color:var(--emp-text2);font-weight:500;margin-bottom:8px">資格 ${i+1}</div>
        <div class="field-grid">
          <div class="field"><label>資格名</label><input type="text" id="f_sk${i}_name" value="${sk.name||''}"></div>
          <div class="field">
            <label>写真・PDF</label>
            <label class="photo-upload" id="skDrop${i}" style="display:flex;align-items:center;justify-content:center;min-height:50px;cursor:pointer">
              <input type="file" accept="image/*,application/pdf" id="f_sk${i}_img" style="display:none" onchange="previewSkForm(this,${i})">
              <span id="skFormPreview${i}">${sk.img?`<img src="${sk.img}" style="max-height:60px;border-radius:4px">`:'クリックまたはドロップ'}</span>
            </label>
          </div>
        </div>
      </div>`;
    }).join('')}
    <div class="section-title">銀行口座</div>
    <div class="field-grid">
      ${fi('bank_name','銀行名',e.bank_name)}${fi('bank_branch','支店名',e.bank_branch)}
      ${fi('bank_account_no','口座番号',e.bank_account_no)}${fi('bank_account_name','口座名義',e.bank_account_name)}
    </div>
    <div class="section-title">メモ</div>
    ${fi('memo','',stripFuyouMeta(e.memo),'text',true)}
    <div class="page-actions" style="visibility:hidden;height:0;margin:0;padding:0"></div>
    </div>
    <div class="sticky-footer">
      <button class="btn" onclick="currentView='list';render()">キャンセル</button>
      <button class="btn btn-primary" onclick="saveForm(${isEdit},${e.id||'null'})">保存</button>
    </div>`;
  setTimeout(setupFormDropZones,50);
}
function fi(key,label,val,type='text',isTA=false,full=false){
  const v=val||'',s=full?'style="grid-column:1/-1"':'';
  if(isTA)return`<div class="field" ${s}><label>${emp_esc(label)}</label><textarea id="f_${key}" rows="3">${emp_textarea(v)}</textarea></div>`;
  return`<div class="field" ${s}><label>${emp_esc(label)}</label><input type="${type}" id="f_${key}" value="${emp_attr(v)}"></div>`;
}
function onTaishokuChange(){
  const d=document.getElementById('f_taishoku_date')?.value;
  const s=document.getElementById('f_status');
  if(!s)return;
  if(d){s.value='退職';}else{s.value='在籍';}
}
function calcAgeVal(birthday){
  if(!birthday)return'';
  const today=new Date(),b=new Date(birthday);
  let age=today.getFullYear()-b.getFullYear();
  const m=today.getMonth()-b.getMonth();
  if(m<0||(m===0&&today.getDate()<b.getDate()))age--;
  return age;
}
function calcAge(){
  const v=document.getElementById('f_birthday')?.value;
  const d=document.getElementById('ageDisplay');
  if(!d)return;
  d.textContent=v?calcAgeVal(v)+'歳':'生年月日を入力してください';
}
function previewRC(input){
  const f=input.files[0];if(!f)return;
  if(!validateUploadFile(f)){input.value='';return;}
  (f.type.startsWith('image/')?compressImage(f):fileToDataURL(f)).then(data=>{rcImgData=data;document.getElementById('rcPreview').innerHTML=f.type.startsWith('image/')?`<img src="${data}" style="max-height:120px;border-radius:var(--emp-radius)">`:'PDFを添付済み';});
}
let licFormImgData='';
let skFormImgData=['','',''];
function previewLicForm(input){
  const f=input.files[0];if(!f)return;
  if(!validateUploadFile(f)){input.value='';return;}
  (f.type.startsWith('image/')?compressImage(f):fileToDataURL(f)).then(data=>{licFormImgData=data;document.getElementById('licFormPreview').innerHTML=f.type.startsWith('image/')?`<img src="${data}" style="max-height:100px;border-radius:var(--emp-radius)">`:'PDFを添付済み';});
}
function previewSkForm(input,i){
  const f=input.files[0];if(!f)return;
  if(!validateUploadFile(f)){input.value='';return;}
  (f.type.startsWith('image/')?compressImage(f):fileToDataURL(f)).then(data=>{skFormImgData[i]=data;document.getElementById('skFormPreview'+i).innerHTML=f.type.startsWith('image/')?`<img src="${data}" style="max-height:60px;border-radius:4px">`:'PDF添付済み';});
}
function setupFormDropZones(){
  setupDrop('rcDropArea',(data)=>{rcImgData=data;document.getElementById('rcPreview').innerHTML=`<img src="${data}" style="max-height:120px;border-radius:var(--emp-radius)">`;});
  setupDrop('licDropArea',(data)=>{licFormImgData=data;document.getElementById('licFormPreview').innerHTML=`<img src="${data}" style="max-height:100px;border-radius:var(--emp-radius)">`;});
  [0,1,2].forEach(i=>{
    setupDrop('skDrop'+i,(data)=>{skFormImgData[i]=data;document.getElementById('skFormPreview'+i).innerHTML=`<img src="${data}" style="max-height:60px;border-radius:4px">`;});
  });
}

async function saveForm(isEdit,id){
  const g=k=>{const el=document.getElementById('f_'+k);return el?el.value:'';};
  if(!g('sei')||!g('mei')){showToast('姓・名は必須です','error');return;}
  if(!g('company')){showToast('会社（セレクト／覚善）を選択してください','error');return;}
  const deptId=document.getElementById('f_dept_id')?.value;
  const existingEmp=isEdit?employees.find(e=>e.id===id):null;
  const emp={
    shain_no:g('shain_no'),
    my_number:g('my_number'),
    sei:g('sei'),mei:g('mei'),seikana:g('seikana'),meikana:g('meikana'),
    birthday:document.getElementById('f_birthday')?.value||'',gender:g('gender'),
    nationality:(()=>{const s=document.getElementById('f_nationality')?.value;return s==='その他'?(document.getElementById('f_nationality_other')?.value||'その他'):s||'';})(),
    address:g('address'),tel:g('tel'),email:g('email'),
    contract_other_system:document.getElementById('f_contract_other_system')?.checked||false,
    company:g('company'),
    dept_id:deptId?Number(deptId):null,
    position:g('position'),koyou:g('koyou'),employment_type:g('employment_type')||'fixed',nyusha_date:g('nyusha_date'),
    taishoku_date:document.getElementById('f_taishoku_date')?.value||'',
    status:g('status'),
    kyuyo:g('kyuyo'),jikyu:g('jikyu'),
    visa:g('visa'),visa_expiry:g('visa_expiry'),visa_no:g('visa_no'),residence_card:rcImgData,
    koyo_hoken_no:g('koyo_hoken_no'),koyo_nyusha:g('koyo_nyusha'),koyo_soshitsu:g('koyo_soshitsu'),
    shakai_hoken_no:g('shakai_hoken_no'),shakai_nyusha:g('shakai_nyusha'),shakai_soshitsu:g('shakai_soshitsu'),
    license_no:g('license_no'),license_date:g('license_date'),license_expiry:g('license_expiry'),
    license_img:licFormImgData||(isEdit?employees.find(e=>e.id===id)?.license_img||'':''),
    bank_name:g('bank_name'),bank_branch:g('bank_branch'),bank_account_no:g('bank_account_no'),bank_account_name:g('bank_account_name'),
    memo:memoWithFuyouMeta(g('memo'),getFuyouList(existingEmp)),updated_at:new Date().toISOString().slice(0,10)
  };
  try{
    if(isEdit){
      const ex=existingEmp;
      emp.yukyu_list=ex?.yukyu_list||[];
      emp.kenkou_list=ex?.kenkou_list||[];
      // 既存shikaku_listの4件目以降を保持しつつフォームの3件を上書き
      const existingSk=ex?.shikaku_list||[];
      const formSk=[0,1,2].map(i=>{
        const name=document.getElementById('f_sk'+i+'_name')?.value.trim()||'';
        const img=skFormImgData[i]||(existingSk[i]?.img||'');
        return name?{name,img,date:existingSk[i]?.date||'',expiry:existingSk[i]?.expiry||''}:null;
      }).filter(Boolean);
      emp.shikaku_list=[...formSk,...existingSk.slice(3)];
      await updateEmployee(id,emp);
    } else {
      emp.yukyu_list=[];emp.kenkou_list=[];
      emp.shikaku_list=[0,1,2].map(i=>{
        const name=document.getElementById('f_sk'+i+'_name')?.value.trim()||'';
        return name?{name,img:skFormImgData[i]||'',date:'',expiry:''}:null;
      }).filter(Boolean);
      await createEmployee(emp);
    }
    licFormImgData='';skFormImgData=['','',''];
    await loadEmployees();currentView='list';render();
  }catch(e){showToast('保存に失敗しました：'+e.message,'error');}
}

// ---- CSV インポート ----
const CSV_COLS=['社員番号','会社','姓','名','姓カナ','名カナ','生年月日','性別','住所','電話','メール','役職','雇用形態','入社日','在籍状況','月給','時給','在留資格','在留カード番号','在留期限','雇用保険番号','雇用保険加入日','雇用保険喪失日','社会保険番号','社会保険加入日','社会保険喪失日','免許証番号','免許取得日','免許有効期限','銀行名','支店名','口座番号','口座名義','メモ'];

function downloadSampleCSV(){
  const sample=[CSV_COLS,['S001','セレクト','田中','一郎','タナカ','イチロウ','1990-05-12','男','愛知県豊川市','090-1111-2222','tanaka@example.com','班長','正社員','2018-04-01','在籍','280000','','技能実習2号','AB1234567','2025-09-30','12345678','2018-04-01','','87654321','2018-04-01','','','','','〇〇銀行','豊川支店','1234567','タナカ イチロウ','']];
  dlCSV(sample.map(r=>r.map(v=>'"'+v.replace(/"/g,'""')+'"')),'従業員台帳_サンプル');
}

async function importCSV(input){
  const file=input.files[0];if(!file)return;
  const text=await file.text();
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  if(lines.length<2){showToast('データがありません','warn');return;}
  const headers=parseCSVLine(lines[0]);
  const idx=col=>headers.indexOf(col);
  const rows=lines.slice(1).map(l=>parseCSVLine(l));
  if(!confirm(`${rows.length}件のデータをインポートします。よろしいですか？`))return;
  let ok=0,err=0;
  for(const r of rows){
    const g=col=>{const i=idx(col);return i>=0?(r[i]||''):'';};
    if(!g('姓')&&!g('名'))continue;
    const emp={
      shain_no:g('社員番号'),company:g('会社'),
      sei:g('姓'),mei:g('名'),seikana:g('姓カナ'),meikana:g('名カナ'),
      birthday:g('生年月日'),gender:g('性別'),address:g('住所'),tel:g('電話'),email:g('メール'),
      position:g('役職'),koyou:g('雇用形態'),nyusha_date:g('入社日'),status:g('在籍状況')||'在籍',
      kyuyo:g('月給'),jikyu:g('時給'),
      visa:g('在留資格'),visa_no:g('在留カード番号'),visa_expiry:g('在留期限'),
      koyo_hoken_no:g('雇用保険番号'),koyo_nyusha:g('雇用保険加入日'),koyo_soshitsu:g('雇用保険喪失日'),
      shakai_hoken_no:g('社会保険番号'),shakai_nyusha:g('社会保険加入日'),shakai_soshitsu:g('社会保険喪失日'),
      license_no:g('免許証番号'),license_date:g('免許取得日'),license_expiry:g('免許有効期限'),
      bank_name:g('銀行名'),bank_branch:g('支店名'),bank_account_no:g('口座番号'),bank_account_name:g('口座名義'),
      memo:g('メモ'),yukyu_list:[],kenkou_list:[],shikaku_list:[],
      updated_at:new Date().toISOString().slice(0,10)
    };
    try{await createEmployee(emp);ok++;}catch(e){err++;console.error(e);}
  }
  input.value='';
  await loadEmployees();render();
  showToast(`インポート完了！　成功：${ok}件${err?' / エラー：'+err+'件':''}`,ok&&!err?'success':'warn');
}
function parseCSVLine(line){
  const result=[];let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){result.push(cur.trim());cur='';}
    else cur+=c;
  }
  result.push(cur.trim());return result;
}

// ---- CSV エクスポート ----
function exportCSV(){
  if(!confirm(`従業員CSVを出力します。\n対象: ${employees.length}件\n住所・電話・メール・保険番号などの個人情報が含まれます。続行しますか？`))return;
  const h=['ID','姓','名','姓カナ','名カナ','生年月日','性別','住所','電話','メール','所属1','所属2','役職','雇用形態','入社日','在籍状況','月給','時給','在留資格','在留カード番号','在留期限','雇用保険番号','雇用保険加入日','雇用保険喪失日','社会保険番号','社会保険加入日','社会保険喪失日','更新日'];
  const rows=employees.map(e=>{
    const dept=departments.find(d=>d.id===Number(e.dept_id));
    return[e.id,e.sei,e.mei,e.seikana,e.meikana,e.birthday,e.gender,e.address,e.tel,e.email,dept?.shozoku1||'',dept?.shozoku2||'',e.position,e.koyou,e.nyusha_date,e.status,e.kyuyo,e.jikyu,e.visa,e.visa_no,e.visa_expiry,e.koyo_hoken_no,e.koyo_nyusha,e.koyo_soshitsu,e.shakai_hoken_no,e.shakai_nyusha,e.shakai_soshitsu,e.updated_at].map(v=>'"'+(v||'').toString().replace(/"/g,'""')+'"');
  });
  dlCSV([h,...rows],'従業員台帳');
}
function exportYukyuCSV(){
  const h=['ID','従業員ID','氏名','使用日','使用内容','種別','区分','入力者','登録日','備考'];
  const rows=yukyuRecords.map(r=>[r.id,r.employee_id,r.employee_name,r.use_date,r.use_type,r.shubetsu,r.kubun,r.input_by,r.touroku_date,r.biko].map(v=>'"'+(v||'').toString().replace(/"/g,'""')+'"'));
  dlCSV([h,...rows],'有給記録');
}
function dlCSV(data,name){
  const csv='\uFEFF'+data.map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download=name+'_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
}
// ===== END EMPLOYEE MANAGEMENT =====

