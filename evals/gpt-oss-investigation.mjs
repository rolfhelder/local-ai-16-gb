// Finite follow-up to the foreground six-trial rerun. One inference at a time.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root,nodeExe,acquireInferenceLock} from '../scripts/local-runtime.mjs';
const run=process.argv.find(x=>x.startsWith('--coding-run='))?.slice(13);
if(!/^coding-context-\d+$/.test(run||''))throw Error('Pass the current complete/running coding run');
const status={started:new Date().toISOString(),state:'waiting-for-coding',codingRun:run,steps:[]};
const save=()=>writeFile(path.join(root,'.state/gpt-oss-investigation.json'),JSON.stringify(status,null,2));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function step(script,args){
  for(;;){try{const release=await acquireInferenceLock();await release();break;}catch(error){if(!/owns inference/.test(error.message))throw error;await wait(10000);}}
  status.state='running';const entry={script,args,started:new Date().toISOString()};status.steps.push(entry);await save();
  const output=fs.openSync(path.join(root,'.state/gpt-oss-investigation.log'),'a');
  const child=spawn(nodeExe,[script,...args],{cwd:root,windowsHide:true,stdio:['ignore',output,output]});fs.closeSync(output);
  entry.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});entry.finished=new Date().toISOString();await save();
  if(entry.exitCode!==0)throw Error(script+' exited '+entry.exitCode);
}
try{
 await save();const deadline=Date.now()+3600000;
 for(;;){const report=JSON.parse(await readFile(path.join(root,'.state/evals',run,'report.json'),'utf8'));if(report.status==='complete')break;if(Date.now()>deadline)throw Error('Coding rerun exceeded one hour');await wait(10000);}
 await step('evals/export-coding-context.mjs',['--run='+run,'--output=CODING-CONTEXT-GPT-OSS-2026-10-21']);
 const common=['--models=gpt-oss','--contexts=65536,131072','--pattern=words','--output-tokens=8192','--no-refine'];
 await step('evals/context-limits.mjs',[...common,'--reasoning-budget=2048']);
 // A separate, labeled control avoids conflating budget clipping and sampling.
 await step('evals/context-limits.mjs',[...common,'--reasoning-budget=-1','--output-basename=CONTEXT-GPT-OSS-UNRESTRICTED-2026-10-21']);
 await step('evals/context-limits.mjs',[...common,'--reasoning-budget=-1','--sampling=reference','--output-basename=CONTEXT-GPT-OSS-REFERENCE-2026-10-21']);
 await step('evals/export-gpt-oss-investigation.mjs',[]);
 status.state='complete';
}catch(error){status.state='failed';status.error=error.message;process.exitCode=1;}
finally{status.finished=new Date().toISOString();await save();}
