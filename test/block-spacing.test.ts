import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankLinesBetween} from '../src/shared/block-spacing';

test('reading gaps preserve live-preview empty lines, including CRLF and leading lines',()=>{
  assert.equal(blankLinesBetween('A\n\nB',1,3),1);
  assert.equal(blankLinesBetween('A\nB',1,2),0);
  assert.equal(blankLinesBetween('A\n\n\nB',1,4),2);
  assert.equal(blankLinesBetween('\n\nA',0,2,true),2);
  assert.equal(blankLinesBetween('A\r\n\r\nB',1,5),1);
  assert.equal(blankLinesBetween('A\n  \nB',1,5),1);
  assert.equal(blankLinesBetween('ignored text',0,12),0);
});
