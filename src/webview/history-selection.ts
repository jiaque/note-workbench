import {EditorState,StateField,Transaction,type EditorSelection,type Text} from '@codemirror/state';

// VS Code owns undo. Its snapshot is a text patch, which otherwise collapses
// a selection when that patch replaces the whole formatted phrase.
const selections=StateField.define<readonly {doc:Text;selection:EditorSelection}[]>({
  create:()=>[],
  update(value,tr){
    if(!tr.docChanged||tr.annotation(Transaction.remote))return value;
    return [...value,{doc:tr.startState.doc,selection:tr.startState.selection},{doc:tr.newDoc,selection:tr.newSelection}].slice(-80);
  },
});
export const historySelection=[selections,EditorState.transactionFilter.of(tr=>{
  if(tr.docChanged&&tr.annotation(Transaction.remote)){
    const known=[...tr.startState.field(selections)].reverse().find(entry=>entry.doc.eq(tr.newDoc));
    if(known)return [tr,{selection:known.selection,sequential:true}];
  }
  return tr;
})];
