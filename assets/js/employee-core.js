// ===== EMPLOYEE MANAGEMENT (統合) =====
// DB統合により新DBへ接続。
const SUPABASE_URL=SUPA_URL;
const SUPABASE_KEY=SUPA_KEY;
const KOYOU=['正社員','パート・アルバイト','契約社員','派遣社員','業務委託'];
const CHECKRES=['異常なし','要経過観察','要精密検査','受診未了'];
const USE_TYPES=['全日','半休（午前）','半休（午後）'];
const SHUBETSU=['自己都合','会社都合'];
const KUBUN=['計画','突発'];
const INPUT_BY=['三上','金森','岩本'];

// ---- XSS エスケープ ----
function emp_esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');}
function emp_attr(s){return emp_esc(s);}
function emp_textarea(s){return emp_esc(s);}
const FUYOU_MARK_START='<!--EMP_FUYOU_JSON:';
const FUYOU_MARK_END='-->';
function encodeFuyouData(list){
  try{return btoa(unescape(encodeURIComponent(JSON.stringify(Array.isArray(list)?list:[]))));}
  catch(e){return'';}
}
function decodeFuyouData(raw){
  try{return JSON.parse(decodeURIComponent(escape(atob(raw||''))))||[];}
  catch(e){return[];}
}
function stripFuyouMeta(memo){
  return String(memo||'').replace(/\n?\n?<!--EMP_FUYOU_JSON:[A-Za-z0-9+/=]*-->/g,'').trim();
}
function getFuyouList(e){
  if(Array.isArray(e?.fuyou_list))return e.fuyou_list;
  const m=String(e?.memo||'').match(/<!--EMP_FUYOU_JSON:([A-Za-z0-9+/=]*)-->/);
  return m?decodeFuyouData(m[1]):[];
}
function memoWithFuyouMeta(memo,list){
  const clean=stripFuyouMeta(memo);
  const items=(Array.isArray(list)?list:[]).filter(d=>d.name||d.relation||d.birthday||d.tax_fuyou||d.social_fuyou);
  if(!items.length)return clean;
  return clean+(clean?'\n\n':'')+FUYOU_MARK_START+encodeFuyouData(items)+FUYOU_MARK_END;
}
function maskSensitive(val,tail=4){
  const s=String(val||'').replace(/\s/g,'');
  if(!s)return'';
  return '••••••••'+s.slice(-tail);
}
function confirmPermanentDelete(label){
  return confirm(`${label}を完全に削除します。\n復元できません。監査ログやバックアップを確認済みの場合だけOKしてください。`);
}

// ---- トースト通知 ----
function _ensureToastWrap(){
  if(document.getElementById('emp-toast-wrap'))return;
  const wrap=document.createElement('div');wrap.id='emp-toast-wrap';
  document.body.appendChild(wrap);
}
function showToast(msg,type='success'){
  _ensureToastWrap();
  const el=document.createElement('div');
  el.className='j-toast '+type;
  const icon=type==='success'?'✓':type==='error'?'✕':'⚠';
  el.innerHTML='<span>'+icon+'</span><span>'+emp_esc(msg)+'</span>';
  document.getElementById('emp-toast-wrap').appendChild(el);
  setTimeout(function(){el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(function(){el.remove();},300);},3500);
}

// ---- 状態管理 (EMP_ST オブジェクト) ----
const EMP_ST={
  employees:[],yukyuRecords:[],yukyuGrants:[],departments:[],visaTypes:[],
  companyInfo:{},certificates:[],workPatterns:[],employmentContracts:[],
  currentView:'list',viewingId:null,editingId:null,detailTab:'basic',
  listFilter:{sq:'',fs:'在籍',fd:'',fc:''},
  currentFilteredList:[],
  yf:{employee_id:null,employee_name:'',use_type:'',shubetsu:'',kubun:'',input_by:''},
  yfFromDetail:false,
  deptModalMode:'add',deptModalId:null,deptModalCallback:null,
  kenkoImgData:'',rcImgData:'',
};

