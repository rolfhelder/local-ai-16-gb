import path from 'node:path';
import {root} from './local-runtime.mjs';

const names={node:'Node executable',pi:'Pi CLI',llama:'llama.cpp executable',model:'Model file','node-version':'Node version','pi-version':'Pi version','llama-version':'llama.cpp version',gpu:'NVIDIA GPU',endpoint:'Local server','model-sha256':'Model checksum'};
const actions={node:'Run ./scripts/Install-Core.ps1 to install Node.',pi:'Restore the pinned dependencies with the core installer.',llama:'Check LlamaExecutable in machine.local.json or install the pinned runtime.',model:'Download the selected model; see docs/INSTALL.md section 2.1.','model-sha256':'The model did not match its pinned hash or could not be read. Preserve the file and inspect it before retrying.',endpoint:'Check the server model, context, slot count and configured endpoint before connecting Pi.'};
const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
export function memory(bytes){return Number.isFinite(bytes)&&bytes>=0?(bytes/1024**3).toFixed(1)+' GiB':'unknown';}
export function fileSize(bytes){
 if(!Number.isFinite(bytes)||bytes<0)return 'unknown size';
 if(bytes>=1e9)return (bytes/1e9).toFixed(2)+' GB';
 if(bytes>=1e6)return (bytes/1e6).toFixed(1)+' MB';
 if(bytes>=1e3)return (bytes/1e3).toFixed(1)+' KB';
 return number(bytes)+' B';
}
export function explainDoctor(report){
 const failures=report.checks.filter(c=>c.status==='fail');
 const unknown=report.checks.filter(c=>c.status==='unknown');
 const unverified=unknown.map(c=>c.id==='endpoint'?'No matching running server could be checked. This is normal before starting local-ai.':(names[c.id]??c.id)+': '+(c.reason??c.error??'not verified'));
 if(report.backend?.status==='unknown')unverified.push(report.backend.reason);
 if(report.disk?.status==='unknown')unverified.push('Free disk space could not be read: '+(report.disk.error??'unknown error'));
 return {failures,unverified,headline:failures.length?'Needs attention — '+failures.length+' failed '+(failures.length===1?'check':'checks'):unverified.length?'No failures found; some checks are still unverified.':'All checks passed.',nextSteps:[...new Set(failures.map(c=>actions[c.id]??'Inspect '+(names[c.id]??c.id)+': '+(c.error??c.reason??'failed')))]};
}
export function renderDoctor(report,{color=false,unicode=true,publicOutput=false}={}){
 const symbols=unicode?{pass:'✓',fail:'✗',unknown:'○',skip:'–'}:{pass:'[OK]',fail:'[FAIL]',unknown:'[?]',skip:'[-]'};
 const paint=(text,status)=>color?'\x1b['+({pass:32,fail:31,unknown:33,skip:90}[status]??0)+'m'+text+'\x1b[0m':text;
 const pathText=file=>{
  if(!publicOutput)return file;
  const relative=path.relative(root,file);
  if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))return './'+relative.replaceAll('\\','/');
  return path.basename(file)+' (external path hidden by --public)';
 };
 // Terminal control sequences from tool output must never become terminal actions.
 const safe=value=>String(value??'unknown').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g,'').replaceAll('\r','').replaceAll('\n',' ');
 const lines=[];
 const row=(status,label,detail)=>lines.push('  '+paint(symbols[status],status)+' '+label+(detail?'  '+safe(detail):''));
 const note=text=>lines.push('      '+safe(text));
 const byId=id=>report.checks.find(c=>c.id===id);
 lines.push(color?'\x1b[1;36mLOCAL AI · SETUP DOCTOR\x1b[0m':'LOCAL AI · SETUP DOCTOR',(unicode?'─':'-').repeat(54),'Read-only check · no model started','');
 lines.push('  Model    '+safe(report.model),'  Context  '+number(report.contextTokens)+' tokens','  Server   '+safe(report.endpoint),'');
 lines.push('TOOLS & MODEL');
 for(const id of ['node','pi','llama','model']){
  const item=byId(id);if(!item)continue;
  const version=byId(id==='llama'?'llama-version':id+'-version');
  const versionText=version?.id==='llama-version'?version.value?.split(/\r?\n/)[0].replace(/^version:\s*/,''):version?.value;
  row(item.status,names[id],item.status==='pass'?(id==='model'?fileSize(item.bytes):version?.status==='pass'?versionText:'present'):(item.error??'not a regular file'));
  if(item.path)note(pathText(item.path));
  if(item.status==='pass'&&version?.status==='unknown')row('unknown',names[version.id],version.error??'not verified');
 }
 const checksum=byId('model-sha256');
 if(checksum){row(checksum.status,'Model checksum',checksum.status==='pass'?'SHA-256 matches the pinned manifest':checksum.error??(checksum.expected?'SHA-256 does not match':'No pinned hash was found'));}
 else row('skip','Model checksum','not checked; add --verify-model to verify the full file');
 lines.push('','MEMORY & GPU');
 row('pass','System RAM',memory(report.ram.totalBytes)+' total · '+memory(report.ram.freeBytes)+' free');
 const gpu=byId('gpu');
 if(gpu?.status==='pass'){
  for(const line of gpu.value.split(/\r?\n/)){
   const fields=line.split(',').map(s=>s.trim()),total=Number(fields.at(-2)),free=Number(fields.at(-1));
   if(fields.length>=4&&fields.at(-2)!==''&&fields.at(-1)!==''&&Number.isFinite(total)&&Number.isFinite(free)){
    row('pass','GPU',fields.slice(0,-3).join(', '));note('VRAM '+memory(total*1024**2)+' total · '+memory(free*1024**2)+' free · driver '+fields.at(-3));
   }else row('unknown','GPU memory',line+' (unrecognized memory format)');
  }
 }else row('unknown','NVIDIA GPU',gpu?.error??'not queried');
 row(report.disk?.status==='unknown'?'unknown':'pass','Model-drive space',report.disk?.status==='unknown'?report.disk.error:memory(report.disk?.freeBytes)+' free');
 lines.push('','LIVE CHECKS');
 const endpoint=byId('endpoint');if(endpoint){row(endpoint.status,'Local server',endpoint.status==='pass'?'matching model · '+number(endpoint.effectiveContext)+' tokens · '+endpoint.slots+' slot(s)':endpoint.reason??endpoint.error??'not verified');if(endpoint.status==='unknown')note('Often expected: local-ai has not been started yet.');}
 row(report.backend?.status??'unknown','GPU offload',report.backend?.reason??'not verified');
 const explanation=explainDoctor(report);lines.push('','RESULT',paint('  '+explanation.headline,explanation.failures.length?'fail':explanation.unverified.length?'unknown':'pass'));
 if(explanation.failures.length){for(const failure of explanation.failures)note((names[failure.id]??failure.id)+': '+(failure.reason??failure.error??'failed'));}
 if(explanation.unverified.length){lines.push('','  Still unverified:');for(const item of explanation.unverified)lines.push('    '+symbols.unknown+' '+safe(item));}
 if(explanation.nextSteps.length){lines.push('','  Fix next:');for(const action of explanation.nextSteps)lines.push('    → '+safe(action));}
 if(!explanation.failures.length&&byId('endpoint')?.status==='unknown')lines.push('','  Next: run local-ai to start the selected model.');
 lines.push('  Full functional test: node scripts/acceptance.mjs --model '+safe((report.model??'gemma').replace(/-local$/,''))+' --run','  Units: GiB = 1024³ bytes (memory); GB = 1000³ bytes (files).');
 if(publicOutput)lines.push('  Privacy: --public shows project-relative paths and hides external folders.');
 const output=lines.join('\n')+'\n';
 return unicode?output:output.replaceAll('·','|').replaceAll('—','-').replaceAll('→','>').replaceAll('³','^3');
}
