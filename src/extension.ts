import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { applyReplacements } from './shared/edits';
import { renderDocument } from './shared/render';
import { validEdit, type Snapshot } from './shared/protocol';
import { hydrateResources, type Resource } from './shared/embeds';

export const viewType = 'noteWorkbench.editor';

export class NotebookProvider implements vscode.CustomTextEditorProvider, vscode.Disposable {
  active?: { document: vscode.TextDocument; panel: vscode.WebviewPanel };
  private queues = new Map<string, Promise<void>>();
  private panels = new Set<vscode.WebviewPanel>();
  private destinations = new Map<string, string>();
  constructor(private context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    this.panels.add(panel); this.active = { document, panel };
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist'), ...(folder ? [folder.uri] : [vscode.Uri.joinPath(document.uri, '..')])] };
    const styleSheets:vscode.Uri[]=[];
    const vaultRoot=await realpath(folder?.uri.fsPath??path.dirname(document.uri.fsPath));
    for(const relativePath of vscode.workspace.getConfiguration('noteWorkbench',document.uri).get<string[]>('styleSheets',[])){
      try{const file=await realpath(path.resolve(vaultRoot,relativePath)),relative=path.relative(vaultRoot,file);if(relative.startsWith('..')||path.isAbsolute(relative)||path.extname(file).toLowerCase()!=='.css')continue;styleSheets.push(vscode.Uri.file(file));}catch{/* Missing custom styles do not prevent opening a note. */}
    }
    panel.webview.html = this.html(panel.webview,styleSheets);
    let disposed = false, renderRequest = 0, acknowledgedOperation: string | undefined;
    const sendSnapshot = async (operationId?: string) => {
      if (disposed) return;
      if (operationId) acknowledgedOperation = operationId;
      const source = document.getText(), version = document.version, request = ++renderRequest;
      try {
        const rendered = renderDocument(source);
        await hydrateResources(rendered, document.uri.toString(), async (origin,target) => this.resolveResource(vscode.Uri.parse(origin),target,panel.webview));
        if (disposed || request !== renderRequest || document.version !== version) return;
        const message: Snapshot = { type: 'snapshot', source, version, name: path.basename(document.fileName), readonly: vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) === false, operationId: acknowledgedOperation, ...rendered };
        acknowledgedOperation = undefined;
        void panel.webview.postMessage(message);
        const destination = this.destinations.get(document.uri.toString());
        if (destination) { this.destinations.delete(document.uri.toString()); void panel.webview.postMessage({ type:'navigate', fragment:destination }); }
      } catch (error) { void panel.webview.postMessage({ type: 'error', message: String(error) }); }
    };
    const changes = vscode.workspace.onDidChangeTextDocument(event => { if (event.document.languageId === 'markdown') void sendSnapshot(); });
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{md,canvas}');
    const refresh = () => { void sendSnapshot(); };
    const watched = [watcher.onDidChange(refresh),watcher.onDidCreate(refresh),watcher.onDidDelete(refresh)];
    const state = panel.onDidChangeViewState(() => { if (panel.active) this.active = { document, panel }; });
    const messages = panel.webview.onDidReceiveMessage(message => {
      const key = document.uri.toString();
      const next = (this.queues.get(key) ?? Promise.resolve()).then(async () => {
        if (disposed || !message || typeof message.type !== 'string') return;
        switch (message.type) {
          case 'ready': await sendSnapshot(); return;
          case 'edit': {
            if (!validEdit(message)) throw new Error('无效编辑请求。');
            if (document.version !== message.baseVersion) { await panel.webview.postMessage({ type: 'conflict', operationId: message.operationId }); sendSnapshot(); return; }
            const before = document.getText();
            applyReplacements(before, message.replacements);
            const edit = new vscode.WorkspaceEdit();
            for (const item of message.replacements) edit.replace(document.uri, new vscode.Range(document.positionAt(item.from), document.positionAt(item.to)), item.insert);
            if (!await vscode.workspace.applyEdit(edit)) throw new Error('VS Code 未接受编辑，内容尚未写入。');
            await sendSnapshot(message.operationId); return;
          }
          case 'save': await document.save(); return;
          case 'source': await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default', panel.viewColumn); return;
          case 'undo': case 'redo': {
            // Commands target the visible text editor: explicitly bind before dispatch.
            await vscode.window.showTextDocument(document, { viewColumn: panel.viewColumn, preserveFocus: false });
            await vscode.commands.executeCommand(message.type);
            await vscode.commands.executeCommand('vscode.openWith', document.uri, viewType, panel.viewColumn);
            return;
          }
          case 'openLink': if (typeof message.href === 'string') await this.openLink(document.uri, message.href); return;
        }
      }).catch(error => { void panel.webview.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); sendSnapshot(); });
      this.queues.set(key, next);
      void next.finally(() => { if (this.queues.get(key) === next) this.queues.delete(key); });
    });
    panel.onDidDispose(() => { disposed = true; changes.dispose(); watcher.dispose(); watched.forEach(item=>item.dispose()); messages.dispose(); state.dispose(); this.panels.delete(panel); if (this.active?.panel === panel) this.active = undefined; });
  }

  private async resolveResource(origin: vscode.Uri, href: string, webview?: vscode.Webview): Promise<Resource> {
    const hash=href.indexOf('#'), targetPath=hash<0?href:href.slice(0,hash), fragment=hash<0?'':decodeURIComponent(href.slice(hash+1));
    const folder=vscode.workspace.getWorkspaceFolder(origin);
    const root=await realpath(folder?.uri.fsPath ?? path.dirname(origin.fsPath));
    let target: vscode.Uri;
    if (!targetPath) target=origin;
    else if (targetPath.startsWith('file:///')) target=vscode.Uri.parse(targetPath);
    else if (/^[a-z]:[\\/]/i.test(targetPath)) target=vscode.Uri.file(decodeURIComponent(targetPath));
    else if (/^[a-z][\w+.-]*:/i.test(targetPath) || targetPath.startsWith('//')) throw new Error('不支持的笔记链接协议');
    else target=vscode.Uri.joinPath(origin,'..',decodeURIComponent(targetPath));
    if (!path.extname(target.fsPath)) target=target.with({path:target.path+'.md'});
    try { await vscode.workspace.fs.stat(target); }
    catch {
      const name=path.basename(target.fsPath).toLowerCase();
      const files=await vscode.workspace.findFiles(new vscode.RelativePattern(root,'**/*'),'**/{node_modules,.git,.npm-cache}/**',10000);
      const suffix=decodeURIComponent(targetPath).replace(/\\/g,'/').replace(/^\//,'') + (path.extname(targetPath)?'':'.md');
      const candidates=files.filter(file=>path.basename(file.fsPath).toLowerCase()===name && (!suffix.includes('/') || file.path.toLowerCase().endsWith('/'+suffix.toLowerCase())));
      if (candidates.length!==1) throw new Error(candidates.length?'多个同名文件，请使用完整相对路径':'找不到笔记或附件：'+href);
      target=candidates[0];
    }
    const resolved=await realpath(target.fsPath), relative=path.relative(root,resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('目标文件不在当前笔记库内');
    const extension=path.extname(target.fsPath).toLowerCase();
    const source=extension==='.md'?(await vscode.workspace.openTextDocument(target)).getText():extension==='.canvas'?Buffer.from(await vscode.workspace.fs.readFile(target)).toString('utf8'):undefined;
    return {id:target.with({fragment}).toString(), url:(webview?webview.asWebviewUri(target):target).with({fragment}).toString(), source, extension};
  }

  private async openLink(origin: vscode.Uri, href: string): Promise<void> {
    if(href.startsWith('nw-tag:')) {await vscode.commands.executeCommand('workbench.action.findInFiles',{query:'#'+decodeURIComponent(href.slice(7)),filesToInclude:'**/*.md',isCaseSensitive:false});return;}
    if (href.startsWith('nw-note:')) {
      const resource=await this.resolveResource(origin,decodeURIComponent(href.slice(8))), uri=vscode.Uri.parse(resource.id), destination=uri.fragment, target=uri.with({fragment:''});
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

  private html(webview: vscode.Webview, styleSheets:vscode.Uri[]=[]): string {
    const nonce = randomBytes(16).toString('hex');
    const asset = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', name));
    const styles=styleSheets.map(uri=>`<link rel="stylesheet" href="${webview.asWebviewUri(uri).toString().replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">`).join('');
    return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; connect-src ${webview.cspSource}; media-src ${webview.cspSource} https: data:; worker-src ${webview.cspSource} blob:; script-src 'nonce-${nonce}' ${webview.cspSource};"><link rel="stylesheet" href="${asset('editor.css')}">${styles}</head><body><div id="app"></div><script type="module" nonce="${nonce}" src="${asset('editor.js')}"></script></body></html>`;
  }
  dispose(): void { for (const panel of this.panels) panel.dispose(); }
}

class Notes implements vscode.TreeDataProvider<vscode.Uri>, vscode.Disposable {
  private changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  private watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
  private subscriptions = [this.watcher.onDidCreate(() => this.refresh()), this.watcher.onDidDelete(() => this.refresh())];
  refresh() { this.changed.fire(); }
  async getChildren() { return (await vscode.workspace.findFiles('**/*.md', '**/{node_modules,.git,.npm-cache}/**', 2000)).sort((a, b) => a.path.localeCompare(b.path)); }
  getTreeItem(uri: vscode.Uri) { const item = new vscode.TreeItem(path.basename(uri.fsPath)); item.description = vscode.workspace.asRelativePath(uri); item.resourceUri = uri; item.command = { command: 'noteWorkbench.openEditor', title: '打开笔记', arguments: [uri] }; return item; }
  dispose() { this.changed.dispose(); this.watcher.dispose(); this.subscriptions.forEach(item => item.dispose()); }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new NotebookProvider(context), notes = new Notes();
  context.subscriptions.push(provider, notes,
    vscode.window.registerCustomEditorProvider(viewType, provider, { supportsMultipleEditorsPerDocument: true, webviewOptions: { retainContextWhenHidden: true } }),
    vscode.window.registerTreeDataProvider('noteWorkbench.notes', notes),
    vscode.commands.registerCommand('noteWorkbench.openEditor', async (uri?: vscode.Uri) => {
      uri ??= vscode.window.activeTextEditor?.document.uri ?? provider.active?.document.uri;
      if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, viewType);
    }),
    vscode.commands.registerCommand('noteWorkbench.openSource', async () => { const uri = provider.active?.document.uri ?? vscode.window.activeTextEditor?.document.uri; if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, 'default'); }),
    vscode.commands.registerCommand('noteWorkbench.rebuildIndex', () => notes.refresh()),
  );
}
