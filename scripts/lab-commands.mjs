import {readFile,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {machine,root} from './local-runtime.mjs';
import {resourceProfiles,applyResourceProfile,effectiveResources} from './resource-profiles.mjs';
import {consoleUI,number} from './console-ui.mjs';
export const labCommands=['presets','progress','receipts','config','eval'];
export const commandHelp={presets:'local-ai presets [--model NAME] [--json]',progress:'local-ai progress [--follow] [--log PATH] [--json]',receipts:'local-ai receipts [--list] [--file PATH] [--public] [--json]',config:'local-ai config [--demo] [--file PATH] [--apply] [--json]',eval:'local-ai eval [--models gemma,qwen] [--seeds 101,202] [--run] [--json]'};
export function help(args=[]){const ui=consoleUI(args);ui.title('COMMANDS','One local model / human-readable reports by default');ui.table(['Command','Purpose'],[['local-ai','Start Pi and llama.cpp'],['local-ai install','Installation and first-run menu'],['local-ai doctor','Hardware, model and runtime health'],['local-ai test --run','Answer and coding acceptance'],['local-ai presets','Compare resource settings'],['local-ai progress','Latest log; --follow to watch'],['local-ai receipts','Latest result; --list for history'],['local-ai config','Missing settings; --demo for safe trial'],['local-ai eval','Matched matrix; --run starts inference']]);ui.finish('Use a subcommand with --help for options. Reports support --json, --no-color and --ascii.');}
export function value(args,key,fallback){const i=args.indexOf(key);if(i<0)return fallback;const v=args[i+1];if(!v||v.startsWith('--'))throw Error(key+' needs a value');args.splice(i,2);return v;}
export async function recentReceipts(){
 const base=path.join(root,'.state/acceptance');const entries=await readdir(base,{withFileTypes:true}).catch(()=>[]);const files=[];
 for(const entry of entries.filter(e=>e.isDirectory()).sort((a,b)=>b.name.localeCompare(a.name))){const file=path.join(base,entry.name,'receipt.private.json');if(await access(file).then(()=>true).catch(()=>false))files.push(file);}
 return files;
}
export async function main(command,args=[]){
 if(args.includes('--help')){const ui=consoleUI(args);ui.title(command.toUpperCase());ui.line('  '+commandHelp[command]);ui.finish('No operation performed. Add --json for structured reports.');return;}
 if(command==='progress')return (await import('./progress.mjs')).main(args);
 if(command==='config')return (await import('./config-plan.mjs')).main(args);
 if(command==='eval')return (await import('../evals/matched-evals.mjs')).main(args);
 const ui=consoleUI(args),json=args.includes('--json');
 if(command==='presets'){
  const model=value(args,'--model','gemma');if(args.some(a=>!['--json','--no-color','--ascii'].includes(a)))throw Error('local-ai presets [--model NAME] [--json]');
  const config=await machine(model);const rows=Object.keys(resourceProfiles).map(name=>({name,...effectiveResources(applyResourceProfile(config,name))}));
  if(json){console.log(JSON.stringify({model,presets:rows},null,2));return;}
  ui.title('RESOURCE PRESETS',model+' / preview only / no model loading');
  ui.table(['Preset','Context (tokens)','Thinking (tokens)','Output cap (tokens)'],rows.map(r=>[r.name,number(r.context),number(r.thinkingBudget),number(r.totalOutputCap)]));
  ui.section('SHARED SETTINGS');ui.row('KV cache',rows[0].kv);ui.row('Concurrent slots',1);ui.row('Reasoning',rows[0].reasoning?'on':'off');
  ui.line('  Context is capped by the model configuration; capacity is not a quality score.');
  ui.finish('Launch example: local-ai'+(model==='gemma'?'':' --model '+(model.includes(' ')?'"'+model+'"':model))+' --preset coding');return;
 }
 if(command==='receipts'){
  const chosen=value(args,'--file',null);if(args.some(a=>!['--json','--list','--public','--no-color','--ascii'].includes(a)))throw Error('local-ai receipts [--list] [--file PATH] [--public] [--json]');
  const files=chosen?[path.resolve(chosen)]:await recentReceipts();if(!files.length){ui.title('RUN RECEIPTS');ui.finish('No completed receipts yet. Run local-ai test --run first.');return;}
  const entries=[];for(const file of files.slice(0,args.includes('--list')?10:1))entries.push({file,receipt:JSON.parse(await readFile(file,'utf8'))});
  const safe=args.includes('--public');const redact=(await import('./run-receipt.mjs')).publicReceipt;
  if(json){const data=entries.map(e=>safe?redact(e.receipt):e.receipt);console.log(JSON.stringify(args.includes('--list')?data:data[0],null,2));return;}
  ui.title('RUN RECEIPTS',args.includes('--list')?'Most recent 10 saved runs':'Latest saved run / read-only');
  if(args.includes('--list'))ui.table(['Created','Model','Result','Context (tokens)'],entries.map(({receipt:r})=>[r.created,r.model?.id,r.outcome?.passed?'PASS':'FAIL',number(r.settings?.context)]));
  else {const r=safe?redact(entries[0].receipt):entries[0].receipt;
   ui.status(r.outcome.passed,r.outcome.passed?'Run passed':'Run failed: '+r.outcome.failureClass);ui.row('Model',r.model.id);ui.row('Created',r.created);ui.row('Context (tokens)',number(r.settings.context));ui.row('Thinking (tokens)',number(r.settings.thinkingBudget));ui.row('Generation (tokens/sec)',r.measurements.timings?.generationTpsMean?.toFixed(1));
   ui.row('Peak VRAM (GB)',r.measurements.peakVramMiB==null?'not measured':(r.measurements.peakVramMiB*1048576/1e9).toFixed(1));
   if(r.outcome.error)ui.row('Failure',r.outcome.error);ui.row('Receipt',safe?'local path hidden':entries[0].file);
  }
  ui.finish('Structured export: local-ai receipts --json --public');return;
 }
}
