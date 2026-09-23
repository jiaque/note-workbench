import {t} from './i18n';
import {parseFragment,serialize} from 'parse5';
import {toHtml} from 'hast-util-to-html';
import {cleanStyle,cleanSvgSheet} from './css-styles';
import {svgTips} from './svg-tips';
const tags=new Set('svg g path rect circle ellipse line polyline polygon text tspan title desc defs linearGradient radialGradient stop clipPath mask symbol use animate animateTransform animateMotion mpath set filter feGaussianBlur feOffset feFlood feComposite feMerge feMergeNode feColorMatrix feBlend'.split(' '));
const attrs=new Set('id class viewBox width height x y x1 x2 y1 y2 cx cy r rx ry d points fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset fill-opacity stroke-opacity opacity transform transform-origin text-anchor font-size font-family font-weight font-style dominant-baseline preserveAspectRatio offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod clip-path clipPathUnits mask maskUnits maskContentUnits filter filterUnits primitiveUnits stdDeviation dx dy in in2 result flood-color flood-opacity operator k1 k2 k3 k4 type values mode'.split(' '));
const animationAttrs=new Set('attributeName from to by values dur begin end repeatCount repeatDur fill calcMode keyTimes keySplines keyPoints additive accumulate type path rotate'.split(' '));
const animatedProperties=new Set('x y x1 x2 y1 y2 cx cy r rx ry width height d points fill stroke stroke-width stroke-dashoffset opacity fill-opacity stroke-opacity transform visibility'.split(' '));
const motionTags=new Set(['animate','animateTransform','animateMotion','set']);
attrs.add('fill-rule');
export function svgImage(source:string):{src:string;staticSrc:string;alt:string;width?:string;height?:string;style:string;tips?:string} {
  // Plotting tools emit this standard prolog. Discard it without loading its DTD;
  // all other doctypes and entity declarations remain rejected below.
  source=source.replace(/<!DOCTYPE\s+svg\s+PUBLIC\s+(["'])-\/\/W3C\/\/DTD SVG 1\.1\/\/EN\1\s+(["'])https?:\/\/www\.w3\.org\/Graphics\/SVG\/1\.1\/DTD\/svg11\.dtd\2\s*>/gi,'');
  if(source.length>500000||new TextEncoder().encode(source).byteLength>500000||/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error(t("SVG 超过 500KB 或包含不支持的文档声明"));
  const root:any=parseFragment(source),svg=root.childNodes.find((n:any)=>n.tagName==='svg');if(!svg)throw new Error(t("SVG 结构无效"));
  let count=0,animations=0;const ids=new Set<string>();
  const collect=(n:any)=>{if(++count>5000)throw new Error(t("SVG 节点超过 5000"));const id=n.attrs?.find((a:any)=>a.name==='id')?.value;if(id&&/^[a-zA-Z_][\w.-]*$/.test(id))ids.add(id);for(const c of n.childNodes??[])collect(c);};collect(svg);
  const visit=(node:any,staticMode:boolean):any=>{
    if(node.nodeName==='#text')return {...node,parentNode:undefined};
    if(node.tagName==='style'){const text=(node.childNodes??[]).map((c:any)=>c.value??'').join('');return {...node,attrs:[],childNodes:[{nodeName:'#text',value:cleanSvgSheet(text,staticMode)}]};}
    if(!tags.has(node.tagName))return undefined;
    const motion=motionTags.has(node.tagName);if(motion&&staticMode)return undefined;
    if(motion&&++animations>100)throw new Error(t("SVG 动画超过 100 个"));
    const get=(key:string)=>node.attrs?.find((a:any)=>a.name===key)?.value??'';
    if(motion&&node.tagName!=='animateMotion'&&!animatedProperties.has(get('attributeName')))return undefined;
    const filtered=(node.attrs??[]).filter((a:any)=>{
      const key=a.name,value=a.value;if(value.length>30000||/[<>\\]/.test(value))return false;
      if(key==='style')return !motion;
      if(key==='href')return ['use','mpath'].includes(node.tagName)&&/^#[a-zA-Z_][\w.-]*$/.test(value)&&ids.has(value.slice(1));
      if(!attrs.has(key)&&!(motion&&animationAttrs.has(key)))return false;
      if(/url\s*\(/i.test(value))return /^(?:fill|stroke|clip-path|mask|filter)$/.test(key)&&/^url\(#[a-zA-Z_][\w.-]*\)$/.test(value)&&ids.has(value.slice(5,-1));
      if(/(?:https?:|data:|javascript:|file:|@import|expression)/i.test(value))return false;
      if(key==='begin'||key==='end')return /^(?:\d+(?:\.\d+)?(?:ms|s)|[a-zA-Z_][\w-]*\.(?:begin|end)(?:\+\d+(?:\.\d+)?s)?)$/.test(value);
      if(['width','height'].includes(key))return /^(\d+(?:\.\d+)?)(px|%)?$/.test(value)&&parseFloat(value)<=4096;
      if(key==='viewBox'){const parts=value.trim().split(/[ ,]+/).map(Number);return parts.length===4&&parts.every(Number.isFinite)&&parts[2]>0&&parts[3]>0&&parts[2]<=100000&&parts[3]<=100000;}
      if(key==='stdDeviation')return value.split(/[ ,]+/).every((v:string)=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=20);
      return true;
    }).map((a:any)=>a.name==='style'?{...a,value:cleanStyle(a.value,true)}:a.name==='href'?{name:'href',value:a.value}:{...a});
    const out={...node,attrs:filtered,parentNode:undefined,childNodes:[] as any[]};out.childNodes=(node.childNodes??[]).map((n:any)=>visit(n,staticMode)).filter(Boolean);for(const c of out.childNodes)c.parentNode=out;return out;
  };
  const build=(staticMode:boolean)=>{const node=visit(svg,staticMode);node.attrs.push({name:'xmlns',value:'http://www.w3.org/2000/svg'});if(staticMode)node.childNodes.push({nodeName:'style',tagName:'style',namespaceURI:'http://www.w3.org/2000/svg',attrs:[],childNodes:[{nodeName:'#text',value:'*{animation:none!important;transition:none!important}'}]});return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(serialize({nodeName:'#document-fragment',childNodes:[node]} as any));};
  const label=svg.childNodes.find((n:any)=>n.tagName==='title')?.childNodes?.map((n:any)=>n.value??'').join('')||t("SVG 图表");
  const outerStyle=cleanStyle(svg.attrs.find((a:any)=>a.name==='style')?.value??'').split(';').filter(rule=>/^(width|height|max-width|min-width|display|margin(?:-(?:top|right|bottom|left))?|vertical-align):/.test(rule)).join(';');
  return {src:build(false),staticSrc:build(true),alt:label,style:outerStyle,tips:svgTips(source),width:svg.attrs.find((a:any)=>a.name==='width'&&/^\d+(px|%)?$/.test(a.value)&&parseFloat(a.value)<=4096)?.value,height:svg.attrs.find((a:any)=>a.name==='height'&&/^\d+(px|%)?$/.test(a.value)&&parseFloat(a.value)<=4096)?.value};
}
export function isolateSvg(tree:any){
  for(let i=0;i<(tree.children?.length??0);i++){
    const node=tree.children[i];if(node.tagName==='svg'){
      try{const image=svgImage(toHtml(node));tree.children[i]={type:'element',tagName:'img',properties:{src:image.src,alt:image.alt,style:image.style,dataNwSvgStatic:image.staticSrc,...(image.tips?{dataNwSvgTips:image.tips}:{}),...(image.width?{width:image.width}:{}),...(image.height?{height:image.height}:{})},children:[]};}
      catch(error){tree.children[i]={type:'element',tagName:'span',properties:{className:['render-error']},children:[{type:'text',value:String(error)}]};}
    }else isolateSvg(node);
  }
}
