import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGraph,noteTargets} from '../src/shared/graph';
import {activePreviewBlock} from '../src/webview/block-preview';

test('graph parses note links and embeds, excludes code, comments, math and YAML',()=>{
  const source='---\nexample: "[[Metadata]]"\n---\n\n[[Second#Heading|label]] ![[Third]] [Fourth](Fourth.md) ![embed](Fifth.md)\n\n`[[Code]]`\n\n```md\n[[Fence]]\n```\n\n%% [[Comment]] %%\n\n$[[Math]]$\n\n<a href="Sixth.md#block">six</a> <!-- <a href="Hidden.md">hidden</a> -->';
  assert.deepEqual(noteTargets(source),['Second#Heading','Third','Fourth.md','Fifth.md','Sixth.md#block']);
});
test('graph resolves relative paths and unique basenames, isolates unresolved notes and deduplicates edges',()=>{
  const notes=[{id:'file:///vault/A.md',name:'A.md',path:'A.md',source:'[[folder/B]] [[B#Heading]] [[Missing]] ![[image.png]] [web](https://example.com)'},{id:'file:///vault/folder/B.md',name:'B.md',path:'folder/B.md',source:'[A](../A.md)'}];
  const result=buildGraph(notes,notes[0].id);
  assert.equal(result.nodes.length,3);assert.equal(result.links.length,3);
  assert.ok(result.links.some(l=>l.source===notes[0].id&&l.target===notes[1].id));
  assert.ok(result.links.some(l=>l.source===notes[1].id&&l.target===notes[0].id));
  assert.equal(result.nodes.filter(n=>n.missing)[0].name,'Missing');
  const changed=buildGraph([{...notes[0],source:''},notes[1]]);assert.equal(changed.links.length,1);
});
test('block preview chooses full callout context and excludes table editing',()=>{
  const source='# title\n\n> [!note] Title\n> **body**\n\n| A | B |\n|---|---|\n| 1 | 2 |';
  const callout=activePreviewBlock(source,source.indexOf('body'))!;
  assert.equal(source.slice(callout.from,callout.to),'> [!note] Title\n> **body**');
  assert.equal(activePreviewBlock(source,source.indexOf('1 |')),undefined);
});

test('graph resolves escaped table aliases and Windows/file URI links within indexed notes',()=>{
  const notes=[{id:'file:///D:/vault/A.md',name:'A.md',path:'A.md',source:'| link |\n|---|\n| [[B\\|label]] |\n\n<a href="file:///d:/vault/B.md">B</a>\n\n<a href="D:\\vault\\B.md">B</a>'},{id:'file:///D:/vault/B.md',name:'B.md',path:'B.md',source:''}];
  const result=buildGraph(notes);assert.equal(result.nodes.length,2);assert.deepEqual(result.links.map(({source,target})=>({source,target})),[{source:notes[0].id,target:notes[1].id}]);assert.equal(result.links[0].occurrences?.length,3);
});
