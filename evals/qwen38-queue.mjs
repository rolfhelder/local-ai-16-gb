// Finite sequential batch authorized by the user. Never competes for inference.
import {spawn} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
import {mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {root,nodeExe,acquireInferenceLock} from '../scripts/local-runtime.mjs';
import {connectDesktop} from './pi-app-client.mjs';
const base=path.join(root,'.state/evals/qwen38-'+Date.now());await mkdir(base,{recursive:true});
const statusFile=path.join(root,'.state/qwen38-suite.json');
const candidate=process.argv.includes('--candidate=q3')?'q3':'iq4',model=candidate==='q3'?'qwen38-q3':'qwen38';
const report={started:new Date().toISOString(),status:'waiting-for-download-and-existing-effort-suite',model,quant:candidate==='q3'?'UD-Q3_K_XL':'UD-IQ4_XS',contextAttempts:[],steps:[],nextCandidate:candidate==='q3'?null:'UD-Q3_K_XL',base};
if(process.argv.includes('--resume')){const previous=JSON.parse(await readFile(statusFile,'utf8'));report.previousRun=previous.base;report.contextAttempts=previous.contextAttempts;}
const save=()=>writeFile(statusFile,JSON.stringify(report,null,2));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const json=async file=>{for(let attempt=0;;attempt++){try{return JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));}catch(e){if(!(e instanceof SyntaxError)||attempt>=4)throw e;await pause(100);}}};
async function call(script,args=[],background=false){
 const logfile=path.join(base,`${report.steps.length}-${path.basename(script)}.log`),fd=openSync(logfile,'a');
 const entry={script,args,logfile,started:new Date().toISOString()};report.steps.push(entry);await save();
 const child=spawn(nodeExe,[path.join(root,script),...args],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore',fd,fd]});closeSync(fd);
 if(background){entry.pid=child.pid;await save();return child;}
 entry.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});entry.finished=new Date().toISOString();await save();
 if(entry.exitCode!==0)throw Error(script+' failed; inspect '+logfile);
}
async function closeIdleDesktop(){
 let app;try{app=await connectDesktop();const state=(await app.invoke('ipc:runtime.getState')).state;if(state?.isStreaming)throw Error('Desktop still generating; refusing to interrupt');app.close();
 const version=await(await fetch('http://127.0.0.1:48765/json/version')).json();const socket=new WebSocket(version.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});socket.send(JSON.stringify({id:1,method:'Browser.close'}));await Promise.race([new Promise(r=>{socket.onclose=r;}),pause(5000)]);socket.close();
 }catch(e){app?.close();if(!/fetch failed|ECONNREFUSED/.test(e.message))throw e;}
}
async function idleLock(){for(let i=0;i<60;i++){try{const release=await acquireInferenceLock();await release();return;}catch(e){if(!/owns inference/.test(e.message))throw e;await pause(1000);}}throw Error('Inference owner did not exit');}
try{
 await save();const deadline=Date.now()+12*3600000;
 for(;;){
  const download=await json(path.join(root,`.state/qwen38-${candidate}-download.json`));
  if(download.State==='failed')throw Error('Download failed: '+download.Error);
  const complete=await Promise.all(['gemma','qwen','omnicoder','gpt-oss'].map(name=>stat(path.join(root,`evaluation/EFFORT-${name.toUpperCase()}-2026-10-21.json`)).then(()=>true,()=>false)));
  if(download.State==='complete'&&complete.every(Boolean))break;
  if(Date.now()>deadline)throw Error('Timed out waiting for prerequisite batch/download');await pause(15000);
 }
 // The earlier coordinator restores production files immediately after export.
 await pause(5000);await closeIdleDesktop();await idleLock();await call('evals/withhold-effort-source.mjs',['--restore']);
 report.status='context-tests';await save();let chosen;
 const contexts=(process.argv.find(a=>a.startsWith('--contexts='))?.split('=')[1]||'204800,163840,131072').split(',').map(Number);
 if(!contexts.every(c=>[204800,163840,131072].includes(c)))throw Error('Invalid context selection');
 for(const context of contexts){
  for(const kv of ['f16','q8_0']){
   const before=new Set(await readdir(path.join(root,'.state/evals')));
   await call('evals/context-limits.mjs',['--models='+model,'--contexts='+context,'--pattern=words','--reasoning-budget=2048','--output-tokens=8192','--no-refine',...(kv==='q8_0'?['--kv=q8_0']:[])]);
   const added=(await readdir(path.join(root,'.state/evals'))).filter(n=>n.startsWith('limits-')&&!before.has(n));if(added.length!==1)throw Error('Ambiguous context result directory');
   const file=path.join(root,'.state/evals',added[0],'report.json'),result=await json(file),trial=result.models[0].trials[0];
   const attempt={context,kv,report:file,loadPassed:!!trial.loadPassed,inferencePassed:!!trial.inferencePassed,recallPassed:!!trial.recallPassed,peakGpuMiB:trial.sampledPeakGpuMiB,error:trial.error};report.contextAttempts.push(attempt);await save();
   // Capacity pass deliberately does not require perfect needle recall.
   if(attempt.loadPassed&&attempt.inferencePassed&&!trial.error){chosen={context,kv};break;}
  }
  if(chosen)break;
 }
 if(!chosen){
  if(candidate==='q3')throw Error('UD-Q3_K_XL did not meet the minimum context requirement; no further candidate authorized.');
  report.status='downloading-next-candidate';report.minimumContextRequired=129024;await save();
  const logfile=path.join(base,'next-candidate-download.log'),fd=openSync(logfile,'a');
  const child=spawn('powershell.exe',['-NoProfile','-File',path.join(root,'scripts/Download-CodingModels.ps1'),'-RateLimit','8054619','-Manifest','qwen38-next-candidate.json','-StatusName','qwen38-q3-download'],{cwd:root,windowsHide:true,stdio:['ignore',fd,fd]});closeSync(fd);
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});if(code!==0)throw Error('Next candidate download failed; inspect '+logfile);
  report.status='next-candidate-downloaded';await save();process.exitCode=0;
 }else{
 report.selected=chosen;report.status='tool-conformance-tests';await save();const kvArgs=chosen.kv==='q8_0'?['--kv=q8_0']:[];
 await call('evals/full-tool-suite.mjs');
 report.status='research-test';await save();await call('evals/research-live.mjs',['--model='+model,'--context='+chosen.context,...kvArgs]);
 report.status='coding-tests';await save();
 await call('evals/model-coding.mjs',['--models='+model,'--context='+chosen.context,...kvArgs]);
 const conditions=chosen.context>=131072?'clean,loaded':'clean';
 if(conditions==='clean')report.skippedLoadedCoding='100k unrelated padding does not fit safely at selected capacity; not reduced silently.';
 await call('evals/coding-context.mjs',['--run','--models='+model,'--context='+chosen.context,'--conditions='+conditions,...kvArgs]);
 report.status='effort-tests';await save();await call('evals/prepare-effort-task.mjs',['--model',model,'--context='+chosen.context,...kvArgs]);await call('evals/withhold-effort-source.mjs');
 await call('evals/effort-app-trial.mjs',['launch'],true);await pause(12000);
 let sent=false;for(let attempt=0;attempt<12&&!sent;attempt++){try{await call('evals/effort-app-trial.mjs',['first']);sent=true;}catch(e){if(attempt===11)throw e;await pause(10000);}}
 await call('evals/effort-observer.mjs',['first']);await call('evals/grade-effort-task.mjs',['first']);await call('evals/make-effort-feedback.mjs');await call('evals/effort-app-trial.mjs',['followup']);await call('evals/effort-observer.mjs',['followup']);await call('evals/grade-effort-task.mjs',['followup']);await call('evals/export-effort-task.mjs');await call('evals/export-effort-comparison.mjs');
 await call('evals/withhold-effort-source.mjs',['--restore']);await closeIdleDesktop();await idleLock();report.status='complete';
 }
}catch(e){report.status='failed';report.error=e.stack;process.exitCode=1;}
finally{report.finished=new Date().toISOString();await save();}
