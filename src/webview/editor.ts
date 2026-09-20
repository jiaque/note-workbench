import {t} from '../shared/i18n';
import { ChangeSet, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { editTable, markdownTable, htmlTables, newMarkdownTable, type Table, type TableOperation } from '../shared/tables';
import { applyReplacements, minimalEdit } from '../shared/edits';
import type { Snapshot } from '../shared/protocol';
import { LiveSync } from '../shared/live-sync';
import {BlockPreview} from './block-preview';
import { normalizeSnapshot, hostEdits } from '../shared/line-endings';
import {livePreview, renderedBlocks, previewMode, previewFocus} from './live-preview';
import type {Block} from '../shared/render';
import {findHeading} from '../shared/anchors';
import {blankLinesBetween} from '../shared/block-spacing';
import {wikiCompletion} from './wiki-completion';
import {formattingKeys} from './formatting';
import {createElement, Table2, Tag, FileDown, Play, Pause, RotateCcw, Code2, Save, ChevronLeft, Square, SquareCheck, type IconNode} from 'lucide';
import {loadMermaid} from './mermaid';
import {enhanceEffects,setMotion,toggleMotion,isMotionPaused,replaySvg} from './effects';
import './editor.css';
import './document.css';
import './live-preview.css';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void; getState(): any; setState(value: unknown): void };
const api = acquireVsCodeApi();
const floatingPreview=new BlockPreview(message=>api.postMessage(message),body=>enhance(body));
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
let afterSync: 'save' | 'undo' | 'redo' | 'source' | 'exportPdf' | undefined;
const recovered = api.getState();
let mode: 'edit' | 'read' = 'edit';
let showProperties = false;
let pendingNavigation: string | undefined;
let pendingOffset: number | undefined;
let renderEpoch = 0;
let pendingCell:{from:number;row:number;column:number}|undefined;
let mermaidPromise: Promise<any> | undefined;
let disposeMedia: (()=>void)[]=[];
const root = document.getElementById('app')!;
root.innerHTML = `<details class="document-menu"><summary aria-label="${t("笔记操作")}" title="${t("笔记操作")}">···</summary><nav aria-label="${t("笔记操作")}"></nav></details><div id="status" role="status" aria-live="polite"></div><main id="content"></main>`;
const content = document.getElementById('content')!;
const status = document.getElementById('status')!;
const nav = root.querySelector('nav')!;
const button = (label: string, onClick: () => void, className = '') => { const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.className = className; node.addEventListener('click', onClick); return node; };
const info = (message: string, error = false) => { status.textContent = message; status.classList.toggle('error', error); };
const remember = () => api.setState({ source:sync.local, baseSource:sync.source, cellRecovery });
function navigateOffset(offset:number){
  if(!snapshot){pendingOffset=offset;return;}
  if(!editor){mode='edit';render();}
  if(!editor)return;
  const normalized=hostSource.slice(0,Math.max(0,offset)).replace(/\r\n/g,'\n').length;
  const changes=ChangeSet.of(minimalEdit(snapshot.source,editor.state.doc.toString()),snapshot.source.length);
  const pos=changes.mapPos(Math.min(normalized,snapshot.source.length));
  editor.dispatch({selection:{anchor:pos},effects:[previewFocus.of(true),EditorView.scrollIntoView(pos,{y:'center'})]});editor.focus();
}
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
nav.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();const menu=nav.parentElement as HTMLDetailsElement;menu.open=false;menu.querySelector<HTMLElement>('summary')?.focus();}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    const items=[...nav.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(item=>item.getClientRects().length);
    const index=items.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();
  }
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
  if (editor?.composing || composingCell || !snapshot) return;
  if(snapshot.readonly){if(afterSync==='exportPdf'){afterSync=undefined;api.postMessage({type:'exportPdf'});}return;}
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
  let tableSource = editor?.state.doc.toString() ?? snapshot!.source;
  const wrapper = document.createElement('section'); wrapper.className = 'table-card';
  wrapper.dataset.sourceFrom = String(table.from);
  wrapper.setAttribute('aria-label', t('{format} 表格',{format:table.format === 'markdown' ? 'Markdown' : 'HTML'}));
  const menu = document.createElement('details'); menu.className = 'table-menu';
  const menuToggle = document.createElement('summary'); menuToggle.textContent = '···'; menuToggle.setAttribute('aria-label', t("表格操作")); menu.append(menuToggle);
  const tools = document.createElement('div'); tools.className = 'table-tools'; menu.append(tools);
  const renderedTable = document.createElement('template'); renderedTable.innerHTML = html;
  const renderedRows = Array.from(renderedTable.content.querySelector('table')?.rows ?? []);
  const caption = document.createElement('span'); caption.textContent = table.format.toUpperCase(); tools.append(caption);
  let rowIndex = table.format === 'markdown' && table.rows.length > 1 ? 1 : 0, columnIndex = 0;
  const targetLabel = document.createElement('span');
  const actionButtons:{node:HTMLButtonElement;op:()=>TableOperation}[]=[];
  const refreshTarget = () => { targetLabel.textContent = t('第 {row} 行 / 第 {column} 列',{row:rowIndex+1,column:columnIndex+1});for(const action of actionButtons){try{editTable(tableSource,table,action.op());action.node.disabled=false;action.node.title='';}catch(error){action.node.disabled=true;action.node.title=String(error instanceof Error?error.message:error);}} };
  refreshTarget(); tools.append(targetLabel);
  const execute = (op: TableOperation) => {
    if (!snapshot || sync.conflict) return;
    if ((editor?.state.doc.toString() ?? snapshot.source) !== tableSource) { info(t("表格已变化，请重新选择单元格。"), true); return; }
    try {
      flushCell?.();
      const row=op.kind==='insertRow'?op.at:op.kind==='moveRow'?op.to:op.kind==='deleteRow'?Math.min(op.row,table.rows.length-2):rowIndex;
      const column=op.kind==='insertColumn'?op.at:op.kind==='moveColumn'?op.to:op.kind==='deleteColumn'?Math.min(op.column,table.rows[0].cells.length-2):columnIndex;
      pendingCell={from:table.from,row:Math.max(0,row),column:Math.max(0,column)};
      commit(editTable(tableSource, table, op));info(t("表格已更新，可用 Ctrl+Z 撤销。"));
    } catch (error) { pendingCell=undefined;info(String(error instanceof Error ? error.message : error), true); }
  };
  if (mode === 'edit' && !table.reason && !snapshot?.readonly) {
    const actions: [string, () => TableOperation][] = [
      [t("上方加行"), () => ({ kind: 'insertRow', at: rowIndex, row: rowIndex })],
      [t("下方加行"), () => ({ kind: 'insertRow', at: rowIndex + 1, row: rowIndex })],
      [t("左侧加列"), () => ({ kind: 'insertColumn', at: columnIndex })],
      [t("右侧加列"), () => ({ kind: 'insertColumn', at: columnIndex + 1 })],
      [t("删除行"), () => ({ kind: 'deleteRow', row: rowIndex })],
      [t("删除列"), () => ({ kind: 'deleteColumn', column: columnIndex })],
      [t("行上移"), () => ({ kind: 'moveRow', from: rowIndex, to: rowIndex - 1 })],
      [t("行下移"), () => ({ kind: 'moveRow', from: rowIndex, to: rowIndex + 1 })],
      [t("列左移"), () => ({ kind: 'moveColumn', from: columnIndex, to: columnIndex - 1 })],
      [t("列右移"), () => ({ kind: 'moveColumn', from: columnIndex, to: columnIndex + 1 })],
    ];
    for (const [label, op] of actions){const node=button(label,()=>execute(op()));actionButtons.push({node,op});tools.append(node);
      const highlight=()=>{grid.querySelectorAll('.operation-target').forEach(cell=>cell.classList.remove('operation-target'));if(node.disabled)return;const operation=op();const rowOperation=['insertRow','deleteRow','moveRow'].includes(operation.kind);const cells=rowOperation?grid.querySelectorAll(`[data-cell-row="${rowIndex}"]`):grid.querySelectorAll(`[data-cell-column="${columnIndex}"]`);cells.forEach(cell=>cell.classList.add('operation-target'));};
      node.addEventListener('mouseenter',highlight);node.addEventListener('focus',highlight);for(const event of ['mouseleave','blur'])node.addEventListener(event,()=>grid.querySelectorAll('.operation-target').forEach(cell=>cell.classList.remove('operation-target')));
    }
    refreshTarget();
    if(table.format==='markdown')tools.append(button(t("清空表头内容"),()=>{const replacements=table.rows[0].cells.reduce((source,_cell,column)=>applyReplacements(source,editTable(source,markdownTable(source,table.from,table.to+source.length-tableSource.length),{kind:'setCell',row:0,column,text:''})),tableSource);commit(minimalEdit(tableSource,replacements));}));
    tools.append(button(t("删除整表"), () => { if (confirm(t("删除整个表格？可以通过撤销恢复。"))) commit([{ from: table.from, to: table.to, expectedText: tableSource.slice(table.from, table.to), insert: '' }]); }, 'danger'));
  }
  tools.append(button(t("表格源码"), () => openDraft(table.from, table.to)));
  if(mode==='edit')wrapper.append(menu);
  if (table.reason) { const note = document.createElement('p'); note.textContent = table.reason; wrapper.append(note); }
  const scroll = document.createElement('div'); scroll.className = 'table-scroll';
  const grid = document.createElement('table'); grid.className = 'editable-table';
  const originalTable=renderedTable.content.querySelector('table');
  if(originalTable)for(const attribute of originalTable.attributes)if(attribute.name==='class')grid.classList.add(...attribute.value.split(/\s+/).filter(Boolean));else grid.setAttribute(attribute.name,attribute.value);
  if(table.columns){const group=document.createElement('colgroup');const gutter=document.createElement('col');gutter.style.width='20px';group.append(gutter);grid.append(group);for(const columns of originalTable?.querySelectorAll(':scope > colgroup')??[])grid.append(columns.cloneNode(true));}
  let dragging: { axis: 'row' | 'column'; from: number; version: number; x: number; y: number; moved: boolean } | undefined;
  const canEdit = mode === 'edit' && !snapshot?.readonly && !table.reason;
  const bindDrag = (handle: HTMLElement, axis: 'row' | 'column', index: number) => {
    handle.style.touchAction = 'none';
    let scrollFrame=0,lastPoint={x:0,y:0};
    const clear = () => { dragging = undefined;cancelAnimationFrame(scrollFrame);scrollFrame=0;window.removeEventListener('blur',clear);grid.querySelectorAll('.drop-target').forEach(node => node.classList.remove('drop-target')); };
    const autoScroll=()=>{if(!dragging||!handle.isConnected||snapshot?.version!==dragging.version){clear();return;}const bounds=scroll.getBoundingClientRect();if(lastPoint.x>bounds.right-24)scroll.scrollLeft+=12;if(lastPoint.x<bounds.left+24)scroll.scrollLeft-=12;if(lastPoint.y>innerHeight-35)window.scrollBy(0,12);if(lastPoint.y<60)window.scrollBy(0,-12);scrollFrame=requestAnimationFrame(autoScroll);};
    const findTarget = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>(`[data-drop-axis="${axis}"]`);
    handle.addEventListener('pointerdown', event => {
      if (sync.conflict || event.button !== 0) return;
      event.preventDefault(); handle.focus();
      dragging = { axis, from: index, version: snapshot!.version, x: event.clientX, y: event.clientY, moved: false };
      window.addEventListener('blur',clear);
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!dragging || dragging.axis !== axis) return;
      if (Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) > 6) dragging.moved = true;
      if (!dragging.moved) return;
      lastPoint={x:event.clientX,y:event.clientY};if(!scrollFrame)scrollFrame=requestAnimationFrame(autoScroll);
      info(t(axis==='row'?'正在移动第 {index} 行，松开应用，Esc 取消。':'正在移动第 {index} 列，松开应用，Esc 取消。',{index:index+1}));
      grid.querySelectorAll('.drop-target').forEach(node => node.classList.remove('drop-target'));
      const target = findTarget(event.clientX, event.clientY);
      if (target && grid.contains(target)){try{editTable(tableSource,table,{kind:axis==='row'?'moveRow':'moveColumn',from:index,to:Number(target.dataset.dropIndex)});target.classList.add('drop-target');}catch{}}
      const bounds = scroll.getBoundingClientRect();
      if (event.clientX > bounds.right - 24) scroll.scrollLeft += 15;
      if (event.clientX < bounds.left + 24) scroll.scrollLeft -= 15;
      if (event.clientY > innerHeight - 35) window.scrollBy(0, 15);
      if (event.clientY < 95) window.scrollBy(0, -15);
    });
    handle.addEventListener('pointerup', event => {
      const current = dragging, target = findTarget(event.clientX, event.clientY); clear();
      if (!current?.moved || !target || !grid.contains(target)) return;
      if (snapshot?.version!==current.version||tableSource !== (editor?.state.doc.toString() ?? snapshot?.source)) { info(t("文档已变化，本次拖动已取消。"), true); return; }
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
  table.rows[0]?.cells.forEach((_cell, col) => { const th = document.createElement('th'); const handle = button(`↔ ${col + 1}`, () => { columnIndex = col; refreshTarget(); }); handle.title = t('拖动调整第 {index} 列顺序',{index:col+1}); if (canEdit) { bindDrag(handle, 'column', col); bindDrop(th, 'column', col); } th.append(handle); handles.append(th); });
  if (canEdit) grid.append(handles);
  else if(mode==='read'){handles.querySelectorAll('button').forEach(node=>node.remove());handles.setAttribute('aria-hidden','true');grid.append(handles);}
  table.rows.forEach((row, r) => {
    const tr = document.createElement('tr');
    for(const attribute of renderedRows[r]?.attributes??[])tr.setAttribute(attribute.name,attribute.value);
    if (canEdit) {
      const th = document.createElement('th'); th.className = 'row-handle';
      const handle = button(`↕ ${r + 1}`, () => { rowIndex = r; refreshTarget(); }); handle.title = t('拖动调整第 {index} 行顺序',{index:r+1});
      if (!(table.format === 'markdown' && r === 0)) { bindDrag(handle, 'row', r); bindDrop(tr, 'row', r); }
      else {handle.disabled=true;handle.title=t("Markdown 表头位置固定");}
      th.append(handle); tr.append(th);
    } else if(mode==='read') {
      // Reserve the handle gutter so removing controls does not reflow cells.
      const gutter=document.createElement('th');gutter.className='row-handle';
      const spacer=document.createElement('span');spacer.style.cssText='display:inline-block;width:20px;height:0';gutter.append(spacer);
      gutter.setAttribute('aria-hidden','true');tr.append(gutter);
    }
    row.cells.forEach((cell, c) => {
      const td = document.createElement(cell.tag === 'th' || (table.format === 'markdown' && r === 0) ? 'th' : 'td');
      td.dataset.cellRow=String(r);td.dataset.cellColumn=String(c);
      const renderedCell = renderedRows[r]?.cells[c];
      if (renderedCell) { td.innerHTML = renderedCell.innerHTML; for(const attribute of renderedCell.attributes)td.setAttribute(attribute.name,attribute.value); }
      else td.textContent = cell.raw.trim();
      td.tabIndex = canEdit ? 0 : -1;
      const select = () => { rowIndex = r; columnIndex = c; refreshTarget(); grid.querySelectorAll('.selected-cell').forEach(node => node.classList.remove('selected-cell')); td.classList.add('selected-cell'); };
      if(canEdit){td.addEventListener('focus', select); td.addEventListener('click', select);}
      td.addEventListener('contextmenu', event => { if (!canEdit) return; event.preventDefault(); select(); menu.open = true; tools.querySelector('button')?.focus(); });
      if (canEdit) {
        const edit = (point?:{x:number;y:number}) => {
          if (sync.conflict || td.querySelector('.cell-editor')) return;
          flushCell?.();
          const cellText=()=>table.rows[r].cells[c].raw.trim().replace(/<br\s*\/?\s*>/gi,'\n');
          const originalHTML=td.innerHTML,originalValue=cellText();
          const host=document.createElement('div');host.className='cell-editor';td.replaceChildren(host);
          let finished=false,cellView:EditorView;
          const value=()=>cellView.state.doc.toString();
          const updateCell=()=>{
            if(composingCell||sync.conflict||finished||value()===cellText())return;
            try{
              const changes=editTable(tableSource,table,{kind:'setCell',row:r,column:c,text:table.format==='html'?value().replace(/\n/g,'<br>'):value()});
              const next=applyReplacements(tableSource,changes),end=table.to+next.length-tableSource.length;
              cellRecovery={source:tableSource,replacements:changes};
              commit(changes);tableSource=next;table=table.format==='markdown'?markdownTable(next,table.from,end):htmlTables(next,table.from,end)[0];remember();
            }catch(error){info(String(error),true);}
          };
          const finish=()=>{
            if(finished||composingCell)return;
            updateCell();const text=value();finished=true;flushCell=undefined;cellRecovery=undefined;
            cellView.destroy();
            if(text===originalValue)td.innerHTML=originalHTML;else td.textContent=text;
            setTimeout(()=>{if(!wrapper.contains(document.activeElement)&&snapshot?.source===sync.local)editor?.dispatch({effects:renderedBlocks.of(snapshot.blocks)});},0);
          };
          const move=(step:number)=>{
            if(composingCell||cellView.composing)return;
            const columns=table.rows[0].cells.length,index=r*columns+c+step;
            const target=grid.querySelectorAll<HTMLElement>('td:not(.row-handle),th:not(.row-handle):not(.column-handles th)')[index];
            finish();if(target){target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));}else if(step===1&&index===table.rows.length*columns){columnIndex=0;execute({kind:'insertRow',at:table.rows.length,row:table.rows.length-1});}else editor?.focus();
          };
          cellView=new EditorView({parent:host,state:EditorState.create({doc:originalValue,extensions:[
            markdown(),EditorView.lineWrapping,formattingKeys,wikiCompletion(message=>api.postMessage(message)),
            livePreview(()=>document.createElement('span'),true),
            EditorView.contentAttributes.of({'aria-label':t('编辑第 {row} 行第 {column} 列',{row:r+1,column:c+1})}),
            keymap.of([{key:'Tab',run:()=>{move(1);return true;}},{key:'Shift-Tab',run:()=>{move(-1);return true;}},{key:'Escape',run:()=>{finish();td.focus();return true;}},{key:'Shift-Enter',run:view=>{if(composingCell||view.composing)return false;view.dispatch(view.state.replaceSelection('\n'));return true;}},{key:'Enter',run:view=>{if(composingCell||view.composing)return false;finish();td.focus();return true;}},...defaultKeymap]),
            EditorView.updateListener.of(update=>{if(update.docChanged)updateCell();}),
            EditorView.domEventHandlers({
              compositionstart:()=>{composingCell=true;},
              compositionend:()=>{composingCell=false;setTimeout(()=>{updateCell();if(deferred){const message=deferred;deferred=undefined;receive(message);}},30);},
              blur:()=>{setTimeout(()=>{if(!host.contains(document.activeElement))finish();},0);},
            }),
          ]})});
          cellView.dispatch({effects:renderedBlocks.of([{from:0,to:originalValue.length,source:originalValue,kind:'paragraph',html:originalHTML}])});
          flushCell=finish;cellView.focus();
          if(point){const position=cellView.posAtCoords(point);if(position!==null)cellView.dispatch({selection:{anchor:position}});}

        };
        td.addEventListener('mousedown', event => {
          if (event.button !== 0 || (event.target as Element).closest('.cell-editor') || (event.ctrlKey || event.metaKey) && (event.target as Element).closest('a')) return;
          event.preventDefault(); select(); edit(event.isTrusted?{x:event.clientX,y:event.clientY}:undefined);
        });
        td.addEventListener('keydown', event => { if (event.target === td && event.key === 'Enter') { event.preventDefault(); edit(); } });
      }
      tr.append(td);
    });
    grid.append(tr);
  });
  scroll.append(grid); wrapper.append(scroll);
  if(pendingCell?.from===table.from){const target=pendingCell;pendingCell=undefined;requestAnimationFrame(()=>{if(wrapper.isConnected)grid.querySelector<HTMLElement>(`[data-cell-row="${target.row}"][data-cell-column="${target.column}"]`)?.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));});}
  if (canEdit) {
    const addRow = button('+', () => execute({ kind: 'insertRow', at: table.rows.length, row: table.rows.length - 1 }), 'edge-add add-row'); addRow.setAttribute('aria-label', t("末尾添加行")); addRow.title = t("添加行");
    const addColumn = button('+', () => execute({ kind: 'insertColumn', at: table.rows[0].cells.length }), 'edge-add add-column'); addColumn.setAttribute('aria-label', t("末尾添加列")); addColumn.title = t("添加列");
    wrapper.append(addRow, addColumn);
  }
  wrapper.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; menuToggle.focus(); } });
  queueMicrotask(()=>enhance(wrapper));
  return wrapper;
}

