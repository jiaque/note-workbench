import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

const inlineParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
const text = (value: string) => ({ type: 'text', value });
const phrasing = (value: string) => (inlineParser.parse(value).children[0] as any)?.children ?? [text(value)];

// Micromark runs this only in phrasing content: escaped delimiters, code and math
// retain their standard parsing, unlike a regex replacement of rendered HTML.
export function obsidianSyntax(this: any) {
  const data = this.data();
  const construct = { name: 'obsidianInline', tokenize(this: any, effects: any, ok: any, nok: any) {
    let kind = '', first = 0, closing = 0, depth = 0, size = 0;
    const start = (code: number) => { first = code; effects.enter('obsidianInline'); effects.consume(code); return second; };
    const second = (code: number) => {
      if (first === 33 && code === 91) { effects.consume(code); return third; }
      if (first === 91 && code === 91) kind = 'wiki';
      else if (first === 61 && code === 61) kind = 'mark';
      else if (first === 94 && code === 91) kind = 'footnote';
      else return nok(code);
      effects.consume(code); return body;
    };
    const third = (code: number) => { if (code !== 91) return nok(code); kind = 'embed'; effects.consume(code); return body; };
    const body = (code: number | null): any => {
      if (code === null || code < 0 || ++size > 20000) return nok(code);
      if (code === 92) { effects.consume(code); return escaped; }
      if (kind === 'footnote') {
        if (code === 91) depth++;
        if (code === 93 && depth-- === 0) { effects.consume(code); effects.exit('obsidianInline'); return ok; }
      } else if (code === (kind === 'mark' ? 61 : 93)) { closing = code; effects.consume(code); return end; }
      effects.consume(code); return body;
    };
    const escaped = (code: number | null) => { if (code === null || code < 0) return nok(code); effects.consume(code); return body; };
    const end = (code: number) => { if (code !== closing) return body(code); effects.consume(code); effects.exit('obsidianInline'); return ok; };
    return start;
  } };
  (data.micromarkExtensions ??= []).push({ text: { 33: construct, 61: construct, 91: construct, 94: construct } });
  data.micromarkExtensions.push({ text: { 35: { name:'obsidianTag', tokenize(this:any,effects:any,ok:any,nok:any) {
    let value='';
    const start=(code:number)=>{if(this.previous!==null && /[\p{L}\p{N}_/]/u.test(String.fromCharCode(this.previous)))return nok(code);effects.enter('obsidianInline');effects.consume(code);return body;};
    const body=(code:number|null):any=>{if(code===null||code<0||/[\s#.,;:!?()[\]{}<>"'\\*=`~]/.test(String.fromCharCode(code))){if(!value||/^\d+$/.test(value))return nok(code);effects.exit('obsidianInline');return ok(code);}value+=String.fromCharCode(code);effects.consume(code);return body;};
    return start;
  } } } });
  (data.fromMarkdownExtensions ??= []).push({ enter: { obsidianInline(this: any, token: any) { this.enter({ type: 'obsidianInline', value: '' }, token); } }, exit: { obsidianInline(this: any, token: any) {
    const node = this.stack[this.stack.length - 1]; node.value = this.sliceSerialize(token); this.exit(token);
  } } });
}

export function maskComments(source: string, root: any): string {
  const protectedRanges: [number, number][] = [];
  const visit = (node: any) => {
    if (['code', 'inlineCode', 'html', 'math', 'inlineMath', 'yaml'].includes(node.type)) protectedRanges.push([node.position.start.offset, node.position.end.offset]);
    else for (const child of node.children ?? []) visit(child);
  }; visit(root);
  let result = '', offset = 0;
  const comments = /%%[\s\S]*?%%/g;
  for (const match of source.matchAll(comments)) {
    const at = match.index!;
    if (protectedRanges.some(([start, end]) => at >= start && at < end) || /(?:^|[^\\])(?:\\\\)*\\$/.test(source.slice(0, at))) continue;
    result += source.slice(offset, at) + match[0].replace(/[^\r\n]/g, ' '); offset = at + match[0].length;
  }
  return result + source.slice(offset);
}

export function transformObsidian(root: any, source: string) {
  const footnotes: any[] = [], headings = new Map<string, number>();
  let nextFootnote = 0;
  const visit = (node: any) => {
    if (node.type === 'obsidianInline') {
      const raw = node.value;
      if(raw.startsWith('#')) {node.type='link';node.url='nw-tag:'+encodeURIComponent(raw.slice(1));node.children=[text(raw)];node.data={hProperties:{className:['tag']}};}
      else if (raw.startsWith('==')) { node.type = 'strong'; node.children = phrasing(raw.slice(2, -2));
        const base=(node.position?.start.offset??0)+2;
        const rebase=(child:any)=>{if(child.position){child.position.start.offset+=base;child.position.end.offset+=base;}for(const item of child.children??[])rebase(item);};node.children.forEach(rebase);
        node.data = { hName: 'mark' }; }
      else if (raw.startsWith('^[')) {
        let identifier: string; do { identifier = `nw-inline-${++nextFootnote}`; } while (source.includes(`[^${identifier}]`));
        footnotes.push({ type: 'footnoteDefinition', identifier, children: [{ type: 'paragraph', children: phrasing(raw.slice(2, -1)) }] });
        node.type = 'footnoteReference'; node.identifier = identifier;
      } else {
        const embed = raw.startsWith('!'), target = raw.slice(embed ? 3 : 2, -2).replace(/\\\|/g, '|');
        const pipe = target.indexOf('|'), href = pipe < 0 ? target : target.slice(0, pipe), label = pipe < 0 ? href : target.slice(pipe + 1);
        const size = /^(\d+)(?:x(\d+))?$/.exec(label);
        const ext = href.split('#')[0].split('.').pop()?.toLowerCase();
        node.type = 'link'; node.url = href.startsWith('#') ? href : 'nw-note:' + encodeURIComponent(href); node.children = [text(label)];
        node.data = { hProperties: { className: ['internal-link'], dataNoteTarget: href } };
        if (embed) {
          node.type = 'obsidianEmbed'; node.data = { hName: 'span', hProperties: { className: ['note-embed'], dataEmbed: href, ...(size ? { dataWidth: size[1], dataHeight: size[2] } : {}) } };
          if (['png','jpg','jpeg','gif','svg','webp','avif','bmp'].includes(ext ?? '')) {
            node.type = 'image'; node.url = href; node.alt = pipe < 0 || size ? href : label;
            node.data = { hProperties: { ...(size ? { width: Number(size[1]), ...(size[2] ? { height: Number(size[2]) } : {}) } : {}), dataVaultImage: href } }; delete node.children;
          }
        }
      }
      delete node.value;
    }
    if (node.type === 'image') {
      const size = /^(.*?)(?:\|)(\d+)(?:x(\d+))?$/.exec(node.alt ?? '') ?? /^(\d+)(?:x(\d+))?$/.exec(node.alt ?? '');
      if (size) { const short = size.length === 3; node.alt = short ? '' : size[1]; node.data = { ...node.data, hProperties: { ...node.data?.hProperties, width: Number(size[short ? 1 : 2]), ...(size[short ? 2 : 3] ? { height: Number(size[short ? 2 : 3]) } : {}) } }; }
      const extension=node.url.split('#')[0].split('.').pop()?.toLowerCase();
      if(!/^https?:/i.test(node.url)&&['md','pdf','canvas','mp3','wav','ogg','m4a','flac','webm','mp4','ogv','mov','mkv'].includes(extension)){
        node.type='obsidianEmbed';node.data={hName:'span',hProperties:{className:['note-embed'],dataEmbed:node.url}};node.children=[text(node.alt||node.url)];
      }
    }
    if (node.type === 'heading') {
      const plain = (n: any): string => n.type === 'html' ? '' : n.value ?? n.children?.map(plain).join('') ?? '';
      const label = plain(node), index = headings.get(label) ?? 0; headings.set(label, index + 1);
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: label + (index ? `-${index}` : ''), dataHeading: label } };
    }
    if (node.type === 'listItem') {
      const start = node.position?.start.offset;
      const raw = source.slice(start, node.position?.end.offset);
      const task = /^(?:[-+*]|\d+[.)])\s+\[([^\]\r\n])\]\s/.exec(raw);
      if (task) {
        if (node.checked == null) {
          node.checked = task[1] !== ' ';
          const first = node.children?.[0]?.children?.[0]; if (first?.type === 'text') first.value = first.value.replace(/^\[[^\]]\]\s/, '');
        }
        node.data = { hProperties: { dataTaskOffset: start + task[0].indexOf('[') + 1, dataTaskMark: task[1] } };
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  // Block identifiers apply to the preceding container when placed on their own line.
  const blockIds = (parent: any) => {
    for (let i = 0; i < (parent.children?.length ?? 0); i++) {
      const node = parent.children[i];
      if (node.type === 'paragraph') {
        const tail = node.children?.at(-1), match = tail?.type === 'text' && /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/.exec(tail.value);
        const raw=source.slice(node.position?.start.offset,node.position?.end.offset);
        if (match && !/\\\^[A-Za-z0-9-]+\s*$/.test(raw)) {
          const standalone = node.children.length === 1 && tail.value.trim() === '^' + match[1];
          const target = standalone && i > 0 ? parent.children[i - 1] : node;
          target.data = { ...target.data, hProperties: { ...target.data?.hProperties, id: '^' + match[1] } };
          tail.value = tail.value.slice(0, match.index);
        }
      }
      if (!['code', 'html', 'math'].includes(node.type)) blockIds(node);
    }
  }; blockIds(root); visit(root); root.children.push(...footnotes);
}
