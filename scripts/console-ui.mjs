export const clean=text=>String(text??'not measured').replace(/[\x00-\x1f\x7f-\x9f]/g,' ');
export const number=value=>Number.isFinite(value)?value.toLocaleString('en-US'):'not measured';
function wrap(value,width){let text=clean(value);const lines=[];while(text.length>width){let cut=text.lastIndexOf(' ',width);if(cut<width/2)cut=width;lines.push(text.slice(0,cut));text=text.slice(cut).trimStart();}lines.push(text);return lines;}
export function consoleUI(args=[],stream=process.stdout){
 const color=stream.isTTY&&!process.env.NO_COLOR&&!args.includes('--no-color'),ascii=args.includes('--ascii');
 const paint=(s,c='38;5;80')=>color?`\x1b[${c}m${s}\x1b[0m`:s;
 const line=text=>stream.write(clean(text)+'\n');
 return {line,paint,
  title(text,subtitle=''){
   const edge=ascii?'+--------------------------------------------------------------------+':'╭────────────────────────────────────────────────────────────────────╮';
   const side=ascii?'|':'│';stream.write(paint(edge)+'\n');
   for(const content of wrap('LOCAL AI / '+text,66))stream.write(paint(side)+' '+paint(content.padEnd(67),'1;38;5;159')+paint(side)+'\n');
   if(subtitle)for(const content of wrap(subtitle,66))stream.write(paint(side)+' '+content.padEnd(67)+paint(side)+'\n');
   stream.write(paint(ascii?edge:'╰────────────────────────────────────────────────────────────────────╯')+'\n\n');
  },
  section(text){stream.write('\n'+paint('  '+clean(text),'1;38;5;159')+'\n');},
  row(key,value){const label=clean(key),size=Math.max(25,label.length),parts=wrap(value,Math.max(20,(stream.columns||100)-size-4));parts.forEach((part,i)=>line('  '+(i?'':label).padEnd(size)+'  '+part));},
  status(ok,text){stream.write('  '+paint(ascii?(ok?'[OK]':'[X]'):(ok?'✓':'✗'),ok?'32':'31')+' '+clean(text)+'\n');},
  table(headers,rows){const widths=headers.map((h,i)=>Math.min(38,Math.max(h.length,...rows.map(r=>clean(r[i]).length))));
   const format=row=>'  '+row.map((v,i)=>clean(v).padEnd(widths[i])).join('  ');
   stream.write(paint(format(headers),'1;38;5;159')+'\n');line(format(widths.map(w=>'-'.repeat(w))));
   for(const row of rows){const cells=row.map((v,i)=>wrap(v,widths[i]));for(let n=0;n<Math.max(...cells.map(c=>c.length));n++)line(format(cells.map(c=>c[n]??'')));}},
  finish(text){stream.write('\n'+paint('  '+clean(text))+'\n\n');}
 };
}
