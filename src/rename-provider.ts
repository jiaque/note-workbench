import * as vscode from 'vscode';
import {renameLinkEdits} from './shared/rename-links';
import {t} from './shared/i18n';
export function registerRenameLinks():vscode.Disposable {
  return vscode.workspace.onWillRenameFiles(event=>{
    // waitUntil must be called synchronously; edits are applied by VS Code with the rename.
    event.waitUntil((async()=>{
      const edit=new vscode.WorkspaceEdit();let ambiguous=0;
      try{
        const files=await vscode.workspace.findFiles('**/*.md','**/{node_modules,.git,.npm-cache}/**');
        const docs=await Promise.all(files.map(uri=>vscode.workspace.openTextDocument(uri)));
        const snapshots=docs.map(doc=>({doc,version:doc.version,note:{id:doc.uri.toString(),name:doc.uri.path.split('/').pop()!,path:vscode.workspace.asRelativePath(doc.uri,false),source:doc.getText()}}));
        for(const entry of snapshots){
          if(!vscode.workspace.getConfiguration('noteWorkbench',entry.doc.uri).get('notes.updateLinksOnRename',true))continue;
          const root=vscode.workspace.getWorkspaceFolder(entry.doc.uri)?.uri.toString();
          const notes=snapshots.filter(x=>vscode.workspace.getWorkspaceFolder(x.doc.uri)?.uri.toString()===root).map(x=>x.note);
          const result=renameLinkEdits(entry.note,notes,event.files.map(file=>({oldId:file.oldUri.toString(),newId:file.newUri.toString()})));ambiguous+=result.ambiguous;
          if(entry.doc.version!==entry.version)throw Error(t('笔记在重命名期间发生变化，请检查引用。'));
          for(const change of result.edits)edit.replace(entry.doc.uri,new vscode.Range(entry.doc.positionAt(change.from),entry.doc.positionAt(change.to)),change.insert);
        }
        if(ambiguous)void vscode.window.showWarningMessage(t('存在同名笔记，已跳过 {count} 处不明确的引用。',{count:ambiguous}));
        return edit;
      }catch(error){void vscode.window.showWarningMessage(t('更新笔记引用失败：')+String(error));return undefined;}
    })());
  });
}
