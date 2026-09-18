import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {LiveSync} from '../src/shared/live-sync';
import {applyReplacements,minimalEdit} from '../src/shared/edits';
import {hostEdits,normalizeSnapshot} from '../src/shared/line-endings';
import {livePreview,renderedBlocks,previewFocus} from '../src/webview/live-preview';
import {renderDocument} from '../src/shared/render';

test('late acknowledgements retain subsequent typing and send the next minimal edit',()=>{
  const sync=new LiveSync();sync.accept('one',1);sync.local='one two';
  const first=sync.next('a')!;assert.equal(first.baseVersion,1);
  sync.local='one two 三';assert.equal(sync.next('b'),undefined);
  assert.equal(sync.accept('one two',2),'ignore');
  assert.equal(sync.accept('one two',2,'a'),'ack');
  assert.equal(sync.local,'one two 三');
  const second=sync.next('b')!;assert.equal(second.baseVersion,2);
  assert.equal(applyReplacements('one two',second.replacements),'one two 三');
  sync.accept('one two 三',3,'b');assert.equal(sync.next('c'),undefined);
});
test('external conflicts preserve local input and stop overwrites; clean external undo is accepted',()=>{
  const sync=new LiveSync();sync.accept('a',1);sync.local='ab';sync.next('x');
  assert.equal(sync.accept('external',2),'conflict');assert.equal(sync.local,'ab');assert.equal(sync.next('y'),undefined);
  const clean=new LiveSync();clean.accept('ab',3);assert.equal(clean.accept('a',4),'external');assert.equal(clean.local,'a');
  assert.equal(clean.accept('old',2),'ignore');assert.equal(clean.local,'a');
});
test('CRLF host offsets and table ranges retain original newline bytes',()=>{
  const source='# 标题\r\n\r\n段落 😀\r\n\r\n| A | B |\r\n|---|---|\r\n| C | D |\r\n';
  const message={type:'snapshot' as const,source,version:1,name:'test',readonly:false,...renderDocument(source)};
  const normalized=normalizeSnapshot(message);
  assert.equal(normalized.source.includes('\r'),false);
  const desired=normalized.source.replace('段落 😀','段落 😀增加\n一行');
  assert.equal(applyReplacements(source,hostEdits(source,minimalEdit(normalized.source,desired))),desired.replace(/\n/g,'\r\n'));
  const table=normalized.tables[0];assert.equal(normalized.source.slice(table.from,table.to),source.slice(message.tables[0].from,message.tables[0].to).replace(/\r\n/g,'\n'));
});
test('live preview reveals only the selected formatting and preserves one source document',()=>{
  const source='## Heading\n\n**bold** and *emphasis*\n\nOther paragraph';
  let state=EditorState.create({doc:source,extensions:livePreview(()=>{throw Error('DOM is not used in state test');})});
  state=state.update({effects:renderedBlocks.of(renderDocument(source).blocks)}).state;
  const decorations=()=>state.facet(EditorView.decorations).flatMap(set=>{const ranges:any[]=[];if(typeof set!=='function')set.between(0,state.doc.length,(from,to,value)=>{ranges.push({from,to,value});});return ranges;});
  assert.equal(decorations().filter(r=>r.value.spec.widget).length,3);
  state=state.update({selection:{anchor:source.indexOf('bold')+1},effects:previewFocus.of(true)}).state;
  const ranges=decorations();
  assert.ok(ranges.some(r=>r.value.spec.class==='live-strong'));
  assert.ok(!ranges.some(r=>r.from===source.indexOf('**') && r.to===source.indexOf('bold')));
  assert.ok(ranges.some(r=>r.from===source.indexOf('*emphasis*') && r.to===source.indexOf('emphasis')));
  assert.equal(state.doc.toString(),source);
  state=state.update({changes:{from:source.indexOf('bold')+4,insert:'中文'}}).state;
  assert.ok(state.doc.toString().includes('bold中文'));
});
