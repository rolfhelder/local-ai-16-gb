import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {root} from '../scripts/local-runtime.mjs';
import {parseOffloadLog,inspectOffloadRecord,discoverOffload} from '../scripts/gpu-offload.mjs';

const log=(n=49)=>`load_tensors: offloaded ${n}/49 layers to GPU\nload_tensors: CUDA0 model buffer size = 6000.00 MiB\nllama_kv_cache: CUDA0 KV buffer size = 512.00 MiB\nload_tensors: CPU_Mapped model buffer size = 200.00 MiB\n`;
test('actual allocation distinguishes full, partial and CPU placement',()=>{
 const full=parseOffloadLog(log(),{requestedLayers:999});assert.equal(full.status,'pass');assert.equal(full.placement,'full');assert.equal(full.gpuModelBytes,6000*1024**2);assert.deepEqual(full.devices,['CUDA0']);
 assert.equal(parseOffloadLog(log(12),{requestedLayers:12}).placement,'partial');assert.equal(parseOffloadLog(log(12),{requestedLayers:999}).status,'fail');assert.equal(parseOffloadLog(log(0),{requestedLayers:999}).status,'fail');
});
test('GPU detection, requested flags and pinned host buffers are not allocation proof',()=>{
 assert.equal(parseOffloadLog('NVIDIA RTX4090 detected; -ngl 999').status,'unknown');
 assert.equal(parseOffloadLog('offloaded 49/49 layers to GPU\nCUDA_Host model buffer size = 6000 MiB').status,'unknown');
 assert.equal(parseOffloadLog('offloaded 49/0 layers to GPU').status,'unknown');
});
async function fixture(){
 await mkdir(path.join(root,'.state'),{recursive:true});const directory=await mkdtemp(path.join(root,'.state/offload-test-'));const modelFile=path.join(directory,'model.gguf');await writeFile(modelFile,'fixture');const modelStat=await stat(modelFile);
 const config={ModelId:'fixture',ModelFile:modelFile,GpuLayers:999,ContextSize:32768,Port:48763};const logPath=path.join(directory,'server.log');await writeFile(logPath,log());
 const record={schemaVersion:1,pid:12345,modelId:'fixture',modelFile,requestedGpuLayers:999,contextSize:32768,modelStat:{size:modelStat.size,mtimeMs:modelStat.mtimeMs},logPath,logStart:0,startedAt:new Date().toISOString()};return {directory,config,record};
}
test('log offsets isolate launches and changed model files invalidate evidence',async()=>{
 const {config,record}=await fixture();const older='load_model: loading model \'unrelated.gguf\'\n'+log(0);await writeFile(record.logPath,older+log());record.logStart=Buffer.byteLength(older);
 assert.equal((await inspectOffloadRecord(record,config)).offloaded,49);await writeFile(config.ModelFile,'changed-size');assert.equal((await inspectOffloadRecord(record,config)).status,'unknown');
});
test('a stale PID or another port owner cannot produce a live pass',async()=>{
 const {directory,config,record}=await fixture();await writeFile(path.join(directory,'active.json'),JSON.stringify(record));await writeFile(path.join(directory,'last.json'),JSON.stringify(record));
 const prior=await discoverOffload(config,{stateDirectory:directory,endpointMatches:true,alive:()=>true,portOwner:async()=>99999});assert.equal(prior.status,'unknown');assert.equal(prior.scope,'historical');assert.equal(prior.live,false);
 const live=await discoverOffload(config,{stateDirectory:directory,endpointMatches:true,alive:()=>true,portOwner:async()=>12345});assert.equal(live.status,'pass');assert.equal(live.scope,'live');
 const dead=await discoverOffload(config,{stateDirectory:directory,endpointMatches:true,alive:()=>false,portOwner:async()=>12345});assert.equal(dead.scope,'historical');
});
test('wrong model and context cannot inherit a live result',async()=>{
 const {directory,config,record}=await fixture();await writeFile(path.join(directory,'active.json'),JSON.stringify(record));
 const r=await discoverOffload({...config,ContextSize:204800},{stateDirectory:directory,endpointMatches:true,alive:()=>true,portOwner:async()=>12345});assert.equal(r.status,'unknown');
});
