import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,nodeExe,environment} from '../scripts/local-runtime.mjs';
const cwd=path.join(root,'.state/evals/model-switch-'+Date.now());await mkdir(cwd,{recursive:true});
let buffer='',stderr='';const events=[],pending=new Map();
const child=spawn(nodeExe,['scripts/pia.mjs','--context','32768','--cwd',cwd,'--mode','rpc','--no-context-files'],{cwd:root,windowsHide:true,env:environment({PI_EFFORT_PREFERENCES:path.join(cwd,'preferences.json')}),stdio:['pipe','pipe','pipe']});
child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',b=>{buffer+=b;let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const e=JSON.parse(line);events.push(e);if(e.type==='response'&&pending.has(e.id)){pending.get(e.id)(e);pending.delete(e.id);}}catch{}}});
const wait=async(predicate)=>{const end=Date.now()+120000;while(!predicate()){if(child.exitCode!==null)throw Error('pia exited: '+stderr);if(Date.now()>end)throw Error('Timeout: '+stderr.slice(-1000));await new Promise(r=>setTimeout(r,100));}};
const send=async(type,fields={})=>{const id='r'+Math.random();let response;pending.set(id,e=>response=e);child.stdin.write(JSON.stringify({id,type,...fields})+'\n');await wait(()=>response);assert.equal(response.success,true,JSON.stringify(response));return response.data;};
try{
 const first=await send('get_state');assert.equal(first.model.id,'omnicoder-local');
 await send('prompt',{message:'Reply only OK. Do not use tools.'});await wait(()=>events.some(e=>e.type==='agent_settled'));
 const before=await send('get_state');assert.ok(before.messageCount>=2);
 await send('prompt',{message:'/local-model gemma'});await wait(()=>events.some(e=>e.method==='notify'&&e.message?.includes('Switching')));await send('get_state');
 await wait(()=>(stderr.match(/preparing one local model/g)||[]).length===2);
 const second=await send('get_state');assert.equal(second.model.id,'gemma-local');assert.ok(second.messageCount>=before.messageCount);
 const endpoint=await fetch('http://127.0.0.1:48763/v1/models').then(r=>r.json());assert.equal(endpoint.data[0].id,'gemma-local');
 child.stdin.end();await new Promise((resolve,reject)=>{child.once('exit',resolve);setTimeout(()=>reject(Error('pia did not exit')),15000).unref();});
 const report={defaultModel:first.model.id,switchedModel:second.model.id,sessionMessagesPreserved:true,serverAliasMatches:true,oneInferenceSlot:true,cleanExit:child.exitCode===0};
 await writeFile(path.join(root,'evaluation/MODEL-SWITCH-2026-10-21.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{if(child.exitCode===null){child.stdin.end();child.kill();}}
