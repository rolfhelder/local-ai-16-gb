import {readFile,stat,mkdir,copyFile,writeFile,rename,open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {root} from './local-runtime.mjs';

export async function addModelFolder(configFile,folder,{backupDirectory=path.join(root,'.state/config-backups')}={}){
 if(!path.isAbsolute(folder))throw Error('Choose an absolute model folder path.');
 folder=path.resolve(folder);
 if(!(await stat(folder)).isDirectory())throw Error('Model location must be a directory.');
 const lock=await open(configFile+'.lock','wx');
 let temp;
 try{
  const text=await readFile(configFile,'utf8');const config=JSON.parse(text.replace(/^\uFEFF/,''));
  if(config.ModelDirectories!==undefined&&(!Array.isArray(config.ModelDirectories)||config.ModelDirectories.some(p=>typeof p!=='string')))throw Error('ModelDirectories must be an array of folder paths.');
  const key=p=>process.platform==='win32'?path.resolve(p).toLowerCase():path.resolve(p);
  const existing=[config.ModelsDirectory,...(config.ModelDirectories??[])].filter(Boolean);
  if(existing.some(p=>key(p)===key(folder)))return {changed:false,folder};
  config.ModelDirectories=[...(config.ModelDirectories??[]),folder];
  await mkdir(backupDirectory,{recursive:true});
  const backup=path.join(backupDirectory,'machine-'+randomUUID()+'.json');await copyFile(configFile,backup);
  temp=configFile+'.'+randomUUID()+'.tmp';
  await writeFile(temp,JSON.stringify(config,null,2)+'\n',{flag:'wx'});
  await rename(temp,configFile);
  return {changed:true,folder,backup};
 }finally{
  if(temp)await unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error;});
  await lock.close();await unlink(configFile+'.lock');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const folder=process.argv[2];if(!folder)throw Error('Choose a model folder.');const result=await addModelFolder(path.join(root,'machine.local.json'),folder);console.log(result.changed?'Model folder saved.':'Model folder already configured.');console.log(result.folder);}
 catch(error){console.error(error.message);process.exitCode=1;}
}
