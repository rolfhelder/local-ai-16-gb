import test from 'node:test';import assert from 'node:assert/strict';import {matchedPlan,executePlan,codingSummary,renderScores,main} from './matched-evals.mjs';
import {consoleUI} from '../scripts/console-ui.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {root} from '../scripts/local-runtime.mjs';
test('development suite defaults to one repair in two matched conditions',()=>{const p=matchedPlan();assert.equal(p.trials,2);assert.equal(p.commands.length,1);assert.deepEqual(p.caseIds,['csv-records']);assert.ok(p.commands[0].includes('--cases=csv-records'));assert.ok(p.commands.every(c=>c.includes('--context=131072')&&c.includes('--conditions=clean,loaded')));assert.throws(()=>matchedPlan(['gemma','gemma']),/model/);assert.throws(()=>matchedPlan(['gemma'],[1,1]),/seed/);});
test('controller failure stops without resending completed candidate prompts',async()=>{let calls=0;const result=await executePlan(matchedPlan(['gemma'],[101,202,303]),async()=>{if(++calls===2)throw Error('observer failed');});assert.equal(calls,2);assert.equal(result.results[0].status,'complete');assert.equal(result.results[1].status,'controller-failed');assert.equal(result.cancelled,1);assert.equal(result.controllerCompleted,false);});
test('a timed-out correct repair stays a visible quality failure after controller completion',async()=>{
 const scores=codingSummary({status:'complete',plannedTrials:2,trials:[{condition:'clean',passed:true,hidden:{passed:6,total:6}},{condition:'loaded',passed:false,error:'RPC Pi did not settle within 360000ms',hidden:{passed:6,total:6}}]});
 assert.equal(scores.qualityPassed,false);assert.equal(scores.trials[1].outcome,'TIMEOUT');
 const result=await executePlan(matchedPlan(),async()=>scores);assert.equal(result.controllerCompleted,true);assert.equal(result.results[0].qualityPassed,false);
 let text='';renderScores(consoleUI([],{isTTY:false,write:s=>text+=s}),scores);assert.match(text,/TIMEOUT/);assert.match(text,/6\/6/);assert.match(text,/Coding trial failed/);assert.doesNotMatch(text,/All coding trials passed/);
});
test('missing trial results cannot become a coding pass',()=>{
 assert.equal(codingSummary({status:'complete',plannedTrials:2,trials:[{passed:true}]}).qualityPassed,false);
 assert.equal(codingSummary({status:'running',plannedTrials:1,trials:[{passed:true}]}).qualityPassed,false);
});
test('main reports a quality failure and exits nonzero even when the child controller succeeds',async()=>{
 const parent=path.join(root,'.state/evals');await fs.mkdir(parent,{recursive:true});const folder=await fs.mkdtemp(path.join(parent,'coding-context-ui-fixture-'));
 await fs.writeFile(path.join(folder,'report.json'),JSON.stringify({status:'complete',plannedTrials:2,trials:[{condition:'clean',passed:true},{condition:'loaded',passed:false,error:'did not settle within 360000ms',hidden:{passed:6,total:6}}]}));
 const log=console.log,oldExit=process.exitCode;let output='';console.log=value=>output+=value;
 try{
  await main(['--run','--json'],{command:async(executable,args)=>({stdout:executable==='git'?(args.includes('rev-parse')?'fixture-commit':''):'Private report: '+folder+'\n'})});
  assert.equal(process.exitCode,1);const result=JSON.parse(output);assert.equal(result.controllerCompleted,true);assert.equal(result.qualityPassed,false);assert.equal(result.results[0].trials[1].outcome,'TIMEOUT');
 }finally{console.log=log;process.exitCode=oldExit;}
});
