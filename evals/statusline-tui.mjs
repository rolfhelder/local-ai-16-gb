import { PiIntegrationTest, assistantMessage, text } from 'pi-coding-agent-test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, environment } from '../scripts/local-runtime.mjs';
const dir = path.join(root, '.state/evals/statusline-' + Date.now()); await mkdir(dir, { recursive: true });
const run = await new PiIntegrationTest({ testName: 'context-footer', transport: 'tui', tuiSize: { cols: 80, rows: 35 }, cwd: dir,
  artifactsDir: path.join(dir, 'traces'), piCommand: path.join(root, 'node_modules/.bin/pi.cmd'), isolateUserResources: true,
  environment: environment({ PI_CODING_AGENT_DIR: path.join(dir, 'agent') }), extensions: [path.join(root, 'extensions/context-status.mjs')],
  conversation: [assistantMessage([text('Statusline render test.', { delayMs: 0 })])] }).run('Check the context footer.');
const rendered = run.tuiRenderedOutput;
const result = { explicitContextVisible: /Context:/.test(rendered) || /Context:/.test(run.terminalOutput), finalContext: run.state?.contextUsage };
await writeFile(path.join(dir, 'report.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); assert.ok(result.explicitContextVisible);
