import {readFile,writeFile,cp,readdir,lstat} from 'node:fs/promises';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';

export async function verifyTree(source,target){
  let count=0;
  for(const item of await readdir(source,{withFileTypes:true})){
    const from=join(source,item.name),to=join(target,item.name);
    if(item.isSymbolicLink())throw new Error(`Linked build resource: ${from}`);
    if(item.isDirectory()){count+=await verifyTree(from,to);continue;}
    const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
    if(hash(await readFile(from))!==hash(await readFile(to)))throw new Error(`Resource mismatch: ${to}`);
    count++;
  }
  return count;
}

async function main(){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  const extensions=join(homedir(),'.vscode','extensions');
  const registry=JSON.parse(await readFile(join(extensions,'extensions.json'),'utf8'));
  const entry=registry.find(item=>item.identifier.id==='local-development.note-workbench');
  if(!entry?.relativeLocation)throw new Error('Installed local-development.note-workbench not found');
  const target=resolve(extensions,entry.relativeLocation);
  if(dirname(target)!==resolve(extensions)||(await lstat(target)).isSymbolicLink())throw new Error('Unexpected development extension path');
  const installed=JSON.parse(await readFile(join(target,'package.json'),'utf8'));
  if(installed.publisher!=='local-development'||installed.name!==manifest.name||installed.version!==manifest.version)throw new Error('Development identity/version mismatch; install the matching development package first');
  const source=join(root,'dist'),destination=join(target,'dist');
  // Copy the whole build: entry points depend on hashed chunks and other assets.
  // Preserve the installed manifest and old assets used by an already-open webview.
  if(!process.argv.includes('--check'))await cp(source,destination,{recursive:true,force:true});
  if(process.argv.includes('--manifest')&&!process.argv.includes('--check')){
    // Register new views/settings without changing the installed development identity.
    installed.contributes=manifest.contributes;installed.activationEvents=manifest.activationEvents;
    await writeFile(join(target,'package.json'),JSON.stringify(installed,null,2)+'\n');
    for(const name of ['package.nls.json','package.nls.zh.json','package.nls.zh-cn.json'])await cp(join(root,name),join(target,name));
  }
  console.log(`Verified ${await verifyTree(source,destination)} build files in ${relative(extensions,target)}. Reload the VS Code window to use the updated build.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
