import test from 'node:test';import assert from 'node:assert/strict';
import {runStages,gradeRepair,reportMetadata} from '../scripts/acceptance.mjs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createAcceptanceUI} from '../scripts/acceptance-ui.mjs';
import {installedModels} from '../scripts/model-selection.mjs';
import fs from 'node:fs/promises';
import {root,machine} from '../scripts/local-runtime.mjs';
import {activity} from '../scripts/terminal-activity.mjs';
import {addModelFolder} from '../scripts/model-folders.mjs';
import {runPicker} from '../scripts/browse-model.mjs';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
test('single acceptance report carries reproducible settings and honest missing measurements',()=>{
 const data=reportMetadata({ContextSize:32768,ModelFile:'fixture.gguf',ModelId:'fixture',LlamaExecutable:'llama-server',Port:48763,GpuLayers:999,Reasoning:false},'test-version');
 assert.equal(data.settings.contextTokens,32768);assert.equal(data.settings.thinkingBudget,0);assert.equal(data.runtime.versions.pi,'test-version');
 assert.ok(data.runtime.arguments.includes('fixture.gguf'));assert.equal(data.measurements.peakVramBytes,null);
});

test('picker runs separately in STA, handles cancel, and removes signal handlers',async()=>{
 const signals=new EventEmitter();let command;
 const launch=(exe,args)=>{command={exe,args};const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};
  setTimeout(()=>{child.stdout.write('{"cancelled":true}');child.emit('close',0);},10);return child;};
 assert.deepEqual(await runPicker('folder',{launch,signals}),{cancelled:true});assert.ok(command.args.includes('-STA'));assert.equal(signals.listenerCount('SIGINT'),0);
});
test('picker timeout and Ctrl+C terminate only the dialog process',async()=>{
 for(const cancel of [false,true]){
  const signals=new EventEmitter();let killed=0;
  const launch=()=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>killed++;return child;};
  const promise=runPicker('file',{launch,signals,timeoutMs:cancel?1000:10});if(cancel)signals.emit('SIGINT');
  await assert.rejects(promise,cancel?/cancelled/:/timed out/);assert.equal(killed,1);assert.equal(signals.listenerCount('SIGINT'),0);
 }
});

test('additional model folders persist without losing settings and are discovered once',async()=>{
 const base=await fs.mkdtemp(path.join(root,'.state/model-folder-config-'));
 const primary=path.join(base,'primary'),extra=path.join(base,'extra models');
 await fs.mkdir(primary);await fs.mkdir(extra);await fs.writeFile(path.join(extra,'custom.gguf'),'fixture');
 const file=path.join(base,'machine.local.json');const original={ModelsDirectory:primary,Port:48763,Reasoning:false,CustomSetting:{keep:true}};
 await fs.writeFile(file,JSON.stringify(original));
 const result=await addModelFolder(file,extra,{backupDirectory:path.join(base,'backups')});
 assert.equal(result.changed,true);assert.deepEqual(JSON.parse(await fs.readFile(result.backup,'utf8')),original);
 const saved=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(saved.Reasoning,false);assert.deepEqual(saved.CustomSetting,{keep:true});assert.deepEqual(saved.ModelDirectories,[extra]);
 const again=await addModelFolder(file,extra);assert.equal(again.changed,false);
 const models=await installedModels([primary,extra,extra],{});assert.equal(models.length,1);assert.equal(models[0].file,path.join(extra,'custom.gguf'));
 const before=await fs.readFile(file,'utf8');await assert.rejects(addModelFolder(file,path.join(base,'missing')));assert.equal(await fs.readFile(file,'utf8'),before);
});

test('doctor activity displays measured hash progress without blank redraws',async()=>{
 const writes=[];const busy=activity({stream:{write:s=>writes.push(s),isTTY:true,columns:100},color:false});
 try{busy.update('Verifying model 50% · 3.5 / 7.0 GB',0.5);await new Promise(r=>setTimeout(r,230));
 assert.ok(writes.some(s=>s.includes('█'.repeat(12)+'░'.repeat(12))&&s.includes('50%')));
 assert.ok(writes.every(s=>!s.includes('\x1b[2K')));
 }finally{busy.stop();}
});

