import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreEffort} from './effort-score.mjs';
test('one follow-up earns half credit; regressions earn zero',()=>{
 const first={criteria:{retained:{pass:true},repaired:{pass:false},regressed:{pass:true},failed:{pass:false}}};
 const final={criteria:{retained:{pass:true},repaired:{pass:true},regressed:{pass:false},failed:{pass:false}}};
 const score=scoreEffort(first,final);assert.deepEqual(score.rows.map(r=>r.points),[1,0.5,0,0]);assert.equal(score.points,1.5);assert.equal(score.percent,37.5);
});
