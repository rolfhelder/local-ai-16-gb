import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,nodeExe,exec} from '../scripts/local-runtime.mjs';
export function matchedPlan(models=['gemma','qwen','omnicoder','gpt-oss'],seeds=[101,202,303]){
 if(!models.length||new Set(models).size!==models.length||!models.every(m=>['gemma','qwen','omnicoder','gpt-oss'].includes(m)))throw Error('Invalid model list');
 if(!seeds.length||new Set(seeds).size!==seeds.length||!seeds.every(s=>Number.isInteger(s)&&s>=0&&s<1000000000))throw Error('Invalid seeds');
 return {mode:'plan',commonContext:131072,conditions:['clean','loaded'],cases:3,trials:models.length*seeds.length*6,models,seeds,commands:seeds.map(seed=>['evals/coding-context.mjs','--run','--models='+models.join(','),'--conditions=clean,loaded','--context=131072','--repeat=1','--seed='+seed]),notes:['One model at a time via the existing shared lock','Repeated background variants, not deterministic model decoding seeds','No default promotion; controller completion is not a model-quality pass','No real-repository task has been added yet; this matrix repeats the existing three repairs']};
}
export async function executePlan(plan,run,onUpdate=async()=>{}){
 const results=[];for(const argv of plan.commands){try{await run(argv);results.push({argv,status:'complete'});}catch(e){results.push({argv,status:'controller-failed',error:e.message});await onUpdate(results);return {controllerCompleted:false,results,cancelled:plan.commands.length-results.length};}await onUpdate(results);}return {controllerCompleted:true,results,cancelled:0};
}
export async function main(args=process.argv.slice(2)){
 const get=(name,fallback)=>{const p=args.find(a=>a.startsWith(name+'='));return p?p.slice(name.length+1):fallback;};
 if(args.some(a=>a!=='--run'&&!a.startsWith('--models=')&&!a.startsWith('--seeds=')))throw Error('matched-evals [--models=gemma,qwen,omnicoder,gpt-oss] [--seeds=101,202,303] [--run]');
 const plan=matchedPlan(get('--models','gemma,qwen,omnicoder,gpt-oss').split(','),get('--seeds','101,202,303').split(',').map(Number));if(!args.includes('--run')){console.log(JSON.stringify(plan,null,2));return;}
 const gitArgs=['-c','safe.directory='+root.replaceAll('\\','/')];const git=async argv=>(await exec('git',[...gitArgs,...argv],{cwd:root})).stdout.trim();if(await git(['status','--porcelain','--untracked-files=no']))throw Error('Freeze/commit tracked changes before a matched batch');
 const base=path.join(root,'.state/matched',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(base,{recursive:true});const receipt={...plan,mode:'running',baseCommit:await git(['rev-parse','HEAD']),nodeVersion:process.version,started:new Date().toISOString()};
 const save=async results=>writeFile(path.join(base,'batch.json'),JSON.stringify({...receipt,results},null,2)+'\n');await save([]);
 let index=0;const result=await executePlan(plan,async argv=>{const r=await exec(nodeExe,argv,{cwd:root,maxBuffer:32*1024*1024,windowsHide:true});await writeFile(path.join(base,'seed-'+plan.seeds[index++]+'.stdout.txt'),r.stdout);},save);
 receipt.mode='finished';receipt.finished=new Date().toISOString();await writeFile(path.join(base,'batch.json'),JSON.stringify({...receipt,...result},null,2)+'\n');console.log(JSON.stringify({directory:base,...result},null,2));if(!result.controllerCompleted)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
