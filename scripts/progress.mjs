import {open,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from './local-runtime.mjs';
import {consoleUI,number} from './console-ui.mjs';
import {activity} from './terminal-activity.mjs';
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
 const index=args.indexOf('--log');let file=index>=0?args[index+1]:null;
 if(index>=0){if(!file||file.startsWith('--'))throw Error('--log needs a path');args.splice(index,2);}
 if(args.some(a=>!['--follow','--json','--no-color','--ascii'].includes(a)))throw Error('local-ai progress [--log PATH] [--follow] [--json]');
 if(!file){for(const name of ['active.json','last.json']){try{const evidence=JSON.parse(await readFile(path.join(root,'.state/runtime-evidence',name),'utf8'));if(evidence.logPath){await stat(evidence.logPath);file=evidence.logPath;break;}}catch{}}file??=path.join(root,'.state/llama-server.log');}
 try{await stat(file);}catch{throw Error('No server log found. Start local-ai first, or use --log PATH.');}
 const ui=consoleUI(args),json=args.includes('--json');let follow=args.includes('--follow');
 if(!json){ui.title('SERVER PROGRESS',follow?'Read-only live observer / Ctrl+C returns to terminal':'Saved log / historical evidence');ui.row('Log',file);}
 const busy=!json&&follow?activity({color:process.stderr.isTTY&&!process.env.NO_COLOR&&!args.includes('--no-color'),ascii:args.includes('--ascii')}):null;
 const cancel=()=>{follow=false;busy?.stop();};if(follow)process.once('SIGINT',cancel);
 let offset=0,carry='',history=[],lastText='',lastChange=Date.now(),latest=progressState([]);
 try{do{
 const size=(await stat(file)).size;if(size<offset){offset=0;carry='';history=[];}
 const handle=await open(file,'r');try{const bytes=Buffer.alloc(Math.min(65536,size-offset));const read=await handle.read(bytes,0,bytes.length,offset);offset+=read.bytesRead;carry+=bytes.subarray(0,read.bytesRead).toString();const lines=carry.split('\n');carry=lines.pop();history.push(...lines);history=history.slice(-250);}finally{await handle.close();}
 const state=progressState(history);latest=state;const encoded=JSON.stringify(state);
 if(encoded!==lastText){lastChange=Date.now();lastText=encoded;if(json)console.log(encoded);}
 if(Date.now()-lastChange>30000&&state.phase==='prefill'){state.warning='No new parsed progress for 30s; slow/stalled/format drift unknown';if(json){console.log(JSON.stringify(state));lastChange=Date.now();}}
 busy?.update(state.warning??(state.phase+' · '+(state.tokens===null?'no token measurement':number(state.tokens)+' tokens')+(state.etaSeconds===null?'':' · ETA ~'+state.etaSeconds+'s')),state.phase==='prefill'?state.progress:null);
 if(offset<(await stat(file)).size)continue;if(!follow)break;await new Promise(resolve=>setTimeout(resolve,1000));
 }while(follow);}finally{busy?.stop();process.off('SIGINT',cancel);}
 if(!json){ui.row('Phase',latest.phase);ui.row('Processed tokens',number(latest.tokens));ui.row('Prefill (tokens/sec)',latest.prefillTps?.toFixed(1));ui.row('Approximate ETA',latest.etaSeconds===null?'not available':latest.etaSeconds+' seconds');if(latest.warning)ui.line('  '+latest.warning);ui.finish('Log evidence only; GPU utilization alone does not establish progress.');}
 if(latest.phase==='allocation-error')process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
