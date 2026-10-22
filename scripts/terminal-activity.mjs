export function activity({stream=process.stderr,color=stream.isTTY&&!process.env.NO_COLOR,ascii=false}={}){
 const paint=s=>color?`\x1b[38;5;80m${s}\x1b[0m`:s;
 let message='Inspecting local runtime and hardware',fraction=null,frame=0,last='',closed=false;
 const started=Date.now();
 function draw(){
  if(closed)return;
  let bar;
  if(fraction!==null){const n=Math.floor(fraction*24);bar=(ascii?'#':'█').repeat(n)+(ascii?'.':'░').repeat(24-n);}
  else {const cells=Array(24).fill(ascii?'.':'░');for(let i=0;i<3;i++)cells[(frame+i)%24]=ascii?'=':'▓';bar=cells.join('');}
  frame++;
  const line=`  [${bar}] ${message} · ${((Date.now()-started)/1000).toFixed(1)}s`;
  if(stream.isTTY)stream.write('\r'+paint(line.slice(0,(stream.columns||120)-2).padEnd((stream.columns||120)-2)));
  else if(last!==message){stream.write('  '+message+'\n');last=message;}
 }
 draw();const timer=setInterval(draw,stream.isTTY?200:1000);timer.unref();
 return {update(text,ratio=null){message=text;fraction=ratio;},stop(){closed=true;clearInterval(timer);if(stream.isTTY)stream.write('\r\x1b[2K');}};
}
