import test from 'node:test';import assert from 'node:assert/strict';
import {runStages,gradeRepair} from '../scripts/acceptance.mjs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createAcceptanceUI} from '../scripts/acceptance-ui.mjs';

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
test('successful stages are distinct and persisted',async()=>{const r={stages:[]};let saved=0;assert.equal(await runStages([['health',async()=>({ok:true})],['answer',async()=>({answer:true})]],r,async()=>saved++),true);assert.equal(r.stages.length,2);assert.equal(saved,3);});
test('code-only success cannot fake an actual tool loop',()=>{assert.equal(gradeRepair({messages:[],sourcePreserved:true,hiddenPassed:true}).passed,false);const messages=[{role:'assistant',content:[{type:'toolCall',name:'powershell',arguments:{command:'node check.cjs'}},{type:'toolCall',name:'edit'},{type:'toolCall',name:'powershell',arguments:{command:'node check.cjs'}}]},{role:'toolResult',content:[{type:'text',text:'AssertionError'}]}];assert.equal(gradeRepair({messages,sourcePreserved:true,hiddenPassed:true}).passed,true);assert.equal(gradeRepair({messages,sourcePreserved:false,hiddenPassed:true}).passed,false);assert.equal(gradeRepair({messages,sourcePreserved:true,hiddenPassed:false}).passed,false);});
