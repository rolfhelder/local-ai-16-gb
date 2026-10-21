import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from '../scripts/local-runtime.mjs';
const parent=path.join(root,'.state/evals');
const folders=(await readdir(parent,{withFileTypes:true})).filter(x=>x.isDirectory()&&/^coding-context-\d+$/.test(x.name)).map(x=>x.name).sort();
if(!folders.length)throw Error('No coding-context reports');
const run=folders.at(-1), report=JSON.parse(await readFile(path.join(parent,run,'report.json'),'utf8'));
// A runner timeout still leaves completed responses in the private trace. Recover
// their usage rather than reporting zero tokens for an expensive failed attempt.
for(const trial of report.trials.filter(x=>x.stage==='complete'&&!x.usage)){
 const directory=path.join(parent,run,'traces',`${trial.model}-${trial.case}-${trial.condition}-${trial.repeat}`);
 const trace=await readFile(path.join(directory,'partial-trace.jsonl'),'utf8').catch(()=>readFile(path.join(directory,'.runtime/trace.jsonl'),'utf8').catch(()=>''));
 const rows=trace.trim().split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
 const messages=rows.filter(x=>x.type==='message_end'&&x.event?.message?.role==='assistant').map(x=>x.event.message);
 if(messages.length){trial.usage=messages.map(x=>x.usage);trial.responses=messages.length;trial.initialPromptTokens=messages[0].usage.input+messages[0].usage.cacheRead;trial.usageRecoveredFromTrace=true;trial.contextConditionValid=trial.condition==='clean'||trial.initialPromptTokens>=100000;trial.stopReasons=messages.map(x=>x.stopReason);trial.toolCalls=rows.filter(x=>x.type==='tool_call').map(x=>x.event.toolName);trial.initialFailureObserved=rows.some(x=>x.type==='tool_execution_end'&&x.event?.result?.content?.some(y=>y.type==='text'&&/AssertionError/.test(y.text)));}
}
const summary=[];
for(const trial of report.trials.filter(x=>x.stage==='complete')){
 const directory=path.join(parent,run,'traces',`${trial.model}-${trial.case}-${trial.condition}-${trial.repeat}`);
 const text=await readFile(path.join(directory,'partial-trace.jsonl'),'utf8').catch(()=>readFile(path.join(directory,'run.jsonl'),'utf8').catch(()=>''));
 const rows=text.trim().split('\n').filter(Boolean).flatMap(line=>{try{const row=JSON.parse(line);return [row.kind?row.event:row].filter(Boolean);}catch{return [];}});
 const calls=rows.filter(x=>x.type==='tool_call').map(x=>x.event);
 const firstCheck=calls.findIndex(x=>x.toolName==='powershell'&&JSON.stringify(x.input).includes('check.cjs'));
 const firstEdit=calls.findIndex(x=>['edit','write'].includes(x.toolName));
 const check=firstCheck<0?null:calls[firstCheck];
 const result=check?rows.find(x=>x.type==='tool_execution_end'&&x.event?.toolCallId===check.toolCallId)?.event?.result:null;
 const reproduced=firstCheck>=0&&(firstEdit<0||firstCheck<firstEdit)&&(result?.structuredContent?.exit_code>0||result?.isError===true);
 if(reproduced!==trial.initialFailureObserved)trial.legacyAssertionOnlyFailureObserved=trial.initialFailureObserved;
 trial.initialFailureObserved=reproduced;trial.initialFailureBeforeEdit=reproduced;
}
for(const trial of report.trials){trial.functionalPassed=!!(trial.publicFilesPreserved&&trial.publicPassed&&trial.hidden?.total&&trial.hidden.passed===trial.hidden.total);trial.agentSettled=trial.stage==='complete'&&!trial.error&&trial.stopReasons?.at(-1)==='stop';if(trial.passed&&!trial.agentSettled){trial.runnerPassedBeforeStopReasonAudit=true;trial.passed=false;}}
for(const model of ['qwen','gemma'])for(const condition of ['clean','loaded']){
 const trials=report.trials.filter(x=>x.model===model&&x.condition===condition&&x.stage==='complete');
 const generations=trials.flatMap(x=>x.timings?.generation||[]), milliseconds=generations.reduce((s,x)=>s+x.milliseconds,0);
 summary.push({model,condition,completed:trials.length,passed:trials.filter(x=>x.passed).length,functionallyCorrect:trials.filter(x=>x.functionalPassed).length,agentSettled:trials.filter(x=>x.agentSettled).length,hiddenGroupsPassed:trials.reduce((s,x)=>s+(x.hidden?.passed||0),0),hiddenGroupsGraded:trials.reduce((s,x)=>s+(x.hidden?.total||0),0),durationSeconds:trials.reduce((s,x)=>s+x.durationMs/1000,0),generationTpsMean:generations.length?generations.reduce((s,x)=>s+x.tps,0)/generations.length:null,generationTpsWeighted:milliseconds?generations.reduce((s,x)=>s+Math.max(0,x.tokens-1),0)/(milliseconds/1000):null,peakGpuMiB:trials.length?Math.max(...trials.map(x=>x.peakGpuMiB)):null,outputTokens:trials.flatMap(x=>x.usage||[]).reduce((s,x)=>s+x.output,0)});
}
const clean=value=>typeof value==='string'?value.replaceAll(root,'<repo>').replaceAll(root.replaceAll('\\','/'),'<repo>'):Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v)])):value;
const aggregate=clean({run,...report,notes:['Single exploratory run per case/condition unless repeat >1.','Throttled model downloads run concurrently; network/disk activity may affect timing.','GPU memory includes desktop and is sampled, not an exact allocation maximum.','Timeout usage totals recover completed responses; an unfinished final response may be omitted.','Initial failure is audited from a nonzero public-check invocation before the first edit/write, not an AssertionError-only text match. This observation is separate from the pass score.'],summary});
await writeFile(path.join(root,'evaluation/CODING-CONTEXT-2026-10-21.json'),JSON.stringify(aggregate,null,2)+'\n');
const completed=aggregate.trials.filter(x=>x.stage==='complete');
const markdown=['# Coding results — 2026-10-21','',`Run status: **${report.status}**. Finished ${completed.length}/12 planned trials (one repetition). See [protocol](../docs/CODING-SUITE.md).`,'',
'| Model | Case | Background | Hidden groups | Code correct | Agent settled | Full pass | Time | Generation TPS¹ | Peak GPU MiB² |',
'|---|---|---:|---:|---|---|---|---:|---:|---:|',
...completed.map(x=>`| ${x.model} | ${x.case} | ${x.backgroundTokens.toLocaleString('en-US')} | ${x.hidden?x.hidden.passed+'/'+x.hidden.total:'ungraded'} | ${x.functionalPassed?'yes':'no'} | ${x.agentSettled?'yes':'no'} | ${x.passed?'PASS':'FAIL'} | ${(x.durationMs/1000).toFixed(1)} s | ${x.timings?.generationTpsMean?.toFixed(1)??'n/a'} | ${x.peakGpuMiB} |`),'',
'¹ Arithmetic mean across completed responses; per-response and weighted timing data are in the JSON. Timeout attempts may have an unfinished final response.','² Sampled during the agent trial; includes the desktop. Model downloads were running concurrently.','',
'A correct repair can still fail the complete agent contract if the agent does not finish within six minutes. Hidden group counts are not independent benchmark tasks. This is a single small exploratory run, not a general coding leaderboard.',''];
await writeFile(path.join(root,'evaluation/CODING-CONTEXT-2026-10-21.md'),markdown.join('\n'));
console.log(JSON.stringify({status:report.status,summary},null,2));
