import {parseFragment} from 'parse5';
import {authoringTree,managedTocs} from './authoring';

export interface EditableBlock {from:number;to:number;focus:number}
// Source ownership differs from Markdown AST nodes: an HTML container may span
// several nodes, and a standalone anchor introduces the following visible block.
export function deletableBlocks(source:string):EditableBlock[]{
  const nodes=authoringTree(source).children,tocs=managedTocs(source);
  const blocks:EditableBlock[]=[];
  for(const node of nodes){
    const from=node.position.start.offset,to=node.position.end.offset;
    if(node.type==='yaml'||blocks.some(b=>from>=b.from&&to<=b.to))continue;
    const toc=tocs.find(t=>from===t.from);if(toc){blocks.push({from,to:toc.to,focus:from});continue;}
    let end=to;
    if(node.type==='html'&&/^\s*<(?:div|details|table|svg|section|article|aside|figure)\b/i.test(source.slice(from,to))){
      const fragment=parseFragment(source.slice(from),{sourceCodeLocationInfo:true});
      const element=fragment.childNodes.find((n:any)=>n.sourceCodeLocation?.startTag) as any;
      const closing=element?.sourceCodeLocation?.endTag;
      if(closing)end=Math.max(to,from+closing.endOffset);
    }
    blocks.push({from,to:end,focus:from});
  }
  const anchorOnly=(b:EditableBlock)=>/^(?:\s*<a\s+(?:id|name)\s*=\s*(?:"[^"]+"|'[^']+')\s*>\s*<\/a>\s*)+$/i.test(source.slice(b.from,b.to));
  for(let i=1;i<blocks.length;i++){const b=blocks[i],previous=blocks[i-1];if(/^\^[A-Za-z0-9-]+\s*$/.test(source.slice(b.from,b.to))&&/^\s*$/.test(source.slice(previous.to,b.from))){previous.to=b.to;blocks.splice(i--,1);}}
  for(let i=blocks.length-2;i>=0;i--){const b=blocks[i],next=blocks[i+1];if(anchorOnly(b)&&/^\s*$/.test(source.slice(b.to,next.from))){next.from=b.from;blocks.splice(i,1);}}
  const boundaries=[0,...nodes.flatMap((n:any)=>[n.position.start.offset,n.position.end.offset]),source.length];
  for(let i=0;i<boundaries.length;i+=2){const from=boundaries[i],to=boundaries[i+1],gap=source.slice(from,to);if(to>from&&/^\s+$/.test(gap)&&((from===0||to===source.length)||gap.split('\n').length>3)&&!blocks.some(b=>from>=b.from&&to<=b.to))blocks.push({from,to,focus:from});}
  return blocks.sort((a,b)=>a.from-b.from);
}
