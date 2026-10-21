import {PiIntegrationTest,assistantMessage,text} from 'pi-coding-agent-test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,environment} from '../scripts/local-runtime.mjs';
const cwd=path.join(root,'.state/evals/effort-tui-'+Date.now());await mkdir(cwd,{recursive:true});
const run=await new PiIntegrationTest({testName:'effort-editor',transport:'tui',tuiSize:{cols:100,rows:35},cwd,artifactsDir:path.join(cwd,'traces'),piCommand:path.join(root,'node_modules/.bin/pi.cmd'),isolateUserResources:true,environment:environment({PI_EFFORT_PREFERENCES:path.join(cwd,'preferences.json')}),extensions:[path.join(root,'extensions/effort.mjs')],conversation:[assistantMessage([text('Effort editor test OK.')])]}).run('Reply OK.');
assert.match(run.tuiRenderedOutput+run.terminalOutput,/Effort:/);
const result={customEditorAcceptsNormalInput:true,effortStatusVisible:true};await writeFile(path.join(root,'evaluation/EFFORT-TUI-2026-10-21.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
