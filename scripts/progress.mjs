import {open,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function progressState(lines){
 let state={phase:'unknown',tokens:null,progress:null,prefillTps:null,etaSeconds:null,samples:0};let lastTask;
 for(const line of lines){
  if(/(?:out of memory|failed to allocate|CUDA error)/i.test(line)){state.phase='allocation-error';continue;}
  if(/load_model.*loading|load_tensors|loading model/.test(line))state.phase='loading';
  if(/model loaded|listening on/.test(line))state.phase='ready';
  if(/prompt done/.test(line))state.phase='generating';
  const m=/task\s+(\d+).*prompt processing, n_tokens\s*=\s*(\d+), progress\s*=\s*([\d.]+), t\s*=\s*([\d.]+) s \/\s*([\d.]+) tokens per second/.exec(line);
  if(m){if(lastTask!==m[1]||Number(m[2])<state.tokens){state.samples=0;}lastTask=m[1];state.samples++;state.phase='prefill';state.tokens=Number(m[2]);state.progress=Number(m[3]);state.prefillTps=Number(m[5]);state.etaSeconds=state.samples>=2&&state.progress>0&&state.progress<1&&state.prefillTps>0?Math.round((state.tokens/state.progress-state.tokens)/state.prefillTps):null;state.etaIsApproximate=true;}
  if(/(?<!prompt )eval time\s*=/.test(line))state.phase='generation-complete';
 }
 return state;
}
export async function main(args=process.argv.slice(2)){
 const index=args.indexOf('--log');const file=index>=0?args[index+1]:null;if(!file)throw Error('progress --log PATH [--follow]');args.splice(index,2);if(args.some(a=>a!=='--follow'))throw Error('Unknown progress option');
 let offset=0,carry='',history=[],lastText='',lastChange=Date.now();const follow=args.includes('--follow');
 do{const size=(await stat(file)).size;if(size<offset){offset=0;carry='';history=[];}const handle=await open(file,'r');try{const bytes=Buffer.alloc(Math.min(65536,size-offset));const read=await handle.read(bytes,0,bytes.length,offset);offset+=read.bytesRead;carry+=bytes.subarray(0,read.bytesRead).toString();const lines=carry.split('\n');carry=lines.pop();history.push(...lines);history=history.slice(-250);}finally{await handle.close();}
 const state=progressState(history);const encoded=JSON.stringify(state);if(encoded!==lastText){lastChange=Date.now();lastText=encoded;console.log(encoded);}else if(follow&&Date.now()-lastChange>30000&&state.phase==='prefill'){console.log(JSON.stringify({...state,warning:'No newly parsed progress for 30 seconds; slow/stalled/format drift unknown'}));lastChange=Date.now();}
 if(offset<(await stat(file)).size)continue;if(!follow)break;await new Promise(resolve=>setTimeout(resolve,1000));}while(true);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
