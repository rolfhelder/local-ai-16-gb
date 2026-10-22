import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {root,acquireInferenceLock,ensureServer} from './local-runtime.mjs';
import {inspectOffloadRecord} from './gpu-offload.mjs';

export async function runGpuProbe(config){
 const probe={...config,ContextSize:Math.min(config.ContextSize,32768),ExtraServerArgs:[...(config.ExtraServerArgs??[]),'--log-verbosity','4']};
 const directory=path.join(root,'.state/gpu-probes',new Date().toISOString().replace(/[:.]/g,'-'));
 await mkdir(directory,{recursive:true});probe.LogPath=path.join(directory,'server.log');
 const release=await acquireInferenceLock();let server;
 try{
  server=await ensureServer(probe);
  const result=await inspectOffloadRecord(server.evidence,probe,{scope:'probe'});
  return {...result,scope:'probe',contextSize:probe.ContextSize,verifiedAt:server.evidence.startedAt,live:false,endpointVerified:true,reason:result.reason+' · temporary probe; server stopped afterwards'};
 }finally{try{await server?.stop();}finally{await release();}}
}
