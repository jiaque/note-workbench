import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noteTags,groupTags} from '../src/shared/tags';
import {renameLinkEdits} from '../src/shared/rename-links';
import type {NoteEntry} from '../src/shared/note-links';
const note=(path:string,source=''):NoteEntry=>({id:new URL(path,'file:///vault/').href,name:path.split('/').pop()!,path,source});
function updated(source:string,others:NoteEntry[],renames:{oldId:string;newId:string}[],path='A.md'){
  const n=note(path,source),result=renameLinkEdits(n,[n,...others],renames);for(const e of result.edits.reverse())source=source.slice(0,e.from)+e.insert+source.slice(e.to);return {source,ambiguous:result.ambiguous};
}
test('tags combine YAML and inline tags, deduplicate and exclude literals',()=>{
  const source='---\ntags: [项目/研发, Work, work]\n---\n# Heading\n#项目/研发 #work #new #123\n`#code`\n\n```md\n#fence\n```\n\n%% #hidden %%\n\n<span title="#attribute">#html</span>\n\n$#math$';
  assert.deepEqual(noteTags(source).sort(),['html','new','work','项目/研发'].sort());
  assert.equal(groupTags([note('a.md',source),note('b.md','#work #work')]).find(x=>x.tag==='work')?.notes.length,2);
});
test('rename preserves aliases, fragments, titles, HTML and reference definitions',()=>{
  const source='[[B#Heading|别名]] ![[B#^block]]\n\n[B](B.md "title") [ref][b]\n\n[b]: <B.md#x> "title"\n\n<a href="B.md#x">B</a>\n\n`[[B]]`\n\n```md\n[[B]]\n```\n\n%% [[B]] %%';
  const result=updated(source,[note('B.md')],[{oldId:note('B.md').id,newId:note('C.md').id}]).source;
  assert.equal(result,source.replace('[[B#Heading|','[[C#Heading|').replace('![[B#^','![[C#^').replace('(B.md ','(C.md ').replace('<B.md#','<C.md#').replace('href="B.md#','href="C.md#'));
});
test('moving notes rebases outbound notes and attachments; folder moves preserve links',()=>{
  const change=[{oldId:note('A.md').id,newId:note('sub/A.md').id}];
  assert.equal(updated('[B](B.md) ![image](images/x.png) [[B]]',[note('B.md')],change).source,'[B](../B.md) ![image](../images/x.png) [[B]]');
  const changes=[{oldId:'file:///vault/sub',newId:'file:///vault/new'}];
  assert.equal(updated('[[sub/B]] [B](sub/B.md#x)',[note('sub/B.md')],changes).source,'[[new/B]] [B](new/B.md#x)');
  assert.equal(updated('[B](B.md)',[note('sub/B.md')],changes,'sub/A.md').source,'[B](B.md)');
});
test('ambiguous names stay untouched and alias references remain valid',()=>{
  const changes=[{oldId:note('one/B.md').id,newId:note('one/C.md').id}];
  const result=updated('[[B]]',[note('one/B.md'),note('two/B.md')],changes);
  assert.equal(result.source,'[[B]]');assert.equal(result.ambiguous,1);
  assert.equal(updated('[[Alias]]',[note('one/B.md','---\naliases: [Alias]\n---')],changes).source,'[[Alias]]');
});
test('encoded paths, escaped aliases and simultaneous renames retain exact syntax',()=>{
  const changes=[{oldId:note('B.md').id,newId:note('新 B.md').id}];
  assert.equal(updated('| x |\n|---|\n| [[B\\|标题]] |\n\n[B](B.md)',[note('B.md')],changes).source,'| x |\n|---|\n| [[新 B\\|标题]] |\n\n[B](%E6%96%B0%20B.md)');
  assert.equal(updated('[[B]]',[note('B.md')],[...changes,{oldId:note('A.md').id,newId:note('B.md').id}]).source,'[[新 B]]');
});
test('link labels containing code brackets and colon reference labels retain syntax',()=>{
  const changes=[{oldId:note('B.md').id,newId:note('C.md').id}];
  assert.equal(updated('[`]`](B.md "title")\n\n[x:y]: B.md\n\n[x:y]',[note('B.md')],changes).source,'[`]`](C.md "title")\n\n[x:y]: C.md\n\n[x:y]');
  assert.equal(updated('[[B]]',[note('B.md')],[{oldId:note('B.md').id,newId:'file:///vault/C%231.md'}]).source,'[[C%231]]');
});
