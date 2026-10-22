import {mkdir,readFile,writeFile,copyFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {root,machine,prepareProfile,nodeExe,piEntry} from '../scripts/local-runtime.mjs';
const modelIndex=process.argv.indexOf('--model');const selected=modelIndex<0?'gemma':process.argv[modelIndex+1];
const id='effort-'+selected+'-'+new Date().toISOString().replace(/[:.]/g,'-');
const artifactDir=path.join(root,'.state/evals',id),project=path.join(path.dirname(root),'pi-local-evals',id),agentDir=path.join(artifactDir,'agent');
await mkdir(project,{recursive:true});await mkdir(agentDir,{recursive:true});
const task=JSON.parse(await readFile(path.join(root,'evals/tasks/create-effort-command.json'),'utf8'));
const backup=path.join(artifactDir,'working-feature-backup');await mkdir(backup,{recursive:true});
const hashes={};for(const relative of ['extensions/effort.mjs','extensions/effort-core.mjs','config/effort.json']){
 const data=await readFile(path.join(root,relative));const target=path.join(backup,relative);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data);hashes[relative]=createHash('sha256').update(data).digest('hex');
}
await writeFile(path.join(backup,'hashes.json'),JSON.stringify(hashes,null,2));
const config=await machine(selected);config.LogPath=path.join(artifactDir,'llama-server.log');
const contextOverride=process.argv.find(x=>x.startsWith('--context='));
if(contextOverride){const value=Number(contextOverride.split('=')[1]);if(!Number.isInteger(value)||value<32768||value>config.NativeContext)throw Error('Invalid effort context');config.ContextSize=value;}
if(process.argv.includes('--kv=q8_0'))config.ExtraServerArgs=[...(config.ExtraServerArgs||[]),'--cache-type-k','q8_0','--cache-type-v','q8_0','--flash-attn','on'];
const prepared=await prepareProfile('pi-app',config,project);
// Discard the existing implementation from the experiment's active resources.
// The working source and normal launchers are preserved, plus a hashed backup.
const settings={...prepared.settings,extensions:prepared.settings.extensions.filter(p=>!p.endsWith('effort.mjs')),skills:[],prompts:[],defaultProvider:'local-llama',defaultModel:config.ModelId,defaultThinkingLevel:'medium',enabledModels:['local-llama/'+config.ModelId]};
await mkdir(path.join(agentDir,'extensions'),{recursive:true});
await writeFile(path.join(agentDir,'settings.json'),JSON.stringify(settings,null,2));
await copyFile(path.join(prepared.agentDir,'models.json'),path.join(agentDir,'models.json'));
// Restore the normal desktop profile immediately; the eval gets its own copy.
await prepareProfile('pi-app',await machine(),path.dirname(root));
const sdk=path.join(root,'node_modules/@earendil-works/pi-coding-agent');
await mkdir(path.join(project,'docs'),{recursive:true});
for(const name of ['extensions.md','sdk.md','custom-models.md']){try{await copyFile(path.join(sdk,'docs',name),path.join(project,'docs',name));}catch(e){if(e.code!=='ENOENT')throw e;}}
await copyFile(path.join(sdk,'dist/core/extensions/types.d.ts'),path.join(project,'docs/extension-types.d.ts'));
await writeFile(path.join(project,'TASK.md'),`${task.prompt}\n\nEnvironment:\n- You are running inside Pi App 0.7.6 with Pi SDK 1.3.0 on Windows. Use PowerShell commands.\n- The test project is this directory; SDK documentation/types are in docs/.\n- Active agent directory: ${agentDir}\n- Save the native extension under that agent directory's extensions/ (auto-discovered on reload). Do not create a skill or prompt template.\n- Node executable: ${nodeExe}\n- Pi CLI entry (for your own real-process verification): ${piEntry}\n- Available npm SDK package: ${sdk}\n- Local generation model for this trial: Gemma only, ${config.ContextSize} context, 8192 output cap, initial thinking medium. Do not start another inference server or download/install anything. Runtime verification can use a scripted HTTP provider, without GPU inference.\n- Budget presets: off=0, low=512, medium=2048, high=4096 reasoning tokens. Preserve at least 1024 answer tokens.\n- Gemma/OmniCoder/Qwen accept enable_thinking on/off; their low/medium/high labels are local budget presets. GPT-OSS supports native reasoning_effort low/medium/high and does not support off. Test GPT-OSS wire fields with a scripted endpoint only; do not run that model.\n- Default /effort changes are session-only. The no-argument picker must show the current level and supported choices. Unknown levels or extra arguments must leave state unchanged. SDK clients changing thinking level without a TUI event must also change the next-request budget.\n- Keep work within this project and the active agent directory. Do not inspect the original pi-local-lab implementation or previous session transcripts. The ordinary production feature is withheld from this trial.\n- Do not change existing global/project settings. Do not delete files, rewrite Git history, or use subagents.\n- Report exactly which checks you executed and their results.\n`);
await writeFile(path.join(project,'TASK.md'),(await readFile(path.join(project,'TASK.md'),'utf8')).replace('Gemma only',selected+' only'));
const overrides=Object.fromEntries(Object.entries(prepared.env).filter(([key])=>key.startsWith('PI_')||['PATH','CAMOUFOX_INSTALL_DIR','PLAYWRIGHT_BROWSERS_PATH'].includes(key)));
const run={id,artifactDir,project,agentDir,config,backup,task:'create-effort-command',generationModel:selected,context:config.ContextSize,followUpsAllowed:1,scoring:{columns:['Round 1 score','Round 2 score'],pointsPerPass:1,weightedTotal:false},env:{...overrides,PI_CODING_AGENT_DIR:agentDir,PI_LOCAL_DESKTOP_UI:'1',PI_LOCAL_CONTEXT:String(config.ContextSize),PI_LOCAL_TOKENIZER_URL:config.RouterUrl,PI_LOCAL_OUTPUT_CAP:'8192',PI_LOCAL_THINKING_BUDGET:'2048',PI_EFFORT_PREFERENCES:path.join(artifactDir,'must-not-create-preferences.json')}};
await writeFile(path.join(artifactDir,'run.json'),JSON.stringify(run,null,2));
await writeFile(path.join(root,'.state/effort-task-current.json'),JSON.stringify({artifactDir,project,agentDir},null,2));
console.log(JSON.stringify({artifactDir,project,agentDir,backup,context:config.ContextSize,model:selected,workingFeatureRemovedFromEval:true},null,2));
