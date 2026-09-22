// ---- Firebase data access ----
const EMPLOYEE_SELECT='_revision,id,shain_no,my_number,sei,mei,seikana,meikana,birthday,gender,nationality,address,tel,email,company,dept_id,position,koyou,employment_type,nyusha_date,taishoku_date,status,kyuyo,jikyu,visa,visa_expiry,visa_no,koyo_hoken_no,koyo_nyusha,koyo_soshitsu,shakai_hoken_no,shakai_nyusha,shakai_soshitsu,license_no,license_date,license_expiry,bank_name,bank_branch,bank_account_no,bank_account_name,memo,yukyu_list,kenkou_list,shikaku_list,residence_card_imgs,license_imgs,contract_other_system,kousoku_start_date,updated_at';

async function firebaseRows(query){
  const {data,error}=await query;
  if(error)throw error;
  return data||[];
}

async function fetchEmployees(){return firebaseRows(db.from('employees').select(EMPLOYEE_SELECT).order('id'));}
async function fetchYukyuRecords(){return firebaseRows(db.from('yukyu_records').select('*').order('use_date',{ascending:false}).order('id',{ascending:false}));}
async function fetchYukyuGrants(){return firebaseRows(db.from('yukyu_grants').select('*').order('grant_date').order('id'));}
async function fetchDepartments(){return firebaseRows(db.from('departments').select('*').order('sort_order').order('id'));}
async function fetchVisaTypes(){return firebaseRows(db.from('visa_types').select('*').order('id'));}
async function fetchCompanyInfo(){const rows=await firebaseRows(db.from('company_info').select('*').limit(1));return rows[0]||{};}
async function fetchCertificates(){return firebaseRows(db.from('certificates').select('*').order('created_at',{ascending:false}));}
async function fetchWorkPatterns(){return firebaseRows(db.from('emp_work_patterns').select('*').order('sort_order').order('id'));}
async function fetchEmploymentContracts(){return firebaseRows(db.from('employment_contracts').select('*').order('created_at',{ascending:false}));}
async function fetchDispatchContractsForEmployee(employeeId){return firebaseRows(db.from('dispatch_contracts').select('*').eq('employee_id',employeeId).order('contract_end',{ascending:false}));}
async function fetchDispatchContractEnds(){return firebaseRows(db.from('dispatch_contracts').select('employee_id,contract_end'));}
async function fetchDispatchContractsByEnd(){return firebaseRows(db.from('dispatch_contracts').select('*').order('contract_end'));}
async function fetchDispatchContractEmployeeSummaries(){
  const rows=await firebaseRows(db.from('dispatch_contracts').select('*'));
  return rows.map((row)=>({
    ...row,
    contract_employees:[{
      employee_id:row.employee_id,
      employment_type:row.employment_type||'',
      is_active:row.is_active!==false,
      contract_end:row.contract_end||null
    }]
  }));
}

async function createEmployee(data){return firebaseRows(db.from('employees').insert(data));}
async function updateEmployee(id,patch,expectedRevision=employees.find(e=>e.id===id)?._revision){
  if(!employees.some(e=>e.id===id))throw new Error('従業員の最新情報を読み込んでください。');
  try{
    const rows=await firebaseRows(db.updateByRevision('employees',id,expectedRevision,patch));
    const local=employees.find(e=>e.id===id);if(local)Object.assign(local,patch,{_revision:rows[0]._revision});
    return rows;
  }catch(error){
    if(error.code==='STALE_WRITE')error.message='別の端末またはタブで更新されています。最新情報を読み込んでから再度操作してください。';
    showToast(error.message,'error');throw error;
  }
}
async function retireEmployee(id,date){return updateEmployee(id,{status:'退職',taishoku_date:date,updated_at:date});}
async function updateEmployeeMemo(id,memo,updatedAt){return updateEmployee(id,{memo,updated_at:updatedAt});}
async function updateResidenceCardImages(id,imgs,updatedAt){return updateEmployee(id,{residence_card_imgs:imgs,updated_at:updatedAt});}
async function updateLicenseImages(id,imgs,updatedAt){return updateEmployee(id,{license_imgs:imgs,updated_at:updatedAt});}
async function updateEmployeeLicense(id,patch){return updateEmployee(id,patch);}
async function updateEmployeeShikaku(id,shikakuList,updatedAt){return updateEmployee(id,{shikaku_list:shikakuList,updated_at:updatedAt});}
async function updateEmployeeKenko(id,kenkouList,updatedAt){return updateEmployee(id,{kenkou_list:kenkouList,updated_at:updatedAt});}
async function updateKousokuStartDate(id,date,updatedAt){return updateEmployee(id,{kousoku_start_date:date||null,updated_at:updatedAt});}

