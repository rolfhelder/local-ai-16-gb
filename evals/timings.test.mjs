import test from 'node:test';
import assert from 'node:assert/strict';
import { serverTimings } from './timings.mjs';
test('separate prompt and response TPS, do not include progress lines', () => {
  const result = serverTimings('prompt processing, n_tokens = 123\nprompt eval time = 1000.00 ms / 1000 tokens (1 ms per token, 1000.00 tokens per second)\n eval time = 2000.00 ms / 101 tokens (20 ms per token, 50.00 tokens per second)');
  assert.equal(result.promptTpsMean, 1000); assert.equal(result.generationTpsMean, 50); assert.equal(result.generationTpsWeighted, 50);
});
test('load failures have no invented TPS', () => assert.equal(serverTimings('out of memory').generationTpsMean, null));
