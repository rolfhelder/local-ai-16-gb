import { spawn } from 'node:child_process';
import path from 'node:path';
import { root, nodeExe, piEntry, machine, environment, acquireInferenceLock, ensureServer, serverArguments, prepareProfile, exec } from './local-runtime.mjs';
const args = process.argv.slice(2);
const value = (flag, fallback) => { const index = args.indexOf(flag); if (index < 0) return fallback; const result = args[index + 1]; args.splice(index, 2); if (!result) throw new Error(`${flag} requires a value`); return result; };
const flag = name => { const index = args.indexOf(name); if (index < 0) return false; args.splice(index, 1); return true; };
const profile = value('--profile', 'standard');
const dryRun = flag('--dry-run');
const probeOnly = flag('--probe');
const browser = flag('--browser');
const context = value('--context', undefined);
const cwd = path.resolve(value('--cwd', process.cwd()));
let release, server;
try {
  const config = await machine();
  if (context !== undefined) {
    if (!/^\d+$/.test(context) || Number(context) < 8192 || Number(context) > 102400) throw new Error('--context must be between 8192 and 102400');
    config.ContextSize = Number(context);
  }
  if (dryRun) {
    console.log(JSON.stringify({ profile, cwd, executable: nodeExe, pi: piEntry, model: `local-llama/${config.ModelId}`, server: config.LlamaExecutable, arguments: serverArguments(config), browser, singleSession: true }, null, 2));
  } else {
    release = await acquireInferenceLock();
    const prepared = await prepareProfile(profile, config, cwd);
    console.error('pia: preparing one local model; first load can take a little time.');
    server = await ensureServer(config);
    if (probeOnly) console.log(JSON.stringify({ ready: true, owned: server.owned, model: config.ModelId, context: config.ContextSize, profile }));
    else {
      const browserEntry = path.join(root, 'node_modules/@playwright/cli/playwright-cli.js');
      if (browser) await exec(nodeExe, [browserEntry, '-s=pia-browser', 'open', 'about:blank', '--browser', 'msedge', '--headed'], { cwd, env: environment(), windowsHide: true });
      try {
        const piArgs = [piEntry, '--provider', 'local-llama', '--model', config.ModelId, '--thinking', 'off', ...args];
        if (profile === 'native') piArgs.push('--no-extensions', '--no-skills', '--no-prompt-templates', '--no-context-files');
        const pi = spawn(nodeExe, piArgs, { cwd, env: prepared.env, stdio: 'inherit' });
        const interrupt = () => pi.kill('SIGINT');
        process.on('SIGINT', interrupt);
        process.on('SIGTERM', interrupt);
        try { process.exitCode = await new Promise((resolve, reject) => { pi.once('error', reject); pi.once('exit', code => resolve(code ?? 1)); }); }
        finally { process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); }
      } finally { if (browser) await exec(nodeExe, [browserEntry, '-s=pia-browser', 'close'], { cwd, env: environment(), windowsHide: true }).catch(() => {}); }
    }
  }
} catch (error) { console.error(`pia: ${error.message}`); process.exitCode = 1; }
finally { await server?.stop(); await release?.(); }
