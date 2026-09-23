import test from 'node:test';
import assert from 'node:assert/strict';
import {insertionBlocks} from '../src/shared/block-ranges';
import {insertBlock,makeToc} from '../src/shared/authoring';

for(const eol of ['\n','\r\n'])test('insertion never splits a navigation anchor from its target '+JSON.stringify(eol),()=>{
  const target=['<a id="first"></a>','','<a name="second"></a>','','## Target'].join(eol);
  let source='> Conclusion'+eol+eol+target+eol+eol+'Body';
  for(const content of ['New paragraph',makeToc('## Target'),'| A |\n|---|\n| B |']){
    const blocks=insertionBlocks(source),bound=blocks.findIndex(b=>source.slice(b.from,b.to)===target);assert.ok(bound>0);
    const positions=[0,...blocks.map(b=>b.to)];assert.ok(!positions.some(p=>p>source.indexOf('<a id=')&&p<source.indexOf('## Target')));
    const edit=insertBlock(source,blocks[bound-1].to,content);source=source.slice(0,edit.from)+edit.insert+source.slice(edit.to);
    assert.ok(source.includes(target));assert.ok(source.indexOf(content)<source.indexOf('<a id='));
  }
});
test('document-start anchors, frontmatter, containers and trailing block IDs remain indivisible',()=>{
  const anchor='<a id="top"></a>\n\n# Title';assert.equal(insertionBlocks(anchor)[0].focus,anchor.indexOf('# Title'));assert.equal(insertionBlocks(anchor).length,1);
  const source='---\ntitle: Test\n---\n\n'+anchor+'\n\n<div>\n\nInner\n\n</div>\n\n^block-id';const blocks=insertionBlocks(source);assert.equal(blocks.length,3);assert.ok(blocks[0].yaml);assert.ok(source.slice(blocks[2].from,blocks[2].to).endsWith('^block-id'));
});
