import {access,readFile,stat,statfs} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {machine,root,nodeExe,piEntry,exec} from './local-runtime.mjs';

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
export async function hashFile(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export async function collectDoctor(config,{verifyModel=false,command=exec,getJson=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(2000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}}={}){
 const report={schemaVersion:1,mode:'read-only; no model startup',platform:process.platform,architecture:process.arch,ram:{totalBytes:os.totalmem(),freeBytes:os.freemem()},checks:[],backend:{status:'unknown',reason:'No owned runtime log inspected; installed CUDA DLLs do not prove GPU offload'}};
 const check=(id,status,details)=>report.checks.push({id,status,...details});
 for(const [id,file]of [['node',nodeExe],['pi',piEntry],['llama',config.LlamaExecutable],['model',config.ModelFile]]){try{await access(file);const info=await stat(file);check(id,info.isFile()?'pass':'fail',{path:file,bytes:info.size});}catch(e){check(id,'fail',{path:file,error:e.code??e.message});}}
 for(const [id,file,args]of [['node-version',nodeExe,['--version']],['llama-version',config.LlamaExecutable,['--version']],['gpu','nvidia-smi',['--query-gpu=name,driver_version,memory.total,memory.free','--format=csv,noheader,nounits']]]){try{const r=await command(file,args,{timeout:7000,maxBuffer:128*1024,windowsHide:true});check(id,'pass',{value:(r.stdout||r.stderr).trim()});}catch(e){check(id,'unknown',{error:e.code??e.message});}}
 try{const info=await statfs(config.ModelsDirectory);report.disk={freeBytes:info.bavail*info.bsize};}catch(e){report.disk={status:'unknown',error:e.code};}
 if(verifyModel){try{const digest=await hashFile(config.ModelFile);const manifests=['models.download-plan.json','gemma-download.json','coding-model-downloads.json','qwen38-download.json','qwen38-next-candidate.json'];let expected;for(const name of manifests){for(const entry of JSON.parse(await readFile(path.join(root,'manifests',name),'utf8'))){if(config.ModelFile.replaceAll('\\','/').endsWith('/'+entry.Repo+'/'+entry.File))expected=entry.SHA256;}}check('model-sha256',expected?(digest===expected?'pass':'fail'):'unknown',{sha256:digest,expected:expected??null});}catch(e){check('model-sha256','fail',{error:e.code??e.message});}}
 try{await getJson(config.RouterUrl+'/health');const models=await getJson(config.RouterUrl+'/v1/models');const props=await getJson(config.RouterUrl+'/props');check('endpoint',endpointVerdict(config,models,props).status,{...endpointVerdict(config,models,props),requestedContext:config.ContextSize,effectiveContext:props.default_generation_settings?.n_ctx,slots:props.total_slots});}catch(e){check('endpoint','unknown',{reason:'No matching running endpoint verified',error:e.message});}
 report.summary=report.checks.some(c=>c.status==='fail')?'attention':report.checks.some(c=>c.status==='unknown')?'incomplete':'pass';return report;
}
export async function main(args=process.argv.slice(2)){
 let model='gemma';const at=args.indexOf('--model');if(at>=0){model=args[at+1];if(!model)throw Error('--model requires a value');args.splice(at,2);}
 if(args.some(x=>!['--verify-model','--public'].includes(x)))throw Error('doctor [--model NAME] [--verify-model] [--public]');
 const report=await collectDoctor(await machine(model),{verifyModel:args.includes('--verify-model')});console.log(JSON.stringify(args.includes('--public')?publicDiagnostics(report):report,null,2));if(report.summary==='attention')process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
