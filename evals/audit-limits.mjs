import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from '../scripts/local-runtime.mjs';
import { gradeRecall } from './recall-grader.mjs';
import { serverTimings } from './timings.mjs';
const parent = path.join(root,'.state/evals');
const reports=[];
for (const folder of (await readdir(parent)).filter(name=>name.startsWith('limits-')).sort()) {
  const directory=path.join(parent,folder), report=JSON.parse(await readFile(path.join(directory,'report.json'),'utf8'));
  if(report.maxTokens) report.protocol=report.protocol.replace(/\d+ output tokens/,report.maxTokens+' output tokens').replace(/\d+ reasoning-token budget/,report.reasoningBudget+' reasoning-token budget');
  report.grader='exact JSON keys and whole string values; prefix/suffix matches never pass';
  for(const model of report.models) {
    for(const trial of model.trials) {
      const log=await readFile(path.join(directory,model.name+'-local',trial.context+'-'+trial.repeat,'server.log'),'utf8').catch(()=> '');
      trial.timings=serverTimings(log);
      if(trial.answer && trial.expected) { const grade=gradeRecall(trial.answer,trial.expected); trial.needlesCorrect=grade.exact; trial.recallPassed=grade.passed; trial.validJson=grade.validJson; }
      if (/256 output tokens/.test(report.protocol)) trial.reasoning=false;
      if(trial.error) trial.failureType=/exceeds the training context.*capping/.test(log)?'server-native-context-cap':/out of memory|alloc.*fail/i.test(log)?'allocation-failure':'other-runtime-failure';
    }
    model.firstExactRecallFailure=model.trials.find(trial=>trial.recallRequested&&trial.answer&&!trial.recallPassed)?.context??null;
    if(model.firstRecallFailure&&model.firstRecallFailure!==model.firstExactRecallFailure) model.legacySubstringGraderFirstFailure=model.firstRecallFailure;
    model.firstRecallFailure=model.firstExactRecallFailure;
    const loaded=model.trials.filter(trial=>trial.loadPassed).map(trial=>trial.context);
    const capped=model.trials.filter(trial=>trial.failureType==='server-native-context-cap').map(trial=>trial.context);
    if(capped.length) model.serverContextBoundary={largestLoaded:Math.max(...loaded),smallestRejectedRequest:Math.min(...capped),reason:'llama.cpp caps slot at GGUF native context; not a demonstrated VRAM OOM'};
    const generated=model.trials.flatMap(trial=>trial.timings.generation);
    model.generationTpsMean=generated.length?generated.reduce((sum,item)=>sum+item.tps,0)/generated.length:null;
    model.generationTpsWeighted=generated.length?generated.reduce((sum,item)=>sum+Math.max(0,item.tokens-1),0)/(generated.reduce((sum,item)=>sum+item.milliseconds,0)/1000):null;
  }
  await writeFile(path.join(directory,'audited-report.json'),JSON.stringify(report,null,2));
  reports.push({run:folder,...report});
}
const clean=JSON.stringify(reports,null,2).replaceAll(root.replaceAll('\\','\\\\'),'<repo>').replaceAll(root.replaceAll('\\','/'),'<repo>');
await writeFile(path.join(root,'evaluation/CONTEXT-LIMITS-2026-10-21.json'),clean+'\n');
console.log(JSON.stringify(reports.map(report=>({run:report.run,finished:report.finished,models:report.models.map(model=>({name:model.name,firstExactRecallFailure:model.firstExactRecallFailure,generationTpsMean:model.generationTpsMean,trials:model.trials.filter(t=>t.answer).map(t=>({context:t.context,reasoning:t.reasoning,exact:t.needlesCorrect,generationTps:t.timings.generationTpsMean,promptTps:t.timings.promptTpsMean}))}))})),null,2));
