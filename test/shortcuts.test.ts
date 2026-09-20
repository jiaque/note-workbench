import test from 'node:test';
import assert from 'node:assert/strict';
import {noteShortcut} from '../src/webview/shortcuts';
const key=(key:string,extra:Record<string,boolean>={})=>({key,ctrlKey:true,metaKey:false,altKey:false,shiftKey:false,isComposing:false,...extra});
test('note shortcuts distinguish save/undo/view from VS Code modified chords',()=>{
  assert.equal(noteShortcut(key('s')),'save');assert.equal(noteShortcut(key('e')),'toggleView');
  assert.equal(noteShortcut(key('z')),'undo');assert.equal(noteShortcut(key('z',{shiftKey:true})),'redo');assert.equal(noteShortcut(key('y')),'redo');
  assert.equal(noteShortcut(key('S',{ctrlKey:false,metaKey:true})),'save');
  for(const event of [key('s',{shiftKey:true}),key('e',{shiftKey:true}),key('s',{altKey:true}),key('z',{isComposing:true}),key('s',{ctrlKey:false}),key('b')])assert.equal(noteShortcut(event),undefined);
});
