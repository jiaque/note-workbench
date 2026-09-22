import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
await mkdir('artifacts/block-preview-test',{recursive:true});
await build({entryPoints:['test/block-preview-browser.ts'],outfile:'artifacts/block-preview-test/test.js',bundle:true,format:'esm',platform:'browser',target:'chrome130'});
createServer(async(req,res)=>{
  if(req.url==='/test.js'||req.url==='/test.css'){
    res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile('artifacts/block-preview-test'+req.url));return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/test.css"><main></main><output role="status">Running…</output><script type="module" src="/test.js"></script>');
}).listen(4342,'127.0.0.1',()=>console.log('Block preview regression: http://127.0.0.1:4342'));
