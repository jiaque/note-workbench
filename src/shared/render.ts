import {t} from './i18n';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import rehypeMathjax from 'rehype-mathjax/svg';
import { htmlTables, markdownTable, type Table } from './tables';
import { obsidianSyntax, maskComments, transformObsidian } from './obsidian';
import { refractor } from 'refractor/all';
import { Pencil, ClipboardList, Info, CircleCheck, Flame, Check, CircleHelp, TriangleAlert, X, Zap, Bug, List, Quote } from 'lucide';
import { parseDocument } from 'yaml';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import {cleanStyle} from './css-styles';
import {effectAttributes} from './effects';
import {isolateSvg} from './svg-image';

export interface Block { from: number; to: number; kind: string; html: string; source: string }
export interface Rendered { blocks: Block[]; tables: Table[]; classes?: string[] }
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml']).use(remarkMath).use(obsidianSyntax);
const createRenderer = () => unified().use(remarkRehype, { allowDangerousHtml: true, footnoteLabel: t("脚注"), footnoteBackLabel:t('返回正文') }).use(rehypeRaw)
  .use(() => (tree: any) => isolateSvg(tree))
  .use(() => (tree: any) => filterStyles(tree))
  .use(rehypeSanitize, {
    ...defaultSchema,
    protocols: { ...defaultSchema.protocols, src:[...(defaultSchema.protocols?.src??[]),'data'], href: [...(defaultSchema.protocols?.href ?? []), 'file', 'nw-note', 'nw-tag', 'obsidian'] },
    tagNames: [...defaultSchema.tagNames!, 'colgroup', 'col', 'details', 'summary', 'mark', 'sub', 'sup', 'u', 'abbr', 'figure', 'figcaption', 'audio', 'video', 'source', 'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc'],
    attributes: { ...defaultSchema.attributes,
      '*': [...(defaultSchema.attributes!['*'] ?? []), 'style', 'className', 'dataNwBlock', 'dataHeading', 'dataNoteTarget', 'dataEmbed', 'dataWidth', 'dataHeight', 'dataVaultImage', 'dataTaskOffset', 'dataTaskMark',...Object.keys(effectAttributes),'dataNwRepeat','dataNwSvgStatic'],
      code: [['className', /^language-./, 'math-inline', 'math-display']], details: ['open'],
      col:['span','width'],colgroup:['span'],
      audio:['src','controls','loop','muted','preload'],video:['src','controls','loop','muted','preload','poster','width','height'],source:['src','type'],
      ...Object.fromEntries(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan'].map(tag => [tag, ['viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'strokeLinecap', 'strokeLinejoin', 'opacity', 'fillOpacity', 'strokeOpacity', 'transform', 'textAnchor', 'fontSize', 'fontWeight', 'fontFamily', 'role', 'ariaLabel']])) },
  })
  .use(() => (tree: any) => transformCallouts(tree))
  .use(() => (tree: any) => highlightCode(tree))
  .use(rehypeMathjax, { svg: { fontCache: 'none' }, tex: { packages: AllPackages.filter(name=>!['html','action','noerrors'].includes(name)), maxBuffer: 20000, maxMacros: 1000 } })
  .use(rehypeStringify);

function highlightCode(node: any) {
  if (node.tagName === 'code') {
    const language = node.properties?.className?.find((name: string) => name.startsWith('language-'))?.slice(9);
    if (language && refractor.registered(language)) {
      const value = node.children.map((child: any) => child.value ?? '').join('');
      if (value.length <= 100000) { try { node.children = refractor.highlight(value, language).children; } catch { /* Preserve code on grammar errors. */ } }
      return;
    }
  }
  for (const child of node.children ?? []) highlightCode(child);
}

const calloutTypes: Record<string, { color: string; icon: typeof Pencil }> = {
  note: { color: 'blue', icon: Pencil }, abstract: { color: 'cyan', icon: ClipboardList }, info: { color: 'blue', icon: Info }, todo: { color: 'blue', icon: CircleCheck },
  tip: { color: 'cyan', icon: Flame }, success: { color: 'green', icon: Check }, question: { color: 'orange', icon: CircleHelp }, warning: { color: 'orange', icon: TriangleAlert },
  failure: { color: 'red', icon: X }, danger: { color: 'red', icon: Zap }, bug: { color: 'red', icon: Bug }, example: { color: 'purple', icon: List }, quote: { color: 'gray', icon: Quote },
};
const calloutAliases: Record<string, string> = { summary: 'abstract', tldr: 'abstract', hint: 'tip', important: 'tip', check: 'success', done: 'success', help: 'question', faq: 'question', caution: 'warning', attention: 'warning', fail: 'failure', missing: 'failure', error: 'danger', cite: 'quote' };

