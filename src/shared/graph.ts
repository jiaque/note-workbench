import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import {parseFragment} from 'parse5';
import {obsidianSyntax,maskComments} from './obsidian';
export interface GraphNote {id:string;name:string;path:string;source:string}
export interface GraphData {nodes:{id:string;name:string;path:string;missing?:boolean}[];links:{source:string;target:string}[];active?:string}
const parser=unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter,['yaml']).use(remarkMath).use(obsidianSyntax);
export function noteTargets(source:string):string[]{
  const tree:any=parser.parse(maskComments(source,parser.parse(source))),targets:string[]=[],definitions=new Map<string,string>();
  const scan=(node:any,fn:(node:any)=>void)=>{fn(node);for(const child of node.children??[])scan(child,fn);};
  scan(tree,node=>{if(node.type==='definition')definitions.set(node.identifier,node.url);});
  scan(tree,node=>{
    if(node.type==='link')targets.push(node.url);
    if(node.type==='image'&&/\.md(?:#|$)/i.test(node.url))targets.push(node.url);
    if(node.type==='linkReference'&&definitions.has(node.identifier))targets.push(definitions.get(node.identifier)!);
    if(node.type==='obsidianInline'&&/^!?\[\[/.test(node.value))targets.push(node.value.replace(/^!?\[\[/,'').slice(0,-2).split('|')[0].replace(/\\$/,''));
    if(node.type==='html'){
      const walk=(n:any)=>{if(n.tagName==='a'){const href=n.attrs?.find((a:any)=>a.name==='href')?.value;if(href)targets.push(href);}for(const c of n.childNodes??[])walk(c);};walk(parseFragment(node.value));
    }
  });return targets;
}
export function buildGraph(notes:GraphNote[],active?:string):GraphData{
  const nodes:GraphData['nodes']=notes.map(({id,name,path})=>({id,name,path})),links:GraphData['links']=[],ids=new Set(nodes.map(n=>n.id)),pairs=new Set<string>();
  const normalize=(value:string)=>value.replace(/\\/g,'/').replace(/\.md$/i,'').toLocaleLowerCase();
  for(const note of notes)for(let target of noteTargets(note.source)){
    target=target.split('#')[0];try{target=decodeURIComponent(target);}catch{continue;}
    if(!target||/^(?!file:|[a-z]:[\\/])(?:[a-z][\w+.-]*:|\/\/)/i.test(target))continue;
    if(/\.[\w]+$/.test(target)&&!target.toLowerCase().endsWith('.md'))continue;
    let resolved:string|undefined;
    try{const path=/^[a-z]:[\\/]/i.test(target)?'file:///'+target.replace(/\\/g,'/'):target.replace(/\\/g,'/');const uri=new URL(/\.md$/i.test(path)?path:path+'.md',note.id).href;resolved=nodes.find(n=>normalize(decodeURIComponent(n.id))===normalize(decodeURIComponent(uri)))?.id;}catch{}
    if(!resolved){const key=normalize(target),matches=notes.filter(n=>normalize(n.path)===key||normalize(n.path).endsWith('/'+key)||!key.includes('/')&&normalize(n.name)===key);if(matches.length===1)resolved=matches[0].id;}
    if(!resolved){resolved='missing:'+target;if(!ids.has(resolved)){nodes.push({id:resolved,name:target,path:target,missing:true});ids.add(resolved);}}
    const pair=note.id+'\n'+resolved;if(!pairs.has(pair)){pairs.add(pair);links.push({source:note.id,target:resolved});}
  }
  return{nodes,links,active};
}