// 後方互換：既存コードがグローバル変数として参照する箇所用のプロキシ
let employees,yukyuRecords,yukyuGrants,departments,visaTypes,companyInfo,certificates,workPatterns,employmentContracts;
let currentView,viewingId,editingId,detailTab,listFilter,currentFilteredList;
let yf,yfFromDetail,deptModalMode,deptModalId,deptModalCallback,kenkoImgData,rcImgData;
function syncFromST(){
  employees=EMP_ST.employees;yukyuRecords=EMP_ST.yukyuRecords;yukyuGrants=EMP_ST.yukyuGrants;
  departments=EMP_ST.departments;visaTypes=EMP_ST.visaTypes;companyInfo=EMP_ST.companyInfo;
  certificates=EMP_ST.certificates;workPatterns=EMP_ST.workPatterns;employmentContracts=EMP_ST.employmentContracts;
  currentView=EMP_ST.currentView;viewingId=EMP_ST.viewingId;editingId=EMP_ST.editingId;
  detailTab=EMP_ST.detailTab;listFilter=EMP_ST.listFilter;currentFilteredList=EMP_ST.currentFilteredList;
  yf=EMP_ST.yf;yfFromDetail=EMP_ST.yfFromDetail;deptModalMode=EMP_ST.deptModalMode;
  deptModalId=EMP_ST.deptModalId;deptModalCallback=EMP_ST.deptModalCallback;
  kenkoImgData=EMP_ST.kenkoImgData;rcImgData=EMP_ST.rcImgData;
}
syncFromST();

// ---- 一覧表示列の設定 ----
const ALL_COLS=[
  {key:'name',label:'氏名',default:true},
  {key:'company',label:'会社',default:true},
  {key:'shozoku1',label:'所属1',default:true},
  {key:'shozoku2',label:'所属2',default:true},
  {key:'koyou',label:'雇用形態',default:true},
  {key:'status',label:'在籍',default:true},
  {key:'visa',label:'在留資格',default:true},
  {key:'visa_expiry',label:'在留期限',default:true},
  {key:'license_expiry',label:'免許期限',default:true},
  {key:'nyusha_date',label:'入社日',default:false},
  {key:'birthday',label:'生年月日',default:false},
  {key:'dept',label:'部署',default:false},
  {key:'updated_at',label:'更新日',default:true},
];
let visibleCols=ALL_COLS.filter(c=>c.default).map(c=>c.key);
try{const s=localStorage.getItem('emp_cols')||localStorage.getItem('visibleCols');if(s)visibleCols=JSON.parse(s);}catch(e){}

// ---- Auth ----
function emp_doLogin(){
  // マジックリンク認証はメイン画面で行うため、ここでは何もしない
  location.reload();
}
function doLogout(){doLogoutAll();}

// ---- ハンバーガーメニュー ----
function toggleMenu(){
  const menu=document.getElementById('navMenu');
  const btn=document.getElementById('hamburgerBtn');
  menu.classList.toggle('open');
  btn.classList.toggle('open');
}
function closeMenu(){
  document.getElementById('navMenu')?.classList.remove('open');
  document.getElementById('hamburgerBtn')?.classList.remove('open');
}
// メニュー外タップで閉じる
document.addEventListener('click',e=>{
  const menu=document.getElementById('navMenu');
  const btn=document.getElementById('hamburgerBtn');
  if(menu&&btn&&!menu.contains(e.target)&&!btn.contains(e.target)){
    menu.classList.remove('open');
    btn.classList.remove('open');
  }
});
// ---- Data load adapters ----
async function loadEmployees(){EMP_ST.employees=(await fetchEmployees()).map(r=>({...r,yukyu_list:r.yukyu_list||[],kenkou_list:r.kenkou_list||[],shikaku_list:r.shikaku_list||[],residence_card_imgs:r.residence_card_imgs||[],license_imgs:r.license_imgs||[]}));employees=EMP_ST.employees;}
async function loadYukyu(){EMP_ST.yukyuRecords=await fetchYukyuRecords();yukyuRecords=EMP_ST.yukyuRecords;}
async function loadGrants(){EMP_ST.yukyuGrants=await fetchYukyuGrants();yukyuGrants=EMP_ST.yukyuGrants;}
async function loadDepts(){EMP_ST.departments=await fetchDepartments();departments=EMP_ST.departments;}
async function loadVisaTypes(){EMP_ST.visaTypes=await fetchVisaTypes();visaTypes=EMP_ST.visaTypes;}
async function loadCompanyInfo(){EMP_ST.companyInfo=await fetchCompanyInfo();companyInfo=EMP_ST.companyInfo;}
async function loadCertificates(){EMP_ST.certificates=await fetchCertificates();certificates=EMP_ST.certificates;}
async function loadWorkPatterns(){EMP_ST.workPatterns=await fetchWorkPatterns();workPatterns=EMP_ST.workPatterns;}
async function loadEmploymentContracts(){EMP_ST.employmentContracts=await fetchEmploymentContracts();employmentContracts=EMP_ST.employmentContracts;}
async function loadAndRender(){
  // 優先度高（毎回取得）と低（初回のみ）に分けて並列実行
  const tasks=[
    {fn:loadEmployees,name:'従業員'},
    {fn:loadDepts,name:'部署'},
    {fn:loadCompanyInfo,name:'会社情報'},
    {fn:loadVisaTypes,name:'在留資格'},
    {fn:loadGrants,name:'有給付与'},
    {fn:loadYukyu,name:'有給記録'},
    {fn:loadCertificates,name:'証明書'},
    {fn:loadWorkPatterns,name:'勤務パターン'},
    {fn:loadEmploymentContracts,name:'雇用契約書'},
  ];
  const results=await Promise.allSettled(tasks.map(t=>t.fn()));
  const failed=results.map((r,i)=>r.status==='rejected'?tasks[i].name:null).filter(Boolean);
  if(failed.length){
    showToast('データ読み込み失敗：'+failed.join('、'), 'error');
    console.error('Load errors:', results.filter(r=>r.status==='rejected').map(r=>r.reason));
  }
  syncFromST();
  // 有給自動付与は今日初回のみ実行
  const _grantKey='autoGrantLegalDays_'+new Date().toISOString().slice(0,10);
  if(!sessionStorage.getItem(_grantKey)){
    sessionStorage.setItem(_grantKey,'1');
    await checkAndAutoGrant();
  }
  render();
}

