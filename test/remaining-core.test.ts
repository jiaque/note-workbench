import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noteCandidates,noteMetadata,wikiCompletions} from '../src/shared/note-links';
import {buildGraph,noteOccurrences} from '../src/shared/graph';
import {newMarkdownTable,markdownTable,htmlTables,updatedTable} from '../src/shared/tables';
import {pdfHtml} from '../src/pdf/export';
import {blockRemoteImages} from '../src/shared/remote-images';
import {renderDocument} from '../src/shared/render';

const notes=[{id:'file:///vault/A.md',name:'A.md',path:'A.md',source:'[[别名]]\nagain [[B]]'},
  {id:'file:///vault/folder/B.md',name:'B.md',path:'folder/B.md',source:'---\naliases: [别名, Other]\n---\n# 标题\n正文 ^block-id\n```md\n# hidden\n```'}];
test('wiki completions resolve aliases, headings and block IDs without inventing code headings',()=>{
  assert.deepEqual(noteMetadata(notes[1].source),{aliases:['别名','Other'],headings:['标题'],blocks:['block-id']});
  assert.equal(noteCandidates(notes,notes[0].id,'别名')[0].id,notes[1].id);
  assert.equal(wikiCompletions(notes,notes[0].id,'别名')[0].insert,'folder/B|别名');
  assert.equal(wikiCompletions(notes,notes[0].id,'B#标')[0].insert,'B#标题');
  assert.equal(wikiCompletions(notes,notes[0].id,'B#^bl')[0].insert,'B#^block-id');
  assert.deepEqual(wikiCompletions(notes,notes[0].id,'B#hidden'),[]);
});
test('same-name resolution is explicit; exact relative path wins',()=>{
  const extra={...notes[1],id:'file:///vault/other/B.md',path:'other/B.md'};
  assert.equal(noteCandidates([...notes,extra],notes[0].id,'B').length,2);
  assert.equal(noteCandidates([...notes,extra],notes[0].id,'other/B')[0].id,extra.id);
});
test('backlinks retain every occurrence and navigate UTF-16 source offset',()=>{
  const source='中文😀 [[B]] and [[B#标题]]\n\n`[[hidden]]`';
  const occurrences=noteOccurrences(source);assert.equal(occurrences.length,2);
  for(const item of occurrences)assert.equal(source.slice(item.offset,item.offset+2),'[[');
  const graph=buildGraph([{...notes[0],source},notes[1]]);assert.equal(graph.links.length,1);assert.equal(graph.links[0].occurrences?.length,2);
  assert.equal(buildGraph(notes).links[0].target,notes[1].id);
});
test('new Markdown tables retain valid header-only state after deleting final data row',()=>{
  const source=newMarkdownTable(1,2),table=markdownTable(source,0,source.length);
  assert.equal(table.rows.length,2);const result=updatedTable(source,table,{kind:'deleteRow',row:1});
  assert.equal(markdownTable(result,0,result.length).rows.length,1);assert.throws(()=>newMarkdownTable(0,2));
});
test('HTML colgroup definition, cell attributes and outside bytes move together',()=>{
  const source='before\n<table><colgroup><col style="width:20%"><col class="wide" style="width:80%"></colgroup><tr><th>A</th><th>B</th></tr><tr><td id="one">1</td><td>2</td></tr></table>\nafter';
  const table=htmlTables(source,0,source.length)[0];assert.equal(table.reason,undefined);
  const result=updatedTable(source,table,{kind:'moveColumn',from:0,to:1});
  assert.match(result,/<col class="wide" style="width:80%"><col style="width:20%">/);assert.match(result,/<td>2<\/td><td id="one">1<\/td>/);
  assert.equal(updatedTable(result,htmlTables(result,0,result.length)[0],{kind:'moveColumn',from:1,to:0}),source);
  const added=updatedTable(source,table,{kind:'insertColumn',at:1});assert.equal(htmlTables(added,0,added.length)[0].columns?.length,3);
  assert.equal(updatedTable(added,htmlTables(added,0,added.length)[0],{kind:'deleteColumn',column:1}),source);
});
test('remote image setting is enforced by PDF content security policy',()=>{
  assert.match(pdfHtml('test','',[],[],false),/img-src 'self' data: ;/);
  assert.match(pdfHtml('test',''),/img-src 'self' data: https:/);
});
test('disabled remote images produce a placeholder without modifying local images',()=>{
  const rendered=renderDocument('![Remote](https://example.com/a.png) ![Local](a.png)');blockRemoteImages(rendered);
  assert.doesNotMatch(rendered.blocks[0].html,/https:\/\/example.com/);assert.match(rendered.blocks[0].html,/已关闭远程图片/);assert.match(rendered.blocks[0].html,/src="a.png"/);
});
test('HTML colgroup survives sanitization while executable attributes are removed',()=>{
  const rendered=renderDocument('<table><colgroup><col style="width:25%" onclick="bad()"><col style="width:75%"></colgroup><tr><td>A</td><td>B</td></tr></table>');
  assert.match(rendered.blocks[0].html,/<colgroup>/);assert.match(rendered.blocks[0].html,/width:25%/);assert.doesNotMatch(rendered.blocks[0].html,/onclick/);
});
test('implicit colgroups and span definitions remain source-safe',()=>{
  for(const source of ['<table><col><tr><td>A</td></tr></table>','<table><colgroup><col span="2"></colgroup><tr><td>A</td><td>B</td></tr></table>'])assert.ok(htmlTables(source,0,source.length)[0].reason);
});
test('heading completion includes nested paths and excludes comments',()=>{
  const metadata=noteMetadata('# Parent\n\nChild\n-----\n\n%%\n# Hidden\n%%\n\nText \\^escaped');
  assert.deepEqual(metadata.headings,['Parent','Child','Parent#Child']);assert.deepEqual(metadata.blocks,[]);
});
