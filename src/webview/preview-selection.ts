/** Source intervals originate in the parser, so repeated words stay unambiguous. */
export function mirrorSelection(body:HTMLElement,source:string,from:number,to:number,enabled:boolean){
  body.querySelectorAll('.preview-caret,.preview-range').forEach(n=>n.remove());body.querySelectorAll('.preview-object').forEach(n=>n.classList.remove('preview-object'));
  if(!enabled)return;
  const segments=[...body.querySelectorAll<HTMLElement>('[data-nw-text]')];
  const point=(el:HTMLElement,offset:number)=>{
    const raw=source.slice(Number(el.dataset.nwText),Number(el.dataset.nwEnd));let index=0,out=0;
    while(index<Math.max(0,offset-Number(el.dataset.nwText))&&index<raw.length){
      const entity=/^&(?:#\d+|#x[\da-f]+|[a-z]+);/i.exec(raw.slice(index));
      if(entity){const tmp=document.createElement('textarea');tmp.innerHTML=entity[0];index+=entity[0].length;out+=tmp.value.length;}
      else if(raw[index]==='\\'&&/[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(raw[index+1]??'')){index+=2;out++;}
      else {index++;out++;}
    }return Math.min(out,el.textContent?.length??0);
  };
  let found=false;
  for(const el of segments){const a=Number(el.dataset.nwText),b=Number(el.dataset.nwEnd);if(to<a||from>b||!el.firstChild)continue;const range=document.createRange();range.setStart(el.firstChild,point(el,Math.max(a,from)));range.setEnd(el.firstChild,point(el,Math.min(b,to)));const base=body.getBoundingClientRect();for(const r of range.getClientRects()){const mark=document.createElement('i');mark.className=from===to?'preview-caret':'preview-range';Object.assign(mark.style,{left:r.left-base.left+body.scrollLeft+'px',top:r.top-base.top+body.scrollTop+'px',width:(from===to?2:r.width)+'px',height:r.height+'px'});body.append(mark);found=true;}}
  if(!found){const candidates=[...body.querySelectorAll<HTMLElement>('[data-nw-from]')].filter(el=>Number(el.dataset.nwFrom)<=from&&Number(el.dataset.nwTo)>=to).sort((a,b)=>(Number(a.dataset.nwTo)-Number(a.dataset.nwFrom))-(Number(b.dataset.nwTo)-Number(b.dataset.nwFrom)));const target=candidates[0]??body.firstElementChild;
    const text=target?.querySelector<HTMLElement>('[data-nw-text]');const a=Number(text?.dataset.nwText),b=Number(text?.dataset.nwEnd);
    if(from===to&&text&&['STRONG','EM','DEL','MARK','H1','H2','H3','H4','H5','H6'].includes(target!.tagName)&&/^[\s#*_=~]*$/.test(source.slice(Math.min(from,a),Math.max(from,a)))){
      mirrorSelection(body,source,from<a?a:b,from<a?a:b,true);return;
    }target?.classList.add('preview-object');}
}
