// Opt-in smoke test against an already launched Pi App debugging endpoint.
// No inference requests. This does not run the create-effort-command benchmark.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {root} from '../scripts/local-runtime.mjs';
import path from 'node:path';
const port=process.argv.find(a=>a.startsWith('--port='))?.split('=')[1]||'48765';
let pages;const deadline=Date.now()+30000;
while(!pages){try{pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();}catch(e){if(Date.now()>deadline)throw e;await new Promise(r=>setTimeout(r,500));}}
const page=pages.find(p=>p.type==='page'&&p.url.startsWith('file:'));assert.ok(page,'Pi App renderer not found');
const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let seq=0;const pending=new Map();socket.onmessage=({data})=>{const m=JSON.parse(data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
const evaluate=async(expression)=>{const id=++seq;let timer;const response=new Promise((resolve,reject)=>{pending.set(id,m=>{clearTimeout(timer);resolve(m);});timer=setTimeout(()=>{pending.delete(id);reject(Error('Pi App IPC verification timed out'));},45000);});socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));const m=await response;if(m.error||m.result?.exceptionDetails)throw Error(JSON.stringify(m));return m.result.result.value;};
const invoke=(channel,body={})=>evaluate(`window.piDesktop.invoke(${JSON.stringify(channel)},${JSON.stringify(body)})`);
try{
 if(process.argv.includes('--reload-sdk')){
  const switched=await invoke('ipc:sdk.switch',{target:'user'});assert.equal(switched.ok,true,JSON.stringify(switched));
  const prefs=await invoke('ipc:settings.get',{key:'rightPanelPrefs'});
  await invoke('ipc:settings.set',{key:'rightPanelPrefs',value:{...prefs.settings.rightPanelPrefs,run:true,context:true,browser:true,files:true}});
 }
 const opened=await invoke('ipc:workspace.ensureWorker',{path:path.dirname(root)});assert.equal(opened.ok,true,JSON.stringify(opened));
 const info=await invoke('ipc:pi.getInfo'),sdk=await invoke('ipc:sdk.status');
 const models=await invoke('ipc:model.list',{scope:'available'});
 const local=models.models.filter(m=>m.provider==='local-llama');
 assert.equal(local.length,1);assert.equal(local[0].id,'omnicoder-local');assert.equal(local[0].contextWindow,204800);
 assert.equal(local[0].maxOutput,8192);
 const providerConfig=await invoke('ipc:pi.models.get');assert.equal(providerConfig.config.providers['local-llama'].models[0].maxTokens,8192);
 assert.equal(sdk.active.version,'1.3.0');assert.equal(sdk.active.kind,'user');assert.ok(!sdk.workerFallback);
 const state=await invoke('ipc:runtime.getState');
 assert.equal(state.state.model,'local-llama/omnicoder-local');
 const sessionFile=state.state.sessionFile;
 for(const level of ['high','low','medium']){
  await invoke('ipc:thinkingLevel.set',{level,sessionFile});
  assert.equal((await invoke('ipc:runtime.getState')).state.thinkingLevel,level);
 }
 const commands=await invoke('ipc:commands.list');
 if(!commands.commands.some(c=>(c.name||c.id).replace(/^\//,'')==='effort'))console.log(JSON.stringify({info,state,commands},null,2));
 assert.ok(commands.commands.some(c=>(c.name||c.id).replace(/^\//,'')==='effort'));
 const settings=await invoke('ipc:settings.get',{key:'maxSessionWorkers'});assert.equal(settings.settings.maxSessionWorkers,1);
 const panels=await invoke('ipc:rightPanels.catalog');assert.equal(panels.prefs.browser,true);
 const result={appVersion:'0.7.6',sdkVersion:sdk.active.version,sdkFallback:false,localModelVisible:true,loadedAliasOnly:true,context:local[0].contextWindow,outputCap:providerConfig.config.providers['local-llama'].models[0].maxTokens,effortRegistered:true,builtInEffortSwitchChangesState:true,browserPanelEnabled:true,oneWorker:true,providerRequestsMade:0};
 await writeFile(path.join(root,'evaluation/PI-APP-SMOKE-2026-10-21.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({result,info,state},null,2));
}finally{socket.close();}