test('model discovery includes custom weights and excludes projector, partial and shard files',async()=>{
 const base=await fs.mkdtemp(path.join(root,'.state/model-picker-'));
 for(const name of ['custom.gguf','mmproj-F16.gguf','download.gguf.part','model-00002-of-00003.gguf'])await fs.writeFile(path.join(base,name),'fixture');
 const models=await installedModels(base,{});assert.deepEqual(models.map(m=>m.name),['custom.gguf']);
 const custom=await machine(path.join(base,'custom.gguf'));assert.equal(custom.ModelFile,path.join(base,'custom.gguf'));assert.equal(custom.ContextSize,32768);
});

test('local-ai test previews acceptance without starting inference',()=>{
 const result=spawnSync(process.execPath,[path.resolve(import.meta.dirname,'../scripts/pia.mjs'),'test','--model','omnicoder','--json'],{encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);
 const plan=JSON.parse(result.stdout);assert.equal(plan.mode,'plan');assert.equal(plan.model,'omnicoder');assert.equal(plan.context,32768);
});
test('acceptance dashboard describes failure and skipped work without claiming completion',()=>{
 let output='';let time=0;const ui=createAcceptanceUI({stream:{write:s=>output+=s,isTTY:false},ascii:true,now:()=>time});
 ui.header('gemma',true);ui.start('pinned-model');ui.progress('50%');time=1200;
 const stage={name:'pinned-model',status:'fail',durationMs:1200,error:'checksum mismatch'};
 ui.complete(stage);ui.cleanup();ui.finish({passed:false,stages:[stage]},'report.json');
 assert.match(output,/Verify model/);assert.match(output,/ACCEPTANCE FAILED/);assert.match(output,/0\/4 passed/);assert.match(output,/later checks were skipped/);assert.match(output,/checksum mismatch/);
 assert.doesNotMatch(output,/ALL CHECKS PASSED|\x1b\[/);
});
test('live acceptance redraws progress and clears its line on completion',()=>{
 let output='';const ui=createAcceptanceUI({stream:{write:s=>output+=s,isTTY:true,columns:70},color:false,now:()=>1000});
 ui.header('gemma',true);ui.start('real-answer');ui.complete({name:'real-answer',status:'pass',durationMs:2000});ui.stop();
 assert.match(output,/0\/4 checks/);assert.match(output,/\x1b\[2K/);assert.match(output,/Check response  2.0s/);
});
test('a failed stage prevents later work and preserves failure evidence',async()=>{let called=false;const r={stages:[]};assert.equal(await runStages([['health',async()=>{throw Error('wrong alias');}],['infer',async()=>{called=true;}]],r),false);assert.equal(called,false);assert.equal(r.stages[0].status,'fail');assert.equal(r.passed,false);});
test('progress refresh overwrites atomically without blank frames and uses full-height blocks',async()=>{
 const writes=[];const ui=createAcceptanceUI({stream:{write:s=>writes.push(s),isTTY:true,columns:120},color:false});
 try {
  ui.start('real-answer');await new Promise(resolve=>setTimeout(resolve,300));
  const redraws=writes.filter(s=>s.startsWith('\r'));
  assert.ok(redraws.length>=2);assert.ok(redraws.every(s=>!s.includes('\x1b[2K')));
  assert.match(redraws[0],/▓{3}░{21}/);assert.notEqual(redraws[0],redraws[1]);
  ui.complete({name:'real-answer',status:'pass',durationMs:300});
  ui.finish({passed:true,stages:[]},'report.json');assert.ok(writes.some(s=>s.includes('██████')));
 }finally{ui.stop();}
});
test('successful stages are distinct and persisted',async()=>{const r={stages:[]};let saved=0;assert.equal(await runStages([['health',async()=>({ok:true})],['answer',async()=>({answer:true})]],r,async()=>saved++),true);assert.equal(r.stages.length,2);assert.equal(saved,3);});
test('code-only success cannot fake an actual tool loop',()=>{assert.equal(gradeRepair({messages:[],sourcePreserved:true,hiddenPassed:true}).passed,false);const messages=[{role:'assistant',content:[{type:'toolCall',name:'powershell',arguments:{command:'node check.cjs'}},{type:'toolCall',name:'edit'},{type:'toolCall',name:'powershell',arguments:{command:'node check.cjs'}}]},{role:'toolResult',content:[{type:'text',text:'AssertionError'}]}];assert.equal(gradeRepair({messages,sourcePreserved:true,hiddenPassed:true}).passed,true);assert.equal(gradeRepair({messages,sourcePreserved:false,hiddenPassed:true}).passed,false);assert.equal(gradeRepair({messages,sourcePreserved:true,hiddenPassed:false}).passed,false);});
