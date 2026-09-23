import { createServer } from 'node:http';
import { readFile, realpath, readdir } from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import { resolve, extname, dirname, relative, isAbsolute } from 'node:path';
import renderer from '../dist/preview-render.cjs';
const { renderDocument, hydrateResources, buildGraph,wikiCompletions, setLanguage, resolveLanguage } = renderer;
const previewLanguage=resolveLanguage(process.env.NOTE_WORKBENCH_PREVIEW_LANGUAGE||'zh-CN');setLanguage(previewLanguage);
let graphLayout={};
const root = resolve('dist/webview');
const sourceFile=resolve(process.env.NOTE_WORKBENCH_PREVIEW_FILE || 'test/fixtures/vault/Welcome.md'), vault=dirname(sourceFile);
let source = await readFile(sourceFile, 'utf8'), version = 1;
const renderSource = async (text,range) => {
  const rendered=renderDocument(text,!!range);
  if(range)rendered.blocks=rendered.blocks.filter(block=>block.from>=range.from&&block.to<=range.to&&block.kind!=='footnotes');
  await hydrateResources(rendered,sourceFile,async(origin,target)=>{
    const hash=target.indexOf('#'),name=hash<0?target:target.slice(0,hash),fragment=hash<0?'':target.slice(hash+1);let file=name?resolve(dirname(origin),decodeURIComponent(name)):origin;
    if(!extname(file))file+='.md';file=await realpath(file);
    const rel=relative(vault,file);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Outside preview vault');
    const extension=extname(file);
    return {id:file+(fragment?'#'+fragment:''),url:'/attachment?path='+encodeURIComponent(rel)+(fragment?'#'+fragment:''),extension,source:['.md','.canvas'].includes(extension)?file===sourceFile?text:await readFile(file,'utf8'):undefined};
  });
  return rendered;
};
const snapshot=async operationId=>({type:'snapshot',source,version,name:'Preview',readonly:false,operationId,...await renderSource(source)});
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if(url.pathname==='/graph'){
      response.setHeader('Content-Type','text/html; charset=utf-8');response.end(`<!doctype html><html lang="${previewLanguage}"><meta charset="utf-8"><link rel="stylesheet" href="/graph.css"><body><div id="graph-app"></div><script>window.acquireVsCodeApi=()=>({postMessage:async m=>{const r=await fetch('/graph-message',{method:'POST',body:JSON.stringify(m)});for(const result of await r.json())window.postMessage(result,'*')}})</script><script src="/graph.js"></script></body></html>`);return;
    }
    if(url.pathname==='/graph-message'){
      let body='';for await(const chunk of request)body+=chunk;const message=JSON.parse(body),output=[];
      if(message.type==='layout')graphLayout=message.value;
      if(message.type==='ready'||message.type==='refresh'){
        const notes=[];for(const name of await readdir(vault))if(name.endsWith('.md')){const file=resolve(vault,name);notes.push({id:pathToFileURL(file).href,name,path:name,source:file===sourceFile?source:await readFile(file,'utf8')});}
        output.push({type:'layout',value:graphLayout},{type:'graph',...buildGraph(notes,pathToFileURL(sourceFile).href)});
      }
      response.setHeader('Content-Type','application/json');response.end(JSON.stringify(output));return;
    }
    if(url.pathname==='/attachment') {
      const file=await realpath(resolve(vault,url.searchParams.get('path')??'')),rel=relative(vault,file);
      if(rel.startsWith('..')||isAbsolute(rel)){response.writeHead(403).end();return;}
      response.setHeader('Content-Type',({'.svg':'image/svg+xml','.pdf':'application/pdf','.png':'image/png','.wav':'audio/wav'})[extname(file)]??'application/octet-stream');
      response.end(await readFile(file));return;
    }
    if (url.pathname === '/reference' && process.env.NOTE_WORKBENCH_REFERENCE_FILE) {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(await readFile(process.env.NOTE_WORKBENCH_REFERENCE_FILE, 'utf8')); return;
    }
    if (url.pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="${previewLanguage}"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Note Workbench · Development</title><link rel="stylesheet" href="/editor.css"><body><div id="app"></div><script>let state;window.acquireVsCodeApi=()=>({getState:()=>state,setState:s=>state=s,postMessage:async message=>{const response=await fetch('/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message)});for(const m of await response.json())window.postMessage(m,'*')}});</script><script type="module" src="/editor.js"></script></body></html>`); return;
    }
    if (url.pathname === '/message' && request.method === 'POST') {
      let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 2_000_000) throw new Error('Request too large'); }
      const message = JSON.parse(body), output = [];
      if(message.type==='complete'){
        const notes=[];for(const name of await readdir(vault))if(name.endsWith('.md')){const file=resolve(vault,name);notes.push({id:pathToFileURL(file).href,name,path:name,source:file===sourceFile?source:await readFile(file,'utf8')});}
        output.push({type:'completions',requestId:message.requestId,options:wikiCompletions(notes,pathToFileURL(sourceFile).href,message.query)});
      }
      if(message.type==='preview') {const rendered=await renderSource(message.source,message);output.push({type:'preview',requestId:message.requestId,html:rendered.blocks.map(block=>block.html).join('')});}
      if (message.type === 'ready') output.push(await snapshot());
      if (message.type === 'edit') {
        if (message.baseVersion !== version) output.push({ type: 'conflict', operationId: message.operationId }, await snapshot());
        else {
          for (const edit of [...message.replacements].sort((a, b) => b.from - a.from)) {
            if (source.slice(edit.from, edit.to) !== edit.expectedText) throw new Error('Stale range');
            source = source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
          }
          version++; output.push(await snapshot(message.operationId));
        }
      }
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(output)); return;
    }
    const file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + '\\') && !file.startsWith(root + '/')) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.wasm':'application/wasm' })[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch (error) { response.writeHead(500).end(String(error)); }
});
const port=Number(process.env.NOTE_WORKBENCH_PREVIEW_PORT||4317);
server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port} (in-memory sample; not a production dependency)`));
