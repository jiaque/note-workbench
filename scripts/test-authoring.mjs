import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import renderer from '../dist/preview-render.cjs';
await mkdir('artifacts/authoring-test',{recursive:true});
await build({entryPoints:['test/authoring-browser.ts'],outfile:'artifacts/authoring-test/test.js',bundle:true,format:'esm',platform:'browser',target:'chrome130'});
createServer(async(req,res)=>{
  if(req.url==='/render'){let raw='';for await(const chunk of req)raw+=chunk;const m=JSON.parse(raw);const rendered=renderer.renderDocument(m.source,true);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({requestId:m.requestId,html:rendered.blocks.filter(b=>b.from>=m.from&&b.to<=m.to).map(b=>b.html).join('')}));return;}
  if(req.url==='/test.js'||req.url==='/test.css'){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile('artifacts/authoring-test'+req.url));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="/test.css"><main style="margin-top:180px"></main><output role="status">Running…</output><script type="module" src="/test.js"></script>');
}).listen(4343,'127.0.0.1',()=>console.log('Authoring regression: http://127.0.0.1:4343'));
