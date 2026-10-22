// macOS/Linux baseline. Windows profiles/GUI and eval runners are separate.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root,piEntry,machine,generationLimits,serverArguments,ensureServer,acquireInferenceLock} from './local-runtime.mjs';
const args=process.argv.slice(2);
const value=(key,fallback)=>{const at=args.indexOf(key);if(at<0)return fallback;const v=args[at+1];if(!v||v.startsWith('--'))throw Error(key+' requires a value');args.splice(at,2);return v;};
const flag=key=>{const at=args.indexOf(key);if(at<0)return false;args.splice(at,1);return true;};
const selected=value('--model','gemma'),context=value('--context',undefined),cwd=path.resolve(value('--cwd',process.cwd())),kv=value('--kv','f16'),dry=flag('--dry-run');
if(args.length||!['f16','q8_0'].includes(kv))throw Error('Usage: node scripts/pia-unix.mjs [--model NAME] [--context TOKENS] [--kv f16|q8_0] [--cwd PATH] [--dry-run]');
const config=await machine(selected);
if(context!==undefined){const n=Number(context);if(!Number.isInteger(n)||n<8192||n>config.NativeContext)throw Error('Context must fit the model native window');config.ContextSize=n;}
if(kv==='q8_0')config.ExtraServerArgs=['--cache-type-k','q8_0','--cache-type-v','q8_0','--flash-attn','on'];
const agentDir=path.join(root,'.state/profiles/posix'),limits=generationLimits(config);
const extensions=['bash-destructive-guard.ts','context-status.mjs','tool-budget.mjs','effort.mjs'].map(f=>path.join(root,'extensions',f));
if(selected==='gpt-oss')extensions.push(path.join(root,'extensions/local-token-budget.mjs'));
const piArgs=[piEntry,'--provider','local-llama','--model',config.ModelId,'--thinking','medium'];
if(dry){console.log(JSON.stringify({model:config.ModelId,context:config.ContextSize,server:config.LlamaExecutable,serverArguments:serverArguments(config),pi:process.execPath,piArguments:piArgs,extensions,defaultTools:['read','write','edit','bash','grep','find','ls']},null,2));process.exit(0);}
if(process.platform==='win32')throw Error('Use bin/pia.cmd on Windows; this launcher is for macOS/Linux.');
await mkdir(agentDir,{recursive:true});
await writeFile(path.join(agentDir,'settings.json'),JSON.stringify({defaultTools:['read','write','edit','bash','grep','find','ls'],extensions,packages:[],skills:[],prompts:[],defaultThinkingLevel:'medium',compaction:{enabled:selected!=='gpt-oss',reserveTokens:limits.maxTokens,keepRecentTokens:6000}},null,2));
await writeFile(path.join(agentDir,'models.json'),JSON.stringify({providers:{'local-llama':{baseUrl:config.RouterUrl+'/v1',api:'openai-completions',apiKey:'local-only',models:[{id:config.ModelId,name:config.ModelId,reasoning:true,input:['text'],contextWindow:config.ContextSize,maxTokens:limits.maxTokens,thinkingLevelMap:{off:selected==='gpt-oss'?null:'off',minimal:null,low:'low',medium:'medium',high:'high',xhigh:null,max:null},cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}]}}},null,2));
const env={...process.env,PI_CODING_AGENT_DIR:agentDir,PI_OFFLINE:'1',PI_TELEMETRY:'0',PI_SKIP_VERSION_CHECK:'1',PI_LOCAL_CONTEXT:String(config.ContextSize),PI_LOCAL_TOKENIZER_URL:config.RouterUrl,PI_LOCAL_OUTPUT_CAP:String(limits.maxTokens),PI_LOCAL_THINKING_BUDGET:String(limits.reasoningBudget),PI_EFFORT_PREFERENCES:path.join(root,'.state/effort-preferences.json')};
let release,server;
try{release=await acquireInferenceLock();server=await ensureServer(config);const pi=spawn(process.execPath,piArgs,{cwd,env,stdio:'inherit'});const interrupt=()=>pi.kill('SIGINT');process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);try{process.exitCode=await new Promise((resolve,reject)=>{pi.once('error',reject);pi.once('exit',code=>resolve(code??1));});}finally{process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);}}
finally{await server?.stop();await release?.();}
