import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareLsp } from '../scripts/local-runtime.mjs';
export async function fixture(directory) {
  await mkdir(directory, { recursive: true });
  const files = {
    'note.txt': 'alpha\nOlá, Rolf\nomega\n',
    'victim.txt': 'disposable fixture; never use personal files',
    'math.ts': 'export function increment(value: number): number { return value + 1; }\n',
    'barrel.ts': 'export { increment as bump } from "./math";\n',
    'main.ts': 'import { bump } from "./barrel";\nconst answer = bump(2);\nconst documentation = "bump is a word, not a reference";\nconst broken: number = "wrong";\nexport { answer, documentation, broken };\n',
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, types: [], target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', noEmit: true }, include: ['*.ts'] }),
    'package.json': '{"name":"disposable-eval-fixture","private":true}',
  };
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(directory, name), content);
  await prepareLsp(directory);
  return files;
}
