import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, nodeExe, environment, exec } from '../scripts/local-runtime.mjs';
const dir = path.join(root, '.state/evals/browser-' + Date.now()); await mkdir(dir, { recursive: true });
const html = await readFile(path.join(root, 'evaluation/fixtures/browser-smoke.html'));
const server = http.createServer((_request, response) => { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(html); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const session = 'pia-eval-' + Date.now();
const cli = (suffix, ...args) => exec(nodeExe, [path.join(root, 'node_modules/@playwright/cli/playwright-cli.js'), '-s=' + session + suffix, ...args], { cwd: dir, env: environment(), windowsHide: true, timeout: 45000 });
const checks = {};
try {
  await cli('', 'open', `http://127.0.0.1:${server.address().port}`, '--browser', 'msedge');
  const result = await cli('', 'run-code', "async (page) => { await page.getByRole('textbox', { name: 'Your name' }).fill('Rolf'); await page.getByRole('button', { name: 'Greet' }).click(); return await page.getByRole('status').innerText(); }");
  checks.semanticFormAndDomVerification = /Hello, Rolf!/.test(result.stdout);
  const snapshot = await cli('', 'snapshot');
  checks.snapshotBounded = snapshot.stdout.length < 10000;
  await cli('-isolated', 'open', 'about:blank', '--browser', 'msedge');
  const isolated = await cli('-isolated', 'run-code', 'async (page) => ({ url: page.url(), inputs: await page.getByRole("textbox").count() })');
  checks.sessionIsolation = /about:blank/.test(isolated.stdout) && /"inputs":\s*0/.test(isolated.stdout);
  await writeFile(path.join(dir, 'outputs.json'), JSON.stringify({ form: result.stdout, snapshot: snapshot.stdout, isolated: isolated.stdout }, null, 2));
} finally { await cli('', 'close').catch(() => {}); await cli('-isolated', 'close').catch(() => {}); await new Promise(resolve => server.close(resolve)); }
await writeFile(path.join(dir, 'report.json'), JSON.stringify(checks, null, 2));
console.log(JSON.stringify(checks)); assert.ok(Object.values(checks).every(Boolean));
