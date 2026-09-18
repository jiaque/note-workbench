import { ChangeSet, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { editTable, markdownTable, htmlTables, type Table, type TableOperation } from '../shared/tables';
import { applyReplacements, minimalEdit } from '../shared/edits';
import type { Snapshot } from '../shared/protocol';
import { LiveSync } from '../shared/live-sync';
import { normalizeSnapshot, hostEdits } from '../shared/line-endings';
import {livePreview, renderedBlocks, previewMode, previewFocus} from './live-preview';
import type {Block} from '../shared/render';
import './live-preview.css';
import {findHeading} from '../shared/anchors';
import './editor.css';
import './document.css';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void; getState(): any; setState(value: unknown): void };
const api = acquireVsCodeApi();
let snapshot: Snapshot | undefined;
let editor: EditorView | undefined;
const sync = new LiveSync();
let hostSource = '';
let sourceMode = false;
let savedSelection = {anchor:0,head:0};
let timer: ReturnType<typeof setTimeout> | undefined;
let deferred: Snapshot | undefined;
let flushCell: (()=>void) | undefined;
let composingCell = false;
let cellRecovery: {source:string; replacements:ReturnType<typeof minimalEdit>} | undefined;
let afterSync: 'save' | 'undo' | 'redo' | 'source' | undefined;
const recovered = api.getState();
let mode: 'edit' | 'read' = 'edit';
let showProperties = false;
let pendingNavigation: string | undefined;
let renderEpoch = 0;
let mermaidPromise: Promise<any> | undefined;
let disposeMedia: (()=>void)[]=[];
const root = document.getElementById('app')!;
root.innerHTML = `<details class="document-menu"><summary aria-label="笔记操作" title="笔记操作">···</summary><nav aria-label="笔记操作"></nav></details><div id="status" role="status" aria-live="polite"></div><main id="content"></main>`;
const content = document.getElementById('content')!;
const status = document.getElementById('status')!;
const nav = root.querySelector('nav')!;
const button = (label: string, onClick: () => void, className = '') => { const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.className = className; node.addEventListener('click', onClick); return node; };
const info = (message: string, error = false) => { status.textContent = message; status.classList.toggle('error', error); };
const remember = () => api.setState({ source:sync.local, baseSource:sync.source, cellRecovery });
function navigate(fragment: string) {
  if (editor && snapshot) {
    const destination = snapshot.blocks.find(block => {
      const template=document.createElement('template');template.innerHTML=block.html;
      return [...template.content.querySelectorAll('[id]')].some(node=>node.id===fragment || node.id==='user-content-'+fragment);
    });
    if (destination) {
      const changes=ChangeSet.of(minimalEdit(snapshot.source,editor.state.doc.toString()),snapshot.source.length);
      const position=changes.mapPos(destination.from);
      editor.dispatch({selection:{anchor:position},effects:[previewFocus.of(true),EditorView.scrollIntoView(position,{y:'start'})]});editor.focus();return;
    }
  }
  const target = document.getElementById('user-content-' + fragment) ?? document.getElementById(fragment)
    ?? findHeading([...content.querySelectorAll<HTMLElement>('h1[data-heading],h2[data-heading],h3[data-heading],h4[data-heading],h5[data-heading],h6[data-heading]')],fragment,node=>node.dataset.heading??'',node=>Number(node.tagName[1]));
  for (let parent = target?.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
  target?.scrollIntoView({ behavior:'smooth', block:'start' });
}
document.addEventListener('pointerdown', event => {
  for (const menu of document.querySelectorAll<HTMLDetailsElement>('.table-menu[open],.document-menu[open]')) if (!menu.contains(event.target as Node)) menu.open = false;
});
content.addEventListener('click', event => {
  const link = (event.target as Element).closest('a');
  if (!link) return;
  event.preventDefault();
  const href = link.getAttribute('href') ?? '';
  if (href.startsWith('#')) {
    let id: string; try { id = decodeURIComponent(href.slice(1)); } catch { return; }
    navigate(id);
  } else api.postMessage({ type: 'openLink', href });
});


function flush() {
  clearTimeout(timer);
  if (editor?.composing || composingCell || !snapshot || snapshot.readonly) return;
  const message = sync.next(crypto.randomUUID());
  if (message) api.postMessage({...message,replacements:hostEdits(hostSource,message.replacements)});
  else if (!sync.pending && !sync.conflict && sync.local === sync.source && afterSync) {
    const type = afterSync; afterSync = undefined; api.postMessage({ type });
  }
}
function schedule() { clearTimeout(timer); timer = setTimeout(flush, 450); }
function request(type: typeof afterSync) { flushCell?.(); afterSync = type; flush(); }
function commit(replacements: ReturnType<typeof minimalEdit>) {
  if (!snapshot || snapshot.readonly || sync.conflict || !replacements.length) return;
  const before = editor?.state.doc.toString() ?? sync.local;
  const next = applyReplacements(before, replacements);
  if (editor) editor.dispatch({ changes: minimalEdit(before,next).map(r => ({from:r.from,to:r.to,insert:r.insert})), userEvent:'input' });
  else { sync.local = applyReplacements(before,replacements); remember(); }
  flush();
}
function openDraft(from: number, _to: number) {
  flushCell?.();
  if (mode === 'read') { mode = 'edit'; render(); }
  sourceMode=true; navigation();
  editor?.dispatch({ selection:{anchor:from}, effects:[previewMode.of(false),previewFocus.of(true),EditorView.scrollIntoView(from)] });
  editor?.focus();
}
function tableElement(table: Table, html: string): HTMLElement {
  const tableVersion = snapshot!.version;
  let tableSource = editor?.state.doc.toString() ?? snapshot!.source;
  const wrapper = document.createElement('section'); wrapper.className = 'table-card';
  wrapper.dataset.sourceFrom = String(table.from);
  wrapper.setAttribute('aria-label', `${table.format === 'markdown' ? 'Markdown' : 'HTML'} 表格`);
  const menu = document.createElement('details'); menu.className = 'table-menu';
  const menuToggle = document.createElement('summary'); menuToggle.textContent = '···'; menuToggle.setAttribute('aria-label', '表格操作'); menu.append(menuToggle);
  const tools = document.createElement('div'); tools.className = 'table-tools'; menu.append(tools);
  const renderedTable = document.createElement('template'); renderedTable.innerHTML = html;
  const renderedRows = Array.from(renderedTable.content.querySelector('table')?.rows ?? []);
  const caption = document.createElement('span'); caption.textContent = table.format.toUpperCase(); tools.append(caption);
  let rowIndex = table.format === 'markdown' && table.rows.length > 1 ? 1 : 0, columnIndex = 0;
  const targetLabel = document.createElement('span');
  const refreshTarget = () => { targetLabel.textContent = `第 ${rowIndex + 1} 行 / 第 ${columnIndex + 1} 列`; };
  refreshTarget(); tools.append(targetLabel);
  const execute = (op: TableOperation) => {
    if (!snapshot || sync.conflict) return;
    if ((editor?.state.doc.toString() ?? snapshot.source) !== tableSource) { info('表格已变化，请重新选择单元格。', true); return; }
    try { commit(editTable(tableSource, table, op)); } catch (error) { info(String(error instanceof Error ? error.message : error), true); }
  };
  if (mode === 'edit' && !table.reason && !snapshot?.readonly) {
    const actions: [string, () => TableOperation][] = [
      ['上方加行', () => ({ kind: 'insertRow', at: rowIndex, row: rowIndex })],
      ['下方加行', () => ({ kind: 'insertRow', at: rowIndex + 1, row: rowIndex })],
      ['左侧加列', () => ({ kind: 'insertColumn', at: columnIndex })],
      ['右侧加列', () => ({ kind: 'insertColumn', at: columnIndex + 1 })],
      ['删除行', () => ({ kind: 'deleteRow', row: rowIndex })],
      ['删除列', () => ({ kind: 'deleteColumn', column: columnIndex })],
      ['行上移', () => ({ kind: 'moveRow', from: rowIndex, to: rowIndex - 1 })],
      ['行下移', () => ({ kind: 'moveRow', from: rowIndex, to: rowIndex + 1 })],
      ['列左移', () => ({ kind: 'moveColumn', from: columnIndex, to: columnIndex - 1 })],
      ['列右移', () => ({ kind: 'moveColumn', from: columnIndex, to: columnIndex + 1 })],
    ];
    for (const [label, op] of actions) tools.append(button(label, () => execute(op())));
    tools.append(button('删除整表', () => { if (confirm('删除整个表格？可以通过撤销恢复。')) commit([{ from: table.from, to: table.to, expectedText: tableSource.slice(table.from, table.to), insert: '' }]); }, 'danger'));
  }
  tools.append(button('表格源码', () => openDraft(table.from, table.to)));
  wrapper.append(menu);
  if (table.reason) { const note = document.createElement('p'); note.textContent = table.reason; wrapper.append(note); }
  const scroll = document.createElement('div'); scroll.className = 'table-scroll';
  const grid = document.createElement('table'); grid.className = 'editable-table';
  let dragging: { axis: 'row' | 'column'; from: number; version: number; x: number; y: number; moved: boolean } | undefined;
  const canEdit = mode === 'edit' && !snapshot?.readonly && !table.reason;
  const bindDrag = (handle: HTMLElement, axis: 'row' | 'column', index: number) => {
    handle.style.touchAction = 'none';
    const clear = () => { dragging = undefined; grid.querySelectorAll('.drop-target').forEach(node => node.classList.remove('drop-target')); };
    const findTarget = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>(`[data-drop-axis="${axis}"]`);
    handle.addEventListener('pointerdown', event => {
      if (sync.conflict || event.button !== 0) return;
      event.preventDefault(); handle.focus();
      dragging = { axis, from: index, version: tableVersion, x: event.clientX, y: event.clientY, moved: false };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!dragging || dragging.axis !== axis) return;
      if (Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) > 6) dragging.moved = true;
      if (!dragging.moved) return;
      info(`正在移动第 ${index + 1} ${axis === 'row' ? '行' : '列'}，松开应用，Esc 取消。`);
      grid.querySelectorAll('.drop-target').forEach(node => node.classList.remove('drop-target'));
      const target = findTarget(event.clientX, event.clientY);
      if (target && grid.contains(target)) target.classList.add('drop-target');
      const bounds = scroll.getBoundingClientRect();
      if (event.clientX > bounds.right - 24) scroll.scrollLeft += 15;
      if (event.clientX < bounds.left + 24) scroll.scrollLeft -= 15;
      if (event.clientY > innerHeight - 35) window.scrollBy(0, 15);
      if (event.clientY < 95) window.scrollBy(0, -15);
    });
    handle.addEventListener('pointerup', event => {
      const current = dragging, target = findTarget(event.clientX, event.clientY); clear();
      if (!current?.moved || !target || !grid.contains(target)) return;
      if (tableSource !== (editor?.state.doc.toString() ?? snapshot?.source)) { info('文档已变化，本次拖动已取消。', true); return; }
      execute({ kind: axis === 'row' ? 'moveRow' : 'moveColumn', from: current.from, to: Number(target.dataset.dropIndex) });
    });
    handle.addEventListener('pointercancel', clear);
    handle.addEventListener('lostpointercapture', clear);
    handle.addEventListener('keydown', event => { if (event.key === 'Escape') clear(); });
  };
  const bindDrop = (element: HTMLElement, axis: 'row' | 'column', index: number) => {
    element.dataset.dropAxis = axis; element.dataset.dropIndex = String(index);
  };
  const handles = document.createElement('tr'); handles.className = 'column-handles'; handles.append(document.createElement('th'));
  table.rows[0]?.cells.forEach((_cell, col) => { const th = document.createElement('th'); const handle = button(`↔ ${col + 1}`, () => { columnIndex = col; refreshTarget(); }); handle.title = `拖动调整第 ${col + 1} 列顺序`; if (canEdit) { bindDrag(handle, 'column', col); bindDrop(th, 'column', col); } th.append(handle); handles.append(th); });
  if (canEdit) grid.append(handles);
  table.rows.forEach((row, r) => {
    const tr = document.createElement('tr');
    if (canEdit) {
      const th = document.createElement('th'); th.className = 'row-handle';
      const handle = button(`↕ ${r + 1}`, () => { rowIndex = r; refreshTarget(); }); handle.title = `拖动调整第 ${r + 1} 行顺序`;
      if (!(table.format === 'markdown' && r === 0)) { bindDrag(handle, 'row', r); bindDrop(tr, 'row', r); }
      th.append(handle); tr.append(th);
    }
    row.cells.forEach((cell, c) => {
      const td = document.createElement(cell.tag === 'th' || (table.format === 'markdown' && r === 0) ? 'th' : 'td');
      const renderedCell = renderedRows[r]?.cells[c];
      if (renderedCell) { td.innerHTML = renderedCell.innerHTML; for(const attribute of renderedCell.attributes)td.setAttribute(attribute.name,attribute.value); }
      else td.textContent = cell.raw.trim();
      td.tabIndex = canEdit ? 0 : -1;
      const select = () => { rowIndex = r; columnIndex = c; refreshTarget(); grid.querySelectorAll('.selected-cell').forEach(node => node.classList.remove('selected-cell')); td.classList.add('selected-cell'); };
      td.addEventListener('focus', select); td.addEventListener('click', select);
      td.addEventListener('contextmenu', event => { if (!canEdit) return; event.preventDefault(); select(); menu.open = true; tools.querySelector('button')?.focus(); });
      if (canEdit) {
        const edit = () => {
          if (sync.conflict || td.querySelector('textarea')) return;
          flushCell?.();
          const input = document.createElement('textarea'); input.value = table.rows[r].cells[c].raw.trim();
          input.setAttribute('aria-label', `编辑第 ${r + 1} 行第 ${c + 1} 列`);
          const originalHTML = td.innerHTML;
          const originalValue = input.value;
          let finished = false;
          const updateCell = () => {
            if (composingCell || sync.conflict || input.value === table.rows[r].cells[c].raw.trim()) return;
            try {
              const changes = editTable(tableSource, table, { kind:'setCell', row:r, column:c, text:input.value });
              const next = applyReplacements(tableSource, changes), end = table.to + next.length - tableSource.length;
              commit(changes);
              tableSource = next;
              table = table.format === 'markdown' ? markdownTable(next,table.from,end) : htmlTables(next,table.from,end)[0];
            } catch (error) { info(String(error),true); }
          };
          const finish = () => {
            if (finished || composingCell) return;
            updateCell();
            finished = true; flushCell = undefined; cellRecovery = undefined;
            if (input.value === originalValue) td.innerHTML = originalHTML;
            else td.textContent = input.value;
            // Refresh rich cell formatting after focus has moved out of the table.
            setTimeout(() => { if (!wrapper.contains(document.activeElement) && snapshot?.source === sync.local) editor?.dispatch({effects:renderedBlocks.of(snapshot.blocks)}); },0);
          };
          flushCell = finish;
          input.addEventListener('input', () => {
            cellRecovery = { source: tableSource, replacements: editTable(tableSource, table, { kind: 'setCell', row: r, column: c, text: input.value }) };
            updateCell();
            remember();
          });
          input.addEventListener('compositionstart', () => { composingCell = true; });
          input.addEventListener('compositionend', () => { composingCell = false; updateCell(); if (deferred) { const message=deferred; deferred=undefined; receive(message); } if (document.activeElement !== input) finish(); });
          input.addEventListener('blur', finish);
          input.addEventListener('keydown', event => {
            if (event.isComposing) return;
            if (event.key === 'Escape') { event.stopPropagation(); finish(); td.focus(); remember(); }
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); finish(); editor?.focus(); }
          });
          td.replaceChildren(input); input.focus();
        };
        td.addEventListener('mousedown', event => {
          if (event.button !== 0 || (event.target as Element).closest('textarea') || (event.ctrlKey || event.metaKey) && (event.target as Element).closest('a')) return;
          event.preventDefault(); select(); edit();
        });
        td.addEventListener('keydown', event => { if (event.target === td && event.key === 'Enter') { event.preventDefault(); edit(); } });
      }
      tr.append(td);
    });
    grid.append(tr);
  });
  scroll.append(grid); wrapper.append(scroll);
  if (canEdit) {
    const addRow = button('+', () => execute({ kind: 'insertRow', at: table.rows.length, row: table.rows.length - 1 }), 'edge-add add-row'); addRow.setAttribute('aria-label', '末尾添加行'); addRow.title = '添加行';
    const addColumn = button('+', () => execute({ kind: 'insertColumn', at: table.rows[0].cells.length }), 'edge-add add-column'); addColumn.setAttribute('aria-label', '末尾添加列'); addColumn.title = '添加列';
    wrapper.append(addRow, addColumn);
  }
  wrapper.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; menuToggle.focus(); } });
  return wrapper;
}

