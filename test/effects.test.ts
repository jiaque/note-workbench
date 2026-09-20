import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanStyle,cleanSvgSheet} from '../src/shared/css-styles';
import {svgImage} from '../src/shared/svg-image';
import {renderDocument} from '../src/shared/render';
import {hydrateResources} from '../src/shared/embeds';
import {effects,entrances,hovers} from '../src/shared/effects';
const decode=(url:string)=>decodeURIComponent(url.slice(url.indexOf(',')+1));
test('34 effects retain explicit attributes and typed inline parameters',()=>{
  assert.equal(effects.length+entrances.length+hovers.length,34);
  const html=renderDocument('<div data-nw-effect="breathe" data-nw-hover="lift" style="--nw-duration:2s;--nw-color:#38bdf8;--nw-intensity:0.3;padding:16px">Note</div>').blocks[0].html;
  assert.match(html,/data-nw-effect="breathe"/);assert.match(html,/--nw-duration:2s/);
  assert.equal(cleanStyle('--nw-duration:0s;--nw-progress:101%;--nw-other:1;--nw-scale:10;color:red'),'color:red');
});
test('CSS parser retains gradients and transforms but rejects requests and escaped functions',()=>{
  assert.match(cleanStyle('background:linear-gradient(90deg,red,blue);transform:rotate(3deg);box-shadow:0 2px 8px #0002'),/linear-gradient/);
  assert.equal(cleanStyle('background:url(https://bad.test);position:fixed;color:red;transform:expression(alert(1));--nw-color:url(https://bad.test)'),'color:red');
  assert.equal(cleanStyle('background:u\\72l(https://bad.test);color:blue'),'color:blue');
  assert.equal(cleanStyle('color:var(--attacker);color:var(--nw-color)'),'color:var(--nw-color)');
});
test('SVG CSS and SMIL survive only inside an isolated image; static alternative removes timelines',()=>{
  const image=svgImage('<svg viewBox="0 0 100 80"><title>动画</title><style>.dot{animation:move 2s infinite}@keyframes move{from{opacity:0.5}to{opacity:1}}</style><circle class="dot" cx="20" cy="20" r="10"><animate attributeName="cx" values="20;80;20" dur="2s" repeatCount="indefinite"/></circle></svg>');
  assert.match(decode(image.src),/@keyframes move/);assert.match(decode(image.src),/<animate /);assert.equal(image.alt,'动画');
  assert.doesNotMatch(decode(image.staticSrc),/<animate |@keyframes/);assert.match(decode(image.staticSrc),/animation:none!important/);
});
test('SVG scripts, event handlers, external references and animated URL mutations are removed',()=>{
  const output=decode(svgImage('<svg onload="alert(1)"><script>alert(1)</script><foreignObject><p>unsafe</p></foreignObject><style>@import "https://bad.test";.a{fill:url(https://bad.test)}</style><a href="javascript:alert(1)"><text>click</text></a><rect onclick="alert(1)"><set attributeName="href" to="https://bad.test"/><animate attributeName="fill" values="red;url(https://bad.test)" dur="1s"/></rect></svg>').src);
  assert.doesNotMatch(output,/script|onload|onclick|foreignObject|bad\.test|attributeName="href"|@import/);
});
test('SVG internal gradients remain local while external uses and CSS URLs cannot escape',()=>{
  const output=decode(svgImage('<svg><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs><rect fill="url(#g)"/><use href="https://bad.test/x.svg"/><style>rect{fill:url(#g);filter:url(https://bad.test)}</style></svg>').src);
  assert.match(output,/fill="url\(#g\)"/);assert.match(output,/fill:url\(#g\)/);assert.doesNotMatch(output,/https:.*bad|filter:url/);
});
test('SVG limits and entity declarations fail before rendering',()=>{
  assert.throws(()=>svgImage('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]><svg/>'));
  assert.throws(()=>svgImage('<svg>'+('<g/>'.repeat(5001))+'</svg>'));
});
test('SVG stylesheet does not allow imports, executable URLs or arbitrary nested rules',()=>{
  const css=cleanSvgSheet('@import "https://bad.test";@font-face{src:url(https://bad.test)}rect{fill:red} @keyframes x{0%{opacity:0}100%{opacity:1}}');
  assert.match(css,/rect\{fill:red\}/);assert.match(css,/@keyframes x/);assert.doesNotMatch(css,/import|font-face|bad.test/);
});
test('local SVG references use the same filtered image path',async()=>{
  const doc=renderDocument('![Chart](chart.svg)');await hydrateResources(doc,'file:///vault/note.md',async()=>({id:'file:///vault/chart.svg',url:'unsafe-unfiltered-url',extension:'.svg',source:'<svg><circle r="10"/><script>alert(1)</script></svg>'}));
  assert.match(doc.blocks[0].html,/data-nw-svg-static/);assert.doesNotMatch(doc.blocks[0].html,/unsafe-unfiltered-url|script/);
});
