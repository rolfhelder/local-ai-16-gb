import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from '../scripts/local-runtime.mjs';
import {codingCases} from './coding-cases.mjs';
const parent=path.join(root,'.state/evals');
const folders=(await readdir(parent,{withFileTypes:true})).filter(x=>x.isDirectory()&&/^coding-context-\d+$/.test(x.name)).map(x=>x.name).sort();
if(!folders.length)throw Error('No coding-context reports');
const run=process.argv.find(x=>x.startsWith('--run='))?.slice(6)||folders.at(-1);
if(!/^coding-context-\d+$/.test(run))throw Error('Invalid run directory');
const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'CODING-CONTEXT-2026-10-21';
if(!/^[A-Za-z0-9_-]+$/.test(output))throw Error('Invalid output basename');
const report=JSON.parse(await readFile(path.join(parent,run,'report.json'),'utf8'));
// A runner timeout still leaves completed responses in the private trace. Recover
// their usage rather than reporting zero tokens for an expensive failed attempt.
for(const trial of report.trials.filter(x=>x.stage==='complete'&&!x.usage)){
 const directory=path.join(parent,run,'traces',`${trial.model}-${trial.case}-${trial.condition}-${trial.repeat}`);
 const trace=await readFile(path.join(directory,'partial-trace.jsonl'),'utf8').catch(()=>readFile(path.join(directory,'.runtime/trace.jsonl'),'utf8').catch(()=>''));
 const rows=trace.trim().split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
 const messages=rows.filter(x=>x.type==='message_end'&&x.event?.message?.role==='assistant').map(x=>x.event.message);
 if(messages.length){trial.usage=messages.map(x=>x.usage);trial.responses=messages.length;trial.initialPromptTokens=messages[0].usage.input+messages[0].usage.cacheRead;trial.usageRecoveredFromTrace=true;trial.contextConditionValid=trial.condition==='clean'||messages.every(x=>x.usage.input+x.usage.cacheRead>=100000);trial.stopReasons=messages.map(x=>x.stopReason);trial.toolCalls=rows.filter(x=>x.type==='tool_call').map(x=>x.event.toolName);trial.initialFailureObserved=rows.some(x=>x.type==='tool_execution_end'&&x.event?.result?.content?.some(y=>y.type==='text'&&/AssertionError/.test(y.text)));}
}
const summary=[];
for(const trial of report.trials.filter(x=>x.stage==='complete')){
 const directory=path.join(parent,run,'traces',`${trial.model}-${trial.case}-${trial.condition}-${trial.repeat}`);
 const text=await readFile(path.join(directory,'partial-trace.jsonl'),'utf8').catch(()=>readFile(path.join(directory,'run.jsonl'),'utf8').catch(()=>''));
 const rows=text.trim().split('\n').filter(Boolean).flatMap(line=>{try{const row=JSON.parse(line);return [row.kind?row.event:row].filter(Boolean);}catch{return [];}});
 const calls=rows.filter(x=>x.type==='tool_call').map(x=>x.event);
 const sourceFiles=Object.keys(codingCases.find(x=>x.id===trial.case).files);
 const firstEdit=calls.findIndex(x=>['edit','write'].includes(x.toolName)&&sourceFiles.includes(path.basename((x.input?.path||'').replaceAll('\\','/'))));
 const reproduced=calls.some((check,index)=>{if((firstEdit>=0&&index>=firstEdit)||check.toolName!=='powershell'||!JSON.stringify(check.input).includes('check.cjs'))return false;const result=rows.find(x=>x.type==='tool_execution_end'&&x.event?.toolCallId===check.toolCallId)?.event?.result;return result?.structuredContent?.exit_code>0||result?.isError===true;});
 if(reproduced!==trial.initialFailureObserved)trial.legacyAssertionOnlyFailureObserved=trial.initialFailureObserved;
 trial.initialFailureObserved=reproduced;trial.initialFailureBeforeEdit=reproduced;
}
for(const trial of report.trials){if(trial.condition==='loaded'&&trial.requestBudgets?.length){trial.contextConditionValid=trial.requestBudgets.every(x=>x.promptTokens>=100000);trial.contextConditionEvidence='formatted-request-tokenizer';}trial.functionalPassed=!!(trial.publicFilesPreserved&&trial.publicPassed&&trial.hidden?.total&&trial.hidden.passed===trial.hidden.total);trial.agentSettled=trial.stage==='complete'&&!trial.error&&trial.stopReasons?.at(-1)==='stop';if(trial.passed&&!trial.agentSettled){trial.runnerPassedBeforeStopReasonAudit=true;trial.passed=false;}}
for(const model of (report.models||[...new Set(report.trials.map(x=>x.model))]))for(const condition of (report.conditions||['clean','loaded'])){
 const trials=report.trials.filter(x=>x.model===model&&x.condition===condition&&x.stage==='complete');
 const generations=trials.flatMap(x=>x.timings?.generation||[]), milliseconds=generations.reduce((s,x)=>s+x.milliseconds,0);
 summary.push({model,condition,completed:trials.length,passed:trials.filter(x=>x.passed).length,functionallyCorrect:trials.filter(x=>x.functionalPassed).length,agentSettled:trials.filter(x=>x.agentSettled).length,hiddenGroupsPassed:trials.reduce((s,x)=>s+(x.hidden?.passed||0),0),hiddenGroupsGraded:trials.reduce((s,x)=>s+(x.hidden?.total||0),0),durationSeconds:trials.reduce((s,x)=>s+x.durationMs/1000,0),generationTpsMean:generations.length?generations.reduce((s,x)=>s+x.tps,0)/generations.length:null,generationTpsWeighted:milliseconds?generations.reduce((s,x)=>s+Math.max(0,x.tokens-1),0)/(milliseconds/1000):null,peakGpuMiB:trials.length?Math.max(...trials.map(x=>x.peakGpuMiB)):null,outputTokens:trials.flatMap(x=>x.usage||[]).reduce((s,x)=>s+x.output,0)});
}
const clean=value=>typeof value==='string'?value.replaceAll(root,'<repo>').replaceAll(root.replaceAll('\\','/'),'<repo>'):Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v)])):value;
const aggregate=clean({run,...report,notes:['Single exploratory run per case/condition unless repeat >1.',report.downloadsConcurrent===false?'No model downloads ran concurrently with this rerun.':'Historical batches may include concurrent throttled downloads; see per-run protocol.','GPU memory includes desktop and is sampled, not an exact allocation maximum.','Timeout usage totals recover completed responses; an unfinished final response may be omitted.','Initial failure is audited from a nonzero public-check invocation before the first source-file edit/write, not an AssertionError-only text match. This observation is separate from the pass score.'],summary});
await writeFile(path.join(root,'evaluation',output+'.json'),JSON.stringify(aggregate,null,2)+'\n');
const completed=aggregate.trials.filter(x=>x.stage==='complete');
const markdown=['# Coding results — 2026-10-21','',`Run status: **${report.status}**. Finished ${completed.length}/${report.plannedTrials||12} planned trials. See [protocol](../docs/CODING-SUITE.md).`,'',
'| Model | Case | Background | Hidden groups | Code correct | Agent settled | Full pass | Time | Generation TPS¹ | Peak GPU MiB² |',
'|---|---|---:|---:|---|---|---|---:|---:|---:|',
...completed.map(x=>`| ${x.model} | ${x.case} | ${x.backgroundTokens.toLocaleString('en-US')} | ${x.hidden?x.hidden.passed+'/'+x.hidden.total:'ungraded'} | ${x.functionalPassed?'yes':'no'} | ${x.agentSettled?'yes':'no'} | ${x.passed?'PASS':'FAIL'} | ${(x.durationMs/1000).toFixed(1)} s | ${x.timings?.generationTpsMean?.toFixed(1)??'n/a'} | ${x.peakGpuMiB} |`),'',
'¹ Arithmetic mean across completed responses; per-response and weighted timing data are in the JSON. Timeout attempts may have an unfinished final response.','² Sampled during the agent trial; includes the desktop. See JSON notes for concurrent-download conditions.','',
'A correct repair can still fail the complete agent contract if the agent does not finish within six minutes. Hidden group counts are not independent benchmark tasks. This is a single small exploratory run, not a general coding leaderboard.',''];
await writeFile(path.join(root,'evaluation',output+'.md'),markdown.join('\n'));
// Rebuild a small cross-model index whenever any candidate finishes, preserving
// the original per-run artifacts and selecting the newest source per model.
const index=new Map();
for(const file of (await readdir(path.join(root,'evaluation'))).filter(x=>/^CODING-CONTEXT(?:-[A-Z-]+)?-2026-10-21\.json$/.test(x))){
 const source=JSON.parse(await readFile(path.join(root,'evaluation',file),'utf8'));
 for(const model of [...new Set((source.trials||[]).map(x=>x.model))]){
  const previous=index.get(model);if(previous&&previous.started>source.started)continue;
  index.set(model,{model,started:source.started,status:source.status,source:file,context:source.contextByModel?.[model]||source.contextWindow,kvCache:source.kvCache||'f16',summary:source.summary.filter(x=>x.model===model)});
 }
}
const candidates=[...index.values()];
await writeFile(path.join(root,'evaluation/CODING-MODELS-2026-10-21.json'),JSON.stringify(candidates,null,2)+'\n');
const overview=['# Four local coding models: latest completed trials','', 'Single exploratory runs; compare with the [protocol](../docs/CODING-SUITE.md) and individual artifacts. GPT-OSS uses the repaired request budget and portable search environment; its original results are archived. See the [setup investigation](../docs/CODING-FOUR-MODELS.md). Different native windows and KV settings are shown explicitly.','',
'| Model | Status | Window | KV | Clean full passes | 100k full passes | 100k hidden groups | 100k mean generation TPS | Highest GPU MiB |',
'|---|---|---:|---|---:|---:|---:|---:|---:|',
...candidates.map(x=>{const a=x.summary.find(y=>y.condition==='clean'),b=x.summary.find(y=>y.condition==='loaded');const score=y=>y?`${y.passed}/${y.completed}`:'pending';return `| ${x.model} | ${x.status} | ${x.context.toLocaleString('en-US')} | ${x.kvCache} | ${score(a)} | ${score(b)} | ${b?b.hiddenGroupsPassed+'/'+b.hiddenGroupsGraded:'pending'} | ${b?.generationTpsMean?.toFixed(1)??'n/a'} | ${Math.max(...x.summary.map(y=>y.peakGpuMiB||0))} |`;}),'',
'Pass requires correct preserved project outputs and normal completion within the six-minute budget. GPU readings include the desktop. Context failure, tool failure, timeout, and wrong-code cases must not be collapsed into a general intelligence claim.',''];
await writeFile(path.join(root,'evaluation/CODING-MODELS-2026-10-21.md'),overview.join('\n'));
console.log(JSON.stringify({status:report.status,summary},null,2));
