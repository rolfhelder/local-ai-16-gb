import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from '../scripts/local-runtime.mjs';
const file=path.join(root,'.state/effort-suite.json'),suite=JSON.parse(await readFile(file,'utf8'));
const pointer=JSON.parse(await readFile(path.join(root,'.state/effort-task-current.json'),'utf8')),run=JSON.parse(await readFile(path.join(pointer.artifactDir,'run.json'),'utf8'));
const exists=async name=>{try{await readFile(path.join(run.artifactDir,name));return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
suite.runs[run.generationModel]={...suite.runs[run.generationModel],artifactDir:run.artifactDir,status:await exists('followup-sent.json')?'followup-running':await exists('first-sent.json')?'first-running':'prepared'};
for(const model of suite.order){try{const r=JSON.parse(await readFile(path.join(root,`evaluation/EFFORT-${model.toUpperCase()}-2026-10-21.json`),'utf8'));suite.runs[model]={...suite.runs[model],status:'complete',round1Score:r.score.round1Score,round2Score:r.score.round2Score};}catch(e){if(e.code!=='ENOENT')throw e;}}
suite.status=suite.order.every(model=>suite.runs[model].status==='complete')?'complete':'running';
await writeFile(file,JSON.stringify(suite,null,2)+'\n');console.log(JSON.stringify(suite.runs));
