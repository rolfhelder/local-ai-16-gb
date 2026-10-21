import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { root, nodeExe } from '../scripts/local-runtime.mjs';
const require = createRequire(await realpath(path.join(root, 'node_modules/pi-lsp-extension/package.json')));
const { createMessageConnection, StreamMessageReader, StreamMessageWriter } = require('vscode-languageserver-protocol/node');
const cwd = path.resolve(process.argv[2]);
const child = spawn(nodeExe, [path.join(root, 'node_modules/typescript-language-server/lib/cli.mjs'), '--stdio'], { cwd, windowsHide: true });
child.stderr.on('data', data => process.stderr.write(data));
const connection = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
const diagnostics = [];
connection.onNotification('textDocument/publishDiagnostics', params => diagnostics.push(params));
connection.onRequest('workspace/configuration', params => params.items.map(() => ({})));
connection.listen();
const uri = file => pathToFileURL(path.join(cwd, file)).toString();
try {
  await connection.sendRequest('initialize', { processId: process.pid, rootUri: uri(''), initializationOptions: { disableAutomaticTypeAcquisition: true, preferences: { includePackageJsonAutoImports: 'off' }, tsserver: { logDirectory: path.join(cwd, 'tslogs'), logVerbosity: 'verbose' } }, capabilities: { textDocument: { publishDiagnostics: { relatedInformation: true } } } });
  connection.sendNotification('initialized', {});
  for (const file of ['main.ts', 'math.ts', 'barrel.ts']) connection.sendNotification('textDocument/didOpen', { textDocument: { uri: uri(file), languageId: 'typescript', version: 1, text: await readFile(path.join(cwd, file), 'utf8') } });
  await new Promise(resolve => setTimeout(resolve, 3000));
  const hover = await connection.sendRequest('textDocument/hover', { textDocument: { uri: uri('main.ts') }, position: { line: 1, character: 7 } });
  const definition = await connection.sendRequest('textDocument/definition', { textDocument: { uri: uri('main.ts') }, position: { line: 1, character: 16 } });
  await new Promise(resolve => setTimeout(resolve, 6000));
  console.log(JSON.stringify({ diagnostics, hover, definition }, null, 2));
} finally { connection.dispose(); child.kill(); }
