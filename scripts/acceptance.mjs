import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,machine,ensureServer,acquireInferenceLock,prepareProfile,nodeExe,exec,serverArguments,generationLimits} from './local-runtime.mjs';
import {hashFile} from './doctor.mjs';
import {serverTimings} from '../evals/timings.mjs';
import os from 'node:os';
import {createAcceptanceUI} from './acceptance-ui.mjs';
import {chooseModel} from './model-selection.mjs';

export function reportMetadata(config,piVersion=null){
 const limits=generationLimits(config);
 return {started:new Date().toISOString(),settings:{contextTokens:config.ContextSize,slots:1,thinkingBudget:limits.reasoningBudget,outputCap:limits.maxTokens},runtime:{executable:config.LlamaExecutable,arguments:serverArguments(config),versions:{node:process.version,pi:piVersion}},hardware:{platform:process.platform,architecture:process.arch,ramBytes:os.totalmem()},measurements:{peakVramBytes:null}};
}
export async function runStages(stages,report,onUpdate=async()=>{},onStart=()=>{}){
 for(const [name,work] of stages){onStart(name);const start=performance.now();try{const evidence=await work();report.stages.push({name,status:'pass',durationMs:Math.round(performance.now()-start),evidence});}catch(error){report.stages.push({name,status:'fail',durationMs:Math.round(performance.now()-start),error:error.message});report.passed=false;await onUpdate();return false;}await onUpdate();}report.passed=true;await onUpdate();return true;
}
export function gradeRepair({messages,sourcePreserved,hiddenPassed}){
 const calls=messages.filter(m=>m.role==='assistant').flatMap(m=>(m.content??[]).filter(c=>c.type==='toolCall'));
 const results=messages.filter(m=>m.role==='toolResult');
 const failure=results.some(m=>(m.content??[]).some(c=>c.type==='text'&&/AssertionError/.test(c.text)));
 const ran=calls.filter(c=>c.name==='powershell'&&/check\.cjs/.test(c.arguments?.command??'')).length>=2;
 const edited=calls.some(c=>['edit','write'].includes(c.name));
 return {passed:sourcePreserved&&hiddenPassed&&failure&&ran&&edited,sourcePreserved,hiddenPassed,initialFailureObserved:failure,testInvokedTwice:ran,editToolUsed:edited};
}
export async function main(args=process.argv.slice(2)){
 const value=(key,fallback)=>{const i=args.indexOf(key);if(i<0)return fallback;const v=args[i+1];if(!v||v.startsWith('--'))throw Error(key+' needs a value');args.splice(i,2);return v;};
 const requested=value('--model',undefined);const run=args.includes('--run'),json=args.includes('--json');
 if(args.some(x=>!['--run','--json','--no-color','--ascii'].includes(x)))throw Error('local-ai test [--model NAME] [--run] [--json] [--no-color] [--ascii]');
 const ui=json?undefined:createAcceptanceUI({color:process.stderr.isTTY&&!process.env.NO_COLOR&&!args.includes('--no-color'),ascii:args.includes('--ascii')});
 const model=await chooseModel(requested);
 ui?.header(model,run);
 try {
 if(!run){if(!json){ui.preview();return;}console.log(JSON.stringify({mode:'plan',model,context:32768,stages:['pinned model SHA256','owned server health/model/config','real model answer','Pi read/edit/test loop'],deadlineSeconds:{startup:180,answer:120,repair:180},modelDownloads:false},null,2));return;}
 const config=await machine(model);config.ContextSize=32768;
 const base=path.join(root,'.state/acceptance',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(base,{recursive:true});config.LogPath=path.join(base,'server.log');
 const piVersion=JSON.parse(await readFile(path.join(root,'node_modules/@earendil-works/pi-coding-agent/package.json'),'utf8')).version;
 const report={schemaVersion:2,...reportMetadata(config,piVersion),model,context:32768,mode:'real-local-inference',stages:[],passed:false};const save=()=>writeFile(path.join(base,'report.json'),JSON.stringify(report,null,2)+'\n');
 ui?.start('Preparing configuration and inference lock');
 const release=await acquireInferenceLock();let server;
 try{
 await runStages([
 ['pinned-model',async()=>{let expected;for(const filename of ['models.download-plan.json','gemma-download.json','coding-model-downloads.json']){for(const m of JSON.parse(await readFile(path.join(root,'manifests',filename),'utf8'))){if(config.ModelFile.replaceAll('\\','/').endsWith('/'+m.Repo+'/'+m.File))expected=m.SHA256;}}if(!expected)ui?.note('No pinned hash: computing a local fingerprint; download integrity is unverified.');const total=(await stat(config.ModelFile)).size;const actual=await hashFile(config.ModelFile,bytes=>ui?.progress(`${Math.floor(bytes/total*100)}% · ${(bytes/1e9).toFixed(1)} / ${(total/1e9).toFixed(1)} GB`));if(expected&&actual!==expected)throw Error('Model checksum mismatch');return {sha256:actual,expected:expected??null,verification:expected?'pinned checksum matched':'local fingerprint only; integrity unverified'};}],
 ['owned-endpoint',async()=>{server=await ensureServer(config);return {model:config.ModelId,context:config.ContextSize,slots:1,owned:server.owned};}],
 ['real-answer',async()=>{const response=await fetch(config.RouterUrl+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:config.ModelId,messages:[{role:'user',content:'Reply with exactly LOCAL_READY_7319 and nothing else.'}],max_tokens:8192,temperature:0}),signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Provider HTTP '+response.status);const data=await response.json();const content=data.choices?.[0]?.message?.content;if(typeof content!=='string'||content.trim()!=='LOCAL_READY_7319')throw Error('Model did not return the requested readiness marker');return {answerMatches:true,usage:data.usage};}],
 ['pi-tool-loop',async()=>{const cwd=path.join(base,'workspace');await mkdir(cwd,{recursive:true});await writeFile(path.join(cwd,'math.cjs'),'exports.add = (a,b) => a-b;\n');const check='const a=require("node:assert/strict"),{add}=require("./math.cjs");a.equal(add(2,3),5);a.equal(add(-2,3),1);console.log("checks passed");\n';await writeFile(path.join(cwd,'check.cjs'),check);
 const prepared=await prepareProfile('standard',config,cwd,{agentDirectory:path.join(base,'agent')});prepared.env.PI_EFFORT_PREFERENCES=path.join(base,'effort-preferences.json');const {PiIntegrationTest}=await import('pi-coding-agent-test');
 const result=await new PiIntegrationTest({testName:'first-run-repair',transport:'rpc',cwd,artifactsDir:path.join(base,'traces'),piCommand:path.join(root,'node_modules/.bin/pi.cmd'),providerMode:'user',model:'local-llama/'+config.ModelId,thinking:'medium',isolateUserResources:true,environment:prepared.env,extensions:[...prepared.settings.packages,...prepared.settings.extensions],tools:['read','edit','write','powershell'],timeoutMs:180000}).run('Fix math.cjs. First run check.cjs and observe its failure, read the code, minimally repair math.cjs, then rerun check.cjs. Do not edit check.cjs. Node executable: '+JSON.stringify(nodeExe)+'. Invoke quoted executables with PowerShell &.');
 const sourcePreserved=(await readFile(path.join(cwd,'check.cjs'),'utf8'))===check;let hiddenPassed=false;try{await exec(nodeExe,['-e','const a=require("node:assert/strict"),{add}=require("./math.cjs");a.equal(add(7,11),18);a.equal(add(-9,4),-5);a.equal(add(0,0),0)'],{cwd,timeout:5000,windowsHide:true});hiddenPassed=true;}catch{}
 const score=gradeRepair({messages:result.messages,sourcePreserved,hiddenPassed});if(!score.passed)throw Error('Tool-loop acceptance failed: '+JSON.stringify(score));return score;}]
 ],report,async()=>{await save();const stage=report.stages.at(-1);if(stage&&!stage.displayed){ui?.complete(stage);Object.defineProperty(stage,'displayed',{value:true});}},name=>ui?.start(name));
 }finally{ui?.cleanup();await server?.stop();await release();report.timings=serverTimings(await readFile(config.LogPath,'utf8').catch(()=>''));await save();
 report.finished=new Date().toISOString();await save();}

 if(json)console.log(JSON.stringify({passed:report.passed,stages:report.stages,report:path.join(base,'report.json')},null,2));else ui.finish(report,path.join(base,'report.json'));if(!report.passed)process.exitCode=1;
 }catch(error){if(ui){ui.abort(error);process.exitCode=1;}else throw error;}finally{ui?.stop();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
