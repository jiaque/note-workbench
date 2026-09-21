import {test} from 'node:test';
import assert from 'node:assert/strict';
import {svgTips,validTips} from '../src/shared/svg-tips';
import {svgImage} from '../src/shared/svg-image';
import {renderDocument} from '../src/shared/render';
import {hydrateResources} from '../src/shared/embeds';
import {parseFragment} from 'parse5';
const svg='<svg viewBox="0 0 200 100"><g transform="translate(10 5)"><circle cx="30" cy="40" r="8" data-nw-tip="2025-09&#10;老客户：240.2万"/></g><path d="M100 50 L140 50 A40 40 0 0 1 100 90 Z" data-nw-tip="扇区：42"/></svg>';
test('structured cards preserve title, series order and literal values with safe colors',()=>{
  const rows=JSON.stringify([{label:'老客户',value:'240.2万',color:'#20b6b0'},{label:'<b>新客户</b>',value:'53.8万'}]);
  const source=`<svg viewBox="0 0 200 100"><rect width="100" height="100" data-nw-tip-title="2025-09" data-nw-tip-rows='${rows.replace(/</g,'&lt;')}'/></svg>`;
  const data=JSON.parse(svgImage(source).tips!);assert.equal(data.items[0].title,'2025-09');assert.equal(data.items[0].rows[1].label,'<b>新客户</b>');assert.equal(data.items[0].rows.length,2);assert.ok(validTips(data));
  const rendered=renderDocument(source).blocks.map(b=>b.html).join('');assert.match(rendered,/data-nw-svg-tips/);
  const tags:string[]=[];const walk=(node:any)=>{if(node.tagName)tags.push(node.tagName);for(const child of node.childNodes??[])walk(child);};walk(parseFragment(rendered));assert.deepEqual(tags,['p','img']);
});
test('invalid card declarations fall back to old text without accepting executable styles',()=>{
  for(const rows of ['not json','[]',JSON.stringify([{label:'bad',value:'1',color:'url(https://evil.invalid)'}]),JSON.stringify(Array(17).fill({label:'x',value:'1'}))]){
    const source=`<svg viewBox="0 0 100 100"><rect width="50" height="50" data-nw-tip="legacy" data-nw-tip-title="title" data-nw-tip-rows='${rows}'/></svg>`;
    const data=JSON.parse(svgImage(source).tips!);assert.equal(data.items[0].text,'legacy');assert.equal(data.items[0].rows,undefined);
  }
});
test('SVG hotspot metadata is inert, bounded and preserves geometry without inline SVG',()=>{
  const data=JSON.parse(svgTips(svg)!);assert.equal(data.items.length,2);assert.equal(data.items[0].text,'2025-09\n老客户：240.2万');assert.deepEqual(data.items[0].transforms,['translate(10 5)']);assert.ok(validTips(data));
  const image=svgImage(svg);assert.ok(image.tips);assert.ok(!decodeURIComponent(image.src).includes('data-nw-tip'));
  const html=renderDocument(svg).blocks.map(b=>b.html).join('');assert.match(html,/data-nw-svg-tips=/);assert.doesNotMatch(html,/<svg/);
});
test('tips cannot introduce executable markup, bad transforms or excessive data',()=>{
  const image=svgImage('<svg viewBox="0 0 100 100"><script>alert(1)</script><rect width="50" height="50" onclick="alert(1)" data-nw-tip="&lt;img src=x onerror=alert(1)&gt;"/></svg>');
  assert.equal(JSON.parse(image.tips!).items[0].text,'<img src=x onerror=alert(1)>');assert.doesNotMatch(decodeURIComponent(image.src),/script|onclick|onerror/);
  assert.equal(svgTips('<svg viewBox="0 0 100 100"><circle r="5" transform="translate(url(x))" data-nw-tip="bad"/></svg>'),undefined);
  assert.equal(svgTips('<svg viewBox="0 0 100 100"><circle r="5" data-nw-tip="'+ 'x'.repeat(2001)+'"/></svg>'),undefined);
  const bad=JSON.parse(svgTips(svg)!);bad.items[0].attrs.onclick='alert(1)';assert.equal(validTips(bad),false);
});
test('unsupported moving and clipped regions are skipped; external SVG embeds get tips',async()=>{
  assert.equal(svgTips('<svg viewBox="0 0 100 100"><g clip-path="url(#clip)"><circle r="5" data-nw-tip="bad"/></g><circle r="5" data-nw-tip="moving"><animate attributeName="cx" from="0" to="50" dur="1s"/></circle></svg>'),undefined);
  const rendered=renderDocument('![chart](chart.svg)');await hydrateResources(rendered,'file:///vault/a.md',async()=>({id:'file:///vault/chart.svg',url:'file:///vault/chart.svg',source:svg,extension:'.svg'}));assert.match(rendered.blocks[0].html,/data-nw-svg-tips/);
});
