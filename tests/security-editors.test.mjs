import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
for(const table of ['clients','billing'])test(`${table} editor saves its opening revision and preserves inputs when stale`,async()=>{
 const source=await readFile(new URL(table==='clients'?'../assets/js/dispatch.js':'../assets/js/billing-settings.js',import.meta.url),'utf8');
 const revision=table==='clients'?'clientEditRevision':'billingEditRevision';
 const open=table==='clients'?'openClientModal':'openBillingModal',save=table==='clients'?'saveClient':'saveBilling';
 const prefix=table==='clients'?'c':'b';
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:''});return nodes.get(id);};
 let expected,closed=false,reloaded=false;
 const query={select(){return this},order(){return this},update(){return this},expectRevision(v){expected=v;return this},eq(){return Promise.resolve({error:{code:'STALE_WRITE',message:'stale'}})},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};
 const context=vm.createContext({document:{getElementById:node},db:{from:()=>query},Date,Number,esc:x=>x,reportReadFailure:()=>false,openModal(){},closeModal(){closed=true},loadBilling(){reloaded=true},loadClients(){reloaded=true},toast(){}});
 const section=(name,next)=>source.slice(source.indexOf((source.includes('async function '+name)?'async ':'')+'function '+name+'('),source.indexOf('\nasync function '+next+'('));
 vm.runInContext(`let ${revision};\n`+section(open,save)+section(save,table==='clients'?'deleteClient':'deleteBilling'),context);
 const record=table==='clients'?{id:'fixture',_revision:7,name:'synthetic'}:{id:'fixture',_revision:7,amount:100,billing_month:'2026-01-01',client_id:'fixture'};
 await context[open](record);record._revision=99;node(prefix+'-name').value='entered';node('b-client-id').value='fixture';node('b-month').value='2026-01';node('b-amount').value='100';
 await context[save]();assert.equal(expected,7);assert.equal(closed,false);assert.equal(reloaded,false);assert.equal(node(prefix+'-id').value,'fixture');
});
