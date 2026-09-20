import * as vscode from 'vscode';
import {type NoteEntry, wikiCompletions} from './shared/note-links';

/** Cache file contents; ordinary edits reread only the changed note. */
export class NoteIndex implements vscode.Disposable {
  private cache=new Map<string,NoteEntry>();
  private dirty=new Set<string>();
  private membership=true;
  private timer?:ReturnType<typeof setTimeout>;
  private running?:Promise<void>;
  private disposed=false;
  private events=new vscode.EventEmitter<void>();
  readonly onDidChange=this.events.event;
  private subscriptions:vscode.Disposable[]=[];
  get notes(){return [...this.cache.values()];}
  constructor(){
    const watcher=vscode.workspace.createFileSystemWatcher('**/*.md');
    const changed=(uri:vscode.Uri,membership=false)=>{this.dirty.add(uri.toString());this.membership ||= membership;this.schedule();};
    this.subscriptions.push(watcher,watcher.onDidCreate(uri=>changed(uri,true)),watcher.onDidChange(uri=>changed(uri)),watcher.onDidDelete(uri=>{this.cache.delete(uri.toString());changed(uri,true);}),
      vscode.workspace.onDidChangeTextDocument(event=>{if(event.document.languageId==='markdown')changed(event.document.uri);}),
      vscode.workspace.onDidCloseTextDocument(doc=>{if(doc.languageId==='markdown')changed(doc.uri);}),
      vscode.workspace.onDidChangeWorkspaceFolders(()=>this.refresh()),
      vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration('noteWorkbench.graph'))this.refresh();}));
  }
  private schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>void this.ensure(),200);}
  refresh(){this.membership=true;for(const id of this.cache.keys())this.dirty.add(id);this.schedule();}
  async ensure():Promise<void>{
    if(this.running){await this.running;return;}
    if(this.disposed||!this.membership&&!this.dirty.size)return;
    this.running=this.scan().finally(()=>{this.running=undefined;});await this.running;
  }
  private async scan(){
    const membership=this.membership;this.membership=false;
    const pending=new Set(this.dirty);this.dirty.clear();
    try{
      await vscode.window.withProgress({location:vscode.ProgressLocation.Window,title:'Note Workbench：索引笔记',cancellable:true},async(progress,token)=>{
        let ids=new Set(this.cache.keys());
        if(membership){
          ids=new Set();const config=vscode.workspace.getConfiguration('noteWorkbench.graph'),include=config.get<string[]>('include',[]),exclude=config.get<string[]>('exclude',[]);
          for(const pattern of include.length?include:['**/*.md'])for(const uri of await vscode.workspace.findFiles(pattern,exclude.length===1?exclude[0]:exclude.length?'{'+exclude.join(',')+'}':undefined,undefined,token))if(/\.md$/i.test(uri.path))ids.add(uri.toString());
          if(token.isCancellationRequested){this.membership=true;return;}
          for(const id of this.cache.keys())if(!ids.has(id))this.cache.delete(id);
          for(const id of ids)if(!this.cache.has(id))pending.add(id);
        }
        let count=0;
        for(const id of pending){
          if(this.disposed)return;
          if(token.isCancellationRequested){this.dirty.add(id);continue;}
          if(!ids.has(id))continue;
          const uri=vscode.Uri.parse(id);
          try{
            const open=vscode.workspace.textDocuments.find(doc=>doc.uri.toString()===id);
            const source=open?open.getText():Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
            this.cache.set(id,{id,source,name:uri.path.split('/').pop()!,path:vscode.workspace.asRelativePath(uri,false)});
          }catch{this.cache.delete(id);}
          progress.report({message:`${++count} / ${pending.size}`});
        }
      });
      if(!this.disposed)this.events.fire();
    }catch(error){this.membership ||= membership;for(const id of pending)this.dirty.add(id);void vscode.window.showWarningMessage('笔记索引未完成：'+String(error));}
  }
  async completions(origin:vscode.Uri,query:string){await this.ensure();const folder=vscode.workspace.getWorkspaceFolder(origin);const notes=this.notes.filter(note=>!folder||vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(note.id))?.uri.toString()===folder.uri.toString());return wikiCompletions(notes,origin.toString(),query);}
  dispose(){this.disposed=true;clearTimeout(this.timer);this.events.dispose();this.subscriptions.forEach(item=>item.dispose());}
}
