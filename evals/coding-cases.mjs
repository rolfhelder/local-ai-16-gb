// Independent, dependency-free projects. Hidden checks are withheld from task prompts,
// not protected by an OS sandbox. No benchmark answer is put into background text.
export const codingCases = [
  {
    id: 'csv-records',
    specification: 'Repair parseCsv(text) in parser.cjs. Return arrays of string fields. Support commas, CRLF or LF record separators, double-quoted fields containing commas or newlines, escaped double quotes (two quotes), and empty fields. Empty input returns []; one terminal record separator creates no extra record. Preserve spaces and Unicode. Inputs are well-formed CSV; no malformed-input handling is required.',
    files: { 'parser.cjs': `exports.parseCsv = text => text.split(/\\r?\\n/).map(row => row.split(','));\n` },
    publicChecks: `const {parseCsv}=require('./parser.cjs');assert.deepEqual(parseCsv('name,city\\nAna,Recife'),[['name','city'],['Ana','Recife']]);assert.deepEqual(parseCsv('"a,b",c'),[['a,b','c']]);`,
    hiddenChecks: [
      `assert.deepEqual(api.parseCsv(''),[]);`,
      String.raw`assert.deepEqual(api.parseCsv('a,b\r\nc,d\r\n'),[['a','b'],['c','d']]);`,
      String.raw`assert.deepEqual(api.parseCsv('"line\none","say ""yes"""'),[['line\none','say "yes"']]);`,
      String.raw`assert.deepEqual(api.parseCsv(',x,\n,,\n'),[['','x',''],['','','']]);`,
      `assert.deepEqual(api.parseCsv(' Olá ,"東京"'),[[' Olá ','東京']]);`,
      String.raw`assert.deepEqual(api.parseCsv('"","a\r\nb",end'),[['','a\r\nb','end']]);`,
    ],
    entry: 'parser.cjs',
  },
  {
    id: 'pagination-contract',
    specification: 'Repair paginate(items,page,size) in pagination.cjs and listCatalog(items,query) in service.cjs. Page is zero-based, default 0; size defaults to 2. Explicit page must be an integer >=0 and size an integer >=1; otherwise throw RangeError. paginate returns {items,total,page,size,hasNext}; do not mutate the input. Out-of-range pages return empty items and hasNext false. listCatalog forwards query.page and query.size, including explicit zero page, and otherwise uses defaults. No coercion of strings is required.',
    files: {
      'pagination.cjs': `exports.paginate=(items,page=0,size=2)=>({items:items.slice(page*size,size),total:items.length,page,size,hasNext:page*size<items.length});\n`,
      'service.cjs': `const {paginate}=require('./pagination.cjs');exports.listCatalog=(items,query={})=>paginate(items,0,query.size||2);\n`,
    },
    publicChecks: `const {listCatalog}=require('./service.cjs');assert.deepEqual(listCatalog([1,2,3,4,5],{page:1,size:2}).items,[3,4]);assert.equal(listCatalog([1],{}).hasNext,false);`,
    entry: 'service.cjs',
    hiddenChecks: [
      `assert.deepEqual(api.listCatalog([1,2,3],{}),{items:[1,2],total:3,page:0,size:2,hasNext:true});`,
      `assert.deepEqual(api.listCatalog([1,2,3,4],{page:1,size:2}),{items:[3,4],total:4,page:1,size:2,hasNext:false});`,
      `assert.deepEqual(api.listCatalog([1],{page:4,size:2}).items,[]);assert.equal(api.listCatalog([1],{page:4,size:2}).hasNext,false);`,
      `assert.deepEqual(api.listCatalog([],{}),{items:[],total:0,page:0,size:2,hasNext:false});`,
      `for(const q of [{page:-1},{page:0.5},{size:0},{size:-1},{size:1.5}])assert.throws(()=>api.listCatalog([1,2],q),RangeError);`,
      `const input=Object.freeze([1,2,3]);api.listCatalog(input,{page:1,size:1});assert.deepEqual(input,[1,2,3]);`,
    ],
  },
  {
    id: 'async-retry',
    specification: 'Repair async retry(operation, options={}) in retry.cjs. maxAttempts defaults to 3 and counts total calls, not retries; reject invalid non-positive/non-integer counts with RangeError. Call operation with one-based attempt number. Return its first successful value, including null/false/zero. On failure, call shouldRetry(error,attempt), default true; if false or final attempt, rethrow the original error object. Between retries only, await sleep(delayMs), default delayMs=0 and sleep=async()=>{}. Never sleep after success or final failure. Tests inject sleep, so no real waiting or network is necessary.',
    files: { 'retry.cjs': `exports.retry=async(operation,{maxAttempts=3,delayMs=0,sleep=async()=>{},shouldRetry=()=>true}={})=>{let last;for(let attempt=0;attempt<=maxAttempts;attempt++){try{const result=await operation(attempt);if(result)return result;}catch(error){last=error;sleep(delayMs);}}throw last;};\n` },
    publicChecks: `const {retry}=require('./retry.cjs');let n=0;assert.equal(await retry(async()=>{if(++n<2)throw Error('temporary');return 'ok';}), 'ok');assert.equal(await retry(async()=>0),0);`,
    entry: 'retry.cjs',
    hiddenChecks: [
      `let calls=[];assert.equal(await api.retry(async n=>{calls.push(n);if(n<3)throw Error('retry');return 'ok';}), 'ok');assert.deepEqual(calls,[1,2,3]);`,
      `for(const value of [null,false,0,'']){let n=0;assert.equal(await api.retry(async()=>{n++;return value;}),value);assert.equal(n,1);}`, 
      `const error=Error('persistent');let n=0,sleeps=[];await assert.rejects(api.retry(async()=>{n++;throw error;},{maxAttempts:2,delayMs:7,sleep:async n=>sleeps.push(n)}),e=>e===error);assert.equal(n,2);assert.deepEqual(sleeps,[7]);`,
      `const error=Error('permanent');let calls=0,sleeps=0;await assert.rejects(api.retry(async()=>{calls++;throw error;},{shouldRetry:()=>false,sleep:async()=>sleeps++}),e=>e===error);assert.equal(calls,1);assert.equal(sleeps,0);`,
      `for(const maxAttempts of [0,-1,1.5])await assert.rejects(api.retry(async()=>1,{maxAttempts}),RangeError);`,
      `let ready=false,n=0;assert.equal(await api.retry(async()=>{if(++n===1)throw Error('retry');assert.equal(ready,true);return 4;},{sleep:async()=>{await new Promise(r=>setTimeout(r,5));ready=true;}}),4);`,
    ],
  },
];

export function publicSource(task) {
  return `const assert=require('node:assert/strict');(async()=>{${task.publicChecks}\nconsole.log('Public checks passed');})().catch(e=>{console.error(e);process.exitCode=1;});\n`;
}
export function hiddenSource(task) {
  return `const assert=require('node:assert/strict');const api=require(process.argv[2]);(async()=>{const results=[];for(const check of ${JSON.stringify(task.hiddenChecks)}){try{await new (Object.getPrototypeOf(async()=>{}).constructor)('assert','api',check)(assert,api);results.push(true);}catch{results.push(false);}}console.log(JSON.stringify({passed:results.filter(Boolean).length,total:results.length,checks:results}));})().catch(e=>{console.error(e);process.exitCode=1;});\n`;
}
