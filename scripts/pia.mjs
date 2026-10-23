import { spawn } from 'node:child_process';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {readFile,unlink} from 'node:fs/promises';
import { root, nodeExe, piEntry, machine, environment, acquireInferenceLock, ensureServer, serverArguments, prepareProfile, exec } from './local-runtime.mjs';
const args = process.argv.slice(2);
if(['presets','receipts','eval','progress','config'].includes(args[0])||args.some(a=>a==='--preset'||a.startsWith('--preset='))){
 console.error('This development command was retired. Use --context TOKENS for launch settings; tests save report.json automatically. Development evals: pnpm eval:coding-check.');process.exit(1);
}
if(args[0]==='help'||args.length===1&&args[0]==='--help'){(await import('./help.mjs')).help(args);process.exit(0);}
if(args[0]==='install'){
 const child=spawn('powershell.exe',['-NoProfile','-File',path.join(root,'scripts/install-command.ps1'),...args],{stdio:'inherit'});
 process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
 process.exit(process.exitCode);
}
if(args[0]==='doctor'){await (await import('./doctor.mjs')).main(args.slice(1));process.exit(process.exitCode??0);}
if(args[0]==='test'){await (await import('./acceptance.mjs')).main(args.slice(1));process.exit(process.exitCode??0);}
const value = (flag, fallback) => { const index = args.indexOf(flag); if (index < 0) return fallback; const result = args[index + 1]; args.splice(index, 2); if (!result) throw new Error(`${flag} requires a value`); return result; };
const flag = name => { const index = args.indexOf(name); if (index < 0) return false; args.splice(index, 1); return true; };
if (flag('--help')) {
  console.log('local-ai install             Open installation and acceptance menu\nlocal-ai install --plan      Preview core installation\nlocal-ai install --check     Inspect installed core components\nlocal-ai install --run       Install the pinned core stack\nlocal-ai install --test --run  Run acceptance directly\n');
  console.log('local-ai doctor              Hardware and model health\nlocal-ai test                Preview first-run acceptance\nlocal-ai test --run          Run acceptance (select installed model; --model NAME or GGUF path)\n');
  console.log('local-ai [--model qwen|gemma|omnicoder|gpt-oss] [--context TOKENS] [--kv f16|q8_0] [--profile standard|native|guard|lsp|lsp-windows|research|desktop|web]\n    [--reasoning-budget TOKENS] [--no-reasoning] [--browser] [--cwd PATH] [--dry-run] [--probe] [Pi arguments]\nDefaults: Gemma, 204800 context (GPT-OSS capped at 131072), reasoning on, 2048 thinking tokens, loopback port 48763.\n--local-model remains a compatibility alias for --model.\n--dry-run prints both full process commands without starting the model.');
  process.exit(0);
}
const profile = value('--profile', 'standard');
const dryRun = flag('--dry-run');
const probeOnly = flag('--probe');
const browser = flag('--browser');
const context = value('--context', undefined);
const requestedModel = value('--model', undefined);
const legacyModel = value('--local-model', undefined);
const localModel = requestedModel ?? legacyModel;
const noReasoning = flag('--no-reasoning');
const reasoningBudget = value('--reasoning-budget', undefined);
const kv = value('--kv', 'f16');
const cwd = path.resolve(value('--cwd', process.cwd()));
let release, server;
try {
  if(requestedModel&&legacyModel&&requestedModel!==legacyModel)throw new Error('Conflicting --model and --local-model selections');
  let selectedModel=localModel,resume=false;
  for(;;){
  const config = await machine(selectedModel);
  if(!['f16','q8_0'].includes(kv))throw new Error('--kv must be f16 or q8_0');
  if(kv==='q8_0')config.ExtraServerArgs=[...(config.ExtraServerArgs||[]),'--cache-type-k','q8_0','--cache-type-v','q8_0','--flash-attn','on'];
  if (noReasoning) config.Reasoning = false;
  if (reasoningBudget !== undefined) {
    if (!/^\d+$/.test(reasoningBudget) || Number(reasoningBudget) > 32768) throw new Error('--reasoning-budget must be 0..32768');
    config.ReasoningBudget = Number(reasoningBudget);
    config.MaxTokens = Math.max(config.MaxTokens, config.ReasoningBudget + 2048);
  }
  const piArgs = [piEntry, '--provider', 'local-llama', '--model', config.ModelId, '--thinking', config.Reasoning === false ? 'off' : 'medium', ...args];
  if (profile === 'native') {
    piArgs.push('--no-extensions', '--no-skills', '--no-prompt-templates', '--no-context-files');
    if(config.ModelId==='gpt-oss-local')piArgs.push('--extension',path.join(root,'extensions/local-token-budget.mjs'));
  }
  if (context !== undefined) {
    if (!/^\d+$/.test(context) || Number(context) < 8192 || Number(context) > 1048576) throw new Error('--context must be between 8192 and 1048576; sizes above the model native window are experimental');
    config.ContextSize = config.ModelId==='gpt-oss-local'?Math.min(Number(context),config.NativeContext):Number(context);
  }
  if (dryRun) {
    console.log(JSON.stringify({ profile, cwd, executable: nodeExe, pi: piEntry, piArguments: piArgs, model: `local-llama/${config.ModelId}`, server: config.LlamaExecutable, arguments: serverArguments(config), browser, singleSession: true }, null, 2));
  } else {
    release ??= await acquireInferenceLock();
    const prepared = await prepareProfile(profile, config, cwd);
    const restartPath=path.join(root,'.state','pia-restart-'+randomUUID()+'.json');
    prepared.env.PI_LOCAL_RESTART_REQUEST=restartPath;
    if(resume&&!piArgs.includes('--continue'))piArgs.push('--continue');
    console.error('pia: preparing one local model; first load can take a little time.');
    server = await ensureServer(config);
    if (probeOnly) console.log(JSON.stringify({ ready: true, owned: server.owned, model: config.ModelId, context: config.ContextSize, profile }));
    else {
      const browserEntry = path.join(root, 'node_modules/@playwright/cli/playwright-cli.js');
      if (browser) await exec(nodeExe, [browserEntry, '-s=pia-browser', 'open', 'about:blank', '--browser', 'msedge', '--headed'], { cwd, env: environment(), windowsHide: true });
      try {
        const pi = spawn(nodeExe, piArgs, { cwd, env: prepared.env, stdio: 'inherit' });
        const interrupt = () => pi.kill('SIGINT');
        process.on('SIGINT', interrupt);
        process.on('SIGTERM', interrupt);
        try { process.exitCode = await new Promise((resolve, reject) => { pi.once('error', reject); pi.once('exit', code => resolve(code ?? 1)); }); }
        finally { process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); }
      } finally { if (browser) await exec(nodeExe, [browserEntry, '-s=pia-browser', 'close'], { cwd, env: environment(), windowsHide: true }).catch(() => {}); }
    }
    await server?.stop();server=undefined;
    const requested=JSON.parse(await readFile(restartPath,'utf8').catch(()=>'{}'));
    await unlink(restartPath).catch(error=>{if(error.code!=='ENOENT')throw error;});
    if(requested.model&&!probeOnly){selectedModel=requested.model;resume=true;continue;}
  }
  break;
  }
} catch (error) { console.error(`pia: ${error.message}`); process.exitCode = 1; }
finally { await server?.stop(); await release?.(); }
