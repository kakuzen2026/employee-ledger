// ---- 派遣契約読み込み ----
async function loadDispatchContracts(employeeId){
  try{
    const data=await fetchDispatchContractsForEmployee(employeeId);
    return data||[];
  }catch(e){console.error('派遣契約取得エラー',e);return[];}
}
// ---- ファイル表示ヘルパー ----
function filePreviewHtml(src,height='100px'){
  if(!src)return'';
  if(src.includes('data:application/pdf')||src.includes('data:application/octet')||src.includes('data:application/x-pdf')){
    return`<a href="${src}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;background:var(--emp-info-light);color:var(--emp-info);border-radius:var(--emp-radius);font-size:12px;text-decoration:none;border:1px solid var(--border)">📄 PDFを開く</a>`;
  }
  if(src.startsWith('data:image/')){
    return`<img src="${src}" style="max-height:${height};border-radius:var(--emp-radius);border:1px solid var(--emp-border);cursor:pointer" onclick="window.open('${src}')">`;
  }
  // 不明なファイル形式
  return`<a href="${src}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;background:var(--emp-bg);color:var(--emp-text2);border-radius:var(--emp-radius);font-size:12px;text-decoration:none;border:1px solid var(--border)">📎 ファイルを開く</a>`;
}

function multiImgGrid(imgs,onDelete){
  if(!imgs||imgs.length===0)return'<span style="color:var(--emp-text3);font-size:13px">未登録</span>';
  return`<div style="display:flex;gap:8px;flex-wrap:wrap">${imgs.map((src,i)=>`
    <div style="position:relative;display:inline-block">
      ${filePreviewHtml(src,'120px')}
      ${onDelete?`<button onclick="${onDelete}(${i})" style="position:absolute;top:2px;right:2px;background:var(--emp-danger);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;padding:2px 5px">✕</button>`:''}
    </div>`).join('')}</div>`;
}

// ---- ドラッグ＆ドロップ共通 ----
function setupDrop(areaId,callback){
  const el=document.getElementById(areaId);
  if(!el)return;
  el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('dragover');});
  el.addEventListener('dragleave',()=>el.classList.remove('dragover'));
  el.addEventListener('drop',e=>{
    e.preventDefault();el.classList.remove('dragover');
    const file=e.dataTransfer.files[0];
    if(!file)return;
    if(!validateUploadFile(file))return;
    if(file.type.startsWith('image/')){
      compressImage(file).then(data=>callback(data,file.name));
    } else {
      // PDF等は圧縮せずbase64に
      const r=new FileReader();
      r.onload=ev=>callback(ev.target.result,file.name);
      r.readAsDataURL(file);
    }
  });
}

// ---- 画像圧縮共通関数 ----
function validateUploadFile(file){
  const okType=file.type.startsWith('image/')||file.type==='application/pdf';
  if(!okType){showToast('画像またはPDFのみ添付できます','error');return false;}
  if(file.size>5*1024*1024){showToast('添付ファイルは5MB以下にしてください','error');return false;}
  return true;
}
function fileToDataURL(file){
  return new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(file);});
}
function compressImage(file,maxPx=1200,quality=0.8){
  return new Promise(resolve=>{
    const r=new FileReader();
    r.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        let w=img.width,h=img.height;
        if(w>maxPx||h>maxPx){
          if(w>h){h=Math.round(h*maxPx/w);w=maxPx;}
          else{w=Math.round(w*maxPx/h);h=maxPx;}
        }
        const canvas=document.createElement('canvas');
        canvas.width=w;canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg',quality));
      };
      img.src=ev.target.result;
    };
    r.readAsDataURL(file);
  });
}

let licImgData='',skImgData='';
async function previewLicImg(input){
  const f=input.files[0];if(!f)return;
  if(!validateUploadFile(f)){input.value='';return;}
  document.getElementById('licImgName').textContent=f.name+'（圧縮中…）';
  if(f.type.startsWith('image/')){licImgData=await compressImage(f);}
  else{const r=new FileReader();r.onload=ev=>{licImgData=ev.target.result;};r.readAsDataURL(f);}
  document.getElementById('licImgName').textContent=f.name;
}

// ---- 在留カード複数枚 ----
async function addRcImg(empId,input){
  const f=input.files[0];if(!f)return;
  if(!validateUploadFile(f)){input.value='';return;}
  const e=employees.find(x=>x.id===empId);
  e.residence_card_imgs=e.residence_card_imgs||[];
  if(e.residence_card_imgs.length>=4){showToast('最大4枚です','warn');return;}
  let data;
  if(f.type.startsWith('image/')){data=await compressImage(f);}
  else{data=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});}
  e.residence_card_imgs.push(data);
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateResidenceCardImages(empId,e.residence_card_imgs,e.updated_at);
  renderDT();
  setTimeout(()=>setupDrop('rcDetailDrop',(d)=>addRcImgDrop(empId,d)),50);
}
async function addRcImgDrop(empId,data){
  const e=employees.find(x=>x.id===empId);
  e.residence_card_imgs=e.residence_card_imgs||[];
  if(e.residence_card_imgs.length>=4){showToast('最大4枚です','warn');return;}
  e.residence_card_imgs.push(data);
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateResidenceCardImages(empId,e.residence_card_imgs,e.updated_at);
  renderDT();
}
async function delRcImg(i){
  const e=employees.find(x=>x.id===viewingId);
  e.residence_card_imgs=e.residence_card_imgs||[];
  e.residence_card_imgs.splice(i,1);
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateResidenceCardImages(viewingId,e.residence_card_imgs,e.updated_at);
  renderDT();
}

