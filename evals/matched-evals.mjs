import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,nodeExe,exec} from '../scripts/local-runtime.mjs';
import {consoleUI,number} from '../scripts/console-ui.mjs';
import {activity} from '../scripts/terminal-activity.mjs';
import {codingCases} from './coding-cases.mjs';
export function matchedPlan(models=['gemma'],seeds=[101],cases=[codingCases[0].id]){
 if(!models.length||new Set(models).size!==models.length||!models.every(m=>['gemma','qwen','omnicoder','gpt-oss'].includes(m)))throw Error('Invalid model list');
 if(!seeds.length||new Set(seeds).size!==seeds.length||!seeds.every(s=>Number.isInteger(s)&&s>=0&&s<1000000000))throw Error('Invalid seeds');
 if(!cases.length||new Set(cases).size!==cases.length||!cases.every(id=>codingCases.some(c=>c.id===id)))throw Error('Invalid cases');
 return {mode:'plan',commonContext:131072,conditions:['clean','loaded'],cases:cases.length,caseIds:cases,trials:models.length*seeds.length*cases.length*2,models,seeds,commands:seeds.map(seed=>['evals/coding-context.mjs','--run','--models='+models.join(','),'--conditions=clean,loaded','--cases='+cases.join(','),'--context=131072','--repeat=1','--seed='+seed]),notes:['One model at a time via the existing shared lock','Repeated background variants, not deterministic model decoding seeds','No default promotion; controller completion is not a model-quality pass','No real-repository task has been added yet; this suite uses isolated repairs']};
}
export async function executePlan(plan,run,onUpdate=async()=>{}){
 const results=[];for(const argv of plan.commands){try{const scores=await run(argv);results.push({argv,status:'complete',...(scores??{})});}catch(e){results.push({argv,status:'controller-failed',error:e.message});await onUpdate(results);return {controllerCompleted:false,results,cancelled:plan.commands.length-results.length};}await onUpdate(results);}return {controllerCompleted:true,results,cancelled:0};
}
export function codingSummary(report){
 if(!Array.isArray(report.trials)||!Number.isInteger(report.plannedTrials)||report.plannedTrials<1)throw Error('Invalid coding report');
 const trials=report.trials.map(t=>({model:t.model,case:t.case,condition:t.condition,passed:t.passed===true,outcome:t.passed?'PASS':/settle|timeout|timed out/i.test(t.error??'')?'TIMEOUT':'FAIL',hiddenPassed:t.hidden?.passed??null,hiddenTotal:t.hidden?.total??null,durationMs:t.durationMs??null,tps:t.timings?.generationTpsMean??null,error:t.error??null}));
 return {qualityPassed:report.status==='complete'&&trials.length===report.plannedTrials&&trials.every(t=>t.passed),trials};
}
export function renderScores(ui,scores){
 ui.table(['Condition','Result','Hidden checks','Time (s)','Tokens/sec'],scores.trials.map(t=>[t.condition,t.outcome,t.hiddenTotal===null?'unknown':t.hiddenPassed+'/'+t.hiddenTotal,t.durationMs===null?'unknown':(t.durationMs/1000).toFixed(1),t.tps===null?'not measured':t.tps.toFixed(1)]));
 ui.status(scores.qualityPassed,scores.qualityPassed?'All coding trials passed':'Coding trial failed; correct code alone does not override a timeout.');
}
export async function main(args=process.argv.slice(2),{command=exec}={}){
 args=[...args];
 for(const key of ['--models','--seeds','--cases']){const i=args.indexOf(key);if(i>=0){if(!args[i+1]||args[i+1].startsWith('--'))throw Error(key+' needs a value');args.splice(i,2,key+'='+args[i+1]);}}
 const ui=consoleUI(args),json=args.includes('--json');
 const get=(name,fallback)=>{const p=args.find(a=>a.startsWith(name+'='));return p?p.slice(name.length+1):fallback;};
 if(args.some(a=>!['--run','--json','--no-color','--ascii'].includes(a)&&!a.startsWith('--models=')&&!a.startsWith('--seeds=')&&!a.startsWith('--cases=')))throw Error('pnpm eval:coding-check [--models NAME] [--seeds NUMBER] [--cases ID] [--run]');
 const plan=matchedPlan(get('--models','gemma').split(','),get('--seeds','101').split(',').map(Number),get('--cases',codingCases[0].id).split(','));if(!json){ui.title('DEVELOPMENT CODING CHECK',args.includes('--run')?'Explicit run / one model at a time':'Preview only / no inference');ui.table(['Model','Context (tokens)','Cases','Trials'],plan.models.map(model=>[model,number(plan.commonContext),plan.cases,plan.seeds.length*plan.cases*2]));ui.row('Total trials',plan.trials);ui.row('Conditions',plan.conditions.join(', '));ui.line('  Background variants: '+plan.seeds.join(', '));ui.line('  Clean and 100k unrelated-background repairs; controller completion is not a quality pass.');}
 if(!args.includes('--run')){if(json)console.log(JSON.stringify(plan,null,2));else ui.finish('Run when ready: pnpm eval:coding-check --run');return;}
 const gitArgs=['-c','safe.directory='+root.replaceAll('\\','/')];const git=async argv=>(await command('git',[...gitArgs,...argv],{cwd:root})).stdout.trim();if(await git(['status','--porcelain','--untracked-files=no']))throw Error('Freeze/commit tracked changes before a matched batch');
 const base=path.join(root,'.state/matched',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(base,{recursive:true});const receipt={...plan,mode:'running',baseCommit:await git(['rev-parse','HEAD']),nodeVersion:process.version,started:new Date().toISOString()};
 const save=async results=>writeFile(path.join(base,'batch.json'),JSON.stringify({...receipt,results},null,2)+'\n');await save([]);
 let index=0;const result=await executePlan(plan,async argv=>{
  const seed=plan.seeds[index];const started=Date.now();const busy=json?null:activity({color:process.stderr.isTTY&&!process.env.NO_COLOR&&!args.includes('--no-color'),ascii:args.includes('--ascii')});
  busy?.update('Variant '+(index+1)+'/'+plan.seeds.length+' · background '+seed+' · starting');
  let sampling=false;
  const timer=setInterval(async()=>{if(sampling||!busy)return;sampling=true;try{
   const directory=path.join(root,'.state/evals');const names=(await readdir(directory)).filter(n=>n.startsWith('coding-context-')&&Number(n.slice(15))>=started).sort().reverse();
   if(names[0]){const state=JSON.parse(await readFile(path.join(directory,names[0],'report.json'),'utf8'));const complete=state.trials.filter(t=>t.stage==='complete').length;const latest=state.trials.at(-1);busy.update('Variant '+(index+1)+'/'+plan.seeds.length+' · '+complete+'/'+state.plannedTrials+' trials · '+(latest?.model??'loading'),complete/state.plannedTrials);}
  }catch{}finally{sampling=false;}},1000);
  try{
   const r=await command(nodeExe,argv,{cwd:root,maxBuffer:32*1024*1024,windowsHide:true});await writeFile(path.join(base,'seed-'+seed+'.stdout.txt'),r.stdout);
   const resultPath=r.stdout.split(/\r?\n/).find(line=>line.startsWith('Private report: '))?.slice(16).trim();if(!resultPath)throw Error('Child did not identify its saved report');
   const relative=path.relative(path.join(root,'.state/evals'),path.resolve(resultPath));if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Child report is outside evaluation artifacts');
   const scores=codingSummary(JSON.parse(await readFile(path.join(resultPath,'report.json'),'utf8')));index++;return scores;
  }
  finally{clearInterval(timer);busy?.stop();}
 },async results=>{await save(results);if(!json){const last=results.at(-1);ui.section('BACKGROUND '+plan.seeds[results.length-1]);if(last.trials)renderScores(ui,last);else ui.status(false,'Controller failed');if(last.error){ui.line('  '+last.error.split('\n')[0].slice(0,180));ui.line('  Full diagnostic retained in the batch report.');}}});
 const qualityPassed=result.controllerCompleted&&result.results.every(r=>r.qualityPassed===true);
 receipt.mode='finished';receipt.finished=new Date().toISOString();await writeFile(path.join(base,'batch.json'),JSON.stringify({...receipt,...result,qualityPassed},null,2)+'\n');if(json)console.log(JSON.stringify({directory:base,...result,qualityPassed},null,2));else {ui.row('Saved batch',base);ui.row('Cancelled variants',result.cancelled);ui.finish(!result.controllerCompleted?'Controller failed; later variants skipped. Completed results retained.':qualityPassed?'All coding trials passed.':'Coding check failed; see per-trial results above.');}if(!qualityPassed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
