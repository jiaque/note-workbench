import type { Replacement } from './edits';
import type { Rendered } from './render';
export interface Snapshot extends Rendered { type: 'snapshot'; source: string; version: number; name: string; readonly: boolean; operationId?: string }
export type ClientMessage =
  | { type: 'ready' }
  | {type:'preview';requestId:number;source:string;from:number;to:number}
  | { type: 'edit'; baseVersion: number; operationId: string; replacements: Replacement[] }
  | { type: 'save' | 'source' | 'undo' | 'redo' | 'exportPdf' }
  | { type: 'openLink'; href: string };
export function validEdit(value: any): value is Extract<ClientMessage, { type: 'edit' }> {
  return value?.type === 'edit' && Number.isInteger(value.baseVersion) && typeof value.operationId === 'string' && value.operationId.length < 100 && Array.isArray(value.replacements) && value.replacements.length <= 10000 && value.replacements.every((r: any) => r && Number.isInteger(r.from) && Number.isInteger(r.to) && typeof r.insert === 'string' && typeof r.expectedText === 'string');
}
