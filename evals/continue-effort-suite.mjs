// Sequential programmatic orchestration, not a subagent or extra LLM judge.
import {spawn} from 'node:child_process';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import path from 'node:path';
import {root,nodeExe} from '../scripts/local-runtime.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const logPath=path.join(root,'.state/effort-suite-coordinator.log');
const log=text=>appendFile(logPath,new Date().toISOString()+' '+text+'\n');
const call=(script,args=[],background=false)=>{
 const fd=openSync(logPath,'a');const child=spawn(nodeExe,[path.join(root,'evals',script),...args],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore',fd,fd]});closeSync(fd);
 if(background)return child;
 return new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(script+' exited '+code)));});
};
const current=async()=>{const p=JSON.parse(await readFile(path.join(root,'.state/effort-task-current.json'),'utf8'));return JSON.parse(await readFile(path.join(p.artifactDir,'run.json'),'utf8'));};
const exists=async p=>{try{await readFile(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const waitFor=async(file,limit=7200000)=>{const end=Date.now()+limit;while(!(await exists(file))){if(Date.now()>end)throw Error('Timed out waiting for '+path.basename(file));await pause(3000);}};
const order=['qwen','omnicoder','gpt-oss'];
try{
 for(const model of order){
  if(await exists(path.join(root,`evaluation/EFFORT-${model.toUpperCase()}-2026-10-21.json`)))continue;
  let run=await current();
  if(run.generationModel!==model){
   // Restore source before creating the next fixture's independent backup.
   await call('withhold-effort-source.mjs',['--restore']);
   await call('prepare-effort-task.mjs',['--model',model]);await call('withhold-effort-source.mjs');run=await current();
   call('effort-app-trial.mjs',['launch'],true);
   // Launch can need up to 180s for a cold GGUF; connect/send only after the
   // desktop itself appears. The first helper checks the actual model alias.
   await pause(12000);
   let sent=false;for(let attempt=0;attempt<8&&!sent;attempt++){try{await call('effort-app-trial.mjs',['first']);sent=true;}catch(e){if(attempt===7)throw e;await pause(10000);}}
   await call('effort-suite-state.mjs');
   await call('effort-observer.mjs',['first']);
  }else{
   // Current Qwen first round was already sent by the interactive turn.
   await waitFor(path.join(run.artifactDir,'first-metrics.json'));
  }
  await log(model+' first round complete; grading.');await call('grade-effort-task.mjs',['first']);
  if(!await exists(path.join(run.artifactDir,'followup-sent.json'))){await call('make-effort-feedback.mjs');await call('effort-app-trial.mjs',['followup']);}
  await call('effort-suite-state.mjs');
  await call('effort-observer.mjs',['followup']);await log(model+' revision complete; grading.');
  await call('grade-effort-task.mjs',['followup']);await call('export-effort-task.mjs');await call('export-effort-comparison.mjs');await call('effort-suite-state.mjs');
  await log(model+' both rounds exported.');
 }
 await call('withhold-effort-source.mjs',['--restore']);await log('All model trials exported; working source restored.');
 console.log('Sequential effort suite complete.');
}catch(e){await log('COORDINATOR ERROR: '+e.stack);console.error(e.stack);process.exitCode=1;}
