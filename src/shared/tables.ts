import {t} from './i18n';
import { parseFragment } from 'parse5';
import { applyReplacements, type Replacement } from './edits';

export interface Cell { from: number; to: number; raw: string; outerFrom?: number; outerTo?: number; tag?: string }
export interface Row { from: number; to: number; cells: Cell[]; section: string }
export interface Table { from: number; to: number; format: 'markdown' | 'html'; rows: Row[]; separator?: string[]; reason?: string; columns?:{from:number;to:number;html:string;groupFrom:number;groupTo:number}[] }
export type TableOperation =
  | { kind: 'setCell'; row: number; column: number; text: string }
  | { kind: 'insertRow'; at: number; row: number }
  | { kind: 'deleteRow'; row: number }
  | { kind: 'insertColumn'; at: number }
  | { kind: 'deleteColumn'; column: number }
  | { kind: 'moveRow'; from: number; to: number }
  | { kind: 'moveColumn'; from: number; to: number };

export function splitRow(line: string): string[] {
  const value = line.trim();
  const cells: string[] = [];
  let begin = value.startsWith('|') ? 1 : 0;
  for (let i = begin; i < value.length; i++) {
    if (value[i] !== '|') continue;
    let escapes = 0;
    for (let k = i - 1; k >= 0 && value[k] === '\\'; k--) escapes++;
    if (escapes % 2) continue;
    cells.push(value.slice(begin, i)); begin = i + 1;
  }
  if (begin < value.length || !value.endsWith('|')) cells.push(value.slice(begin));
  return cells;
}

export function markdownTable(source: string, from: number, to: number): Table {
  const lines = source.slice(from, to).split(/\r?\n/);
  const separator = splitRow(lines[1] ?? '');
  let offset = from;
  const rows: Row[] = [];
  const eol = source.includes('\r\n') ? 2 : 1;
  lines.forEach((line, index) => {
    if (index !== 1) rows.push({ from: offset, to: offset + line.length, section: index === 0 ? 'header' : 'body', cells: splitRow(line).map(raw => ({ from: offset, to: offset + line.length, raw })) });
    offset += line.length + eol;
  });
  const table: Table = { from, to, format: 'markdown', rows, separator };
  if (!separator.length || rows.some(row => row.cells.length !== separator.length)) table.reason = t("不规则表格请先通过源码修复列数。");
  return table;
}

export function htmlTables(source: string, from: number, to: number): Table[] {
  const fragment: any = parseFragment(source.slice(from, to), { sourceCodeLocationInfo: true });
  const result: Table[] = [];
  const walk = (node: any, visit: (node: any) => void) => { visit(node); for (const child of node.childNodes ?? []) walk(child, visit); };
  const range = (node: any) => node.sourceCodeLocation;
  walk(fragment, node => {
    if (node.tagName !== 'table' || !range(node)) return;
    let ancestor = node.parentNode;
    while (ancestor) { if (ancestor.tagName === 'table') return; ancestor = ancestor.parentNode; }
    const table: Table = { from: from + range(node).startOffset, to: from + range(node).endOffset, format: 'html', rows: [] };
    let groups = 0;
    const groupIds = new Map<any, string>();
    walk(node, child => {
      if (child.tagName === 'table' && child !== node) table.reason = t("嵌套表格暂时仅支持源码编辑。");
      if(child.tagName==='colgroup'){
        const cols=(child.childNodes??[]).filter((item:any)=>item.tagName==='col');
        if(!cols.length||child.attrs?.some((attr:any)=>attr.name==='span'&&attr.value!=='1'))table.reason=t("带 span 的列组请通过源码调整。");
      }
      if(child.tagName==='col'){
        const loc=range(child);if(!loc||!range(child.parentNode)||child.attrs?.some((attr:any)=>attr.name==='span'&&attr.value!=='1'))table.reason=t("省略列组标签或跨多列的 col 定义请通过源码调整。");
        else (table.columns??=[]).push({from:from+loc.startOffset,to:from+loc.endOffset,html:source.slice(from+loc.startOffset,from+loc.endOffset),groupFrom:from+range(child.parentNode).startOffset,groupTo:from+range(child.parentNode).endOffset});
      }
      if (child.tagName !== 'tr') return;
      const loc = range(child);
      if (!loc) { table.reason = t("无法定位表格源码。"); return; }
      if (!groupIds.has(child.parentNode)) groupIds.set(child.parentNode, `${child.parentNode?.tagName ?? 'table'}:${groups++}`);
      const row: Row = { from: from + loc.startOffset, to: from + loc.endOffset, section: groupIds.get(child.parentNode)!, cells: [] };
      for (const cell of child.childNodes ?? []) {
        if (!['th', 'td'].includes(cell.tagName)) continue;
        const cellLoc = range(cell);
        if (!cellLoc?.startTag || !cellLoc?.endTag) { table.reason = t("省略闭合标签的表格暂时请通过源码编辑。"); continue; }
        if ((cell.attrs ?? []).some((attr: any) => ['rowspan', 'colspan'].includes(attr.name) && attr.value !== '1')) table.reason = t("合并单元格表格仅支持源码编辑。");
        const start = from + cellLoc.startTag.endOffset, end = from + cellLoc.endTag.startOffset;
        row.cells.push({ from: start, to: end, raw: source.slice(start, end), outerFrom: from + cellLoc.startOffset, outerTo: from + cellLoc.endOffset, tag: cell.tagName });
      }
      table.rows.push(row);
    });
    if (!table.rows.length || !table.rows[0].cells.length || table.rows.some(row => row.cells.length !== table.rows[0].cells.length)) table.reason ??= t("不规则表格暂时仅支持源码编辑。");
    if(table.columns&&table.columns.length!==table.rows[0]?.cells.length)table.reason??=t("列定义数量与单元格不一致，请通过源码调整。");
    result.push(table);
  });
  return result;
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= items.length || to >= items.length) throw new Error(t("无效移动位置。"));
  const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}
