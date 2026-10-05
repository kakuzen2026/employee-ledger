// Synthetic / emulator-only recovery rehearsal. No production endpoint or credential option.
import {createHash} from 'node:crypto';
const sha=v=>createHash('sha256').update(v).digest('hex');
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
function ensure(ok,message){if(!ok)throw new Error(message);}
export function makeBackup(snapshot){
 const payload=structuredClone(snapshot);
 const checksums=Object.fromEntries(Object.entries(payload.documents).map(([p,d])=>['firestore:'+p,sha(canonical(d))]));
 for(const [id,b] of Object.entries(payload.legacyBlobs))checksums['rtdb:'+id]=sha(canonical(b));
 return {format:'kakuzen-isolated-backup-v1',payload,checksums,payloadHash:sha(canonical(payload))};
}
export function verifyBackup(backup){
 ensure(backup.format==='kakuzen-isolated-backup-v1','Unknown backup format');
 const {documents,legacyBlobs}=backup.payload;
 ensure(documents && legacyBlobs,'Both databases must be present');
 ensure(backup.payloadHash===sha(canonical(backup.payload)),'Backup manifest mismatch');
 const expected=makeBackup(backup.payload).checksums;
 ensure(canonical(expected)===canonical(backup.checksums),'Backup item manifest mismatch');
 for(const path of Object.keys(documents))ensure(/^[a-z_]+\/[^/]+$/.test(path),'Invalid document path');
 let references=0;
 function visit(value){
  if(Array.isArray(value))return value.forEach(visit);
  if(value&&typeof value==='object')return Object.values(value).forEach(visit);
  if(typeof value!=='string')return;
  if(value.startsWith('firebase-firestore://attachments/v1/')){
   const match=/^firebase-firestore:\/\/attachments\/v1\/([a-f0-9]{64})\/([1-9][0-9]?)$/.exec(value);
   ensure(match&&Number(match[2])<=64,'Invalid attachment reference');
   const parts=Array.from({length:Number(match[2])},(_,i)=>documents[`_attachment_chunks/${match[1]}-${i}`]?.data?.stringValue);
   ensure(parts.every(x=>typeof x==='string'),'Missing attachment chunk');
   ensure(sha(parts.join(''))===match[1],'Attachment hash mismatch');references++;
  }else if(value.startsWith('firebase-rtdb://blobs/migration-v1/')){
   const id=value.slice('firebase-rtdb://blobs/migration-v1/'.length);
   ensure(/^[a-f0-9]{64}$/.test(id),'Invalid legacy reference');
   const blob=legacyBlobs[id];ensure(typeof blob?.data==='string','Missing legacy attachment');
   ensure(sha(blob.data)===id,'Legacy attachment hash mismatch');references++;
  }
 }
 for(const [path,fields] of Object.entries(documents))if(!path.startsWith('_attachment_chunks/'))visit(fields);
 return {documents:Object.keys(documents).length,legacyBlobs:Object.keys(legacyBlobs).length,attachmentReferences:references};
}
export async function restoreToEmptyEmulator(backup,project='demo-kakuzen-restore'){
 // No env-host fallbacks, live project ids, credentials, overwrite or retry options.
 ensure(/^demo-kakuzen-restore(?:-[a-z0-9]+)?$/.test(project),'Only dedicated demo restore projects are allowed');
 const summary=verifyBackup(backup); // Validate all content before any read/write.
 const base=`http://127.0.0.1:8180/v1/projects/${project}/databases/(default)/documents`;
 const rtdb=`http://127.0.0.1:9100/.json?ns=${project}-default-rtdb`;
 async function request(url,options={}){const r=await fetch(url,{redirect:'error',...options,headers:{authorization:'Bearer owner','content-type':'application/json',...options.headers}});ensure(r.ok,`Emulator request failed: ${r.status}`);return r.json();}
 const collections=await request(base+':listCollectionIds',{method:'POST',body:JSON.stringify({pageSize:1000})});
 ensure(!collections.collectionIds?.length,'Firestore destination must be empty');
 ensure(await request(rtdb)===null,'RTDB destination must be empty');
 const writes=Object.entries(backup.payload.documents).map(([path,fields])=>({update:{name:`projects/${project}/databases/(default)/documents/${path}`,fields}}));
 // A two-service recovery cannot be atomic. On failure keep the evidence, choose a NEW empty
 // demo destination, and repeat from the immutable verified backup. Never overwrite/resume.
 for(let start=0;start<writes.length;start+=450)await request(base+':commit',{method:'POST',body:JSON.stringify({writes:writes.slice(start,start+450)})});
 await request(rtdb,{method:'PUT',body:JSON.stringify({blobs:{'migration-v1':backup.payload.legacyBlobs}})});
 const restored={documents:{},legacyBlobs:{}};
 for(const path of Object.keys(backup.payload.documents)){const doc=await request(base+'/'+path);restored.documents[path]=doc.fields || {};}
 const legacy=await request(rtdb);restored.legacyBlobs=legacy?.blobs?.['migration-v1']||{};
 ensure(makeBackup(restored).payloadHash===backup.payloadHash,'Restored contents differ');
 verifyBackup(makeBackup(restored));
 return {...summary,verifiedReadBack:true};
}
