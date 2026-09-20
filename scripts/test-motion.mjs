import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import renderer from '../dist/preview-render.cjs';
await mkdir('test-results/motion',{recursive:true});
await build({entryPoints:['test/browser/motion.ts'],outfile:'test-results/motion/test.js',bundle:true,platform:'browser',format:'esm'});
const svg=renderer.renderDocument('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><title>移动圆点</title><circle cx="24" cy="34" r="10" fill="#2563eb"><animate attributeName="cx" values="24;216;24" dur="3s" repeatCount="indefinite"/></circle></svg>').blocks.map(b=>b.html).join('');
createServer(async(req,res)=>{
 try{if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/test.css"><style>body{font:14px system-ui;margin:20px}#samples{display:grid;grid-template-columns:repeat(7,1fr);gap:12px}#samples>div{background:#eef3fa;min-height:35px;padding:6px}#result{margin-bottom:20px;font-weight:bold}</style><div id="result">Testing…</div><div id="samples"></div><div class="rendered" id="fold-host"><details id="fold" open><summary>折叠样例</summary><p>内容</p></details></div><div id="svg-host">${svg}</div><script type="module" src="/test.js"></script>`);}else if(['/test.js','/test.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('css')?'text/css':'text/javascript');res.end(await readFile('test-results/motion'+req.url));}else res.writeHead(404).end();}catch(e){res.writeHead(500).end(String(e));}
}).listen(4325,'127.0.0.1',()=>console.log('Motion test http://127.0.0.1:4325'));
