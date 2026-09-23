import {EditorView,ViewPlugin} from '@codemirror/view';
import {format,type Format} from './formatting';
import {t} from '../shared/i18n';
import {pastedLink,authoringTree} from '../shared/authoring';
import {createElement,Link} from 'lucide';

export let toolbarEnabled=true;
export function setToolbarEnabled(value:boolean){toolbarEnabled=value;if(!value)document.querySelectorAll<HTMLElement>('.format-toolbar').forEach(el=>el.hidden=true);}
export class FormatToolbar {
  readonly dom=document.createElement('div');
  private view?:EditorView;
  private buttons=new Map<Format,HTMLButtonElement>();
  private heading?:HTMLButtonElement;
  private menus:{trigger:HTMLButtonElement;panel:HTMLDivElement}[]=[];
  private closeMenus=()=>{for(const {trigger,panel}of this.menus){panel.hidden=true;trigger.setAttribute('aria-expanded','false');}};
  private outside=(event:PointerEvent)=>{if(!this.dom.contains(event.target as Node))this.closeMenus();};
  private escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&this.menus.some(m=>!m.panel.hidden)){event.preventDefault();event.stopImmediatePropagation();this.closeMenus();this.view?.focus();}};
  private dropdown(label:string,items:{label:string;run:()=>void}[]){
    const trigger=document.createElement('button');trigger.type='button';trigger.textContent=label;trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');trigger.className='format-dropdown';
    const panel=document.createElement('div');panel.className='format-dropdown-panel';panel.setAttribute('role','menu');panel.hidden=true;
    for(const item of items){const button=document.createElement('button');button.type='button';button.textContent=item.label;button.setAttribute('role','menuitem');button.onclick=()=>{this.closeMenus();item.run();};panel.append(button);}
    trigger.onclick=()=>{const open=panel.hidden;this.closeMenus();if(open){panel.hidden=false;trigger.setAttribute('aria-expanded','true');const rect=trigger.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(rect.left,innerWidth-panel.offsetWidth-8))+'px';panel.style.top=(rect.bottom+panel.offsetHeight+6<innerHeight?rect.bottom+4:Math.max(8,rect.top-panel.offsetHeight-4))+'px';}};
    this.menus.push({trigger,panel});this.dom.append(trigger,panel);return trigger;
  }
  destroy(){document.removeEventListener('pointerdown',this.outside);document.removeEventListener('keydown',this.escape,true);window.removeEventListener('scroll',this.closeMenus,true);this.dom.remove();}
  constructor(inline=false){
    this.dom.className='format-toolbar';this.dom.setAttribute('role','toolbar');this.dom.setAttribute('aria-label',t('快捷格式'));
    this.dom.addEventListener('mousedown',e=>e.preventDefault());
    document.addEventListener('pointerdown',this.outside);document.addEventListener('keydown',this.escape,true);window.addEventListener('scroll',this.closeMenus,true);
    const action=(kind:Format,label:string,title:string)=>{const b=document.createElement('button');b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onclick=()=>{if(this.view)format(this.view,kind);};this.buttons.set(kind,b);this.dom.append(b);};
    if(!inline){this.heading=this.dropdown(t('段落样式'),Array.from({length:7},(_,level)=>({label:level?'H'+level:t('正文'),run:()=>{const v=this.view;if(!v||v.state.readOnly||v.composing)return;const s=v.state.selection.main,a=v.state.doc.lineAt(s.from).from,b=v.state.doc.lineAt(s.to).to,prefix=level?'#'.repeat(level)+' ':'';const insert=v.state.sliceDoc(a,b).split('\n').map(l=>prefix+l.replace(/^#{1,6}\s+/,'')).join('\n');v.dispatch({changes:{from:a,to:b,insert},selection:{anchor:a,head:a+insert.length},userEvent:'input'});v.focus();}})));this.heading.textContent=t('正文');}
    action('bold','B',t('加粗'));action('italic','I',t('斜体'));action('strike','S̶',t('删除线'));action('code','</>',t('行内代码'));action('link','',t('链接'));action('highlight','',t('高亮'));
    this.buttons.get('link')!.append(createElement(Link,{width:18,height:18,'stroke-width':1.8,'aria-hidden':'true'}));
    const highlighter=document.createElement('span');highlighter.textContent='A';highlighter.className='format-highlight-icon';highlighter.setAttribute('aria-hidden','true');this.buttons.get('highlight')!.append(highlighter);
    if(!inline){action('quote','❞',t('引用'));this.dropdown(t('列表'),(['bullet','ordered','task'] as const).map((kind,i)=>({label:[t('无序列表'),t('有序列表'),t('任务列表')][i],run:()=>{if(this.view)format(this.view,kind);}})));}
  }
  update(view:EditorView){
    this.view=view;this.dom.hidden=!toolbarEnabled||view.state.readOnly;const s=view.state.selection.main,source=view.state.doc.toString(),active=new Set<Format>();
    const visit=(n:any)=>{if(n.position&&n.position.start.offset<=s.from&&n.position.end.offset>=s.to){const kind=({strong:'bold',emphasis:'italic',delete:'strike',inlineCode:'code',link:'link',blockquote:'quote'} as Record<string,Format>)[n.type];if(kind)active.add(kind);if(n.type==='obsidianInline'&&n.value.startsWith('=='))active.add('highlight');for(const child of n.children??[])visit(child);}};visit(authoringTree(source));
    for(const[k,b]of this.buttons)b.setAttribute('aria-pressed',String(active.has(k)));
    const level=/^ *(#{1,6})\s/.exec(view.state.doc.lineAt(s.head).text)?.[1].length??0;if(this.heading)this.heading.textContent=level?'H'+level:t('正文');
  }
}
export const pasteLinks=EditorView.domEventHandlers({paste(event,view){const s=view.state.selection.main;if(view.state.readOnly||view.composing)return false;const insert=pastedLink(view.state.doc.toString(),s.from,s.to,event.clipboardData?.getData('text/plain').trim()??'');if(!insert)return false;event.preventDefault();view.dispatch({changes:{from:s.from,to:s.to,insert},selection:{anchor:s.from+1,head:s.from+1+view.state.sliceDoc(s.from,s.to).length},userEvent:'input.paste'});return true;}});
export const selectionToolbar=ViewPlugin.fromClass(class {
  bar:FormatToolbar;frame=0;onScroll=()=>this.update();
  constructor(readonly view:EditorView){this.bar=new FormatToolbar(!!view.dom.closest('.cell-editor'));document.body.append(this.bar.dom);this.bar.dom.classList.add('selection-toolbar');this.bar.dom.hidden=true;window.addEventListener('scroll',this.onScroll,true);}
  update(){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>{const v=this.view,s=v.state.selection.main;const preview=document.querySelector<HTMLElement>('.block-preview');if(!v.hasFocus||s.empty||!toolbarEnabled||(!v.dom.closest('.cell-editor')&&preview&&!preview.hidden)){this.bar.dom.hidden=true;return;}this.bar.update(v);const rect=v.coordsAtPos(s.head);if(rect){this.bar.dom.style.left=Math.max(8,Math.min(rect.left,innerWidth-this.bar.dom.offsetWidth-8))+'px';this.bar.dom.style.top=Math.max(8,rect.top-this.bar.dom.offsetHeight-8)+'px';}});}
  destroy(){cancelAnimationFrame(this.frame);window.removeEventListener('scroll',this.onScroll,true);this.bar.destroy();}
});
