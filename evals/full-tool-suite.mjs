// Run every implemented tool-conformance entry point, sequentially, preserving failures.
import {spawn} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root,nodeExe} from '../scripts/local-runtime.mjs';
const base=path.join(root,'.state/evals/full-tools-'+Date.now());await mkdir(base,{recursive:true});
const report={started:new Date().toISOString(),mode:'scripted harness conformance; no model-quality score',checks:[],notImplemented:['comparative live web-search grading','YouTube captions and external ASR eval','native GUI task eval','image grounding eval']};
const tests=['policy','context-status','recall-grader','timings','runtime','local-token-budget','effort','effort-score'].map(n=>'evals/'+n+'.test.mjs');
const jobs=[['unit',['--test',...tests]],...['run','hooks','guard-integration','lsp-freshness','browser','web-tools','worktrees','inventory','statusline-tui','effort-runtime','effort-tui'].map(n=>[n,['evals/'+n+'.mjs']])];
for(const [name,args] of jobs){
 const logfile=path.join(base,name+'.log'),fd=openSync(logfile,'a'),started=new Date().toISOString();
 const child=spawn(nodeExe,args,{cwd:root,env:process.env,windowsHide:true,stdio:['ignore',fd,fd]});closeSync(fd);
 const exitCode=await new Promise((resolve)=>{child.once('error',()=>resolve(-1));child.once('exit',resolve);});
 report.checks.push({name,started,finished:new Date().toISOString(),exitCode,logfile});await writeFile(path.join(base,'report.json'),JSON.stringify(report,null,2));
}
report.finished=new Date().toISOString();report.failed=report.checks.filter(c=>c.exitCode!==0).map(c=>c.name);await writeFile(path.join(base,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