function enhance(body: HTMLElement) {
  enhanceEffects(body,false,body.closest('.block-preview')?'':body.dataset.nwIdentity??'');
  const epoch = renderEpoch;
    for (const code of body.querySelectorAll<HTMLElement>('code.language-mermaid')) {
      const source = code.textContent ?? '';
      mermaidPromise ??= loadMermaid(document.body.classList.contains('vscode-dark')||document.body.classList.contains('vscode-high-contrast'));
      void mermaidPromise.then(async mermaid => {
        try { const { svg } = await mermaid.render(`diagram-${crypto.randomUUID()}`, source); if (epoch === renderEpoch && code.isConnected) {
          const target = document.createElement('div'); target.className = 'mermaid-diagram'; target.innerHTML = svg;
          for(const node of target.querySelectorAll<SVGElement>('.node.internal-link')){
            const label=node.querySelector('.nodeLabel,.label')?.textContent?.trim();if(!label)continue;
            node.setAttribute('role','link');node.setAttribute('tabindex','0');node.setAttribute('aria-label',t('打开笔记 {name}',{name:label}));node.style.cursor='pointer';
            const open=()=>api.postMessage({type:'openLink',href:'nw-note:'+encodeURIComponent(label)});node.addEventListener('click',open);node.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();open();}});
          }
          code.parentElement!.replaceWith(target);
        } }
        catch { if (code.isConnected) { const error = document.createElement('p'); error.className = 'render-error'; error.textContent = t("Mermaid 语法有误，请编辑此块修复。"); code.parentElement?.append(error); } }
      });
    }
    for (const pdf of body.querySelectorAll<HTMLElement>('[data-pdf-src]')) void import('./pdf').then(module=>{if(epoch===renderEpoch&&pdf.isConnected)disposeMedia.push(module.mountPdf(pdf));}).catch(error=>{pdf.textContent=t("PDF 模块加载失败：")+String(error);});
}
function blockElement(block: Block, view?: EditorView): HTMLElement {
  const currentSource = view?.state.doc.toString() ?? editor?.state.doc.toString() ?? snapshot!.source;
  const tables = block.kind === 'table' ? [markdownTable(currentSource,block.from,block.to)] : block.kind === 'html' ? htmlTables(currentSource,block.from,block.to) : [];
  const isolated = tables.length === 1 && currentSource.slice(block.from,block.to).trim() === currentSource.slice(tables[0].from,tables[0].to).trim();
  if (isolated && !tables[0].reason) return tableElement(tables[0],block.html);
  const section = document.createElement('section'); section.className = 'note-block live-block';
  const body = document.createElement('div'); body.className = 'rendered'; body.innerHTML = block.html; section.append(body);
  body.dataset.nwIdentity=String(block.from)+':'+block.source;
  for (const task of body.querySelectorAll<HTMLInputElement>('li[data-task-offset] > input[type="checkbox"],li[data-task-offset] > p > input[type="checkbox"]')) {
    const item = task.closest<HTMLElement>('[data-task-offset]')!, offset = Number(item.dataset.taskOffset);
    task.disabled = !!snapshot?.readonly; task.setAttribute('aria-label',item.textContent?.trim() || t("任务"));
    task.addEventListener('change', () => {
      const source = editor?.state.doc.toString() ?? sync.local;
      commit([{from:offset,to:offset+1,expectedText:source.slice(offset,offset+1),insert:task.checked?'x':' '}]);
    });
  }
  queueMicrotask(() => enhance(body));
  return section;
}
function navigation() {
  const menu=root.querySelector<HTMLDetailsElement>('.document-menu')!;
  const close=()=>{menu.open=false;};
  const icon=(shape:IconNode)=>createElement(shape,{'aria-hidden':'true',width:18,height:18,'stroke-width':1.7});
  const row=(label:string,shape:IconNode,action:()=>void)=>{
    const item=button(label,()=>{close();action();},'note-menu-row');item.prepend(icon(shape));return item;
  };
  const divider=()=>document.createElement('hr');
  const modes=document.createElement('div');modes.className='note-menu-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label',t("笔记视图"));
  for(const [value,label] of [['live',t("实时预览")],['read',t("阅读")],['source',t("源码")]] as const){
    const item=button(label,()=>{
      flushCell?.();flush();close();const previousMode=mode;mode=value==='read'?'read':'edit';sourceMode=value==='source';
      if(previousMode==='edit'&&mode==='edit'&&editor){editor.dispatch({effects:previewMode.of(!sourceMode)});navigation();floatingPreview.update(editor,!sourceMode);}
      else render();
      if(mode==='edit')editor?.focus();
    });
    item.setAttribute('aria-pressed',String(value===(mode==='read'?'read':sourceMode?'source':'live')));modes.append(item);
  }
  const insert=row(t("插入表格"),Table2,()=>{if(mode==='read'){mode='edit';sourceMode=false;render();}insertTable();});
  insert.disabled=!!snapshot?.readonly||sync.conflict;
  const properties=row(t("显示属性"),Tag,()=>{
    showProperties=!showProperties;
    if(mode==='read') render();
    else {content.classList.toggle('hide-properties',!showProperties);editor?.requestMeasure();navigation();}
  });
  properties.setAttribute('aria-pressed',String(showProperties));
  const check=icon(showProperties?SquareCheck:Square);check.classList.add('note-menu-trailing');properties.append(check);
  const motion=document.createElement('div');motion.className='note-menu-motion';
  const trigger=button(t("动效控制"),()=>setSubmenu(true),'note-menu-row');trigger.prepend(icon(Play));
  trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','note-motion-actions');
  const arrow=icon(ChevronLeft);arrow.classList.add('note-menu-trailing');trigger.append(arrow);
  const submenu=document.createElement('div');submenu.id='note-motion-actions';submenu.className='note-menu-submenu';submenu.hidden=true;
  submenu.append(row(isMotionPaused()?t("恢复动效"):t("暂停动效"),isMotionPaused()?Play:Pause,()=>{info(toggleMotion()?t("动效已暂停"):t("动效已恢复"));navigation();}),row(t("重播 SVG"),RotateCcw,replaySvg));
  function setSubmenu(open:boolean){submenu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));}
  motion.append(trigger,submenu);
  motion.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')setSubmenu(true);});
  motion.addEventListener('pointerleave',()=>{if(!motion.contains(document.activeElement))setSubmenu(false);});
  motion.addEventListener('focusout',event=>{if(!motion.contains(event.relatedTarget as Node))setSubmenu(false);});
  motion.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){event.preventDefault();setSubmenu(true);submenu.querySelector('button')?.focus();}
    if(event.key==='ArrowRight'||(event.key==='Escape'&&!submenu.hidden)){event.preventDefault();event.stopPropagation();trigger.focus();setSubmenu(false);}
  });
  const save=row(t("保存"),Save,()=>request('save'));
  const shortcut=document.createElement('span');shortcut.className='note-menu-trailing';shortcut.textContent='Ctrl+S';save.append(shortcut);
  nav.replaceChildren(modes,divider(),insert,properties,row(t("导出 PDF"),FileDown,()=>request('exportPdf')),divider(),motion,row(t("在 VS Code 中编辑"),Code2,()=>request('source')),divider(),save);
  if (sync.conflict) nav.append(button(t("对比冲突内容"),()=>api.postMessage({type:'compare',source:sync.local})),button(t("另存本地草稿"),()=>api.postMessage({type:'recover',source:sync.local})),button(t("采用外部版本"),()=>{if(!confirm(t("采用外部版本将放弃当前未同步草稿。请先对比或另存草稿。")))return;sync.pending=undefined;sync.conflict=false;sync.local=sync.source;cellRecovery=undefined;remember();render();info(t("已载入外部版本。"));}),button(t("复制保留的编辑内容"), () => { void navigator.clipboard.writeText(sync.local); }));
}
function insertTable(){
  if(!editor||sync.conflict||snapshot?.readonly)return;
  flushCell?.();const view=editor,position=view.state.selection.main.head;
  const dialog=document.createElement('dialog');dialog.className='insert-table-dialog';
  dialog.innerHTML=`<form method="dialog"><strong>${t("插入 Markdown 表格")}</strong><label>${t("数据行数")}<input name="rows" aria-label="${t("数据行数")}" type="number" min="1" max="100" value="3" required></label><label>${t("列数")}<input name="columns" aria-label="${t("列数")}" type="number" min="1" max="50" value="3" required></label><p>${t("表头另计一行。")}</p><button value="cancel" formnovalidate>${t("取消")}</button><button value="insert">${t("插入")}</button></form>`;
  document.body.append(dialog);dialog.addEventListener('close',()=>{if(dialog.returnValue==='insert'&&editor===view){try{const rows=Number(dialog.querySelector<HTMLInputElement>('[name="rows"]')!.value),columns=Number(dialog.querySelector<HTMLInputElement>('[name="columns"]')!.value);const source=view.state.doc.toString(),line=view.state.doc.lineAt(position),at=line.to,insert='\n\n'+newMarkdownTable(rows,columns)+'\n\n';pendingCell={from:at+2,row:1,column:0};commit([{from:at,to:at,insert,expectedText:''}]);}catch(error){info(String(error),true);}}dialog.remove();view.focus();});dialog.showModal();
}
function render() {
  if (!snapshot) return;
  floatingPreview.hide();
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
        markdown(), formattingKeys,wikiCompletion(message=>api.postMessage(message)),keymap.of([
          ...(['Home','End'] as const).map(key=>({key,run:(view:EditorView)=>{const line=view.state.doc.lineAt(view.state.selection.main.head);view.dispatch({selection:{anchor:key==='Home'?line.from:line.to},scrollIntoView:true});return true;},shift:(view:EditorView)=>{const selection=view.state.selection.main,line=view.state.doc.lineAt(selection.head);view.dispatch({selection:{anchor:selection.anchor,head:key==='Home'?line.from:line.to},scrollIntoView:true});return true;}})),
          ...defaultKeymap,
        ]), EditorView.lineWrapping,
        EditorState.readOnly.of(snapshot.readonly),
        EditorView.contentAttributes.of({'aria-label':t("笔记实时预览编辑器"),'spellcheck':'false'}),
        livePreview(blockElement),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !update.transactions.some(tr => tr.annotation(Transaction.remote))) {
            sync.local = update.state.doc.toString(); remember(); schedule();
          }
          if(update.docChanged||update.selectionSet||update.focusChanged)floatingPreview.update(update.view,mode==='edit'&&!sourceMode);
        }),
        EditorView.domEventHandlers({
          blur:()=>{setTimeout(()=>{flush();floatingPreview.update(editor,false);},0);},
          compositionend: () => { setTimeout(() => { if (deferred) { const message=deferred; deferred=undefined; receive(message); } schedule();floatingPreview.update(editor,mode==='edit'&&!sourceMode); },30); },
        }),
      ]}),
    });
    editor.dispatch({ effects:[previewMode.of(!sourceMode),renderedBlocks.of(sync.local === snapshot.source ? snapshot.blocks : [])] });
  } else {
    const reading=document.createElement('div');reading.className='reading-document';content.append(reading);
    let previousEnd=0;
    for (const block of snapshot.blocks) {
      const gap=blankLinesBetween(snapshot.source,previousEnd,block.from,previousEnd===0);
      if(gap){const spacer=document.createElement('div');spacer.className='reading-gap';spacer.style.height=`${gap*10}px`;spacer.setAttribute('aria-hidden','true');reading.append(spacer);}
      previousEnd=block.to;
      if ((block.kind === 'yaml' && !showProperties) || ['definition','footnoteDefinition'].includes(block.kind)) continue;
      const wrapper=document.createElement('div');wrapper.className='live-widget';
      wrapper.append(blockElement(block));reading.append(wrapper);
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
  if (sync.conflict) { info(t("检测到外部修改，当前草稿已保留。请从笔记菜单对比内容、另存草稿或采用外部版本。"),true); navigation(); }
  else if (result === 'ack') { info(''); flush(); }
  remember();
  if(pendingOffset!==undefined){const offset=pendingOffset;pendingOffset=undefined;navigateOffset(offset);}
}
window.addEventListener('message',event => {
  const message=event.data;
  if(message?.type==='preview')floatingPreview.receive(message);
  else if(message?.type==='requestExportPdf')request('exportPdf');
  else if(message?.type==='navigateOffset'&&Number.isInteger(message.offset))navigateOffset(message.offset);
  else if(message?.type==='settings'){setMotion(message.motionEnabled!==false);floatingPreview.enabled=message.blockPreview;floatingPreview.update(editor,mode==='edit'&&!sourceMode);}
  else if (message?.type === 'snapshot') receive(message);
  else if (message?.type === 'navigate' && typeof message.fragment === 'string') { if (snapshot) navigate(message.fragment); else pendingNavigation=message.fragment; }
  else if (message?.type === 'conflict' || message?.type === 'error') {
    sync.pending=undefined; sync.conflict=true; remember(); navigation();
    info(message.message ?? t("文档在其他位置发生修改，当前输入已保留，请从笔记菜单复制内容后核对。"),true);
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
document.addEventListener('nw-layout',()=>editor?.requestMeasure());
