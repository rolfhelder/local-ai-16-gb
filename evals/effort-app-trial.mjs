import {spawn} from 'node:child_process';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import path from 'node:path';
import {root,acquireInferenceLock,ensureServer} from '../scripts/local-runtime.mjs';
import {connectDesktop} from './pi-app-client.mjs';
const pointer=JSON.parse(await readFile(path.join(root,'.state/effort-task-current.json'),'utf8'));
const run=JSON.parse(await readFile(path.join(pointer.artifactDir,'run.json'),'utf8'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const stage=process.argv[2]||'launch';
if(stage==='launch'){
 // Inspect before closing: never interrupt an active user/model turn.
 try{
  const previous=await connectDesktop();const state=await previous.invoke('ipc:runtime.getState');if(state.state?.isStreaming)throw Error('Previous desktop session is active; leave it running');
  previous.close();
  const version=await(await fetch('http://127.0.0.1:48765/json/version')).json();
  const ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.send(JSON.stringify({id:1,method:'Browser.close'}));await Promise.race([new Promise(r=>{ws.onclose=r;}),pause(5000)]);ws.close();
 }catch(e){if(!/fetch failed|ECONNREFUSED/.test(e.message))throw e;}
 let release,server;
 try{
  for(let n=0;n<20;n++){try{release=await acquireInferenceLock();break;}catch(e){if(n===19)throw e;await pause(500);}}
  console.log(`Loading ${run.generationModel}, one slot, clean ${run.context}-token context.`);server=await ensureServer(run.config);
  const settingsPath=path.join(process.env.APPDATA,'pi-desktop/pi-desktop.json');const settings=JSON.parse(await readFile(settingsPath,'utf8'));
  await writeFile(path.join(run.artifactDir,'desktop-settings-before.json'),JSON.stringify(settings,null,2));
  settings.currentProject=run.project;settings.recentProjects=[run.project,...settings.recentProjects.filter(p=>p!==run.project)];settings.maxSessionWorkers=1;
  await writeFile(settingsPath,JSON.stringify(settings,null,2));
  const manifest=JSON.parse(await readFile(path.join(root,'manifests/pi-app.json'),'utf8'));
  const log=openSync(path.join(run.artifactDir,'desktop.log'),'a');
  const child=spawn(path.join(root,'runtime/pi-app',manifest.asset),['--remote-debugging-address=127.0.0.1','--remote-debugging-port=48765'],{cwd:run.project,env:{...process.env,...run.env},windowsHide:true,stdio:['ignore',log,log]});closeSync(log);
  console.log('Pi App launched with effort implementation withheld.');
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 }finally{await server?.stop();await release?.();}
}else if(stage==='end-first'||stage==='end-followup'){
 const app=await connectDesktop();try{
  const state=(await app.invoke('ipc:runtime.getState')).state;
  if(state.model!=='local-llama/'+run.config.ModelId)throw Error('Wrong generation model: '+state.model);
  if(state?.isStreaming)await app.invoke('ipc:prompt.abort',{sessionFile:state.sessionFile});
  const round=stage==='end-first'?'first':'followup';
  await writeFile(path.join(run.artifactDir,round+'-stop-reason.json'),JSON.stringify({reason:'Verification subprocess printed a concrete extension runtime error, then remained running without useful progress for over five minutes. Ended the stalled turn before the 15-minute maximum.',timestamp:new Date().toISOString()},null,2));
  console.log('Ended stalled '+round+' turn; its implementation and grade are preserved.');
 }finally{app.close();}
}else if(stage==='discard'){
 const app=await connectDesktop();try{
  const state=(await app.invoke('ipc:runtime.getState')).state;
  if(state?.isStreaming)await app.invoke('ipc:prompt.abort',{sessionFile:state.sessionFile});
  await writeFile(path.join(run.artifactDir,'INVALID-RUN.json'),JSON.stringify({excludedFromScoring:true,reason:'Generation context was incorrectly capped at 32768 instead of the requested production limit 204800; user requested a fresh run at 200k.',followUpsUsed:0},null,2));
  console.log('32k run preserved and excluded from scoring.');
 }finally{app.close();}
}else if(stage==='first'||stage==='followup'){
 const app=await connectDesktop();
 try{
  await app.invoke('ipc:workspace.ensureWorker',{path:run.project});
  await app.invoke('ipc:session.setEphemeralDraft',{active:false});
  const state=(await app.invoke('ipc:runtime.getState')).state;
  if(state.model!=='local-llama/'+run.config.ModelId)throw Error('Wrong generation model: '+state.model);
  if(state.isStreaming)throw Error('A turn is already running');
  const commands=await app.invoke('ipc:commands.list');
  if(stage==='first'&&commands.commands.some(c=>(c.name||c.id).replace(/^\//,'')==='effort'))throw Error('Baseline contaminated: effort already registered');
  if(stage==='followup'){
   try{await readFile(path.join(run.artifactDir,'followup-sent.json'));throw Error('The one allowed follow-up has already been sent');}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const text=stage==='first'?await readFile(path.join(run.project,'TASK.md'),'utf8'):await readFile(path.join(run.artifactDir,'followup.txt'),'utf8');
  const started=new Date().toISOString();
  const serverLogOffset=(await readFile(run.config.LogPath,'utf8')).length;
  await writeFile(path.join(run.artifactDir,stage+'-sent.json'),JSON.stringify({started,sessionFile:state.sessionFile,prompt:text,serverLogOffset},null,2));
  // Capture real desktop events for tool calls, usage and completion, including
  // asynchronous errors; no model assistant messages are injected by the runner.
  await app.evaluate(`window.__effortTrialUnsubscribe?.();window.__effortTrialEvents=[];window.__effortTrialUnsubscribe=window.piDesktop.onEvent(e=>window.__effortTrialEvents.push(e));window.__effortTrialUiUnsubscribe?.();window.__effortTrialUiEvents=[];window.__effortTrialUiUnsubscribe=window.piDesktop.onExtensionUIRequest(e=>window.__effortTrialUiEvents.push({timestamp:Date.now(),request:e}));true`);
  const response=await app.invoke('ipc:prompt.send',{text,sessionFile:state.sessionFile,capabilities:[]});
  console.log(JSON.stringify({stage,started,sessionFile:state.sessionFile,response}));
 }finally{app.close();}
}else if(stage==='status'){
 const app=await connectDesktop();try{
  const state=(await app.invoke('ipc:runtime.getState')).state;
  const events=await app.evaluate('window.__effortTrialEvents||[]');
  await writeFile(path.join(run.artifactDir,'latest-desktop-events.json'),JSON.stringify(events,null,2));
  console.log(JSON.stringify({state,lastEvents:events.slice(-6).map(e=>({type:e.type,phase:e.phase,toolName:e.toolName,usage:e.usage,text:e.type==='agent_error'?String(e.text).slice(0,600):undefined})),tools:events.filter(e=>e.type==='tool'&&e.phase==='start').slice(-4).map(e=>({name:e.toolName,input:JSON.stringify(e.input).slice(0,300)}))},null,2));
 }finally{app.close();}
}else throw Error('Stages: launch, first, followup, status');
