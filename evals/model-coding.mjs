import { PiIntegrationTest } from 'pi-coding-agent-test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, nodeExe, machine, prepareProfile, acquireInferenceLock, ensureServer, exec } from '../scripts/local-runtime.mjs';
import { serverTimings } from './timings.mjs';
const base=path.join(root,'.state/evals/coding-'+Date.now()); await mkdir(base,{recursive:true});
const release=await acquireInferenceLock(); let server; const report=[];
try {
  for(const name of (process.argv.find(x=>x.startsWith('--models='))?.split('=')[1]||'qwen,gemma').split(',')) {
    const cwd=path.join(base,name); await mkdir(cwd,{recursive:true});
    const config=await machine(name); config.ContextSize=Number(process.argv.find(x=>x.startsWith('--context='))?.split('=')[1]||32768); config.LogPath=path.join(cwd,'server.log');
    if(process.argv.includes('--kv=q8_0'))config.ExtraServerArgs=[...(config.ExtraServerArgs||[]),'--cache-type-k','q8_0','--cache-type-v','q8_0','--flash-attn','on'];
    await writeFile(path.join(cwd,'math.cjs'),'exports.add = (a, b) => a - b;\n');
    const checkSource='const assert=require("node:assert/strict");const {add}=require("./math.cjs");assert.equal(add(2,3),5);assert.equal(add(-2,3),1);assert.equal(add(0,0),0);console.log("3 assertions passed");\n';
    await writeFile(path.join(cwd,'check.cjs'),checkSource);
    const prepared=await prepareProfile('standard',config,cwd);prepared.env.PI_EFFORT_PREFERENCES=path.join(cwd,'effort-preferences.json'); server=await ensureServer(config);
    const entry={name,context:config.ContextSize,reasoning:true,reasoningBudget:config.ReasoningBudget}; const started=performance.now();
    try {
      const run=await new PiIntegrationTest({testName:name+'-repair',transport:'rpc',cwd,artifactsDir:path.join(base,'traces'),
        piCommand:path.join(root,'node_modules/.bin/pi.cmd'),providerMode:'user',model:'local-llama/'+config.ModelId,thinking:'medium',isolateUserResources:true,
        environment:prepared.env,extensions:[...prepared.settings.packages,...prepared.settings.extensions],tools:['read','edit','write','powershell'],timeoutMs:180000})
        .run(`Fix the bug in math.cjs without modifying check.cjs. First run check.cjs to observe the failure, inspect the code, make a minimal edit, then run check.cjs again to verify it. The Node executable is ${JSON.stringify(nodeExe)}; use PowerShell's & operator to invoke the quoted executable. Report the outcome.`);
      const assistants=run.messages.filter(message=>message.role==='assistant');
      entry.usage=assistants.map(message=>message.usage);
      entry.toolCalls=assistants.flatMap(message=>message.content.filter(part=>part.type==='toolCall').map(part=>({name:part.name,arguments:part.arguments})));
      entry.answer=assistants.flatMap(message=>message.content.filter(part=>part.type==='text').map(part=>part.text)).join('\n');
      entry.thinkingCharacters=assistants.flatMap(message=>message.content.filter(part=>part.type==='thinking').map(part=>part.thinking||'')).join('').length;
      const check=await exec(nodeExe,['check.cjs'],{cwd,windowsHide:true}); entry.actualTestPassed=/3 assertions passed/.test(check.stdout);
      entry.testFilePreserved=(await readFile(path.join(cwd,'check.cjs'),'utf8'))===checkSource;
      const commands=entry.toolCalls.filter(call=>call.name==='powershell');
      entry.observedAndReranTests=commands.filter(call=>/check\.cjs/.test(call.arguments.command)).length>=2;
      entry.initialFailureObserved=run.messages.filter(message=>message.role==='toolResult').some(message=>(message.content||[]).some(part=>part.type==='text'&&/AssertionError/.test(part.text)));
    } catch(error) {entry.error=error.message;}
    finally {await server.stop();server=undefined; entry.durationMs=Math.round(performance.now()-started);entry.timings=serverTimings(await readFile(config.LogPath,'utf8'));report.push(entry);await writeFile(path.join(base,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(entry));}
  }
} finally {await server?.stop();await release();}
console.log('Report: '+base);
