import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import {transformObsidian,obsidianSyntax,maskComments} from './obsidian';

const parser=unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter,['yaml']).use(remarkMath).use(obsidianSyntax);
const parsed=new Map<string,any>();
// Shared read-only trees: cursor movement and toolbar updates reuse the same parse.
export function parseAuthoring(source:string):any {if(parsed.has(source))return parsed.get(source);const tree=parser.parse(source);parsed.set(source,tree);if(parsed.size>4)parsed.delete(parsed.keys().next().value!);return tree;}
export function authoringTree(source:string):any {const tree=parseAuthoring(source);return parseAuthoring(maskComments(source,tree));}
export interface TocOptions {min:number;max:number;auto:boolean}
export const defaultToc:TocOptions={min:2,max:3,auto:true};
export function managedTocs(source:string){
  const nodes=authoringTree(source).children,results:{from:number;to:number;options:TocOptions}[]=[];
  for(let i=0;i<nodes.length;i++){
    const match=/^<!-- nw:toc (\{[^\n]*\}) -->$/.exec(nodes[i].value??'');if(!match||nodes[i].type!=='html')continue;
    let value:any;try{value=JSON.parse(match[1]);}catch{continue;}
    if(!Number.isInteger(value.min)||!Number.isInteger(value.max)||value.min<1||value.max>6||value.min>value.max)continue;
    const end=nodes.slice(i+1).find((n:any)=>n.type==='html'&&n.value==='<!-- /nw:toc -->');
    if(end)results.push({from:nodes[i].position.start.offset,to:end.position.end.offset,options:{min:value.min,max:value.max,auto:value.auto!==false}});
  }return results;
}
export function makeToc(source:string,options:TocOptions=defaultToc){
  const root=structuredClone(authoringTree(source));transformObsidian(root,source);
  const headings=root.children.filter((n:any)=>n.type==='heading'&&n.depth>=options.min&&n.depth<=options.max&&!/<!--\s*nw:toc-ignore\s*-->/.test(source.slice(n.position.start.offset,n.position.end.offset)));
  const lines=headings.map((n:any)=>{const id=String(n.data.hProperties.id),label=String(n.data.hProperties.dataHeading).replace(/[\\\[\]]/g,'\\$&');return '  '.repeat(n.depth-options.min)+`- [${label}](#${encodeURIComponent(id)})`;});
  return `<!-- nw:toc ${JSON.stringify(options)} -->\n\n${lines.join('\n')}\n\n<!-- /nw:toc -->`;
}
export function tocUpdates(source:string,manual=false){return managedTocs(source).filter(toc=>manual||toc.options.auto).map(toc=>({...toc,insert:makeToc(source,toc.options)})).filter(toc=>source.slice(toc.from,toc.to)!==toc.insert);}
export function insertBlock(source:string,at:number,body:string){
  at=Math.max(0,Math.min(source.length,at));
  const left=source.slice(0,at),right=source.slice(at);
  const before=left.length?'\n'.repeat(Math.max(0,2-(/\n*$/.exec(left)![0].length))):'';
  const after=right.length?'\n'.repeat(Math.max(0,2-(/^\n*/.exec(right)![0].length))):'';
  // An empty paragraph needs a physical editable line even at the document ends.
  const insert=before+body+(body?after:'\n'+after);
  return {from:at,to:at,insert,anchor:at+before.length};
}
export function deleteBlockEdit(source:string,from:number,to:number){
  // Remove this block's surrounding blank separators, keeping one Markdown gap.
  // Never normalize whitespace elsewhere or trailing spaces on adjacent content.
  const left=/((?:\r?\n[\t ]*)+)$/.exec(source.slice(0,from));
  const right=/^(?:[\t ]*\r?\n)+/.exec(source.slice(to));
  const start=from-(left?.[0].length??0),end=to+(right?.[0].length??0);
  const eol=source.includes('\r\n')?'\r\n':'\n';
  return {from:start,to:end,insert:start>0&&end<source.length?eol+eol:''};
}
export function pastedLink(source:string,from:number,to:number,url:string){
  if(from===to||!/^https?:\/\/[^\s<>]+$/i.test(url))return;
  try{new URL(url);}catch{return;}
  const tree=authoringTree(source);let blocked=false;
  const visit=(n:any)=>{if(n.position&&n.position.start.offset<to&&n.position.end.offset>from){if(['code','inlineCode','html','link','image'].includes(n.type))blocked=true;for(const c of n.children??[])visit(c);}};visit(tree);
  if(blocked)return;
  return `[${source.slice(from,to).replace(/[\\\[\]]/g,'\\$&')}](<${url.replace(/>/g,'%3E')}>)`;
}
