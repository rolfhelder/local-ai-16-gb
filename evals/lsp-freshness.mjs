import { PiIntegrationTest,assistantMessage,toolCall,text,getToolResultText } from 'pi-coding-agent-test';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root,machine,prepareProfile } from '../scripts/local-runtime.mjs';
import { fixture } from './fixtures.mjs';
const cwd=path.join(root,'.state/evals/lsp-freshness-'+Date.now()); await mkdir(cwd,{recursive:true}); await fixture(cwd);
const prepared=await prepareProfile('lsp-windows',await machine(),cwd);
const steps=[
 ['open-main','read',{path:'main.ts'},2000],['open-math','read',{path:'math.ts'},2000],['open-barrel','read',{path:'barrel.ts'},2000],
 ['initial','lsp_diagnostics',{path:'main.ts'},1000],
 ['fix','edit',{path:'main.ts',oldText:'const broken: number = "wrong";',newText:'const broken: number = 1;'},0],
 ['clean','lsp_diagnostics',{path:'main.ts'},1500],
 ['introduce','edit',{path:'math.ts',oldText:'return value + 1;',newText:'return "bad";'},0],
 ['new-error','lsp_diagnostics',{path:'math.ts'},1500],
 ['references','lsp_references',{path:'math.ts',line:1,character:19},0],
];
const run=await new PiIntegrationTest({testName:'lsp-freshness',transport:'rpc',cwd,artifactsDir:path.join(cwd,'traces'),
 piCommand:path.join(root,'node_modules/.bin/pi.cmd'),isolateUserResources:true,environment:prepared.env,extensions:prepared.settings.extensions,
 tools:['read','edit','lsp_diagnostics','lsp_references'],conversation:[...steps.map(([id,name,args,delay])=>assistantMessage([toolCall({id,name,arguments:args,delayMs:0})],{stopReason:'toolUse',delayMs:delay})),assistantMessage([text('Freshness trial complete.',{delayMs:0})])] }).run('Execute the LSP freshness scenario.');
const outputs=Object.fromEntries(steps.map(([id])=>[id,getToolResultText(run,id)]));
const checks={initialTypeError:/2322|not assignable/.test(outputs.initial),fixedErrorClears:/No diagnostics/.test(outputs.clean),changedFileTypeError:/2322|not assignable/.test(outputs['new-error']),referencesExcludeString:/main\.ts:2:/.test(outputs.references)&&!/main\.ts:3:/.test(outputs.references)};
await writeFile(path.join(cwd,'report.json'),JSON.stringify({checks,outputs},null,2));console.log(JSON.stringify(checks));assert.ok(Object.values(checks).every(Boolean));
