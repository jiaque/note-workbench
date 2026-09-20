import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
await mkdir('artifacts/shortcuts-test',{recursive:true});
await build({entryPoints:['test/shortcuts-browser.ts'],outfile:'artifacts/shortcuts-test/test.js',bundle:true,format:'esm',platform:'browser',target:'chrome130'});
createServer(async(req,res)=>{
  try{
    if(req.url==='/test.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('artifacts/shortcuts-test/test.js'));return;}
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><output role="status">Running…</output><main></main><script type="module" src="/test.js"></script>');
  }catch(error){res.writeHead(500).end(String(error));}
}).listen(4335,'127.0.0.1',()=>console.log('Shortcut regression: http://127.0.0.1:4335 (real browser; expect PASS)'));
