import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import {pathToFileURL} from 'node:url';
import {machine,localModels} from './local-runtime.mjs';

export async function installedModels(directory,registry=localModels){
 const directories=(Array.isArray(directory)?directory:[directory]).filter(Boolean).map(p=>path.resolve(p));
 const found=[];const seen=new Set();
 for(const directory of directories){
 for(const [name,entry] of Object.entries(registry)){
  const file=path.resolve(directory,entry.file);
  if(!seen.has(file.toLowerCase())&&await stat(file).then(s=>s.isFile()).catch(()=>false)){found.push({name,file,selection:directory===directories[0]?name:file});seen.add(file.toLowerCase());}
 }
 }
 async function walk(folder,depth=0){
  if(depth>8)return;
  for(const entry of await readdir(folder,{withFileTypes:true}).catch(()=>[])){
   const file=path.join(folder,entry.name);
   if(entry.isDirectory())await walk(file,depth+1);
   else if(entry.isFile()&&/\.gguf$/i.test(entry.name)&&!/^mmproj|projector/i.test(entry.name)&&!seen.has(file.toLowerCase())&&!/-\d{5}-of-\d{5}\.gguf$/i.test(entry.name)){found.push({name:entry.name,file,selection:file});seen.add(file.toLowerCase());}
  }
 }
 for(const folder of directories)await walk(folder);return found;
}
export async function chooseModel(explicit){
 if(explicit)return explicit;
 const config=await machine(null);const models=await installedModels([config.ModelsDirectory,...(config.ModelDirectories??[])]);
 if(models.length===1){console.error('Selected installed model: '+models[0].name);return models[0].selection;}
 if(!process.stdin.isTTY)throw Error('Select a model with --model NAME or --model "C:\\path\\model.gguf". No model was started.');
 const input=createInterface({input:process.stdin,output:process.stderr});
 try{
  console.error('\nInstalled models:');models.forEach((m,i)=>console.error(`  ${i+1}  ${m.name}`));
  const answer=(await input.question('Choose a number, registered name, or full GGUF path: ')).trim();
  if(!answer)throw Error('No model selected');return models[Number(answer)-1]?.selection??answer;
 }finally{input.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config=await machine(null);console.log(JSON.stringify(await installedModels([config.ModelsDirectory,...(config.ModelDirectories??[])])));
}
