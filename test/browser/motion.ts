import {enhanceEffects,setMotion,toggleMotion} from '../../src/webview/effects';
import {effects,entrances,hovers} from '../../src/shared/effects';
const result=document.getElementById('result')!;
const check=(value:unknown,label:string)=>{if(!value)throw new Error(label);};
const delay=(n:number)=>new Promise(resolve=>setTimeout(resolve,n));
async function run(){
  const root=document.getElementById('samples')!;
  for(const effect of effects){const div=document.createElement('div');div.dataset.nwEffect=effect;div.textContent=effect;div.style.cssText='padding:6px;--nw-duration:300ms;--nw-progress:65%;';root.append(div);}
  for(const enter of entrances){const div=document.createElement('div');div.dataset.nwEnter=enter;div.textContent=enter;root.append(div);}
  for(const hover of hovers){const div=document.createElement('div');div.dataset.nwHover=hover;div.textContent=hover;root.append(div);}
  enhanceEffects(root,false,'smoke');await delay(120);
  check(root.querySelectorAll('.nw-effect-root').length===34,'34 effect roots');
  check(root.querySelectorAll('[role=progressbar]').length===3,'accessible progress');
  for(const node of root.querySelectorAll('[data-nw-hover]')){node.dispatchEvent(new PointerEvent('pointerenter'));check(node.getAnimations({subtree:true}).length>0,'hover '+node.getAttribute('data-nw-hover'));node.dispatchEvent(new PointerEvent('pointerleave'));}
  for(const node of root.querySelectorAll('[data-nw-effect]'))check(node.getAnimations({subtree:true}).length>0,'animation '+node.getAttribute('data-nw-effect'));
  setMotion(false);await delay(40);check(root.getAnimations({subtree:true}).every(a=>a.playState!=='running'),'setting stops motion');
  check(root.querySelector('[aria-valuenow="65"]'),'progress retained');
  setMotion(true);toggleMotion();await delay(40);check(root.getAnimations({subtree:true}).every(a=>a.playState!=='running'),'pause stops motion');toggleMotion();
  const disclosure=document.getElementById('fold') as HTMLDetailsElement;enhanceEffects(document.getElementById('fold-host')!,false,'fold');disclosure.open=false;await delay(40);
  const fresh=document.createElement('div');fresh.innerHTML='<details id="fold" open><summary>折叠样例</summary><p>内容</p></details>';document.body.append(fresh);enhanceEffects(fresh,false,'fold');check(!(fresh.firstElementChild as HTMLDetailsElement).open,'fold restored');fresh.remove();
  const image=document.querySelector<HTMLImageElement>('img[data-nw-svg-static]')!;await image.decode();check(image.naturalWidth>0,'SVG image decoded');
  enhanceEffects(document.getElementById('svg-host')!);setMotion(false);check(!decodeURIComponent(image.src).includes('<animate '),'SVG static switch');setMotion(true);
  check(!document.querySelector('#svg-host svg,#svg-host script,#svg-host style'),'SVG is isolated from page');
  const staticRoot=document.createElement('div');staticRoot.innerHTML='<div data-nw-effect="progress" style="--nw-progress:65%">PDF</div>';document.body.append(staticRoot);enhanceEffects(staticRoot,true);check(staticRoot.getAnimations({subtree:true}).length===0,'PDF static');check(staticRoot.querySelector('[aria-valuenow="65"]'),'PDF progress retained');
  result.textContent='PASS: 34 presets, hover, settings, pause, folding, SVG image, static PDF';
}
void run().catch(error=>{result.textContent='FAIL: '+String(error);console.error(error);});
