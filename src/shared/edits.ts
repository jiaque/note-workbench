export interface Replacement { from: number; to: number; insert: string; expectedText: string }

export function applyReplacements(source: string, edits: Replacement[]): string {
  const sorted = [...edits].sort((a, b) => a.from - b.from);
  let end = 0;
  for (const edit of sorted) {
    if (!Number.isInteger(edit.from) || !Number.isInteger(edit.to) || edit.from < end || edit.to < edit.from || edit.to > source.length || source.slice(edit.from, edit.to) !== edit.expectedText)
      throw new Error('文档范围已变化，请刷新后重试。');
    end = edit.to;
  }
  return sorted.reverse().reduce((text, edit) => text.slice(0, edit.from) + edit.insert + text.slice(edit.to), source);
}

export function minimalEdit(before: string, after: string): Replacement[] {
  if (before === after) return [];
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) from++;
  // Do not split a UTF-16 surrogate pair.
  if (from > 0 && /[\uD800-\uDBFF]/.test(before[from - 1])) from--;
  let to = before.length, nextTo = after.length;
  while (to > from && nextTo > from && before[to - 1] === after[nextTo - 1]) { to--; nextTo--; }
  if (to < before.length && to > from && /[\uD800-\uDBFF]/.test(before[to - 1])) { to++; nextTo++; }
  return [{ from, to, insert: after.slice(from, nextTo), expectedText: before.slice(from, to) }];
}
