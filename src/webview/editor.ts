import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { editTable, type Table, type TableOperation } from '../shared/tables';
import { applyReplacements, minimalEdit } from '../shared/edits';
import type { Snapshot } from '../shared/protocol';
import './editor.css';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void; getState(): any; setState(value: unknown): void };
const api = acquireVsCodeApi();
let snapshot: Snapshot | undefined;
let editor: EditorView | undefined;
let draft: { source: string; from: number; to: number; version: number } | undefined = api.getState()?.draft;
let pending: string | undefined;
let mode: 'edit' | 'read' = 'edit';
let renderEpoch = 0;
let mermaidPromise: Promise<any> | undefined;
const root = document.getElementById('app')!;
root.innerHTML = `<header class="app-header"><div class="brand"><span class="brand-mark">N</span><div><strong>Note Workbench</strong><small>本地开发预览 · 0.1</small></div></div><nav aria-label="笔记操作"></nav></header><div class="document-heading"><div><span class="eyebrow">YOUR LOCAL NOTEBOOK</span><h1 id="filename">正在打开笔记…</h1></div><span id="mode-label">编辑</span></div><div id="status" role="status" aria-live="polite"></div><main id="content"></main><footer>本地 Markdown · 内容保存在原文件中</footer>`;
const content = document.getElementById('content')!;
const status = document.getElementById('status')!;
const nav = root.querySelector('nav')!;
const button = (label: string, onClick: () => void, className = '') => { const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.className = className; node.addEventListener('click', onClick); return node; };
const info = (message: string, error = false) => { status.textContent = message; status.classList.toggle('error', error); };
const remember = () => api.setState({ draft });

function commit(replacements: ReturnType<typeof minimalEdit>) {
  if (!snapshot || pending || snapshot.readonly) return;
  if (!replacements.length) { closeDraft(); return; }
  pending = crypto.randomUUID();
  info('正在应用修改…');
  api.postMessage({ type: 'edit', baseVersion: draft?.version ?? snapshot.version, operationId: pending, replacements });
}

function closeDraft() { editor?.destroy(); editor = undefined; draft = undefined; remember(); render(); }
function openDraft(from: number, to: number) {
  if (!snapshot || pending || draft || snapshot.readonly) return;
  draft = { source: snapshot.source.slice(from, to), from, to, version: snapshot.version }; remember(); render();
}
function applyDraft(save = false) {
  if (!draft || !snapshot || pending) return;
  if (draft.version !== snapshot.version) { info('文档已在其他位置修改。草稿已保留，请复制需要的内容后关闭草稿，再基于最新版本编辑。', true); return; }
  const before = snapshot.source.slice(draft.from, draft.to);
  const changes = minimalEdit(before, draft.source).map(edit => ({ ...edit, from: edit.from + draft!.from, to: edit.to + draft!.from }));
  commit(changes);
  if (save) api.postMessage({ type: 'save' });
}

function draftElement(): HTMLElement {
  const box = document.createElement('section'); box.className = 'draft-panel';
  const tools = document.createElement('div'); tools.className = 'draft-toolbar';
  const label = document.createElement('strong'); label.textContent = '编辑源码片段'; tools.append(label);
  tools.append(button('应用修改', () => applyDraft(), 'primary'), button('取消', () => { if (snapshot && draft?.source !== snapshot.source.slice(draft!.from, draft!.to) && !confirm('放弃这段尚未应用的草稿？')) return; closeDraft(); }));
  const host = document.createElement('div'); box.append(tools, host);
  editor = new EditorView({ parent: host, state: EditorState.create({ doc: draft!.source, extensions: [markdown(), lineNumbers(), keymap.of([{ key: 'Mod-Enter', run: () => { applyDraft(); return true; } }, ...defaultKeymap]), EditorView.lineWrapping, EditorView.updateListener.of(update => { if (update.docChanged && draft) { draft.source = update.state.doc.toString(); remember(); } })] }) });
  queueMicrotask(() => editor?.focus()); return box;
}

