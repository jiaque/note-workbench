import * as vscode from 'vscode';
import {realpath} from 'node:fs/promises';
import * as path from 'node:path';
export async function completePaths(origin:vscode.Uri,query:string,images:boolean){
  if(/[\r\n\0]/.test(query)||/^[a-z]+:/i.test(query)||query.startsWith('//'))return [];
  let decoded=query;try{decoded=decodeURIComponent(query);}catch{/* Literal percent in a filename. */}
  const slash=decoded.lastIndexOf('/'),prefix=decoded.slice(0,slash+1),name=decoded.slice(slash+1).toLowerCase();
  const folder=vscode.workspace.getWorkspaceFolder(origin)?.uri??vscode.Uri.joinPath(origin,'..');
  const dir=vscode.Uri.joinPath(origin,'..',prefix||'.');
  const normalize=(value:string)=>dir.scheme==='file'&&process.platform==='win32'?value.toLowerCase():value;
  const dirPath=normalize(dir.path),folderPath=normalize(folder.path);
  if(dir.scheme!==folder.scheme||dir.authority!==folder.authority||!(dirPath===folderPath||dirPath.startsWith(folderPath.replace(/\/$/,'')+'/')))return [];
  if(dir.scheme==='file'){try{const base=await realpath(folder.fsPath),target=await realpath(dir.fsPath),relative=path.relative(base,target);if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))return [];}catch{return [];}}
  try{return (await vscode.workspace.fs.readDirectory(dir)).filter(([n,type])=>!n.startsWith('.')&&n.toLowerCase().startsWith(name)&&(type===vscode.FileType.Directory||!images||/\.(png|jpe?g|svg|gif|webp|avif|bmp)$/i.test(n))).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,100).map(([n,type])=>({label:prefix+n+(type===vscode.FileType.Directory?'/':''),detail:type===vscode.FileType.Directory?'📁':'',insert:encodeURI(prefix+n+(type===vscode.FileType.Directory?'/':'')).replace(/[()#?]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}));}catch{return [];}
}
