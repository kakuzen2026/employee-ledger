// ---- Firebase data access ----
const EMPLOYEE_SELECT='id,shain_no,my_number,sei,mei,seikana,meikana,birthday,gender,nationality,address,tel,email,company,dept_id,position,koyou,employment_type,nyusha_date,taishoku_date,status,kyuyo,jikyu,visa,visa_expiry,visa_no,koyo_hoken_no,koyo_nyusha,koyo_soshitsu,shakai_hoken_no,shakai_nyusha,shakai_soshitsu,license_no,license_date,license_expiry,bank_name,bank_branch,bank_account_no,bank_account_name,memo,yukyu_list,kenkou_list,shikaku_list,residence_card_imgs,license_imgs,contract_other_system,kousoku_start_date,updated_at';

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
async function updateEmployee(id,patch){return firebaseRows(db.from('employees').update(patch).eq('id',id));}
async function retireEmployee(id,date){return updateEmployee(id,{status:'退職',taishoku_date:date,updated_at:date});}
async function updateEmployeeMemo(id,memo,updatedAt){return updateEmployee(id,{memo,updated_at:updatedAt});}
async function updateResidenceCardImages(id,imgs,updatedAt){return updateEmployee(id,{residence_card_imgs:imgs,updated_at:updatedAt});}
async function updateLicenseImages(id,imgs,updatedAt){return updateEmployee(id,{license_imgs:imgs,updated_at:updatedAt});}
async function updateEmployeeLicense(id,patch){return updateEmployee(id,patch);}
async function updateEmployeeShikaku(id,shikakuList,updatedAt){return updateEmployee(id,{shikaku_list:shikakuList,updated_at:updatedAt});}
async function updateEmployeeKenko(id,kenkouList,updatedAt){return updateEmployee(id,{kenkou_list:kenkouList,updated_at:updatedAt});}
async function updateKousokuStartDate(id,date,updatedAt){return updateEmployee(id,{kousoku_start_date:date||null,updated_at:updatedAt});}

async function createYukyuGrants(batch){return firebaseRows(db.from('yukyu_grants').insert(batch));}
async function saveYukyuGrant(id,data){return id?firebaseRows(db.from('yukyu_grants').update(data).eq('id',id)):firebaseRows(db.from('yukyu_grants').insert(data));}
async function deleteYukyuGrant(id){return firebaseRows(db.from('yukyu_grants').delete().eq('id',id));}
async function createYukyuRecord(data){return firebaseRows(db.from('yukyu_records').insert(data));}
async function updateYukyuRecord(id,data){return firebaseRows(db.from('yukyu_records').update(data).eq('id',id));}
async function deleteYukyuRecord(id){return firebaseRows(db.from('yukyu_records').delete().eq('id',id));}

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
