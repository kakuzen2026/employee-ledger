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
function authMessage(id,message,isError=false){
  const element=document.getElementById(id);
  element.textContent=message;
  element.classList.toggle('auth-message-error',isError);
  element.hidden=false;
}

function clearAuthMessage(id){
  const element=document.getElementById(id);
  element.textContent='';
  element.hidden=true;
  element.classList.remove('auth-message-error');
}

function showAuthForm(formId){
  ['login-form','reset-request-form','password-update-form'].forEach(id=>{
    document.getElementById(id).hidden=id!==formId;
  });
  document.body.classList.remove('app-booting');
  document.body.classList.add('login-only');
  document.getElementById('login-screen').style.display='block';
}

function showLoginForm(statusMessage='',statusIsError=false){
  const resetEmail=document.getElementById('reset-email').value.trim();
  if(resetEmail&&!document.getElementById('login-email').value){
    document.getElementById('login-email').value=resetEmail;
  }
  clearAuthMessage('login-err');
  clearAuthMessage('login-status');
  showAuthForm('login-form');
  if(statusMessage){
    authMessage('login-status',statusMessage,statusIsError);
  }
  document.getElementById('login-email').focus();
}

function showPasswordResetRequest(){
  const loginEmail=document.getElementById('login-email').value.trim();
  if(loginEmail&&!document.getElementById('reset-email').value){
    document.getElementById('reset-email').value=loginEmail;
  }
  clearAuthMessage('reset-request-message');
  showAuthForm('reset-request-form');
  document.getElementById('reset-email').focus();
}

function showPasswordUpdateForm(){
  clearAuthMessage('password-update-message');
  showAuthForm('password-update-form');
  document.getElementById('new-password').focus();
}

function recoveryRedirectInUrl(){
  const hashParams=new URLSearchParams(window.location.hash.replace(/^#/,''));
  const queryParams=new URLSearchParams(window.location.search);
  return hashParams.get('type')==='recovery'||queryParams.get('type')==='recovery';
}

let passwordRecoveryActive=false;
let resolvePasswordRecoveryEvent;
const passwordRecoveryEvent=new Promise(resolve=>{
  resolvePasswordRecoveryEvent=resolve;
});

function clearRecoveryUrl(){
  window.history.replaceState(null,document.title,window.location.pathname);
}

async function waitForPasswordRecoveryEvent(timeoutMs=4000){
  if(passwordRecoveryActive) return true;
  return Promise.race([
    passwordRecoveryEvent,
    new Promise(resolve=>setTimeout(()=>resolve(false),timeoutMs))
  ]);
}

async function checkLogin(){
  if(passwordRecoveryActive){
    showPasswordUpdateForm();
    return;
  }
  if(recoveryRedirectInUrl()){
    const resetButton=document.getElementById('reset-request-btn');
    showAuthForm('reset-request-form');
    authMessage('reset-request-message','再設定リンクを確認しています。');
    resetButton.disabled=true;
    resetButton.textContent='確認中...';
    try{
      await db.auth.getSession();
    }catch{
      // PASSWORD_RECOVERYイベントを認可根拠とし、取得失敗は下の汎用表示へまとめる。
    }
    const recoveryReady=await waitForPasswordRecoveryEvent();
    resetButton.disabled=false;
    resetButton.textContent='再設定メールを送る';
    if(recoveryReady) return;
    clearRecoveryUrl();
    showPasswordResetRequest();
    authMessage('reset-request-message','再設定リンクが無効か期限切れです。再設定メールをもう一度送信してください。',true);
    return;
  }
  const {data:{session}} = await db.auth.getSession();
  if(passwordRecoveryActive){
    showPasswordUpdateForm();
    return;
  }
  if(session){
    showApp();
  } else {
    showLoginForm();
  }
}

db.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'&&session){
    passwordRecoveryActive=true;
    resolvePasswordRecoveryEvent(true);
    clearRecoveryUrl();
    showPasswordUpdateForm();
  }
});

async function doEmailLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pw').value;
  clearAuthMessage('login-status');
  if(!email || !pw){
    authMessage('login-err','メールアドレスとパスワードを入力してください。',true);
    return;
  }
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'ログイン中...';
  clearAuthMessage('login-err');

  const {error} = await db.auth.signInWithPassword({ email, password: pw });

  if(error){
    authMessage('login-err','ログインできませんでした。入力内容を確認してください。',true);
    btn.disabled = false;
    btn.textContent = 'ログイン';
  } else {
    document.getElementById('login-screen').style.display='none';
    showApp();
  }
}

async function requestPasswordReset(){
  const email=document.getElementById('reset-email').value.trim();
  const btn=document.getElementById('reset-request-btn');
  clearAuthMessage('reset-request-message');
  if(!email){
    authMessage('reset-request-message','メールアドレスを入力してください。',true);
    return;
  }
  btn.disabled=true;
  btn.textContent='送信中...';
  const redirectTo=`${window.location.origin}${window.location.pathname}`;
  try{
    const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
    if(error){
      authMessage('reset-request-message','再設定メールを送信できませんでした。時間をおいて再度お試しください。',true);
      return;
    }
    authMessage('reset-request-message','アカウントが登録されている場合、再設定メールを送信しました。メール内のリンクを開いてください。');
  }catch{
    authMessage('reset-request-message','再設定メールを送信できませんでした。時間をおいて再度お試しください。',true);
  }finally{
    btn.disabled=false;
    btn.textContent='再設定メールを送る';
  }
}

async function updateRecoveredPassword(){
  const newPassword=document.getElementById('new-password').value;
  const confirmation=document.getElementById('new-password-confirmation').value;
  const btn=document.getElementById('password-update-btn');
  clearAuthMessage('password-update-message');
  if(newPassword.length<12){
    authMessage('password-update-message','新しいパスワードは12文字以上で入力してください。',true);
    return;
  }
  if(newPassword!==confirmation){
    authMessage('password-update-message','確認用パスワードが一致しません。',true);
    return;
  }
  btn.disabled=true;
  btn.textContent='更新中...';
  try{
    const {error}=await db.auth.updateUser({password:newPassword});
    if(error){
      authMessage('password-update-message','パスワードを更新できませんでした。再設定メールからやり直してください。',true);
      return;
    }

    let globalSignOutFailed=false;
    try{
      const {error:signOutError}=await db.auth.signOut({scope:'global'});
      if(signOutError) globalSignOutFailed=true;
    }catch{
      globalSignOutFailed=true;
    }
    if(globalSignOutFailed){
      try{
        await db.auth.signOut({scope:'local'});
      }catch{
        // 更新自体は完了済みのため、下の完了表示で失効未確認を明示する。
      }
    }
    passwordRecoveryActive=false;
    if(globalSignOutFailed){
      showLoginForm('パスワードは更新されましたが、ほかの端末からのログアウトを確認できませんでした。管理者へご連絡ください。',true);
    }else{
      showLoginForm('パスワードを更新しました。新しいパスワードでログインしてください。');
    }
  }catch{
    authMessage('password-update-message','パスワードを更新できませんでした。再設定メールからやり直してください。',true);
  }finally{
    document.getElementById('new-password').value='';
    document.getElementById('new-password-confirmation').value='';
    btn.disabled=false;
    btn.textContent='新しいパスワードを設定';
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
