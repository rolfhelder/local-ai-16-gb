import test from 'node:test';
import assert from 'node:assert/strict';
import { generationLimits, serverArguments, machine, localModels,exec,nodeExe,root } from '../scripts/local-runtime.mjs';
test('candidate registry selects separate coding model files',()=>{assert.match(localModels.omnicoder.file,/Tesslate\/OmniCoder/);assert.match(localModels['gpt-oss'].file,/ggml-org\/gpt-oss/);});
test('GPT-OSS cannot inherit the 200k default window',async()=>{const config=await machine('gpt-oss');assert.ok(config.ContextSize<=131072);assert.equal(config.ModelId,'gpt-oss-local');});
test('explicit launcher context cannot exceed GPT-OSS native window',async()=>{const result=await exec(nodeExe,['scripts/pia.mjs','--local-model','gpt-oss','--context','204800','--dry-run'],{cwd:root});const command=JSON.parse(result.stdout);assert.equal(command.arguments[command.arguments.indexOf('-c')+1],'131072');});
test('invalid model selection is rejected before loading weights',async()=>{await assert.rejects(machine('not-a-model'),/--local-model/);});
test('coding default reserves room for thinking and answer',()=>assert.deepEqual(generationLimits({ContextSize:32768}),{maxTokens:8192,reasoningBudget:2048}));
test('small context caps generation and leaves answer room',()=>assert.deepEqual(generationLimits({ContextSize:8192}),{maxTokens:2048,reasoningBudget:1024}));
test('explicit reasoning-off control',()=>assert.equal(generationLimits({ContextSize:32768,Reasoning:false}).reasoningBudget,0));
test('reasoning-on server has stable context and port, no silent fit or shifts',()=>{
  const args=serverArguments({ModelFile:'fixture.gguf',ModelId:'fixture',Port:48763,ContextSize:32768,GpuLayers:999});
  assert.equal(args[args.indexOf('--reasoning')+1],'on');assert.equal(args[args.indexOf('--port')+1],'48763');assert.equal(args[args.indexOf('--fit')+1],'off');assert.ok(args.includes('--no-context-shift'));
});
