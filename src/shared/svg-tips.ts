import {parseFragment} from 'parse5';

export interface SvgTip {text:string; shape:string; attrs:Record<string,string>; transforms:string[]}
export interface SvgTips {box:number[]; aspect:string; items:SvgTip[]}
const shapes=new Set(['circle','ellipse','rect','path','polygon','polyline','line']);
const geometry=new Set('cx cy r rx ry x y width height x1 y1 x2 y2 d points fill-rule stroke-width fill'.split(' '));
const number=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
export function validTransform(value:string):boolean {
  if(value.length>1000)return false;
  let end=0;
  for(const m of value.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)){
    if(value.slice(end,m.index).trim().replace(/,/g,''))return false;
    const args=m[2].trim().split(/[\s,]+/),counts:Record<string,number[]>={matrix:[6],translate:[1,2],scale:[1,2],rotate:[1,3],skewX:[1],skewY:[1]};
    if(!counts[m[1]].includes(args.length)||args.some(x=>!number.test(x)||!Number.isFinite(+x)||Math.abs(+x)>1e6))return false;
    end=m.index!+m[0].length;
  }
  return !value.slice(end).trim();
}
export function validTips(value:any):value is SvgTips {
  return value&&Array.isArray(value.box)&&value.box.length===4&&value.box.every((n:any)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e6)&&value.box[2]>0&&value.box[3]>0&&
    typeof value.aspect==='string'&&/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/.test(value.aspect)&&
    Array.isArray(value.items)&&value.items.length<=500&&value.items.every((item:any)=>item&&typeof item.text==='string'&&item.text.length>0&&item.text.length<=2000&&shapes.has(item.shape)&&
      Array.isArray(item.transforms)&&item.transforms.length<=32&&item.transforms.every((s:any)=>typeof s==='string'&&validTransform(s))&&item.attrs&&typeof item.attrs==='object'&&!Array.isArray(item.attrs)&&
      Object.entries(item.attrs).every(([key,v])=>geometry.has(key)&&typeof v==='string'&&v.length<=10000&&(key==='d'?/^[MmZzLlHhVvCcSsQqTtAaEe\d\s.,+\-]*$/.test(v):key==='points'?/^[Ee\d\s.,+\-]*$/.test(v):key==='fill-rule'?['nonzero','evenodd'].includes(v):key==='fill'?v==='none':number.test(v)&&Number.isFinite(+v)&&Math.abs(+v)<=1e6)));
}
/** Extract inert data only. The SVG itself continues to be rendered as an image. */
export function svgTips(source:string):string|undefined {
  if(source.length>500000)return;
  const root:any=parseFragment(source),svg=root.childNodes.find((n:any)=>n.tagName==='svg');if(!svg)return;
  const attr=(n:any,key:string)=>n.attrs?.find((a:any)=>a.name===key)?.value;
  const width=attr(svg,'width')??'300',height=attr(svg,'height')??'150';
  const box=attr(svg,'viewBox')?.trim().split(/[\s,]+/).map(Number)??[0,0,Number(width.replace(/px$/,'')),Number(height.replace(/px$/,''))];
  const result:SvgTips={box,aspect:attr(svg,'preserveAspectRatio')??'xMidYMid meet',items:[]};
  let count=0;
  const walk=(node:any,transforms:string[],depth:number,inheritedFill='')=>{
    if(++count>5000||depth>32||result.items.length>=500)return;
    if(!['svg','g',...shapes].includes(node.tagName)||node!==svg&&node.tagName==='svg')return;
    // Clipped or moving geometry needs a different hit map; do not guess its bounds.
    if(attr(node,'clip-path')||attr(node,'mask')||/\b(?:transform|display|visibility)\s*:/.test(attr(node,'style')??''))return;
    if(node.childNodes?.some((n:any)=>['animateTransform','animateMotion'].includes(n.tagName)||['animate','set'].includes(n.tagName)&&geometry.has(attr(n,'attributeName'))))return;
    const transform=attr(node,'transform');if(transform&&!validTransform(transform))return;
    const next=transform?[...transforms,transform]:transforms;
    const fill=attr(node,'fill')??inheritedFill;
    const text=attr(node,'data-nw-tip');
    if(text&&shapes.has(node.tagName)){
      const attrs:Record<string,string>={};for(const a of node.attrs??[])if(geometry.has(a.name)&&a.name!=='fill')attrs[a.name]=a.value;
      if(fill==='none')attrs.fill='none';
      const item={shape:node.tagName,text,attrs,transforms:next};if(validTips({...result,items:[item]}))result.items.push(item);
    }
    for(const child of node.childNodes??[])walk(child,next,depth+1,fill);
  };walk(svg,[],0);
  if(!result.items.length||!validTips(result))return;
  const json=JSON.stringify(result);return json.length<=200000?json:undefined;
}
