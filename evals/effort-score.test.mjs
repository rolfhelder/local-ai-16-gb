import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreEffort} from './effort-score.mjs';
test('round scores remain independent and preserve regressions for comparison',()=>{
 const first={criteria:{retained:{pass:true},repaired:{pass:false},regressed:{pass:true},failed:{pass:false}}};
 const final={criteria:{retained:{pass:true},repaired:{pass:true},regressed:{pass:false},failed:{pass:false}}};
 const score=scoreEffort(first,final);assert.equal(score.round1Score,2);assert.equal(score.round2Score,2);assert.equal(score.maximum,4);assert.deepEqual(score.rows[2],{id:'regressed',round1Pass:true,round2Pass:false});assert.equal('points' in score,false);
});