// ---- 免許証複数枚 ----
async function addLicImg(empId,input){
  const f=input.files[0];if(!f)return;
  if(!validateUploadFile(f)){input.value='';return;}
  const e=employees.find(x=>x.id===empId);
  e.license_imgs=e.license_imgs||[];
  if(e.license_imgs.length>=4){showToast('最大4枚です','warn');return;}
  let data;
  if(f.type.startsWith('image/')){data=await compressImage(f);}
  else{data=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});}
  e.license_imgs.push(data);
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateLicenseImages(empId,e.license_imgs,e.updated_at);
  renderDT();
  setTimeout(()=>setupDrop('licDetailDrop',(d)=>addLicImgDrop(empId,d)),50);
}
async function addLicImgDrop(empId,data){
  const e=employees.find(x=>x.id===empId);
  e.license_imgs=e.license_imgs||[];
  if(e.license_imgs.length>=4){showToast('最大4枚です','warn');return;}
  e.license_imgs.push(data);
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateLicenseImages(empId,e.license_imgs,e.updated_at);
  renderDT();
}
async function delLicImg(i){
  const e=employees.find(x=>x.id===viewingId);
  e.license_imgs=e.license_imgs||[];
  e.license_imgs.splice(i,1);
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateLicenseImages(viewingId,e.license_imgs,e.updated_at);
  renderDT();
}
async function previewSkImg(input){
  const f=input.files[0];if(!f)return;
  document.getElementById('skImgName').textContent=f.name+'（圧縮中…）';
  skImgData=await compressImage(f);
  document.getElementById('skImgName').textContent=f.name;
}
async function saveLicense(id){
  const e=employees.find(x=>x.id===id);
  const patch={
    license_no:document.getElementById('lic_no')?.value||'',
    license_date:document.getElementById('lic_date')?.value||'',
    license_expiry:document.getElementById('lic_expiry')?.value||'',
    updated_at:new Date().toISOString().slice(0,10)
  };
  Object.assign(e,patch);
  await updateEmployeeLicense(id,patch);
  showToast('保存しました');renderDT();
  setTimeout(()=>{
    setupDrop('licDetailDrop',(d)=>addLicImgDrop(id,d));
    setupDrop('rcDetailDrop',(d)=>addRcImgDrop(id,d));
  },50);
}
async function addShikaku(id){
  const e=employees.find(x=>x.id===id);
  const name=document.getElementById('sk_name')?.value.trim();
  if(!name){showToast('資格名を入力してください','error');return;}
  e.shikaku_list=e.shikaku_list||[];
  e.shikaku_list.push({name,date:document.getElementById('sk_date')?.value||'',expiry:document.getElementById('sk_expiry')?.value||'',img:skImgData});
  skImgData='';e.updated_at=new Date().toISOString().slice(0,10);
  await updateEmployeeShikaku(id,e.shikaku_list,e.updated_at);renderDT();
}
async function delShikaku(id,i){
  const e=employees.find(x=>x.id===id);
  e.shikaku_list.splice(i,1);e.updated_at=new Date().toISOString().slice(0,10);
  await updateEmployeeShikaku(id,e.shikaku_list,e.updated_at);renderDT();
}

async function delKenko(id,i){
  const e=employees.find(x=>x.id===id);e.kenkou_list.splice(i,1);e.updated_at=new Date().toISOString().slice(0,10);
  await updateEmployeeKenko(id,e.kenkou_list,e.updated_at);renderDT();
}
function previewKI(input){
  const f=input.files[0];if(!f)return;
  document.getElementById('kimgName').textContent=f.name+'（圧縮中…）';
  compressImage(f).then(data=>{kenkoImgData=data;document.getElementById('kimgName').textContent=f.name;});
}
async function addKenko(id){
  const e=employees.find(x=>x.id===id),d=document.getElementById('kd').value;
  if(!d){showToast('受診日を入力してください','error');return;}
  e.kenkou_list.push({date:d,result:document.getElementById('kr').value,img:kenkoImgData});
  kenkoImgData='';e.updated_at=new Date().toISOString().slice(0,10);
  await updateEmployeeKenko(id,e.kenkou_list,e.updated_at);renderDT();
}

