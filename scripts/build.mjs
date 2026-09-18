import { build, context } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const mathjaxVersion = JSON.parse(await readFile('node_modules/mathjax-full/package.json', 'utf8')).version;
const define = { PACKAGE_VERSION: JSON.stringify(mathjaxVersion) };
const jobs = [
  { entryPoints: ['src/extension.ts'], outfile: 'dist/extension.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode'], sourcemap: true, define },
  { entryPoints: ['src/webview/editor.ts'], outdir: 'dist/webview', bundle: true, platform: 'browser', format: 'esm', splitting: true, target: 'chrome130', sourcemap: true, chunkNames: 'chunks/[name]-[hash]', minify: true },
  { entryPoints: ['test/extension/suite.ts'], outfile: 'dist/test/suite.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode'], sourcemap: true, define },
  { entryPoints: ['src/shared/render.ts'], outfile: 'dist/preview-render.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', define },
];
if (process.argv.includes('--watch')) {
  for (const job of jobs) { const ctx = await context(job); await ctx.watch(); }
  console.log('Watching extension and webview sources.');
} else { await Promise.all(jobs.map(build)); console.log('Built extension, webview, tests and local preview renderer.'); }
