import {access,readFile,stat,statfs} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {machine,root,nodeExe,piEntry,exec} from './local-runtime.mjs';
import {renderDoctor,explainDoctor} from './doctor-format.mjs';
import {discoverOffload} from './gpu-offload.mjs';
import {runGpuProbe} from './gpu-probe.mjs';
import {activity} from './terminal-activity.mjs';

export function endpointVerdict(config,models,props){
 if(!models?.data?.some(m=>m.id===config.ModelId))return {status:'fail',reason:'model alias differs'};
 if(props?.default_generation_settings?.n_ctx!==config.ContextSize||props?.total_slots!==1)return {status:'fail',reason:'context or slot count differs'};
 if(path.resolve(props?.model_path||'')!==path.resolve(config.ModelFile))return {status:'fail',reason:'model path differs'};
 return {status:'pass',reason:'model, context, slot and file match'};
}
export function publicDiagnostics(value){
 if(Array.isArray(value))return value.map(publicDiagnostics);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,/path|executable|file$/i.test(key)?'<LOCAL_PATH>':publicDiagnostics(v)]));
 if(typeof value!=='string')return value;
 return value.replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s]+/gi,'<HOME>').replaceAll(os.homedir(),'<HOME>').replace(/([?&](?:token|key|api_key)=)[^&\s]+/gi,'$1<REDACTED>');
}
export async function hashFile(file,onProgress){const hash=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(file)){hash.update(chunk);bytes+=chunk.length;onProgress?.(bytes);}return hash.digest('hex');}
export async function collectDoctor(config,{verifyModel=false,onProgress=()=>{},command=exec,offload=discoverOffload,getJson=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(2000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}}={}){
 const report={schemaVersion:1,mode:'read-only; no model startup',model:config.ModelId,endpoint:config.RouterUrl,contextTokens:config.ContextSize,modelHashRequested:verifyModel,platform:process.platform,architecture:process.arch,ram:{totalBytes:os.totalmem(),freeBytes:os.freemem()},checks:[]};
 const check=(id,status,details)=>report.checks.push({id,status,...details});
 for(const [id,file]of [['node',nodeExe],['pi',piEntry],['llama',config.LlamaExecutable],['model',config.ModelFile]]){try{await access(file);const info=await stat(file);check(id,info.isFile()?'pass':'fail',{path:file,bytes:info.size});}catch(e){check(id,'fail',{path:file,error:e.code??e.message});}}
 for(const [id,file,args]of [['node-version',nodeExe,['--version']],['llama-version',config.LlamaExecutable,['--version']],['gpu','nvidia-smi',['--query-gpu=name,driver_version,memory.total,memory.free','--format=csv,noheader,nounits']]]){try{const r=await command(file,args,{timeout:7000,maxBuffer:128*1024,windowsHide:true});check(id,'pass',{value:(r.stdout||r.stderr).trim()});}catch(e){check(id,'unknown',{error:e.code??e.message});}}
 try{const sdk=JSON.parse(await readFile(path.join(root,'node_modules/@earendil-works/pi-coding-agent/package.json'),'utf8'));check('pi-version','pass',{value:sdk.version});}catch(e){check('pi-version','unknown',{error:e.code??e.message});}
 try{const info=await statfs(config.ModelsDirectory);report.disk={freeBytes:info.bavail*info.bsize};}catch(e){report.disk={status:'unknown',error:e.code};}
 if(verifyModel){try{const size=(await stat(config.ModelFile)).size;onProgress('Reading model for SHA256');const digest=await hashFile(config.ModelFile,bytes=>onProgress(`Verifying model · ${Math.floor(bytes/size*100)}% · ${(bytes/1e9).toFixed(1)} / ${(size/1e9).toFixed(1)} GB`,bytes/size));onProgress('Checking endpoint and GPU evidence');const manifests=['models.download-plan.json','gemma-download.json','coding-model-downloads.json','qwen38-download.json','qwen38-next-candidate.json'];let expected;for(const name of manifests){for(const entry of JSON.parse(await readFile(path.join(root,'manifests',name),'utf8'))){if(config.ModelFile.replaceAll('\\','/').endsWith('/'+entry.Repo+'/'+entry.File))expected=entry.SHA256;}}check('model-sha256',expected?(digest===expected?'pass':'fail'):'unknown',{sha256:digest,expected:expected??null});}catch(e){check('model-sha256','fail',{error:e.code??e.message});}}
 try{await getJson(config.RouterUrl+'/health');const models=await getJson(config.RouterUrl+'/v1/models');const props=await getJson(config.RouterUrl+'/props');check('endpoint',endpointVerdict(config,models,props).status,{...endpointVerdict(config,models,props),requestedContext:config.ContextSize,effectiveContext:props.default_generation_settings?.n_ctx,slots:props.total_slots});}catch(e){check('endpoint','unknown',{reason:'No matching running endpoint verified',error:e.message});}
 const portOwner=async port=>{
  if(process.platform!=='win32'||!Number.isInteger(port)||port<1||port>65535)return null;
  try{const result=await command('netstat.exe',['-ano','-p','tcp'],{timeout:6000,maxBuffer:2*1024*1024,windowsHide:true});const pids=[...new Set(result.stdout.split(/\r?\n/).map(line=>line.trim().split(/\s+/)).filter(parts=>parts[0]==='TCP'&&parts[1]?.endsWith(':'+port)&&/:0$/.test(parts[2]??'')).map(parts=>Number(parts.at(-1))).filter(pid=>Number.isInteger(pid)&&pid>0))];return pids.length===1?pids[0]:null;}catch{return null;}
 };
 report.backend=await offload(config,{stateDirectory:path.join(root,'.state/runtime-evidence'),endpointMatches:report.checks.find(c=>c.id==='endpoint')?.status==='pass',portOwner});
 return finalizeDoctor(report);
}
export function finalizeDoctor(report){
 report.summary=report.checks.some(c=>c.status==='fail')||report.backend?.status==='fail'?'attention':report.checks.some(c=>c.status==='unknown')||report.backend?.status==='unknown'||report.disk.status==='unknown'?'incomplete':'pass';
 const {failures,...explanation}=explainDoctor(report);report.summaryDetails={...explanation,failedChecks:failures.map(c=>({id:c.id,reason:c.reason??c.error??'failed'}))};return report;
}
export async function main(args=process.argv.slice(2)){
 if(args.includes('--help')){console.log('local-ai doctor [--model NAME] [--verify-model] [--check-gpu] [--public] [--json] [--no-color] [--ascii]\nDefault: read-only report. --check-gpu explicitly loads a temporary model slot (up to 32k), verifies actual GPU allocation, then stops its server.\n--public hides personal folders; --json returns structured data.');return;}
 let model='gemma';const at=args.indexOf('--model');if(at>=0){model=args[at+1];if(!model||model.startsWith('--'))throw Error('--model requires a value');args.splice(at,2);}
 if(args.some(x=>!['--verify-model','--check-gpu','--public','--json','--no-color','--ascii'].includes(x)))throw Error('Unknown doctor option; see local-ai doctor --help');
 const json=args.includes('--json'),publicOutput=args.includes('--public');let config;
 try{config=await machine(model);}catch(error){
  const failure={summary:'attention',error:error.code==='ENOENT'?'Machine configuration is missing. Run ./scripts/Install-Core.ps1 or create machine.local.json using docs/INSTALL.md.':error.message};
  const shown=publicOutput?publicDiagnostics(failure):failure;console.log(json?JSON.stringify(shown,null,2):'LOCAL AI · SETUP DOCTOR\n\n✗ '+shown.error);process.exitCode=1;return;
 }
 const busy=json?null:activity({color:process.stderr.isTTY&&!process.env.NO_COLOR&&!args.includes('--no-color'),ascii:args.includes('--ascii')});
 let report;try{report=await collectDoctor(config,{verifyModel:args.includes('--verify-model'),onProgress:(text,ratio)=>busy?.update(text,ratio)});}finally{busy?.stop();}
 if(args.includes('--check-gpu')){
  report.mode='explicit temporary GPU probe; no generation';
  if(!json)console.error('Checking GPU offload · temporary model load (up to 32k context) · no generation');
  const probeBusy=json?null:activity({color:process.stderr.isTTY&&!process.env.NO_COLOR&&!args.includes('--no-color'),ascii:args.includes('--ascii')});probeBusy?.update('Loading temporary model to verify GPU offload');
  try{report.backend=await runGpuProbe(config);if(report.backend.endpointVerified){const endpoint=report.checks.find(c=>c.id==='endpoint');Object.assign(endpoint,{status:'pass',scope:'probe',reason:'Verified during temporary load; server is now stopped.',configuredContext:config.ContextSize,requestedContext:report.backend.contextSize,effectiveContext:report.backend.contextSize,slots:1});}}catch(error){report.backend={status:'fail',reason:'GPU probe failed: '+error.message};}finally{probeBusy?.stop();}
  finalizeDoctor(report);
 }
 if(json)console.log(JSON.stringify(publicOutput?publicDiagnostics(report):report,null,2));
 else{
  // Preserve paths solely for the formatter, which safely relativizes them in public mode.
  const shown=publicOutput?{...publicDiagnostics(report),checks:report.checks.map(c=>({...publicDiagnostics(c),path:c.path}))}:report;
  process.stdout.write(renderDoctor(shown,{publicOutput,color:!!process.stdout.isTTY&&!Object.hasOwn(process.env,'NO_COLOR')&&!args.includes('--no-color'),unicode:!args.includes('--ascii')}));
 }
 if(report.summary==='attention')process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
