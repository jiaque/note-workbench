/** VS Code forwards bubbling webview keydowns even when defaultPrevented. */
export function isolateEditorShortcuts(content:HTMLElement){
  content.addEventListener('keydown',event=>{
    // Let unhandled shortcuts continue to the host (sidebar, command palette, etc.).
    if(event.defaultPrevented)event.stopPropagation();
  });
}

export type NoteShortcut='save'|'undo'|'redo'|'toggleView';
export function noteShortcut(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'|'isComposing'>):NoteShortcut|undefined {
  if(event.isComposing||event.altKey||(!event.ctrlKey&&!event.metaKey))return;
  const key=event.key.toLowerCase();
  if(key==='z')return event.shiftKey?'redo':'undo';
  if(event.shiftKey)return;
  if(key==='y')return 'redo';
  if(key==='s')return 'save';
  if(key==='e')return 'toggleView';
}

export function handleNoteShortcut(event:KeyboardEvent,run:(action:NoteShortcut)=>void){
  const action=noteShortcut(event);if(!action)return;
  event.preventDefault();event.stopImmediatePropagation();run(action);
}
