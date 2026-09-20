import {parse} from 'yaml';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import {maskComments} from './obsidian';

export interface NoteEntry {id:string;name:string;path:string;source:string}
export interface NoteMetadata {aliases:string[];headings:string[];blocks:string[]}
const parser=unified().use(remarkParse).use(remarkFrontmatter,['yaml']);
const metadataCache=new WeakMap<NoteEntry,NoteMetadata>();
const metadataOf=(note:NoteEntry)=>{let metadata=metadataCache.get(note);if(!metadata){metadata=noteMetadata(note.source);metadataCache.set(note,metadata);}return metadata;};
export function noteMetadata(source:string):NoteMetadata {
  const aliases:string[]=[],headings:string[]=[],blocks:string[]=[];
  const front=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if(front)try{const value=parse(front[1])?.aliases;for(const alias of Array.isArray(value)?value:typeof value==='string'?[value]:[])if(typeof alias==='string')aliases.push(alias);}catch{}
  const tree:any=parser.parse(maskComments(source,parser.parse(source)));
  const text=(node:any):string=>node.type==='html'?'':node.value??(node.children??[]).map(text).join('');
  let headingPath:string[]=[];
  const visit=(node:any)=>{
    if(['code','html','yaml'].includes(node.type))return;
    if(node.type==='heading'){const label=text(node);headings.push(label);headingPath=headingPath.slice(0,node.depth-1);headingPath[node.depth-1]=label;const full=headingPath.filter(Boolean).join('#');if(full!==label)headings.push(full);}
    if(node.type==='paragraph'){const raw=source.slice(node.position?.start.offset,node.position?.end.offset),block=/(?:^|\s)\^([A-Za-z0-9-]+)\s*$/.exec(raw);if(block)blocks.push(block[1]);}
    for(const child of node.children??[])visit(child);
  };visit(tree);
  return {aliases:[...new Set(aliases)],headings:[...new Set(headings)],blocks:[...new Set(blocks)]};
}
const normalize=(value:string)=>value.replace(/\\/g,'/').replace(/\.md$/i,'').toLocaleLowerCase();
export function noteCandidates(notes:NoteEntry[],origin:string,target:string):NoteEntry[]{
  try{target=decodeURIComponent(target.split('#')[0]);}catch{return [];}
  if(!target)return notes.filter(note=>note.id===origin);
  const key=normalize(target);
  try{
    const direct=new URL(/\.md$/i.test(target)?target:target+'.md',origin).href;
    const found=notes.filter(note=>normalize(decodeURIComponent(note.id))===normalize(decodeURIComponent(direct)));
    if(found.length)return found;
  }catch{}
  return notes.filter(note=>normalize(note.path)===key||normalize(note.path).endsWith('/'+key)||!key.includes('/')&&(normalize(note.name)===key||metadataOf(note).aliases.some(alias=>normalize(alias)===key)));
}
export interface WikiCompletion {label:string;insert:string;detail:string}
export function wikiCompletions(notes:NoteEntry[],origin:string,query:string):WikiCompletion[]{
  const hash=query.indexOf('#');
  if(hash>=0){
    const target=query.slice(0,hash),fragment=query.slice(hash+1),block=fragment.startsWith('^'),filter=(block?fragment.slice(1):fragment).toLocaleLowerCase();
    return noteCandidates(notes,origin,target).flatMap(note=>{
      const meta=metadataOf(note);
      return (block?meta.blocks:meta.headings).filter(value=>value.toLocaleLowerCase().includes(filter)).map(value=>({label:(block?'^':'')+value,insert:target+'#'+(block?'^':'')+value,detail:note.path}));
    });
  }
  const filter=query.toLocaleLowerCase();
  return notes.flatMap(note=>{
    const path=note.path.replace(/\.md$/i,''),name=note.name.replace(/\.md$/i,'');
    const values=[name,...metadataOf(note).aliases];
    return values.filter(value=>value.toLocaleLowerCase().includes(filter)||path.toLocaleLowerCase().includes(filter)).map(value=>({label:value,insert:path+(value!==name?'|'+value:''),detail:note.path}));
  });
}
