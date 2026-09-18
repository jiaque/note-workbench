import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { applyReplacements } from './shared/edits';
import { renderDocument } from './shared/render';
import { validEdit, type Snapshot } from './shared/protocol';

export const viewType = 'noteWorkbench.editor';

export class NotebookProvider implements vscode.CustomTextEditorProvider, vscode.Disposable {
  active?: { document: vscode.TextDocument; panel: vscode.WebviewPanel };
  private queues = new Map<string, Promise<void>>();
  private panels = new Set<vscode.WebviewPanel>();
  constructor(private context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    this.panels.add(panel); this.active = { document, panel };
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist'), ...(folder ? [folder.uri] : [vscode.Uri.joinPath(document.uri, '..')])] };
    panel.webview.html = this.html(panel.webview);
    let disposed = false;
    const sendSnapshot = (operationId?: string) => {
      if (disposed) return;
      const source = document.getText();
      try {
        const rendered = renderDocument(source);
        // Host rewrites local images; links remain routed through openLink.
        for (const block of rendered.blocks) block.html = block.html.replace(/(<img\b[^>]*\bsrc=")([^"<>]+)(")/g, (_m, a, raw, b) => {
          if (/^(?:https?:|data:)/i.test(raw)) return `${a}${raw}${b}`;
          if (/^[a-z][\w+.-]*:/i.test(raw)) return `${a}${b}`;
          try { const target = vscode.Uri.joinPath(document.uri, '..', decodeURIComponent(raw.replace(/&amp;/g, '&'))); return `${a}${panel.webview.asWebviewUri(target)}${b}`; } catch { return `${a}${b}`; }
        });
        const message: Snapshot = { type: 'snapshot', source, version: document.version, name: path.basename(document.fileName), readonly: vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) === false, operationId, ...rendered };
        void panel.webview.postMessage(message);
      } catch (error) { void panel.webview.postMessage({ type: 'error', message: String(error) }); }
    };
    const changes = vscode.workspace.onDidChangeTextDocument(event => { if (event.document.uri.toString() === document.uri.toString()) sendSnapshot(); });
    const state = panel.onDidChangeViewState(() => { if (panel.active) this.active = { document, panel }; });
    const messages = panel.webview.onDidReceiveMessage(message => {
      const key = document.uri.toString();
      const next = (this.queues.get(key) ?? Promise.resolve()).then(async () => {
        if (disposed || !message || typeof message.type !== 'string') return;
        switch (message.type) {
          case 'ready': sendSnapshot(); return;
          case 'edit': {
            if (!validEdit(message)) throw new Error('无效编辑请求。');
            if (document.version !== message.baseVersion) { await panel.webview.postMessage({ type: 'conflict', operationId: message.operationId }); sendSnapshot(); return; }
            const before = document.getText();
            applyReplacements(before, message.replacements);
            const edit = new vscode.WorkspaceEdit();
            for (const item of message.replacements) edit.replace(document.uri, new vscode.Range(document.positionAt(item.from), document.positionAt(item.to)), item.insert);
            if (!await vscode.workspace.applyEdit(edit)) throw new Error('VS Code 未接受编辑，内容尚未写入。');
            sendSnapshot(message.operationId); return;
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
    panel.onDidDispose(() => { disposed = true; changes.dispose(); messages.dispose(); state.dispose(); this.panels.delete(panel); if (this.active?.panel === panel) this.active = undefined; });
  }

  private async openLink(origin: vscode.Uri, href: string): Promise<void> {
    if (/^https?:\/\//i.test(href)) { await vscode.env.openExternal(vscode.Uri.parse(href)); return; }
    if (/^[a-z][\w+.-]*:/i.test(href) || href.startsWith('//')) return;
    const [targetPath] = href.split('#');
    if (!targetPath) return;
    const target = vscode.Uri.joinPath(origin, '..', decodeURIComponent(targetPath));
    const folder = vscode.workspace.getWorkspaceFolder(origin);
    const root = await realpath(folder?.uri.fsPath ?? path.dirname(origin.fsPath));
    const resolved = await realpath(target.fsPath);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('本开发版仅打开笔记库内的本地链接。');
    await vscode.commands.executeCommand('vscode.openWith', target, target.path.endsWith('.md') ? viewType : 'default');
  }

  private html(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString('hex');
    const asset = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', name));
    return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource};"><link rel="stylesheet" href="${asset('editor.css')}"></head><body><div id="app"></div><script type="module" nonce="${nonce}" src="${asset('editor.js')}"></script></body></html>`;
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
