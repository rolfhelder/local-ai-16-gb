const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function connectDesktop(port=48765){
 const deadline=Date.now()+30000;let pages;
 while(!pages){try{pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();}catch(e){if(Date.now()>deadline)throw e;await pause(500);}}
 const target=pages.find(p=>p.type==='page'&&p.url.startsWith('file:'));if(!target)throw Error('Pi App renderer not found');
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let seq=0;const pending=new Map();ws.onmessage=({data})=>{const m=JSON.parse(data);pending.get(m.id)?.(m);};
 const command=async(method,params={})=>{const id=++seq;let timer;const response=new Promise((resolve,reject)=>{pending.set(id,m=>{clearTimeout(timer);pending.delete(id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);});timer=setTimeout(()=>{pending.delete(id);reject(Error('Desktop command timed out: '+method));},60000);});ws.send(JSON.stringify({id,method,params}));return response;};
 const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 return {command,evaluate,invoke:(channel,body={})=>evaluate(`window.piDesktop.invoke(${JSON.stringify(channel)},${JSON.stringify(body)})`),close:()=>ws.close()};
}