function newYukyuRow(data){const {_revision,...row}=data;return{...row,_revision:1};}
function validateYukyuGrant(data){
  if(data.days!=null&&(typeof data.days!=='number'||!Number.isFinite(data.days)||data.days<0))throw new Error('付与日数は0以上の数値を入力してください');
  for(const field of ['grant_date','expire_date'])if(Object.hasOwn(data,field)&&!normalizeDateStr(data[field]))throw new Error('付与日・有効期限の日付を確認してください');
  if(data.grant_date&&data.expire_date&&data.expire_date<data.grant_date)throw new Error('有効期限は付与日以降にしてください');
}
async function createYukyuGrants(batch,updates=[]){
  batch.forEach(validateYukyuGrant);updates.forEach(u=>validateYukyuGrant(u.patch));
  await db.atomicWrite([
    ...batch.map(row=>({table:'yukyu_grants',id:row.id,data:newYukyuRow(row),createOnly:true})),
    ...updates.map(u=>({table:'yukyu_grants',id:u.id,data:u.patch,expectedRevision:u.expectedRevision}))
  ]);
}
async function saveYukyuGrant(id,data,expectedRevision){validateYukyuGrant(data);return id==null?firebaseRows(db.from('yukyu_grants').insert(newYukyuRow(data))):firebaseRows(db.updateByRevision('yukyu_grants',id,expectedRevision,data));}
// Keep the date as a deletion marker so automatic grants cannot recreate it.
async function deleteYukyuGrant(id,expectedRevision){return firebaseRows(db.updateByRevision('yukyu_grants',id,expectedRevision,{deleted:true,days:0}));}
async function createYukyuRecord(data){return firebaseRows(db.from('yukyu_records').insert(newYukyuRow(data)));}
async function updateYukyuRecord(id,data,expectedRevision){return firebaseRows(db.updateByRevision('yukyu_records',id,expectedRevision,data));}
async function deleteYukyuRecord(id,expectedRevision){return firebaseRows(db.deleteByRevision('yukyu_records',id,expectedRevision));}

async function createDepartment(data){
  const sortOrder=Math.max(0,...(departments||[]).map(d=>Number(d.sort_order)).filter(Number.isFinite))+1;
  return firebaseRows(db.from('departments').insert({...data,sort_order:sortOrder}));
}
async function updateDepartment(id,data){return firebaseRows(db.from('departments').update(data).eq('id',id));}
async function deleteDepartment(id){return firebaseRows(db.from('departments').delete().eq('id',id));}
async function updateDepartmentSortOrders(depts){return Promise.all(depts.map((d,i)=>updateDepartment(d.id,{sort_order:i+1})));}

async function saveWorkPattern(id,data,sortOrder){return id?firebaseRows(db.from('emp_work_patterns').update(data).eq('id',id)):firebaseRows(db.from('emp_work_patterns').insert({...data,sort_order:sortOrder}));}
async function deleteWorkPatternRecord(id){return firebaseRows(db.from('emp_work_patterns').delete().eq('id',id));}
async function updateCompanyInfo(data){
  const {data:current,error}=await db.from('company_info').select('id').limit(1).maybeSingle();
  if(error)throw error;
  return current
    ? firebaseRows(db.from('company_info').update(data).eq('id',current.id))
    : firebaseRows(db.from('company_info').insert(data));
}
async function createCertificate(data){return firebaseRows(db.from('certificates').insert(data));}
async function deleteCertificate(id){return firebaseRows(db.from('certificates').delete().eq('id',id));}
async function createEmploymentContract(data){return firebaseRows(db.from('employment_contracts').insert(data));}
async function deleteEmploymentContractRecord(id){return firebaseRows(db.from('employment_contracts').delete().eq('id',id));}
async function saveVisaType(id,name){return id?firebaseRows(db.from('visa_types').update({name}).eq('id',id)):firebaseRows(db.from('visa_types').insert({name}));}
async function deleteVisaTypeRecord(id){return firebaseRows(db.from('visa_types').delete().eq('id',id));}
