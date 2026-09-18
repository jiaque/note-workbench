import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import renderer from '../dist/preview-render.cjs';

await mkdir('artifacts/caret-test',{recursive:true});
await build({entryPoints:['test/caret-browser.ts'],outfile:'artifacts/caret-test/test.js',bundle:true,format:'esm',platform:'browser',target:'chrome130'});
const source=await readFile('test/fixtures/vault/Live Preview.md','utf8');
const fixture=JSON.stringify({source,blocks:renderer.renderDocument(source).blocks});
createServer(async(req,res)=>{
  try {
    if(req.url==='/fixture'){res.setHeader('Content-Type','application/json');res.end(fixture);return;}
    if(req.url==='/test.js'||req.url==='/test.css'){
      res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');
      res.end(await readFile('artifacts/caret-test'+req.url));return;
    }
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/test.css"><main></main><output role="status">Running…</output><script type="module" src="/test.js"></script>');
  }catch(error){res.writeHead(500).end(String(error));}
}).listen(4318,'127.0.0.1',()=>console.log('Caret regression: http://127.0.0.1:4318 (requires real browser; expect PASS)'));
