import './export.css';
import {loadMermaid} from './mermaid';
declare global{interface Window{__notePdfState?:{ready?:boolean;error?:string}}}
async function prepare(){
  for(const details of document.querySelectorAll('details'))details.open=true;
  const diagrams=[...document.querySelectorAll<HTMLElement>('code.language-mermaid')];
  if(diagrams.length){const mermaid=await loadMermaid();
    for(const [index,code]of diagrams.entries()){const {svg}=await mermaid.render('pdf-diagram-'+index,code.textContent??'');const wrapper=document.createElement('div');wrapper.className='mermaid-diagram';wrapper.innerHTML=svg;code.parentElement!.replaceWith(wrapper);}
  }
  for(const media of document.querySelectorAll('audio,video,[data-pdf-src]')){const label=document.createElement('p');label.className='pdf-media-note';label.textContent=media.hasAttribute('data-pdf-src')?'[PDF 附件：请在原笔记中打开]':'[音视频附件：请在原笔记中播放]';media.replaceWith(label);}
  for(const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')){
    const href=a.getAttribute('href')??'';
    if(href.startsWith('#')){if(!document.getElementById(href.slice(1))&&document.getElementById('user-content-'+href.slice(1)))a.setAttribute('href','#user-content-'+href.slice(1));}
    else if(!/^(https?:|mailto:)/i.test(href))a.removeAttribute('href');
  }
  await document.fonts.ready;
  await Promise.all([...document.images].map(image=>image.decode().catch(()=>{throw new Error('图片加载失败：'+(image.alt||'未命名图片'));})));
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  window.__notePdfState={ready:true};
}
void prepare().catch(error=>{window.__notePdfState={error:'PDF 渲染失败：'+String(error)};});
