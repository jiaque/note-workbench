import { parseFragment, serialize } from 'parse5';
import { renderDocument, type Rendered } from './render';
import {findHeading} from './anchors';
import {svgImage} from './svg-image';

export interface Resource { id: string; url: string; source?: string; extension: string }
export type ResourceResolver = (origin: string, target: string) => Promise<Resource>;
const attr = (node: any, name: string) => node.attrs?.find((item: any) => item.name === name)?.value;
const set = (node: any, name: string, value: string) => { const item = node.attrs.find((item: any) => item.name === name); if (item) item.value = value; else node.attrs.push({ name, value }); };
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
const children = (node: any, html: string) => { node.childNodes = (parseFragment(html) as any).childNodes; for (const child of node.childNodes) child.parentNode = node; };

export async function hydrateResources(rendered: Rendered, origin: string, resolve: ResourceResolver, ancestors = [origin], budget = { remaining: 64 }): Promise<void> {
  let embedNumber = 0;
  const visit = async (node: any) => {
    if (node.tagName === 'a') {
      const href = attr(node, 'href');
      if (href?.startsWith('nw-note:')) {
        try { const resource = await resolve(origin, decodeURIComponent(href.slice(8))); set(node,'href','nw-note:' + encodeURIComponent(resource.id)); }
        catch (error) { set(node,'class',(attr(node,'class') ?? '') + ' unresolved-link'); set(node,'title',error instanceof Error ? error.message : String(error)); }
      } else if (ancestors.length > 1 && href && !href.startsWith('#') && !/^[a-z][\w+.-]*:/i.test(href)) {
        try { set(node,'href','nw-note:' + encodeURIComponent((await resolve(origin, href)).id)); } catch { /* Keep a usable source link when a resource is missing. */ }
      }
    }
    if (['img','audio','video','source'].includes(node.tagName)) {
      const src = attr(node,'src');
      if (src && !/^(?:https?:|data:)/i.test(src)) {
        try {const resource=await resolve(origin, attr(node,'data-vault-image') ?? src);if(node.tagName==='img'&&resource.extension==='.svg'&&resource.source!==undefined){const image=svgImage(resource.source);set(node,'src',image.src);set(node,'data-nw-svg-static',image.staticSrc);}else set(node,'src',resource.url); }
        catch { set(node,'alt','图片缺失：' + (attr(node,'alt') || src)); }
      }
    }
    const target = attr(node,'data-embed');
    if (target !== undefined) {
      node.tagName = node.nodeName = 'div';
      if (node.parentNode?.tagName === 'p') node.parentNode.tagName = node.parentNode.nodeName = 'div';
      try {
        if (--budget.remaining < 0) throw new Error('嵌入数量超过本次渲染上限');
        const resource = await resolve(origin, target), id = resource.id.split('#')[0];
        if (ancestors.includes(resource.id)) throw new Error('检测到循环嵌入');
        if (ancestors.length >= 6) throw new Error('嵌入层级超过 6 层');
        const link = `<a class="embed-source" href="nw-note:${escape(encodeURIComponent(resource.id))}">${escape(target)} ↗</a>`;
        let html = '';
        if (resource.extension === '.md' && resource.source !== undefined) {
          const nested = renderDocument(resource.source);
          html = nested.blocks.filter(block=>!['yaml','definition','footnoteDefinition'].includes(block.kind)).map(block=>block.html).join('');
          const hash = resource.id.indexOf('#');
          if (hash >= 0) html = selectFragment(html, decodeURIComponent(resource.id.slice(hash + 1)));
          const selected: Rendered = { tables: [], blocks: [{from:0,to:0,source:'',kind:'embed',html}] };
          await hydrateResources(selected, id, resolve, [...ancestors,resource.id],budget); html = selected.blocks[0].html;
          // Embedded content is read-only and IDs are isolated from its host and peers.
          const fragment: any = parseFragment(html), prefix = `embed-${ancestors.length}-${++embedNumber}-`;
          const scope = (child: any) => {
            if (child.attrs) {
              child.attrs = child.attrs.filter((a: any)=>a.name !== 'data-task-offset');
              const oldId = attr(child,'id'); if (oldId) set(child,'id',prefix + oldId);
              const href = attr(child,'href'); if (href?.startsWith('#')) set(child,'href','#' + prefix + href.slice(1));
              if (child.tagName === 'input') set(child,'disabled','');
            }
            for (const next of child.childNodes ?? []) scope(next);
          }; scope(fragment); html = serialize(fragment);
        } else if (['.mp3','.wav','.ogg','.m4a','.flac','.webm','.mp4','.ogv','.mov','.mkv'].includes(resource.extension)) {
          const tag = ['.mp4','.webm','.ogv','.mov','.mkv'].includes(resource.extension) ? 'video' : 'audio';
          html = `<${tag} controls preload="metadata" src="${escape(resource.url)}"></${tag}>`;
        } else if (resource.extension === '.pdf') {
          html = `<span class="pdf-embed" data-pdf-src="${escape(resource.url)}">正在加载 PDF…</span>`;
        } else if (resource.extension === '.canvas' && resource.source !== undefined) html = renderCanvas(resource.source);
        else throw new Error('此文件格式无法内嵌显示');
        children(node,link + `<div class="embed-content">${html}</div>`);
      } catch (error) {
        children(node,`<a class="embed-source" href="nw-note:${escape(encodeURIComponent(target))}">${escape(target)} ↗</a><span class="render-error">${escape(error instanceof Error ? error.message : String(error))}</span>`);
      }
      return;
    }
    for (const child of [...(node.childNodes ?? [])]) await visit(child);
  };
  for (const block of rendered.blocks) { const fragment = parseFragment(block.html); await visit(fragment); block.html = serialize(fragment); }
}

