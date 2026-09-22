import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {BlockPreview} from '../src/webview/block-preview';
import '../src/webview/editor.css';
import '../src/webview/document.css';
import '../src/webview/live-preview.css';

const output=document.querySelector('output')!;
const source='\n'.repeat(14)+'![](.figures/missing.svg)\n\nAfter image';
const view=new EditorView({parent:document.querySelector('main')!,state:EditorState.create({doc:source,extensions:[EditorView.lineWrapping]})});
let request:any;
const preview=new BlockPreview(message=>{request=message;},()=>{});
const tick=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const settle=async()=>{for(let i=0;i<6;i++)await tick();};
try{
  view.dispatch({selection:{anchor:source.indexOf('.figures')+3}});view.focus();await settle();preview.update(view,true);
  for(let i=0;i<100&&!request;i++)await tick();
  check(request,'preview requested');
  preview.receive({requestId:request.requestId,html:'<img alt="Missing image">'});await settle();
  const box=document.querySelector<HTMLElement>('.block-preview')!;
  const assertClear=()=>{const b=box.getBoundingClientRect(),c=view.coordsAtPos(view.state.selection.main.head)!;check(box.hidden||b.bottom<=c.top||b.top>=c.bottom,'preview overlaps editable image path');};
  assertClear();
  // Loading an image changes intrinsic height after the preview response.
  const img=box.querySelector('img')!;
  img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="teal"/></svg>');
  await img.decode();await settle();assertClear();
  // Failure/replacement shrinks content again; position must follow both directions.
  img.replaceWith(document.createTextNode('图片加载失败'));await settle();assertClear();
  view.dom.style.marginTop='-280px';await settle();preview.update(view,true);await settle();assertClear();
  check(view.state.doc.toString()===source,'preview positioning changed source');
  output.textContent='PASS: delayed image load, failed image placeholder, editor reflow, caret unobscured and source unchanged';
}catch(error){output.textContent='FAIL: '+String(error);console.error(error);}
