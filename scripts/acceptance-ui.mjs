const names={
 'pinned-model':['Verify model','Reading model weights and checking SHA256'],
 'owned-endpoint':['Load local server','Loading weights; checking model, context and single slot (up to 180s)'],
 'real-answer':['Check response','Waiting for the readiness marker (up to 120s)'],
 'pi-tool-loop':['Coding repair','Pi runs failing checks, reads code, edits and tests again (up to 180s)']
};
const clean=value=>String(value).replace(/[\x00-\x1f\x7f-\x9f]/g,' ');
export function createAcceptanceUI({stream=process.stderr,color=stream.isTTY&&!process.env.NO_COLOR,ascii=false,now=Date.now}={}){
 const paint=(s,c='38;5;80')=>color?`\x1b[${c}m${s}\x1b[0m`:s;
 const symbols=ascii?{ok:'OK',fail:'X',fill:'#',empty:'.',frames:['|','/','-','\\']}:{ok:'✓',fail:'✗',fill:'█',empty:'░',frames:['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']};
 let timer,active,start,overall=now(),done=0,frame=0,detail='',lineOpen=false;
 const width=()=>Math.max(30,(stream.columns||100)-2);
 const write=s=>stream.write(s+'\n');
 function clear(){if(lineOpen){stream.write('\r\x1b[2K');lineOpen=false;}}
 function draw(){
  if(!active)return;
  const elapsed=((now()-start)/1000).toFixed(1);
  const pending=(4-done)*6;
  const cells=Array(pending).fill(symbols.empty);
  // A moving highlight shows activity; only passed checks become solid fill.
  if(pending){const cycle=Math.max(1,pending-2);const head=frame%cycle;for(let i=head;i<Math.min(head+3,pending);i++)cells[i]=ascii?'=':'▓';}
  const bar=symbols.fill.repeat(done*6)+cells.join('');
  const text=`${symbols.frames[frame++%symbols.frames.length]} [${bar}] ${done}/4 checks · ${active} · ${elapsed}s${detail?' · '+detail:''}`;
  // Overwrite in one write; clearing first creates a visibly blank frame.
  if(stream.isTTY){stream.write('\r'+paint(clean(text).slice(0,width()).padEnd(width())));lineOpen=true;}
  else write(`  Working · ${active} · ${elapsed}s${detail?' · '+clean(detail):''}`);
 }
 function stop(){clearInterval(timer);timer=undefined;clear();}
 return {
  header(model,run){
   const edge=ascii?'+--------------------------------------------------------------------+':'╭────────────────────────────────────────────────────────────────────╮';
   const side=ascii?'|':'│';
   write(paint(edge));write(paint(side)+' '+paint(`LOCAL AI / ${run?'ACCEPTANCE TEST':'TEST PREVIEW'}`.padEnd(67),'1;38;5;159')+paint(side));
   write(paint(side)+' '+`${clean(model)} · 32,768 tokens · one model / one slot`.padEnd(67)+paint(side));
   write(paint(ascii?edge:'╰────────────────────────────────────────────────────────────────────╯'));
   write('');
  },
  preview(){for(const [i,[label,description]] of Object.values(names).entries()){write(paint(`  0${i+1}  ${label}`,'1;38;5;159'));write('      '+description);}
   write('\n  Preview only · no model loading or file changes');write('  Start › local-ai test --run\n');},
  start(name){stop();active=names[name]?.[0]??name;detail='';start=now();write(paint('  '+(names[name]?.[1]??name),'90'));draw();timer=setInterval(draw,stream.isTTY?250:10000);timer.unref();},
  progress(text){detail=text;},
  note(text){clear();write('  '+clean(text));draw();},
  complete(stage){stop();if(stage.status==='pass')done++;write('  '+paint(stage.status==='pass'?symbols.ok:symbols.fail,stage.status==='pass'?'32':'31')+'  '+(names[stage.name]?.[0]??stage.name)+'  '+(stage.durationMs/1000).toFixed(1)+'s');
   if(stage.error)write('     '+paint(clean(stage.error),'31'));active=undefined;},
  cleanup(){stop();active='Cleanup';detail='Stopping owned server and saving evidence';start=now();draw();timer=setInterval(draw,stream.isTTY?250:10000);timer.unref();},
  finish(report,file){stop();active=undefined;
   write('');write(paint(report.passed?'  ALL CHECKS PASSED':'  ACCEPTANCE FAILED',report.passed?'1;32':'1;31'));
   write(`  [${symbols.fill.repeat(done*6)}${symbols.empty.repeat((4-done)*6)}] ${done}/4 passed · ${((now()-overall)/1000).toFixed(1)}s total`);
   const failed=report.stages.find(s=>s.status==='fail');if(failed)write('  Stopped after '+(names[failed.name]?.[0]??failed.name)+'; later checks were skipped.');
   if(report.timings?.generationTpsMean!=null)write(`  Generation  ${report.timings.generationTpsMean.toFixed(1)} tokens/sec average`);
   write('  Production context unchanged · owned server cleanup completed');write('  Report  '+clean(file));write('');
  },
  abort(error){stop();active=undefined;write(paint('  '+symbols.fail+'  '+clean(error.message),'31'));},
  stop
 };
}
