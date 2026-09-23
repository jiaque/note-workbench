import {test} from 'node:test';
import assert from 'node:assert/strict';
import {svgImage} from '../src/shared/svg-image';
import {renderDocument} from '../src/shared/render';
import {hydrateResources} from '../src/shared/embeds';

const prolog='<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"\n "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
test('standard plotting SVG prolog is discarded and active content still removed',()=>{
  const image=svgImage(prolog+'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script><rect width="20" height="20" onclick="alert(2)"/></svg>');
  const xml=decodeURIComponent(image.src.slice(image.src.indexOf(',')+1));
  assert.match(xml,/<rect/);assert.doesNotMatch(xml,/DOCTYPE|script|onclick|svg11\.dtd/);
  for(const declaration of ['<!DOCTYPE svg SYSTEM "https://evil.test/a.dtd">','<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]>','<!ENTITY x "abc">',prolog.replace('svg11.dtd">','svg11.dtd" [<!ENTITY x "abc">]>')]){
    assert.throws(()=>svgImage(declaration+'<svg><text>&x;</text></svg>'));
  }
});
test('Chinese image URLs hydrate and failure messages retain readable paths and reasons',async()=>{
  const source='![](figures/每日趋势.svg)',doc=renderDocument(source);
  await hydrateResources(doc,'file:///report.md',async(_,href)=>{
    assert.equal(decodeURIComponent(href),'figures/每日趋势.svg');
    return {id:href,url:href,extension:'.svg',source:prolog+'<svg><rect width="10" height="10"/></svg>'};
  });
  assert.match(doc.blocks[0].html,/src="data:image\/svg/);
  const broken=renderDocument(source);
  await hydrateResources(broken,'file:///report.md',async()=>{throw Error('SVG rejected');});
  assert.match(broken.blocks[0].html,/每日趋势.svg — SVG rejected/);
});
