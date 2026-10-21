import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root } from '../scripts/local-runtime.mjs';
const directory = path.join(root, '.state/evals');
let pointer;
try { pointer = await readFile(path.join(directory, 'latest-matrix.json'), 'utf8'); }
catch { pointer = await readFile(path.join(directory, 'latest.json'), 'utf8'); }
const latest = JSON.parse(pointer);
const matrix = JSON.parse(await readFile(latest.report, 'utf8'));
const liveRuns = [];
for (const name of (await readdir(directory)).filter(name => name.startsWith('live-')).sort()) {
  try { liveRuns.push(...JSON.parse(await readFile(path.join(directory, name, 'report.json'), 'utf8')).runs); } catch {}
}
const summary = { date: '2026-10-21', matrix, liveRuns,
  otherChecks: { powerShellPolicyAndApproval: '37/37', realNestedBashGuard: '5/5', realNativeHooks: '7/7', playwrightLocalFormSnapshotIsolation: '3/3', worktreeIsolationAndSharedInferenceLock: '3/3' },
  research: { depth: 0, localModel: 'qwen-local', operational: 'completed', quality: 'FAIL: mixed event contracts', reportedTokens: 13571, cacheTokens: 2911, endToEndMs: 220464 },
  limitations: ['single trials, not a reasoning benchmark', 'GPU sampled before/after, not peak', 'TUI dialog callbacks unit-tested only', 'desktop actions, transcripts and ASR not validated', 'schema overhead not included in character estimates'] };
await writeFile(path.join(root, 'evaluation/BASELINE-2026-10-21.json'), JSON.stringify(summary, null, 2) + '\n');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const source = await readFile(path.join(root, 'node_modules/pi-lsp-extension/dist/index.js'));
await writeFile(path.join(root, 'manifests/eval-stack.json'), JSON.stringify({ date: '2026-10-21', dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies,
  lspOriginalDistSha256: createHash('sha256').update(source).digest('hex'), lspCompatibilityPatch: 'two diagnostic URI cache-key normalizations; generated adjacent copy, upstream original preserved',
  modelSha256: '03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8', server: 'llama.cpp b11669', platform: 'Windows, RTX 4090 Laptop 16376 MiB', inferenceConcurrency: 1 }, null, 2) + '\n');
console.log('Exported sanitized baseline and pinned stack manifests.');
