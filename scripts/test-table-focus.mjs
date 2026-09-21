import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import renderer from '../dist/preview-render.cjs';
await mkdir('artifacts/table-focus-test',{recursive:true});
await build({entryPoints:['test/table-focus-browser.ts'],outfile:'artifacts/table-focus-test/test.js',bundle:true,format:'esm',platform:'browser'});
const source=await readFile('test/fixtures/vault/Formatting regression.md','utf8');
const snapshot=JSON.stringify({type:'snapshot',version:1,name:'Table focus regression',readonly:false,source,...renderer.renderDocument(source)}).replaceAll('<','\\u003c');
const root=resolve('dist/webview');
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><output role="status">Running…</output><iframe src="/editor" style="width:100%;height:800px"></iframe><script type="module" src="/test.js"></script>');return;}
    if(url.pathname==='/editor'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><link rel="stylesheet" href="/editor.css"><div id="app"></div><script>window.testEditCount=0;window.acquireVsCodeApi=()=>({getState:()=>undefined,setState:()=>{},postMessage:m=>{if(m.type==='ready')window.postMessage(${snapshot},'*');if(m.type==='edit')window.testEditCount++;}});</script><script type="module" src="/editor.js"></script>`);return;}
    const file=url.pathname==='/test.js'?resolve('artifacts/table-focus-test/test.js'):resolve(root,'.'+decodeURIComponent(url.pathname));
    if(url.pathname!=='/test.js'&&!file.startsWith(root+'/')&&!file.startsWith(root+'\\'))throw Error('Outside root');
    res.setHeader('Content-Type',extname(file)==='.css'?'text/css':'text/javascript');res.end(await readFile(file));
  }catch(error){res.writeHead(500).end(String(error));}
}).listen(4339,'127.0.0.1',()=>console.log('Table focus regression: http://127.0.0.1:4339 (real browser; expect PASS)'));
