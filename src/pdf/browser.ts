import {spawn} from 'node:child_process';
import {access,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import * as path from 'node:path';
import type {Readable,Writable} from 'node:stream';

export async function findBrowser(configured=''):Promise<string>{
  const candidates=configured?[configured]:process.platform==='win32'?[
    path.join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.LOCALAPPDATA||'','Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe'),
  ]:process.platform==='darwin'?['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/microsoft-edge'];
  for(const file of candidates){try{await access(file);return file;}catch{}}
  throw new Error('找不到 Edge / Chrome。请安装浏览器，或在 noteWorkbench.pdf.browserPath 中指定浏览器可执行文件。');
}

/** Use a separate headless profile and an inherited pipe, never the user's browser session. */
export async function printPdf(browser:string,url:string,signal?:AbortSignal):Promise<Buffer>{
  if(signal?.aborted)throw new Error('已取消导出');
  const profile=await mkdtemp(path.join(tmpdir(),'note-workbench-pdf-'));
  const child=spawn(browser,['--headless','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--remote-debugging-pipe',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe','pipe','pipe']});
  const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();let id=0,buffer='',failure:Error|undefined;
  const reject=(error:Error)=>{failure=error;for(const item of pending.values())item.reject(error);pending.clear();};
  const abort=()=>{reject(new Error('已取消导出'));child.kill();};signal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(()=>{reject(new Error('PDF 导出超时；请检查图片、图表或浏览器配置。'));child.kill();},90_000);
  child.on('error',reject);child.on('exit',()=>reject(new Error('PDF 浏览器进程已退出')));
  child.stderr?.resume();
  const writer=child.stdio[3] as Writable,reader=child.stdio[4] as Readable;
  writer.on('error',reject);reader.on('error',reject);reader.setEncoding('utf8');
  reader.on('data',(chunk:string)=>{
    buffer+=chunk;let end:number;
    while((end=buffer.indexOf('\0'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line)continue;
      try{const message=JSON.parse(line),item=pending.get(message.id);if(item){pending.delete(message.id);if(message.error)item.reject(new Error(message.error.message));else item.resolve(message.result);}}catch(error){reject(new Error('无法读取浏览器返回结果：'+String(error)));}
    }
  });
  const send=(method:string,params:Record<string,unknown>={},sessionId?:string)=>new Promise<any>((resolve,reject)=>{
    if(failure){reject(failure);return;}const current=++id;pending.set(current,{resolve,reject});writer.write(JSON.stringify({id:current,method,params,sessionId})+'\0');
  });
  try{
    if(signal?.aborted)abort();
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    await send('Page.enable',{},sessionId);
    await send('Emulation.setEmulatedMedia',{media:'print'},sessionId);
    const navigation=await send('Page.navigate',{url},sessionId);if(navigation.errorText)throw new Error(navigation.errorText);
    // Readiness is set only after Mermaid, fonts and images finish (or report a visible failure).
    let ready=false;
    for(let attempt=0;attempt<600;attempt++){
      const response=await send('Runtime.evaluate',{expression:'window.__notePdfState || null',returnByValue:true},sessionId);
      const state=response.result?.value;if(state?.error)throw new Error(state.error);if(state?.ready){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!ready)throw new Error('PDF 内容渲染未完成');
    const result=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false},sessionId);
    const pdf=Buffer.from(result.data,'base64');if(pdf.subarray(0,5).toString()!=='%PDF-')throw new Error('浏览器未返回有效 PDF');return pdf;
  }finally{
    clearTimeout(timeout);signal?.removeEventListener('abort',abort);
    if(child.exitCode===null){await Promise.race([send('Browser.close').catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1500))]);child.kill();}
    writer.destroy();reader.destroy();
    // Only delete the exact temporary profile allocated above, never a configured browser profile.
    if(path.dirname(profile)===path.resolve(tmpdir())&&path.basename(profile).startsWith('note-workbench-pdf-'))await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
  }
}
