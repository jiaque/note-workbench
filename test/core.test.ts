import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReplacements, minimalEdit } from '../src/shared/edits';
import { renderDocument } from '../src/shared/render';
import { updatedTable } from '../src/shared/tables';
import { validEdit } from '../src/shared/protocol';

const md = '---\r\ntitle: original\r\n---\r\n\r\n| A | B |\r\n| :--- | ---: |\r\n| 一 | 二 |\r\n| 三 | 四 |\r\n\r\n<!-- untouched -->';
const html = '<!-- before -->\n\n<table id="keep"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr data-x="keep"><td>one</td><td><strong>two</strong></td></tr><tr><td>three</td><td>four</td></tr></tbody></table>\n\nTAIL';
const first = (source: string) => renderDocument(source).tables[0];
test('rendering never mutates source and renders Markdown, HTML, math', () => {
  const before = md;
  assert.ok(renderDocument(md).blocks.length);
  assert.equal(md, before);
  const output = renderDocument('**bold** <mark>hello</mark> $x^2$').blocks.map(b => b.html).join('');
  assert.match(output, /<strong>bold<\/strong>/); assert.match(output, /<mark>hello<\/mark>/); assert.match(output, /<svg/);
});
test('HTML scripts, event handlers and javascript links cannot reach rendering', () => {
  const output = renderDocument('<div onclick="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">link</a></div>').blocks.map(b => b.html).join('');
  assert.doesNotMatch(output, /<script|onclick=|href="javascript:/);
});
test('Markdown move column carries header, alignment and cells; outside bytes retained', () => {
  const table = first(md), changed = updatedTable(md, table, { kind: 'moveColumn', from: 0, to: 1 });
  assert.ok(changed.startsWith(md.slice(0, table.from))); assert.ok(changed.endsWith(md.slice(table.to)));
  assert.match(changed, /\| B \| A \|\r\n\| ---: \| :--- \|/);
  assert.equal(updatedTable(changed, first(changed), { kind: 'moveColumn', from: 1, to: 0 }), md);
});
test('Markdown row moves preserve header and undo by inverse operation', () => {
  const next = updatedTable(md, first(md), { kind: 'moveRow', from: 1, to: 2 });
  assert.match(next, /\| 三 \| 四 \|\r\n\| 一 \| 二 \|/);
  assert.equal(updatedTable(next, first(next), { kind: 'moveRow', from: 2, to: 1 }), md);
  assert.throws(() => updatedTable(md, first(md), { kind: 'moveRow', from: 0, to: 1 }));
});
test('HTML moves preserve source attributes, rich cell content and outside bytes', () => {
  const changed = updatedTable(html, first(html), { kind: 'moveColumn', from: 0, to: 1 });
  assert.match(changed, /<th>B<\/th><th>A<\/th>/);
  assert.match(changed, /<tr data-x="keep"><td><strong>two<\/strong><\/td><td>one<\/td>/);
  assert.equal(updatedTable(changed, first(changed), { kind: 'moveColumn', from: 1, to: 0 }), html);
  assert.throws(() => updatedTable(html, first(html), { kind: 'moveRow', from: 0, to: 1 }));
});
test('Markdown insert/delete restore rectangular table', () => {
  let value = updatedTable(md, first(md), { kind: 'insertColumn', at: 1 });
  assert.equal(first(value).rows[1].cells.length, 3);
  value = updatedTable(value, first(value), { kind: 'deleteColumn', column: 1 }); assert.equal(value, md);
  value = updatedTable(md, first(md), { kind: 'insertRow', at: 2, row: 1 });
  value = updatedTable(value, first(value), { kind: 'deleteRow', row: 2 }); assert.equal(value, md);
});
test('escaped pipes survive moves and accidental pipes cannot corrupt cells', () => {
  const source = '| A | B |\n| --- | --- |\n| a\\|b | `c\\|d` |';
  assert.equal(first(source).rows[1].cells.length, 2);
  const changed = updatedTable(source, first(source), { kind: 'moveColumn', from: 0, to: 1 });
  assert.match(changed, /`c\\\|d`/);
  const typed = updatedTable(source, first(source), { kind: 'setCell', row: 1, column: 0, text: 'x|y' });
  assert.equal(first(typed).rows[1].cells.length, 2); assert.match(typed, /x\\\|y/);
});
test('merged HTML tables are protected from structural edits', () => {
  const source = '<table><tr><td colspan="2">X</td></tr><tr><td>A</td><td>B</td></tr></table>';
  assert.ok(first(source).reason);
  assert.throws(() => updatedTable(source, first(source), { kind: 'deleteColumn', column: 0 }));
});
test('range checks reject stale, overlapping, negative and out-of-bounds edits', () => {
  for (const edit of [{ from: -1, to: 0, expectedText: '', insert: '' }, { from: 0, to: 8, expectedText: 'abc', insert: '' }, { from: 0, to: 1, expectedText: 'z', insert: '' }]) assert.throws(() => applyReplacements('abc', [edit]));
  assert.throws(() => applyReplacements('abc', [{ from: 0, to: 2, expectedText: 'ab', insert: '' }, { from: 1, to: 2, expectedText: 'b', insert: '' }]));
  assert.equal(validEdit({ type: 'edit', baseVersion: 1, operationId: 'a', replacements: [{}] }), false);
});
test('minimal patches preserve Unicode and CRLF', () => {
  for (const [a, b] of [['a😀b\r\n末尾', 'a😁b\r\n末尾'], ['', '中文'], ['abc', 'abc'], ['abc', '']]) assert.equal(applyReplacements(a, minimalEdit(a, b)), b);
});
