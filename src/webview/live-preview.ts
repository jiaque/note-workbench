import { StateEffect, StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import { obsidianSyntax, maskComments } from '../shared/obsidian';
import type { Block } from '../shared/render';

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkFrontmatter, ['yaml']).use(obsidianSyntax);
export const renderedBlocks = StateEffect.define<Block[]>();
export const previewMode = StateEffect.define<boolean>();
export const previewFocus = StateEffect.define<boolean>();
export const liveParser = (source: string): any => parser.parse(source);

export function livePreview(createBlock: (block: Block, view: EditorView) => HTMLElement) {
  const dirtyTables = new Set<number>();
  class RenderWidget extends WidgetType {
    constructor(readonly block: Block, readonly inline = false) { super(); }
    eq(other: RenderWidget) {
      const activeTable = typeof document !== 'undefined' && document.activeElement?.tagName === 'TEXTAREA' ? document.activeElement.closest<HTMLElement>('.table-card') : null;
      if (this.block.from !== other.block.from || this.inline !== other.inline) return false;
      if (activeTable?.dataset.sourceFrom === String(this.block.from)) {
        if (this.block.html !== other.block.html) dirtyTables.add(this.block.from);
        return true;
      }
      if (dirtyTables.delete(this.block.from)) return false;
      return this.block.html === other.block.html;
    }
    toDOM(view: EditorView) {
      const element = this.inline ? document.createElement('span') : createBlock(this.block, view);
      if (this.inline) { element.className = 'rendered live-inline'; element.innerHTML = this.block.html; }
      element.addEventListener('mousedown', event => {
        if ((event.target as Element).closest('button,input,textarea,summary,.table-card,audio,video,canvas')) return;
        if ((event.ctrlKey || event.metaKey) && (event.target as Element).closest('a')) return;
        event.preventDefault();
        event.stopPropagation();
        const from = this.block.from;
        // Translate the clicked rendered text back to its source, keeping the caret near the click.
        const caret = document.caretRangeFromPoint(event.clientX, event.clientY);
        let text = caret?.startContainer.nodeType === Node.TEXT_NODE && element.contains(caret.startContainer) ? caret.startContainer.textContent ?? '' : '';
        let caretOffset = caret?.startOffset ?? 0;
        // Chromium may put a caret outside contenteditable=false widgets. Hit-test text rectangles in that case.
        if (!text) {
          const walker = document.createTreeWalker(event.target as Node,NodeFilter.SHOW_TEXT);
          let node: Node | null, distance = Infinity;
          while ((node=walker.nextNode())) {
            const value=node.textContent ?? '';
            for(let i=0;i<value.length;i++) {
              const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);
              const rect=range.getBoundingClientRect();if(!rect.width && !rect.height)continue;
              const score=Math.abs(event.clientY-(rect.top+rect.bottom)/2)*100+Math.abs(event.clientX-(rect.left+rect.right)/2);
              if(score<distance){distance=score;text=value;caretOffset=i+(event.clientX>(rect.left+rect.right)/2?1:0);}
            }
          }
        }
        const offset = text ? this.block.source.indexOf(text) : -1;
        const anchor = from + (offset >= 0 ? offset + caretOffset : this.inline ? 1 : 0);
        view.dispatch({ selection: { anchor: Math.min(anchor, view.state.doc.length) }, effects: previewFocus.of(true) });
        view.focus();
      });
      return element;
    }
    ignoreEvent() { return true; }
  }
  type Model = { blocks: Block[]; enabled: boolean; focused: boolean; decorations: DecorationSet };
  const field = StateField.define<Model>({
    create(state) { return { blocks: [], enabled: true, focused: false, decorations: Decoration.none }; },
    update(value, tr) {
      let { blocks, enabled, focused } = value;
      if (tr.docChanged) blocks = blocks.map(block => ({ ...block, from: tr.changes.mapPos(block.from, -1), to: tr.changes.mapPos(block.to, 1), html:block.html.replace(/data-task-offset="(\d+)"/g,(_,offset)=>`data-task-offset="${tr.changes.mapPos(Number(offset))}"`) }));
      for (const effect of tr.effects) {
        if (effect.is(renderedBlocks)) blocks = effect.value;
        if (effect.is(previewMode)) enabled = effect.value;
        if (effect.is(previewFocus)) focused = effect.value;
      }
      return { blocks, enabled, focused, decorations: enabled ? decorate(tr.state, blocks, focused) : Decoration.none };
    },
    provide: field => EditorView.decorations.from(field, value => value.decorations),
  });
  function decorate(state: EditorState, blocks: Block[], focused: boolean): DecorationSet {
    const source = state.doc.toString(), ranges: Range<Decoration>[] = [];
    const active = (from: number, to: number) => focused && state.selection.ranges.some(r => r.from <= to && r.to >= from);
    const hide = (from: number, to: number) => { if (to > from) ranges.push(Decoration.replace({}).range(from, to)); };
    const mark = (from: number, to: number, cls: string) => { if (to > from) ranges.push(Decoration.mark({ class: cls }).range(from, to)); };
    const initial = liveParser(source), masked = maskComments(source, initial), tree = liveParser(masked);
    for (let from = 0; from < source.length;) {
      if (source[from] === masked[from]) { from++; continue; }
      let to = from + 1;
      while (to < source.length && (source[to] !== masked[to] || /\s/.test(source[to]))) to++;
      if (!active(from, to)) hide(from, to);
      from = to;
    }
    let scope: HTMLTemplateElement | undefined;
    let mathIndex = 0;
    const walk = (node: any, root = false) => {
      const from = node.position?.start.offset, to = node.position?.end.offset;
      if (from === undefined || to === undefined) return;
      const raw = source.slice(from, to), children = node.children ?? [];
      const table = node.type === 'table' || node.type === 'html' && /^\s*<table\b/i.test(raw);
      const block = blocks.find(b => b.from === from && b.to === to && (b.source === raw || table));
      const complex = ['table', 'html', 'math', 'code', 'yaml', 'thematicBreak'].includes(node.type)
        || (node.type === 'blockquote' && /^>\s*\[!/.test(raw))
        || (node.type === 'paragraph' && /^!\[/.test(raw));
      if ((root || complex) && block && (!active(from, to) || table)) {
        ranges.push(Decoration.replace({ block: true, widget: new RenderWidget(block) }).range(from, to)); return;
      }
      if (node.type === 'heading') {
        ranges.push(Decoration.line({ class: 'live-heading live-h' + node.depth }).range(state.doc.lineAt(from).from));
        if (!active(from, to) && children.length) { hide(from, children[0].position.start.offset); hide(children.at(-1).position.end.offset, to); }
      }
      const cls: Record<string, string> = { strong: 'live-strong', emphasis: 'live-emphasis', delete: 'live-strike', inlineCode: 'live-code', link: 'live-link', linkReference: 'live-link' };
      if (cls[node.type]) {
        mark(from, to, cls[node.type]);
        if (!active(from, to)) {
          if (children.length) { hide(from, children[0].position.start.offset); hide(children.at(-1).position.end.offset, to); }
          else if (node.type === 'inlineCode') { const size = /^`+/.exec(raw)![0].length; hide(from, from + size); hide(to - size, to); }
        }
      }
      if (node.type === 'obsidianInline') {
        if (raw.startsWith('==')) {
          mark(from, to, 'live-highlight'); if (!active(from, to)) { hide(from, from + 2); hide(to - 2, to); }
          const inner = liveParser(raw.slice(2,-2)).children[0];
          const shift = (child: any) => { if (child.position) { child.position.start.offset += from+2; child.position.end.offset += from+2; } for (const nested of child.children ?? []) shift(nested); };
          for (const child of inner?.children ?? []) { shift(child); walk(child); }
        }
        if (raw.startsWith('[[')) { mark(from, to, 'live-link'); if (!active(from, to)) { const pipe = raw.indexOf('|'); hide(from, from + (pipe < 0 ? 2 : pipe + 1)); hide(to - 2, to); } }
        if (raw.startsWith('#')) mark(from,to,'live-tag');
      }
      if (node.type === 'inlineMath') {
        const math = scope?.content.querySelectorAll('mjx-container')[mathIndex++];
        if (math && !active(from,to)) ranges.push(Decoration.replace({widget:new RenderWidget({from,to,source:raw,kind:'inlineMath',html:math.outerHTML},true)}).range(from,to));
      }
      if (node.type === 'listItem') {
        const line = state.doc.lineAt(from);
        ranges.push(Decoration.line({ class: 'live-list' }).range(line.from));
        mark(from, from + (/^(?:[-+*]|\d+[.)])\s+/.exec(raw)?.[0].length ?? 0), 'live-marker');
      }
      if (node.type === 'blockquote') {
        for (let pos = from; pos <= to;) { const line = state.doc.lineAt(pos); ranges.push(Decoration.line({ class: 'live-quote' }).range(line.from)); pos = line.to + 1; }
      }
      if (['code', 'yaml', 'math'].includes(node.type) || root && node.type === 'html') mark(from, to, 'live-source');
      // Preserve sanitized inline HTML styling while text remains part of the source editor.
      const stack: {tag:string; node:any; element?:Element}[] = [];
      const counts = new Map<string,number>();
      for (const child of children) {
        if (child.type !== 'html') continue;
        const tag = /^<(\/?)([\w-]+)\b/.exec(child.value);
        if (!tag || !['span','sub','sup','kbd','u','mark','abbr'].includes(tag[2])) continue;
        if (!tag[1]) {
          const index = counts.get(tag[2]) ?? 0; counts.set(tag[2],index+1);
          stack.push({tag:tag[2],node:child,element:scope?.content.querySelectorAll(tag[2])[index]});
        } else {
          const open = stack.pop(); if (!open || open.tag !== tag[2]) continue;
          const start = open.node.position.end.offset, end = child.position.start.offset;
          if (end > start) ranges.push(Decoration.mark({class:'live-html live-html-'+tag[2],attributes:open.element?.getAttribute('style') ? {style:open.element.getAttribute('style')!} : {}}).range(start,end));
          if (!active(open.node.position.start.offset,child.position.end.offset)) { hide(open.node.position.start.offset,start); hide(end,child.position.end.offset); }
        }
      }
      for (const child of children) walk(child);
    };
    for (const node of tree.children) {
      const block = blocks.find(b=>b.from===node.position.start.offset);
      scope = typeof document === 'undefined' ? undefined : document.createElement('template');
      if (scope) scope.innerHTML = block?.html ?? '';
      mathIndex = 0;
      walk(node, true);
    }
    for (const block of blocks.filter(b => b.kind === 'footnotes')) ranges.push(Decoration.widget({ block: true, side: 1, widget: new RenderWidget(block) }).range(state.doc.length));
    return Decoration.set(ranges, true);
  }
  return [field, EditorView.domEventHandlers({
    focus: (event, view) => { if(event.target===view.contentDOM) view.dispatch({ effects: previewFocus.of(true) }); },
    blur: (event, view) => { if(event.target===view.contentDOM && !view.composing) view.dispatch({ effects: previewFocus.of(false) }); },
  })];
}
