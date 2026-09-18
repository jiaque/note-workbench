import type {EditorView} from '@codemirror/view';
import {liveParser} from './live-preview';

export function activePreviewBlock(source:string, position:number) {
  const root=liveParser(source);
  const node=root.children.find((n:any)=>n.position.start.offset<=position && n.position.end.offset>=position);
  if(!node || node.type==='table' || node.type==='html' && /^\s*<table\b/i.test(source.slice(node.position.start.offset)))return;
  return {from:node.position.start.offset as number,to:node.position.end.offset as number};
}

export class BlockPreview {
  private box=document.createElement('aside');
  private body=document.createElement('div');
  private label=document.createElement('span');
  private timer?:ReturnType<typeof setTimeout>;
  private requestId=0;
  private key='';
  private dismissed='';
  private view?:EditorView;
  private from=0;
  enabled=true;
  constructor(private send:(message:unknown)=>void,private enhance:(body:HTMLElement)=>void) {
    this.box.className='block-preview';this.box.hidden=true;this.box.setAttribute('aria-label','当前块实时预览');
    const header=document.createElement('header');header.className='block-preview-header';
    const title=document.createElement('span');title.textContent='实时预览';
    const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','关闭当前预览');
    close.onclick=()=>{this.dismissed=this.key;this.hide();};
    header.append(title,this.label,close);this.body.className='rendered block-preview-body';this.box.append(header,this.body);document.body.append(this.box);
    this.box.addEventListener('mousedown',event=>event.preventDefault());
    this.box.addEventListener('click',event=>{if((event.target as Element).closest('a'))event.preventDefault();});
    window.addEventListener('resize',()=>this.position());window.addEventListener('scroll',()=>this.position(),true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!this.box.hidden){this.dismissed=this.key;this.hide();}});
  }
  hide(){clearTimeout(this.timer);this.requestId++;this.box.hidden=true;}
  update(view:EditorView|undefined,editing:boolean) {
    this.view=view;
    if(!this.enabled || !view || !editing || !view.hasFocus){this.hide();this.key='';return;}
    if(view.composing)return;
    const source=view.state.doc.toString(),block=activePreviewBlock(source,view.state.selection.main.head);
    if(!block){this.hide();this.key='';return;}
    const key=String(block.from);
    if(this.dismissed===key)return;
    if(this.key!==key){this.dismissed='';this.body.replaceChildren();}
    this.key=key;this.from=block.from;
    this.box.hidden=false;this.label.textContent='更新中…';this.position();
    clearTimeout(this.timer);const requestId=++this.requestId;
    this.timer=setTimeout(()=>this.send({type:'preview',requestId,source,from:block.from,to:block.to}),130);
  }
  receive(message:any){
    if(message.requestId!==this.requestId || this.box.hidden)return;
    this.body.innerHTML=message.html;this.label.textContent=message.error?'暂未渲染':'已更新';
    this.enhance(this.body);requestAnimationFrame(()=>this.position());
  }
  private position(){
    if(this.box.hidden || !this.view)return;
    const active=this.view.coordsAtPos(this.view.state.selection.main.head);
    const start=this.view.coordsAtPos(Math.min(this.from,this.view.state.doc.length));
    const caret=start&&start.top>=0?start:active;if(!caret||!active)return;
    const editor=this.view.dom.getBoundingClientRect(),width=Math.min(editor.width,innerWidth-32);
    this.box.style.width=width+'px';this.box.style.left=Math.max(16,Math.min(editor.left,innerWidth-width-16))+'px';
    const available=caret.top-20;
    const below=available<100;
    const height=Math.min(320,below?innerHeight-active.bottom-24:available);
    this.box.style.maxHeight=Math.max(90,height)+'px';
    this.box.style.top=(below?active.bottom+10:Math.max(10,caret.top-this.box.getBoundingClientRect().height-10))+'px';
    this.box.dataset.placement=below?'below':'above';
  }
}
