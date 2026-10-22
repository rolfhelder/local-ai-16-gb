import test from 'node:test';
import assert from 'node:assert/strict';
import {root,nodeExe,exec} from '../scripts/local-runtime.mjs';
test('POSIX dry run selects Gemma, bash tools and no Windows policy',async()=>{
 const {stdout}=await exec(nodeExe,['scripts/pia-unix.mjs','--dry-run'],{cwd:root});const r=JSON.parse(stdout);
 assert.equal(r.model,'gemma-local');assert.equal(r.context,204800);assert.ok(r.defaultTools.includes('bash'));assert.ok(!r.defaultTools.includes('powershell'));assert.ok(!r.extensions.some(p=>p.includes('windows')));
});
test('POSIX launcher rejects context beyond native window before inference',async()=>{
 await assert.rejects(exec(nodeExe,['scripts/pia-unix.mjs','--model','gpt-oss','--context','204800','--dry-run'],{cwd:root}),/Context must fit/);
});
