import test from 'node:test';
import assert from 'node:assert/strict';
import {svgImage} from '../src/shared/svg-image';
import {cleanStyle} from '../src/shared/css-styles';

test('SVG axis text alignment survives inline styles and stylesheets in image and static output',()=>{
  const image=svgImage('<svg viewBox="0 0 100 100"><style>.tick{text-anchor:end;dominant-baseline:middle}</style><text x="40" y="50" style="text-anchor:end;dominant-baseline:middle;alignment-baseline:central">12个</text><text x="80" y="50" class="tick">8个</text></svg>');
  for(const src of [image.src,image.staticSrc]){const svg=decodeURIComponent(src.split(',').slice(1).join(','));assert.match(svg,/text-anchor:end/g);assert.match(svg,/dominant-baseline:middle/);assert.match(svg,/alignment-baseline:central/);assert.match(svg,/x="40" y="50"/);}
  assert.equal(cleanStyle('text-anchor:url(https://evil.invalid);dominant-baseline:expression(alert(1))',true),'');
  assert.equal(cleanStyle('text-anchor:end;dominant-baseline:middle'), '');
});
