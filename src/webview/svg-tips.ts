import {validTips,type SvgTip,type SvgTips} from '../shared/svg-tips';
import './svg-tips.css';

function matrix(transforms:string[]){
  let result=new DOMMatrix();
  for(const value of transforms)for(const m of value.matchAll(/(\w+)\s*\(([^)]*)\)/g)){
    const a=m[2].trim().split(/[\s,]+/).map(Number);let next=new DOMMatrix();
    if(m[1]==='matrix')next=new DOMMatrix(a);
    if(m[1]==='translate')next.translateSelf(a[0],a[1]??0);
    if(m[1]==='scale')next.scaleSelf(a[0],a[1]??a[0]);
    if(m[1]==='rotate')next.translateSelf(a[1]??0,a[2]??0).rotateSelf(a[0]).translateSelf(-(a[1]??0),-(a[2]??0));
    if(m[1]==='skewX')next.skewXSelf(a[0]);if(m[1]==='skewY')next.skewYSelf(a[0]);
    result=result.multiply(next);
  }return result;
}
function shape(item:SvgTip){
  const p=new Path2D(),a=item.attrs,n=(key:string,def=0)=>Number(a[key]??def);
  if(item.shape==='path')return new Path2D(a.d??'');
  if(item.shape==='circle')p.arc(n('cx'),n('cy'),Math.max(0,n('r')),0,Math.PI*2);
  if(item.shape==='ellipse')p.ellipse(n('cx'),n('cy'),Math.max(0,n('rx')),Math.max(0,n('ry')),0,0,Math.PI*2);
  if(item.shape==='rect')p.roundRect(n('x'),n('y'),Math.max(0,n('width')),Math.max(0,n('height')),[{x:Math.max(0,n('rx',n('ry'))),y:Math.max(0,n('ry',n('rx')))}]);
  if(item.shape==='line'){p.moveTo(n('x1'),n('y1'));p.lineTo(n('x2'),n('y2'));}
  if(['polygon','polyline'].includes(item.shape)){
    const points=(a.points??'').match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi)?.map(Number)??[];
    for(let i=0;i+1<points.length;i+=2)i?p.lineTo(points[i],points[i+1]):p.moveTo(points[i],points[i+1]);
    if(item.shape==='polygon')p.closePath();
  }return p;
}
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;
const cache=new WeakMap<HTMLImageElement,{raw:string;data:SvgTips;paths:{item:SvgTip;path:Path2D}[]}>();
function prepared(img:HTMLImageElement){
  const raw=img.dataset.nwSvgTips??'';if(raw.length>200000)return;
  const cached=cache.get(img);if(cached?.raw===raw)return cached;
  try{const data=JSON.parse(raw);if(!validTips(data))return;const paths=data.items.map(item=>{const path=new Path2D();path.addPath(shape(item),matrix(item.transforms));return{item,path};});const value={raw,data,paths};cache.set(img,value);return value;}catch{return;}
}
export function hitSvgTip(img:HTMLImageElement,x:number,y:number):string|undefined {
  const p=prepared(img);if(!p)return;const r=img.getBoundingClientRect(),style=getComputedStyle(img);
  const left=parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft),top=parseFloat(style.borderTopWidth)+parseFloat(style.paddingTop);
  const w=r.width-left-parseFloat(style.borderRightWidth)-parseFloat(style.paddingRight),h=r.height-top-parseFloat(style.borderBottomWidth)-parseFloat(style.paddingBottom);
  x-=r.left+left;y-=r.top+top;if(x<0||y<0||x>w||y>h||w<=0||h<=0)return;
  const [bx,by,bw,bh]=p.data.box;let sx=w/bw,sy=h/bh,dx=0,dy=0;
  if(p.data.aspect!=='none'){
    sx=sy=p.data.aspect.endsWith('slice')?Math.max(sx,sy):Math.min(sx,sy);
    dx=(w-bw*sx)*(p.data.aspect.startsWith('xMax')?1:p.data.aspect.startsWith('xMid')?.5:0);
    dy=(h-bh*sy)*(p.data.aspect.includes('YMax')?1:p.data.aspect.includes('YMid')?.5:0);
  }
  x=(x-dx)/sx+bx;y=(y-dy)/sy+by;
  if(x<bx||y<by||x>bx+bw||y>by+bh)return;
  ctx.lineWidth=Math.min(100,8/Math.min(sx,sy));
  for(const {item,path} of [...p.paths].reverse()){
    const line=['line','polyline'].includes(item.shape)||item.attrs.fill==='none';
    if(line?ctx.isPointInStroke(path,x,y):ctx.isPointInPath(path,x,y,item.attrs['fill-rule']==='evenodd'?'evenodd':'nonzero'))return item.text;
  }
}
const tip=document.createElement('div');tip.className='nw-svg-tooltip';tip.id='nw-svg-tooltip';tip.role='tooltip';tip.hidden=true;document.body.append(tip);
let owner:HTMLImageElement|undefined;
const hide=()=>{tip.hidden=true;owner?.removeAttribute('aria-describedby');owner=undefined;};
function show(img:HTMLImageElement,text:string,x:number,y:number){
  if(owner!==img)hide();owner=img;tip.textContent=text;tip.hidden=false;img.setAttribute('aria-describedby',tip.id);
  const r=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(x+16,innerWidth-r.width-8))+'px';tip.style.top=Math.max(8,Math.min(y+16,innerHeight-r.height-8))+'px';
}
document.addEventListener('pointermove',event=>{
  const img=event.target instanceof HTMLImageElement?event.target:undefined;
  if(!img?.hasAttribute('data-nw-svg-tips')){hide();return;}
  const text=hitSvgTip(img,event.clientX,event.clientY);if(text)show(img,text,event.clientX,event.clientY);else hide();
});
document.addEventListener('pointerleave',hide);document.addEventListener('pointerdown',hide,true);document.addEventListener('scroll',hide,true);window.addEventListener('blur',hide);window.addEventListener('resize',hide);
document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
new MutationObserver(()=>{if(owner&&!owner.isConnected)hide();}).observe(document.body,{childList:true,subtree:true});
