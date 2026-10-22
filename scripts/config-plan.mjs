import {readFile,writeFile,rename,open,unlink,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {root} from './local-runtime.mjs';
import {consoleUI} from './console-ui.mjs';
export function mergeDefaults(existing,defaults){
 if(!existing||Array.isArray(existing)||typeof existing!=='object')throw Error('Configuration must be an object');
 const additions=Object.fromEntries(Object.entries(defaults).filter(([key])=>!Object.hasOwn(existing,key)));
 return {merged:{...additions,...existing},additions,preservedKeys:Object.keys(existing)};
}
export async function applyDefaults(file,defaults,{apply=false}={}){
 let original;try{original=await readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;original=null;}
 const plan=mergeDefaults(original===null?{}:JSON.parse(original.replace(/^\uFEFF/,'')),defaults);
 if(!apply||!Object.keys(plan.additions).length)return {...plan,changed:false,backup:null};
 await mkdir(path.dirname(file),{recursive:true});const lockPath=file+'.setup.lock';const lock=await open(lockPath,'wx');let temp;
 try{let now;try{now=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;now=null;}if(now!==original)throw Error('Configuration changed since preview; retry safely');
 const backup=original===null?null:file+'.backup-'+randomUUID();if(backup)await writeFile(backup,original,{flag:'wx'});
 temp=file+'.new-'+randomUUID();await writeFile(temp,JSON.stringify(plan.merged,null,2)+'\n',{flag:'wx'});await rename(temp,file);temp=null;return {...plan,changed:true,backup};
 }finally{if(temp)await unlink(temp).catch(()=>{});await lock.close();await unlink(lockPath);}
}
export async function main(args=process.argv.slice(2)){
 const demo=args.includes('--demo');
 if(args.includes('--demo')){if(args.includes('--file'))throw Error('Choose --demo or --file.');args=args.filter(a=>a!=='--demo');args.push('--file',path.join(root,'.state/demo-config/machine.json'));}
 const at=args.indexOf('--file');if(at>=0&&(!args[at+1]||args[at+1].startsWith('--')))throw Error('--file needs a path');const file=at>=0?path.resolve(args[at+1]):path.join(root,'machine.local.json');if(at>=0)args.splice(at,2);if(args.some(x=>!['--apply','--json','--no-color','--ascii'].includes(x)))throw Error('local-ai config [--file PATH] [--apply] [--json]');
 const relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Configuration target must stay inside this checkout');
 const defaults=JSON.parse(await readFile(path.join(root,'config/machine.example.json'),'utf8'));const plan=await applyDefaults(file,defaults,{apply:args.includes('--apply')});
 if(args.includes('--json')){console.log(JSON.stringify(plan,null,2));return;}
 const ui=consoleUI(args);ui.title('CONFIGURATION',args.includes('--apply')?'Explicit apply / existing values preserved':'Read-only preview / nothing written');ui.row('Target',file);ui.row('Existing keys preserved',plan.preservedKeys.length);ui.row('Missing keys',Object.keys(plan.additions).length);
 if(Object.keys(plan.additions).length){ui.section('PROPOSED DEFAULTS');for(const [key,v] of Object.entries(plan.additions))ui.row(key,['ContextSize','ReasoningBudget','MaxTokens'].includes(key)?Number(v).toLocaleString('en-US')+' tokens':typeof v==='object'?JSON.stringify(v):v);ui.line('  Example paths are placeholders: set real local paths before running a model.');}
 if(plan.backup)ui.row('Backup',plan.backup);
 const applyCommand=demo?'local-ai config --demo --apply':file===path.join(root,'machine.local.json')?'local-ai config --apply':`local-ai config --file "${file}" --apply`;
 ui.finish(plan.changed?'Defaults added; existing settings preserved.':Object.keys(plan.additions).length?'Review additions; use '+applyCommand+' to write.':'Configuration already contains all default keys.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
