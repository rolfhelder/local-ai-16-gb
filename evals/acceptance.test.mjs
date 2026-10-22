import test from 'node:test';import assert from 'node:assert/strict';
import {runStages,gradeRepair} from '../scripts/acceptance.mjs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

test('local-ai test previews acceptance without starting inference',()=>{
 const result=spawnSync(process.execPath,[path.resolve(import.meta.dirname,'../scripts/pia.mjs'),'test','--model','omnicoder'],{encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);
 const plan=JSON.parse(result.stdout);assert.equal(plan.mode,'plan');assert.equal(plan.model,'omnicoder');assert.equal(plan.context,32768);
});
test('a failed stage prevents later work and preserves failure evidence',async()=>{let called=false;const r={stages:[]};assert.equal(await runStages([['health',async()=>{throw Error('wrong alias');}],['infer',async()=>{called=true;}]],r),false);assert.equal(called,false);assert.equal(r.stages[0].status,'fail');assert.equal(r.passed,false);});
test('successful stages are distinct and persisted',async()=>{const r={stages:[]};let saved=0;assert.equal(await runStages([['health',async()=>({ok:true})],['answer',async()=>({answer:true})]],r,async()=>saved++),true);assert.equal(r.stages.length,2);assert.equal(saved,3);});
test('code-only success cannot fake an actual tool loop',()=>{assert.equal(gradeRepair({messages:[],sourcePreserved:true,hiddenPassed:true}).passed,false);const messages=[{role:'assistant',content:[{type:'toolCall',name:'powershell',arguments:{command:'node check.cjs'}},{type:'toolCall',name:'edit'},{type:'toolCall',name:'powershell',arguments:{command:'node check.cjs'}}]},{role:'toolResult',content:[{type:'text',text:'AssertionError'}]}];assert.equal(gradeRepair({messages,sourcePreserved:true,hiddenPassed:true}).passed,true);assert.equal(gradeRepair({messages,sourcePreserved:false,hiddenPassed:true}).passed,false);assert.equal(gradeRepair({messages,sourcePreserved:true,hiddenPassed:false}).passed,false);});
