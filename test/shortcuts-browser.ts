import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {formattingKeys} from '../src/webview/formatting';
import {handleNoteShortcut,isolateEditorShortcuts} from '../src/webview/shortcuts';
const content=document.querySelector('main')!,result=document.querySelector('output')!;
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
isolateEditorShortcuts(content);
let forwarded=0,commands:string[]=[];
// Same propagation surface used by VS Code's webview preloader.
window.addEventListener('keydown',()=>forwarded++);
document.addEventListener('keydown',event=>handleNoteShortcut(event,action=>commands.push(action)),true);
const press=(target:HTMLElement,key:string,extra:KeyboardEventInit={})=>{
  const event=new KeyboardEvent('keydown',{key,code:'Key'+key.toUpperCase(),keyCode:key.toUpperCase().charCodeAt(0),ctrlKey:true,bubbles:true,cancelable:true,...extra});target.dispatchEvent(event);return event;
};
try {
  for(const cell of [false,true]){
    const parent=document.createElement('div');if(cell)parent.className='cell-editor';content.append(parent);
    for(const [key,shift,expected] of [['b',false,'**text**'],['i',false,'*text*'],['k',false,'[text](https://)'],['X',true,'~~text~~']] as const){
      const view=new EditorView({parent,state:EditorState.create({doc:'text',selection:{anchor:0,head:4},extensions:[formattingKeys]})});view.focus();
      const before=forwarded,event=press(view.contentDOM,key,{shiftKey:shift});
      check(view.state.doc.toString()===expected,`${cell?'cell':'note'} ${key} formats once`);
      check(event.defaultPrevented&&forwarded===before,`${key} must not reach host`);
      if(key!=='k'){press(view.contentDOM,key,{shiftKey:shift});check(view.state.doc.toString()==='text',`${key} toggles off without duplicating markers`);check(forwarded===before,'toggle must not reach host');}
      view.destroy();
    }
    parent.remove();
  }
  const input=document.createElement('input');document.body.append(input);let before=forwarded;press(input,'b');check(forwarded===before+1,'outside editor Ctrl+B reaches host');
  const plain=document.createElement('div');content.append(plain);before=forwarded;press(plain,'p',{shiftKey:true});check(forwarded===before+1,'unhandled palette shortcut reaches host');
  for(const [key,extra,expected] of [['s',{},'save'],['z',{},'undo'],['z',{shiftKey:true},'redo'],['e',{},'toggleView']] as const){before=forwarded;const count=commands.length;press(plain,key,extra);check(forwarded===before&&commands.length===count+1&&commands.at(-1)===expected,`${expected} runs only once`);}
  before=forwarded;press(plain,'s',{shiftKey:true});check(forwarded===before+1,'Save As remains a host shortcut');
  plain.addEventListener('keydown',event=>event.preventDefault());before=forwarded;press(plain,'a');check(forwarded===before,'other handled editor keys do not leak');
  result.textContent='PASS: bold/italic/link/strike run once in note and cell; handled keys never reach the host; outside and unhandled shortcuts still reach host; save/undo/redo/view are isolated.';
}catch(error){result.textContent='FAIL: '+String(error);console.error(error);}
