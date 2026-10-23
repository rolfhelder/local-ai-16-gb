import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {root} from '../scripts/local-runtime.mjs';
import {consoleUI} from '../scripts/console-ui.mjs';
const launch=args=>spawnSync(process.execPath,[path.join(root,'scripts/pia.mjs'),...args],{encoding:'utf8',timeout:15000,cwd:root});
test('human renderer neutralizes terminal control injection and separates labels',()=>{
 let text='';const ui=consoleUI([],{write:s=>text+=s,isTTY:false});ui.row('Existing keys preserved',11);ui.status(false,'bad\x1b[2Jvalue');
 assert.match(text,/preserved\s+11/);assert.doesNotMatch(text,/\x1b/);
});
test('help and invalid flags do not start inference',()=>{
 const help=launch(['help']);assert.equal(help.status,0);assert.match(help.stdout,/local-ai test --run/);assert.doesNotMatch(help.stdout,/local-ai (presets|receipts|eval|progress|config)/);
 for(const args of [['presets'],['receipts'],['eval'],['progress'],['config'],['--preset','coding']]){const invalid=launch(args);assert.equal(invalid.status,1);assert.match(invalid.stderr,/retired/);assert.doesNotMatch(invalid.stderr,/at ModuleJob/);}
});