function tableElement(table: Table): HTMLElement {
  const tableVersion = snapshot!.version, tableSource = snapshot!.source;
  const wrapper = document.createElement('section'); wrapper.className = 'table-card';
  wrapper.setAttribute('aria-label', `${table.format === 'markdown' ? 'Markdown' : 'HTML'} 表格`);
  const tools = document.createElement('div'); tools.className = 'table-tools';
  const caption = document.createElement('span'); caption.textContent = table.format.toUpperCase(); tools.append(caption);
  let rowIndex = table.format === 'markdown' && table.rows.length > 1 ? 1 : 0, columnIndex = 0;
  const targetLabel = document.createElement('span');
  const refreshTarget = () => { targetLabel.textContent = `第 ${rowIndex + 1} 行 / 第 ${columnIndex + 1} 列`; };
  refreshTarget(); tools.append(targetLabel);
  const execute = (op: TableOperation) => {
    if (!snapshot || pending || draft) return;
    if (snapshot.version !== tableVersion) { info('表格已变化，请刷新后重试。', true); render(); return; }
    try { commit(editTable(snapshot.source, table, op)); } catch (error) { info(String(error instanceof Error ? error.message : error), true); }
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
    tools.append(button('删除整表', () => { if (confirm('删除整个表格？可以通过撤销恢复。')) commit([{ from: table.from, to: table.to, expectedText: snapshot!.source.slice(table.from, table.to), insert: '' }]); }, 'danger'));
  }
  tools.append(button('表格源码', () => openDraft(table.from, table.to)));
  wrapper.append(tools);
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
      if (pending || draft || event.button !== 0) return;
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
      if (current.version !== snapshot?.version) { info('文档已变化，本次拖动已取消。', true); return; }
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
      td.textContent = cell.raw.trim(); td.tabIndex = canEdit ? 0 : -1;
      const select = () => { rowIndex = r; columnIndex = c; refreshTarget(); grid.querySelectorAll('.selected-cell').forEach(node => node.classList.remove('selected-cell')); td.classList.add('selected-cell'); };
      td.addEventListener('focus', select); td.addEventListener('click', select);
      if (canEdit) {
        const edit = () => {
          if (pending || draft || td.querySelector('textarea')) return;
          draft = { from: table.from, to: table.to, source: tableSource.slice(table.from, table.to), version: tableVersion }; remember();
          const input = document.createElement('textarea'); input.value = cell.raw.trim(); input.setAttribute('aria-label', `编辑第 ${r + 1} 行第 ${c + 1} 列`);
          const updateDraft = () => {
            try {
              const updated = applyReplacements(tableSource, editTable(tableSource, table, { kind: 'setCell', row: r, column: c, text: input.value }));
              draft!.source = updated.slice(table.from, table.to + updated.length - tableSource.length); remember();
              return true;
            } catch (error) { info(String(error), true); return false; }
          };
          input.addEventListener('input', updateDraft);
          const apply = button('应用', () => { if (updateDraft()) applyDraft(); });
          const cancel = button('取消', () => closeDraft());
          td.replaceChildren(input, apply, cancel); input.focus();
          input.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.isComposing) { event.preventDefault(); apply.click(); } if (event.key === 'Escape') { event.stopPropagation(); cancel.click(); } });
        };
        td.addEventListener('dblclick', edit);
        td.addEventListener('keydown', event => { if (event.target === td && event.key === 'Enter') { event.preventDefault(); edit(); } });
      }
      tr.append(td);
    });
    grid.append(tr);
  });
  scroll.append(grid); wrapper.append(scroll);
  const hint = document.createElement('small'); hint.className = 'table-hint'; hint.textContent = canEdit ? '双击单元格编辑片段 · 拖动 ↕ / ↔ 调整顺序 · 聚焦后可用工具栏操作' : '阅读模式'; wrapper.append(hint);
  return wrapper;
}

