import test, {before} from 'node:test';
const enabled=process.env.KAKUZEN_RULES_EMULATOR==='1';
import assert from 'node:assert/strict';
const project='demo-kakuzen-security';
const root=`http://127.0.0.1:8180/v1/projects/${project}/databases/(default)/documents`;
const name=p=>`projects/${project}/databases/(default)/documents/${p}`;
function value(v){if(v===null)return{nullValue:null};if(Array.isArray(v))return{arrayValue:{values:v.map(value)}};if(typeof v==='object')return{mapValue:{fields:fields(v)}};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};return{stringValue:v};}
function fields(v){return Object.fromEntries(Object.entries(v).map(([k,v])=>[k,value(v)]));}
const token=claims=>[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({iss:`https://securetoken.google.com/${project}`,aud:project,sub:'synthetic-admin',user_id:'synthetic-admin',iat:Math.floor(Date.now()/1000)-10,exp:Math.floor(Date.now()/1000)+3600,...claims})).toString('base64url'),''].join('.');
const admin=token({ledger_admin:true}),member=token({ledger_admin:false});
const put=(p,d)=>({update:{name:name(p),fields:fields(d)}});
async function commit(writes,auth=admin){const r=await fetch(root+':commit',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:`Bearer ${auth}`}:{})},body:JSON.stringify({writes})});const body=await r.json();return{status:r.status,body};}
function audited(ops,id){const event={actorUid:'synthetic-admin',created:[],updated:[],deleted:[]};const writes=ops.map(({path,data,remove,operation='updated'})=>{event[remove?'deleted':operation].push(path);return remove?{delete:name(path)}:put(path,{...data,_auditId:id});});const audit=put('_audit_events/'+id,event);audit.updateTransforms=[{fieldPath:'recordedAt',setToServerValue:'REQUEST_TIME'}];return [...writes,audit,put('_meta/last-write',{auditId:id})];}
async function ok(w){const r=await commit(w);assert.equal(r.status,200,JSON.stringify(r.body));}
async function denied(w,auth){const r=await commit(w,auth);assert.equal(r.status,403,JSON.stringify(r.body));}

before(async()=>{if(enabled){const r=await fetch(`http://127.0.0.1:8180/emulator/v1/projects/${project}/databases/(default)/documents`,{method:'DELETE',headers:{authorization:'Bearer owner'}});assert.ok(r.ok);}});

test('Rules: admin-only, minimum types, immutable identity/revision, atomic append-only audit and 450-row budget',{skip:!enabled},async()=>{
 await ok(audited([{path:'clients/c',operation:'created',data:{id:'c',name:'initial',_revision:1}}],'e1'));
 await denied([put('clients/c',{id:'c',name:'no audit',_revision:2})]);
 await denied(audited([{path:'clients/c',data:{id:'other',_revision:2}}],'bad-id'));
 await denied(audited([{path:'clients/c',data:{id:'c',_revision:1}}],'bad-revision'));
 await denied(audited([{path:'clients/c',data:{id:'c',_revision:2}}],'non-admin'),member);
 await denied(audited([{path:'clients/c',data:{id:'c',_revision:2}}],'anonymous'),null);
 await ok(audited([{path:'clients/c',data:{id:'c',name:'updated',_revision:2}}],'e2'));
 await denied(audited([{path:'clients/c',data:{id:'c',_revision:2}}],'stale'));
 await denied([put('_audit_events/e1',{actorUid:'synthetic-admin'})]);
 await denied([{delete:name('_audit_events/e1')}]);
 await denied(audited([{path:'billing/b',operation:'created',data:{id:'b',amount:1.5,is_billed:false,_revision:1}}],'bad-amount'));
 await denied(audited([{path:'billing/b',operation:'created',data:{id:'b',amount:100,is_billed:'yes',_revision:1}}],'bad-bool'));
 await ok(audited([{path:'billing/b',operation:'created',data:{id:'b',amount:-100,is_billed:false,_revision:1,legacy:'kept'}}],'bill'));
});

test('Rules: legacy data can keep unchanged legacy values, deletion requires audit; unknown tables denied',{skip:!enabled},async()=>{
 const seeded=await commit([put('billing/legacy',{id:'legacy',amount:'old',custom:{retained:true}})],'owner');assert.equal(seeded.status,200);
 await ok(audited([{path:'billing/legacy',data:{id:'legacy',amount:'old',custom:{retained:true},notes:'new',_revision:1}}],'legacy'));
 await denied([{delete:name('billing/legacy')}]);
 await ok(audited([{path:'billing/legacy',remove:true}],'delete-legacy'));
 await denied([put('_attachment_chunks/'+ 'a'.repeat(64)+'-0',{data:'x'.repeat(786433)})]);
 await ok([put('_attachment_chunks/'+ 'b'.repeat(64)+'-0',{data:'😀'.repeat(196608)})]);
 await denied([put('_attachment_chunks/'+ 'b'.repeat(64)+'-0',{data:'replaced'})]);
 await denied(audited([{path:'unknown/x',operation:'created',data:{id:'x',_revision:1}}],'unknown'));
 await ok(audited(Array.from({length:450},(_,i)=>({path:`departments/d${i}`,operation:'created',data:{id:`d${i}`,_revision:1}})),'bulk450'));
});
