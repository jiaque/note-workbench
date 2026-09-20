import {getLanguage} from './shared/i18n';
import {t} from './shared/i18n';
import * as vscode from 'vscode';
import {randomBytes} from 'node:crypto';
import {buildGraph,type GraphData} from './shared/graph';
import {NoteIndex} from './note-index';
export class GraphProvider implements vscode.WebviewViewProvider,vscode.Disposable {
  private views=new Set<vscode.Webview>();private subscriptions:vscode.Disposable[]=[];
  private timer?:ReturnType<typeof setTimeout>;private revision=0;
  private data:GraphData={nodes:[],links:[]};private current?:string;
  navigate?:(id:string,offset?:number)=>Promise<void>;
  createMissing?:(origin:string,target:string)=>Promise<void>;
  constructor(private context:vscode.ExtensionContext,private index:NoteIndex){
    this.subscriptions.push(index.onDidChange(()=>this.publish()),
      vscode.window.onDidChangeActiveTextEditor(editor=>{if(editor?.document.languageId==='markdown')this.setActive(editor.document.uri);})
    );
  }
  setActive(uri:vscode.Uri){this.current=uri.toString();this.data.active=this.current;for(const view of this.views)void view.postMessage({type:'graph',...this.data});}
  resolveWebviewView(view:vscode.WebviewView){this.attach(view.webview,view.onDidDispose);}
  open(){const panel=vscode.window.createWebviewPanel('noteWorkbench.graphPanel',t("笔记连接图"),vscode.ViewColumn.Beside,{enableScripts:true,retainContextWhenHidden:true});this.attach(panel.webview,panel.onDidDispose);}
  private attach(webview:vscode.Webview,onDispose:vscode.Event<void>){
    webview.options={enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(this.context.extensionUri,'dist')]};
    const asset=(name:string)=>webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri,'dist','webview',name)),nonce=randomBytes(16).toString('hex');
    webview.html=`<!doctype html><html lang="${getLanguage()}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src ${webview.cspSource} 'unsafe-inline';script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${asset('graph.css')}"><body><div id="graph-app"></div><script nonce="${nonce}" src="${asset('graph.js')}"></script></body></html>`;
    this.views.add(webview);
    const messages=webview.onDidReceiveMessage(async message=>{
      if(message?.type==='ready'){await webview.postMessage({type:'layout',value:this.context.workspaceState.get('graph.layout',{})});this.refresh();}
      if(message?.type==='open'&&typeof message.id==='string'&&this.data.nodes.some(n=>n.id===message.id&&!n.missing)){
        const offset=Number.isInteger(message.offset)&&this.data.links.some(link=>link.source===message.id&&link.occurrences?.some(item=>item.offset===message.offset))?message.offset:undefined;
        if(this.navigate)await this.navigate(message.id,offset);
      }
      if(message?.type==='open'&&typeof message.id==='string'){
        const node=this.data.nodes.find(n=>n.id===message.id&&n.missing),origin=this.data.links.find(link=>link.target===message.id&&link.source===this.current)?.source??this.data.links.find(link=>link.target===message.id)?.source;
        if(node&&origin)await this.createMissing?.(origin,node.path);
      }
      if(message?.type==='layout'&&message.value&&JSON.stringify(message.value).length<10000)await this.context.workspaceState.update('graph.layout',message.value);
      if(message?.type==='expand')this.open();
      if(message?.type==='refresh'){this.index.refresh();this.refresh();}
    });
    onDispose(()=>{messages.dispose();this.views.delete(webview);});this.refresh();
  }
  refresh(){clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.scan();},200);}
  private async scan(){
    await this.index.ensure();this.publish();
  }
  private publish(){this.data=buildGraph(this.index.notes,this.current);for(const view of this.views)void view.postMessage({type:'graph',...this.data});}
  dispose(){clearTimeout(this.timer);this.revision++;this.subscriptions.forEach(s=>s.dispose());}
}
