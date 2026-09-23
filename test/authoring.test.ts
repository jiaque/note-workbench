import test from 'node:test';
import assert from 'node:assert/strict';
import {insertBlock,makeToc,managedTocs,tocUpdates,pastedLink} from '../src/shared/authoring';
import {renderDocument} from '../src/shared/render';

test('managed TOC shares renderer heading identifiers and ignores nested/code/excluded headings',()=>{
  const source='# Title\n\n## <span style="color:red">重复</span>\n\n## 重复\n\n### 子节\n\n> ## Nested\n\n```md\n## Code\n```\n\n## Hidden <!-- nw:toc-ignore -->';
  const toc=makeToc(source);assert.match(toc,/重复\]\(#%E9%87%8D%E5%A4%8D\)/);assert.match(toc,/重复\]\(#%E9%87%8D%E5%A4%8D-1\)/);assert.match(toc,/  - \[子节\]/);assert.doesNotMatch(toc,/Nested|Code|Hidden|Title/);
  const rendered=renderDocument(source).blocks.map(b=>b.html).join('');assert.match(rendered,/id="user-content-重复-1"/);
  const doc=toc+'\n\n'+source;assert.equal(managedTocs(doc).length,1);assert.deepEqual(tocUpdates(doc),[]);
  assert.equal(tocUpdates(doc+'\n\n## New').length,1);
  const manual=makeToc(source,{min:1,max:6,auto:false})+'\n\n'+source+'\n\n## Later';assert.equal(tocUpdates(manual).length,0);assert.equal(tocUpdates(manual,true).length,1);
  assert.equal(managedTocs('```html\n'+toc+'\n```').length,0);
  assert.match(makeToc('## $x^2$'),/\[x\^2\]\(#x%5E2\)/);
});
test('block insertion stays outside surrounding fences and creates a real editable paragraph',()=>{
  for(const source of ['','before','```js\ncode\n```\n\nafter','| A | B |\n|---|---|\n| 1 | 2 |\n\nafter']){
    const at=source.includes('\n\nafter')?source.indexOf('\n\nafter'):source.length;
    const edit=insertBlock(source,at,'');const result=source.slice(0,at)+edit.insert+source.slice(at);
    assert.equal(result[edit.anchor],'\n');assert.ok(edit.anchor>=at);assert.ok(!result.includes('\u200b'));
  }
});
test('URL paste only replaces prose and escapes link labels',()=>{
  assert.equal(pastedLink('hello',0,5,'https://example.com/a(b)'), '[hello](<https://example.com/a(b)>)');
  for(const text of ['`hello`','[hello](https://example.com)','<div>hello</div>','```\nhello\n```']){const at=text.indexOf('hello');assert.equal(pastedLink(text,at,at+5,'https://example.com'),undefined);}
  assert.equal(pastedLink('hello',0,5,'javascript:alert(1)'),undefined);assert.equal(pastedLink('hello',0,0,'https://example.com'),undefined);
});
test('preview source mapping distinguishes repeated text and never leaks into normal output',()=>{
  const source='same **same** same &amp; end';const html=renderDocument(source,true).blocks[0].html;
  assert.match(html,/data-nw-text="0"/);assert.match(html,/data-nw-text="7"/);assert.match(html,/data-nw-text="13"/);
  assert.doesNotMatch(renderDocument(source).blocks[0].html,/data-nw-(?:text|from|end)/);
  assert.doesNotMatch(renderDocument('<span data-nw-text="123">x</span>',true).blocks[0].html,/data-nw-text="123"/);
});
