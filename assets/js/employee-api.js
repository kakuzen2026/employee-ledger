// ---- Supabase API ----
const EMPLOYEE_SELECT='id,shain_no,my_number,sei,mei,seikana,meikana,birthday,gender,nationality,address,tel,email,company,dept_id,position,koyou,employment_type,nyusha_date,taishoku_date,status,kyuyo,jikyu,visa,visa_expiry,visa_no,koyo_hoken_no,koyo_nyusha,koyo_soshitsu,shakai_hoken_no,shakai_nyusha,shakai_soshitsu,license_no,license_date,license_expiry,bank_name,bank_branch,bank_account_no,bank_account_name,memo,yukyu_list,kenkou_list,shikaku_list,residence_card_imgs,license_imgs,contract_other_system,kousoku_start_date,updated_at';

async function sb(path,method='GET',body=null){
  // 統合後DBはRLSでauthenticated前提のため、ユーザーJWTをBearerに渡す
  const {data:{session}}=await db.auth.getSession();
  const token=session?.access_token;
  if(!token)throw new Error('ログインセッションがありません。再ログインしてください。');
  const opts={method,headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=representation'}};
  if(body)opts.body=JSON.stringify(body);
  const res=await fetch(SUPABASE_URL+'/rest/v1/'+path,opts);
  if(!res.ok)throw new Error(await res.text());
  const t=await res.text();return t?JSON.parse(t):[];
}

async function fetchEmployees(){return sb('employees?select='+EMPLOYEE_SELECT+'&order=id.asc');}
async function fetchYukyuRecords(){return sb('yukyu_records?select=*&order=use_date.desc,id.desc');}
async function fetchYukyuGrants(){return sb('yukyu_grants?select=*&order=grant_date.asc');}
async function fetchDepartments(){return sb('departments?select=*&order=sort_order.asc,id.asc');}
async function fetchVisaTypes(){return sb('visa_types?select=*&order=id.asc');}
async function fetchCompanyInfo(){const rows=await sb('company_info?select=*&limit=1');return rows[0]||{};}
async function fetchCertificates(){return sb('certificates?select=*&order=created_at.desc');}
async function fetchWorkPatterns(){return sb('emp_work_patterns?select=*&order=sort_order.asc,id.asc');}
async function fetchEmploymentContracts(){return sb('employment_contracts?select=*&order=created_at.desc');}
async function fetchDispatchContractsForEmployee(employeeId){return sb('dispatch_contracts?employee_id=eq.'+employeeId+'&order=contract_end.desc');}
async function fetchDispatchContractEnds(){return sb('dispatch_contracts?select=employee_id,contract_end');}
async function fetchDispatchContractsByEnd(){return sb('dispatch_contracts?order=contract_end.asc');}
async function fetchDispatchContractEmployeeSummaries(){return sb('dispatch_contracts?select=id,contract_employees(employee_id,employment_type,is_active,contract_end)');}

async function createEmployee(data){return sb('employees','POST',data);}
async function updateEmployee(id,patch){return sb('employees?id=eq.'+id,'PATCH',patch);}
async function retireEmployee(id,date){return updateEmployee(id,{status:'退職',taishoku_date:date,updated_at:date});}
async function updateEmployeeMemo(id,memo,updatedAt){return updateEmployee(id,{memo,updated_at:updatedAt});}
async function updateResidenceCardImages(id,imgs,updatedAt){return updateEmployee(id,{residence_card_imgs:imgs,updated_at:updatedAt});}
async function updateLicenseImages(id,imgs,updatedAt){return updateEmployee(id,{license_imgs:imgs,updated_at:updatedAt});}
async function updateEmployeeLicense(id,patch){return updateEmployee(id,patch);}
async function updateEmployeeShikaku(id,shikakuList,updatedAt){return updateEmployee(id,{shikaku_list:shikakuList,updated_at:updatedAt});}
async function updateEmployeeKenko(id,kenkouList,updatedAt){return updateEmployee(id,{kenkou_list:kenkouList,updated_at:updatedAt});}
async function updateKousokuStartDate(id,date,updatedAt){return updateEmployee(id,{kousoku_start_date:date||null,updated_at:updatedAt});}

async function createYukyuGrants(batch){return sb('yukyu_grants','POST',batch);}
async function saveYukyuGrant(id,data){return id?sb('yukyu_grants?id=eq.'+id,'PATCH',data):sb('yukyu_grants','POST',data);}
async function deleteYukyuGrant(id){return sb('yukyu_grants?id=eq.'+id,'DELETE');}
async function createYukyuRecord(data){return sb('yukyu_records','POST',data);}
async function deleteYukyuRecord(id){return sb('yukyu_records?id=eq.'+id,'DELETE');}

async function createDepartment(data){return sb('departments','POST',data);}
async function updateDepartment(id,data){return sb('departments?id=eq.'+id,'PATCH',data);}
async function deleteDepartment(id){return sb('departments?id=eq.'+id,'DELETE');}
async function updateDepartmentSortOrders(depts){return Promise.all(depts.map((d,i)=>updateDepartment(d.id,{sort_order:i+1})));}

async function saveWorkPattern(id,data,sortOrder){return id?sb('emp_work_patterns?id=eq.'+id,'PATCH',data):sb('emp_work_patterns','POST',{...data,sort_order:sortOrder});}
async function deleteWorkPatternRecord(id){return sb('emp_work_patterns?id=eq.'+id,'DELETE');}
async function updateCompanyInfo(data){return sb('company_info?id=eq.1','PATCH',data);}
async function createCertificate(data){return sb('certificates','POST',data);}
async function deleteCertificate(id){return sb('certificates?id=eq.'+id,'DELETE');}
async function createEmploymentContract(data){return sb('employment_contracts','POST',data);}
async function deleteEmploymentContractRecord(id){return sb('employment_contracts?id=eq.'+id,'DELETE');}
async function saveVisaType(id,name){return id?sb('visa_types?id=eq.'+id,'PATCH',{name}):sb('visa_types','POST',{name});}
async function deleteVisaTypeRecord(id){return sb('visa_types?id=eq.'+id,'DELETE');}
