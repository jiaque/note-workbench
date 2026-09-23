import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState,Transaction} from '@codemirror/state';
import {historySelection} from '../src/webview/history-selection';
import {minimalEdit} from '../src/shared/edits';
import {inlineFormatEdit} from '../src/shared/formatting';

test('host undo and redo retain formatting selection for the next toolbar action',()=>{
  let state=EditorState.create({doc:'before 中文文字 after',selection:{anchor:7,head:11},extensions:historySelection});
  const initial=state.doc.toString();
  const apply=()=>{const s=state.selection.main,e=inlineFormatEdit(state.doc.toString(),s.from,s.to,'**')!;state=state.update({changes:{from:e.from,to:e.to,insert:e.insert},selection:{anchor:e.anchor,head:e.head},userEvent:'input'}).state;};
  apply();const bold=state.doc.toString();
  for(let i=0;i<3;i++){
    state=state.update({changes:minimalEdit(state.doc.toString(),initial),annotations:Transaction.remote.of(true)}).state;
    assert.equal(state.sliceDoc(state.selection.main.from,state.selection.main.to),'中文文字');
    apply();assert.equal(state.doc.toString(),bold);
  }
  state=state.update({changes:minimalEdit(bold,initial),annotations:Transaction.remote.of(true)}).state;
  state=state.update({changes:minimalEdit(initial,bold),annotations:Transaction.remote.of(true)}).state;
  assert.equal(state.sliceDoc(state.selection.main.from,state.selection.main.to),'中文文字');apply();assert.equal(state.doc.toString(),initial);
});
