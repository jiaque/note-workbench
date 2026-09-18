import { minimalEdit } from './edits';

/** One in-flight host edit; keystrokes made during rendering stay in the local document. */
export class LiveSync {
  source = '';
  version = 0;
  local = '';
  pending?: { id: string; source: string };
  conflict = false;
  accept(source: string, version: number, operationId?: string): 'initial' | 'ack' | 'external' | 'conflict' | 'ignore' {
    if (version < this.version) return 'ignore';
    if (!this.version) { this.source = this.local = source; this.version = version; return 'initial'; }
    if (this.pending && operationId === this.pending.id) {
      const expected = this.pending.source;
      this.pending = undefined;
      this.source = source; this.version = version;
      if (source !== expected) { this.conflict = true; return 'conflict'; }
      return 'ack';
    }
    if (this.pending && source === this.pending.source) return 'ignore';
    if (source === this.source) { this.version = version; return 'ignore'; }
    const clean = !this.pending && this.local === this.source;
    this.source = source; this.version = version;
    if (clean) { this.local = source; return 'external'; }
    this.conflict = true; return 'conflict';
  }
  next(id: string) {
    if (this.pending || this.conflict || this.local === this.source) return;
    const replacements = minimalEdit(this.source, this.local);
    this.pending = { id, source: this.local };
    return { type: 'edit', baseVersion: this.version, operationId: id, replacements };
  }
}
