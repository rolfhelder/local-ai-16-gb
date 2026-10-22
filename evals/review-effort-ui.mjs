// Operator-only approval helper. It never approves an unreviewed request:
// first inspect its text/hash, then pass that exact hash after reviewing it.
import {createHash} from 'node:crypto';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from '../scripts/local-runtime.mjs';
import {connectDesktop} from './pi-app-client.mjs';
const pointer=JSON.parse(await readFile(path.join(root,'.state/effort-task-current.json'),'utf8')),run=JSON.parse(await readFile(path.join(pointer.artifactDir,'run.json'),'utf8'));
const app=await connectDesktop();try{
 const text=(await app.evaluate('document.body.innerText')).split('Destructive action').slice(1).join('Destructive action').trim();
 if(!text)throw Error('No destructive-action confirmation visible');
 const hash=createHash('sha256').update(text).digest('hex');
 if(process.argv.includes('--deny')){
  if(process.argv[process.argv.indexOf('--deny')+1]!==hash)throw Error('Displayed request changed; inspect again');
  await app.evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='No');if(!button)throw Error('No button missing');button.click();return true;})()`);
  await appendFile(path.join(run.artifactDir,'denied-operations.jsonl'),JSON.stringify({timestamp:new Date().toISOString(),requestHash:hash,reason:'Destructive cleanup was not authorized and the task forbids deletion.'})+'\n');
  console.log('Denied destructive cleanup; files preserved.');
 }else if(!process.argv.includes('--approve')){console.log(JSON.stringify({hash,text},null,2));}
 else{
  if(process.argv[process.argv.indexOf('--approve')+1]!==hash)throw Error('Displayed request changed; inspect again');
  const active=await app.evaluate(`(()=>{const active=new Map();for(const e of window.__effortTrialEvents||[]){if(e.type!=='tool')continue;if(e.phase==='start')active.set(e.toolCallId,e);if(e.phase==='end')active.delete(e.toolCallId);}return [...active.values()].at(-1);})()`);
  if(!active)throw Error('No matching active tool call');
  const stage=await readFile(path.join(run.artifactDir,'followup-sent.json')).then(()=>'followup',e=>{if(e.code==='ENOENT')return 'first';throw e;});
  const approvedAt=Date.now();
  await app.evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Yes');if(!button)throw Error('Yes button missing');button.click();return true;})()`);
  const file=path.join(run.artifactDir,'approval-adjustments.json');const records=JSON.parse(await readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')return '[]';throw e;}));
  records.push({stage,seconds:(approvedAt-active.timestamp)/1000,blockedFrom:new Date(active.timestamp).toISOString(),approvedAt:new Date(approvedAt).toISOString(),reason:'Operator reviewed and approved this non-destructive command; host confirmation delay excluded.',requestHash:hash});
  await writeFile(file,JSON.stringify(records,null,2));console.log('Approved reviewed request and recorded host wait.');
 }
}finally{app.close();}
