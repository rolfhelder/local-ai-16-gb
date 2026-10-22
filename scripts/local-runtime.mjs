import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, open, unlink, access,readdir } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {randomUUID} from 'node:crypto';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const exec = promisify(execFile);
export const nodeExe = path.join(root, 'runtime/node/node.exe');
export const piEntry = path.join(root, 'node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
export const localModels = {
  qwen38: { file: 'unsloth/Qwen3.8-27B-GGUF/Qwen3.8-27B-UD-IQ4_XS.gguf', context: 262144 },
  'qwen38-q3': { file: 'unsloth/Qwen3.8-27B-GGUF/Qwen3.8-27B-UD-Q3_K_XL.gguf', context: 262144 },
  qwen: { file: 'unsloth/Qwen3.5-9B-GGUF/Qwen3.5-9B-Q4_K_M.gguf', context: 262144 },
  gemma: { file: 'unsloth/gemma-4-12b-it-GGUF/gemma-4-12b-it-Q4_K_M.gguf', context: 262144 },
  omnicoder: { file: 'Tesslate/OmniCoder-9B-GGUF/omnicoder-9b-q4_k_m.gguf', context: 262144 },
  'gpt-oss': { file: 'ggml-org/gpt-oss-20b-GGUF/gpt-oss-20b-MXFP4.gguf', context: 131072 },
};
export async function machine(selection = 'gemma') {
  const config = JSON.parse((await readFile(path.join(root, 'machine.local.json'), 'utf8')).replace(/^\uFEFF/,''));
  if (selection && !localModels[selection] && !/\.gguf$/i.test(selection)) throw new Error('--model must be a registered name or a GGUF file path');
  if (selection && !localModels[selection]) {
    config.ModelFile=path.resolve(selection);
    config.ModelId='custom-local';
    config.NativeContext=32768;
    config.ContextSize=Math.min(config.ContextSize,32768);
  } else if (selection) {
    config.ModelFile = path.join(config.ModelsDirectory, localModels[selection].file);
    config.ModelId = selection + '-local';
    config.NativeContext = localModels[selection].context;
    config.ContextSize = Math.min(config.ContextSize, config.NativeContext);
  }
  config.Reasoning ??= true;
  config.ReasoningBudget ??= 2048;
  config.MaxTokens ??= 8192;
  return config;
}
export function environment(extra = {}) {
  return { ...process.env, PI_OFFLINE: '1', PI_TELEMETRY: '0', PI_SKIP_VERSION_CHECK: '1',
    PATH: [path.join(root, 'runtime/search/fd-v10.5.0-x86_64-pc-windows-msvc'),path.join(root, 'runtime/search/ripgrep-15.2.0-x86_64-pc-windows-msvc'),path.join(root, 'runtime/node'), path.join(root, 'runtime/pnpm/node_modules/.bin'), path.join(root, 'node_modules/.bin'), process.env.PATH].join(path.delimiter),
    CAMOUFOX_INSTALL_DIR: path.join(root, 'runtime/research-browser-cache'), PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'runtime/playwright-cache'),
    PI_RESEARCH_STATE_DIR: path.join(root, '.state/research'), PI_RESEARCH_KNOWLEDGE_STORE_RETRIEVAL: 'bm25',
    PI_RESEARCH_MAX_RESEARCHERS: '1', PI_RESEARCH_WORKER_THREADS: '1', PI_RESEARCH_WORKER_CONCURRENCY: '1', PI_RESEARCH_MAX_CONCURRENT_SCRAPES: '1',
    PI_RESEARCH_QUICK_RESEARCH: 'true', PI_RESEARCH_DEFAULT_RESEARCH_DEPTH: '0', PI_RESEARCH_MAX_RETRIES: '0',
    PI_RESEARCH_QUICK_MAX_QUERIES: '1', PI_RESEARCH_QUICK_MAX_SCRAPE_URLS: '2',
    PI_RESEARCH_PLANNING_MAX_TOKENS: '2048', PI_RESEARCH_SYNTHESIS_MAX_TOKENS: '2048',
    PI_COMPUTER_USE_WINDOWS_HELPER_PATH: path.join(root, 'runtime/computer/windows-bridge.exe'), PI_COMPUTER_USE_BROWSER_USE: '0', ...extra };
}
export async function acquireInferenceLock() {
  await mkdir(path.join(root, '.state'), { recursive: true });
  const lockPath = path.join(root, '.state/inference.lock');
  let handle;
  try { handle = await open(lockPath, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = JSON.parse(await readFile(lockPath, 'utf8'));
    let alive = true;
    try { process.kill(owner.pid, 0); } catch (probe) { if (probe.code === 'ESRCH') alive = false; }
    if (alive) throw new Error(`Another pia/eval session owns inference (PID ${owner.pid}).`);
    await unlink(lockPath);
    handle = await open(lockPath, 'wx');
  }
  await handle.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
  return async () => { await handle.close(); await unlink(lockPath).catch(() => {}); };
}
export function generationLimits(config) {
  const maxTokens = Math.min(config.MaxTokens || 8192, Math.floor(config.ContextSize / 4));
  return { maxTokens, reasoningBudget: config.Reasoning === false ? 0 : Math.min(config.ReasoningBudget ?? 2048, maxTokens - Math.min(2048, Math.floor(maxTokens / 2))) };
}
export function serverArguments(config) {
  return ['--model', config.ModelFile, '--alias', config.ModelId, '--host', '127.0.0.1', '--port', String(config.Port),
    '--jinja', '--reasoning', config.Reasoning === false ? 'off' : 'on', '--reasoning-budget', String(generationLimits(config).reasoningBudget), '--fit', 'off', '--no-context-shift',
    '-ngl', String(config.GpuLayers), '-c', String(config.ContextSize), '--parallel', '1', '--log-verbosity','4', ...(config.ExtraServerArgs || [])];
}
async function probe(config) {
  const response = await fetch(config.RouterUrl + '/v1/models', { signal: AbortSignal.timeout(1500) });
  if (!response.ok) throw new Error(`Model endpoint returned ${response.status}`);
  const data = await response.json();
  if (!data.data?.some(model => model.id === config.ModelId)) throw new Error('PORT_IN_USE_BY_DIFFERENT_MODEL');
  const propsResponse = await fetch(config.RouterUrl + '/props', { signal: AbortSignal.timeout(1500) });
  if (!propsResponse.ok) throw new Error('PORT_IN_USE_WITH_UNVERIFIABLE_CONFIGURATION');
  const props = await propsResponse.json();
  if (props.default_generation_settings?.n_ctx !== config.ContextSize || props.total_slots !== 1 || path.resolve(props.model_path || '') !== path.resolve(config.ModelFile)) throw new Error(`PORT_IN_USE_WITH_DIFFERENT_CONFIGURATION: requested context ${config.ContextSize}, reported context ${props.default_generation_settings?.n_ctx}; check model native limits and slot configuration`);
  return data;
}
export async function ensureServer(config) {
  try { await probe(config); throw new Error('PORT_IN_USE_WITH_UNVERIFIABLE_REASONING_SETTINGS: a server is already running; stop that server before using local-ai so the requested thinking budget can be applied'); }
  catch (error) { if (error.message.startsWith('PORT_IN_USE')) throw error; }
  await access(config.ModelFile);
  const logPath = config.LogPath || path.join(root, '.state/llama-server.log');
  await mkdir(path.dirname(logPath),{recursive:true});
  const evidenceDirectory=path.join(root,'.state/runtime-evidence');await mkdir(evidenceDirectory,{recursive:true});
  const modelStat=fs.statSync(config.ModelFile);
  const evidence={schemaVersion:1,runId:randomUUID(),startedAt:new Date().toISOString(),modelId:config.ModelId,modelFile:config.ModelFile,modelStat:{size:modelStat.size,mtimeMs:modelStat.mtimeMs},requestedGpuLayers:config.GpuLayers,contextSize:config.ContextSize,logPath,logStart:fs.existsSync(logPath)?fs.statSync(logPath).size:0};
  const log = fs.openSync(logPath, 'a');
  const server = spawn(config.LlamaExecutable, serverArguments(config), { windowsHide: true, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  let spawnError;
  server.once('error', error => { spawnError = error; });
  let ready=false,stopping;
  const stop = () => stopping??=(async()=>{
    if (server.exitCode === null && server.pid) { server.kill(); await new Promise(resolve => { server.once('exit', resolve); setTimeout(resolve, 5000).unref(); }); }
    if(ready){await writeFile(path.join(evidenceDirectory,'last.json'),JSON.stringify({...evidence,stoppedAt:new Date().toISOString()},null,2));try{const active=JSON.parse(await readFile(path.join(evidenceDirectory,'active.json'),'utf8'));if(active.runId===evidence.runId)await unlink(path.join(evidenceDirectory,'active.json'));}catch(error){if(error.code!=='ENOENT')throw error;}}
  })();
  try {
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (server.exitCode !== null) throw new Error(`llama.cpp exited (${server.exitCode}); inspect ${logPath}`);
      try { await probe(config); evidence.pid=server.pid;ready=true;await writeFile(path.join(evidenceDirectory,'active.json'),JSON.stringify(evidence,null,2));return { owned: true, pid: server.pid, evidence, stop }; } catch (error) { if (error.message.startsWith('PORT_IN_USE')) throw error; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('llama.cpp did not become ready within 180 seconds');
  } catch (error) { await stop(); throw error; }
}
export async function prepareProfile(name, config, cwd = root, {agentDirectory} = {}) {
  const profiles = {
    native: [],
    guard: ['bash-policy', 'windows-policy'],
    'guard-module': ['pi-guard'],
    lsp: ['pi-lsp-extension'],
    'lsp-windows': ['lsp-windows'],
    standard: ['bash-policy', 'windows-policy', 'lsp-windows'],
    'pi-app': ['bash-policy', 'windows-policy', 'lsp-windows'],
    research: ['bash-policy', 'windows-policy', 'lsp-windows', '@lincoln504/pi-research'],
    desktop: ['bash-policy', 'windows-policy', 'lsp-windows', '@injaneity/pi-computer-use'],
    web: ['bash-policy', 'windows-policy', 'lsp-windows', '@arcanemachine/pi-web-search'],
  };
  if (!profiles[name]) throw new Error(`Unknown profile ${name}. Choose ${Object.keys(profiles).join(', ')}`);
  const agentDir = agentDirectory ? path.resolve(agentDirectory) : path.join(root, '.state/profiles', name);
  if(agentDirectory){const relative=path.relative(path.join(root,'.state'),agentDir);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Isolated agent directory must stay within local .state');}
  await mkdir(agentDir, { recursive: true });
  const packages = profiles[name].filter(value => !['windows-policy','bash-policy','lsp-windows'].includes(value)).map(value => path.join(root, 'node_modules', value));
  const settings = { defaultTools: ['read', 'powershell', 'edit', 'write', 'grep', 'find', 'ls'], packages,
    extensions: [ ...(profiles[name].includes('windows-policy') ? [path.join(root, 'extensions/windows-destructive-policy.mjs')] : []), ...(profiles[name].includes('bash-policy') ? [path.join(root, 'extensions/bash-destructive-guard.ts')] : []) ],
    compaction: { enabled: true, reserveTokens: generationLimits(config).maxTokens, keepRecentTokens: Math.min(6000, Math.floor(config.ContextSize / 4)) }, branchSummary: { reserveTokens: generationLimits(config).maxTokens } };
  if(config.ModelId==='gpt-oss-local'){
    settings.extensions.push(path.join(root,'extensions/local-token-budget.mjs'));
    // The same first-turn character estimate can trigger premature compaction.
    // Keep manual /compact available; actual server overflow recovery still exists.
    settings.compaction.enabled=false;
  }
  if (profiles[name].includes('lsp-windows')) settings.extensions.push(await prepareWindowsLsp());
  if (profiles[name].some(value => ['pi-lsp-extension','lsp-windows'].includes(value))) settings.defaultTools.push('lsp_diagnostics','lsp_definition','lsp_hover','lsp_references','lsp_rename');
  if (profiles[name].includes('@arcanemachine/pi-web-search')) settings['pi-web-search'] = { backends: ['duckduckgo'], summarizationEnabled: false, readMaxChars: 3000, readMaxLimitChars: 8000, searchMaxResults: 5, searchMaxLimitResults: 10, searchMaxOutputBytes: 8000 };
  if (name !== 'native') {
    settings.extensions.push(path.join(root, 'extensions/context-status.mjs'));
    settings.extensions.push(path.join(root, 'extensions/tool-budget.mjs'));
    settings.extensions.push(path.join(root,'extensions/effort.mjs'));
    settings.skills = [path.join(root, '.state/.agents/skills')];
    settings.prompts = (await readdir(path.join(root,'prompts')).catch(error => { if (error.code === 'ENOENT') return []; throw error; })).filter(name=>name.endsWith('.md')&&name!=='effort.md').map(name=>path.join(root,'prompts',name));
  }
  if(name==='pi-app')settings.extensions.push(path.join(root,'extensions/pi-app-compat.mjs'));
  await writeFile(path.join(agentDir, 'settings.json'), JSON.stringify(settings, null, 2));
  await writeFile(path.join(agentDir, 'models.json'), JSON.stringify({ providers: { 'local-llama': {
    baseUrl: config.RouterUrl + '/v1', api: 'openai-completions', apiKey: 'local-only', models: [{
      id: config.ModelId, name: `Local ${config.ModelId} (16 GB baseline)`, reasoning: config.Reasoning !== false, input: ['text'], contextWindow: config.ContextSize, maxTokens: generationLimits(config).maxTokens,
      thinkingLevelMap:{off:config.ModelId==='gpt-oss-local'?null:'off',minimal:null,low:'low',medium:'medium',high:'high',xhigh:null,max:null},
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }]
  } } }, null, 2));
  if (profiles[name].some(value => ['pi-lsp-extension','lsp-windows'].includes(value))) await prepareLsp(cwd);
  const guardRules = await readFile(path.join(root, 'config/guard.rules.json'), 'utf8');
  return { agentDir, settings, env: environment({ PI_CODING_AGENT_DIR: agentDir, PI_GUARD: guardRules, PI_RESEARCH_MODEL: 'local-llama/' + config.ModelId,
    PI_LOCAL_TOKENIZER_URL:config.RouterUrl,PI_LOCAL_CONTEXT:String(config.ContextSize),PI_LOCAL_OUTPUT_CAP:String(generationLimits(config).maxTokens),PI_LOCAL_THINKING_BUDGET:String(generationLimits(config).reasoningBudget),PI_LOCAL_BUDGET_LOG:config.LogPath?config.LogPath+'.budget.jsonl':'' }) };
}
export async function prepareWindowsLsp() {
  // Preserve the pinned upstream file. Its adjacent generated copy resolves the same dependencies.
  const directory = path.join(root, 'node_modules/pi-lsp-extension/dist');
  let source = await readFile(path.join(directory, 'index.js'), 'utf8');
  const replacements = [
    ['this._diagnostics.get(uri)', 'this._diagnostics.get(piaDiagnosticUri(uri))'],
    ['this._diagnostics.set(params.uri, params.diagnostics)', 'this._diagnostics.set(piaDiagnosticUri(params.uri), params.diagnostics)'],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error('Pinned LSP source changed; review Windows URI compatibility patch.');
    source = source.replace(before, after);
  }
  source += '\nfunction piaDiagnosticUri(uri) { return process.platform === "win32" ? decodeURIComponent(uri).toLowerCase() : uri; }\n';
  const target = path.join(directory, 'pia-windows-index.mjs');
  await writeFile(target, source);
  return target;
}
export async function prepareLsp(cwd) {
  const target = path.join(cwd, '.pi-lsp.json');
  let current;
  try { current = JSON.parse(await readFile(target, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (current && !current.piaGenerated) return;
  await writeFile(target, JSON.stringify({ piaGenerated: true, autoStart: ['typescript'], autoInjectDiagnostics: ['typescript'], servers: {
    typescript: { command: nodeExe, args: [path.join(root, 'node_modules/typescript-language-server/lib/cli.mjs'), '--stdio'], initializationOptions: { disableAutomaticTypeAcquisition: true, preferences: { includePackageJsonAutoImports: 'off' } } }
  } }, null, 2));
}
