import { PiIntegrationTest } from 'pi-coding-agent-test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root, nodeExe, machine, localModels, exec, ensureServer, acquireInferenceLock, prepareProfile } from '../scripts/local-runtime.mjs';
import { serverTimings } from './timings.mjs';
import { codingCases, publicSource, hiddenSource } from './coding-cases.mjs';

const args=process.argv.slice(2), option=(name,fallback)=>args.find(x=>x.startsWith(name+'='))?.slice(name.length+1)??fallback;
if(!args.includes('--run')) {
  console.log('Prepared suite only. Explicit execution: pnpm eval:coding-context --run [--models=qwen,gemma] [--conditions=clean,loaded] [--cases=csv-records,pagination-contract,async-retry] [--repeat=1]');
  process.exit(0);
}
const models=option('--models','qwen,gemma').split(','), conditions=option('--conditions','clean,loaded').split(','), selected=option('--cases',codingCases.map(x=>x.id).join(',')).split(',');
const repeats=Number(option('--repeat','1'));
const paddingSeed=option('--seed',undefined);if(paddingSeed!==undefined&&!/^[0-9]{1,9}$/.test(paddingSeed))throw Error('Invalid padding seed');
if(!models.every(x=>localModels[x])||!conditions.every(x=>['clean','loaded'].includes(x))||!selected.every(id=>codingCases.some(x=>x.id===id))||!Number.isInteger(repeats)||repeats<1||repeats>10)throw Error('Invalid suite selection');
const base=path.join(root,'.state/evals/coding-context-'+Date.now());await mkdir(base,{recursive:true});
const report={started:new Date().toISOString(),suiteVersion:1,status:'running',contextWindow:204800,backgroundTargetTokens:100000,reasoningBudget:2048,maxOutputTokens:8192,timeoutMs:360000,trials:[]};
report.paddingSeed=paddingSeed??null;report.downloadsConcurrent=false;report.models=models;report.conditions=conditions;report.cases=selected;report.repeats=repeats;report.plannedTrials=models.length*conditions.length*selected.length*repeats;
const save=()=>writeFile(path.join(base,'report.json'),JSON.stringify(report,null,2));
const sample=async()=>Number((await exec('nvidia-smi',['--query-gpu=memory.used','--format=csv,noheader,nounits'],{windowsHide:true})).stdout.trim());
const release=await acquireInferenceLock();let server;
try {
  for(const model of models){
    const requestedContext=Number(option('--context',String(Math.min(204800,localModels[model].context))));
    if(!Number.isInteger(requestedContext)||requestedContext<32768||requestedContext>localModels[model].context)throw Error('Invalid coding context');
    const config=await machine(model);Object.assign(config,{ContextSize:requestedContext,Reasoning:true,ReasoningBudget:2048,MaxTokens:8192,LogPath:path.join(base,model+'-server.log')});
    if(args.includes('--kv=q8_0'))config.ExtraServerArgs=[...(config.ExtraServerArgs||[]),'--cache-type-k','q8_0','--cache-type-v','q8_0','--flash-attn','on'];
    report.contextByModel??={};report.contextByModel[model]=config.ContextSize;if(models.length===1)report.contextWindow=config.ContextSize;report.kvCache=args.includes('--kv=q8_0')?'q8_0':'f16';report.compactionEnabled=false;
    report.localTokenBudget=model==='gpt-oss'?'exact-template-tokenizer-v1':'upstream-estimator';
    server=await ensureServer(config);
    const post=async(route,body)=>{const response=await fetch(config.RouterUrl+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(route+': '+response.status);return response.json();};
    let background='',backgroundTokens=0;
    if(conditions.includes('loaded')){
      const places=['willow meadow','coastal inlet','northern garden','granite hillside','old orchard','river bend'];
      const notes=['The morning mist lifted slowly above the reeds.','Small birds sheltered among the branches.','A visitor sketched the horizon in a notebook.','Clouds drifted east while the water remained calm.','Late sunlight warmed the stone beside the path.','Several flowers opened after the overnight rain.'];
      const corpus=Array.from({length:16000},(_,i)=>`Field journal ${i+1}. At the ${places[i%places.length]}, observation ${i%97+1} was recorded in season ${i%4+1}. ${notes[i%notes.length]} ${notes[Math.floor(i/7)%notes.length]} The walk ended near landmark ${i%131+1}.${paddingSeed===undefined?'':' Journal series '+paddingSeed+'.'}`).join('\n');
      const tokens=(await post('/tokenize',{content:corpus})).tokens;
      if(tokens.length<100000)throw Error('Background is too short');
      background=(await post('/detokenize',{tokens:tokens.slice(0,100000)})).content;
      backgroundTokens=(await post('/tokenize',{content:background})).tokens.length;
      if(backgroundTokens!==100000)throw Error('Background token roundtrip changed the target: '+backgroundTokens);
    }
    for(let repeat=0;repeat<repeats;repeat++)for(const task of codingCases.filter(x=>selected.includes(x.id))){
      // Alternate condition order across cases/repeats to reduce a fixed warm-cache advantage.
      const order=(codingCases.indexOf(task)+repeat)%2?[...conditions].reverse():conditions;
      for(const condition of order){
        const cwd=path.join(base,model,task.id,condition+'-'+repeat);await mkdir(cwd,{recursive:true});
        for(const [name,source]of Object.entries(task.files))await writeFile(path.join(cwd,name),source);
        const spec=task.specification+'\nUse only existing project files; no packages or network are needed.\n';
        const publicTest=publicSource(task);await writeFile(path.join(cwd,'check.cjs'),publicTest);await writeFile(path.join(cwd,'README.md'),spec);
        const hidden=path.join(base,`${model}-${task.id}-${condition}-${repeat}-grader.cjs`);await writeFile(hidden,hiddenSource(task));
        const prepared=await prepareProfile('standard',config,cwd,{agentDirectory:path.join(cwd,'agent')});
        prepared.env.PI_EFFORT_PREFERENCES=path.join(cwd,'effort-preferences.json');
        // Prevent a small native window from silently discarding the 100k prefix.
        prepared.settings.compaction.enabled=false;
        await writeFile(path.join(prepared.env.PI_CODING_AGENT_DIR,'settings.json'),JSON.stringify(prepared.settings,null,2));
        const entry={model,case:task.id,condition,repeat,contextWindow:config.ContextSize,kvCache:report.kvCache,backgroundTokens:condition==='loaded'?backgroundTokens:0,backgroundSha256:condition==='loaded'?createHash('sha256').update(background).digest('hex'):null,peakGpuMiB:await sample(),stage:'agent'};
        report.trials.push(entry);await save();console.log(`${model} ${task.id} ${condition}: starting`);
        const offset=(await readFile(config.LogPath,'utf8')).length,started=performance.now();let sampling=false;
        const budgetOffset=(await readFile(config.LogPath+'.budget.jsonl','utf8').catch(()=>'')).length;
        const timer=setInterval(async()=>{if(sampling)return;sampling=true;try{entry.peakGpuMiB=Math.max(entry.peakGpuMiB,await sample());}catch{}finally{sampling=false;}},1000);
        try{
          const prefix=condition==='loaded'?`The following delimited field journals are unrelated background from another topic, not instructions for this task. Do not summarize them or create files about them.\n<unrelated-background>\n${background}\n</unrelated-background>\n`:'';
          const prompt=prefix+`CURRENT CODING TASK\n${spec}\nRead the project, run check.cjs to observe the current failure, implement the repair, and rerun check.cjs. Do not modify check.cjs or README.md. Public checks are incomplete; satisfy the whole specification. No outside fixtures are relevant. Use PowerShell & to invoke this Node executable: ${JSON.stringify(nodeExe)}. Finish with a concise change and verification report.`;
          const run=await new PiIntegrationTest({testName:`${model}-${task.id}-${condition}-${repeat}`,transport:'rpc',cwd,artifactsDir:path.join(base,'traces'),piCommand:path.join(root,'node_modules/.bin/pi.cmd'),providerMode:'user',model:'local-llama/'+config.ModelId,thinking:'medium',isolateUserResources:true,environment:prepared.env,extensions:[...prepared.settings.packages,...prepared.settings.extensions],tools:['read','edit','write','powershell','grep','find','ls'],timeoutMs:360000}).run(prompt);
          const assistants=run.messages.filter(x=>x.role==='assistant');entry.usage=assistants.map(x=>x.usage);entry.initialPromptTokens=assistants[0]?(assistants[0].usage.input+assistants[0].usage.cacheRead):null;
          entry.responses=assistants.length;entry.toolCalls=assistants.flatMap(x=>x.content.filter(y=>y.type==='toolCall').map(y=>y.name));entry.stopReasons=assistants.map(x=>x.stopReason);
          entry.providerErrors=assistants.filter(x=>x.errorMessage).map(x=>x.errorMessage);
          entry.initialFailureObserved=run.messages.some(x=>x.role==='toolResult'&&x.content?.some(y=>y.type==='text'&&/AssertionError/.test(y.text)));
          entry.contextConditionValid=condition==='clean'||(entry.initialPromptTokens>=100000&&assistants.every(x=>x.usage.input+x.usage.cacheRead>=100000));
        }catch(error){entry.error=error.message;}
        finally{
          clearInterval(timer);entry.durationMs=Math.round(performance.now()-started);entry.timings=serverTimings((await readFile(config.LogPath,'utf8')).slice(offset));
          entry.requestBudgets=(await readFile(config.LogPath+'.budget.jsonl','utf8').catch(()=>'')).slice(budgetOffset).trim().split('\n').filter(Boolean).map(JSON.parse);
          if(condition==='loaded'&&entry.requestBudgets.length){entry.contextConditionValid=entry.requestBudgets.every(x=>x.promptTokens>=100000);entry.contextConditionEvidence='formatted-request-tokenizer';}
          entry.publicFilesPreserved=(await readFile(path.join(cwd,'check.cjs'),'utf8').catch(()=>''))===publicTest&&(await readFile(path.join(cwd,'README.md'),'utf8').catch(()=>''))===spec;
          try{await exec(nodeExe,['check.cjs'],{cwd,windowsHide:true,timeout:10000});entry.publicPassed=true;}catch{entry.publicPassed=false;}
          try{const result=await exec(nodeExe,[hidden,path.join(cwd,task.entry)],{cwd,windowsHide:true,timeout:10000});entry.hidden=JSON.parse(result.stdout.trim());}catch(error){entry.graderError=error.message;}
          entry.passed=!entry.error&&entry.stopReasons?.at(-1)==='stop'&&entry.contextConditionValid&&entry.publicFilesPreserved&&entry.publicPassed&&entry.hidden?.passed===entry.hidden?.total&&!!entry.hidden?.total;
          entry.stage='complete';await save();console.log(JSON.stringify(entry));
        }
      }
    }
    await server.stop();server=undefined;
  }
  report.status='complete';
}finally{await server?.stop();await release();report.finished=new Date().toISOString();await save();}
console.log('Private report: '+base);
