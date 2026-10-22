// Deterministic, dependency-free README artwork. Metrics come from reviewed results.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const asset=path.join(root,'assets');await mkdir(asset,{recursive:true});
const frame=(height,description,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title desc"><title id="title">Local Agent: Pi + llama.cpp</title><desc id="desc">${description}</desc>${body}</svg>\n`;
const hero=frame(380,'A local coding agent for one 16 GB GPU. Pi CLI or optional Pi App connects to a loopback llama.cpp server. Developed on Windows, RTX 4090 Laptop, 32 GiB RAM.',`
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#102b35"/><stop offset="1" stop-color="#193d40"/></linearGradient><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d6e4df" opacity=".07"/></pattern></defs>
<rect width="1200" height="380" rx="22" fill="url(#bg)"/><rect width="1200" height="380" rx="22" fill="url(#dots)"/>
<g font-family="Segoe UI,Arial,sans-serif"><text x="48" y="52" fill="#9ee4c4" font-size="14" font-weight="700" letter-spacing="3">LOCAL AI · ONE MODEL · YOUR MACHINE</text>
<text x="46" y="125" fill="#f4f4e9" font-size="60" font-weight="700">Local Agent</text><text x="49" y="169" fill="#c2d8d7" font-size="26">Pi harness + llama.cpp</text>
<text x="49" y="221" fill="#e3ece5" font-size="18">A small stack. Measured tradeoffs.</text><text x="49" y="250" fill="#a9c4c4" font-size="17">CLI first, with an optional desktop interface.</text>
<rect x="650" y="58" width="502" height="222" rx="14" fill="#0a202a" stroke="#40615f"/><circle cx="673" cy="81" r="4" fill="#edb996"/><circle cx="689" cy="81" r="4" fill="#d8d28c"/><circle cx="705" cy="81" r="4" fill="#9ee4c4"/><text x="1128" y="85" text-anchor="end" fill="#8ba7a7" font-size="12">STARTUP EXAMPLE</text>
<g font-family="Consolas,monospace" font-size="20"><text x="675" y="132" fill="#9ee4c4">&gt; local-ai</text><text x="675" y="170" fill="#dce7e3">Pi CLI / optional Pi App</text><text x="675" y="202" fill="#8ba7a7">         ↓ localhost</text><text x="675" y="238" fill="#dce7e3">llama.cpp → one GGUF model</text></g>
<path d="M48 306H1152" stroke="#40615f"/><text x="49" y="344" fill="#e3ece5" font-size="17">WINDOWS</text><text x="217" y="344" fill="#a9c4c4" font-size="17">RTX 4090 Laptop</text><text x="505" y="344" fill="#9ee4c4" font-size="17" font-weight="700">16 GB VRAM</text><text x="750" y="344" fill="#a9c4c4" font-size="17">32 GiB system RAM</text></g>`);
await writeFile(path.join(asset,'readme-hero.svg'),hero);
const data=JSON.parse(await readFile(path.join(root,'results/models.json'),'utf8'));
const labels={gemma:'Gemma 4 12B',qwen:'Qwen3.5 9B',omnicoder:'OmniCoder 9B','gpt-oss':'GPT-OSS 20B'};
let bars='';for(const [index,id]of ['gemma','qwen','omnicoder','gpt-oss'].entries()){
 const m=data.models.find(m=>m.id===id),y=133+index*66;
 bars+=`<text x="44" y="${y+15}" fill="#183c40" font-size="18" font-weight="600">${labels[id]}</text>`;
 for(const [row,score,color]of [[0,m.effortRound1,'#b5c3c5'],[1,m.effortRound2,'#267a69']]){const by=y+row*23;bars+=`<rect x="255" y="${by}" width="650" height="14" rx="4" fill="#e7ece7"/><rect x="255" y="${by}" width="${650*score/13}" height="14" rx="4" fill="${color}"/><text x="930" y="${by+12}" fill="#183c40" font-size="15">${score} / 13</text>`;}
}
await writeFile(path.join(asset,'effort-comparison.svg'),frame(440,'Native effort-command task: Gemma 2 then 6, Qwen 0 then 7, OmniCoder 0 then 0, GPT-OSS 2 then 2 out of 13. No model completed the feature.',`<rect width="1200" height="440" rx="18" fill="#fafbf9"/><g font-family="Segoe UI,Arial,sans-serif"><text x="44" y="43" fill="#183c40" font-size="27" font-weight="700">The hard part: build a native /effort command</text><text x="44" y="77" fill="#536d70" font-size="17">13 behavioral checks. One attempt, then one diagnostic follow-up.</text><rect x="800" y="34" width="13" height="13" rx="3" fill="#b5c3c5"/><text x="823" y="46" fill="#536d70" font-size="15">Round 1</text><rect x="960" y="34" width="13" height="13" rx="3" fill="#267a69"/><text x="983" y="46" fill="#536d70" font-size="15">Round 2</text>${bars}<text x="44" y="420" fill="#536d70" font-size="16">None completed all checks. Independent round scores; small exploratory sample.</text></g>`));
console.log('Generated assets/readme-hero.svg and assets/effort-comparison.svg');
