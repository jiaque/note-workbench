import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
await mkdir('artifacts/find-test',{recursive:true});
await build({entryPoints:['test/find-browser.ts'],outfile:'artifacts/find-test/test.js',bundle:true,format:'esm',platform:'browser',target:'chrome130'});
createServer(async(req,res)=>{
  try {
    if(req.url==='/test.js'||req.url==='/test.css'){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile('artifacts/find-test'+req.url));return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/test.css"><output role="status">Running…</output><main></main><script type="module" src="/test.js"></script>');
  }catch(error){res.writeHead(500).end(String(error));}
}).listen(4334,'127.0.0.1',()=>console.log('Find regression: http://127.0.0.1:4334 (real browser; expect PASS)'));
