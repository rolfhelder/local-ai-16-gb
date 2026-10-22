import os from 'node:os';
import {publicDiagnostics} from './doctor.mjs';
export function failureClass(error=''){
 if(/checksum|hash mismatch/i.test(error))return 'integrity';
 if(/alloc|out of memory|cuda.*memory/i.test(error))return 'allocation';
 if(/timeout|timed out|within \d+|settle/i.test(error))return 'timeout';
 if(/parse|protocol|tool.*invalid/i.test(error))return 'provider-protocol';
 return error?'other':null;
}
export function makeReceipt({config,argv,modelHash=null,passed,error=null,timings=null,peakVramMiB=null,baselineVramMiB=null,promptTokens=null,versions={},hardware={}}){
 const receipt={schemaVersion:1,created:new Date().toISOString(),model:{id:config.ModelId,sha256:modelHash},runtime:{executable:config.LlamaExecutable,argv,versions},hardware:{platform:process.platform,architecture:process.arch,ramBytes:os.totalmem(),...hardware},settings:{context:config.ContextSize,slots:1,thinkingBudget:config.ReasoningBudget??2048,outputCap:config.MaxTokens??8192},measurements:{promptTokens,peakVramMiB,baselineVramMiB,timings},outcome:{passed:passed===true,failureClass:passed?null:failureClass(error??'unspecified failure'),error}};
 validateReceipt(receipt);return receipt;
}
export function validateReceipt(r){if(r.schemaVersion!==1||!Array.isArray(r.runtime?.argv)||typeof r.outcome?.passed!=='boolean')throw Error('Invalid receipt schema');for(const key of ['promptTokens','peakVramMiB','baselineVramMiB']){const value=r.measurements[key];if(value!==null&&(!Number.isFinite(value)||value<0))throw Error('Invalid measurement '+key);}if(!r.outcome.passed&&!r.outcome.failureClass)throw Error('Missing failure classification');return true;}
export function publicReceipt(value){
 if(Array.isArray(value))return value.map(publicReceipt);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,/token$|password|authorization|api.?key|secret/i.test(key)?'<REDACTED>':publicReceipt(v)]));
 if(typeof value==='string'){if(/^(?:[A-Za-z]:[\\/]|\/[^/])/.test(value))return '<LOCAL_PATH>';return publicDiagnostics(value).replace(/Bearer\s+\S+/gi,'Bearer <REDACTED>').replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/gi,'https://<REDACTED>@');}return value;
}