function enhance(body: HTMLElement) {
  const epoch = renderEpoch;
    for (const code of body.querySelectorAll<HTMLElement>('code.language-mermaid')) {
      const source = code.textContent ?? '';
      mermaidPromise ??= import('mermaid').then(module => { module.default.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true }); return module.default; });
      void mermaidPromise.then(async mermaid => {
        try { const { svg } = await mermaid.render(`diagram-${crypto.randomUUID()}`, source); if (epoch === renderEpoch && code.isConnected) {
          const target = document.createElement('div'); target.className = 'mermaid-diagram'; target.innerHTML = svg;
          for(const node of target.querySelectorAll<SVGElement>('.node.internal-link')){
            const label=node.querySelector('.nodeLabel,.label')?.textContent?.trim();if(!label)continue;
            node.setAttribute('role','link');node.setAttribute('tabindex','0');node.setAttribute('aria-label',`打开笔记 ${label}`);node.style.cursor='pointer';
            const open=()=>api.postMessage({type:'openLink',href:'nw-note:'+encodeURIComponent(label)});node.addEventListener('click',open);node.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();open();}});
          }
          code.parentElement!.replaceWith(target);
        } }
        catch { if (code.isConnected) { const error = document.createElement('p'); error.className = 'render-error'; error.textContent = 'Mermaid 语法有误，请编辑此块修复。'; code.parentElement?.append(error); } }
      });
    }
    for (const pdf of body.querySelectorAll<HTMLElement>('[data-pdf-src]')) void import('./pdf').then(module=>{if(epoch===renderEpoch&&pdf.isConnected)disposeMedia.push(module.mountPdf(pdf));}).catch(error=>{pdf.textContent='PDF 模块加载失败：'+String(error);});
}
function blockElement(block: Block, view?: EditorView): HTMLElement {
  const currentSource = view?.state.doc.toString() ?? editor?.state.doc.toString() ?? snapshot!.source;
  const tables = block.kind === 'table' ? [markdownTable(currentSource,block.from,block.to)] : block.kind === 'html' ? htmlTables(currentSource,block.from,block.to) : [];
  const isolated = tables.length === 1 && currentSource.slice(block.from,block.to).trim() === currentSource.slice(tables[0].from,tables[0].to).trim();
  if (isolated && !tables[0].reason && mode === 'edit') return tableElement(tables[0],block.html);
  const section = document.createElement('section'); section.className = 'note-block live-block';
  const body = document.createElement('div'); body.className = 'rendered'; body.innerHTML = block.html; section.append(body);
  for (const task of body.querySelectorAll<HTMLInputElement>('li[data-task-offset] > input[type="checkbox"],li[data-task-offset] > p > input[type="checkbox"]')) {
    const item = task.closest<HTMLElement>('[data-task-offset]')!, offset = Number(item.dataset.taskOffset);
    task.disabled = !!snapshot?.readonly; task.setAttribute('aria-label',item.textContent?.trim() || '任务');
    task.addEventListener('change', () => {
      const source = editor?.state.doc.toString() ?? sync.local;
      commit([{from:offset,to:offset+1,expectedText:source.slice(offset,offset+1),insert:task.checked?'x':' '}]);
    });
  }
  queueMicrotask(() => enhance(body));
  return section;
}
function navigation() {
  nav.replaceChildren(
    button(mode === 'edit' ? '阅读视图' : '实时预览', () => { flushCell?.(); flush(); mode = mode === 'edit' ? 'read' : 'edit'; render(); }),
    button(sourceMode ? '实时预览' : '源码模式', () => {
      flushCell?.(); sourceMode = !sourceMode;
      if (mode === 'read') { mode = 'edit'; render(); }
      editor?.dispatch({ effects:previewMode.of(!sourceMode) }); navigation(); editor?.focus();
    }),
    button('VS Code 源码', () => request('source')),
    button('保存', () => request('save'))
  );
  nav.append(button(showProperties?'隐藏属性':'显示属性',()=>{
    showProperties=!showProperties;
    if(mode==='read') render();
    else {content.classList.toggle('hide-properties',!showProperties);editor?.requestMeasure();navigation();}
  }));
  if (sync.conflict) nav.append(button('复制保留的编辑内容', () => { void navigator.clipboard.writeText(sync.local); }));
}
function render() {
  if (!snapshot) return;
  const scroll = window.scrollY;
  if(editor) savedSelection={anchor:editor.state.selection.main.anchor,head:editor.state.selection.main.head};
  flushCell?.(); editor?.destroy(); editor = undefined;
  ++renderEpoch;
  disposeMedia.forEach(dispose => dispose()); disposeMedia = [];
  document.title = snapshot.name;
  content.className = (snapshot.classes ?? []).join(' ');
  content.classList.toggle('hide-properties',!showProperties);
  navigation(); content.replaceChildren();
  if (mode === 'edit') {
    editor = new EditorView({
      parent:content,
      state:EditorState.create({doc:sync.local,selection:{anchor:Math.min(savedSelection.anchor,sync.local.length),head:Math.min(savedSelection.head,sync.local.length)},extensions:[
        markdown(), keymap.of([
          ...(['Home','End'] as const).map(key=>({key,run:(view:EditorView)=>{const line=view.state.doc.lineAt(view.state.selection.main.head);view.dispatch({selection:{anchor:key==='Home'?line.from:line.to},scrollIntoView:true});return true;},shift:(view:EditorView)=>{const selection=view.state.selection.main,line=view.state.doc.lineAt(selection.head);view.dispatch({selection:{anchor:selection.anchor,head:key==='Home'?line.from:line.to},scrollIntoView:true});return true;}})),
          ...defaultKeymap,
        ]), EditorView.lineWrapping,
        EditorState.readOnly.of(snapshot.readonly),
        EditorView.contentAttributes.of({'aria-label':'笔记实时预览编辑器','spellcheck':'false'}),
        livePreview(blockElement),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !update.transactions.some(tr => tr.annotation(Transaction.remote))) {
            sync.local = update.state.doc.toString(); remember(); schedule();
          }
        }),
        EditorView.domEventHandlers({
          compositionend: () => { setTimeout(() => { if (deferred) { const message=deferred; deferred=undefined; receive(message); } schedule(); },30); },
        }),
      ]}),
    });
    editor.dispatch({ effects:[previewMode.of(!sourceMode),renderedBlocks.of(sync.local === snapshot.source ? snapshot.blocks : [])] });
  } else {
    for (const block of snapshot.blocks) {
      if ((block.kind === 'yaml' && !showProperties) || ['definition','footnoteDefinition'].includes(block.kind)) continue;
      content.append(blockElement(block));
    }
  }
  if (pendingNavigation) { navigate(pendingNavigation); pendingNavigation=undefined; }
  else requestAnimationFrame(()=>window.scrollTo(0,scroll));
}
function receive(message: Snapshot) {
  if (editor?.composing || composingCell) { deferred=message; return; }
  if (message.version < sync.version) return;
  hostSource = message.source;
  message = normalizeSnapshot(message);
  const result=sync.accept(message.source,message.version,message.operationId);
  if (result === 'ignore' && message.version < (snapshot?.version ?? 0)) return;
  snapshot=message;
  if (result === 'initial') {
    if (typeof recovered?.source === 'string' && recovered.source !== recovered.baseSource) {
      sync.local=recovered.source;
      if (recovered.baseSource !== message.source && recovered.source !== message.source) sync.conflict=true;
    }
    if (recovered?.cellRecovery?.source === message.source) {
      try { sync.local=applyReplacements(message.source,recovered.cellRecovery.replacements); } catch { sync.conflict=true; }
    }
    render(); if (sync.local !== sync.source) schedule();
  } else if (editor) {
    if (result === 'external') editor.dispatch({changes:minimalEdit(editor.state.doc.toString(),message.source),annotations:Transaction.remote.of(true)});
    if (sync.local === message.source) editor.dispatch({effects:renderedBlocks.of(message.blocks)});
  } else if (mode === 'read') render();
  if (sync.conflict) { info('检测到外部修改，当前编辑内容已保留，未覆盖磁盘文档。请从笔记菜单复制保留内容后重新打开核对。',true); navigation(); }
  else if (result === 'ack') { info(''); flush(); }
  remember();
}
window.addEventListener('message',event => {
  const message=event.data;
  if (message?.type === 'snapshot') receive(message);
  else if (message?.type === 'navigate' && typeof message.fragment === 'string') { if (snapshot) navigate(message.fragment); else pendingNavigation=message.fragment; }
  else if (message?.type === 'conflict' || message?.type === 'error') {
    sync.pending=undefined; sync.conflict=true; remember(); navigation();
    info(message.message ?? '文档在其他位置发生修改，当前输入已保留，请从笔记菜单复制内容后核对。',true);
  }
});
document.addEventListener('keydown',event => {
  if (event.isComposing || (!event.ctrlKey && !event.metaKey)) return;
  const key=event.key.toLowerCase();
  if (key === 's') { event.preventDefault(); request('save'); }
  if (key === 'z' || key === 'y') { event.preventDefault(); request(event.shiftKey || key === 'y' ? 'redo' : 'undo'); }
  if (key === 'e') { event.preventDefault(); flushCell?.(); flush(); mode=mode === 'edit' ? 'read' : 'edit'; render(); }
},true);
api.postMessage({type:'ready'});
