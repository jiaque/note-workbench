import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {english,resolveLanguage,setLanguage,t} from '../src/shared/i18n';
import {renderDocument} from '../src/shared/render';
import {newMarkdownTable} from '../src/shared/tables';
import {pdfHtml} from '../src/pdf/export';

test('explicit language overrides VS Code; auto follows VS Code before system locale',()=>{
  assert.equal(resolveLanguage('en','zh-CN','zh-CN'),'en');
  assert.equal(resolveLanguage('zh-CN','en'),'zh-CN');
  for(const locale of ['zh','zh-CN','zh-TW','zh_HK'])assert.equal(resolveLanguage('auto',locale),'zh-CN');
  assert.equal(resolveLanguage('auto','en','zh-CN'),'en');
  assert.equal(resolveLanguage('auto','de','zh-CN'),'en');
  assert.equal(resolveLanguage('auto',undefined,'zh-CN'),'zh-CN');
  assert.equal(resolveLanguage('auto'),'en');
});

test('translations retain all placeholders and interpolate user text literally',()=>{
  for(const [key,value]of Object.entries(english)){
    const params=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
    assert.deepEqual(params(key),params(value),key);
    assert.ok(value.length&&!/\p{Script=Han}/u.test(value),key);
  }
  try{setLanguage('en');assert.equal(t('打开笔记 {name}',{name:'中文 {row} $&'}),'Open note 中文 {row} $&');}
  finally{setLanguage('zh-CN');}
});

test('language changes UI defaults, footnotes and PDF shell but never authored content',()=>{
  const source='# 中文标题\n\nEnglish and 中文正文[^1]\n\n[^1]: 作者脚注\n';
  try{
    setLanguage('en');
    const rendered=renderDocument(source),html=rendered.blocks.map(b=>b.html).join('');
    assert.match(html,/Footnotes/);assert.match(html,/Back to content/);assert.match(html,/中文标题/);assert.match(html,/作者脚注/);
    assert.equal(rendered.blocks[0].source,'# 中文标题');
    assert.match(newMarkdownTable(1,2),/Column 1/);assert.match(pdfHtml('中文标题',html),/<html lang="en">/);
    setLanguage('zh-CN');assert.match(newMarkdownTable(1,2),/列 1/);
    assert.match(renderDocument(source).blocks.at(-1)!.html,/脚注/);
  }finally{setLanguage('zh-CN');}
});

test('every manifest localization key resolves in English and Chinese',()=>{
  const manifest=JSON.parse(readFileSync('package.json','utf8'));
  const catalogs=['package.nls.json','package.nls.zh-cn.json','package.nls.zh.json'].map(file=>JSON.parse(readFileSync(file,'utf8')));
  function walk(value:unknown){if(typeof value==='string'&&/^%.*%$/.test(value))for(const catalog of catalogs)assert.ok(catalog[value.slice(1,-1)],value);else if(value&&typeof value==='object')Object.values(value).forEach(walk);}walk(manifest);
  assert.deepEqual(Object.keys(catalogs[0]).sort(),Object.keys(catalogs[1]).sort());
  assert.equal(manifest.contributes.configuration.properties['noteWorkbench.language'].default,'auto');
});
