import {StateEffect,StateField} from '@codemirror/state';
import {Decoration,EditorView} from '@codemirror/view';
import {findText,type TextMatch} from '../shared/find';
import {previewFocus} from './live-preview';
import {t} from '../shared/i18n';

const marks=StateEffect.define<(TextMatch&{current?:boolean})[]>();
export const findDecorations=StateField.define({
  create:()=>Decoration.none,
  update(value,tr){value=value.map(tr.changes);for(const effect of tr.effects)if(effect.is(marks))value=Decoration.set(effect.value.map(hit=>Decoration.mark({class:hit.current?'note-find-match note-find-active':'note-find-match'}).range(hit.from,hit.to)));return value;},
  provide:field=>EditorView.decorations.from(field),
});

/** One persistent panel, independent of editor recreation and document saving. */
export class NoteFind {
  readonly panel=document.createElement('section');
  private input=document.createElement('input');
  private count=document.createElement('span');
  private caseButton=document.createElement('button');
  private matchCase=false;
  private hits:TextMatch[]=[];
  private ranges:Range[]=[];
  private index=0;
  private frame=0;
  private previousFocus:HTMLElement|null=null;
  private decoratedEditor:EditorView|undefined;
  private decoratedDoc:unknown;
  private signature='';
  constructor(private content:HTMLElement,private getEditor:()=>EditorView|undefined,private beforeOpen:()=>void){
    this.panel.className='note-find';this.panel.hidden=true;this.panel.setAttribute('role','search');this.panel.setAttribute('aria-label',t('文章内查找'));
    this.input.type='text';this.input.placeholder=t('在文章中查找');this.input.setAttribute('aria-label',t('在文章中查找'));this.input.spellcheck=false;
    this.count.setAttribute('role','status');this.count.setAttribute('aria-live','polite');
    const button=(label:string,text:string,action:()=>void)=>{const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.textContent=text;b.onclick=action;return b;};
    this.caseButton=button(t('区分大小写'),'Aa',()=>{this.matchCase=!this.matchCase;this.caseButton.setAttribute('aria-pressed',String(this.matchCase));this.refresh(true);});this.caseButton.setAttribute('aria-pressed','false');
    this.panel.append(this.input,this.caseButton,this.count,button(t('上一个结果'),'↑',()=>this.step(-1)),button(t('下一个结果'),'↓',()=>this.step(1)),button(t('关闭查找'),'×',()=>this.close()));
    document.body.append(this.panel);
    this.input.addEventListener('input',event=>{if(!(event as InputEvent).isComposing)this.refresh(true);});
    this.input.addEventListener('compositionend',()=>this.refresh(true));
    this.panel.addEventListener('keydown',event=>{if(event.isComposing)return;if(event.key==='Enter'){event.preventDefault();this.step(event.shiftKey?-1:1);}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.close();}});
    document.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      // Undo in the search input belongs to the input, never the note's host undo stack.
      if(this.panel.contains(event.target as Node)&&(event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.stopImmediatePropagation();return;}
      if((event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='f'){event.preventDefault();event.stopImmediatePropagation();this.open();}
      else if(!this.panel.hidden&&event.key==='F3'){event.preventDefault();event.stopImmediatePropagation();this.step(event.shiftKey?-1:1);}
      else if(!this.panel.hidden&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.close();}
    },true);
    new MutationObserver(()=>this.changed()).observe(content,{childList:true,subtree:true,characterData:true});
  }
  open(){if(this.panel.hidden)this.previousFocus=document.activeElement as HTMLElement;this.beforeOpen();this.panel.hidden=false;this.input.focus();this.input.select();this.refresh();}
  close(){this.panel.hidden=true;const editor=this.getEditor();this.decoratedEditor=undefined;if(editor)editor.dispatch({effects:marks.of([])});this.clearHighlights();if(this.previousFocus?.isConnected)this.previousFocus.focus();else editor?.focus();}
  changed(){if(this.panel.hidden||this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.refresh(false,false);});}
  refresh(reset=false,navigate=true){
    if(this.panel.hidden)return;
    const editor=this.getEditor();
    this.ranges=this.domRanges(this.content);
    this.hits=editor?findText(editor.state.doc.toString(),this.input.value,this.matchCase):this.ranges.map((_,i)=>({from:i,to:i+1}));
    this.index=reset?0:Math.min(this.index,Math.max(0,this.hits.length-1));
    // Avoid a decoration/MutationObserver feedback loop.
    const signature=JSON.stringify([this.input.value,this.matchCase,this.index]);
    if(editor&&(this.decoratedEditor!==editor||this.decoratedDoc!==editor.state.doc||this.signature!==signature)){this.decoratedEditor=editor;this.decoratedDoc=editor.state.doc;this.signature=signature;editor.dispatch({effects:marks.of(this.hits.map((hit,index)=>({...hit,current:index===this.index})))});}
    this.count.textContent=this.input.value?(this.hits.length?`${this.index+1} / ${this.hits.length}`:t('无结果')):'';
    this.paint(editor?this.tableRange():this.ranges[this.index]);if(navigate)this.reveal();
  }
  private step(delta:number){this.refresh(false,false);if(!this.hits.length)return;this.index=(this.index+delta+this.hits.length)%this.hits.length;this.refresh(false,false);this.reveal();}
  private reveal(){
    const hit=this.hits[this.index];if(!hit)return;
    const editor=this.getEditor();
    if(editor){editor.dispatch({selection:{anchor:hit.from,head:hit.to},effects:[previewFocus.of(true),EditorView.scrollIntoView(hit.from,{y:'center'})]});requestAnimationFrame(()=>{if(this.panel.hidden)return;const range=this.tableRange();if(range){range.startContainer.parentElement?.scrollIntoView({block:'center'});this.paint(range);}this.changed();});}
    else {
      const range=this.ranges[this.index];let element=range.startContainer.parentElement;
      for(let parent=element;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
      element?.scrollIntoView({block:'center'});this.paint(range);
    }
  }
  private tableRange(){
    const editor=this.getEditor(),hit=this.hits[this.index];if(!editor||!hit)return;
    const cell=[...this.content.querySelectorAll<HTMLElement>('[data-find-from]')].find(node=>Number(node.dataset.findFrom)<=hit.from&&Number(node.dataset.findTo)>=hit.to);
    if(!cell)return;
    const ordinal=findText(editor.state.doc.sliceString(Number(cell.dataset.findFrom),hit.from),this.input.value,this.matchCase).length;
    return this.domRanges(cell)[ordinal];
  }
  private domRanges(root:HTMLElement){
    const result:Range[]=[];
    // Group by text block so inline emphasis is searchable without joining unrelated paragraphs.
    const groups=new Map<Element,Text[]>();
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      const parent=node.parentElement!;
      if(parent.closest('button,script,style,textarea,input,.table-menu,.cell-editor,.cm-line,[aria-hidden="true"],.hide-properties .properties'))continue;
      const group=parent.closest('p,li,td,th,h1,h2,h3,h4,h5,h6,pre,summary')??parent;
      const texts=groups.get(group)??[];texts.push(node as Text);groups.set(group,texts);
    }
    for(const texts of groups.values()){
      const text=texts.map(node=>node.data).join('');
      for(const hit of findText(text,this.input.value,this.matchCase)){
        let offset=0;const range=document.createRange();
        for(const node of texts){const end=offset+node.length;if(hit.from>=offset&&hit.from<end)range.setStart(node,hit.from-offset);if(hit.to>offset&&hit.to<=end){range.setEnd(node,hit.to-offset);break;}offset=end;}result.push(range);
      }
    }
    return result;
  }
  private clearHighlights(){const css=CSS as any;css.highlights?.delete('note-find');css.highlights?.delete('note-find-current');}
  private paint(current?:Range){
    const Highlight=(window as any).Highlight,css=CSS as any;if(!Highlight||!css.highlights)return;
    css.highlights.set('note-find',new Highlight(...this.ranges));css.highlights.set('note-find-current',new Highlight(...(current?[current]:[])));
  }
}
