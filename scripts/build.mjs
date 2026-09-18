import { build, context } from 'esbuild';
import { mkdir, readFile, cp, rm, lstat } from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const projectRoot=fileURLToPath(new URL('../',import.meta.url)),distPath=resolve(projectRoot,'dist');
if(relative(projectRoot,distPath)!=='dist')throw new Error('Invalid build output path');
if(!process.argv.includes('--watch')){
  const info=await lstat(distPath).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});
  if(info?.isSymbolicLink())throw new Error('Refusing to clean a linked output directory');
  await rm(distPath,{recursive:true,force:true});
}
await mkdir('artifacts', { recursive: true });
await mkdir('dist/webview/pdf', { recursive: true });
for (const item of ['cmaps','standard_fonts','wasm']) await cp(`node_modules/pdfjs-dist/${item}`,`dist/webview/pdf/${item}`,{recursive:true});
await cp('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','dist/webview/pdf/pdf.worker.min.mjs');
const mathjaxVersion = JSON.parse(await readFile('node_modules/mathjax-full/package.json', 'utf8')).version;
const define = { PACKAGE_VERSION: JSON.stringify(mathjaxVersion) };
const jobs = [
  { entryPoints: ['src/extension.ts'], outfile: 'dist/extension.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode'], sourcemap: true, define },
  { entryPoints: ['src/webview/editor.ts'], outdir: 'dist/webview', bundle: true, platform: 'browser', format: 'esm', splitting: true, target: 'chrome130', sourcemap: true, chunkNames: 'chunks/[name]-[hash]', minify: true },
  { entryPoints: ['test/extension/suite.ts'], outfile: 'dist/test/suite.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['vscode'], sourcemap: true, define },
  { entryPoints: ['src/shared/preview.ts'], outfile: 'dist/preview-render.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', define },
];
if (process.argv.includes('--watch')) {
  for (const job of jobs) { const ctx = await context(job); await ctx.watch(); }
  console.log('Watching extension and webview sources.');
} else { await Promise.all(jobs.map(build)); console.log('Built extension, webview, tests and local preview renderer.'); }
