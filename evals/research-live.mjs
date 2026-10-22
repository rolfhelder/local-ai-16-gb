import { PiIntegrationTest, assistantMessage, toolCall, text, getToolResultText, getToolResultMessage } from 'pi-coding-agent-test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, machine, acquireInferenceLock, ensureServer, prepareProfile } from '../scripts/local-runtime.mjs';
import { serverTimings } from './timings.mjs';
const dir = path.join(root, '.state/evals/research-' + Date.now());
await mkdir(dir, { recursive: true });
const selected=process.argv.find(a=>a.startsWith('--model='))?.split('=')[1]||'omnicoder';
const config = await machine(selected); config.ContextSize = Number(process.argv.find(a=>a.startsWith('--context='))?.split('=')[1]||102400);
if(process.argv.includes('--kv=q8_0'))config.ExtraServerArgs=[...(config.ExtraServerArgs||[]),'--cache-type-k','q8_0','--cache-type-v','q8_0','--flash-attn','on'];
config.LogPath=path.join(dir,'llama-server.log');
const release = await acquireInferenceLock(); let server;
const report = { mode: 'scripted outer tool call; real local research inference + public web', query: 'Pi agent native tool_call and tool_result extension hooks, official documentation only', depth: 0, maxQueries: 1, maxScrapes: 2 };
try {
  server = await ensureServer(config);
  const logOffset = (await readFile(config.LogPath, 'utf8')).length;
  const prepared = await prepareProfile('research', config, dir);
  const started = performance.now();
  const run = await new PiIntegrationTest({ testName: 'research-quick', transport: 'rpc', cwd: dir, artifactsDir: path.join(dir, 'traces'),
    piCommand: path.join(root, 'node_modules/.bin/pi.cmd'), isolateUserResources: true,
    extensions: [...prepared.settings.packages, ...prepared.settings.extensions], tools: ['research'], environment: prepared.env, timeoutMs: 240000,
    conversation: [assistantMessage([toolCall({ id: 'research', name: 'research', arguments: { query: report.query, depth: 0, model: 'local-llama/'+config.ModelId, initialLinks: ['https://pi.dev/docs/latest/extensions'] }, delayMs: 0 })], { stopReason: 'toolUse' }), assistantMessage([text('Research tool trial complete.', { delayMs: 0 })])] }).run('Run the bounded research trial.');
  report.durationMs = Math.round(performance.now() - started);
  report.timings = serverTimings((await readFile(config.LogPath, 'utf8')).slice(logOffset));
  const output = getToolResultText(run, 'research');
  await writeFile(path.join(dir, 'output.md'), output);
  report.toolError = Boolean(getToolResultMessage(run, 'research').isError);
  report.outputCharacters = output.length;
  report.hasOfficialUrl = /https:\/\/(pi\.dev|github\.com\/earendil-works\/pi)/.test(output);
  report.claimsNeedManualSourceAudit = true;
  report.evidence = output.slice(0, 2500);
} catch (error) { report.error = error.message; }
finally { await server?.stop(); await release(); await writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); console.log('Report: ' + dir); }
