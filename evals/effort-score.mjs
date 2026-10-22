export function scoreEffort(first,final){
 const rows=Object.keys(first.criteria).map(id=>{
  if(!(id in final.criteria))throw Error('Missing final criterion: '+id);
  const firstPass=first.criteria[id].pass,finalPass=final.criteria[id].pass;
  return {id,round1Pass:firstPass,round2Pass:finalPass};
 });
 return {rows,round1Score:rows.filter(r=>r.round1Pass).length,round2Score:rows.filter(r=>r.round2Pass).length,maximum:rows.length};
}
