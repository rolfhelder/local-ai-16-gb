import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {root} from '../scripts/local-runtime.mjs';
import {consoleUI} from '../scripts/console-ui.mjs';
const launch=args=>spawnSync(process.execPath,[path.join(root,'scripts/pia.mjs'),...args],{encoding:'utf8',timeout:15000,cwd:root});
test('improvement commands have readable defaults and explicit JSON',()=>{
 for(const [command,title] of [['presets','RESOURCE PRESETS'],['config','CONFIGURATION'],['eval','MATCHED EVALUATIONS']]){
  const result=launch([command,'--no-color']);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,new RegExp(title));assert.doesNotMatch(result.stdout,/\x1b\[/);
  const structured=launch([command,'--json']);assert.equal(structured.status,0,structured.stderr);assert.doesNotThrow(()=>JSON.parse(structured.stdout));
 }
 const small=launch(['eval','--models','gemma','--seeds','101','--json']);assert.equal(JSON.parse(small.stdout).trials,6);
});
test('progress and receipts inspect fixtures through the public launcher',()=>{
 const directory=fs.mkdtempSync(path.join(root,'.state/command-ui-'));
 const log=path.join(directory,'server.log');fs.writeFileSync(log,'CUDA error: out of memory\n');
 const progress=launch(['progress','--log',log]);assert.equal(progress.status,1);assert.match(progress.stdout,/allocation-error/);
 const receipt=path.join(directory,'receipt.json');fs.writeFileSync(receipt,JSON.stringify({schemaVersion:1,created:'test',model:{id:'fixture'},settings:{context:32768},measurements:{peakVramMiB:null,timings:null},runtime:{argv:[]},outcome:{passed:false,failureClass:'timeout',error:'test timeout'}}));
 const viewed=launch(['receipts','--file',receipt]);assert.equal(viewed.status,0,viewed.stderr);assert.match(viewed.stdout,/Run failed: timeout/);assert.match(viewed.stdout,/not measured/);
});
test('human renderer neutralizes terminal control injection and separates labels',()=>{
 let text='';const ui=consoleUI([],{write:s=>text+=s,isTTY:false});ui.row('Existing keys preserved',11);ui.status(false,'bad\x1b[2Jvalue');
 assert.match(text,/preserved\s+11/);assert.doesNotMatch(text,/\x1b/);
});
test('help and invalid flags do not start inference',()=>{
 const help=launch(['help']);assert.equal(help.status,0);assert.match(help.stdout,/local-ai receipts/);
 for(const command of ['presets','progress','receipts','config','eval']){const result=launch([command,'--help']);assert.equal(result.status,0);assert.match(result.stdout,/No operation performed/);}
 const invalid=launch(['eval','--model','gemma']);assert.equal(invalid.status,1);assert.doesNotMatch(invalid.stderr,/at ModuleJob/);
});
