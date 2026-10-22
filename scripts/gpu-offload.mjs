import {readFile,open,stat} from 'node:fs/promises';
import path from 'node:path';

// Evidence is allocation output, never -ngl intent or adapter-wide VRAM usage.
export function parseOffloadLog(log,{requestedLayers}={}){
 const counts=[...log.matchAll(/offloaded\s+(\d+)\s*\/\s*(\d+)\s+layers to GPU/gi)].at(-1);
 const buffers=[];
 for(const match of log.matchAll(/\b((?:CUDA|Vulkan|ROCm|HIP)\d+(?:_Host)?|Metal|CPU(?:_Mapped)?)\s+(model|KV|compute) buffer size\s*=\s*([\d.]+)\s*(MiB|GiB|KiB|B)/gi)){
  const device=match[1],bytes=Math.round(Number(match[3])*({mib:1024**2,gib:1024**3,kib:1024,b:1}[match[4].toLowerCase()]??1));
  if(Number.isFinite(bytes))buffers.push({device,kind:match[2].toLowerCase(),bytes,onGpu:!/^(?:CPU)|_Host$/i.test(device)});
 }
 if(!counts)return {status:'unknown',reason:'The startup log contains no actual layer-offload summary.',buffers};
 const offloaded=Number(counts[1]),total=Number(counts[2]);
 if(total<=0||offloaded>total)return {status:'unknown',reason:'The runtime returned an invalid layer count.',buffers};
 const gpuModelBytes=buffers.filter(b=>b.onGpu&&b.kind==='model').reduce((n,b)=>n+b.bytes,0);
 const devices=[...new Set(buffers.filter(b=>b.onGpu).map(b=>b.device))];
 if(offloaded>0&&!gpuModelBytes)return {status:'unknown',reason:'GPU layers were reported but GPU weight allocation was not captured.',offloaded,total,buffers};
 const expected=Number.isFinite(requestedLayers)?Math.min(Math.max(0,requestedLayers),total):null;
 const status=expected!==null&&offloaded<expected?'fail':'pass';
 const placement=offloaded===0?'cpu':offloaded===total?'full':'partial';
 return {status,placement,offloaded,total,expected,devices,gpuModelBytes,buffers,reason:status==='fail'?`Only ${offloaded}/${total} layers were offloaded; ${expected} were requested.`:`${offloaded}/${total} layers on GPU · ${placement==='full'?'full offload':placement==='partial'?'partial offload':'CPU only'}`};
}

export function matchingRun(record,config){
 return record?.schemaVersion===1&&record.modelId===config.ModelId&&path.resolve(record.modelFile)===path.resolve(config.ModelFile)&&record.requestedGpuLayers===config.GpuLayers;
}
export async function inspectOffloadRecord(record,config,{scope='historical'}={}){
 if(!matchingRun(record,config))return {status:'unknown',reason:'No startup record matches this model and GPU-layer setting.'};
 try{
  const model=await stat(config.ModelFile);
  if(model.size!==record.modelStat?.size||model.mtimeMs!==record.modelStat?.mtimeMs)return {status:'unknown',reason:'The model file changed after this startup record was captured.'};
  const file=await open(record.logPath,'r');let text;
  try{const size=(await file.stat()).size;if(!Number.isSafeInteger(record.logStart)||record.logStart<0||record.logStart>size)throw Error('Invalid startup-log offset');const buffer=Buffer.alloc(Math.min(2*1024*1024,size-record.logStart));const result=await file.read(buffer,0,buffer.length,record.logStart);text=buffer.subarray(0,result.bytesRead).toString('utf8');}finally{await file.close();}
  // The first load only: ignore a later appended launch or unrelated model.
  const starts=[...text.matchAll(/load_model:\s+loading model\s+'([^'\r\n]+)'/g)];
  if(starts.length&&path.resolve(starts[0][1])!==path.resolve(config.ModelFile))return {status:'unknown',reason:'Startup log belongs to another model.'};
  if(starts.length>1)text=text.slice(0,starts[1].index);
  const result=parseOffloadLog(text,{requestedLayers:record.requestedGpuLayers});
  return {...result,scope,verifiedAt:record.startedAt,contextSize:record.contextSize,modelId:record.modelId,logPath:record.logPath,pid:record.pid,live:scope==='live'};
 }catch(error){return {status:'unknown',reason:'Startup evidence is unavailable: '+error.message};}
}

export async function discoverOffload(config,{stateDirectory,endpointMatches=false,portOwner=async()=>null,alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}}}){
 const read=async name=>{try{return JSON.parse(await readFile(path.join(stateDirectory,name),'utf8'));}catch{return null;}};
 const active=await read('active.json');
 if(matchingRun(active,config)&&active.contextSize===config.ContextSize&&endpointMatches&&alive(active.pid)){
  if(await portOwner(config.Port)===active.pid)return inspectOffloadRecord(active,config,{scope:'live'});
 }
 const previous=await read('last.json');
 if(previous&&matchingRun(previous,config)){
  const result=await inspectOffloadRecord(previous,config);
  if(result.total!==undefined)return {...result,status:'unknown',observedStatus:result.status,reason:`Last load: ${result.reason}. This is historical, not a live check.`};
 }
 return {status:'unknown',reason:'No verified live allocation log. Run local-ai doctor --check-gpu.'};
}
