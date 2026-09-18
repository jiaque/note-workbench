import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderDocument} from '../src/shared/render';
import {hydrateResources,type ResourceResolver} from '../src/shared/embeds';
const files:Record<string,string>={
  'Root.md':'![[Other#Section]]\n\n![[Other#^block]]',
  'Other.md':'# Section\n\n**Visible** ![image](image.png)\n\n## Subsection\n\nNested body\n\n# Unrelated\n\nExcluded\n\nBlock content ^block',
  'Loop.md':'![[Loop]]',
  'Self.md':'![[#Section]]\n\n# Section\n\nSelected text',
};
const resolve:ResourceResolver=async(origin,target)=>{
  const hash=target.indexOf('#'),name=hash<0?target:target.slice(0,hash),fragment=hash<0?'':target.slice(hash+1), file=name?(name.endsWith('.md')||name.includes('.')?name:name+'.md'):origin;
  if(!(file in files)&&file!=='image.png')throw new Error('Missing');
  return {id:file+(fragment?'#'+fragment:''),url:'https://local.invalid/'+file,source:files[file],extension:file.endsWith('.md')?'.md':'.png'};
};
test('note section and block embeds resolve rich content and image paths',async()=>{
  const rendered=renderDocument(files['Root.md']); await hydrateResources(rendered,'Root.md',resolve);
  const output=rendered.blocks.map(b=>b.html).join('');
  assert.match(output,/<strong>Visible<\/strong>/); assert.match(output,/Nested body/); assert.match(output,/Block content/); assert.doesNotMatch(output,/Excluded/);
  assert.match(output,/src="https:\/\/local.invalid\/image.png"/);
});
test('cycles and missing notes have visible bounded errors; same-note section works',async()=>{
  const cycle=renderDocument(files['Loop.md']);await hydrateResources(cycle,'Loop.md',resolve);assert.match(cycle.blocks[0].html,/循环嵌入/);
  const self=renderDocument(files['Self.md']);await hydrateResources(self,'Self.md',resolve);assert.match(self.blocks[0].html,/Selected text/);assert.doesNotMatch(self.blocks[0].html,/循环嵌入/);
  const missing=renderDocument('![[Missing]]');await hydrateResources(missing,'Root.md',resolve);assert.match(missing.blocks[0].html,/Missing/);
});
test('repeated note embeds isolate IDs and keep embedded tasks read-only',async()=>{
  files['Tasks.md']='# Heading\n\n- [ ] task\n\n[[#Heading]]';
  const rendered=renderDocument('![[Tasks]]\n\n![[Tasks]]');await hydrateResources(rendered,'Root.md',resolve);
  const output=rendered.blocks.map(b=>b.html).join('');assert.doesNotMatch(output,/data-task-offset/);
  const ids=[...output.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);assert.equal((output.match(/disabled/g)||[]).length,2);
});

test('nested heading paths select only their section',async()=>{
  const rendered=renderDocument('![[Other#Section#Subsection]]');await hydrateResources(rendered,'Root.md',resolve);
  assert.match(rendered.blocks[0].html,/Nested body/);assert.doesNotMatch(rendered.blocks[0].html,/<strong>Visible|Excluded/);
});
