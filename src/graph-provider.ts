import * as vscode from 'vscode';
import {randomBytes} from 'node:crypto';
import {buildGraph,type GraphNote,type GraphData} from './shared/graph';
export class GraphProvider implements vscode.WebviewViewProvider,vscode.Disposable {
  private views=new Set<vscode.Webview>();private subscriptions:vscode.Disposable[]=[];
  private timer?:ReturnType<typeof setTimeout>;private revision=0;
  private data:GraphData={nodes:[],links:[]};private current?:string;
  constructor(private context:vscode.ExtensionContext){
    const watcher=vscode.workspace.createFileSystemWatcher('**/*.md');
    this.subscriptions.push(watcher,watcher.onDidCreate(()=>this.refresh()),watcher.onDidChange(()=>this.refresh()),watcher.onDidDelete(()=>this.refresh()),
      vscode.workspace.onDidChangeTextDocument(event=>{if(event.document.languageId==='markdown')this.refresh();}),
      vscode.workspace.onDidCloseTextDocument(()=>this.refresh()),
      vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration('noteWorkbench.graph'))this.refresh();}),
      vscode.window.onDidChangeActiveTextEditor(editor=>{if(editor?.document.languageId==='markdown')this.setActive(editor.document.uri);})
    );
  }
  setActive(uri:vscode.Uri){this.current=uri.toString();this.data.active=this.current;for(const view of this.views)void view.postMessage({type:'graph',...this.data});}
  resolveWebviewView(view:vscode.WebviewView){this.attach(view.webview,view.onDidDispose);}
  open(){const panel=vscode.window.createWebviewPanel('noteWorkbench.graphPanel','笔记连接图',vscode.ViewColumn.Beside,{enableScripts:true,retainContextWhenHidden:true});this.attach(panel.webview,panel.onDidDispose);}
  private attach(webview:vscode.Webview,onDispose:vscode.Event<void>){
    webview.options={enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(this.context.extensionUri,'dist')]};
    const asset=(name:string)=>webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri,'dist','webview',name)),nonce=randomBytes(16).toString('hex');
    webview.html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src ${webview.cspSource} 'unsafe-inline';script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${asset('graph.css')}"><body><div id="graph-app"></div><script nonce="${nonce}" src="${asset('graph.js')}"></script></body></html>`;
    this.views.add(webview);
    const messages=webview.onDidReceiveMessage(async message=>{
      if(message?.type==='ready'){await webview.postMessage({type:'layout',value:this.context.workspaceState.get('graph.layout',{})});this.refresh();}
      if(message?.type==='open'&&typeof message.id==='string'&&this.data.nodes.some(n=>n.id===message.id&&!n.missing))await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.parse(message.id),'noteWorkbench.editor');
      if(message?.type==='layout'&&message.value&&JSON.stringify(message.value).length<10000)await this.context.workspaceState.update('graph.layout',message.value);
      if(message?.type==='expand')this.open();
      if(message?.type==='refresh')this.refresh();
    });
    onDispose(()=>{messages.dispose();this.views.delete(webview);});this.refresh();
  }
  refresh(){clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.scan();},200);}
  private async scan(){
    const revision=++this.revision,config=vscode.workspace.getConfiguration('noteWorkbench.graph');
    try{
      const include=config.get<string[]>('include',[]),exclude=config.get<string[]>('exclude',['**/{node_modules,.git,.npm-cache}/**']);
      const files=new Map<string,vscode.Uri>();
      for(const pattern of include.length?include:['**/*.md'])for(const uri of await vscode.workspace.findFiles(pattern,exclude.length===1?exclude[0]:exclude.length?'{'+exclude.join(',')+'}':null))if(uri.path.endsWith('.md'))files.set(uri.toString(),uri);
      const notes:GraphNote[]=[];
      for(const [id,uri]of files){const open=vscode.workspace.textDocuments.find(doc=>doc.uri.toString()===id);const source=open?open.getText():Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');notes.push({id,source,name:uri.path.split('/').pop()!,path:vscode.workspace.asRelativePath(uri)});}
      if(revision!==this.revision)return;
      this.data=buildGraph(notes,this.current);for(const view of this.views)void view.postMessage({type:'graph',...this.data});
    }catch(error){for(const view of this.views)void view.postMessage({type:'error',message:String(error)});}
  }
  dispose(){clearTimeout(this.timer);this.revision++;this.subscriptions.forEach(s=>s.dispose());}
}
