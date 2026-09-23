import test from 'node:test';
import assert from 'node:assert/strict';
import {deletableBlocks} from '../src/shared/block-ranges';
import {deleteBlockEdit,makeToc} from '../src/shared/authoring';

const examples:Record<string,string>={
  paragraph:'Text with **bold** and [link](https://example.com).',
  heading:'## <span style="color:red">Heading</span>',
  callout:'> [!success]+ Conclusion\n> 1. **First**\n> 2. Second',
  nestedCallout:'> [!note]+ Outer\n>\n> > [!tip]- Inner\n> > Body\n>\n> | A | B |\n> |---|---|\n> | 1 | 2 |',
  table:'| A | B |\n|---|---|\n| `x` | **y** |',
  tasks:'- [ ] One\n- [x] Two\n  - Nested',
  code:'```html\n<div>\n\n<a id="inside"></a>\n</div>\n```',
  math:'$$\nx + y\n$$',
  image:'![Image](figures/中文.svg)',
  svg:'<svg viewBox="0 0 10 10">\n\n<circle cx="5" cy="5" r="3"/>\n\n</svg>',
  details:'<details>\n<summary>Title</summary>\n\nText\n\n<div>\n\nNested\n\n</div>\n\n</details>',
  html:'<div class="box">\n\nFirst\n\nSecond\n\n</div>',
  htmlTable:'<table>\n<tr><td>Cell</td></tr>\n\n</table>',
  toc:makeToc('## Heading'),
  blockId:'> Quote\n\n^quote-id',
  anchor:'<a id="section"></a>\n\n## Section',
};
for(const [name,content] of Object.entries(examples))for(const eol of ['\n','\r\n'])test(`delete entire ${name}, preserve neighbors and support exact inverse (${JSON.stringify(eol)})`,()=>{
  const block=content.replace(/\n/g,eol),source='Before'+eol+eol+block+eol+eol+'After';
  const ranges=deletableBlocks(source);assert.equal(ranges.length,3);const range=ranges[1];assert.equal(source.slice(range.from,range.to),block);
  const edit=deleteBlockEdit(source,range.from,range.to),result=source.slice(0,edit.from)+edit.insert+source.slice(edit.to);
  assert.equal(result,'Before'+eol+eol+'After');
  assert.equal(result.slice(0,edit.from)+source.slice(edit.from,edit.to)+result.slice(edit.from+edit.insert.length),source);
});
test('next-section navigation anchor survives deleting previous callout, with focus on heading',()=>{
  const source='[Trend](#trend)\n\n'+examples.callout+'\n\n<a id="trend"></a>\n\n## Trend\n\nBody';
  const ranges=deletableBlocks(source),edit=deleteBlockEdit(source,ranges[1].from,ranges[1].to);
  const result=source.slice(0,edit.from)+edit.insert+source.slice(edit.to);
  assert.ok(result.includes('<a id="trend"></a>'));assert.equal(source.slice(ranges[2].focus,ranges[2].focus+8),'## Trend');
  assert.equal(result,'[Trend](#trend)\n\n<a id="trend"></a>\n\n## Trend\n\nBody');
});
test('frontmatter, unrelated comments and shared references are retained',()=>{
  const source='---\ntitle: Title\n---\n\nText\n\n<!-- keep -->\n\n[shared]: https://example.com';
  const range=deletableBlocks(source).find(b=>source.slice(b.from,b.to)==='Text')!;
  const edit=deleteBlockEdit(source,range.from,range.to),result=source.slice(0,edit.from)+edit.insert+source.slice(edit.to);
  assert.ok(result.startsWith('---\ntitle: Title\n---'));assert.ok(result.includes('<!-- keep -->'));assert.ok(result.includes('[shared]:'));
});
