import { readdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from '../scripts/local-runtime.mjs';
const folders=(await readdir(path.join(root,'.state/evals'),{withFileTypes:true})).filter(entry=>entry.isDirectory()&&entry.name.startsWith('coding-')).map(entry=>entry.name).sort();
const reports=[];
const clean=value=>typeof value==='string'?value.replaceAll(root,'<repo>').replaceAll(root.replaceAll('\\','/'),'<repo>'):Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clean(item)])):value;
for(const folder of folders) reports.push({run:folder,cases:clean(JSON.parse(await readFile(path.join(root,'.state/evals',folder,'report.json'),'utf8')))});
await writeFile(path.join(root,'evaluation/CODING-2026-10-21.json'),JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports.map(report=>({run:report.run,cases:report.cases.map(entry=>({model:entry.name,actualTestPassed:entry.actualTestPassed,testFilePreserved:entry.testFilePreserved,initialFailureObserved:entry.initialFailureObserved,generationTpsMean:entry.timings.generationTpsMean,generationTpsWeighted:entry.timings.generationTpsWeighted,responses:entry.timings.generation.length}))})),null,2));
