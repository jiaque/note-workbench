import {t} from './shared/i18n';
import * as vscode from 'vscode';
import {getLanguage,resolveLanguage,setLanguage} from './shared/i18n';
import {GraphProvider} from './graph-provider';
import { randomBytes } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { applyReplacements } from './shared/edits';
import { renderDocument } from './shared/render';
import { validEdit, type Snapshot } from './shared/protocol';
import { hydrateResources, type Resource } from './shared/embeds';
import {exportPdf} from './pdf/export';
import {NoteIndex} from './note-index';
import {noteCandidates} from './shared/note-links';
import {blockRemoteImages} from './shared/remote-images';

export const viewType = 'noteWorkbench.editor';

export class NotebookProvider implements vscode.CustomTextEditorProvider, vscode.Disposable {
  active?: { document: vscode.TextDocument; panel: vscode.WebviewPanel };
  private queues = new Map<string, Promise<void>>();
  private panels = new Set<vscode.WebviewPanel>();
  private destinations = new Map<string, string>();
  private offsets = new Map<string, number>();
  private readyPanels = new WeakSet<vscode.WebviewPanel>();
  private exporting=false;
  constructor(private context: vscode.ExtensionContext, private graph?:GraphProvider,private index=new NoteIndex()) {}

  async openAt(id:string,offset?:number){
    if(offset!==undefined)this.offsets.set(id,offset);
    await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.parse(id),viewType);
    if(this.offsets.has(id)&&this.active?.document.uri.toString()===id&&this.readyPanels.has(this.active.panel)){
      const destination=this.offsets.get(id)!;this.offsets.delete(id);
      await this.active.panel.webview.postMessage({type:'navigateOffset',offset:destination});
    }
  }

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    this.panels.add(panel); this.active = { document, panel }; this.graph?.setActive(document.uri);
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist'), ...(folder ? [folder.uri] : [vscode.Uri.joinPath(document.uri, '..')])] };
    const styleSheets:vscode.Uri[]=[];
    const vaultRoot=await realpath(folder?.uri.fsPath??path.dirname(document.uri.fsPath));
    for(const relativePath of vscode.workspace.getConfiguration('noteWorkbench',document.uri).get<string[]>('styleSheets',[])){
      try{const file=await realpath(path.resolve(vaultRoot,relativePath)),relative=path.relative(vaultRoot,file);if(relative.startsWith('..')||path.isAbsolute(relative)||path.extname(file).toLowerCase()!=='.css')continue;styleSheets.push(vscode.Uri.file(file));}catch{/* Missing custom styles do not prevent opening a note. */}
    }
    panel.webview.html = this.html(panel.webview,styleSheets,vscode.workspace.getConfiguration('noteWorkbench',document.uri).get('render.remoteImages',true));
    const sendSettings=()=>panel.webview.postMessage({type:'settings',blockPreview:vscode.workspace.getConfiguration('noteWorkbench',document.uri).get('editor.blockPreview.enabled',true),motionEnabled:vscode.workspace.getConfiguration('noteWorkbench',document.uri).get('render.motion.enabled',true)});
    const config=vscode.workspace.onDidChangeConfiguration(event=>{if(event.affectsConfiguration('noteWorkbench',document.uri))void sendSettings();});
    let disposed = false, renderRequest = 0, acknowledgedOperation: string | undefined;
    const sendSnapshot = async (operationId?: string) => {
      if (disposed) return;
      if (operationId) acknowledgedOperation = operationId;
      const source = document.getText(), version = document.version, request = ++renderRequest;
      try {
        const rendered = renderDocument(source);
        await hydrateResources(rendered, document.uri.toString(), async (origin,target) => this.resolveResource(vscode.Uri.parse(origin),target,panel.webview));
        if(!vscode.workspace.getConfiguration('noteWorkbench',document.uri).get('render.remoteImages',true))blockRemoteImages(rendered);
        if (disposed || request !== renderRequest || document.version !== version) return;
        const message: Snapshot = { type: 'snapshot', source, version, name: path.basename(document.fileName), readonly: vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) === false, operationId: acknowledgedOperation, ...rendered };
        acknowledgedOperation = undefined;
        void panel.webview.postMessage(message);
        const offset=this.offsets.get(document.uri.toString());
        if(offset!==undefined&&panel.active&&this.readyPanels.has(panel)){this.offsets.delete(document.uri.toString());void panel.webview.postMessage({type:'navigateOffset',offset});}
        const destination = this.destinations.get(document.uri.toString());
        if (destination) { this.destinations.delete(document.uri.toString()); void panel.webview.postMessage({ type:'navigate', fragment:destination }); }
      } catch (error) { void panel.webview.postMessage({ type: 'error', message: String(error) }); }
    };
    const changes = vscode.workspace.onDidChangeTextDocument(event => { if (event.document.languageId === 'markdown') void sendSnapshot(); });
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{md,canvas}');
    const refresh = () => { void sendSnapshot(); };
    const watched = [watcher.onDidChange(refresh),watcher.onDidCreate(refresh),watcher.onDidDelete(refresh)];
    const state = panel.onDidChangeViewState(() => { if (panel.active) { this.active = { document, panel }; this.graph?.setActive(document.uri); } });
    let previewRequest=0;
    const messages = panel.webview.onDidReceiveMessage(message => {
      if(message?.type==='preview'){
        if(disposed||typeof message.source!=='string'||message.source.length>5_000_000||!Number.isInteger(message.requestId)||!Number.isInteger(message.from)||!Number.isInteger(message.to))return;
        const request=++previewRequest;
        void (async()=>{
          try{
            const rendered=renderDocument(message.source);
            rendered.blocks=rendered.blocks.filter(block=>block.from>=message.from&&block.to<=message.to&&block.kind!=='footnotes');
            await hydrateResources(rendered,document.uri.toString(),async(origin,target)=>this.resolveResource(vscode.Uri.parse(origin),target,panel.webview));
            if(!vscode.workspace.getConfiguration('noteWorkbench',document.uri).get('render.remoteImages',true))blockRemoteImages(rendered);
            if(!disposed&&request===previewRequest)await panel.webview.postMessage({type:'preview',requestId:message.requestId,html:rendered.blocks.map(block=>block.html).join('')});
          }catch{if(!disposed&&request===previewRequest)await panel.webview.postMessage({type:'preview',requestId:message.requestId,html:t("暂时无法渲染，源码已保留。"),error:true});}
        })();return;
      }
      if(message?.type==='complete'&&Number.isInteger(message.requestId)&&typeof message.query==='string'&&message.query.length<1000){
        void this.index.completions(document.uri,message.query).then(options=>panel.webview.postMessage({type:'completions',requestId:message.requestId,options}));return;
      }
      const key = document.uri.toString();
      const next = (this.queues.get(key) ?? Promise.resolve()).then(async () => {
        if (disposed || !message || typeof message.type !== 'string') return;
        switch (message.type) {
          case 'ready': this.readyPanels.add(panel); await sendSettings(); await sendSnapshot(); return;
          case 'edit': {
            if (!validEdit(message)) throw new Error(t("无效编辑请求。"));
            if (document.version !== message.baseVersion) { await panel.webview.postMessage({ type: 'conflict', operationId: message.operationId }); sendSnapshot(); return; }
            const before = document.getText();
            applyReplacements(before, message.replacements);
            const edit = new vscode.WorkspaceEdit();
            for (const item of message.replacements) edit.replace(document.uri, new vscode.Range(document.positionAt(item.from), document.positionAt(item.to)), item.insert);
            if (!await vscode.workspace.applyEdit(edit)) throw new Error(t("VS Code 未接受编辑，内容尚未写入。"));
            await sendSnapshot(message.operationId); return;
          }
          case 'save': await document.save(); return;
          case 'compare':case 'recover':{
            if(typeof message.source!=='string')return;
            const draft=await vscode.workspace.openTextDocument({language:'markdown',content:message.source});
            if(message.type==='compare')await vscode.commands.executeCommand('vscode.diff',document.uri,draft.uri,t("外部版本 ↔ 本地保留草稿"));
            else await vscode.window.showTextDocument(draft,{preview:false});
            return;
          }
          case 'exportPdf': void this.exportDocument(document); return;
          case 'source': await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default', panel.viewColumn); return;
          case 'undo': case 'redo': {
            // The active custom text editor scopes native undo to its TextDocument.
            if(!panel.active)return;
            await vscode.commands.executeCommand(message.type);
            await sendSnapshot();
            return;
          }
          case 'openLink': if (typeof message.href === 'string') await this.openLink(document.uri, message.href); return;
        }
      }).catch(error => { void panel.webview.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); sendSnapshot(); });
      this.queues.set(key, next);
      void next.finally(() => { if (this.queues.get(key) === next) this.queues.delete(key); });
    });
    panel.onDidDispose(() => { disposed = true; config.dispose(); changes.dispose(); watcher.dispose(); watched.forEach(item=>item.dispose()); messages.dispose(); state.dispose(); this.panels.delete(panel); if (this.active?.panel === panel) this.active = undefined; });
  }

  async exportCurrent():Promise<void>{
    if(this.active?.panel.active){await this.active.panel.webview.postMessage({type:'requestExportPdf'});return;}
    const document=vscode.window.activeTextEditor?.document;
    if(document?.languageId==='markdown')await this.exportDocument(document);
    else void vscode.window.showInformationMessage(t("请先打开要导出的 Markdown 笔记。"));
  }
  private async exportDocument(document:vscode.TextDocument):Promise<void>{
    if(this.exporting){void vscode.window.showInformationMessage(t("正在导出 PDF，请等待当前任务完成。"));return;}
    this.exporting=true;
    try{
      const source=document.getText(),origin=document.uri;
      const destination=await vscode.window.showSaveDialog({defaultUri:origin.with({path:origin.path.replace(/\.md$/i,'')+'.pdf'}),filters:{PDF:['pdf']},title:t("导出笔记为 PDF"),saveLabel:t("导出 PDF")});
      if(!destination)return;
      if(!destination.path.toLowerCase().endsWith('.pdf'))throw new Error(t("请选择 .pdf 文件名。"));
      const folder=vscode.workspace.getWorkspaceFolder(origin),root=await realpath(folder?.uri.fsPath??path.dirname(origin.fsPath));
      const styleSheets:{id:string;source:string}[]=[];
      for(const configured of vscode.workspace.getConfiguration('noteWorkbench',origin).get<string[]>('styleSheets',[])){
        try{const file=await realpath(path.resolve(root,configured)),relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative)||path.extname(file)!=='.css')continue;const uri=vscode.Uri.file(file);styleSheets.push({id:uri.toString(),source:Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8')});}catch{}
      }
      const completed=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:t("正在导出 PDF"),cancellable:true},async(progress,token)=>{
        const abort=new AbortController(),subscription=token.onCancellationRequested(()=>abort.abort());if(token.isCancellationRequested)abort.abort();
        try{
          progress.report({message:t("渲染正文、公式、图表和图片…")});
          const pdf=await exportPdf({source,origin:origin.toString(),title:path.basename(document.fileName,'.md'),assets:path.join(this.context.extensionUri.fsPath,'dist','webview'),styleSheets,
            browserPath:vscode.workspace.getConfiguration('noteWorkbench').get<string>('pdf.browserPath',''),signal:abort.signal,remoteImages:vscode.workspace.getConfiguration('noteWorkbench',origin).get('render.remoteImages',true),
            resolve:async(from,target)=>{const resource=await this.resolveResource(vscode.Uri.parse(from),target);if(vscode.Uri.parse(resource.id).with({fragment:''}).toString()===origin.toString())resource.source=source;return resource;},
            readResource:async id=>vscode.workspace.fs.readFile(vscode.Uri.parse(id).with({fragment:''})),
          });
          if(token.isCancellationRequested)return false;
          await vscode.workspace.fs.writeFile(destination,pdf);return true;
        }catch(error){if(token.isCancellationRequested)return false;throw error;}finally{subscription.dispose();}
      });
      if(completed)void vscode.window.showInformationMessage(t("PDF 已导出：")+path.basename(destination.fsPath),t("打开 PDF")).then(action=>{if(action)return vscode.env.openExternal(destination);});
    }catch(error){void vscode.window.showErrorMessage(t("PDF 导出失败：")+(error instanceof Error?error.message:String(error)));}
    finally{this.exporting=false;}
  }

  private async resolveResource(origin: vscode.Uri, href: string, webview?: vscode.Webview,interactive=false): Promise<Resource> {
    const hash=href.indexOf('#'), targetPath=hash<0?href:href.slice(0,hash), fragment=hash<0?'':decodeURIComponent(href.slice(hash+1));
    const folder=vscode.workspace.getWorkspaceFolder(origin);
    const root=await realpath(folder?.uri.fsPath ?? path.dirname(origin.fsPath));
    let target: vscode.Uri;
    if (!targetPath) target=origin;
    else if (targetPath.startsWith('file:///')) target=vscode.Uri.parse(targetPath);
    else if (/^[a-z]:[\\/]/i.test(targetPath)) target=vscode.Uri.file(decodeURIComponent(targetPath));
    else if (/^[a-z][\w+.-]*:/i.test(targetPath) || targetPath.startsWith('//')) throw new Error(t("不支持的笔记链接协议"));
    else target=vscode.Uri.joinPath(origin,'..',decodeURIComponent(targetPath));
    if (!path.extname(target.fsPath)) target=target.with({path:target.path+'.md'});
    try { await vscode.workspace.fs.stat(target); }
    catch {
      const name=path.basename(target.fsPath).toLowerCase();
      const files=await vscode.workspace.findFiles(new vscode.RelativePattern(root,'**/*'),'**/{node_modules,.git,.npm-cache}/**',10000);
      const suffix=decodeURIComponent(targetPath).replace(/\\/g,'/').replace(/^\//,'') + (path.extname(targetPath)?'':'.md');
      let candidates=files.filter(file=>path.basename(file.fsPath).toLowerCase()===name && (!suffix.includes('/') || file.path.toLowerCase().endsWith('/'+suffix.toLowerCase())));
      if(!candidates.length){await this.index.ensure();candidates=noteCandidates(this.index.notes.filter(note=>{const rel=path.relative(root,vscode.Uri.parse(note.id).fsPath);return !rel.startsWith('..')&&!path.isAbsolute(rel);}),origin.toString(),targetPath).map(note=>vscode.Uri.parse(note.id));}
      if(candidates.length===1)target=candidates[0];
      else if(candidates.length&&interactive){
        const choice=await vscode.window.showQuickPick(candidates.map(uri=>({label:path.basename(uri.fsPath),description:path.relative(root,uri.fsPath),uri})),{placeHolder:t("请选择要打开的同名笔记")});
        if(!choice)throw new Error(t("已取消打开笔记。"));target=choice.uri;
      }else if(!candidates.length&&interactive&&(!path.extname(targetPath)||/\.md$/i.test(targetPath))){
        const config=vscode.workspace.getConfiguration('noteWorkbench',origin),location=config.get<string>('notes.newLocation','current');
        const name=decodeURIComponent(targetPath).replace(/\\/g,'/');
        if(!name.includes('/')&&!/^[a-z]:/i.test(name))target=vscode.Uri.file(path.resolve(location==='root'?root:location==='folder'?path.resolve(root,config.get<string>('notes.newFolder','')):path.dirname(origin.fsPath),name.replace(/\.md$/i,'')+'.md'));
        const relative=path.relative(root,target.fsPath);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error(t("新笔记必须位于当前笔记库内。"));
        // Validate existing parent ancestry before creating directories, including symlinks.
        let parent=path.dirname(target.fsPath);
        while(true){try{const actual=await realpath(parent),rel=path.relative(root,actual);if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error(t("目标目录不在笔记库内。"));break;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;const next=path.dirname(parent);if(next===parent)throw error;parent=next;}}
        const choice=await vscode.window.showQuickPick([{label:t("创建笔记"),description:relative}],{placeHolder:t("笔记尚不存在：")+relative});
        if(!choice)throw new Error(t("已取消创建笔记。"));
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(target,'..'));
        const edit=new vscode.WorkspaceEdit();edit.createFile(target,{overwrite:false,ignoreIfExists:false});if(!await vscode.workspace.applyEdit(edit))throw new Error(t("无法创建笔记。"));
      }else throw new Error(candidates.length?t("多个同名文件，请点击链接选择"):t("找不到笔记或附件：")+href);
    }
    const resolved=await realpath(target.fsPath), relative=path.relative(root,resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(t("目标文件不在当前笔记库内"));
    const extension=path.extname(target.fsPath).toLowerCase();
    if(extension==='.svg'&&(await vscode.workspace.fs.stat(target)).size>500000)throw new Error(t("SVG 文件超过 500KB"));
    const source=extension==='.md'?(await vscode.workspace.openTextDocument(target)).getText():['.canvas','.svg'].includes(extension)?Buffer.from(await vscode.workspace.fs.readFile(target)).toString('utf8'):undefined;
    return {id:target.with({fragment}).toString(), url:(webview?webview.asWebviewUri(target):target).with({fragment}).toString(), source, extension};
  }

  async openLink(origin: vscode.Uri, href: string): Promise<void> {
    if(href.startsWith('nw-tag:')) {await vscode.commands.executeCommand('workbench.action.findInFiles',{query:'#'+decodeURIComponent(href.slice(7)),filesToInclude:'**/*.md',isCaseSensitive:false});return;}
    if (href.startsWith('nw-note:')) {
      const resource=await this.resolveResource(origin,decodeURIComponent(href.slice(8)),undefined,true), uri=vscode.Uri.parse(resource.id), destination=uri.fragment, target=uri.with({fragment:''});
      if (destination) this.destinations.set(target.toString(),destination);
      await vscode.commands.executeCommand('vscode.openWith',target,resource.extension==='.md'?viewType:'default');
      if (destination && this.active?.document.uri.toString()===target.toString()) { void this.active.panel.webview.postMessage({type:'navigate',fragment:destination}); this.destinations.delete(target.toString()); }
      return;
    }
    if (href.startsWith('obsidian:')) { await vscode.env.openExternal(vscode.Uri.parse(href)); return; }
    if (href.startsWith('mailto:')) { await vscode.env.openExternal(vscode.Uri.parse(href)); return; }
    if (/^https?:\/\//i.test(href)) { await vscode.env.openExternal(vscode.Uri.parse(href)); return; }
    if ((/^[a-z][\w+.-]*:/i.test(href) && !href.startsWith('file:///')) || href.startsWith('//')) return;
    if (!href || href.startsWith('#')) return;
    await this.openLink(origin,'nw-note:'+encodeURIComponent(href));
  }

  private html(webview: vscode.Webview, styleSheets:vscode.Uri[]=[],remoteImages=true): string {
    const nonce = randomBytes(16).toString('hex');
    const asset = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', name));
    const styles=styleSheets.map(uri=>`<link rel="stylesheet" href="${webview.asWebviewUri(uri).toString().replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">`).join('');
    return `<!doctype html><html lang="${getLanguage()}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} ${remoteImages?'https:':''} data:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; connect-src ${webview.cspSource}; media-src ${webview.cspSource} https: data:; worker-src ${webview.cspSource} blob:; script-src 'nonce-${nonce}' ${webview.cspSource};"><link rel="stylesheet" href="${asset('editor.css')}">${styles}</head><body><div id="app"></div><script type="module" nonce="${nonce}" src="${asset('editor.js')}"></script></body></html>`;
  }
  dispose(): void { for (const panel of this.panels) panel.dispose();this.index.dispose(); }
}

export function activate(context: vscode.ExtensionContext) {
  setLanguage(resolveLanguage(vscode.workspace.getConfiguration('noteWorkbench').get('language','auto'),vscode.env.language));
  const index=new NoteIndex(),graph=new GraphProvider(context,index),provider = new NotebookProvider(context,graph,index);
  graph.navigate=(id,offset)=>provider.openAt(id,offset);
  graph.createMissing=(origin,target)=>provider.openLink(vscode.Uri.parse(origin),'nw-note:'+encodeURIComponent(target));
  context.subscriptions.push(provider, graph,index,
    vscode.languages.registerCompletionItemProvider('markdown',{async provideCompletionItems(document,position){
      const prefix=document.lineAt(position).text.slice(0,position.character),match=/\[\[([^\]\n]*)$/.exec(prefix);if(!match)return;
      const options=await index.completions(document.uri,match[1]);
      return options.map(option=>{const item=new vscode.CompletionItem(option.label,vscode.CompletionItemKind.Reference);item.detail=option.detail;item.range=new vscode.Range(position.translate(0,-match[1].length),position);item.insertText=option.insert+(document.lineAt(position).text.slice(position.character).startsWith(']]')?'':']]');return item;});
    }},'[','#','^'),
    vscode.window.registerCustomEditorProvider(viewType, provider, { supportsMultipleEditorsPerDocument: true, webviewOptions: { retainContextWhenHidden: true } }),
    vscode.window.registerWebviewViewProvider('noteWorkbench.graph',graph,{webviewOptions:{retainContextWhenHidden:true}}),
    vscode.commands.registerCommand('noteWorkbench.openGraph',()=>graph.open()),
    vscode.commands.registerCommand('noteWorkbench.exportPdf',()=>provider.exportCurrent()),
    vscode.commands.registerCommand('noteWorkbench.openEditor', async (uri?: vscode.Uri) => {
      uri ??= vscode.window.activeTextEditor?.document.uri ?? provider.active?.document.uri;
      if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, viewType);
    }),
    vscode.commands.registerCommand('noteWorkbench.openSource', async () => { const uri = provider.active?.document.uri ?? vscode.window.activeTextEditor?.document.uri; if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, 'default'); }),
    vscode.commands.registerCommand('noteWorkbench.rebuildIndex', () => {index.refresh();graph.refresh();}),
  );
}
