import test from 'node:test';
import assert from 'node:assert/strict';
import {inlineFormatEdit} from '../src/shared/formatting';
import {renderDocument} from '../src/shared/render';
function toggle(source:string,from:number,to:number,mark='**'){
  const edit=inlineFormatEdit(source,from,to,mark)!;
  return {...edit,source:source.slice(0,edit.from)+edit.insert+source.slice(edit.to)};
}
test('repeated inline formatting removes outside markers and preserves the text selection',()=>{
  for(const mark of ['**','*','~~','`']){
    const first=toggle('before text after',7,11,mark),second=toggle(first.source,first.anchor,first.head,mark);
    assert.equal(second.source,'before text after');assert.equal(second.source.slice(second.anchor,second.head),'text');
  }
  assert.equal(toggle('**text**',0,8).source,'text');
  const empty=toggle('',0,0);assert.equal(empty.source,'****');assert.equal(toggle(empty.source,empty.anchor,empty.head).source,'');
});
test('punctuation next to Chinese/Latin text renders strong without inserting spaces',()=>{
  for(const [source,text] of [['前文（重点）后文','（重点）'],['前文重点：后文','重点：'],['before(test)after','(test)'],['前文重点后文','重点'],['文字 重点 后文','重点']]){
    const from=source.indexOf(text),first=toggle(source,from,from+text.length);
    const html=renderDocument(first.source).blocks.map(b=>b.html).join('');
    assert.ok(html.includes(`<strong>${text}</strong>`),html);
    assert.equal(toggle(first.source,first.anchor,first.head).source,source);
  }
});
test('whitespace stays outside markers and nested italic survives toggling bold',()=>{
  const first=toggle('before text after',6,12);assert.equal(first.source,'before **text** after');
  assert.equal(toggle(first.source,first.anchor,first.head).source,'before text after');
  assert.equal(toggle('***text***',3,7).source,'*text*');
  assert.equal(inlineFormatEdit('   ',0,3,'**'),undefined);
});
