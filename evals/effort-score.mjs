export function scoreEffort(first,final){
 const rows=Object.keys(first.criteria).map(id=>{
  if(!(id in final.criteria))throw Error('Missing final criterion: '+id);
  const firstPass=first.criteria[id].pass,finalPass=final.criteria[id].pass;
  return {id,firstPass,finalPass,points:finalPass?(firstPass?1:0.5):0};
 });
 const points=rows.reduce((sum,row)=>sum+row.points,0);
 return {rows,firstPassed:rows.filter(r=>r.firstPass).length,finalPassed:rows.filter(r=>r.finalPass).length,points,maximum:rows.length,percent:100*points/rows.length};
}
