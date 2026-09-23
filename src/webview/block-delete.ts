import type {EditorView} from '@codemirror/view';
import {authoringTree,managedTocs} from '../shared/authoring';
import {t} from '../shared/i18n';

export function deletableBlocks(source:string){
  const tocs=managedTocs(source);
  return [...authoringTree(source).children.filter((n:any)=>n.type!=='yaml'&&!tocs.some(t=>n.position.start.offset>=t.from&&n.position.end.offset<=t.to)).map((n:any)=>({from:n.position.start.offset as number,to:n.position.end.offset as number})),...tocs.map(({from,to})=>({from,to}))].sort((a,b)=>a.from-b.from);
}
export class BlockDelete {
  private button=document.createElement('button');private outline=document.createElement('div');private tip=document.createElement('div');private toast=document.createElement('div');
  private selected?:{view:EditorView;source:string;from:number;to:number};private cached='';private blocks:ReturnType<typeof deletableBlocks>=[];private frame=0;private timer?:ReturnType<typeof setTimeout>;private deletedSource?:string;
  constructor(private getView:()=>EditorView|undefined,private enabled:()=>boolean,private flush:()=>void,private undo:()=>void){
    this.button.className='block-delete-button';this.button.textContent='−';this.button.setAttribute('aria-label',t('删除当前块'));this.outline.className='block-delete-outline';this.tip.className='block-delete-tip';this.tip.textContent=t('删除当前块');this.toast.className='block-delete-toast';this.toast.setAttribute('role','status');
    this.button.hidden=this.outline.hidden=this.tip.hidden=this.toast.hidden=true;document.body.append(this.button,this.outline,this.tip,this.toast);
    this.button.onmousedown=e=>e.preventDefault();this.button.onpointerenter=()=>{cancelAnimationFrame(this.frame);if(this.selected){this.outline.hidden=this.tip.hidden=false;}};this.button.onpointerleave=()=>{this.outline.hidden=this.tip.hidden=true;};this.button.onclick=()=>this.remove();
    document.addEventListener('pointermove',e=>{if(e.target===this.button)return;cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.hover(e.clientX,e.clientY,e.target as Element));});
    window.addEventListener('scroll',()=>this.hide(),true);window.addEventListener('resize',()=>this.hide());window.addEventListener('blur',()=>this.hide());document.documentElement.addEventListener('pointerleave',()=>this.hide());
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.hide();});
  }
  hide(){cancelAnimationFrame(this.frame);this.selected=undefined;this.button.hidden=this.outline.hidden=this.tip.hidden=true;}
  changed(){this.hide();if(this.deletedSource!==undefined&&this.getView()?.state.doc.toString()!==this.deletedSource){this.toast.hidden=true;this.deletedSource=undefined;}}
  private hover(x:number,y:number,target:Element){
    const view=this.getView();if(!view||!this.enabled()||view.state.readOnly||view.composing||target.closest('.block-preview,.selection-toolbar,.block-insert-menu,.document-menu,dialog')){this.hide();return;}
    const area=view.contentDOM.getBoundingClientRect();if(x<area.left||x>Math.min(innerWidth,area.right+32)){this.hide();return;}
    const source=view.state.doc.toString();if(source!==this.cached){this.cached=source;this.blocks=deletableBlocks(source);}
    const widgets=[...view.dom.querySelectorAll<HTMLElement>('.live-widget')].filter(el=>el.closest('.cm-editor')===view.dom).map(el=>({position:view.posAtDOM(el),rect:el.getBoundingClientRect()}));
    for(const block of this.blocks){const a=view.coordsAtPos(block.from,1),b=view.coordsAtPos(block.to,-1);if(!a||!b)continue;
      const rendered=widgets.filter(w=>w.position>=block.from&&w.position<block.to);
      const top=rendered.length?Math.min(...rendered.map(w=>w.rect.top)):a.top,bottom=rendered.length?Math.max(...rendered.map(w=>w.rect.bottom)):Math.max(a.bottom,b.bottom);if(y<top||y>bottom)continue;
      this.selected={view,source,...block};this.button.hidden=false;this.outline.hidden=this.tip.hidden=true;
      const left=Math.min(area.right+5,innerWidth-27),center=Math.max(14,Math.min(innerHeight-14,(Math.max(0,top)+Math.min(innerHeight,bottom))/2));
      Object.assign(this.button.style,{left:left+'px',top:center-12+'px'});Object.assign(this.outline.style,{left:area.left+'px',top:top+'px',width:area.width+'px',height:bottom-top+'px'});Object.assign(this.tip.style,{right:Math.max(8,innerWidth-left-24)+'px',top:Math.max(4,center-43)+'px'});return;
    }this.hide();
  }
  private remove(){const selected=this.selected;if(!selected)return;this.flush();const {view,source,from,to}=selected;if(view!==this.getView()||view.state.doc.toString()!==source||view.state.readOnly||view.composing||!this.enabled()){this.hide();return;}
    const next=this.blocks.find(b=>b.from>=to&&b.from!==from),previous=[...this.blocks].reverse().find(b=>b.to<=from),anchor=next?next.from-(to-from):previous?.to??0;
    this.hide();view.dispatch({changes:{from,to,insert:''},selection:{anchor},scrollIntoView:true,userEvent:'delete'});view.focus();
    this.deletedSource=view.state.doc.toString();const label=document.createElement('span');label.textContent=t('已删除当前块');const undo=document.createElement('button');undo.textContent=t('撤销');undo.onclick=()=>{if(this.getView()===view&&view.state.doc.toString()===this.deletedSource)this.undo();this.toast.hidden=true;};this.toast.replaceChildren(label,undo);this.toast.hidden=false;clearTimeout(this.timer);this.timer=setTimeout(()=>{this.toast.hidden=true;},5000);
  }
}
