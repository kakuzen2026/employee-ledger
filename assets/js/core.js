// ===== CONFIG =====
const SUPA_URL = 'https://wkzbsdfgslidubqpifwa.supabase.co';
const SUPA_KEY = 'sb_publishable_mfVmygJgUjnax83quON02Q_KMdYfF-Y';
// DB統合により従業員DBも新DBへ統合済み。
const {createClient} = supabase;
const db    = createClient(SUPA_URL, SUPA_KEY);

// ===== XSS エスケープ =====
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');}

// ===== STATE =====
let ST = {clients:[],sites:[],contracts:[],billing:[],page:'jugyoin',ctTab:'active'};
let wpList=[], selEmps=[], empCache=null, empTimer=null;
let currentDocContract = null;

// ===== LOGIN (Magic Link) =====
async function checkLogin(){
  // URLハッシュにトークンが含まれる場合（マジックリンクからの遷移）
  if(window.location.hash && window.location.hash.includes('access_token')){
    // Supabase v2 が自動でセッションを復元するのを待つ
    const {data:{session},error} = await db.auth.getSession();
    if(session){
      window.location.hash = '';
      showApp();
      return;
    }
  }
  const {data:{session}} = await db.auth.getSession();
  if(session){
    showApp();
  } else {
    document.body.classList.remove('app-booting');
    document.body.classList.add('login-only');
    document.getElementById('login-screen').style.display='block';
  }
}

async function doEmailLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pw').value;
  if(!email || !pw){
    document.getElementById('login-err').style.display='block';
    document.getElementById('login-err').textContent='❌ メールアドレスとパスワードを入力してください';
    return;
  }
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'ログイン中...';
  document.getElementById('login-err').style.display='none';

  const {error} = await db.auth.signInWithPassword({ email, password: pw });

  if(error){
    document.getElementById('login-err').style.display='block';
    document.getElementById('login-err').textContent='❌ ' + error.message;
    btn.disabled = false;
    btn.textContent = 'ログイン';
  } else {
    document.getElementById('login-screen').style.display='none';
    showApp();
  }
}

async function doLogoutAll(){
  await db.auth.signOut();
  sessionStorage.clear();
  window.location.reload();
}

function showApp(){
  document.body.classList.remove('app-booting','login-only');
  navigate('jugyoin');
}

// ===== NAV =====
const NAV_TITLES={dashboard:'ダッシュボード',clients:'取引先管理',sites:'現場管理',contracts:'契約管理',billing:'請求管理',records:'記録管理',settings:'設定',jugyoin:'従業員管理台帳'};
const NAV_BTNS={
  clients:`<button class="btn btn-primary" onclick="openClientModal()">＋ <span class="btn-text">取引先を登録</span></button>`,
  sites:`<button class="btn btn-primary" onclick="openSiteModal()">＋ <span class="btn-text">現場を登録</span></button>`,
  contracts:`<button class="btn btn-primary" onclick="openContractModal()">＋ <span class="btn-text">契約を作成</span></button>`,
  billing:`<button class="btn btn-primary" onclick="openBillingModal()">＋ <span class="btn-text">請求を記録</span></button>`,
};
function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  if(page!=='jugyoin'){
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    const btn=document.getElementById('emp-back-btn');
    if(btn) btn.style.display='none';
  } else {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    const btn=document.getElementById('emp-back-btn');
    if(btn) btn.style.display='';
  }
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.mnav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.getElementById('page-title').textContent=NAV_TITLES[page]||page;
  document.getElementById('topbar-actions').innerHTML=NAV_BTNS[page]||'';
  document.querySelectorAll('.nav-item').forEach(n=>{if(n.dataset.page===page||(!n.dataset.page&&n.textContent.includes(NAV_TITLES[page])))n.classList.add('active');});
  document.querySelectorAll('.mnav-item').forEach(n=>{if(n.dataset.page===page)n.classList.add('active');});
  ST.page=page;
  if(page==='dashboard') loadDashboard();
  else if(page==='clients') loadClients();
  else if(page==='sites') loadSites();
  else if(page==='contracts') loadContracts();
  else if(page==='billing'){initBillingMonths();loadBilling();}
  else if(page==='records') loadRecords();
  else if(page==='jugyoin'){
    // Supabase Auth セッションがあれば従業員管理も自動認証
    db.auth.getSession().then(({data:{session}})=>{
      if(session){
        document.getElementById('emp-login').style.display='none';
        document.getElementById('emp-app-inner').style.display='flex';
        if(!window._empLoaded){window._empLoaded=true;loadAndRender();}
      } else {
        document.getElementById('emp-login').style.display='flex';
        document.getElementById('emp-app-inner').style.display='none';
      }
    });
  }
  else if(page==='settings') loadSettings();
}

