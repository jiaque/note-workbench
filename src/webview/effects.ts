import {effects,entrances,hovers} from '../shared/effects';
import './effects.css';
type Instance={node:HTMLElement;animations:Animation[];visible:boolean;triggered:boolean;hovered:boolean;cleanup:()=>void;image?:{live:string;still:string;rawLive?:string;rawStill?:string};enter?:Animation;hover?:Animation};
const instances=new Map<HTMLElement,Instance>();
let enabled=true,paused=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
try{CSS.registerProperty({name:'--nw-ring-progress',syntax:'<percentage>',inherits:false,initialValue:'0%'});}catch{/* Already registered or unsupported: show the static target. */}
const active=()=>enabled&&!paused&&!reduced.matches&&!document.hidden;
const detailsState=new Map<string,boolean>();
const completed=new Set<string>();
const timelines=new Map<string,(number|null)[]>();
const hash=(text:string)=>{let h=2166136261;for(let n=0;n<text.length;n++)h=Math.imul(h^text.charCodeAt(n),16777619);return String(h>>>0);};
const observer=new IntersectionObserver(entries=>{for(const entry of entries){const instance=instances.get(entry.target as HTMLElement);if(instance){const was=instance.visible;instance.visible=entry.isIntersecting;if(!was&&instance.visible&&instance.node.dataset.nwTrigger==='visible'){instance.triggered=true;instance.animations.forEach(a=>{a.currentTime=0;});}update(instance);}}});
function update(i:Instance){
  const closed=!!i.node.closest('details:not([open])'),insideEditor=!!i.node.querySelector('.cell-editor'),hidden=!!i.node.closest('[hidden]');
  const on=active()&&i.visible&&!closed&&!hidden&&!insideEditor&&i.node.dataset.nwPlay!=='paused';
  if(i.image){const src=on?i.image.live:i.image.still;if(i.node.getAttribute('src')!==src)i.node.setAttribute('src',src);return;}
  if(i.hover){if(!enabled||reduced.matches)i.hover.cancel();else if(!on)i.hover.pause();else if(i.hovered&&i.hover.playState==='paused')i.hover.play();}
  for(const a of i.animations){if(!enabled||reduced.matches){try{a.finish();}catch{a.currentTime=0;}a.pause();}else if(on&&i.triggered&&!i.hovered&&(!i.enter||i.enter.playState==='finished')&&a.playState!=='finished')a.play();else a.pause();}
  if(i.enter){if(!enabled||reduced.matches||paused){i.enter.finish();}else if(on&&i.enter.playState!=='finished')i.enter.play();else i.enter.pause();}
}
export function setMotion(value:boolean){enabled=value;document.documentElement.classList.toggle('nw-motion-off',!enabled||paused||reduced.matches);instances.forEach(update);}
export function toggleMotion(){paused=!paused;setMotion(enabled);return paused;}
export function replaySvg(){for(const i of instances.values())if(i.image){i.node.setAttribute('src',i.image.still);requestAnimationFrame(()=>update(i));}}
reduced.addEventListener('change',()=>setMotion(enabled));document.addEventListener('visibilitychange',()=>instances.forEach(update));
function themedSvg(source:string,node:HTMLElement){
  try{const xml=new DOMParser().parseFromString(decodeURIComponent(source.slice(source.indexOf(',')+1)),'image/svg+xml'),svg=xml.documentElement;if(svg.localName!=='svg')return source;const style=getComputedStyle(node);if(!svg.hasAttribute('color'))svg.setAttribute('color',style.color);if(!svg.hasAttribute('font-family')&&!(svg as unknown as SVGElement).style.fontFamily)(svg as unknown as SVGElement).style.fontFamily=style.fontFamily;return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));}catch{return source;}
}
new MutationObserver(()=>{for(const i of instances.values())if(i.image?.rawLive){i.image.live=themedSvg(i.image.rawLive,i.node);i.image.still=themedSvg(i.image.rawStill!,i.node);update(i);}}).observe(document.body,{attributes:true,attributeFilter:['class','style']});
// Remove detached instances without retaining deleted editor widgets or preview trees.
new MutationObserver(()=>{for(const [node,i]of instances)if(!node.isConnected){i.cleanup();observer.unobserve(node);instances.delete(node);}}).observe(document.documentElement,{childList:true,subtree:true});
function decoration(node:HTMLElement,className:string){const span=document.createElement('span');span.className='nw-decoration '+className;span.setAttribute('aria-hidden','true');node.append(span);return span;}
export function enhanceEffects(root:HTMLElement,staticMode=false,identity=''){
  for(const image of root.querySelectorAll<HTMLImageElement>('img[data-nw-svg-static]')){
    if(instances.has(image))continue;const still=image.dataset.nwSvgStatic!;
    if(!still.startsWith('data:image/svg+xml;charset=utf-8,'))continue;
    const rawLive=image.src,live=themedSvg(rawLive,image),themedStill=themedSvg(still,image);if(staticMode){image.src=themedStill;continue;}
    const i:Instance={node:image,animations:[],visible:true,triggered:true,hovered:false,cleanup:()=>{},image:{live,still:themedStill,rawLive,rawStill:still}};instances.set(image,i);observer.observe(image);update(i);
  }
  for(const [index,details]of [...root.querySelectorAll<HTMLDetailsElement>('details')].entries()){
    if(details.dataset.nwDisclosure)continue;details.dataset.nwDisclosure='true';
    const key=hash(identity+':'+index+':'+details.outerHTML),initial=details.open;
    if(staticMode){details.open=true;continue;}
    if(identity&&detailsState.has(key))details.open=detailsState.get(key)!;
    let previous=details.open;
    details.addEventListener('toggle',()=>{
      if(details.open!==previous){if(identity){detailsState.set(key,details.open);if(detailsState.size>1000)detailsState.delete(detailsState.keys().next().value!);}previous=details.open;
        if(active()&&details.open){const duration=parseFloat(getComputedStyle(details).getPropertyValue('--nw-fold-duration'))||180;for(const child of details.children)if(child.tagName!=='SUMMARY')child.animate([{opacity:.25},{opacity:1}],{duration,easing:'ease-out'});}
        details.dispatchEvent(new Event('nw-layout',{bubbles:true}));instances.forEach(update);
      }
    });
    details.dataset.nwInitial=String(initial);
  }
  for(const [index,node]of [...root.querySelectorAll<HTMLElement>('[data-nw-effect],[data-nw-enter],[data-nw-hover]')].entries()){
    if(instances.has(node)||!['DIV','SECTION','ARTICLE','ASIDE','FIGURE','SPAN'].includes(node.tagName))continue;
    const effect=node.dataset.nwEffect??'',enter=node.dataset.nwEnter??'',hover=node.dataset.nwHover??'';
    if(!effects.includes(effect as any)&&!entrances.includes(enter as any)&&!hovers.includes(hover as any))continue;
    const original=node.getAttribute('style')??'',key=hash(identity+':effect:'+index+':'+node.outerHTML);
    node.classList.add('nw-effect-root');
    const style=getComputedStyle(node),get=(name:string,fallback:string)=>style.getPropertyValue('--nw-'+name).trim()||fallback;
    const duration=(name:string,fallback:number)=>{const v=get(name,String(fallback)+'ms');return parseFloat(v)*(v.endsWith('ms')?1:1000);};
    const color=get('color','var(--vscode-focusBorder,#2563eb)'),distance=get('distance','6px'),scale=get('scale','1.03'),angle=get('angle','3deg'),glow=get('glow-size','12px');
    const animations:Animation[]=[],added:HTMLElement[]=[];
    const make=(className:string)=>{const span=decoration(node,className);added.push(span);return span;};
    const i:Instance={node,animations,visible:true,triggered:!['click','hover'].includes(node.dataset.nwTrigger??''),hovered:false,cleanup:()=>{animations.forEach(a=>a.cancel());i.enter?.cancel();},};
    const run=(target:Element,frames:Keyframe[],fallback=2000,iterations=Infinity)=>{
      if(staticMode)return;
      const count=node.dataset.nwRepeat;const animation=target.animate(frames,{duration:duration('duration',fallback),delay:duration('delay',0),easing:get('easing','ease-in-out'),iterations:count==='infinite'?Infinity:count?Number(count):iterations,direction:(node.dataset.nwDirection??'normal') as PlaybackDirection,fill:'both'});animation.pause();animations.push(animation);return animation;
    };
    const conflicts=!!node.style.transform||!!node.style.translate||!!node.style.rotate||!!node.style.scale;
    const movement=new Set(['pulse','float','spin','swing','bounce','shake']);
    if(conflicts&&(movement.has(effect)||['lift','zoom','tilt'].includes(hover)))node.title='已保留原有变换，停用冲突的位置动效。';
    if(['breathe','glow','shine','gradient-flow','border-flow','ripple','highlight','skeleton'].includes(effect)){
      const layer=make('nw-overlay');layer.style.borderRadius='inherit';
      if(effect==='breathe'||effect==='glow'){layer.style.boxShadow=`0 0 ${glow} ${color}`;run(layer,[{opacity:.1},{opacity:Math.max(.1,Number(get('intensity','.3')))},{opacity:.1}]);}
      if(effect==='shine'||effect==='skeleton'){layer.style.background=`linear-gradient(110deg,transparent 30%,${color} 50%,transparent 70%)`;layer.style.backgroundSize='300% 100%';layer.style.opacity=get('intensity','.2');run(layer,[{backgroundPosition:'150% 0'},{backgroundPosition:'-150% 0'}],2400);}
      if(effect==='gradient-flow'){layer.style.background=`linear-gradient(110deg,${color},${get('color-end','#a78bfa')},${color})`;layer.style.backgroundSize='300% 100%';layer.style.opacity=get('intensity','.2');run(layer,[{backgroundPosition:'0% 50%'},{backgroundPosition:'100% 50%'},{backgroundPosition:'0% 50%'}],6000);}
      if(effect==='border-flow'){layer.style.padding='2px';layer.style.background=`linear-gradient(110deg,${color},${get('color-end','#a78bfa')},${color})`;layer.style.backgroundSize='300% 100%';layer.style.mask='linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)';layer.style.maskComposite='exclude';run(layer,[{backgroundPosition:'0% 0'},{backgroundPosition:'100% 0'},{backgroundPosition:'0% 0'}],3000);}
      if(effect==='ripple'){layer.style.border=`1px solid ${color}`;run(layer,[{transform:'scale(1)',opacity:.6},{transform:`scale(${scale})`,opacity:0}]);}
      if(effect==='highlight'){layer.style.background=color;run(layer,[{opacity:.3},{opacity:0}],1200,1);}
    }
    if(movement.has(effect)&&!conflicts){
      const frames:Record<string,Keyframe[]>={pulse:[{transform:'scale(1)'},{transform:`scale(${scale})`},{transform:'scale(1)'}],float:[{transform:'translateY(0)'},{transform:`translateY(-${distance})`},{transform:'translateY(0)'}],spin:[{transform:'rotate(0)'},{transform:'rotate(360deg)'}],swing:[{transform:`rotate(-${angle})`},{transform:`rotate(${angle})`},{transform:`rotate(-${angle})`}],bounce:[{transform:'translateY(0)'},{transform:`translateY(-${distance})`,offset:.4},{transform:'translateY(0)'}],shake:[{transform:'translateX(0)'},{transform:`translateX(-${distance})`},{transform:`translateX(${distance})`},{transform:'translateX(0)'}]};
      run(node,frames[effect],effect==='bounce'?800:effect==='shake'?400:2000,['bounce','shake'].includes(effect)?1:Infinity);
    }
    if(['progress','progress-striped','progress-ring','loading-bar','loading-dots','spinner'].includes(effect)){
      const progress=parseFloat(get('progress','0%')),track=make('nw-track');track.style.setProperty('--nw-resolved-color',color);
      if(effect.startsWith('progress')){track.setAttribute('role','progressbar');track.removeAttribute('aria-hidden');track.setAttribute('aria-label',node.textContent?.trim()||'进度');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(progress));}
      if(effect==='progress-ring'||effect==='spinner'){
        track.className+=' nw-ring';track.style.setProperty('--nw-ring-progress',progress+'%');track.style.background=`conic-gradient(${color} ${effect==='spinner'?'25%':'var(--nw-ring-progress)'},${get('track-color','#dce2ea')} 0)`;
        if(effect==='spinner')run(track,[{transform:'rotate(0)'},{transform:'rotate(360deg)'}],1200);
        else run(track,[{'--nw-ring-progress':'0%'},{'--nw-ring-progress':progress+'%'}],600,1);
      }else if(effect==='loading-dots'){
        track.className+=' nw-dots';for(let n=0;n<3;n++){const dot=document.createElement('span');dot.textContent='●';track.append(dot);const a=run(dot,[{opacity:.2},{opacity:1},{opacity:.2}],1200);if(a)a.effect!.updateTiming({delay:n*160});}
      }else{
        const fill=document.createElement('span');fill.className='nw-fill';track.append(fill);fill.style.width=effect==='loading-bar'?'30%':progress+'%';fill.style.backgroundColor=color;
        if(effect==='loading-bar')run(fill,[{transform:'translateX(0)'},{transform:'translateX(233%)'},{transform:'translateX(0)'}]);
        else if(effect==='progress')run(fill,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],600,1);
        else {fill.style.backgroundImage='repeating-linear-gradient(45deg,transparent 0 8px,#ffffff55 8px 16px)';fill.style.backgroundSize='24px 24px';run(fill,[{backgroundPosition:'0 0'},{backgroundPosition:'24px 0'}],1200);}
      }
    }
    if(enter&&!staticMode&&!completed.has(key)&&!conflicts){
      const starts:Record<string,Keyframe>={fade:{opacity:0},'slide-up':{opacity:0,transform:`translateY(${distance})`},'slide-down':{opacity:0,transform:`translateY(-${distance})`},'slide-left':{opacity:0,transform:`translateX(${distance})`},'slide-right':{opacity:0,transform:`translateX(-${distance})`},zoom:{opacity:0,transform:'scale(.96)'},reveal:{clipPath:'inset(0 100% 0 0)'},'blur-in':{opacity:0,filter:'blur(4px)'}};
      i.enter=node.animate([starts[enter],{opacity:style.opacity,transform:style.transform,filter:style.filter,clipPath:'inset(0 0 0 0)'}],{duration:duration('enter-duration',400),fill:'backwards'});i.enter.pause();i.enter.onfinish=()=>{completed.add(key);if(completed.size>1000)completed.delete(completed.values().next().value!);update(i);};
    }
    const interactive=(event:Event)=>!!(event.target as Element).closest('a,button,input,summary,textarea,table,audio,video');
    let hoverAnimation:Animation|undefined;
    const hoverOn=()=>{
      if(node.dataset.nwTrigger==='hover'){i.triggered=true;update(i);}
      if(!hover||!active()||staticMode)return;
      i.hovered=true;animations.forEach(a=>a.pause());
      if(!conflicts)for(const a of animations)if(a.effect instanceof KeyframeEffect&&a.effect.target===node)a.cancel();
      const frames:Record<string,Keyframe>={lift:{transform:`translateY(-${distance})`,boxShadow:`0 6px 18px #0002`},zoom:{transform:`scale(${scale})`},glow:{boxShadow:`0 0 ${glow} ${color}`},tint:{backgroundColor:color},underline:{textDecoration:'underline'},tilt:{transform:`rotate(${angle})`}};
      if(conflicts&&['lift','zoom','tilt'].includes(hover))return;
      hoverAnimation?.cancel();
      if(hover==='underline'){let line=node.querySelector<HTMLElement>(':scope>.nw-underline');if(!line){line=make('nw-underline');line.style.cssText='position:absolute;bottom:0;left:0;right:0;height:2px;background:currentColor;transform:scaleX(0);transform-origin:left';}hoverAnimation=line.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:duration('hover-duration',180),fill:'forwards'});}
      else hoverAnimation=node.animate([{},frames[hover]],{duration:duration('hover-duration',180),fill:'forwards'});
      i.hover=hoverAnimation;
    };
    const hoverOff=()=>{hoverAnimation?.cancel();i.hovered=false;if(node.dataset.nwTrigger==='hover')i.triggered=false;update(i);};
    const trigger=(event:Event)=>{if(interactive(event)||!active())return;i.triggered=true;animations.forEach(a=>{a.currentTime=0;});update(i);};
    if(!staticMode){node.addEventListener('pointerenter',hoverOn);node.addEventListener('pointerleave',hoverOff);node.addEventListener('focusin',hoverOn);node.addEventListener('focusout',hoverOff);
      if(node.dataset.nwTrigger==='click'){node.tabIndex=0;node.addEventListener('click',trigger);node.addEventListener('keydown',e=>{if(e.target===node&&['Enter',' '].includes(e.key)){e.preventDefault();trigger(e);}});}
      node.addEventListener('pointerdown',()=>{for(const a of animations)if(a.effect instanceof KeyframeEffect&&a.effect.target===node)a.cancel();},true);
      const cached=timelines.get(key);if(cached)animations.forEach((a,n)=>{if(cached[n]!==undefined)a.currentTime=cached[n];});
      const cleanup=i.cleanup;i.cleanup=()=>{timelines.set(key,animations.map(a=>typeof a.currentTime==='number'?a.currentTime:null));if(timelines.size>1000)timelines.delete(timelines.keys().next().value!);cleanup();hoverAnimation?.cancel();};instances.set(node,i);observer.observe(node);update(i);
    }
    // Static output intentionally keeps semantic progress and all original text.
    if(staticMode)node.setAttribute('data-nw-static','true');
    node.dataset.nwOriginalStyle=original;
  }
}
