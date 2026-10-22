import {readFile,writeFile,mkdir,rename,copyFile,access} from 'node:fs/promises';
import path from 'node:path';
import {root} from '../scripts/local-runtime.mjs';
const pointer=JSON.parse(await readFile(path.join(root,'.state/effort-task-current.json'),'utf8'));
const run=JSON.parse(await readFile(path.join(pointer.artifactDir,'run.json'),'utf8'));
const files=['extensions/effort.mjs','extensions/effort-core.mjs','config/effort.json'];
const held=path.join(run.artifactDir,'withheld-original-source');
const confined=p=>{const relative=path.relative(root,path.resolve(p));if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Move target outside the lab: '+p);};
for(const relative of files){
 const original=path.join(root,relative),archive=path.join(held,relative);confined(original);confined(archive);
 if(process.argv.includes('--restore')){
  try{await access(original);if(!Buffer.from(await readFile(original)).equals(Buffer.from(await readFile(archive))))throw Error('Original changed; preserved both versions: '+relative);}
  catch(e){if(e.code!=='ENOENT')throw e;await copyFile(archive,original);}
 }else{await mkdir(path.dirname(archive),{recursive:true});await rename(original,archive);}
}
await writeFile(path.join(run.artifactDir,process.argv.includes('--restore')?'working-feature-restored.json':'working-feature-withheld.json'),JSON.stringify({files,archive:held,timestamp:new Date().toISOString()},null,2));
console.log(process.argv.includes('--restore')?'Working feature restored.':'Working source moved into the private archive; normal paths no longer contain the solution.');
