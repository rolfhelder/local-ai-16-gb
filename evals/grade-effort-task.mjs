// Hidden behavioral grader. Generation runs in Pi App; grading uses isolated
// real Pi RPC processes and scripted provider responses, with no GPU requests.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import {root,nodeExe,piEntry,environment} from '../scripts/local-runtime.mjs';
const stage=process.argv[2]||'first';if(!['first','followup'].includes(stage))throw Error('Expected first or followup');
const pointer=JSON.parse(await readFile(path.join(root,'.state/effort-task-current.json'),'utf8')),run=JSON.parse(await readFile(path.join(pointer.artifactDir,'run.json'),'utf8'));
const base=path.join(run.artifactDir,'grade-'+stage);await mkdir(base,{recursive:true});
await cp(run.project,path.join(base,'project'),{recursive:true});await cp(path.join(run.agentDir,'extensions'),path.join(base,'extensions'),{recursive:true});
await cp(run.agentDir,path.join(base,'agent-snapshot'),{recursive:true,filter:source=>!source.split(path.sep).includes('sessions')});
const settingsBefore=await readFile(path.join(run.agentDir,'settings.json'),'utf8');
const requests=[];
const server=createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;const p=JSON.parse(raw);requests.push(p);res.writeHead(200,{'Content-Type':'text/event-stream'});const b={id:'grading',object:'chat.completion.chunk',created:1,model:p.model};for(const x of [{choices:[{index:0,delta:{role:'assistant',content:'OK'},finish_reason:null}]},{choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:1,total_tokens:11}}])res.write('data: '+JSON.stringify({...b,...x})+'\n\n');res.end('data: [DONE]\n\n');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function start(model,label){
 const dir=path.join(base,label);await mkdir(dir,{recursive:true});
 await cp(path.join(base,'agent-snapshot'),dir,{recursive:true});
 await writeFile(path.join(dir,'settings.json'),JSON.stringify({defaultThinkingLevel:'medium'}));
 await writeFile(path.join(dir,'models.json'),JSON.stringify({providers:{'local-llama':{baseUrl:`http://127.0.0.1:${server.address().port}/v1`,api:'openai-completions',apiKey:'local',models:['gemma','gpt-oss'].map(id=>({id:id+'-local',reasoning:true,input:['text'],contextWindow:32768,maxTokens:8192,cost:{input:0,output:0,cacheRead:0,cacheWrite:0},thinkingLevelMap:{off:id==='gpt-oss'?null:'off',minimal:null,low:'low',medium:'medium',high:'high',xhigh:null,max:null}}))}}}));
 const files=(await readdir(path.join(base,'extensions'))).filter(f=>/\.(?:ts|js|mjs)$/.test(f));
 const child=spawn(nodeExe,[piEntry,'--mode','rpc','--no-session','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files',...files.flatMap(f=>['--extension',path.join(dir,'extensions',f)]),'--provider','local-llama','--model',model+'-local','--thinking','medium'],{cwd:path.join(base,'project'),env:environment({PI_CODING_AGENT_DIR:dir,PI_LOCAL_THINKING_BUDGET:'2048',PI_LOCAL_OUTPUT_CAP:'8192',PI_EFFORT_PREFERENCES:path.join(dir,'preferences.json')}),windowsHide:true,stdio:['pipe','pipe','pipe']});
 const events=[],pending=new Map();let buffer='',stderr='',seq=0;
 child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',b=>{buffer+=b;let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const e=JSON.parse(line);events.push(e);if(e.type==='response')pending.get(e.id)?.(e);if(e.type==='extension_ui_request'&&['select','confirm','input','editor'].includes(e.method))child.stdin.write(JSON.stringify({type:'extension_ui_response',id:e.id,cancelled:true})+'\n');}catch{}}});
 const send=async(type,fields={})=>{const id='g'+(++seq);let timer;const promise=new Promise((resolve,reject)=>{pending.set(id,e=>{clearTimeout(timer);pending.delete(id);e.success===false?reject(Error(e.error)):resolve(e);});timer=setTimeout(()=>{pending.delete(id);reject(Error('RPC timeout '+type+' '+stderr.slice(-600)));},12000);});child.stdin.write(JSON.stringify({id,type,...fields})+'\n');return promise;};
 try{await send('get_state');}catch(e){await writeFile(path.join(base,label+'-rpc.json'),JSON.stringify({events,stderr},null,2));child.kill();throw e;}
 const act=async(text)=>{const requestStart=requests.length,eventStart=events.length;try{await send('prompt',{message:text});}catch(e){events.push({type:'grader-command-error',command:text,error:e.message});}await pause(450);return {state:(await send('get_state')).data,calls:requests.length-requestStart,events:events.slice(eventStart)};};
 const probe=async(text)=>{const n=requests.length,endings=events.filter(e=>e.type==='agent_end').length;await send('prompt',{message:text});const deadline=Date.now()+12000;while(events.filter(e=>e.type==='agent_end').length===endings){if(Date.now()>deadline)throw Error('Provider completion timeout');await pause(30);}return requests.slice(n).at(-1);};
 return {send,act,probe,events,dir,get stderr(){return stderr;},stop:async()=>{await writeFile(path.join(base,label+'-rpc.json'),JSON.stringify({events,stderr},null,2));child.kill();}};
}
const criteria=Object.fromEntries(JSON.parse(await readFile(path.join(root,'evals/tasks/create-effort-command.json'),'utf8')).acceptance.map(c=>[c.id,{pass:false,evidence:[]} ]));
const set=(key,pass,evidence)=>{criteria[key]={pass:Boolean(pass),evidence};};
let gemma,gpt,fresh;
try{
 gemma=await start('gemma','gemma');
 const commands=(await gemma.send('get_commands')).data.commands;const registered=commands.some(c=>c.name==='effort');set('registered',registered,commands.map(c=>c.name));
 if(registered){
  const levels={},payloads={};let noCalls=true;
  for(const level of ['high','low','medium']){const result=await gemma.act('/effort '+level);levels[level]=result.state.thinkingLevel;noCalls&&=result.calls===0;payloads[level]=await gemma.probe('Wire probe '+level);}
  set('arguments',levels.high==='high'&&levels.low==='low'&&payloads.high?.reasoning_budget_tokens!==payloads.low?.reasoning_budget_tokens,{levels,budgets:Object.fromEntries(Object.entries(payloads).map(([k,v])=>[k,v?.reasoning_budget_tokens]))});
  set('session-state',Object.entries(levels).every(([k,v])=>k===v),levels);
  set('provider-budget',['low','medium','high'].every(level=>payloads[level]?.reasoning_budget_tokens===({low:512,medium:2048,high:4096})[level]&&(payloads[level].max_tokens??payloads[level].max_completion_tokens)>=payloads[level].reasoning_budget_tokens+1024),Object.fromEntries(Object.entries(payloads).map(([k,p])=>[k,{budget:p?.reasoning_budget_tokens,cap:p?.max_tokens??p?.max_completion_tokens}])));
  const picker=await gemma.act('/effort');noCalls&&=picker.calls===0;const ui=picker.events.find(e=>e.method==='select');set('picker',ui&&/medium/i.test(ui.title||'')&&['low','medium','high'].every(l=>ui.options?.some(o=>o.toLowerCase().includes(l))),ui||picker.events.filter(e=>e.method==='notify'));
  set('no-llm-control-turn',noCalls,{noCalls});
  await gemma.send('set_thinking_level',{level:'high'});const sdk=await gemma.probe('Wire probe SDK switch');set('sdk-client',sdk?.reasoning_budget_tokens===4096,{budget:sdk?.reasoning_budget_tokens});
  const off=await gemma.act('/effort off'),offPayload=await gemma.probe('Wire probe off');
  const beforeInvalid=(await gemma.send('get_state')).data.thinkingLevel;const invalid1=await gemma.act('/effort banana'),invalid2=await gemma.act('/effort high extra');
  set('bad-input',invalid1.calls===0&&invalid2.calls===0&&invalid1.state.thinkingLevel===beforeInvalid&&invalid2.state.thinkingLevel===beforeInvalid&&[invalid1,invalid2].every(r=>r.events.some(e=>e.method==='notify')),{before:beforeInvalid,afterUnknown:invalid1.state.thinkingLevel,afterExtra:invalid2.state.thinkingLevel});
  await gemma.act('/effort high');const persisted=await readFile(path.join(gemma.dir,'settings.json'),'utf8');
  fresh=await start('gemma','fresh-session');const initial=(await fresh.send('get_state')).data.thinkingLevel;
  set('session-only',levels.high==='high'&&levels.low==='low'&&JSON.parse(persisted).defaultThinkingLevel==='medium'&&initial==='medium'&&(await readFile(path.join(run.agentDir,'settings.json'),'utf8'))===settingsBefore,{freshLevel:initial,defaultLevel:JSON.parse(persisted).defaultThinkingLevel,currentSessionActuallyChanged:levels.high==='high'&&levels.low==='low'});
  gpt=await start('gpt-oss','gpt-scripted');let native=true;const nativeEvidence={};
  for(const level of ['low','high']){await gpt.act('/effort '+level);const p=await gpt.probe('Native wire probe '+level);native&&=p?.reasoning_effort===level;nativeEvidence[level]={effort:p?.reasoning_effort,budget:p?.reasoning_budget_tokens};}
  const unsupported=await gpt.act('/effort off');
  set('off',off.state.thinkingLevel==='off'&&offPayload?.chat_template_kwargs?.enable_thinking===false&&offPayload?.reasoning_budget_tokens===0&&unsupported.state.thinkingLevel==='high'&&unsupported.calls===0,{gemma:{level:off.state.thinkingLevel,thinking:offPayload?.chat_template_kwargs?.enable_thinking,budget:offPayload?.reasoning_budget_tokens},gptAfterOff:unsupported.state.thinkingLevel});
  const source=await Promise.all((await readdir(path.join(base,'extensions'))).filter(f=>/\.(ts|js|mjs)$/.test(f)).map(f=>readFile(path.join(base,'extensions',f),'utf8')));
  set('native-effort',native&&/budget|preset/i.test(source.join('\n')),{...nativeEvidence,descriptionMentionsBudgetPresets:/budget|preset/i.test(source.join('\n'))});
  set('resource-isolation',levels.high==='high'&&levels.low==='low',{isolatedAgentDir:true,cwdDifferent:true,commandWorksFromDifferentCwd:levels.high==='high'&&levels.low==='low'});
 }
}catch(e){await writeFile(path.join(base,'grader-error.txt'),e.stack);console.error(e.stack);}
finally{for(const c of [gemma,gpt,fresh])await c?.stop();server.close();}
// Verification is judged from the actual generation transcript, not a claim
// inside an assistant answer. Runtime/process verification must be observable.
const sent=JSON.parse(await readFile(path.join(run.artifactDir,stage+'-sent.json'),'utf8'));const lines=(await readFile(sent.sessionFile,'utf8')).split('\n').filter(Boolean).map(x=>JSON.parse(x));
const current=lines.filter(e=>e.timestamp>=sent.started&&e.type==='message');
const toolCalls=current.filter(e=>e.message?.role==='assistant').flatMap(e=>(e.message.content||[]).filter(p=>p.type==='toolCall'));
const verificationCommands=toolCalls.filter(c=>['powershell','bash'].includes(c.name)&&/--mode[\s'"=]+rpc|createAgentSession|PiIntegrationTest|cli\.js.*\/effort/.test(String(c.arguments.command||'')));
const successfulVerification=verificationCommands.some(call=>current.some(e=>e.message?.role==='toolResult'&&e.message.toolCallId===call.id&&!e.message.isError&&!/TypeError|ReferenceError|SyntaxError/.test(JSON.stringify(e.message.content))));
set('verification',criteria.registered.pass&&successfulVerification,{runtimeVerificationAttemptObserved:verificationCommands.length>0,successfulRuntimeCheckObserved:successfulVerification,toolCallCount:toolCalls.length,manualReviewRequired:true});
const report={stage,criteria,passed:Object.values(criteria).filter(c=>c.pass).length,total:Object.keys(criteria).length,providerRequests:requests.length,gradingUsesScriptedProviders:true,generationModel:run.generationModel,appVersion:'0.7.6',context:run.context,scriptedGradingContext:32768};
await writeFile(path.join(run.artifactDir,stage+'-grade.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