function render() {
  if (!snapshot) return;
  editor?.destroy(); editor = undefined;
  const epoch = ++renderEpoch;
  document.getElementById('filename')!.textContent = snapshot.name;
  document.getElementById('mode-label')!.textContent = mode === 'read' ? '阅读模式' : '编辑模式';
  nav.replaceChildren(button(mode === 'edit' ? '阅读' : '编辑', () => { if (draft) { info('请先应用或取消当前草稿。'); return; } mode = mode === 'edit' ? 'read' : 'edit'; render(); }), button('全文源码', () => openDraft(0, snapshot!.source.length)), button('VS Code 源码', () => api.postMessage({ type: 'source' })), button('保存', () => { if (draft) applyDraft(true); else api.postMessage({ type: 'save' }); }, 'primary'));
  content.replaceChildren();
  if (draft) { content.append(draftElement()); return; }
  if (!snapshot.blocks.length) content.append(button('开始写笔记', () => openDraft(0, 0), 'empty-note'));
  for (const block of snapshot.blocks) {
    const tables = snapshot.tables.filter(table => table.from >= block.from && table.to <= block.to);
    // A lone HTML table can use the structural editor. Mixed HTML blocks retain full rendering.
    const isolated = tables.length === 1 && block.source.trim() === snapshot.source.slice(tables[0].from, tables[0].to).trim();
    if (isolated && !tables[0].reason && mode === 'edit') { content.append(tableElement(tables[0])); continue; }
    const section = document.createElement('section'); section.className = 'note-block';
    const body = document.createElement('div'); body.className = 'rendered'; body.innerHTML = block.html;
    if (block.kind === 'definition' || block.kind === 'footnoteDefinition') { body.textContent = mode === 'edit' ? block.source : ''; body.classList.add('definition'); }
    section.append(body);
    if (mode === 'edit' && !snapshot.readonly) section.append(button('编辑', () => openDraft(block.from, block.to), 'block-edit'));
    body.querySelectorAll('a').forEach(link => link.addEventListener('click', event => { event.preventDefault(); api.postMessage({ type: 'openLink', href: link.getAttribute('href') ?? '' }); }));
    for (const code of body.querySelectorAll<HTMLElement>('code.language-mermaid')) {
      const source = code.textContent ?? '';
      mermaidPromise ??= import('mermaid').then(module => { module.default.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true }); return module.default; });
      void mermaidPromise.then(async mermaid => {
        try { const { svg } = await mermaid.render(`diagram-${crypto.randomUUID()}`, source); if (epoch === renderEpoch && code.isConnected) { const target = document.createElement('div'); target.className = 'mermaid-diagram'; target.innerHTML = svg; code.parentElement!.replaceWith(target); } }
        catch { if (code.isConnected) { const error = document.createElement('p'); error.className = 'render-error'; error.textContent = 'Mermaid 语法有误，请编辑此块修复。'; code.parentElement?.append(error); } }
      });
    }
    content.append(section);
  }
}

window.addEventListener('message', event => {
  const message = event.data;
  if (message?.type === 'snapshot') {
    snapshot = message;
    if (message.operationId && message.operationId === pending) { pending = undefined; draft = undefined; remember(); info('修改已应用 · Ctrl+S 保存'); render(); }
    else if (!pending) { if (draft) { info('草稿已保留；应用前将检查文档版本。'); if (!editor) render(); } else render(); }
  } else if (message?.type === 'conflict') { pending = undefined; info('文档版本冲突，草稿已保留，请基于最新版本重试。', true); }
  else if (message?.type === 'error') { pending = undefined; info(message.message, true); }
});
document.addEventListener('keydown', event => {
  if (event.isComposing || (!event.ctrlKey && !event.metaKey)) return;
  if (event.key.toLowerCase() === 's') { event.preventDefault(); if (draft) applyDraft(true); else api.postMessage({ type: 'save' }); }
  if (!draft && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) { event.preventDefault(); api.postMessage({ type: event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo' }); }
});
api.postMessage({ type: 'ready' });
