import type { Snapshot } from './protocol';
import type { Replacement } from './edits';

export const normalizeLines = (source: string) => source.replace(/\r\n/g, '\n');
export function normalizeSnapshot(snapshot: Snapshot): Snapshot {
  const source = snapshot.source;
  if (!source.includes('\r\n')) return snapshot;
  const offsets = new Uint32Array(source.length + 1);
  let removed = 0;
  for (let i=0;i<=source.length;i++) { offsets[i]=i-removed; if(source[i]==='\r' && source[i+1]==='\n') removed++; }
  const range = <T extends {from:number;to:number}>(item:T):T => ({...item,from:offsets[item.from],to:offsets[item.to]});
  return {...snapshot,source:normalizeLines(source),blocks:snapshot.blocks.map(block=>({...range(block),source:normalizeLines(block.source),html:block.html.replace(/data-task-offset="(\d+)"/g,(_,offset)=>`data-task-offset="${offsets[Number(offset)]}"`)})),tables:snapshot.tables.map(table=>({...range(table),rows:table.rows.map(row=>({...range(row),cells:row.cells.map(cell=>({...range(cell),raw:normalizeLines(cell.raw),outerFrom:cell.outerFrom===undefined?undefined:offsets[cell.outerFrom],outerTo:cell.outerTo===undefined?undefined:offsets[cell.outerTo]}))}))}))};
}
export function hostEdits(source: string, edits: Replacement[]): Replacement[] {
  const positions = [0];
  for (let i=0;i<source.length;) { i += source[i]==='\r' && source[i+1]==='\n' ? 2 : 1; positions.push(i); }
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return edits.map(edit=>({from:positions[edit.from],to:positions[edit.to],expectedText:source.slice(positions[edit.from],positions[edit.to]),insert:edit.insert.replace(/\n/g,eol)}));
}
