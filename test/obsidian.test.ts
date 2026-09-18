import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { renderDocument } from '../src/shared/render';
const html = (source: string) => renderDocument(source).blocks.map(block => block.html).join('');
const elements = (markup: string, tag: string): any[] => {
  const found: any[] = []; const walk = (node: any) => { if (node.tagName === tag) found.push(node); for (const child of node.childNodes ?? []) walk(child); }; walk(parseFragment(markup)); return found;
};
test('Obsidian inline syntax respects code, escaping, HTML and nested emphasis', () => {
  const output = html('==**Highlighted** text== and [[Note#Title|label]] and ![[image.png|120x80]]\n\n`==code== [[literal]]` and \\==escaped==\n\n<div>==HTML literal==</div>');
  assert.match(output, /<mark><strong>Highlighted<\/strong> text<\/mark>/);
  assert.match(output, /href="nw-note:Note%23Title"/);
  assert.match(output, /width="120" height="80"/);
  assert.match(output, /<code>==code== \[\[literal\]\]<\/code>/);
  assert.match(output, /==escaped==/); assert.match(output, /<div>==HTML literal==<\/div>/);
});
test('comments disappear without changing source positions or protected code', () => {
  const source = 'before %%hidden%% after\n\n%%\n# invisible\n\nmore\n%%\n\n`%%literal%%`\n\n# Visible';
  const result = renderDocument(source), output = result.blocks.map(b => b.html).join('');
  assert.doesNotMatch(output, /hidden|invisible|more/); assert.match(output, /%%literal%%/);
  const heading = result.blocks.find(b=>b.kind==='heading')!; assert.equal(source.slice(heading.from,heading.to),'# Visible');
});
test('footnotes have one document-wide section and unique reference identifiers', () => {
  const output = html('First[^a]. Inline ^[**inline** note].\n\nSecond[^b]. Again[^a].\n\n[^a]: First note\n[^b]: Second note');
  assert.equal(elements(output,'section').filter(n=>n.attrs.some((a:any)=>a.name==='data-footnotes')).length,1);
  const ids = elements(output,'a').flatMap(n=>n.attrs.filter((a:any)=>a.name==='id').map((a:any)=>a.value)); assert.equal(new Set(ids).size,ids.length);
  assert.match(output, /<strong>inline<\/strong> note/);
});
test('all official callout types and aliases have icons and canonical colors', () => {
  const groups = { blue:['note','info','todo'], cyan:['abstract','summary','tldr','tip','hint','important'], green:['success','check','done'], orange:['question','help','faq','warning','caution','attention'], red:['failure','fail','missing','danger','error','bug'], purple:['example'], gray:['quote','cite'] };
  for (const [color,types] of Object.entries(groups)) for (const type of types) {
    const output = html(`> [!${type.toUpperCase()}]- Title\n> Body`);
    assert.match(output,new RegExp(`data-callout-color="${color}"`)); assert.match(output,/class="callout-icon"/); assert.doesNotMatch(output,/<details[^>]+ open/);
  }
  assert.match(html('> [!unknown] Title'), /data-callout-color="blue"/);
});
test('heading and block references get destinations and hidden block markers', () => {
  const output = html('# Heading\n\nA block ^my-id\n\n- a\n- b\n\n^list-id\n\n[[#Heading]] [[#^my-id]]');
  assert.match(output,/id="user-content-Heading"/); assert.match(output,/id="user-content-\^my-id"/); assert.match(output,/<ul id="user-content-\^list-id"/);
  assert.doesNotMatch(output,/A block \^my-id/);
});
test('nonstandard completed task marks and task offsets remain editable', () => {
  const source = '- [ ] todo\n- [x] done\n- [?] maybe\n- [-] cancelled';
  const output = html(source); assert.equal(elements(output,'input').length,4);
  for (const li of elements(output,'li')) { const offset = Number(li.attrs.find((a:any)=>a.name==='data-task-offset').value); assert.ok([' ','x','?','-'].includes(source[offset])); }
});
test('code highlighting, YAML properties and image sizes render independently', () => {
  const output = html('---\ntags: [one, two]\ndone: true\n---\n\n```python\nprint("Hello")\n```\n\n![Alt|80](picture.png)');
  assert.match(output,/class="properties"/); assert.match(output,/class="token/); assert.match(output,/width="80"/);
});

test('tags support nesting and Unicode while numbers and escaped tags stay literal',()=>{
  const output=html('#工作/笔记 #tag #1984 \\#literal `#code`');
  assert.equal(elements(output,'a').length,2);assert.match(output,/#1984 #literal/);assert.match(output,/<code>#code<\/code>/);
});

test('escaped block markers remain visible and cssclasses are scoped note metadata',()=>{
  assert.match(html('Text \\^literal'),/Text \^literal/);
  const result=renderDocument('---\ncssclasses: [wide, report, "invalid class"]\n---\n# Heading');assert.deepEqual(result.classes,['wide','report']);
});

test('extended MathJax notation renders matrices, cancellation and color',()=>{
  const output=html('$$\n\\cancel{x}+\\color{red}{y}+\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\n$$');
  assert.match(output,/<svg/);assert.doesNotMatch(output,/<g[^>]*data-mml-node="merror"|Undefined control sequence/);
});
