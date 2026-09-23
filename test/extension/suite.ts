import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { NotebookProvider } from '../../src/extension';
import {NoteIndex} from '../../src/note-index';
import {TagsProvider} from '../../src/tags-provider';

export async function run() {
  const folder = vscode.workspace.workspaceFolders![0].uri;
  const uri = vscode.Uri.joinPath(folder, '.integration-test.md');
  await vscode.workspace.fs.writeFile(uri, Buffer.from('# Original\n\n| A | B |\n| --- | --- |\n| one | two |\n'));
  const document = await vscode.workspace.openTextDocument(uri);
  const incoming = new vscode.EventEmitter<any>(), state = new vscode.EventEmitter<any>(), disposed = new vscode.EventEmitter<void>();
  const messages: any[] = [];
  const fakePanel: any = { webview: { options: {}, html: '', cspSource: 'https://test.invalid', asWebviewUri: (uri: vscode.Uri) => uri, onDidReceiveMessage: incoming.event, postMessage: async (m: any) => { messages.push(m); return true; } }, onDidChangeViewState: state.event, onDidDispose: disposed.event, dispose: () => disposed.fire(), viewColumn: vscode.ViewColumn.One };
  const extension = vscode.extensions.getExtension('jiaque.note-workbench')!;
  assert.ok(extension, 'Extension must be independently installed in development host');
  await extension.activate();
  const provider = new NotebookProvider({ extensionUri: extension.extensionUri } as any);
  const index=new NoteIndex();
  const linked=vscode.Uri.joinPath(folder,'.integration-linked.md');
  const defaultUri=vscode.Uri.joinPath(folder,'.integration-default.md');
  const waitFor = async (predicate: () => boolean) => { const limit = Date.now() + 8000; while (!predicate()) { if (Date.now() > limit) throw new Error('Timed out waiting for host edit'); await new Promise(resolve => setTimeout(resolve, 30)); } };
  try {
    await provider.resolveCustomTextEditor(document, fakePanel);
    incoming.fire({ type: 'ready' }); await waitFor(() => messages.some(m => m.type === 'snapshot'));
    const attachment=vscode.Uri.joinPath(folder,'路径补全 测试.svg');
    try{
      await vscode.workspace.fs.writeFile(attachment,Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'));
      incoming.fire({type:'completePath',requestId:901,query:'路径',images:true});
      await waitFor(()=>messages.some(m=>m.type==='completions'&&m.requestId===901));
      const options=messages.find(m=>m.requestId===901).options;
      assert.ok(options.some((o:any)=>o.label==='路径补全 测试.svg'&&decodeURIComponent(o.insert)==='路径补全 测试.svg'));
      incoming.fire({type:'completePath',requestId:902,query:'../../',images:false});await waitFor(()=>messages.some(m=>m.requestId===902));assert.deepEqual(messages.find(m=>m.requestId===902).options,[]);
      assert.ok(messages.some(m=>m.type==='settings'&&m.formatToolbar&&m.previewSelection&&m.autoToc));
      console.log('PASS: Unicode attachment completion, workspace boundary and authoring settings');
    }finally{await vscode.workspace.fs.delete(attachment);}
    const baseVersion = document.version;
    assert.ok(messages.some(m=>m.type==='settings'&&m.blockPreview===true));
    assert.ok(messages.some(m=>m.type==='settings'&&m.motionEnabled===true),'Motion is enabled by default');
    const motionConfig=vscode.workspace.getConfiguration('noteWorkbench'),oldMotion=motionConfig.inspect<boolean>('render.motion.enabled')?.globalValue;
    try{await motionConfig.update('render.motion.enabled',false,vscode.ConfigurationTarget.Global);await waitFor(()=>messages.some(m=>m.type==='settings'&&m.motionEnabled===false));}
    finally{await motionConfig.update('render.motion.enabled',oldMotion,vscode.ConfigurationTarget.Global);}
    incoming.fire({type:'preview',requestId:7,source:'> [!note] Preview\n> **fresh**',from:0,to:100});
    await waitFor(()=>messages.some(m=>m.type==='preview'&&m.requestId===7));
    assert.match(messages.find(m=>m.type==='preview'&&m.requestId===7).html,/<strong\b[^>]*><span\b[^>]*>fresh<\/span><\/strong>/);
    assert.equal(document.version,baseVersion,'Preview must not edit or save the real document');
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
    const activeTab=vscode.window.tabGroups.activeTabGroup.activeTab;
    assert.ok(activeTab?.input instanceof vscode.TabInputCustom);
    await vscode.commands.executeCommand('undo');await waitFor(()=>document.getText().startsWith('# Original'));
    assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab,activeTab,'Undo must retain the same custom editor tab');
    await vscode.commands.executeCommand('redo');await waitFor(()=>document.getText().startsWith('# Changed'));
    assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab,activeTab,'Redo must retain the same custom editor tab');
    await document.save();
    console.log('PASS: custom editor registration, real document edit/save, stale rejection and undo/redo without source-tab switching');
    await index.ensure();const unchanged=index.notes.find(note=>note.name==='Second.md');assert.ok(unchanged);
    const secondMessages:any[]=[];const secondPanel={...fakePanel,webview:{...fakePanel.webview,postMessage:async(message:any)=>{secondMessages.push(message);return true;}}};
    await provider.resolveCustomTextEditor(document,secondPanel as any);
    const append=new vscode.WorkspaceEdit();append.insert(uri,document.positionAt(document.getText().length),'\n[[Sec');await vscode.workspace.applyEdit(append);
    await waitFor(()=>secondMessages.some(message=>message.type==='snapshot'&&message.source.endsWith('[[Sec')));
    const completion=await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider',uri,document.positionAt(document.getText().length));
    assert.ok(completion.items.some(item=>item.label==='Second'),'Source editor completion includes indexed notes');
    await index.ensure();assert.equal(index.notes.find(note=>note.name==='Second.md'),unchanged,'Unchanged notes retain cache identity');
    assert.ok(index.notes.find(note=>note.id===uri.toString())?.source.endsWith('[[Sec'));
    console.log('PASS: multiple views synchronize, source completions work, incremental index retains unchanged notes');
    await vscode.workspace.fs.writeFile(linked,Buffer.from('Embedded original'));
    const embed=new vscode.WorkspaceEdit();embed.insert(uri,document.positionAt(document.getText().length),']]\n\n![[.integration-linked]]\n');await vscode.workspace.applyEdit(embed);
    await waitFor(()=>messages.some(message=>message.type==='snapshot'&&message.blocks.some((block:any)=>block.html.includes('Embedded original'))));
    const linkedDoc=await vscode.workspace.openTextDocument(linked),change=new vscode.WorkspaceEdit();change.replace(linked,new vscode.Range(linkedDoc.positionAt(0),linkedDoc.positionAt(linkedDoc.getText().length)),'Embedded updated');await vscode.workspace.applyEdit(change);
    await waitFor(()=>messages.some(message=>message.type==='snapshot'&&message.blocks.some((block:any)=>block.html.includes('Embedded updated'))));
    await linkedDoc.save();await document.save();
    console.log('PASS: embedded source edits refresh the host note without rewriting host source');
    await vscode.workspace.fs.writeFile(defaultUri,Buffer.from('# Default editor'));
    await vscode.commands.executeCommand('vscode.open',defaultUri);
    assert.ok(vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputCustom,'A new Markdown file opens with the default custom editor candidate');
    const config=vscode.workspace.getConfiguration('files'),previous=config.inspect<string>('autoSave')?.globalValue;
    try{
      await config.update('autoSave','afterDelay',vscode.ConfigurationTarget.Global);
      const autoDoc=await vscode.workspace.openTextDocument(defaultUri),edit=new vscode.WorkspaceEdit();edit.insert(defaultUri,autoDoc.positionAt(autoDoc.getText().length),'\nAutosaved');await vscode.workspace.applyEdit(edit);
      await waitFor(()=>!autoDoc.isDirty);assert.match(Buffer.from(await vscode.workspace.fs.readFile(defaultUri)).toString('utf8'),/Autosaved/);
    }finally{await config.update('autoSave',previous,vscode.ConfigurationTarget.Global);}
    console.log('PASS: fresh Markdown default editor selection and VS Code Auto Save');
    const renameFrom=vscode.Uri.joinPath(folder,'.rename-before.md'),renameTo=vscode.Uri.joinPath(folder,'.rename-after.md'),ref=vscode.Uri.joinPath(folder,'.rename-reference.md');
    const tags=new TagsProvider(index);
    try{
      await vscode.workspace.fs.writeFile(renameFrom,Buffer.from('---\ntags: [test/rename]\n---\n#目标\n'));
      await vscode.workspace.fs.writeFile(ref,Buffer.from('[[.rename-before#Heading|label]]\n'));
      const refDoc=await vscode.workspace.openTextDocument(ref);
      const pending=new vscode.WorkspaceEdit();pending.insert(ref,refDoc.positionAt(refDoc.getText().length),'\nUnsaved text #test/rename');await vscode.workspace.applyEdit(pending);
      const rename=new vscode.WorkspaceEdit();rename.renameFile(renameFrom,renameTo);assert.ok(await vscode.workspace.applyEdit(rename));
      await waitFor(()=>refDoc.getText().includes('[[.rename-after#Heading|label]]'));
      assert.match(refDoc.getText(),/Unsaved text/,'Rename preserves dirty document contents');
      await refDoc.save();index.refresh();await index.ensure();
      const groups=await tags.getChildren(),group=groups.find((g:any)=>g.tag==='test/rename');assert.ok(group,'Tag panel indexes frontmatter and inline tags');
      const children=await tags.getChildren(group);assert.equal(children.length,2);assert.ok(children.some((n:any)=>n.id===renameTo.toString()));
      assert.equal(tags.getTreeItem(children[0]).command?.command,'noteWorkbench.openEditor');
      console.log('PASS: VS Code rename updates links without losing dirty edits; tag panel shows renamed notes and opens the editor');
    }finally{tags.dispose();for(const file of [renameFrom,renameTo,ref])try{await vscode.workspace.fs.delete(file);}catch{}}
  } finally {
    provider.dispose();index.dispose(); incoming.dispose(); state.dispose(); disposed.dispose();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.workspace.fs.delete(uri);
    try{await vscode.workspace.fs.delete(linked);}catch{}
    try{await vscode.workspace.fs.delete(defaultUri);}catch{}
  }
}
