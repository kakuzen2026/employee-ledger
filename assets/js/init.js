// ===== INIT =====
// Supabase Auth セッションで従業員管理を自動ログイン
db.auth.getSession().then(({data:{session}})=>{
  if(session){
    document.getElementById('emp-login').style.display='none';
    document.getElementById('emp-app-inner').style.display='flex';
    if(!window._empLoaded){window._empLoaded=true;loadAndRender();}
  }
});
checkLogin();
