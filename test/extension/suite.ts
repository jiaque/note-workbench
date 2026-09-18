import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { NotebookProvider } from '../../src/extension';

export async function run() {
  const folder = vscode.workspace.workspaceFolders![0].uri;
  const uri = vscode.Uri.joinPath(folder, '.integration-test.md');
  await vscode.workspace.fs.writeFile(uri, Buffer.from('# Original\n\n| A | B |\n| --- | --- |\n| one | two |\n'));
  const document = await vscode.workspace.openTextDocument(uri);
  const incoming = new vscode.EventEmitter<any>(), state = new vscode.EventEmitter<any>(), disposed = new vscode.EventEmitter<void>();
  const messages: any[] = [];
  const fakePanel: any = { webview: { options: {}, html: '', cspSource: 'https://test.invalid', asWebviewUri: (uri: vscode.Uri) => uri, onDidReceiveMessage: incoming.event, postMessage: async (m: any) => { messages.push(m); return true; } }, onDidChangeViewState: state.event, onDidDispose: disposed.event, dispose: () => disposed.fire(), viewColumn: vscode.ViewColumn.One };
  const extension = vscode.extensions.getExtension('local-development.note-workbench')!;
  assert.ok(extension, 'Extension must be independently installed in development host');
  await extension.activate();
  const provider = new NotebookProvider({ extensionUri: extension.extensionUri } as any);
  const waitFor = async (predicate: () => boolean) => { const limit = Date.now() + 8000; while (!predicate()) { if (Date.now() > limit) throw new Error('Timed out waiting for host edit'); await new Promise(resolve => setTimeout(resolve, 30)); } };
  try {
    await provider.resolveCustomTextEditor(document, fakePanel);
    incoming.fire({ type: 'ready' }); await waitFor(() => messages.some(m => m.type === 'snapshot'));
    const baseVersion = document.version;
    incoming.fire({ type: 'edit', baseVersion, operationId: 'edit-1', replacements: [{ from: 2, to: 10, expectedText: 'Original', insert: 'Changed' }] });
    await waitFor(() => messages.some(m => m.operationId === 'edit-1'));
    assert.match(document.getText(), /^# Changed/); assert.ok(document.isDirty);
    incoming.fire({ type: 'edit', baseVersion, operationId: 'stale', replacements: [{ from: 2, to: 9, expectedText: 'Changed', insert: 'LOST' }] });
    await waitFor(() => messages.some(m => m.type === 'conflict'));
    assert.match(document.getText(), /^# Changed/);
    incoming.fire({ type: 'save' }); await waitFor(() => !document.isDirty);
    assert.match(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'), /^# Changed/);
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('undo');
    await waitFor(() => document.getText().startsWith('# Original'));
    await vscode.commands.executeCommand('redo'); await waitFor(() => document.getText().startsWith('# Changed'));
    await document.save();
    await vscode.commands.executeCommand('vscode.openWith', uri, 'noteWorkbench.editor');
    console.log('PASS: custom editor registration, real document edit/save, stale rejection and undo/redo');
  } finally {
    provider.dispose(); incoming.dispose(); state.dispose(); disposed.dispose();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.workspace.fs.delete(uri);
  }
}
