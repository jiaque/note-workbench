import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownTable,htmlTables,rebaseUnchangedTable,editTable} from '../src/shared/tables';
import {applyReplacements} from '../src/shared/edits';
for(const content of ['| A | B |\n|---|---|\n| 1 | 2 |','<table><tr><td>A</td><td>B</td></tr></table>'])test('table actions rebase unrelated edits safely: '+content.slice(0,6),()=>{
  const before='Before\n\n'+content+'\n\nAfter',table=content.startsWith('|')?markdownTable(before,8,8+content.length):htmlTables(before,8,8+content.length)[0];
  for(const prefix of ['Before\n\n','Changed prefix\n\n']){const current=prefix+content+'\n\nChanged suffix',rebased=rebaseUnchangedTable(table,before,current,prefix.length);
    for(const op of [{kind:'insertRow',at:table.rows.length,row:table.rows.length-1},{kind:'insertColumn',at:2}] as const){const result=applyReplacements(current,editTable(current,rebased,op));assert.ok(result.startsWith(prefix));assert.ok(result.endsWith('\n\nChanged suffix'));assert.notEqual(result,current);}
  }
  assert.throws(()=>rebaseUnchangedTable(table,before,before.replace('A','Z'),8));
});
