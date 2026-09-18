import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

export function mountPdf(host: HTMLElement): () => void {
  const script=document.querySelector<HTMLScriptElement>('script[type="module"]')!;
  const base=new URL('./pdf/',script.src).href;
  GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.mjs';
  const url=new URL(host.dataset.pdfSrc!,document.baseURI);
  const params=new URLSearchParams(url.hash.slice(1)); url.hash='';
  let pageNumber=Math.max(1,Number(params.get('page'))||1), disposed=false, busy=false;
  const height=Number(params.get('height')); if(height>0)host.style.maxHeight=Math.min(height,2000)+'px';
  host.replaceChildren();
  const controls=document.createElement('div'), previous=document.createElement('button'), next=document.createElement('button'), label=document.createElement('span'), canvas=document.createElement('canvas');
  controls.className='pdf-controls'; previous.textContent='上一页'; next.textContent='下一页'; controls.append(previous,label,next);host.append(controls,canvas);
  canvas.setAttribute('role','img');
  const task=getDocument({url:url.href,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/',useWasm:false,disableFontFace:true});
  let pdf: Awaited<typeof task.promise>;
  const render=async()=>{
    if(disposed||busy)return;busy=true;previous.disabled=next.disabled=true;
    try{
      pageNumber=Math.min(pageNumber,pdf.numPages);const page=await pdf.getPage(pageNumber);
      const natural=page.getViewport({scale:1}), scale=Math.min(2,Math.max(320,host.clientWidth-4)/natural.width), viewport=page.getViewport({scale});
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label',`PDF 第 ${pageNumber} 页，共 ${pdf.numPages} 页`);
      await page.render({canvas,viewport}).promise;label.textContent=`${pageNumber} / ${pdf.numPages}`;
    }catch(error){if(!disposed)label.textContent='PDF 渲染失败：'+String(error);}
    finally{busy=false;previous.disabled=pageNumber<=1;next.disabled=pageNumber>=pdf.numPages;}
  };
  previous.onclick=()=>{pageNumber--;void render();};next.onclick=()=>{pageNumber++;void render();};
  void task.promise.then(document=>{pdf=document;if(!disposed)void render();}).catch(error=>{if(!disposed)host.textContent='无法加载 PDF：'+String(error);});
  return()=>{disposed=true;void task.destroy();};
}
