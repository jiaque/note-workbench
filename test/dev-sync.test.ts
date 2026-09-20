import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('development sync detects missing hashed chunks and stale content',async()=>{
  // @ts-expect-error build maintenance helper is an ESM JavaScript script
  const {verifyTree}=await import('../scripts/sync-dev.mjs');
  const root=await mkdtemp(join(tmpdir(),'nw-sync-'));
  try {
    const source=join(root,'source'),target=join(root,'target');
    await mkdir(join(source,'chunks'),{recursive:true});await mkdir(target);
    await writeFile(join(source,'editor.js'),'import "./chunks/new-hash.js"');
    await writeFile(join(source,'chunks/new-hash.js'),'export const ready=true');
    await cp(join(source,'editor.js'),join(target,'editor.js'));
    await assert.rejects(()=>verifyTree(source,target));
    await cp(source,target,{recursive:true});assert.equal(await verifyTree(source,target),2);
    await writeFile(join(target,'chunks/new-hash.js'),'stale');await assert.rejects(()=>verifyTree(source,target),/mismatch/);
  }finally{await rm(root,{recursive:true,force:true});}
});
