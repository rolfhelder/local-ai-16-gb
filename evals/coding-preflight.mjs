import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,nodeExe,exec} from '../scripts/local-runtime.mjs';
import {codingCases,publicSource,hiddenSource} from './coding-cases.mjs';
const references={
 'csv-records':{'parser.cjs':`exports.parseCsv=text=>{if(text==='')return [];let rows=[],row=[],field='',quoted=false,ended=false;for(let i=0;i<text.length;i++){const c=text[i];ended=false;if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===','){row.push(field);field='';}else if(!quoted&&(c==='\\n'||c==='\\r')){if(c==='\\r'&&text[i+1]==='\\n')i++;row.push(field);rows.push(row);row=[];field='';ended=true;}else field+=c;}if(!ended){row.push(field);rows.push(row);}return rows;};`},
 'pagination-contract':{'pagination.cjs':`exports.paginate=(items,page=0,size=2)=>{if(!Number.isInteger(page)||page<0||!Number.isInteger(size)||size<1)throw new RangeError('Invalid pagination');return {items:items.slice(page*size,(page+1)*size),total:items.length,page,size,hasNext:(page+1)*size<items.length};};`,'service.cjs':`const {paginate}=require('./pagination.cjs');exports.listCatalog=(items,query={})=>paginate(items,query.page,query.size);`},
 'async-retry':{'retry.cjs':`exports.retry=async(operation,{maxAttempts=3,delayMs=0,sleep=async()=>{},shouldRetry=()=>true}={})=>{if(!Number.isInteger(maxAttempts)||maxAttempts<1)throw new RangeError('Invalid attempts');for(let attempt=1;attempt<=maxAttempts;attempt++){try{return await operation(attempt);}catch(error){const allowed=shouldRetry(error,attempt);if(!allowed||attempt===maxAttempts)throw error;await sleep(delayMs);}}};`},
};
const base=path.join(root,'.state/evals/coding-preflight-'+Date.now());await mkdir(base,{recursive:true});const results=[];
for(const task of codingCases){
 const cwd=path.join(base,task.id);await mkdir(cwd,{recursive:true});
 for(const [name,source]of Object.entries(task.files))await writeFile(path.join(cwd,name),source);
 await writeFile(path.join(cwd,'check.cjs'),publicSource(task));const grader=path.join(base,task.id+'-grader.cjs');await writeFile(grader,hiddenSource(task));
 const grade=async()=>JSON.parse((await exec(nodeExe,[grader,path.join(cwd,task.entry)],{cwd,windowsHide:true,timeout:10000})).stdout.trim());
 let faultyPublicPassed=true;try{await exec(nodeExe,['check.cjs'],{cwd,windowsHide:true,timeout:10000});}catch{faultyPublicPassed=false;}
 const faulty=await grade();assert.equal(faultyPublicPassed,false,task.id+' faulty fixture must fail public checks');assert.ok(faulty.passed<faulty.total,task.id+' faulty fixture must fail withheld checks');
 for(const [name,source]of Object.entries(references[task.id]))await writeFile(path.join(cwd,name),source);
 await exec(nodeExe,['check.cjs'],{cwd,windowsHide:true,timeout:10000});const repaired=await grade();assert.equal(repaired.passed,repaired.total,task.id+' reference must pass');
 results.push({case:task.id,faultyPublicPassed,faultyHidden:faulty,referencePublicPassed:true,referenceHidden:repaired});
}
await writeFile(path.join(base,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
