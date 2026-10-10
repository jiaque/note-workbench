import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderDocument} from '../src/shared/render';
import {hydrateResources} from '../src/shared/embeds';

test('Windows absolute images survive sanitization and reach the local resolver',async()=>{
  for(const target of ['D:/project/wifi/Huelith/design/windows/ui-05-portrait-v2.png','file:///D:/project/图片.png','../design/windows/ui-05-portrait-v2.png']){
    const doc=renderDocument(`![UI-05](${target})`);let calls=0;
    await hydrateResources(doc,'file:///D:/project/docs/test.md',async(_,href)=>{
      calls++;assert.equal(decodeURIComponent(href),target.startsWith('D:')?'file:///'+target:target);
      return {id:href,url:'https://local-resource.test/image.png',extension:'.png'};
    });
    assert.equal(calls,1);assert.match(doc.blocks[0].html,/src="https:\/\/local-resource.test\/image.png"/);
  }
});

test('local image resolver restrictions and dangerous protocol filtering remain active',async()=>{
  const doc=renderDocument('![Outside](D:/outside/private.png)');let calls=0;
  await hydrateResources(doc,'file:///D:/project/test.md',async()=>{calls++;throw Error('Outside workspace');});
  assert.equal(calls,1);assert.match(doc.blocks[0].html,/Outside workspace/);
  for(const src of ['javascript:alert(1)','vbscript:bad','custom:bad']){
    const unsafe=renderDocument(`<img src="${src}">`).blocks[0].html;
    assert.doesNotMatch(unsafe,/src=/);
  }
});
