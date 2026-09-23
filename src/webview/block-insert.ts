import {EditorView} from '@codemirror/view';
import {authoringTree,insertBlock,makeToc,managedTocs,tocUpdates,type TocOptions} from '../shared/authoring';
import {t} from '../shared/i18n';

export class BlockInsert {
  private cachedSource='';private cachedNodes:any[]=[];private openingSource='';
  private plus=document.createElement('button');private menu=document.createElement('div');private line=document.createElement('div');private at=0;private view?:EditorView;private frame=0;private closeTimer?:ReturnType<typeof setTimeout>;
  constructor(private getView:()=>EditorView|undefined,private enabled:()=>boolean,private table:(at:number)=>void){
    this.plus.className='block-insert-plus';this.plus.textContent='+';this.plus.setAttribute('aria-label',t('插入段落'));this.menu.className='block-insert-menu';this.line.className='block-insert-line';this.plus.hidden=this.menu.hidden=this.line.hidden=true;document.body.append(this.plus,this.line,this.menu);
    this.plus.onmousedown=e=>e.preventDefault();this.plus.onclick=()=>this.insert('');
    this.plus.oncontextmenu=e=>{e.preventDefault();this.menu.replaceChildren();for(const[label,run]of [[t('插入目录'),()=>this.insert(makeToc(this.view!.state.doc.toString()))],[t('插入表格'),()=>{const at=this.at;this.close();this.table(at);}]] as const){const b=document.createElement('button');b.textContent=label;b.onclick=run;this.menu.append(b);}this.menu.hidden=false;const r=this.plus.getBoundingClientRect();this.menu.style.left=Math.min(r.left,innerWidth-180)+'px';this.menu.style.top=Math.min(r.bottom,innerHeight-100)+'px';};
    this.menu.onmousedown=e=>e.preventDefault();
    document.addEventListener('pointermove',e=>{if(!this.menu.hidden){const near=[this.menu,this.plus].some(el=>{const r=el.getBoundingClientRect();return e.clientX>=r.left-40&&e.clientX<=r.right+40&&e.clientY>=r.top-40&&e.clientY<=r.bottom+40;});if(near){clearTimeout(this.closeTimer);this.closeTimer=undefined;}else if(!this.closeTimer)this.closeTimer=setTimeout(()=>this.close(),300);return;}cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.hover(e.clientX,e.clientY));});
    document.addEventListener('pointerdown',e=>{if(!this.menu.contains(e.target as Node)&&!this.plus.contains(e.target as Node))this.close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.close();});window.addEventListener('scroll',()=>this.close(),true);
    window.addEventListener('blur',()=>this.close());document.documentElement.addEventListener('pointerleave',()=>{clearTimeout(this.closeTimer);this.closeTimer=setTimeout(()=>this.close(),300);});
  }
  close(){clearTimeout(this.closeTimer);this.closeTimer=undefined;this.menu.hidden=this.plus.hidden=this.line.hidden=true;}
  private hover(x:number,y:number){
    const v=this.getView();if(!v||!this.enabled()||v.state.readOnly||v.composing){this.close();return;}
    const r=v.contentDOM.getBoundingClientRect();if(x<r.left-45||x>r.right||y<r.top-20||y>r.bottom+24){this.close();return;}
    const source=v.state.doc.toString();if(source!==this.cachedSource){this.cachedSource=source;const tocs=managedTocs(source);this.cachedNodes=[...authoringTree(source).children.filter((n:any)=>!tocs.some(t=>n.position.start.offset>=t.from&&n.position.end.offset<=t.to)),...tocs.map(t=>({type:'toc',position:{start:{offset:t.from},end:{offset:t.to}}}))].sort((a,b)=>a.position.start.offset-b.position.start.offset);}const nodes=this.cachedNodes;let best:{at:number;y:number}|undefined;
    const consider=(at:number,cy:number)=>{if(Math.abs(cy-y)<=14&&(!best||Math.abs(cy-y)<Math.abs(best.y-y)))best={at,y:cy};};
    const start=v.coordsAtPos(0);if(start&&nodes[0]?.type!=='yaml')consider(0,start.top-7);
    for(let i=0;i<nodes.length;i++){const n=nodes[i],end=n.position.end.offset,next=nodes[i+1]?.position.start.offset;const a=v.coordsAtPos(end),b=next===undefined?null:v.coordsAtPos(next);if(a)consider(end,b?(a.bottom+b.top)/2:a.bottom+8);}
    if(!best){this.close();return;}const target=best as {at:number;y:number};this.at=target.at;this.view=v;this.openingSource=source;this.plus.hidden=this.line.hidden=false;this.plus.style.left=Math.max(2,r.left-30)+'px';this.plus.style.top=target.y-12+'px';this.line.style.left=r.left+'px';this.line.style.top=target.y+'px';this.line.style.width=r.width+'px';
  }
  private insert(body:string){const v=this.view;if(!v||v!==this.getView()||v.state.readOnly||v.state.doc.toString()!==this.openingSource){this.close();return;}const edit=insertBlock(v.state.doc.toString(),this.at,body);this.close();v.dispatch({changes:{from:edit.from,to:edit.to,insert:edit.insert},selection:{anchor:edit.anchor},scrollIntoView:true,userEvent:'input'});v.focus();}
}

export function editToc(view:EditorView,from:number){
  const toc=managedTocs(view.state.doc.toString()).find(t=>from>=t.from&&from<=t.to);if(!toc)return;
  const dialog=document.createElement('dialog');dialog.className='insert-table-dialog';
  dialog.innerHTML=`<form method="dialog"><strong>${t('目录设置')}</strong><label>${t('起始级别')}<input name="min" type="number" min="1" max="6" value="${toc.options.min}" required></label><label>${t('结束级别')}<input name="max" type="number" min="1" max="6" value="${toc.options.max}" required></label><label>${t('自动更新目录')}<input name="auto" type="checkbox" ${toc.options.auto?'checked':''}></label><button value="cancel" formnovalidate>${t('取消')}</button><button value="delete" formnovalidate>${t('删除目录')}</button><button value="update">${t('更新目录')}</button></form>`;
  const original=view.state.doc.toString();document.body.append(dialog);dialog.onclose=()=>{if(view.state.doc.toString()===original&&!view.state.readOnly){if(dialog.returnValue==='delete')view.dispatch({changes:{from:toc.from,to:toc.to,insert:''},userEvent:'input'});if(dialog.returnValue==='update'){const options:TocOptions={min:Number(dialog.querySelector<HTMLInputElement>('[name=min]')!.value),max:Number(dialog.querySelector<HTMLInputElement>('[name=max]')!.value),auto:dialog.querySelector<HTMLInputElement>('[name=auto]')!.checked};if(options.min<=options.max)view.dispatch({changes:{from:toc.from,to:toc.to,insert:makeToc(original,options)},userEvent:'input'});}}dialog.remove();view.focus();};dialog.showModal();
}
export function updateTocs(view:EditorView,manual=false){if(view.composing||view.state.readOnly)return;const changes=tocUpdates(view.state.doc.toString(),manual);if(changes.length)view.dispatch({changes:changes.map(({from,to,insert})=>({from,to,insert})),userEvent:'input.toc'});}
