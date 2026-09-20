import test from 'node:test';
import assert from 'node:assert/strict';
import {findText} from '../src/shared/find';
test('find treats regex syntax literally and supports case matching',()=>{
  assert.deepEqual(findText('A+b a+b','a+b'),[{from:0,to:3},{from:4,to:7}]);
  assert.deepEqual(findText('A+b a+b','a+b',true),[{from:4,to:7}]);
  assert.deepEqual(findText('[x] .*','[x]'),[{from:0,to:3}]);
  assert.deepEqual(findText('anything',''),[]);
});
test('find preserves UTF-16 positions for Chinese, emoji and case folding',()=>{
  assert.deepEqual(findText('😀中文 中文','中文'),[{from:2,to:4},{from:5,to:7}]);
  assert.deepEqual(findText('İ x X','x'),[{from:2,to:3},{from:4,to:5}]);
  assert.deepEqual(findText('aaa','aa'),[{from:0,to:2}]);
  assert.deepEqual(findText('one\ntwo','one\ntwo'),[{from:0,to:7}]);
});
