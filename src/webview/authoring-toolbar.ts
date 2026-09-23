import {EditorView,ViewPlugin} from '@codemirror/view';
import {format,type Format} from './formatting';
import {t} from '../shared/i18n';
import {pastedLink,authoringTree} from '../shared/authoring';

export let toolbarEnabled=true;
export function setToolbarEnabled(value:boolean){toolbarEnabled=value;if(!value)document.querySelectorAll<HTMLElement>('.format-toolbar').forEach(el=>el.hidden=true);}
export class FormatToolbar {
  readonly dom=document.createElement('div');
  private view?:EditorView;
  private buttons=new Map<Format,HTMLButtonElement>();
  constructor(inline=false){
    this.dom.className='format-toolbar';this.dom.setAttribute('role','toolbar');this.dom.setAttribute('aria-label',t('快捷格式'));
    this.dom.addEventListener('mousedown',e=>{if(!(e.target instanceof HTMLSelectElement))e.preventDefault();});
    const action=(kind:Format,label:string,title:string)=>{const b=document.createElement('button');b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onclick=()=>{if(this.view)format(this.view,kind);};this.buttons.set(kind,b);this.dom.append(b);};
    if(!inline){const select=document.createElement('select');select.setAttribute('aria-label',t('段落样式'));for(let i=0;i<=6;i++){const o=document.createElement('option');o.value=String(i);o.textContent=i?'H'+i:t('正文');select.append(o);}select.onchange=()=>{const v=this.view;if(!v||v.state.readOnly)return;const s=v.state.selection.main,a=v.state.doc.lineAt(s.from).from,b=v.state.doc.lineAt(s.to).to;const prefix=Number(select.value)?'#'.repeat(Number(select.value))+' ':'';const insert=v.state.sliceDoc(a,b).split('\n').map(l=>prefix+l.replace(/^#{1,6}\s+/, '')).join('\n');v.dispatch({changes:{from:a,to:b,insert},selection:{anchor:a,head:a+insert.length},userEvent:'input'});v.focus();};this.dom.append(select);}
    action('bold','B',t('加粗'));action('italic','I',t('斜体'));action('strike','S̶',t('删除线'));action('code','</>',t('行内代码'));action('link','↗',t('链接'));action('highlight','▧',t('高亮'));
    if(!inline){action('quote','❞',t('引用'));const list=document.createElement('select');list.setAttribute('aria-label',t('列表'));list.innerHTML=`<option value="">${t('列表')}</option><option value="bullet">${t('无序列表')}</option><option value="ordered">${t('有序列表')}</option><option value="task">${t('任务列表')}</option>`;list.onchange=()=>{if(this.view&&list.value)format(this.view,list.value as Format);list.value='';};this.dom.append(list);}
  }
  update(view:EditorView){
    this.view=view;this.dom.hidden=!toolbarEnabled||view.state.readOnly;const s=view.state.selection.main,source=view.state.doc.toString(),active=new Set<Format>();
    const visit=(n:any)=>{if(n.position&&n.position.start.offset<=s.from&&n.position.end.offset>=s.to){const kind=({strong:'bold',emphasis:'italic',delete:'strike',inlineCode:'code',link:'link',blockquote:'quote'} as Record<string,Format>)[n.type];if(kind)active.add(kind);if(n.type==='obsidianInline'&&n.value.startsWith('=='))active.add('highlight');for(const child of n.children??[])visit(child);}};visit(authoringTree(source));
    for(const[k,b]of this.buttons)b.setAttribute('aria-pressed',String(active.has(k)));
    const heading=this.dom.querySelector<HTMLSelectElement>('select[aria-label="'+t('段落样式')+'"]');if(heading)heading.value=String(/^ *(#{1,6})\s/.exec(view.state.doc.lineAt(s.head).text)?.[1].length??0);
  }
}
export const pasteLinks=EditorView.domEventHandlers({paste(event,view){const s=view.state.selection.main;if(view.state.readOnly||view.composing)return false;const insert=pastedLink(view.state.doc.toString(),s.from,s.to,event.clipboardData?.getData('text/plain').trim()??'');if(!insert)return false;event.preventDefault();view.dispatch({changes:{from:s.from,to:s.to,insert},selection:{anchor:s.from+1,head:s.from+1+view.state.sliceDoc(s.from,s.to).length},userEvent:'input.paste'});return true;}});
export const selectionToolbar=ViewPlugin.fromClass(class {
  bar:FormatToolbar;frame=0;onScroll=()=>this.update();
  constructor(readonly view:EditorView){this.bar=new FormatToolbar(!!view.dom.closest('.cell-editor'));document.body.append(this.bar.dom);this.bar.dom.classList.add('selection-toolbar');this.bar.dom.hidden=true;window.addEventListener('scroll',this.onScroll,true);}
  update(){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>{const v=this.view,s=v.state.selection.main;const preview=document.querySelector<HTMLElement>('.block-preview');if(!v.hasFocus||s.empty||!toolbarEnabled||(!v.dom.closest('.cell-editor')&&preview&&!preview.hidden)){this.bar.dom.hidden=true;return;}this.bar.update(v);const rect=v.coordsAtPos(s.head);if(rect){this.bar.dom.style.left=Math.max(8,Math.min(rect.left,innerWidth-this.bar.dom.offsetWidth-8))+'px';this.bar.dom.style.top=Math.max(8,rect.top-this.bar.dom.offsetHeight-8)+'px';}});}
  destroy(){cancelAnimationFrame(this.frame);window.removeEventListener('scroll',this.onScroll,true);this.bar.dom.remove();}
});
