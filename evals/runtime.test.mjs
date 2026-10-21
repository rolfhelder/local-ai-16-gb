import test from 'node:test';
import assert from 'node:assert/strict';
import { generationLimits, serverArguments } from '../scripts/local-runtime.mjs';
test('coding default reserves room for thinking and answer',()=>assert.deepEqual(generationLimits({ContextSize:32768}),{maxTokens:8192,reasoningBudget:2048}));
test('small context caps generation and leaves answer room',()=>assert.deepEqual(generationLimits({ContextSize:8192}),{maxTokens:2048,reasoningBudget:1024}));
test('explicit reasoning-off control',()=>assert.equal(generationLimits({ContextSize:32768,Reasoning:false}).reasoningBudget,0));
test('reasoning-on server has stable context and port, no silent fit or shifts',()=>{
  const args=serverArguments({ModelFile:'fixture.gguf',ModelId:'fixture',Port:48763,ContextSize:32768,GpuLayers:999});
  assert.equal(args[args.indexOf('--reasoning')+1],'on');assert.equal(args[args.indexOf('--port')+1],'48763');assert.equal(args[args.indexOf('--fit')+1],'off');assert.ok(args.includes('--no-context-shift'));
});
