import {getLanguage} from '../shared/i18n';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import * as path from 'node:path';
import {renderDocument} from '../shared/render';
import {hydrateResources,type ResourceResolver} from '../shared/embeds';
import {findBrowser,printPdf} from './browser';
import {blockRemoteImages} from '../shared/remote-images';

const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export interface PdfOptions{
  source:string;origin:string;title:string;assets:string;resolve:ResourceResolver;
  readResource:(id:string)=>Promise<Uint8Array>;styleSheets?:{id:string;source:string}[];
  browserPath?:string;signal?:AbortSignal;remoteImages?:boolean;
}
export function pdfHtml(title:string,body:string,classes:string[]=[],styles:string[]=[],remoteImages=true){
  return `<!doctype html><html lang="${getLanguage()}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'self';style-src 'self' 'unsafe-inline';img-src 'self' data: ${remoteImages?'https:':''};font-src 'self' data:;connect-src 'self';"><title>${escape(title)}</title><link rel="stylesheet" href="assets/editor.css">${styles.map(href=>`<link rel="stylesheet" href="${escape(href)}">`).join('')}<link rel="stylesheet" href="assets/export.css"></head><body><main class="rendered ${classes.map(escape).join(' ')}">${body}</main><script type="module" src="assets/export.js"></script></body></html>`;
}
export async function exportPdf(options:PdfOptions):Promise<Buffer>{
  const browser=await findBrowser(options.browserPath);
  const token=randomBytes(24).toString('hex'),resources=new Map<string,{data:Uint8Array;type:string}>();
  const mime=(extension:string)=>({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'}[extension]??'application/octet-stream');
  const add=(id:string,data:Uint8Array,type:string)=>{const key=`resource/${resources.size}`;resources.set(key,{data,type});return key;};
  let html='';
  const server=createServer(async(request,response)=>{
    try{
      const requested=new URL(request.url??'','http://localhost').pathname;
      if(!requested.startsWith('/'+token+'/')){response.writeHead(404).end();return;}
      const route=decodeURIComponent(requested.slice(token.length+2));
      response.setHeader('Cache-Control','no-store');
      if(route==='index.html'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);return;}
      const resource=resources.get(route);if(resource){response.setHeader('Content-Type',resource.type);response.end(resource.data);return;}
      if(route.startsWith('assets/')){
        const file=path.resolve(options.assets,route.slice(7)),relative=path.relative(options.assets,file);
        if(relative.startsWith('..')||path.isAbsolute(relative)||!['.css','.js','.mjs','.woff','.woff2','.ttf'].includes(path.extname(file))){response.writeHead(404).end();return;}
        response.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':mime(path.extname(file)));response.end(await readFile(file));return;
      }response.writeHead(404).end();
    }catch{response.writeHead(404).end();}
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}/${token}/`;
  try{
    const resolver:ResourceResolver=async(origin,target)=>{
      const resource=await options.resolve(origin,target);
      if(!['.md','.canvas'].includes(resource.extension))resource.url=base+add(resource.id,await options.readResource(resource.id),mime(resource.extension));
      return resource;
    };
    const rendered=renderDocument(options.source);await hydrateResources(rendered,options.origin,resolver);
    if(options.remoteImages===false)blockRemoteImages(rendered);
    const styles:string[]=[];
    for(const sheet of options.styleSheets??[]){
      // Rebase permitted local CSS assets against the stylesheet's own directory.
      let css=sheet.source;const urls=[...css.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)];
      for(const match of urls){if(/^(data:|https?:|#)/i.test(match[2]))continue;try{const resource=await resolver(sheet.id,match[2]);css=css.replace(match[0],`url("${resource.url}")`);}catch{css=css.replace(match[0],'url("")');}}
      styles.push(add(sheet.id,Buffer.from(css),'text/css'));
    }
    html=pdfHtml(options.title,rendered.blocks.filter(block=>block.kind!=='yaml').map(block=>block.html).join('\n'),rendered.classes,styles,options.remoteImages);
    return await printPdf(browser,base+'index.html',options.signal);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
