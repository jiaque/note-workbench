import {t} from '../shared/i18n';
import type {EditorView} from '@codemirror/view';
import {liveParser} from './live-preview';
import {FormatToolbar} from './authoring-toolbar';
import {mirrorSelection} from './preview-selection';

export function activePreviewBlock(source:string, position:number) {
  const root=liveParser(source);
  const node=root.children.find((n:any)=>n.position.start.offset<=position && n.position.end.offset>=position);
  if(!node){const from=position===0?0:source.lastIndexOf('\n',position-1)+1,end=source.indexOf('\n',position),to=end<0?source.length:end;if(!source.slice(from,to).trim())return {from,to};return;}
  if(node.type==='table' || node.type==='html' && /^\s*<table\b/i.test(source.slice(node.position.start.offset)))return;
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
  private positionFrame=0;
  private sizeObserver=new ResizeObserver(()=>this.schedulePosition());
  enabled=true;
  selectionEnabled=true;
  private toolbar=new FormatToolbar();
  private renderedSource='';
  private requestedSource='';
  constructor(private send:(message:unknown)=>void,private enhance:(body:HTMLElement)=>void) {
    this.box.className='block-preview';this.box.hidden=true;this.box.setAttribute('aria-label',t("当前块实时预览"));
    const header=document.createElement('header');header.className='block-preview-header';
    const title=document.createElement('span');title.textContent=t("实时预览");
    const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label',t("关闭当前预览"));
    close.onclick=()=>{this.dismissed=this.key;this.hide();};
    header.append(title,this.toolbar.dom,this.label,close);this.body.className='rendered block-preview-body';this.box.append(header,this.body);document.body.append(this.box);
    this.box.addEventListener('mousedown',event=>{if(!(event.target instanceof HTMLSelectElement))event.preventDefault();});
    this.box.addEventListener('click',event=>{if((event.target as Element).closest('a'))event.preventDefault();});
    this.sizeObserver.observe(this.box);
    window.addEventListener('resize',()=>this.schedulePosition());window.addEventListener('scroll',()=>this.schedulePosition(),true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!this.box.hidden){this.dismissed=this.key;this.hide();}});
  }
  hide(){clearTimeout(this.timer);cancelAnimationFrame(this.positionFrame);this.positionFrame=0;this.requestId++;this.box.hidden=true;}
  activate(view:EditorView){this.dismissed='';this.update(view,true);}
  update(view:EditorView|undefined,editing:boolean) {
    if(this.view!==view){if(this.view)this.sizeObserver.unobserve(this.view.dom);if(view)this.sizeObserver.observe(view.dom);}
    this.view=view;
    if(!this.enabled || !view || !editing || (!view.hasFocus&&!this.toolbar.dom.contains(document.activeElement))){this.hide();this.key='';return;}
    if(view.composing)return;
    const source=view.state.doc.toString(),block=activePreviewBlock(source,view.state.selection.main.head);
    if(!block){this.hide();this.key='';return;}
    const key=String(block.from);
    this.toolbar.update(view);
    if(this.dismissed===key)return;
    if(this.key!==key){this.dismissed='';this.renderedSource='';this.body.replaceChildren();}
    this.key=key;this.from=block.from;
    if(source===this.renderedSource&&!this.box.hidden){this.mirror();this.schedulePosition();return;}
    this.box.hidden=false;this.label.textContent=t("更新中…");this.schedulePosition();
    clearTimeout(this.timer);const requestId=++this.requestId;
    this.requestedSource=source;
    this.timer=setTimeout(()=>this.send({type:'preview',requestId,source,from:block.from,to:block.to}),130);
  }
  receive(message:any){
    if(message.requestId!==this.requestId || this.box.hidden)return;
    this.body.innerHTML=message.html;this.label.textContent=message.error?t("暂未渲染"):t("已更新");
    this.renderedSource=this.requestedSource;this.enhance(this.body);this.schedulePosition();
  }
  private mirror(){if(this.view&&this.renderedSource===this.view.state.doc.toString()){const s=this.view.state.selection.main;mirrorSelection(this.body,this.renderedSource,s.from,s.to,this.selectionEnabled);}}
  private schedulePosition(){
    if(this.box.hidden||this.positionFrame)return;
    // Measure after CodeMirror has replaced its rendered widget with editable source.
    this.positionFrame=requestAnimationFrame(()=>{this.positionFrame=0;this.position();});
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
    // Anchor the bottom edge when above: late image/diagram growth must go upward,
    // never downward over the editable line between resize notifications.
    this.box.style.top=below?active.bottom+10+'px':'auto';
    this.box.style.bottom=below?'auto':Math.max(10,innerHeight-caret.top+10)+'px';
    this.box.dataset.placement=below?'below':'above';
    this.mirror();
  }
}
