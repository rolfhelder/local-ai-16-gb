import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from '../scripts/local-runtime.mjs';
const read = async name => JSON.parse(await readFile(path.join(root, 'evaluation', name), 'utf8'));
const reports = await read('CONTEXT-LIMITS-2026-10-21.json');
const final = reports.findLast(run => run.finished && run.maxTokens === 8192 && run.reasoningBudget === 2048 && ['qwen', 'gemma'].every(name => run.models.some(model => model.name === name && model.trials.some(trial => trial.context === 262144 && trial.inferencePassed))));
if (!final) throw new Error('No completed matched 256k reasoning-on comparison');
const coding = (await read('CODING-2026-10-21.json')).findLast(run=>['qwen','gemma'].every(name=>run.cases.some(entry=>entry.name===name)));
if(!coding)throw new Error('No paired Qwen/Gemma coding baseline');
const selected = name => final.models.find(model => model.name === name).trials.find(trial => trial.context === 262144);
const short = name => coding.cases.find(entry => entry.name === name);
const winner = (qwen, gemma, lower = false) => qwen === gemma ? 'Tie' : (lower ? qwen < gemma : qwen > gemma) ? 'Qwen' : 'Gemma';
const rows = [];
const add = (test, qwen, gemma, unit = '', lower = false) => rows.push({ test, qwen, gemma, unit, winner: winner(qwen, gemma, lower) });
add('Current configured context', 204800, 204800, 'tokens');
add('Largest stress-tested loaded context', selected('qwen').context, selected('gemma').context, 'tokens');
add('256k near-full prompt: sampled peak GPU memory', selected('qwen').sampledPeakGpuMiB, selected('gemma').sampledPeakGpuMiB, 'MiB', true);
add('256k near-full prompt: generation speed', selected('qwen').timings.generationTpsMean, selected('gemma').timings.generationTpsMean, 'tokens/s');
add('256k near-full prompt: prompt processing speed', selected('qwen').timings.promptTpsMean, selected('gemma').timings.promptTpsMean, 'tokens/s');
add('256k near-full prompt: exact word-code recall', selected('qwen').needlesCorrect, selected('gemma').needlesCorrect, '/5');
const word192 = name => reports.flatMap(run => run.needlePattern === 'words' && run.reasoningBudget === 2048 && run.maxTokens === 4096 ? run.models.filter(model => model.name === name).flatMap(model => model.trials) : []).find(trial => trial.context === 196608);
add('192k word-code recall (4,096 output cap)', word192('qwen').needlesCorrect, word192('gemma').needlesCorrect, '/5');
add('192k word-code trial: sampled peak GPU memory', word192('qwen').sampledPeakGpuMiB, word192('gemma').sampledPeakGpuMiB, 'MiB', true);
add('32k coding: observed failure, repaired tests, original test file preserved', Number(short('qwen').actualTestPassed && short('qwen').testFilePreserved && short('qwen').initialFailureObserved), Number(short('gemma').actualTestPassed && short('gemma').testFilePreserved && short('gemma').initialFailureObserved), 'pass');
add('32k coding: mean generation speed across responses', short('qwen').timings.generationTpsMean, short('gemma').timings.generationTpsMean, 'tokens/s');
add('32k coding: complete Pi run, excluding server startup', short('qwen').durationMs / 1000, short('gemma').durationMs / 1000, 'seconds', true);
const control = reports.find(run => /256 output tokens/.test(run.protocol));
const controlRows = [131072, 196608, 262144].map(context => {
  const trial = name => control.models.find(model => model.name === name).trials.find(item => item.context === context && item.repeat === 0);
  return { context, qwen: trial('qwen'), gemma: trial('gemma') };
});
const compact = trial => ({ context: trial.context, promptTokens: trial.promptTokens, sampledPeakGpuMiB: trial.sampledPeakGpuMiB, exactRecall: trial.needlesCorrect, inferencePassed: trial.inferencePassed, timings: trial.timings });
const result = { date: '2026-10-21', defaultContext: 204800, capacityIsNotQualityAssessment: true, hardwareTotalMiB: 16376,
  matchedRun: final.run, settings: { reasoning: true, reasoningBudget: 2048, maxTokens: 8192, port: 48763, slots: 1, gpuLayers: 999, kv: 'f16', fit: 'off', contextShift: false, projectorLoaded: false },
  matched: Object.fromEntries(['qwen','gemma'].map(name => [name, compact(selected(name))])), rows,
  codingRun: coding.run, reasoningOffHexControl: controlRows.map(row => ({ context: row.context, qwen: compact(row.qwen), gemma: compact(row.gemma) })) };
await writeFile(path.join(root,'evaluation/MODEL-COMPARISON-2026-10-21.json'),JSON.stringify(result,null,2)+'\n');
const format = (value, unit) => unit === 'pass' ? (value ? 'PASS' : 'FAIL') : unit === '/5' ? `${value}/5` : `${Number.isInteger(value) ? value.toLocaleString('en-US') : value.toFixed(1)} ${unit}`;
const table = rows.map(row => `| ${row.test} | ${row.winner === 'Qwen' ? '**' : ''}${format(row.qwen,row.unit)}${row.winner === 'Qwen' ? '**' : ''} | ${row.winner === 'Gemma' ? '**' : ''}${format(row.gemma,row.unit)}${row.winner === 'Gemma' ? '**' : ''} | ${row.winner} |`).join('\n');
await writeFile(path.join(root,'.state/comparison-table.md'),'| Measured test | Qwen3.5 9B Q4_K_M | Gemma 4 12B Q4_K_M | Winner |\n|---|---:|---:|---|\n'+table+'\n');
const controls = [];
for (const pair of controlRows) {
  for (const [metric, property, unit, lower] of [['exact hex-code recall','needlesCorrect','/5',false],['sampled peak GPU memory','sampledPeakGpuMiB','MiB',true],['generation speed','generationTpsMean','tokens/s',false],['prompt processing speed','promptTpsMean','tokens/s',false]]) {
    const a = pair.qwen[property] ?? pair.qwen.timings[property], b = pair.gemma[property] ?? pair.gemma.timings[property], best = winner(a,b,lower);
    controls.push(`| ${pair.context / 1024}k: ${metric} | ${best === 'Qwen' ? '**' : ''}${format(a,unit)}${best === 'Qwen' ? '**' : ''} | ${best === 'Gemma' ? '**' : ''}${format(b,unit)}${best === 'Gemma' ? '**' : ''} | ${best} |`);
  }
}
await writeFile(path.join(root,'.state/control-table.md'),'| Earlier reasoning-off control | Qwen | Gemma | Winner |\n|---|---:|---:|---|\n'+controls.join('\n')+'\n');
console.log(JSON.stringify(result.rows,null,2));
