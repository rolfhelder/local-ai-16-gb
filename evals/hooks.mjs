import { PiIntegrationTest, assistantMessage, toolCall, getToolResultText, getSystemPrompt } from 'pi-coding-agent-test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, environment } from '../scripts/local-runtime.mjs';
const dir = path.join(root, '.state/evals/hooks-' + Date.now());
await mkdir(dir, { recursive: true });
for (const name of ['note.txt','blocked.txt','throws.txt']) await writeFile(path.join(dir, name), name === 'note.txt' ? 'readable note' : 'DO_NOT_READ');
const log = path.join(dir, 'hooks.jsonl');
const run = await new PiIntegrationTest({ testName: 'hooks', transport: 'rpc', cwd: dir, artifactsDir: path.join(dir, 'traces'),
  piCommand: path.join(root, 'node_modules/.bin/pi.cmd'), extensions: [path.join(root, 'evals/hook-probe.mjs')], tools: ['read'],
  isolateUserResources: true, environment: environment({ PIA_HOOK_LOG: log, PI_CODING_AGENT_DIR: path.join(dir, 'agent') }), conversation: [
    assistantMessage([toolCall({ id: 'read', name: 'read', arguments: { path: 'note.txt' }, delayMs: 0 })], { stopReason: 'toolUse' }),
    assistantMessage([toolCall({ id: 'blocked', name: 'read', arguments: { path: 'blocked.txt' }, delayMs: 0 })], { stopReason: 'toolUse' })
  ] }).run('Exercise real hook behavior.');
const events = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
const checks = {
  'before-agent-system-customization': getSystemPrompt(run).includes('HOOK_CONTEXT_SENTINEL'),
  'post-tool-transform': getToolResultText(run, 'read').includes('HOOK_RESULT_SENTINEL'),
  'pre-tool-block': getToolResultText(run, 'blocked').includes('HOOK_BLOCK_SENTINEL') && !getToolResultText(run, 'blocked').includes('DO_NOT_READ'),
  'custom-event-bus': events.some(event => event.event === 'custom_bus' && event.verified),
  'turn-lifecycle': events.some(event => event.event === 'turn_start') && events.some(event => event.event === 'turn_end'),
  'settled-state': events.some(event => event.event === 'agent_settled'),
  'shutdown-cleanup': events.some(event => event.event === 'session_shutdown'),
};
await writeFile(path.join(dir, 'report.json'), JSON.stringify(checks, null, 2));
for (const [name, passed] of Object.entries(checks)) { console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); assert.ok(passed, name); }
