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

export interface Block { from: number; to: number; kind: string; html: string; source: string }
export interface Rendered { blocks: Block[]; tables: Table[] }
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml']).use(remarkMath);
const createRenderer = () => unified().use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw)
  .use(rehypeSanitize, {
    ...defaultSchema,
    tagNames: [...defaultSchema.tagNames!, 'details', 'summary', 'mark', 'sub', 'sup'],
    attributes: { ...defaultSchema.attributes, code: [['className', /^language-./, 'math-inline', 'math-display']], details: ['open'] },
  })
  .use(rehypeMathjax, { svg: { fontCache: 'none' }, tex: { packages: ['base', 'ams', 'newcommand', 'noundefined', 'textmacros', 'configmacros'], maxBuffer: 20000, maxMacros: 1000 } })
  .use(rehypeStringify);

export function renderDocument(source: string): Rendered {
  const renderer = createRenderer();
  const root: any = parser.parse(source);
  const tables: Table[] = [];
  const blocks: Block[] = [];
  // Pass all reference/footnote definitions into each block's render context.
  const definitions = root.children.filter((node: any) => node.type === 'definition' || node.type === 'footnoteDefinition');
  for (const node of root.children) {
    const from = node.position?.start.offset ?? 0, to = node.position?.end.offset ?? from;
    if (node.type === 'table') tables.push(markdownTable(source, from, to));
    if (node.type === 'html') tables.push(...htmlTables(source, from, to));
    let html = '';
    if (node.type === 'yaml') html = '<div class="metadata-label">YAML 元数据 · 点击编辑源码</div>';
    else if (node.type !== 'definition' && node.type !== 'footnoteDefinition') {
      const output = renderer.runSync({ type: 'root', children: [node, ...definitions] } as any);
      html = renderer.stringify(output);
    }
    blocks.push({ from, to, kind: node.type, html, source: source.slice(from, to) });
  }
  return { blocks, tables };
}
