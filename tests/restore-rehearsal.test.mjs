import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeBackup,verifyBackup,restoreToEmptyEmulator} from '../scripts/security/isolated-restore.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const str=s=>({stringValue:s});
function fixture(){
 const current='data:image/png;base64,YQ==',legacy='data:application/pdf;base64,Yg==';
 const currentHash=hash(current),legacyHash=hash(legacy);
 const tables=['settings','clients','sites','assignments','billing','contracts','doc_templates','work_patterns','contract_employees','employee_records','departments','visa_types','emp_work_patterns','company_info','employees','yukyu_records','yukyu_grants','certificates','employment_contracts','dispatch_contracts'];
 const documents=Object.fromEntries(tables.map(table=>[table+'/fixture',{id:str('fixture'),name:str('synthetic fixture'),_revision:{integerValue:'2'}}]));
 documents['employees/fixture'].files={arrayValue:{values:[str(`firebase-firestore://attachments/v1/${currentHash}/2`),str(`firebase-rtdb://blobs/migration-v1/${legacyHash}`)]}};
 documents[`_attachment_chunks/${currentHash}-0`]={data:str(current.slice(0,10))};
 documents[`_attachment_chunks/${currentHash}-1`]={data:str(current.slice(10))};
 documents['_meta/counters']={employees:{integerValue:'1'}};
 documents['_audit_events/event']={actorUid:str('synthetic-admin'),recordedAt:{timestampValue:'2026-01-01T00:00:00Z'}};
 documents['_meta/last-write']={auditId:str('event')};
 return {documents,legacyBlobs:{[legacyHash]:{data:legacy}}};
}
test('complete synthetic snapshot preserves all 20 tables, metadata, audit, current and legacy attachments',()=>{
 const backup=makeBackup(fixture());assert.deepEqual(verifyBackup(backup),{documents:25,legacyBlobs:1,attachmentReferences:2});
 assert.deepEqual(JSON.parse(JSON.stringify(backup)),backup);
});
test('corrupt manifests and missing or changed attachments fail before restore',async()=>{
 const good=makeBackup(fixture());const bad=structuredClone(good);bad.payload.documents['employees/fixture'].name=str('tampered');assert.throws(()=>verifyBackup(bad),/manifest/);
 for(const mutation of [s=>delete s.documents[Object.keys(s.documents).find(x=>x.startsWith('_attachment_chunks/'))],s=>s.documents[Object.keys(s.documents).find(x=>x.startsWith('_attachment_chunks/'))].data=str('changed'),s=>s.legacyBlobs={}]){
  const source=fixture();mutation(source);const backup=makeBackup(source);assert.throws(()=>verifyBackup(backup),/Missing|hash/);
  await assert.rejects(restoreToEmptyEmulator(backup),/Missing|hash/);
 }
 await assert.rejects(restoreToEmptyEmulator(good,'kakuzen-employee-ledger'),/Only dedicated demo/);
});
test('both emulator databases restore and read back exactly; nonempty destination is refused', {skip:process.env.KAKUZEN_RESTORE_EMULATOR!=='1'},async()=>{
 const backup=makeBackup(fixture());const project='demo-kakuzen-restore-'+Date.now();
 assert.deepEqual(await restoreToEmptyEmulator(backup,project),{documents:25,legacyBlobs:1,attachmentReferences:2,verifiedReadBack:true});
 await assert.rejects(restoreToEmptyEmulator(backup,project),/must be empty/);
});
