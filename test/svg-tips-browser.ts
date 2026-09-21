export {};
const output=document.querySelector('output')!,frame=document.querySelector('iframe')!;
const tick=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
try{
  for(let i=0;i<400&&!frame.contentDocument?.querySelector('img[data-nw-svg-tips]');i++)await tick();
  const doc=frame.contentDocument!,win=frame.contentWindow!;
  let img=doc.querySelector<HTMLImageElement>('img[data-nw-svg-tips]')!;check(img,'real editor SVG image rendered');await img.decode();
  const hover=async(x:number,y:number)=>{img.scrollIntoView();await tick();const r=img.getBoundingClientRect();img.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+x*r.width/600,clientY:r.top+y*r.height/240}));await tick();};
  await hover(100,130);check(doc.querySelector('.nw-svg-tooltip')?.textContent==='July\nNew customers: 53.5k','point tooltip');
  await hover(334,150);check(doc.querySelector('.nw-svg-tooltip')?.textContent==='Team A: 70','stack segment tooltip');
  await hover(455,100);check(doc.querySelector('.nw-svg-tooltip')?.textContent==='Remaining: 25%','pie path hit');
  await hover(415,60);check((doc.querySelector('.nw-svg-tooltip') as HTMLElement).hidden,'outside path inside its bounding box must not match');
  img.style.width='300px';img.style.height='120px';await hover(100,130);check(doc.querySelector('.nw-svg-tooltip')?.textContent==='July\nNew customers: 53.5k','resized chart hit');
  doc.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check((doc.querySelector('.nw-svg-tooltip') as HTMLElement).hidden,'escape dismisses tooltip');
  doc.dispatchEvent(new KeyboardEvent('keydown',{key:'e',ctrlKey:true,bubbles:true}));await tick();await tick();
  check(doc.querySelector('.reading-document'),'switched to reading mode');
  img=doc.querySelector<HTMLImageElement>('img[data-nw-svg-tips]')!;check(img,'reading image exists');await img.decode();await hover(334,90);check(doc.querySelector('.nw-svg-tooltip')?.textContent==='Team B: 50','reading mode tooltip');
  const extra=doc.querySelectorAll<HTMLImageElement>('img[data-nw-svg-tips]')[1];await extra.decode();extra.scrollIntoView();await tick();
  const hoverExtra=async(x:number,y:number)=>{const r=extra.getBoundingClientRect();extra.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+x*r.width/200,clientY:r.top+y*r.height/100}));await tick();};
  await hoverExtra(50,40);check(doc.querySelector('.nw-svg-tooltip')?.textContent==='<img src=x onerror=alert(1)>','transformed point and hostile text stays literal');
  check(!doc.querySelector('.nw-svg-tooltip img'),'tooltip does not parse HTML');
  await hoverExtra(80,65);check(doc.querySelector('.nw-svg-tooltip')?.textContent==='Curve','unfilled curved path hit');
  check((win as any).testEditCount===0,'hover never edits document');
  output.textContent='PASS: point, stack, pie path, curve, transforms, resize, Escape, reading view and inert hostile text; no source edits.';
}catch(error){output.textContent='FAIL: '+String(error);console.error(error);}
