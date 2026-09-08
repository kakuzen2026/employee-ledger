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
function fileDropHint(accept){
  return '<span class="file-drop-instruction">ファイルをここにドロップ<br><span>またはクリック・タップして選択</span></span><small>'+(accept.includes('.csv')?'CSV':accept.includes('pdf')?'画像・PDF（5MB以下）':'画像（5MB以下）')+'・1ファイルずつ</small>';
}
function fileDropZone(id,accept,onchange){
  return '<label class="file-dropzone" tabindex="0" role="button" aria-label="ファイルを添付"><input type="file" id="'+id+'" accept="'+accept+'" onchange="'+onchange+'">'+fileDropHint(accept)+'</label>';
}
function isFileDrag(event){return Array.from(event.dataTransfer?.types||[]).includes('Files');}
function fileDropBlocked(input){return input.disabled||input.dataset.filePending==='true'||(typeof EMP_UI!=='undefined'&&EMP_UI.saving);}
function validFileSelection(input,files){
  if(files.length!==1){showToast('ファイルは1つずつ追加してください','error');return false;}
  const file=files[0],accept=input.accept;
  if(accept.includes('.csv')){if(/\.csv$/i.test(file.name))return true;showToast('CSVファイルを選択してください','error');return false;}
  if(!validateUploadFile(file))return false;
  if(!accept.includes('pdf')&&!file.type.startsWith('image/')){showToast('画像ファイルを選択してください','error');return false;}
  return true;
}
document.addEventListener('dragover',event=>{
  if(!isFileDrag(event))return;
  event.preventDefault();
  const zone=event.target.closest('.file-dropzone');
  if(zone&&!fileDropBlocked(zone.querySelector('input[type="file"]')))zone.classList.add('dragover');
});
document.addEventListener('dragleave',event=>{const zone=event.target.closest('.file-dropzone');if(zone&&!zone.contains(event.relatedTarget))zone.classList.remove('dragover');});
document.addEventListener('drop',event=>{
  if(!isFileDrag(event))return;
  event.preventDefault();
  document.querySelectorAll('.file-dropzone.dragover').forEach(zone=>zone.classList.remove('dragover'));
  const input=event.target.closest('.file-dropzone')?.querySelector('input[type="file"]');
  if(!input||fileDropBlocked(input))return;
  if(!validFileSelection(input,event.dataTransfer.files))return;
  input.files=event.dataTransfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
});
document.addEventListener('change',event=>{
  const input=event.target;
  if(!input.matches('input[type="file"]')||!input.files.length)return;
  if(fileDropBlocked(input)||!validFileSelection(input,input.files)){event.stopImmediatePropagation();input.value='';}
},true);
document.addEventListener('click',event=>{
  const zone=event.target.closest('.file-dropzone');
  if(zone&&fileDropBlocked(zone.querySelector('input[type="file"]'))){event.preventDefault();event.stopImmediatePropagation();}
},true);
document.addEventListener('keydown',event=>{
  const zone=event.target.closest('.file-dropzone');
  if(zone&&event.target===zone&&(event.key==='Enter'||event.key===' ')){event.preventDefault();const input=zone.querySelector('input[type="file"]');if(!fileDropBlocked(input))input.click();}
});

// ---- 画像圧縮共通関数 ----
function validateUploadFile(file){
  const okType=file.type.startsWith('image/')||file.type==='application/pdf';
  if(!okType){showToast('画像またはPDFのみ添付できます','error');return false;}
  if(file.size>5*1024*1024){showToast('添付ファイルは5MB以下にしてください','error');return false;}
  return true;
}
function fileToDataURL(file){
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=ev=>resolve(ev.target.result);r.onerror=()=>reject(new Error('ファイルを読み込めません'));r.onabort=()=>reject(new Error('読み込みを中断しました'));r.readAsDataURL(file);});
}
function compressImage(file,maxPx=1200,quality=0.8){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(new Error("画像を読み込めません"));
    r.onabort=()=>reject(new Error("読み込みを中断しました"));
    r.onload=ev=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("画像を読み込めません"));
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


async function readAttachment(input,apply){
  const file=input.files[0];if(!file||!validateUploadFile(file))return;
  input.dataset.filePending='true';input.closest('.file-dropzone')?.setAttribute('aria-busy','true');
  try{const data=await (file.type.startsWith('image/')?compressImage(file):fileToDataURL(file));if(input.isConnected)await apply(data,file);}
  catch(error){if(input.isConnected)showToast('ファイルを読み込めませんでした。もう一度選択してください。','error');}
  finally{input.dataset.filePending='false';input.closest('.file-dropzone')?.removeAttribute('aria-busy');input.value='';}
}
function attachmentsStillLoading(){
  if(!document.querySelector('input[data-file-pending="true"]'))return false;
  showToast('ファイルの準備が終わるまでお待ちください。','warn');return true;
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
  const e=employees.find(x=>x.id===empId);
  if(!e)return;
  if((e.residence_card_imgs||[]).length>=4){showToast('最大4枚です','warn');return;}
  return readAttachment(input,async(data)=>{
    const images=[...(e.residence_card_imgs||[]),data],updated=new Date().toISOString().slice(0,10);
    await updateResidenceCardImages(empId,images,updated);
    e.residence_card_imgs=images;e.updated_at=updated;
    if(input.isConnected)renderDT();
  });
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
  const e=employees.find(x=>x.id===empId);
  if(!e)return;
  if((e.license_imgs||[]).length>=4){showToast('最大4枚です','warn');return;}
  return readAttachment(input,async(data)=>{
    const images=[...(e.license_imgs||[]),data],updated=new Date().toISOString().slice(0,10);
    await updateLicenseImages(empId,images,updated);
    e.license_imgs=images;e.updated_at=updated;
    if(input.isConnected)renderDT();
  });
}
async function delLicImg(i){
  const e=employees.find(x=>x.id===viewingId);
  e.license_imgs=e.license_imgs||[];
  e.license_imgs.splice(i,1);
  e.updated_at=new Date().toISOString().slice(0,10);
  await updateLicenseImages(viewingId,e.license_imgs,e.updated_at);
  renderDT();
}
function previewSkImg(input){return readAttachment(input,(data,file)=>{skImgData=data;document.getElementById('skImgName').textContent=file.name;});}
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
}
async function addShikaku(id){
  if(attachmentsStillLoading())return;
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
function previewKI(input){return readAttachment(input,(data,file)=>{kenkoImgData=data;document.getElementById('kimgName').textContent=file.name;});}
async function addKenko(id){
  if(attachmentsStillLoading())return;
  const e=employees.find(x=>x.id===id),d=document.getElementById('kd').value;
  if(!d){showToast('受診日を入力してください','error');return;}
  e.kenkou_list.push({date:d,result:document.getElementById('kr').value,img:kenkoImgData});
  kenkoImgData='';e.updated_at=new Date().toISOString().slice(0,10);
  await updateEmployeeKenko(id,e.kenkou_list,e.updated_at);renderDT();
}

