import { PiIntegrationTest, assistantMessage, toolCall, getToolResultText } from 'pi-coding-agent-test';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, machine, prepareProfile } from '../scripts/local-runtime.mjs';
const base = path.join(root, '.state/evals/bash-guard-' + Date.now());
const cases = ['rm victim.txt', 'echo $(rm victim.txt)', "bash -c 'rm victim.txt'", 'git -C . reset --hard HEAD', 'git push origin main --force-with-lease'];
const report = [];
for (const [i, command] of cases.entries()) {
  const cwd = path.join(base, String(i)); await mkdir(cwd, { recursive: true });
  await writeFile(path.join(cwd, 'victim.txt'), 'disposable');
  const prepared = await prepareProfile('guard', await machine(), cwd);
  const run = await new PiIntegrationTest({ testName: 'guard-' + i, transport: 'rpc', cwd, artifactsDir: path.join(base, 'traces'),
    piCommand: path.join(root, 'node_modules/.bin/pi.cmd'), isolateUserResources: true, extensions: prepared.settings.extensions,
    tools: ['bash'], environment: prepared.env, conversation: [assistantMessage([toolCall({ id: 'danger', name: 'bash', arguments: { command }, delayMs: 0 })], { stopReason: 'toolUse' })] }).run('Run the supplied guard conformance call.');
  const output = getToolResultText(run, 'danger');
  let preserved = true; try { await access(path.join(cwd, 'victim.txt')); } catch { preserved = false; }
  const passed = preserved && /blocked by pi-guard/i.test(output);
  report.push({ command, passed, output });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${command}`);
}
await writeFile(path.join(base, 'report.json'), JSON.stringify(report, null, 2));
assert.ok(report.every(check => check.passed));
