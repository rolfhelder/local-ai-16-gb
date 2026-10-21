import { PiIntegrationTest, getSystemPrompt } from 'pi-coding-agent-test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root, exec, machine, acquireInferenceLock, ensureServer, prepareProfile } from '../scripts/local-runtime.mjs';
import { fixture } from './fixtures.mjs';
import { serverTimings } from './timings.mjs';
const base = path.join(root, '.state/evals/live-' + new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(base, { recursive: true });
const report = { mode: 'real-local-model-through-Pi-RPC', model: 'Qwen3.5-9B-Q4_K_M', runs: [] };
let server;
const gpu = async () => (await exec('nvidia-smi', ['--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'])).stdout.trim();
const config = await machine();
const fill = Number(process.argv.find(arg => arg.startsWith('--fill='))?.split('=')[1] || '0.70');
if (!(fill > 0 && fill <= 0.95)) throw new Error('--fill must be in (0, 0.95]');
const release = await acquireInferenceLock();
const runCase = async (label, prompt, prepared, cwd) => {
  const start = performance.now();
  const logPath = config.LogPath || path.join(root, '.state/llama-server.log');
  const logOffset = (await readFile(logPath, 'utf8').catch(() => '')).length;
  const entry = { label, context: config.ContextSize, reasoning: config.Reasoning !== false, gpuBeforeMiB: await gpu() };
  try {
    const run = await new PiIntegrationTest({ testName: label, transport: 'rpc', cwd, artifactsDir: path.join(base, 'traces'),
      piCommand: path.join(root, 'node_modules/.bin/pi.cmd'), providerMode: 'user', model: 'local-llama/' + config.ModelId,
      thinking: config.Reasoning === false ? 'off' : 'medium', isolateUserResources: true, tools: ['read','edit','write','powershell'], environment: prepared.env, timeoutMs: 300000 }).run(prompt);
    const assistants = run.messages.filter(message => message.role === 'assistant');
    entry.answer = assistants.flatMap(message => message.content.filter(item => item.type === 'text').map(item => item.text)).join('\n');
    entry.usage = assistants.map(message => message.usage);
    entry.systemPromptCharacters = getSystemPrompt(run).length;
    entry.toolCalls = assistants.flatMap(message => message.content.filter(item => item.type === 'toolCall').map(item => ({ name: item.name, arguments: item.arguments })));
    if (label.startsWith('recall')) entry.passed = entry.answer.includes('ROUTE-COBALT-7319');
    else entry.passed = (await readFile(path.join(cwd, 'note.txt'), 'utf8')) === 'ALPHA\nOlá, Rolf\nomega\n' && entry.toolCalls.some(call => call.name === 'read') && entry.toolCalls.some(call => call.name === 'edit');
  } catch (error) { entry.error = error.message; entry.passed = false; }
  entry.durationMs = Math.round(performance.now() - start);
  entry.gpuAfterMiB = await gpu();
  entry.timings = serverTimings((await readFile(logPath, 'utf8').catch(() => '')).slice(logOffset));
  report.runs.push(entry);
  await writeFile(path.join(base, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(entry));
};
try {
  const requested = process.argv.find(arg => arg.startsWith('--contexts='))?.split('=')[1];
  for (const size of (requested || '8192,16384,32768').split(',').map(Number)) {
    config.ContextSize = size;
    server = await ensureServer(config);
    const cwd = path.join(base, String(size), 'workspace');
    await fixture(cwd);
    const prepared = await prepareProfile('native', config, cwd);
    if (size === 16384) await runCase('coding-16384', 'Read note.txt. Change only alpha to ALPHA using the edit tool. Preserve the other lines exactly. Then report completion.', prepared, cwd);
    // Unique synthetic records reduce compression/repetition shortcuts. Recall is one probe, not a benchmark of reasoning quality.
    const rows = Array.from({ length: size }, (_, i) => `Record ${i}: ${createHash('sha256').update('pi-context-' + i).digest('hex').slice(0, 32)}`).join('\n');
    const tokenized = await fetch(config.RouterUrl + '/tokenize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: rows }) }).then(response => response.json());
    const ratio = Math.max(0, Math.min(1, (size * fill - 2000) / tokenized.tokens.length));
    const selected = rows.slice(0, Math.floor(rows.length * ratio));
    const midpoint = Math.floor(selected.length / 2);
    const prompt = 'This is a synthetic recall test. Do not use tools. Read these records.\n' + selected.slice(0, midpoint) + '\nThe secret route code is ROUTE-COBALT-7319.\n' + selected.slice(midpoint) + '\nReturn only the secret route code.';
    await runCase('recall-' + size, prompt, prepared, cwd);
    await server.stop(); server = undefined;
  }
} finally { await server?.stop(); await release(); }
console.log('Report: ' + path.join(base, 'report.json'));
if (report.runs.some(run => !run.passed)) process.exitCode = 1;
