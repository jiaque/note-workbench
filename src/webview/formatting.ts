import {t} from '../shared/i18n';
import {EditorView,keymap} from '@codemirror/view';

export type Format='bold'|'italic'|'strike'|'code'|'link'|'quote'|'bullet'|'task'|'heading';
export const formats:[Format,string][]=[['bold',t("加粗")],['italic',t("斜体")],['strike',t("删除线")],['code',t("行内代码")],['link',t("链接")],['heading',t("二级标题")],['quote',t("引用")],['bullet',t("无序列表")],['task',t("任务列表")]];
export function format(view:EditorView,kind:Format):boolean{
  if(view.state.readOnly||view.composing)return false;
  const selection=view.state.selection.main,source=view.state.doc,selected=source.sliceString(selection.from,selection.to);
  const marks:Partial<Record<Format,string>>={bold:'**',italic:'*',strike:'~~',code:'`'};
  const mark=marks[kind];
  if(mark){
    const wrapped=selected.startsWith(mark)&&selected.endsWith(mark)&&selected.length>=mark.length*2;
    const insert=wrapped?selected.slice(mark.length,-mark.length):mark+selected+mark;
    view.dispatch({changes:{from:selection.from,to:selection.to,insert},selection:{anchor:selection.from+(wrapped?0:mark.length),head:selection.from+insert.length-(wrapped?0:mark.length)},userEvent:'input'});
  }else if(kind==='link'){
    const insert='['+(selected||t("链接文字"))+'](https://)';const from=selection.from+insert.indexOf('https://');
    view.dispatch({changes:{from:selection.from,to:selection.to,insert},selection:{anchor:from,head:from+8},userEvent:'input'});
  }else{
    const from=source.lineAt(selection.from).from,to=source.lineAt(selection.to).to,prefix={quote:'> ',bullet:'- ',task:'- [ ] ',heading:'## '}[kind as 'quote'|'bullet'|'task'|'heading'];
    const lines=source.sliceString(from,to).split('\n'),remove=lines.every(line=>line.startsWith(prefix));
    const insert=lines.map(line=>remove?line.slice(prefix.length):prefix+line).join('\n');
    view.dispatch({changes:{from,to,insert},selection:{anchor:from,head:from+insert.length},userEvent:'input'});
  }
  view.focus();return true;
}
export const formattingKeys=keymap.of([
  {key:'Mod-b',run:(view:EditorView)=>format(view,'bold')},
  {key:'Mod-i',run:(view:EditorView)=>format(view,'italic')},
  {key:'Mod-k',run:(view:EditorView)=>format(view,'link')},
  {key:'Mod-Shift-x',run:(view:EditorView)=>format(view,'strike')},
].map(binding=>({...binding,stopPropagation:true})));