const check = (index: number, length: number, insert = false) => {
  if (!Number.isInteger(index) || index < 0 || index >= length + (insert ? 1 : 0)) throw new Error(t("无效行列位置。"));
};

export function editTable(source: string, table: Table, op: TableOperation): Replacement[] {
  if (table.reason) throw new Error(table.reason);
  const { rows } = table;
  const width = rows[0]?.cells.length ?? 0;
  const patch = (from: number, to: number, insert: string): Replacement => ({ from, to, insert, expectedText: source.slice(from, to) });
  if ('row' in op) check(op.row, rows.length);
  if ('column' in op) check(op.column, width);
  if (op.kind === 'insertRow') check(op.at, rows.length, true);
  if (op.kind === 'insertColumn') check(op.at, width, true);
  if (op.kind === 'deleteColumn' && width === 1) throw new Error(t("最后一列请使用“删除整个表格”。"));
  if(op.kind==='deleteRow'&&table.format==='html'&&rows.length===1)throw new Error(t("最后一行请使用“删除整个表格”。"));
  if (op.kind === 'moveRow') {
    check(op.from, rows.length); check(op.to, rows.length);
    if (rows[op.from].section !== rows[op.to].section || (table.format === 'markdown' && (!op.from || !op.to))) throw new Error(t("不能跨表头或 HTML 分区移动行。"));
  }
  if (op.kind === 'moveColumn') { check(op.from, width); check(op.to, width); }
  if(op.kind==='moveColumn'&&table.columns&&table.columns[op.from].groupFrom!==table.columns[op.to].groupFrom)throw new Error(t("不能跨 HTML 列样式分组移动，请在源码中调整 colgroup。"));
  if (op.kind === 'moveRow' || op.kind === 'moveColumn') { if (op.from === op.to) return []; }
  if (table.format === 'markdown') {
    let grid = rows.map(row => row.cells.map(cell => cell.raw));
    let separator = [...table.separator!];
    switch (op.kind) {
      case 'setCell': {
        const input = op.text.replace(/\r?\n/g, '<br>');
        let text = '';
        for (let i = 0; i < input.length; i++) {
          let escapes = 0;
          if (input[i] === '|') { for (let k = i - 1; k >= 0 && input[k] === '\\'; k--) escapes++; if (escapes % 2 === 0) text += '\\'; }
          text += input[i];
        }
        grid[op.row][op.column] = ` ${text} `; break;
      }
      case 'insertRow': if (!op.at) throw new Error(t("Markdown 表头上方不能插入数据行。")); grid.splice(op.at, 0, Array(width).fill(' ')); break;
      case 'deleteRow': if (!op.row) throw new Error(t("Markdown 表头不能作为数据行删除。")); grid.splice(op.row, 1); break;
      case 'insertColumn': grid.forEach(row => row.splice(op.at, 0, ' ')); separator.splice(op.at, 0, ' --- '); break;
      case 'deleteColumn': grid.forEach(row => row.splice(op.column, 1)); separator.splice(op.column, 1); break;
      case 'moveRow': grid = move(grid, op.from, op.to); break;
      case 'moveColumn': grid = grid.map(row => move(row, op.from, op.to)); separator = move(separator, op.from, op.to); break;
    }
    const lines = grid.map(row => `|${row.join('|')}|`); lines.splice(1, 0, `|${separator.join('|')}|`);
    return [patch(table.from, table.to, lines.join(source.includes('\r\n') ? '\r\n' : '\n'))];
  }
  const columnPatches:Replacement[]=[];
  if(table.columns){
    const columns=table.columns;
    if(op.kind==='insertColumn'){const position=op.at===columns.length?columns.at(-1)!.to:columns[op.at].from;columnPatches.push(patch(position,position,'<col>'));}
    if(op.kind==='deleteColumn'){const column=columns[op.column],last=columns.filter(item=>item.groupFrom===column.groupFrom).length===1;columnPatches.push(patch(last?column.groupFrom:column.from,last?column.groupTo:column.to,''));}
    if(op.kind==='moveColumn'){const order=move(columns,op.from,op.to);columns.forEach((column,i)=>{if(column!==order[i])columnPatches.push(patch(column.from,column.to,order[i].html));});}
  }
  switch (op.kind) {
    case 'setCell': { const cell = rows[op.row].cells[op.column]; return [patch(cell.from, cell.to, op.text)]; }
    case 'deleteRow': return [patch(rows[op.row].from, rows[op.row].to, '')];
    case 'insertRow': {
      const reference = rows[op.row];
      if (op.at !== op.row && op.at !== op.row + 1) throw new Error(t("只能在目标行前后插入。"));
      const tag = reference.section.startsWith('thead:') ? 'th' : 'td';
      const pos = op.at === op.row ? reference.from : reference.to;
      return [patch(pos, pos, `<tr>${Array(width).fill(`<${tag}></${tag}>`).join('')}</tr>`)];
    }
    case 'insertColumn': return [...columnPatches,...rows.map(row => { const cell = row.cells[Math.min(op.at, width - 1)]; const pos = op.at === width ? cell.outerTo! : cell.outerFrom!; return patch(pos, pos, `<${cell.tag}></${cell.tag}>`); })];
    case 'deleteColumn': return [...columnPatches,...rows.map(row => patch(row.cells[op.column].outerFrom!, row.cells[op.column].outerTo!, ''))];
    case 'moveRow': {
      const order = move(rows, op.from, op.to);
      return rows.flatMap((row, i) => row === order[i] ? [] : [patch(row.from, row.to, source.slice(order[i].from, order[i].to))]);
    }
    case 'moveColumn': return [...columnPatches,...rows.flatMap(row => { const order = move(row.cells, op.from, op.to); return row.cells.flatMap((cell, i) => cell === order[i] ? [] : [patch(cell.outerFrom!, cell.outerTo!, source.slice(order[i].outerFrom!, order[i].outerTo!))]); })];
  }
}

export function updatedTable(source: string, table: Table, op: TableOperation): string { return applyReplacements(source, editTable(source, table, op)); }

export function newMarkdownTable(rows:number,columns:number):string{
  if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||columns<1||rows>100||columns>50)throw new Error(t("请选择 1–100 个数据行、1–50 列。"));
  return [Array.from({length:columns},(_,i)=>` ${t('列 {index}',{index:i+1})} `),Array(columns).fill(' --- '),...Array.from({length:rows},()=>Array(columns).fill(' '))].map(row=>'|'+row.join('|')+'|').join('\n');
}
