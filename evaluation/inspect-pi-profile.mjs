// Loads tools and requests command metadata only; never submits a model prompt.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const auditPath = path.join(root, '.state/profile-audit.ts');
await mkdir(path.dirname(auditPath), { recursive: true });
await writeFile(auditPath, `export default function(pi) { pi.on('session_start', () => { console.error('LAB_TOOL_INVENTORY=' + JSON.stringify(pi.getAllTools().map(t => t.name))); }); }`);
const env = {
  ...process.env,
  PI_CODING_AGENT_DIR: path.join(root, '.state/agent'),
  PI_OFFLINE: '1', PI_TELEMETRY: '0', PI_SKIP_VERSION_CHECK: '1',
  CAMOUFOX_INSTALL_DIR: path.join(root, 'runtime/research-browser-cache'),
  PI_RESEARCH_STATE_DIR: path.join(root, '.state/research'),
  PI_RESEARCH_KNOWLEDGE_STORE_RETRIEVAL: 'bm25',
  PI_COMPUTER_USE_WINDOWS_HELPER_PATH: path.join(root, 'runtime/computer/windows-bridge.exe'),
  PI_COMPUTER_USE_BROWSER_USE: '0',
};
const piEntry = path.join(root, 'node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
const child = spawn(process.execPath, [piEntry, '--mode', 'rpc', '--no-session', '--no-mcp', '--no-context-files',
  '-e', path.join(root, 'node_modules/@lincoln504/pi-research'),
  '-e', path.join(root, 'node_modules/@injaneity/pi-computer-use'), '-e', auditPath],
{ cwd: root, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let stdout = '', stderr = '';
const timer = setTimeout(() => { stderr += '\nAUDIT_TIMEOUT'; child.kill(); }, 35000);
child.stdout.on('data', data => {
  stdout += data;
  if (stdout.includes('"command":"get_commands"') || stdout.includes('"command": "get_commands"')) child.stdin.end();
});
child.stderr.on('data', data => { stderr += data; });
child.stdin.on('error', () => {});
child.stdin.write(JSON.stringify({ id: 'commands', type: 'get_commands' }) + '\n');
const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
clearTimeout(timer);
await writeFile(path.join(root, '.state/profile-audit.log'), stdout + '\nSTDERR\n' + stderr);
const inventoryLine = stderr.split(/\r?\n/).find(line => line.startsWith('LAB_TOOL_INVENTORY='));
let tools = inventoryLine ? JSON.parse(inventoryLine.slice('LAB_TOOL_INVENTORY='.length)) : [];
const records = stdout.split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
const commands = records.find(record => record.command === 'get_commands');
console.log(JSON.stringify({ exitCode: code, tools, commandResponse: commands, diagnostics: stderr.replace(/LAB_TOOL_INVENTORY=.*\n?/, '').trim() }, null, 2));
if (!inventoryLine || !commands?.success || !tools.includes('research') || !tools.includes('act_ui')) process.exitCode = 1;