export function selectFragment(html: string, fragment: string): string {
  const root: any = parseFragment(html);
  const all: any[] = []; const walk = (node:any) => { if(node.tagName) all.push(node); for(const child of node.childNodes ?? []) walk(child); }; walk(root);
  const target = all.find(node=>attr(node,'id') === 'user-content-' + fragment) ?? findHeading(all.filter(node=>/^h[1-6]$/.test(node.tagName)),fragment,node=>attr(node,'data-heading')??'',node=>Number(node.tagName[1]));
  if (!target) throw new Error('找不到引用的标题或块：' + fragment);
  const selected: any[] = [target];
  if (/^h[1-6]$/.test(target.tagName)) {
    const siblings = target.parentNode.childNodes;
    for (let i=siblings.indexOf(target)+1;i<siblings.length;i++) { const next=siblings[i]; if (/^h[1-6]$/.test(next.tagName ?? '') && next.tagName <= target.tagName) break; selected.push(next); }
  }
  return serialize({ nodeName:'#document-fragment',childNodes:selected } as any);
}

function renderCanvas(source: string): string {
  const data = JSON.parse(source), nodes = data.nodes;
  if (!Array.isArray(nodes) || nodes.length > 2000) throw new Error('Canvas 数据无效或节点过多');
  const safe = nodes.filter((n:any)=>[n.x,n.y,n.width,n.height].every(Number.isFinite) && n.width>0 && n.height>0);
  if (!safe.length) return '<span>空白 Canvas</span>';
  const x=Math.min(...safe.map((n:any)=>n.x)), y=Math.min(...safe.map((n:any)=>n.y)), right=Math.max(...safe.map((n:any)=>n.x+n.width)), bottom=Math.max(...safe.map((n:any)=>n.y+n.height));
  const colors: Record<string,string> = {'1':'#e05252','2':'#e89940','3':'#dfbf50','4':'#64a769','5':'#4eaeb3','6':'#9473cb'};
  const shapes=safe.map((n:any)=>`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="8" fill="none" stroke="${colors[n.color] ?? (/^#[0-9a-f]{6}$/i.test(n.color ?? '') ? n.color : '#888')}" stroke-width="3"/>`).join('');
  const point=(node:any,side:string)=>({x:node.x+(side==='left'?0:side==='right'?node.width:node.width/2),y:node.y+(side==='top'?0:side==='bottom'?node.height:node.height/2)});
  const edges=(Array.isArray(data.edges)?data.edges:[]).slice(0,4000).map((edge:any)=>{const from=safe.find((n:any)=>n.id===edge.fromNode),to=safe.find((n:any)=>n.id===edge.toNode);if(!from||!to)return '';const a=point(from,edge.fromSide),b=point(to,edge.toSide);return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#888" stroke-width="2"/>`;}).join('');
  return `<svg viewBox="${x-12} ${y-12} ${right-x+24} ${bottom-y+24}" role="img" aria-label="Canvas 形状预览">${edges}${shapes}</svg>`;
}