// ---- 有給計算ヘルパー ----
function calcGrantDates(empId){
  // 入社日から全付与予定日を返す（過去〜未来3年分）
  const e=employees.find(x=>x.id===empId);
  if(!e||!e.nyusha_date)return[];
  const nyusha=new Date(e.nyusha_date);
  const dates=[];
  const first=new Date(nyusha);first.setMonth(first.getMonth()+6);
  dates.push(first.toISOString().slice(0,10));
  for(let i=1;i<=10;i++){
    const d=new Date(first);d.setFullYear(d.getFullYear()+i);
    dates.push(d.toISOString().slice(0,10));
  }
  return dates;
}

function fullMonthsBetween(startStr,endStr){
  const s=new Date(startStr),e=new Date(endStr);
  let months=(e.getFullYear()-s.getFullYear())*12+(e.getMonth()-s.getMonth());
  if(e.getDate()<s.getDate())months--;
  return months;
}
function addDaysToDateStr(dateStr,days){
  const d=new Date(dateStr);
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
function calcYukyuLegalDays(empId,grantDate){
  const e=employees.find(x=>x.id===empId);
  const start=e?.kousoku_start_date||e?.nyusha_date;
  if(!start||!grantDate)return null;
  const months=fullMonthsBetween(start,addDaysToDateStr(grantDate,1));
  if(months>=78)return 20;
  if(months>=66)return 18;
  if(months>=54)return 16;
  if(months>=42)return 14;
  if(months>=30)return 12;
  if(months>=18)return 11;
  if(months>=6)return 10;
  return null;
}
function yukyuGrantNeedsDays(g){
  return g.days===null||g.days===undefined||g.days==='';
}
function grantExpireDate(grantDate){
  const exp=new Date(grantDate);exp.setFullYear(exp.getFullYear()+2);exp.setDate(exp.getDate()-1);
  return exp.toISOString().slice(0,10);
}

function calcYukyuInfo(empId){
  const today=new Date();
  const todayStr=today.toISOString().slice(0,10);
  const e=employees.find(x=>x.id===empId);
  if(!e)return{granted:0,used:0,remaining:0,nextDate:null,nextDays:null,unsetDays:false};

  const allGrants=yukyuGrants.filter(g=>g.employee_id===empId);
  // 日数設定済み・付与日が今日以前を古い順にソート（FIFO消化のため）
  const grants=allGrants
    .filter(g=>g.days!==null&&g.days!==undefined&&g.days!==''&&g.grant_date<=todayStr)
    .sort((a,b)=>a.grant_date.localeCompare(b.grant_date));

  // 日数未設定の付与があるか
  const unsetDays=allGrants.some(g=>yukyuGrantNeedsDays(g)&&g.grant_date<=todayStr);

  // 付与合計・取得合計
  const granted=grants.reduce((s,g)=>s+Number(g.days),0);
  const recs=yukyuRecords.filter(r=>r.employee_id===empId);
  const used=recs.reduce((s,r)=>s+(r.use_type==='全日'?1:0.5),0);

  // FIFO残日数：古い付与から順に消化し、期限切れの残は加算しない
  let usedBuf=used;
  let remaining=0;
  for(const g of grants){
    const days=Number(g.days);
    let expStr=g.expire_date;
    if(!expStr)expStr=grantExpireDate(g.grant_date);
    if(usedBuf>=days){
      usedBuf-=days;
    }else{
      const left=days-usedBuf;usedBuf=0;
      if(expStr>=todayStr)remaining+=left;
    }
  }

  // 次回付与日
  const allDates=calcGrantDates(empId);
  const nextDate=allDates.find(d=>d>todayStr)||null;
  const nextGrant=allGrants.find(g=>g.grant_date===nextDate);
  const nextDays=nextGrant?(nextGrant.days!==null&&nextGrant.days!==''?Number(nextGrant.days):null):null;

  return{granted,used,remaining,nextDate,nextDays,unsetDays};
}

// ---- 自動付与チェック（ログイン時に実行） ----
async function checkAndAutoGrant(){
  const todayStr=new Date().toISOString().slice(0,10);
  const batch=[];
  const updates=[];
  for(const e of employees.filter(x=>x.status==='在籍'&&x.nyusha_date)){
    const dates=calcGrantDates(e.id);
    const existingGrants=yukyuGrants.filter(g=>g.employee_id===e.id);
    const existingDates=existingGrants.map(g=>g.grant_date);
    existingGrants.filter(g=>g.grant_date&&yukyuGrantNeedsDays(g)).forEach(g=>{
      const days=calcYukyuLegalDays(e.id,g.grant_date);
      if(days!==null){
        const patch={days};
        if(!g.expire_date)patch.expire_date=grantExpireDate(g.grant_date);
        updates.push({id:g.id,patch});
      }
    });
    for(const d of dates){
      if(d<=todayStr&&!existingDates.includes(d)){
        batch.push({employee_id:e.id,grant_date:d,days:calcYukyuLegalDays(e.id,d),expire_date:grantExpireDate(d)});
      }
    }
  }
  if(batch.length||updates.length){
    try{
      if(batch.length)await createYukyuGrants(batch);
      if(updates.length)await Promise.all(updates.map(u=>saveYukyuGrant(u.id,u.patch)));
    }catch(err){console.error('自動付与エラー',err);}
    await loadGrants();
  }
}
function deptLabel(d){return d?[d.shozoku1,d.shozoku2].filter(Boolean).join(' / '):''}
function deptLabelById(id){const d=departments.find(x=>x.id===Number(id));return d?deptLabel(d):''}
function employeeSearchText(e){
  if(!e)return'';
  return(
    (e.sei||'')+(e.mei||'')+
    (e.seikana||'')+(e.meikana||'')+
    (e.shain_no||'')+
    deptLabelById(e.dept_id)+
    (e.visa||'')+
    (e.company||'')
  ).toLowerCase();
}
function deptOptions(selectedId){
  return`<option value="">（未選択）</option>`+departments.map(d=>`<option value="${d.id}" ${Number(selectedId)===d.id?'selected':''}>${deptLabel(d)}</option>`).join('');
}
function getLatestEmploymentContractMap(){
  const map={};
  (employmentContracts||[]).forEach(c=>{
    const id=c.employee_id;
    if(!id)return;
    const current=map[id];
    const cDate=c.issued_date||c.created_at||c.contract_end||'';
    const currentDate=current?(current.issued_date||current.created_at||current.contract_end||''):'';
    if(!current||cDate>currentDate)map[id]=c;
  });
  return map;
}
function getLedgerFocusMetrics(today=new Date()){
  const activeEmps=(employees||[]).filter(e=>e.status==='在籍');
  const contractMap=getLatestEmploymentContractMap();
  const visaExpired=[];
  const visaSoon=[];
  const licenseExpired=[];
  const licenseSoon=[];
  const yukyuUnset=[];
  const contractNeed=[];
  activeEmps.forEach(e=>{
    const visaDays=e.visa_expiry?Math.round((new Date(e.visa_expiry)-today)/86400000):null;
    const licenseDays=e.license_expiry?Math.round((new Date(e.license_expiry)-today)/86400000):null;
    if(visaDays!==null&&visaDays<0)visaExpired.push(e);
    else if(visaDays!==null&&visaDays<90)visaSoon.push(e);
    if(licenseDays!==null&&licenseDays<0)licenseExpired.push(e);
    else if(licenseDays!==null&&licenseDays<90)licenseSoon.push(e);
    if(calcYukyuInfo(e.id).unsetDays)yukyuUnset.push(e);
    if(!e.contract_other_system){
      const ct=contractMap[e.id];
      const contractDays=ct?.contract_end?Math.ceil((new Date(ct.contract_end)-today)/86400000):null;
      if(!ct||contractDays<=15)contractNeed.push(e);
    }
  });
  return{
    active:activeEmps.length,
    deadlineTotal:visaExpired.length+visaSoon.length+licenseExpired.length+licenseSoon.length,
    expiredTotal:visaExpired.length+licenseExpired.length,
    visaExpired,visaSoon,licenseExpired,licenseSoon,yukyuUnset,contractNeed,
    alertTotal:visaExpired.length+visaSoon.length+licenseExpired.length+licenseSoon.length+yukyuUnset.length+contractNeed.length
  };
}
function updateNavBadges(){
  if(!employees||!employees.length)return;
  const focus=getLedgerFocusMetrics();
  const alertBadge=document.getElementById('navAlertBadge');
  const yukyuBadge=document.getElementById('navYukyuBadge');
  if(alertBadge){
    alertBadge.textContent=focus.alertTotal;
    alertBadge.style.display=focus.alertTotal?'inline-flex':'none';
  }
  if(yukyuBadge){
    yukyuBadge.textContent=focus.yukyuUnset.length;
    yukyuBadge.style.display=focus.yukyuUnset.length?'inline-flex':'none';
  }
}

// ---- 部署モーダル ----
function openDeptModal(mode,id=null,cb=null){
  deptModalMode=mode;deptModalId=id;deptModalCallback=cb;
  document.getElementById('deptModalTitle').textContent=mode==='add'?'部署を追加':'部署を編集';
  if(mode==='edit'&&id){
    const d=departments.find(x=>x.id===id);
    document.getElementById('dm_s1').value=d?.shozoku1||'';
    document.getElementById('dm_s2').value=d?.shozoku2||'';
  } else {
    document.getElementById('dm_s1').value='';
    document.getElementById('dm_s2').value='';
  }
  document.getElementById('deptModal').style.display='flex';
}
function closeDeptModal(){document.getElementById('deptModal').style.display='none';}
async function saveDeptModal(){
  const s1=document.getElementById('dm_s1').value.trim();
  const s2=document.getElementById('dm_s2').value.trim();
  if(!s1){showToast('所属1は必須です','error');return;}
  try{
    if(deptModalMode==='add'){
      const res=await createDepartment({shozoku1:s1,shozoku2:s2});
      await loadDepts();
      closeDeptModal();
      if(deptModalCallback)deptModalCallback(res[0]?.id);
      else if(currentView==='settings')renderSettings();
      else render();
    } else {
      await updateDepartment(deptModalId,{shozoku1:s1,shozoku2:s2});
      await loadDepts();
      closeDeptModal();
      if(currentView==='settings')renderSettings();
      else render();
    }
  }catch(e){showToast('保存に失敗しました：'+e.message,'error');}
}

// ---- Nav ----
function setNav(active){
  ['tList','tAdd','tAlert','tYukyu','tYukyuAdd','tKenko','tCert','tContract','tSettings'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.className='nav-btn'+(id===active?' active':'');
      if(id==='tAlert'&&id!==active)el.style.cssText='color:var(--emp-warn);border-color:var(--emp-warn)';
      else if(id==='tAlert'&&id===active)el.style.cssText='';
    }
  });
  updateNavBadges();
}
function showView(v){
  currentView=v;editingId=null;yfFromDetail=false;
  if(v==='yukyu_add')yf={employee_id:null,employee_name:'',use_type:'',shubetsu:'',kubun:'',input_by:''};
  render();
  setTimeout(()=>{const el=document.getElementById('page-jugyoin');if(el)el.scrollTop=0;},0);
}
function render(){
  if(currentView==='list'){setNav('tList');renderList();}
  else if(currentView==='add'){setNav('tAdd');renderForm(null);}
  else if(currentView==='edit'){setNav('tList');renderForm(editingId);}
  else if(currentView==='detail'){setNav('tList');renderDetail(viewingId);}
  else if(currentView==='alert'){setNav('tAlert');renderAlert();}
  else if(currentView==='yukyu_list'){setNav('tYukyu');renderYukyuList();}
  else if(currentView==='yukyu_add'){setNav('tYukyuAdd');renderYukyuAdd();}
  else if(currentView==='kenko_list'){setNav('tKenko');renderKenkoList();}
  else if(currentView==='cert_list'){setNav('tCert');renderCertList();}
  else if(currentView==='contract_list'){setNav('tContract');renderContractList();}
  else if(currentView==='settings'){setNav('tSettings');renderSettings();}
}
