import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {livePreview, previewFocus, renderedBlocks} from '../src/webview/live-preview';
import '../src/webview/editor.css';
import '../src/webview/document.css';
import '../src/webview/live-preview.css';

// Real browser geometry is essential: state-only tests cannot detect lost margins.
const result=document.querySelector('output')!;
const {source,blocks}=await (await fetch('/fixture')).json();
const view=new EditorView({parent:document.querySelector('main')!,state:EditorState.create({
  doc:source,extensions:[EditorView.lineWrapping,livePreview(block=>{
    const element=document.createElement('div');
    element.className=block.kind==='table'?'table-card':'note-block live-block';
    element.innerHTML=`<div class="rendered">${block.html}</div>`;
    return element;
  })],
})});
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const check=(condition:boolean,message:string)=>{if(!condition)throw Error(message);};
try {
  const start=source.indexOf('> [!note]'), second=source.indexOf('> 这里');
  view.dispatch({selection:{anchor:second+5},effects:[renderedBlocks.of(blocks),previewFocus.of(true)]});
  view.focus();
  await frame();await frame();
  for(let repeat=0;repeat<3;repeat++) {
    for(const position of [start+5,second+5]) {
      const rect=view.coordsAtPos(position)!;
      const hit=view.posAtCoords({x:rect.left,y:(rect.top+rect.bottom)/2})!;
      check(Math.abs(hit-position)<=1,`Mouse hit test: expected ${position}, got ${hit}`);
    }
    const before=view.state.selection.main;
    const up=view.moveVertically(before,false);
    check(up.head>=start&&up.head<second,'ArrowUp left the active callout');
    view.dispatch({selection:up});
    const down=view.moveVertically(view.state.selection.main,true);
    check(down.head>=second&&down.head<=view.state.doc.lineAt(second).to,'ArrowDown left the active callout');
    view.dispatch({selection:down});
    // Re-render acknowledgement must not break subsequent caret movement.
    view.dispatch({effects:renderedBlocks.of(blocks)});
  }
  check(view.state.doc.toString()===source,'Caret movement changed the document');
  result.textContent='PASS: mouse positions, repeated Up/Down, render acknowledgements, unchanged source';
} catch(error) {result.textContent='FAIL: '+String(error);console.error(error);}
