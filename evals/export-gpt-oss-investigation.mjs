import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from '../scripts/local-runtime.mjs';
import {diagnoseRecall} from './recall-grader.mjs';
const files=[['initial','archive/CONTEXT-GPT-OSS-2026-10-21-INITIAL.json'],['repaired, 2048 thinking budget','CONTEXT-GPT-OSS-2026-10-21.json'],['repaired, unrestricted thinking','CONTEXT-GPT-OSS-UNRESTRICTED-2026-10-21.json'],['repaired, unrestricted + reference sampling','CONTEXT-GPT-OSS-REFERENCE-2026-10-21.json']];
const rows=[];
for(const [condition,file] of files){
 const report=JSON.parse(await readFile(path.join(root,'evaluation',file),'utf8'));
 for(const trial of report.models[0].trials){
  const diagnostic=diagnoseRecall(trial.answer||'',trial.expected);
  rows.push({condition,source:file,context:trial.context,thinkingBudget:report.reasoningBudget,sampling:report.sampling||'default',strictRecallPassed:trial.recallPassed,strictExact:trial.needlesCorrect,validJson:trial.validJson,...diagnostic,stopReasons:trial.stopReasons,providerErrors:trial.providerErrors||[],toolFree:trial.toolFree??!trial.stopReasons?.includes('toolUse'),generationTps:trial.timings.generationTpsMean,gpuMiB:trial.sampledPeakGpuMiB});
 }
}
const forensic=JSON.parse(await readFile(path.join(root,'evaluation/GPT-OSS-INITIAL-DIAGNOSTIC-2026-10-21.json'),'utf8')).recall64k;
await writeFile(path.join(root,'evaluation/GPT-OSS-INVESTIGATION-2026-10-21.json'),JSON.stringify({date:'2026-10-21',notes:['Controls share deterministic lookup content but not a fixed random seed. Single trials do not isolate causal effects.','Diagnostic extraction never changes strict scores; tool use remains a separate contract violation.','Initial 64k final JSON was correct in the server log but rejected by the parser.'],forensic,rows},null,2)+'\n');
const md=['# GPT-OSS recall setup controls','', 'Same windows, lookup corpus, Pi/llama.cpp and f16 cache. Exact token-budget hook enabled after the initial run. Reasoning remains enabled in every condition; unrestricted thinking still shares an 8,192-token total response cap. Reference sampling uses temperature 1, top-p 1, top-k 0, min-p 0. No fixed seed: these are exploratory controls.','',
'| Condition | Window | Strict recall | Values in answer JSON, diagnostic | No tool calls | Stop reasons | Generation TPS | Peak GPU MiB |',
'|---|---:|---|---:|---|---|---:|---:|',
...rows.map(r=>`| ${r.condition} | ${r.context.toLocaleString('en-US')} | ${r.strictRecallPassed?'PASS':'FAIL'} | ${r.diagnosticJsonExact}/5 | ${r.toolFree?'yes':'no'} | ${(r.stopReasons||[]).join(', ')} | ${r.generationTps?.toFixed(1)??'n/a'} | ${r.gpuMiB} |`),'',
'Diagnostic values are extracted only from the final answer’s JSON block, ignoring surrounding prose. They do not earn a strict pass. The initial 64k API error hid a correct 5/5 final in the server log; that forensic recovery also earns no pass. See [diagnostic evidence](GPT-OSS-INITIAL-DIAGNOSTIC-2026-10-21.json), [JSON controls](GPT-OSS-INVESTIGATION-2026-10-21.json), and [all four coding models](../docs/CODING-FOUR-MODELS.md).',''];
await writeFile(path.join(root,'evaluation/GPT-OSS-INVESTIGATION-2026-10-21.md'),md.join('\n'));
console.log(JSON.stringify(rows.map(({condition,context,strictRecallPassed,diagnosticJsonExact,toolFree})=>({condition,context,strictRecallPassed,diagnosticJsonExact,toolFree})),null,2));