const allowedStyles = new Set(['color', 'background-color', 'background', 'padding', 'padding-left','padding-right','padding-top','padding-bottom','margin', 'margin-top', 'margin-bottom','margin-left','margin-right', 'border','border-left','border-right','border-top','border-bottom', 'border-radius', 'display', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-align', 'text-decoration','text-indent','letter-spacing','word-spacing','white-space','overflow-wrap','list-style-type', 'line-height', 'width', 'height', 'max-width', 'min-width', 'vertical-align', 'paint-order', 'stroke', 'stroke-width', 'stroke-linejoin', 'fill', 'opacity']);
function filterStyles(node: any) {
  if (node.properties) {
    if (node.tagName === 'a' && /^[a-z]:[\\/]/i.test(String(node.properties.href ?? ''))) node.properties.href = 'file:///' + node.properties.href.replace(/\\/g, '/');
    const style = node.properties.style;
    if (typeof style === 'string') node.properties.style = cleanStyle(style);
    for(const [key,values] of Object.entries(effectAttributes))if(node.properties[key]!==undefined&&!values.includes(node.properties[key]))delete node.properties[key];
    if(node.properties.dataNwRepeat!==undefined&&!/^(infinite|[1-9]\d{0,2})$/.test(node.properties.dataNwRepeat))delete node.properties.dataNwRepeat;
    // Static SVG only; never allow external paint servers or resource references.
    for (const key of ['fill', 'stroke']) if (/url\s*\(/i.test(String(node.properties[key] ?? ''))) delete node.properties[key];
  }
  for (const child of node.children ?? []) filterStyles(child);
}

// Transform sanitized nodes, never interpolate note text into HTML strings.
function transformCallouts(node: any) {
  for (const child of node.children ?? []) transformCallouts(child);
  if (node.tagName !== 'blockquote') return;
  const paragraph = node.children?.find((child: any) => child.tagName === 'p');
  const first = paragraph?.children?.[0];
  if (first?.type !== 'text') return;
  const match = /^\[!([\w-]+)\]([+-]?)[ \t]*/.exec(first.value);
  if (!match) return;
  first.value = first.value.slice(match[0].length);
  const title: any[] = [], body: any[] = [];
  let inBody = false;
  for (const child of paragraph.children) {
    if (!inBody && child.type === 'text' && child.value.includes('\n')) {
      const split = child.value.indexOf('\n');
      title.push({ ...child, value: child.value.slice(0, split) });
      body.push({ ...child, value: child.value.slice(split + 1) }); inBody = true;
    } else (inBody ? body : title).push(child);
  }
  const type = match[1].toLowerCase();
  if (!title.some(child => child.type !== 'text' || child.value.trim())) title.push({ type: 'text', value: type[0].toUpperCase() + type.slice(1) });
  const theme = calloutTypes[calloutAliases[type] ?? type] ?? calloutTypes.note;
  const icon = { type: 'element', tagName: 'svg', properties: { className: ['callout-icon'], viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ariaHidden: 'true' }, children: theme.icon.map(([tagName, properties]) => ({ type: 'element', tagName, properties, children: [] })) };
  const titleNode = { type: 'element', tagName: match[2] ? 'summary' : 'div', properties: { className: ['callout-title'] }, children: [icon, ...title] };
  const rest = node.children.slice(node.children.indexOf(paragraph) + 1);
  node.tagName = match[2] ? 'details' : 'aside';
  node.properties = { className: ['callout'], dataCallout: type, dataCalloutColor: theme.color, ...(match[2] === '+' ? { open: true } : {}) };
  node.children = [titleNode, ...(body.length ? [{ ...paragraph, children: body }] : []), ...rest];
}

export function renderDocument(source: string): Rendered {
  const renderer = createRenderer();
  let root: any = parser.parse(source);
  const masked = maskComments(source, root);
  if (masked !== source) root = parser.parse(masked);
  const tables: Table[] = [];
  const blocks: Block[] = [];
  let classes:string[]=[];
  const yaml=root.children.find((node:any)=>node.type==='yaml');
  if(yaml){try{const value=parseDocument(yaml.value).toJS({maxAliasCount:50})?.cssclasses;classes=(Array.isArray(value)?value:typeof value==='string'?value.split(/\s+/):[]).filter((item:unknown)=>typeof item==='string'&&/^[\w-]+$/.test(item));}catch{/* Invalid YAML is shown in the property editor. */}}
  transformObsidian(root, source);
  const definitions = root.children.filter((node: any) => node.type === 'definition' || node.type === 'footnoteDefinition');
  const wrappers: any[] = [];
  for (const node of root.children) {
    const from = node.position?.start.offset ?? 0, to = node.position?.end.offset ?? from;
    if (node.type === 'table') tables.push(markdownTable(source, from, to));
    if (node.type === 'html') tables.push(...htmlTables(source, from, to));
    let html = '';
    if (node.type === 'yaml') html = renderProperties(node.value);
    else if (node.type !== 'definition' && node.type !== 'footnoteDefinition') wrappers.push({ type: 'noteBlock', data: { hName: 'section', hProperties: { dataNwBlock: blocks.length } }, children: [node] });
    blocks.push({ from, to, kind: node.type, html, source: source.slice(from, to) });
  }
  // A single document pass gives footnotes globally unique numbering and backlinks.
  const output: any = renderer.runSync({ type: 'root', children: [...wrappers, ...definitions] } as any);
  for (const node of output.children) {
    const index = node.properties?.dataNwBlock;
    if (index !== undefined && blocks[Number(index)]) blocks[Number(index)].html = renderer.stringify({ type: 'root', children: node.children } as any);
    else if (node.type === 'element') blocks.push({ from: source.length, to: source.length, kind: 'footnotes', html: renderer.stringify(node), source: '' });
  }
  return { blocks, tables, classes };
}

function renderProperties(value: string): string {
  const escape = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  try {
    const doc = parseDocument(value, { uniqueKeys: true });
    if (doc.errors.length) throw new Error(doc.errors[0].message);
    const data = doc.toJS({ maxAliasCount: 50 });
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(t("属性必须是键值映射"));
    return '<dl class="properties">' + Object.entries(data).map(([key, item]) => `<dt>${escape(key)}</dt><dd>${Array.isArray(item) ? item.map(v => `<span class="property-chip">${escape(typeof v === 'object' ? JSON.stringify(v) : v)}</span>`).join(' ') : typeof item === 'boolean' ? `<input type="checkbox" disabled ${item ? 'checked' : ''} aria-label="${escape(key)}">` : escape(typeof item === 'object' ? JSON.stringify(item) : item)}</dd>`).join('') + '</dl>';
  } catch (error) { return `<div class="render-error">${t("YAML 属性错误：")}${escape(error instanceof Error ? error.message : error)}</div>`; }
}
