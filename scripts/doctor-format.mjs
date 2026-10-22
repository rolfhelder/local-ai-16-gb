import path from 'node:path';
import {root} from './local-runtime.mjs';

const names={node:'Node executable',pi:'Pi CLI',llama:'llama.cpp',model:'Model file','node-version':'Node version','pi-version':'Pi version','llama-version':'llama.cpp version',gpu:'NVIDIA GPU',endpoint:'Local server','model-sha256':'Model checksum','gpu-offload':'GPU offload'};
const actions={node:'Run ./scripts/Install-Core.ps1 to install Node.',pi:'Restore the pinned dependencies with the core installer.',llama:'Check LlamaExecutable in machine.local.json.',model:'Download the selected model; see docs/INSTALL.md section 2.1.','model-sha256':'The model could not be read or its pinned hash differs. Preserve the file and inspect it.',endpoint:'Check the server model, context, slot count and configured endpoint.','gpu-offload':'Inspect the recorded allocation log and selected runtime; do not infer GPU use from VRAM alone.'};
const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
export function memory(bytes){return Number.isFinite(bytes)&&bytes>=0?(bytes/1e9).toFixed(1)+' GB':'unknown';}
export function fileSize(bytes){
 if(!Number.isFinite(bytes)||bytes<0)return 'unknown size';
 if(bytes>=1e9)return (bytes/1e9).toFixed(2)+' GB';
 if(bytes>=1e6)return (bytes/1e6).toFixed(1)+' MB';
 if(bytes>=1e3)return (bytes/1e3).toFixed(1)+' KB';
 return number(bytes)+' B';
}
export function explainDoctor(report){
 const failures=report.checks.filter(c=>c.status==='fail');
 if(report.backend?.status==='fail')failures.push({id:'gpu-offload',status:'fail',reason:report.backend.reason});
 const unverified=report.checks.filter(c=>c.status==='unknown').map(c=>c.id==='endpoint'?'No matching running server could be checked. This is normal before starting local-ai.':(names[c.id]??c.id)+': '+(c.reason??c.error??'not verified'));
 if(report.backend?.status==='unknown')unverified.push(report.backend.reason);
 if(report.disk?.status==='unknown')unverified.push('Free disk space could not be read: '+(report.disk.error??'unknown error'));
 return {failures,unverified,headline:failures.length?'Needs attention — '+failures.length+' failed '+(failures.length===1?'check':'checks'):unverified.length?'No failures found; some checks are still unverified.':'All checks passed.',nextSteps:[...new Set(failures.map(c=>actions[c.id]??'Inspect '+(names[c.id]??c.id)+': '+(c.error??c.reason??'failed')))]};
}
export function renderDoctor(report,{color=false,unicode=true,publicOutput=false,width=process.stdout.columns??88}={}){
 width=Math.max(52,Math.min(width,108));
 const symbols=unicode?{pass:'✓',fail:'✗',unknown:'○',skip:'·'}:{pass:'[OK]',fail:'[FAIL]',unknown:'[?]',skip:'[-]'};
 // Mint/cyan/slate palette. Yellow is deliberately absent.
 const codes={pass:'32',fail:'31',unknown:'36',skip:'90',accent:'38;5;80',muted:'90',title:'1;38;5;159'};
 const paint=(text,style)=>color?'\x1b['+(codes[style]??0)+'m'+text+'\x1b[0m':text;
 const safe=value=>String(value??'unknown').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g,'').replaceAll('\r','').replaceAll('\n',' ');
 const wrap=(value,limit)=>{let text=safe(value),out=[];while(text.length>limit){let at=text.lastIndexOf(' ',limit);if(at<limit*.4)at=Math.max(text.lastIndexOf('\\',limit),text.lastIndexOf('/',limit));if(at<limit*.4)at=limit;out.push(text.slice(0,at));text=text.slice(at).replace(/^ /,'');}out.push(text);return out;};
 const lines=[];
 const note=(text,indent=6)=>{for(const line of wrap(text,width-indent))lines.push(' '.repeat(indent)+paint(line,'muted'));};
 const row=(status,label,detail)=>{const mark=symbols[status].padEnd(unicode?1:6),prefix='  '+mark+' '+label.padEnd(17)+' ';const chunks=wrap(detail??'',Math.max(15,width-prefix.length));lines.push('  '+paint(mark,status)+' '+label.padEnd(17)+' '+chunks[0]);for(const line of chunks.slice(1))lines.push(' '.repeat(prefix.length)+line);};
 const box=(title,body,style='accent')=>{const edge=unicode?{tl:'╭',tr:'╮',bl:'╰',br:'╯',h:'─',v:'│'}:{tl:'+',tr:'+',bl:'+',br:'+',h:'-',v:'|'};lines.push(paint(edge.tl+edge.h+' '+title+' '+edge.h.repeat(Math.max(0,width-title.length-5))+edge.tr,style));for(const text of body)for(const line of wrap(text,width-4))lines.push(paint(edge.v,style)+' '+line.padEnd(width-4)+' '+paint(edge.v,style));lines.push(paint(edge.bl+edge.h.repeat(width-2)+edge.br,style));};
 const section=(n,title)=>{lines.push('','  '+paint(n+'  '+title,'title'));lines.push('  '+paint((unicode?'─':'-').repeat(width-4),'muted'));};
 const pathText=file=>{const relative=path.relative(root,file);if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))return './'+relative.replaceAll('\\','/');return publicOutput?path.basename(file)+' (external path hidden by --public)':file;};
 const byId=id=>report.checks.find(c=>c.id===id);
 const bar=(used,total)=>{if(!Number.isFinite(used)||!Number.isFinite(total)||total<=0)return '';const fraction=Math.min(1,Math.max(0,used/total)),filled=Math.round(fraction*12);return (unicode?'█':'#').repeat(filled)+(unicode?'░':'-').repeat(12-filled)+' '+Math.round(fraction*100)+'% used';};
 box('LOCAL AI / DOCTOR',[report.model+'   ·   '+number(report.contextTokens)+' tokens',report.endpoint+'   ·   '+(report.platform??process.platform)+' / '+(report.architecture??process.arch)],'accent');
 note(report.mode?.includes('probe')?(report.backend?.scope==='probe'?'Temporary GPU probe completed · no text generation':'GPU probe could not complete; see the result below'):'Read-only inspection · no model started',2);
 section('01','RUNTIME');
 for(const id of ['node','pi','llama','model']){
  const item=byId(id);if(!item)continue;const version=byId(id==='llama'?'llama-version':id+'-version');
  const versionText=version?.id==='llama-version'?version.value?.split(/\r?\n/)[0].replace(/^version:\s*/,''):version?.value;
  row(item.status,names[id],item.status==='pass'?(id==='model'?fileSize(item.bytes):version?.status==='pass'?versionText:'present'):(item.error??'not a regular file'));
  if(item.path)note(pathText(item.path));if(item.status==='pass'&&version?.status==='unknown')row('unknown',names[version.id],version.error??'not verified');
 }
 const checksum=byId('model-sha256');if(checksum)row(checksum.status,'Model checksum',checksum.status==='pass'?'SHA-256 verified':checksum.error??(checksum.expected?'Pinned hash differs':'No pinned hash found'));else row('skip','Model checksum','optional · add --verify-model');
 section('02','HARDWARE');
 row('pass','System RAM',memory(report.ram.totalBytes)+' total · '+memory(report.ram.freeBytes)+' free');note(bar(report.ram.totalBytes-report.ram.freeBytes,report.ram.totalBytes));
 const gpu=byId('gpu');
 if(gpu?.status==='pass')for(const line of gpu.value.split(/\r?\n/)){
  const fields=line.split(',').map(s=>s.trim()),total=Number(fields.at(-2)),free=Number(fields.at(-1));
  if(fields.length>=4&&fields.at(-2)!==''&&fields.at(-1)!==''&&Number.isFinite(total)&&Number.isFinite(free)){
   row('pass','GPU',fields.slice(0,-3).join(', '));row('pass','VRAM',memory(total*1024**2)+' total · '+memory(free*1024**2)+' free');note(bar((total-free)*1024**2,total*1024**2)+' · driver '+fields.at(-3));
  }else row('unknown','GPU memory',line+' (unrecognized format)');
 }else row('unknown','NVIDIA GPU',gpu?.error??'not queried');
 row(report.disk?.status==='unknown'?'unknown':'pass','Model-drive space',report.disk?.status==='unknown'?report.disk.error:memory(report.disk?.freeBytes)+' free');
 section('03','MODEL PLACEMENT');
 const endpoint=byId('endpoint');if(endpoint)row(endpoint.status,'Local server',endpoint.status==='pass'?(endpoint.scope==='probe'?'Probe verified · '+number(endpoint.effectiveContext)+' tokens · now stopped':'Connected · '+number(endpoint.effectiveContext)+' tokens · '+endpoint.slots+' slot(s)'):endpoint.status==='unknown'?'Offline or unreachable · normal before launch':endpoint.reason??endpoint.error);
 const backend=report.backend??{status:'unknown',reason:'Not checked'};
 row(backend.status,'GPU offload',backend.total!==undefined?backend.offloaded+'/'+backend.total+' layers · '+(backend.devices?.join(', ')||'CPU')+' · '+(backend.scope==='live'?'live':backend.scope==='probe'?'verified probe':'last load, not live'):backend.reason);
 if(backend.total!==undefined){
  const gpuWeights=(backend.buffers??[]).filter(b=>b.onGpu&&b.kind==='model').reduce((n,b)=>n+b.bytes,0),gpuKV=(backend.buffers??[]).filter(b=>b.onGpu&&b.kind==='kv').reduce((n,b)=>n+b.bytes,0),cpuWeights=(backend.buffers??[]).filter(b=>!b.onGpu&&b.kind==='model').reduce((n,b)=>n+b.bytes,0);
  note('GPU weights '+memory(gpuWeights)+' · CPU/host weights '+memory(cpuWeights));if((backend.buffers??[]).some(b=>b.kind==='kv'))note('GPU KV cache '+memory(gpuKV));
  note('Checked at '+number(backend.contextSize)+' tokens · '+(backend.verifiedAt?new Date(backend.verifiedAt).toLocaleString('en-GB',{hour12:false}):'time unavailable'));
 }
 const explanation=explainDoctor(report),passed=report.checks.filter(c=>c.status==='pass').length+(backend.status==='pass'?1:0);
 lines.push('');box(explanation.failures.length?'NEEDS ATTENTION':explanation.unverified.length?'CHECKS PENDING':'READY',[passed+' passed · '+explanation.failures.length+' failed · '+explanation.unverified.length+' not verified',...explanation.failures.map(c=>(names[c.id]??c.id)+': '+(c.reason??c.error??'failed')),...explanation.unverified],explanation.failures.length?'fail':explanation.unverified.length?'accent':'pass');
 lines.push('');for(const action of explanation.nextSteps)note('Fix › '+action,2);
 if(!explanation.failures.length){if(backend.status==='unknown')note('Next › local-ai doctor --check-gpu',2);else if(endpoint?.status==='unknown'||endpoint?.scope==='probe')note('Next › local-ai',2);}
 if(publicOutput)note('Public view · personal folders hidden',2);
 const output=lines.join('\n')+'\n';
 return unicode?output:output.replaceAll('·','|').replaceAll('—','-').replaceAll('›','>').replaceAll('→','>');
}
