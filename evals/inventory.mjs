import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, nodeExe, piEntry, machine, prepareProfile } from '../scripts/local-runtime.mjs';
const base = path.join(root, '.state/evals/inventory-' + Date.now()); await mkdir(base, { recursive: true });
const report = [];
for (const profile of ['native','standard','research','desktop','web']) {
  const prepared = await prepareProfile(profile, await machine());
  const target = path.join(base, profile + '.json');
  const child = spawn(nodeExe, [piEntry, '--mode', 'rpc', '--no-session', '--no-mcp', '--no-context-files', '-e', path.join(root, 'evals/inventory-probe.mjs')], { cwd: root, windowsHide: true, env: { ...prepared.env, PIA_INVENTORY_FILE: target }, stdio: ['pipe','pipe','pipe'] });
  let output = '', errors = '';
  const timer = setTimeout(() => child.kill(), 25000);
  child.stderr.on('data', data => { errors += data; });
  child.stdout.on('data', data => { output += data; if (output.includes('"command":"prompt"')) child.stdin.end(); });
  child.stdin.on('error', () => {});
  child.stdin.write(JSON.stringify({ type: 'prompt', message: '/pia-inventory' }) + '\n');
  await new Promise(resolve => child.once('close', resolve)); clearTimeout(timer);
  const tools = JSON.parse(await readFile(target, 'utf8'));
  const active = tools.filter(tool => tool.active);
  const expectedCounts = { native: 7, standard: 12, research: 15, desktop: 20, web: 15 };
  assert.equal(active.length, expectedCounts[profile], `${profile} active tool budget changed`);
  assert.ok(!active.some(tool => ['ast_search','code_rewrite','launch_browser','navigate_browser','evaluate_browser'].includes(tool.name)));
  report.push({ profile, activeTools: active.map(tool => tool.name), activeSchemaCharacters: active.reduce((sum, tool) => sum + tool.schemaCharacters, 0), errors: errors.trim().replaceAll(root, '<repo>') });
}
await writeFile(path.join(root, 'evaluation/TOOL-INVENTORY-2026-10-21.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
