import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, exec, acquireInferenceLock } from '../scripts/local-runtime.mjs';
const base = path.join(root, '.state/evals/worktrees-' + Date.now());
const original = path.join(base, 'original'), isolated = path.join(base, 'isolated');
await mkdir(original, { recursive: true });
const git = args => exec('git', args, { cwd: original, windowsHide: true });
await git(['init', '-b', 'main']);
await writeFile(path.join(original, 'note.txt'), 'original\n');
await git(['add', 'note.txt']);
await git(['-c', 'user.name=Pi Lab Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Disposable worktree fixture']);
await git(['worktree', 'add', '-b', 'task/isolated', isolated, 'HEAD']);
await writeFile(path.join(isolated, 'note.txt'), 'isolated change\n');
const checks = { originalPreserved: (await readFile(path.join(original, 'note.txt'), 'utf8')) === 'original\n',
  originalClean: (await git(['status', '--porcelain'])).stdout.trim() === '' };
const release = await acquireInferenceLock();
try { await assert.rejects(acquireInferenceLock, /Another pia\/eval session/); checks.sharedInferenceLockRejectsSecondSession = true; }
finally { await release(); }
await writeFile(path.join(base, 'report.json'), JSON.stringify(checks, null, 2));
console.log(JSON.stringify(checks)); assert.ok(Object.values(checks).every(Boolean));
// Retain the disposable checkout for review. No implicit worktree deletion.
