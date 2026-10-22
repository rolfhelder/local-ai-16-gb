import { PiIntegrationTest } from 'pi-coding-agent-test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { root, exec, machine, acquireInferenceLock, ensureServer, prepareProfile } from '../scripts/local-runtime.mjs';
import { nativeContext } from './gguf-metadata.mjs';
import { gradeRecall,diagnoseRecall } from './recall-grader.mjs';
import { serverTimings } from './timings.mjs';
const base = path.join(root, '.state/evals/limits-' + new Date().toISOString().replace(/[:.]/g, '-')); await mkdir(base, { recursive: true });
const report = { started: new Date().toISOString(), protocol: 'native Pi RPC, exact five-needle JSON recall, ~90% fill, 1024 output tokens, 512 reasoning-token budget, f16 KV, fit off, all GPU layers, no context shift, one slot', models: [] };
const release = await acquireInferenceLock(); let server;
const pattern = process.argv.find(arg => arg.startsWith('--pattern='))?.split('=')[1] || 'hex';
report.needlePattern = pattern;
const reasoningBudget = Number(process.argv.find(arg => arg.startsWith('--reasoning-budget='))?.split('=')[1] || '512');
const maxTokens = Number(process.argv.find(arg => arg.startsWith('--output-tokens='))?.split('=')[1] || '1024');
const sampling=process.argv.find(arg=>arg.startsWith('--sampling='))?.split('=')[1]||'default';
if(!['default','reference'].includes(sampling))throw Error('Invalid sampling condition');
report.sampling=sampling;
report.reasoningBudget = reasoningBudget; report.maxTokens = maxTokens;
report.protocol = `native Pi RPC, exact five-needle JSON recall, ~90% fill, ${maxTokens} output tokens, ${reasoningBudget} reasoning-token budget, f16 KV, fit off, all GPU layers, no context shift, one slot`;
const sample = async () => Number((await exec('nvidia-smi', ['--query-gpu=memory.used', '--format=csv,noheader,nounits'])).stdout.trim());
const save = async () => writeFile(path.join(base, 'report.json'), JSON.stringify(report, null, 2));
const jsonPost = async (config, route, body) => {
  const response = await fetch(config.RouterUrl + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status} ${(await response.text()).slice(0, 500)}`);
  return response.json();
};
async function trial(model, config, size, recall = true, repeat = 0) {
  const cwd = path.join(base, config.ModelId, size + '-' + repeat); await mkdir(cwd, { recursive: true });
  config.ContextSize = size; config.MaxTokens = maxTokens; config.ReasoningBudget = reasoningBudget; config.LogPath = path.join(cwd, 'server.log');
  const result = { context: size, repeat, reasoning: config.Reasoning !== false, reasoningBudget: config.ReasoningBudget, port: config.Port, withinNativeContext: size <= model.nativeContext, recallRequested: recall, stage: 'load', sampledPeakGpuMiB: await sample() };
  model.trials.push(result); await save(); console.log(`${config.ModelId}: loading ${size} context`);
  let sampling = false;
  const timer = setInterval(async () => { if (sampling) return; sampling = true; try { result.sampledPeakGpuMiB = Math.max(result.sampledPeakGpuMiB, await sample()); } catch {} finally { sampling = false; } }, 1000);
  const started = performance.now();
  try {
    server = await ensureServer(config); result.loadPassed = true; result.loadMs = Math.round(performance.now() - started);
    result.sampledPeakGpuMiB = Math.max(result.sampledPeakGpuMiB, await sample());
    const info = await fetch(config.RouterUrl + '/v1/models').then(response => response.json());
    result.endpointModel = info.data?.[0]?.id;
    if (recall) {
      result.stage = 'inference';
      const prepared = await prepareProfile('native', config, cwd);
      const rows = Array.from({ length: Math.ceil(size / 12) }, (_, i) => `Record ${i}: ${createHash('sha256').update(`${config.ModelId}-${repeat}-${i}`).digest('hex').slice(0, 32)}`).join('\n');
      const tokens = (await jsonPost(config, '/tokenize', { content: rows })).tokens;
      const budget = Math.floor(size * 0.90 - 2200);
      if (tokens.length < budget) throw new Error('Synthetic padding shorter than target');
      const content = (await jsonPost(config, '/detokenize', { tokens: tokens.slice(0, budget) })).content;
      const needles = Object.fromEntries([1,2,3,4,5].map(i => {
        const digest = createHash('sha256').update(`${size}-${repeat}-${i}-${config.ModelId}`).digest('hex');
        return ['N' + i, pattern === 'words' ? ['cobalt','amber','cedar','orbit','maple'][i-1] + '-' + parseInt(digest.slice(0,6),16) : digest.slice(0,12)];
      }));
      let body = '', previous = 0;
      for (const [index, [key, code]] of Object.entries(needles).entries()) {
        const at = Math.floor(content.length * [0.05,0.25,0.50,0.75,0.95][index]);
        body += content.slice(previous, at) + `\nAuthoritative lookup ${key} = ${code}\n`; previous = at;
      }
      body += content.slice(previous);
      const prompt = 'Read the synthetic records below. Do not use tools. Remember the five authoritative lookups N1 through N5.\n' + body + '\nReturn only JSON mapping N1,N2,N3,N4,N5 to their exact lookup codes.';
      const run = await new PiIntegrationTest({ testName: config.ModelId + '-' + size + '-' + repeat, transport: 'rpc', cwd, artifactsDir: path.join(base, 'traces'),
        piCommand: path.join(root, 'node_modules/.bin/pi.cmd'), providerMode: 'user', model: 'local-llama/' + config.ModelId, thinking: config.Reasoning === false ? 'off' : 'medium',
        isolateUserResources: true, extensions:prepared.settings.extensions, tools: ['read','edit','write','powershell'], environment: prepared.env, timeoutMs: config.ModelId.startsWith('qwen38') || size >= 196608 ? 600000 : 360000 }).run(prompt);
      const assistants = run.messages.filter(message => message.role === 'assistant');
      result.answer = assistants.flatMap(message => message.content.filter(part => part.type === 'text').map(part => part.text)).join('\n');
      result.thinkingCharacters = assistants.flatMap(message => message.content.filter(part => part.type === 'thinking').map(part => part.thinking || '')).join('').length;
      result.usage = assistants.map(message => message.usage);
      result.promptTokens = assistants[0] ? (assistants[0].usage.input + assistants[0].usage.cacheRead) : null;
      result.occupancyPercent = result.promptTokens / size * 100;
      const grade = gradeRecall(result.answer, needles);
      result.needlesCorrect = grade.exact;
      result.recallPassed = grade.passed;
      result.validJson = grade.validJson;
      result.recallDiagnostic=diagnoseRecall(result.answer,needles);
      result.toolCalls=assistants.flatMap(message=>message.content.filter(part=>part.type==='toolCall').map(part=>part.name));
      result.toolFree=result.toolCalls.length===0;
      result.taskContractPassed=grade.passed&&result.toolFree&&assistants.every(message=>message.stopReason==='stop');
      result.inferencePassed = assistants.length > 0 && assistants.every(message => !['error','aborted'].includes(message.stopReason));
      result.stopReasons = assistants.map(message => message.stopReason);
      result.providerErrors=assistants.filter(message=>message.errorMessage).map(message=>message.errorMessage);
      result.requestBudgets=(await readFile(config.LogPath+'.budget.jsonl','utf8').catch(()=>'')).trim().split('\n').filter(Boolean).map(JSON.parse);
      result.expected = needles;
    }
    result.stage = 'complete';
  } catch (error) {
    result.error = error.message;
    const log = await readFile(config.LogPath, 'utf8').catch(() => '');
    result.serverErrorEvidence = log.split('\n').filter(line => /out of memory|alloc.*fail|error|n_ctx_train|offload/i.test(line)).slice(-12).join('\n');
    result.failureType = /exceeds the training context.*capping/.test(log) ? 'server-native-context-cap' : /out of memory|alloc.*fail/i.test(log) ? 'allocation-failure' : 'other-runtime-failure';
  } finally { clearInterval(timer); await server?.stop(); server = undefined; result.timings = serverTimings(await readFile(config.LogPath, 'utf8').catch(() => '')); result.durationMs = Math.round(performance.now() - started); await save(); console.log(JSON.stringify(result)); }
  return result;
}
try {
  const selection = process.argv.find(arg => arg.startsWith('--models='))?.split('=')[1] || 'qwen,gemma';
  for (const name of selection.split(',')) {
    const config = await machine(name); if (process.argv.includes('--no-reasoning')) config.Reasoning = false;
    if(sampling==='reference')config.ExtraServerArgs=[...(config.ExtraServerArgs||[]),'--temp','1.0','--top-p','1.0','--top-k','0','--min-p','0.0'];
    if(process.argv.includes('--kv=q8_0'))config.ExtraServerArgs=[...(config.ExtraServerArgs||[]),'--cache-type-k','q8_0','--cache-type-v','q8_0','--flash-attn','on'];
    report.kvCache=process.argv.includes('--kv=q8_0')?'q8_0':'f16';report.protocol=report.protocol.replace('f16 KV',report.kvCache+' KV');
    const metadata = nativeContext(config.ModelFile);
    const model = { name, ...metadata, trials: [] }; report.models.push(model); await save();
    model.localTokenBudget=name==='gpt-oss'?'exact-template-tokenizer-v1':'upstream-estimator';
    console.log(JSON.stringify({ model: name, ...metadata }));
    const requested = process.argv.find(arg => arg.startsWith('--contexts='))?.split('=')[1];
    const sizes = requested ? requested.split(',').map(Number) : name === 'qwen' ? [131072,196608,262144,327680,393216,524288,786432,1048576] : [32768,65536,98304,131072,196608,262144,393216,524288,1048576];
    let lastSuccessful = 0, failed = 0;
    for (const size of sizes) {
      const result = await trial(model, config, size, size <= metadata.nativeContext);
      if (!result.loadPassed || (result.error && result.stage === 'inference')) { failed = size; break; }
      if (result.loadPassed) lastSuccessful = size;
      if (result.recallRequested && !result.recallPassed && !model.firstRecallFailure) model.firstRecallFailure = size;
      if (result.recallRequested && !result.recallPassed && process.argv.includes('--stop-on-recall-failure')) break;
    }
    if (failed && lastSuccessful && !process.argv.includes('--no-refine')) {
      let low = lastSuccessful, high = failed;
      while (high - low > 8192) {
        const mid = Math.floor((low + high) / 2 / 8192) * 8192;
        const result = await trial(model, config, mid, false);
        if (result.loadPassed) low = mid; else high = mid;
      }
      model.allocationBoundary = { largestLoaded: low, firstFailed: high, granularityTokens: 8192 };
      if (low <= metadata.nativeContext) await trial(model, config, low, true, 1);
    } else model.allocationBoundary = { largestLoaded: lastSuccessful, firstFailed: failed || null };
    await save();
  }
} finally { await server?.stop(); await release(); report.finished = new Date().toISOString(); await save(); }
console.log('Report: ' + path.join(base, 'report.json'));
if(report.models.length&&report.models.every(model=>['omnicoder','gpt-oss'].includes(model.name))){
  const basename=(process.argv.find(arg=>arg.startsWith('--output-basename='))?.slice('--output-basename='.length)||'CONTEXT-'+report.models.map(model=>model.name.toUpperCase()).join('-')+'-2026-10-21')+'.json';
  if(!/^[A-Za-z0-9_-]+\.json$/.test(basename))throw Error('Invalid export basename');
  const clean=JSON.stringify(report,null,2).replaceAll(root.replaceAll('\\','\\\\'),'<repo>').replaceAll(root.replaceAll('\\','/'),'<repo>');
  await writeFile(path.join(root,'evaluation',basename),clean+'\n');
}
