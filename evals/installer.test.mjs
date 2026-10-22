import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const script=path.join(root,'scripts/Install-Core.ps1');
function run(file,args=[]) {
  return spawnSync('pwsh',['-NoProfile','-File',file,...args],{encoding:'utf8',timeout:30000});
}
test('installer preview is human-readable; JSON remains explicit',()=>{
  const human=run(script,['-Plan','-NoColor','-Ascii']);
  assert.equal(human.status,0,human.stderr);
  assert.match(human.stdout,/LOCAL AI \/ INSTALL PREVIEW/);
  assert.match(human.stdout,/no downloads, file changes or model loading/);
  assert.doesNotMatch(human.stdout,/\x1b\[/);
  const json=run(script,['-Plan','-Json']);
  assert.equal(json.status,0,json.stderr);
  const report=JSON.parse(json.stdout.replace(/^\uFEFF/,''));
  assert.equal(report.Mode,'plan');
  assert.equal(report.ChangesMade,false);
});
test('missing core inventory reports failures without creating runtime/config or invoking doctor',()=>{
  // Preserve this disposable fixture under ignored .state for inspection.
  fs.mkdirSync(path.join(root,'.state'),{recursive:true});
  const fixture=fs.mkdtempSync(path.join(root,'.state','installer inventory '));
  const scripts=path.join(fixture,'scripts');
  fs.mkdirSync(scripts);
  const copy=path.join(scripts,'Install-Core.ps1');
  fs.copyFileSync(script,copy);
  const before=fs.readdirSync(fixture);
  const result=run(copy,['-Check','-Json']);
  assert.equal(result.status,1,result.stderr);
  const report=JSON.parse(result.stdout.replace(/^\uFEFF/,''));
  assert.equal(report.Mode,'inventory');
  assert.equal(report.Passed,false);
  assert.equal(report.ChangesMade,false);
  assert.ok(report.Checks.some(c=>c.Name==='Node'&&!c.Passed));
  assert.ok(report.Checks.some(c=>c.Name==='Configuration'&&!c.Passed));
  assert.deepEqual(fs.readdirSync(fixture),before);
});
test('conflicting installer modes fail before installation',()=>{
  for(const args of [['-Plan','-Check'],['-Json'],['-Check','-AcceptModel','gemma']]) {
    const result=run(script,args);
    assert.notEqual(result.status,0);
  }
});
