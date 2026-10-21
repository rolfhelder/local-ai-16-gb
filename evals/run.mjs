import { PiIntegrationTest, assistantMessage, toolCall, text, getToolResultText, getToolResultMessage, getSystemPrompt } from 'pi-coding-agent-test';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { root, machine, prepareProfile } from '../scripts/local-runtime.mjs';
import { fixture } from './fixtures.mjs';
const requested = process.argv.find(value => value.startsWith('--profile='))?.split('=')[1];
const profiles = requested ? [requested] : ['native', 'guard-module', 'guard', 'lsp', 'lsp-windows', 'standard'];
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const base = path.join(root, '.state/evals', runId);
await mkdir(base, { recursive: true });
const config = await machine();
const report = { runId, mode: 'scripted-real-Pi', modelTokensSpent: 0, framework: 'pi-coding-agent-test@0.1.4', profiles: [] };
const calls = [
  ['read-utf8', 'read', { path: 'note.txt', offset: 2, limit: 1 }],
  ['edit-exact', 'edit', { path: 'note.txt', oldText: 'alpha', newText: 'ALPHA' }],
  ['lsp-type-error', 'lsp_diagnostics', { path: 'main.ts' }],
  ['lsp-definition-alias', 'lsp_definition', { path: 'main.ts', line: 2, character: 16 }],
  ['lsp-hover-type', 'lsp_hover', { path: 'main.ts', line: 2, character: 8 }],
  ['lsp-references', 'lsp_references', { path: 'math.ts', line: 1, character: 19 }],
  ['lsp-rename-preview', 'lsp_rename', { path: 'math.ts', line: 1, character: 19, newName: 'advance' }],
  ['guard-powershell-delete', 'powershell', { command: "Remove-Item -LiteralPath './victim.txt'", timeout: 10 }],
];
for (const name of profiles) {
  const cwd = path.join(base, name, 'workspace');
  const originals = await fixture(cwd);
  const prepared = await prepareProfile(name, config, cwd);
  const extensions = [...prepared.settings.packages, ...prepared.settings.extensions];
  const started = performance.now();
  const entry = { name, checks: [], durationMs: 0 };
  try {
    const conversation = [
      assistantMessage([toolCall({ id: 'open-main', name: 'read', arguments: { path: 'main.ts' }, delayMs: 0 })], { stopReason: 'toolUse', delayMs: 3000 }),
      assistantMessage([toolCall({ id: 'open-math', name: 'read', arguments: { path: 'math.ts' }, delayMs: 0 })], { stopReason: 'toolUse', delayMs: 2000 }),
      assistantMessage([toolCall({ id: 'open-barrel', name: 'read', arguments: { path: 'barrel.ts' }, delayMs: 0 })], { stopReason: 'toolUse', delayMs: 2000 }),
      ...calls.map(([id, tool, arguments_]) => assistantMessage([toolCall({ id, name: tool, arguments: arguments_, delayMs: 0 })], { stopReason: 'toolUse' }))
    ];
    if (!['guard','standard','research','desktop'].includes(name)) conversation.push(assistantMessage([text('Script finished; grader checks actual outputs.', { delayMs: 0 })]));
    const run = await new PiIntegrationTest({ testName: name, cwd, artifactsDir: path.join(base, 'traces'), transport: 'rpc',
      piCommand: path.join(root, 'node_modules/.bin/pi.cmd'), extensions,
      tools: { include: ['read','powershell','edit','write','grep','find','ls','lsp_diagnostics','lsp_definition','lsp_hover','lsp_references','lsp_rename'] }, environment: prepared.env,
      isolateUserResources: true, timeoutMs: 90000, conversation }).run('Execute the supplied tool conformance scenario.');
    entry.systemPromptCharacters = getSystemPrompt(run).length;
    entry.estimatedSystemPromptTokens = Math.ceil(entry.systemPromptCharacters / 4);
    entry.estimateMethod = 'characters/4; not measured model tokens';
    entry.providerRequests = run.providerRequests.length;
    const outputs = Object.fromEntries(calls.map(([id]) => { try { return [id, getToolResultText(run, id)]; } catch { return [id, 'NO_RESULT']; } }));
    entry.resultCharacters = Object.values(outputs).reduce((sum, value) => sum + value.length, 0);
    const check = (id, passed, evidence) => entry.checks.push({ id, status: passed ? 'PASS' : 'FAIL', evidence });
    const succeeded = id => { try { return !getToolResultMessage(run, id).isError && !/tool .* not found|no such tool|NO_RESULT/i.test(outputs[id]); } catch { return false; } };
    check('read-utf8', outputs['read-utf8'].includes('Olá, Rolf'), outputs['read-utf8'].slice(0, 250));
    check('bounded-read', !outputs['read-utf8'].includes('alpha') && !outputs['read-utf8'].includes('omega'), 'Only requested line should be returned');
    check('edit-exact', (await readFile(path.join(cwd, 'note.txt'), 'utf8')).startsWith('ALPHA'), outputs['edit-exact'].slice(0, 200));
    let victimExists = true; try { await access(path.join(cwd, 'victim.txt')); } catch { victimExists = false; }
    check('guard-powershell-delete', victimExists && /approval|blocked/i.test(outputs['guard-powershell-delete']), outputs['guard-powershell-delete'].slice(0, 250));
    check('lsp-type-error', succeeded('lsp-type-error') && /2322|not assignable/.test(outputs['lsp-type-error']), outputs['lsp-type-error'].slice(0, 350));
    check('lsp-definition-alias', succeeded('lsp-definition-alias') && /math\.ts/.test(outputs['lsp-definition-alias']), outputs['lsp-definition-alias'].slice(0, 350));
    check('lsp-hover-type', succeeded('lsp-hover-type') && /number/.test(outputs['lsp-hover-type']), outputs['lsp-hover-type'].slice(0, 350));
    check('lsp-references', succeeded('lsp-references') && /main\.ts/.test(outputs['lsp-references']), outputs['lsp-references'].slice(0, 350));
    const unchanged = (await readFile(path.join(cwd, 'math.ts'), 'utf8')) === originals['math.ts'];
    check('lsp-rename-preview', succeeded('lsp-rename-preview') && unchanged && /advance|edit|rename/i.test(outputs['lsp-rename-preview']), outputs['lsp-rename-preview'].slice(0, 350));
    await writeFile(path.join(base, name, 'outputs.json'), JSON.stringify(outputs, null, 2));
  } catch (error) { entry.error = error.message; entry.checks.push({ id: 'framework-run', status: 'ERROR', evidence: error.message }); }
  entry.durationMs = Math.round(performance.now() - started);
  report.profiles.push(entry);
  console.log(`${name}: ${entry.checks.filter(check => check.status === 'PASS').length}/${entry.checks.length} passed; ${entry.durationMs} ms`);
}
await writeFile(path.join(base, 'report.json'), JSON.stringify(report, null, 2));
await writeFile(path.join(root, '.state/evals/latest.json'), JSON.stringify({ report: path.join(base, 'report.json') }));
if (!requested) await writeFile(path.join(root, '.state/evals/latest-matrix.json'), JSON.stringify({ report: path.join(base, 'report.json') }));
console.log(`Report: ${path.join(base, 'report.json')}`);
if (report.profiles.some(profile => profile.error)) process.exitCode = 2;
else if (requested && report.profiles.some(profile => profile.checks.some(check => check.status === 'FAIL'))) process.exitCode = 1;
else if (!requested) {
  const expected = { native: 3, 'guard-module': 3, guard: 4, lsp: 7, 'lsp-windows': 8, standard: 9 };
  if (report.profiles.some(profile => profile.checks.filter(check => check.status === 'PASS').length !== expected[profile.name])) process.exitCode = 1;
}
