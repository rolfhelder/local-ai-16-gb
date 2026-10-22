import {readFile,writeFile,rename,open,unlink,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {root} from './local-runtime.mjs';
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
 const at=args.indexOf('--file');const file=path.resolve(at>=0?args[at+1]:'machine.local.json');if(at>=0)args.splice(at,2);if(args.some(x=>x!=='--apply'))throw Error('config-plan [--file PATH] [--apply]');
 const relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Configuration target must stay inside this checkout');
 const defaults=JSON.parse(await readFile(path.join(root,'config/machine.example.json'),'utf8'));console.log(JSON.stringify(await applyDefaults(file,defaults,{apply:args.includes('--apply')}),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
