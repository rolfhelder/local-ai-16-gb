// One finite user-authorized batch, not a recurring automation. Does not hold
// inference while waiting for a download or another interactive pia session.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {open,readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {root,nodeExe,machine,ensureServer,acquireInferenceLock,exec} from '../scripts/local-runtime.mjs';
import {nativeContext} from './gguf-metadata.mjs';
const base=path.join(root,'.state/evals/candidates-'+Date.now());await mkdir(base,{recursive:true});
const lock=await open(path.join(root,'.state/candidate-queue.lock'),'wx');await lock.writeFile(JSON.stringify({pid:process.pid,base}));
const report={pid:process.pid,started:new Date().toISOString(),state:'running',models:[]};
const clean=value=>typeof value==='string'?value.replaceAll(root,'<repo>'):Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>k!=='pid').map(([k,v])=>[k,clean(v)])):value;
const save=async()=>{await writeFile(path.join(root,'.state/candidate-queue.json'),JSON.stringify(report,null,2));await writeFile(path.join(root,'evaluation/CANDIDATE-QUEUE-2026-10-21.json'),JSON.stringify(clean(report),null,2)+'\n');};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const manifests=JSON.parse(await readFile(path.join(root,'manifests/coding-model-downloads.json'),'utf8'));
async function checksum(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function waitInference(){for(;;){try{const release=await acquireInferenceLock();await release();return;}catch(error){if(!/owns inference/.test(error.message))throw error;report.state='waiting-for-inference';await save();await wait(30000);}}}
async function runStep(model,script,args){
 await waitInference();report.state='testing';model.phase=script;await save();
 const logFile=path.join(base,model.name+'-'+script.replaceAll('/','-')+'-'+model.steps.length+'.log');
 const output=fs.openSync(logFile,'a');const child=spawn(nodeExe,[path.join(root,script),...args],{cwd:root,windowsHide:true,stdio:['ignore',output,output]});fs.closeSync(output);
 const result={script,args,started:new Date().toISOString(),log:logFile};model.steps.push(result);await save();
 result.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});result.finished=new Date().toISOString();await save();return result;
}
try{
 for(const name of ['omnicoder','gpt-oss']){
  const config=await machine(name),item=manifests.find(x=>config.ModelFile.endsWith(x.File));
  const model={name,phase:'waiting-for-verified-download',steps:[],fitAttempts:[]};report.models.push(model);report.state='waiting-for-download';await save();
  const deadline=Date.now()+4*60*60*1000;
  while(!await stat(config.ModelFile).catch(()=>null)){if(Date.now()>deadline)throw Error(name+' download wait exceeded four hours');await wait(30000);}
  model.phase='verifying-checksum';await save();
  if((await stat(config.ModelFile)).size!==item.Size||await checksum(config.ModelFile)!==item.SHA256)throw Error(name+' file failed verification');
  model.checksumVerified=true;model.metadata=nativeContext(config.ModelFile);model.context=Math.min(204800,model.metadata.nativeContext);await save();
  let fitted=false,kv='f16';
  for(const cache of ['f16','q8_0']){
   await waitInference();const release=await acquireInferenceLock();let server;const fit={context:model.context,cache,peakGpuMiB:0};model.fitAttempts.push(fit);model.phase='load-fit';await save();
   const sample=async()=>Number((await exec('nvidia-smi',['--query-gpu=memory.used','--format=csv,noheader,nounits'])).stdout.trim());
   let sampling=false;const timer=setInterval(async()=>{if(sampling)return;sampling=true;try{fit.peakGpuMiB=Math.max(fit.peakGpuMiB,await sample());}catch{}finally{sampling=false;}},1000);
   try{const trial={...config,ContextSize:model.context,LogPath:path.join(base,name+'-fit-'+cache+'.log')};if(cache==='q8_0')trial.ExtraServerArgs=[...(trial.ExtraServerArgs||[]),'--cache-type-k','q8_0','--cache-type-v','q8_0','--flash-attn','on'];server=await ensureServer(trial);fit.peakGpuMiB=Math.max(fit.peakGpuMiB,await sample());fit.passed=true;fitted=true;kv=cache;}
   catch(error){fit.passed=false;fit.error=error.message;}
   finally{clearInterval(timer);await server?.stop();await release();await save();}
   if(fitted)break;
  }
  model.kvCache=kv;
  if(!fitted){model.phase='unsupported-at-target-context';await save();continue;}
  const kvArgs=kv==='q8_0'?['--kv=q8_0']:[];
  if(name!=='omnicoder')await runStep(model,'evals/model-coding.mjs',['--models='+name,...kvArgs]);
  // OmniCoder's identical 32k smoke check already ran before this batch.
  const before=new Set((await readdir(path.join(root,'.state/evals'))).filter(x=>/^coding-context-\d+$/.test(x)));
  await runStep(model,'evals/coding-context.mjs',['--run','--models='+name,...kvArgs]);
  const created=(await readdir(path.join(root,'.state/evals'))).filter(x=>/^coding-context-\d+$/.test(x)&&!before.has(x)).sort();
  if(created.length){model.codingRun=created.at(-1);await runStep(model,'evals/export-coding-context.mjs',['--run='+model.codingRun,'--output=CODING-CONTEXT-'+name.toUpperCase()+'-2026-10-21']);}
  await runStep(model,'evals/context-limits.mjs',['--models='+name,'--contexts='+(name==='omnicoder'?'65536,131072,204800':'65536,131072'),'--pattern=words','--reasoning-budget=2048','--output-tokens=8192','--no-refine',...kvArgs]);
  await runStep(model,'evals/export-coding.mjs',[]);
  model.phase='complete';await save();
 }
 report.state='complete';
}catch(error){report.state='failed';report.error=error.message;process.exitCode=1;}
finally{report.finished=new Date().toISOString();await save();await writeFile(path.join(base,'report.json'),JSON.stringify(report,null,2));await lock.close();await import('node:fs/promises').then(fs=>fs.unlink(path.join(root,'.state/candidate-queue.lock')));}
