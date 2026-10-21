import { PiIntegrationTest, assistantMessage, toolCall, text, getToolResultMessage } from 'pi-coding-agent-test';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { root, machine, prepareProfile } from '../scripts/local-runtime.mjs';
const dir = path.join(root, '.state/evals/web-' + Date.now()); await mkdir(dir, { recursive: true });
let pageRequests = 0;
const html = '<html><head><title>Evidence fixture</title></head><body><nav>NAVIGATION_NOISE</nav><article><h1>Primary evidence</h1><p>Olá, Rolf. Asterism is the exact target.</p>' + '<p>Bounded evidence line with useful facts.</p>'.repeat(100) + '</article><script>EVIL_SCRIPT_MARKER()</script></body></html>';
const server = http.createServer((request, response) => {
  if (request.url === '/redirect') { response.writeHead(302, { location: '/page' }); response.end(); return; }
  if (request.url === '/rate-limit') { response.writeHead(429, { 'retry-after': '7' }); response.end('retry later'); return; }
  if (request.url === '/missing') { response.writeHead(404); response.end('missing'); return; }
  pageRequests++; response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', etag: 'fixture-v1' }); response.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port;
const calls = [
  ['read','read_url_content',{url:url+'/page',maxChars:120}],
  ['cached','read_url_content',{url:url+'/page',maxChars:120}],
  ['page-two','read_url_content',{url:url+'/page',offset:120,maxChars:120}],
  ['find','find_text_in_url_content',{url:url+'/page',query:'ASTERISM',caseSensitive:false,maxMatches:2,maxQuoteChars:200}],
  ['case','find_text_in_url_content',{url:url+'/page',query:'ASTERISM',caseSensitive:true}],
  ['public-read','read_url_content',{url:'https://pi.dev/docs/latest/extensions',maxChars:2000}],
  ['public-find','find_text_in_url_content',{url:'https://pi.dev/docs/latest/extensions',query:'tool_call',maxMatches:2,maxQuoteChars:400}],
  ['redirect','read_url_content',{url:url+'/redirect',maxChars:120}],
  ['scheme','read_url_content',{url:'file:///C:/not-to-read.txt'}],
  ['missing','read_url_content',{url:url+'/missing'}],
  ['rate','read_url_content',{url:url+'/rate-limit'}],
  ['search','search_web',{query:'site:pi.dev/docs extensions tool_call',limit:3,timeRange:'year'}],
];
let report;
try {
  const prepared = await prepareProfile('web', await machine(), dir);
  const run = await new PiIntegrationTest({ testName:'web-tools', transport:'rpc', cwd:dir, artifactsDir:path.join(dir,'traces'),
    piCommand:path.join(root,'node_modules/.bin/pi.cmd'), isolateUserResources:true, environment:prepared.env,
    extensions:[...prepared.settings.packages,...prepared.settings.extensions], tools:['search_web','read_url_content','find_text_in_url_content'], timeoutMs:90000,
    conversation:[...calls.map(([id,name,args])=>assistantMessage([toolCall({id,name,arguments:args,delayMs:0})],{stopReason:'toolUse'})),assistantMessage([text('Tool trial complete.',{delayMs:0})])] }).run('Run the bounded web-tool scenario.');
  const results = Object.fromEntries(calls.map(([id])=>[id,getToolResultMessage(run,id).details]));
  const first = results.read;
  const checks = {
    extractedUtf8: first.status==='ok' && first.data?.content.includes('Olá, Rolf'),
    boundedPage: first.data?.content.length<=120 && first.data?.nextOffset===first.data?.endOffset && first.data?.nextOffset>0,
    cacheHit: results.cached.provenance?.cache?.status==='hit',
    pagination: results['page-two'].data?.offset===120 && results['page-two'].data?.content!==first.data?.content,
    literalCaseInsensitiveFind: results.find.status==='ok',
    caseSensitiveNoMatch: results.case.status==='no_match',
    publicPrimaryDocument: results['public-read'].status==='ok' && results['public-read'].data?.content.length<=2000 && results['public-read'].provenance?.finalUrl==='https://pi.dev/docs/latest/extensions',
    publicLiteralFind: results['public-find'].status==='ok',
    redirectProvenance: results.redirect.provenance?.finalUrl===url+'/page' && results.redirect.provenance?.requestedUrl===url+'/redirect',
    rejectedFileUrl: results.scheme.status==='error',
    missingPageReported: results.missing.status==='error',
    rateLimitReported: results.rate.error?.code==='rate_limited' && results.rate.error?.retryable===true,
    noScriptExecutionText: !JSON.stringify(first.data).includes('EVIL_SCRIPT_MARKER'),
    liveSearch: results.search.status==='ok' && (results.search.data?.results?.length || results.search.data?.items?.length)>0,
  };
  report={profile:'web',package:'@arcanemachine/pi-web-search@3.0.0',modelTokensSpent:0,checks,pageRequests,results};
} catch(error) { report={error:error.message}; }
finally { await new Promise(resolve=>server.close(resolve)); }
await writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({ checks:report.checks,error:report.error,report:path.join(dir,'report.json') }));
if(report.error || Object.values(report.checks).some(value=>!value)) process.exitCode=1;
