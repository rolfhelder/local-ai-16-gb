import {readFile,writeFile,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {root,exec} from '../scripts/local-runtime.mjs';
import {serverTimings} from './timings.mjs';
import {connectDesktop} from './pi-app-client.mjs';
const stage=process.argv[2]||'first';
const pointer=JSON.parse(await readFile(path.join(root,'.state/effort-task-current.json'),'utf8')),run=JSON.parse(await readFile(path.join(pointer.artifactDir,'run.json'),'utf8'));
const sent=JSON.parse(await readFile(path.join(run.artifactDir,stage+'-sent.json'),'utf8'));
const app=await connectDesktop();let peakVram=null,lastState;
const adjustments=async()=>JSON.parse(await readFile(path.join(run.artifactDir,'approval-adjustments.json'),'utf8').catch(e=>{if(e.code==='ENOENT')return '[]';throw e;})).filter(a=>a.stage===stage).reduce((sum,a)=>sum+a.seconds,0);
try{for(const line of (await readFile(path.join(run.artifactDir,stage+'-observations.jsonl'),'utf8')).trim().split('\n'))peakVram=Math.max(peakVram||0,JSON.parse(line).vramMiB||0);}catch(e){if(e.code!=='ENOENT')throw e;}
try{
 for(;;){
  lastState=(await app.invoke('ipc:runtime.getState')).state;
  const gpu=await exec('nvidia-smi',['--query-gpu=memory.used','--format=csv,noheader,nounits'],{windowsHide:true});const memory=Number(gpu.stdout.trim().split(/\r?\n/)[0]);if(Number.isFinite(memory))peakVram=Math.max(peakVram||0,memory);
  await appendFile(path.join(run.artifactDir,stage+'-observations.jsonl'),JSON.stringify({timestamp:new Date().toISOString(),streaming:lastState?.isStreaming,messageCount:lastState?.messageCount,vramMiB:memory})+'\n');
  if(!lastState?.isStreaming)break;
  const stalledVerifier=await app.evaluate(`(()=>{const active=new Map();for(const e of window.__effortTrialEvents||[]){if(e.type!=='tool')continue;if(e.phase==='start')active.set(e.toolCallId,e);if(e.phase==='end')active.delete(e.toolCallId);}return [...active.values()].filter(e=>e.toolName==='powershell'&&/cli\\.js/.test(JSON.stringify(e.input))&&Date.now()-e.timestamp>300000).map(e=>({toolCallId:e.toolCallId,started:e.timestamp}));})()`);
  if(stalledVerifier.length){await app.invoke('ipc:prompt.abort',{sessionFile:sent.sessionFile});await writeFile(path.join(run.artifactDir,stage+'-stop-reason.json'),JSON.stringify({reason:'Candidate Pi CLI verifier remained running for over five minutes; ended the stalled turn.',stalledVerifier},null,2));await new Promise(r=>setTimeout(r,1000));break;}
  if(Date.now()-Date.parse(sent.started)-(await adjustments())*1000>15*60000){await app.invoke('ipc:prompt.abort',{sessionFile:sent.sessionFile});console.log('15-minute turn bound reached (excluding recorded host approval waits); aborted generation, no steering prompt sent.');await new Promise(r=>setTimeout(r,1000));break;}
  await new Promise(r=>setTimeout(r,15000));
 }
 const log=await readFile(run.config.LogPath,'utf8');
 const lines=(await readFile(sent.sessionFile,'utf8')).split('\n').filter(Boolean).map(JSON.parse);
 const messages=lines.filter(e=>e.type==='message'&&e.timestamp>=sent.started).map(e=>e.message);
 const assistants=messages.filter(m=>m.role==='assistant');const calls=assistants.flatMap(m=>(m.content||[]).filter(c=>c.type==='toolCall'));
 const usage={};for(const m of assistants)for(const key of ['input','output','cacheRead','cacheWrite','totalTokens'])usage[key]=(usage[key]||0)+(m.usage?.[key]||0);
 const wallSeconds=(Date.now()-Date.parse(sent.started))/1000,approvalWaitSeconds=await adjustments();
 const metrics={stage,started:sent.started,finished:new Date().toISOString(),wallSeconds,approvalWaitSeconds,activeWallSeconds:wallSeconds-approvalWaitSeconds,peakObservedTotalVramMiB:peakVram,toolCalls:calls.length,assistantMessages:assistants.length,usage,timings:serverTimings(log.slice(sent.serverLogOffset||0)),compactions:lines.filter(e=>e.type==='compaction'&&e.timestamp>=sent.started).length,lastState};
 await writeFile(path.join(run.artifactDir,stage+'-metrics.json'),JSON.stringify(metrics,null,2));console.log(JSON.stringify({...metrics,timings:{promptTpsMean:metrics.timings.promptTpsMean,generationTpsMean:metrics.timings.generationTpsMean,generationTpsWeighted:metrics.timings.generationTpsWeighted}},null,2));
}finally{app.close();}
