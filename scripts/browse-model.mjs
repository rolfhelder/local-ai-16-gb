import {spawn} from 'node:child_process';
import path from 'node:path';
import {root} from './local-runtime.mjs';

// Keep the modal GUI out of the menu host, with bounded lifetime and cancellation.
export async function runPicker(kind,{launch=spawn,timeoutMs=180000,signals=process}={}){
 if(!['folder','file','location'].includes(kind))throw Error('Choose folder or file.');
 const child=launch('powershell.exe',['-NoProfile','-STA','-File',path.join(root,'scripts/browse-model.ps1'),'-Kind',kind],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='',errors='';
 child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>errors+=data);
 return new Promise((resolve,reject)=>{
  let finished=false;
  const cleanup=()=>{clearTimeout(timer);signals.off('SIGINT',cancel);signals.off('SIGTERM',cancel);};
  const finish=(error,result)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(result);};
  const cancel=()=>{child.kill();finish(Error('Picker cancelled; configuration unchanged.'));};
  const timer=setTimeout(()=>{child.kill();finish(Error('Picker timed out after 3 minutes; configuration unchanged. Enter the path in machine.local.json instead.'));},timeoutMs);
  signals.on('SIGINT',cancel);signals.on('SIGTERM',cancel);
  child.once('error',error=>finish(error));
  child.once('close',code=>{
   if(finished)return;
   if(code!==0)return finish(Error('Picker failed: '+errors.trim()));
   try{const result=JSON.parse(output.replace(/^\uFEFF/,''));if(!result.cancelled&&(!result.path||!path.isAbsolute(result.path)))throw Error('Picker returned an invalid path.');finish(null,result);}catch(error){finish(error);}
  });
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.join(root,'scripts/browse-model.mjs')){
 try{console.log(JSON.stringify(await runPicker(process.argv[2])));}catch(error){console.error(error.message);process.exitCode=1;}
}
