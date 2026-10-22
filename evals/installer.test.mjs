import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const script=path.join(root,'scripts/Install-Core.ps1');
test('unified installer command previews and rejects unknown flags before installing', {skip:process.platform!=='win32'},()=>{
 const wrapper=path.join(root,'scripts/install-command.ps1');
 const preview=run(wrapper,['install','--plan','--json','--no-color']);
 assert.equal(preview.status,0,preview.stderr);assert.equal(JSON.parse(preview.stdout).Mode,'plan');
 const invalid=run(wrapper,['install','--typo']);assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/Unknown installation option/);
});
function run(file,args=[]) {
  return spawnSync('pwsh',['-NoProfile','-File',file,...args],{encoding:'utf8',timeout:30000});
}
test('installer menu defaults to no action and includes every first-run choice', {skip:process.platform!=='win32'},()=>{
 const wrapper=path.join(root,'scripts/install-command.ps1');
 const result=spawnSync('pwsh',['-NoProfile','-File',wrapper,'install','--no-color'],{input:'0\n',encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 for(const text of ['Check installation','Install core components','Run acceptance test','Verify model + health','Add model location'])assert.ok((result.stdout+result.stderr).includes(text),text);
 assert.doesNotMatch(result.stdout,/Preview installation|Preview acceptance test/);
 assert.doesNotMatch(result.stdout,/ACCEPTANCE TEST|Core installation complete/);
});
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
test('Windows menu asks for a model and permits cancelling before inference', {skip:process.platform!=='win32'},()=>{
 const result=spawnSync('powershell.exe',['-NoProfile','-File',path.join(root,'scripts/install-command.ps1'),'install','--no-color'],{input:'3\n\n0\n',encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Installed models/);assert.match(result.stdout,/No model selected; cancelled/);
 assert.doesNotMatch(result.stdout+result.stderr,/ACCEPTANCE TEST|mmproj-F16/);
});
test('unified picker resolves folders and GGUF files without opening a dialog', {skip:process.platform!=='win32'},()=>{
 const base=fs.mkdtempSync(path.join(root,'.state/unified-picker-'));
 const model=path.join(base,'sample.gguf');fs.writeFileSync(model,'fixture');
 for(const [selected,kind,expected] of [[base,'folder',base],[path.join(base,'Use this folder'),'folder',base],[model,'file',model]]){
  const result=run(path.join(root,'scripts/browse-model.ps1'),['-ResolvePath',selected]);
  assert.equal(result.status,0,result.stderr);const parsed=JSON.parse(result.stdout);assert.equal(parsed.kind,kind);assert.equal(parsed.path,expected);
 }
 const invalid=run(path.join(root,'scripts/browse-model.ps1'),['-ResolvePath',path.join(base,'missing.gguf')]);assert.notEqual(invalid.status,0);
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
test('Windows PowerShell 5.1 parses and runs both dashboards', {skip:process.platform!=='win32'},()=>{
  for (const mode of ['-Plan','-Check']) {
    const result=spawnSync('powershell.exe',['-NoProfile','-File',script,mode,'-NoColor'],{encoding:'utf8',timeout:30000});
    assert.equal(result.status,0,result.stderr+result.stdout);
    assert.match(result.stdout,mode==='-Plan'?/INSTALL PREVIEW/:/CORE INVENTORY/);
  }
});
