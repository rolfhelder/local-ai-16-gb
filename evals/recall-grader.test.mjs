import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeRecall } from './recall-grader.mjs';
const expected = { N1: 'abc123', N2: 'def456' };
test('exact lookup values pass', () => assert.equal(gradeRecall('```json\n{"N1":"abc123","N2":"def456"}\n```', expected).passed, true));
test('prefix plus invented suffix fails', () => assert.deepEqual(gradeRecall('{"N1":"abc123garbage","N2":"def456wrong"}', expected), { exact: 0, passed: false, validJson: true }));
test('values under wrong keys fail', () => assert.equal(gradeRecall('{"N1":"def456","N2":"abc123"}', expected).passed, false));
test('malformed JSON fails', () => assert.equal(gradeRecall('abc123 def456', expected).validJson, false));
test('unrequested fields fail strict contract', () => assert.equal(gradeRecall('{"N1":"abc123","N2":"def456","N3":"invented"}', expected).passed, false));
